
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from './audioUtils';
import { MODEL_NAME, VOICE_NAME, SYSTEM_INSTRUCTION } from '../constants';

export class InterviewSession {
  private ai: any;
  private session: any;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private stream: MediaStream | null = null;

  constructor() {
    // Correctly initialize GoogleGenAI with named parameter apiKey from process.env.API_KEY.
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async start(callbacks: {
    onTranscription: (text: string, isUser: boolean) => void;
    onTurnComplete: () => void;
    onError: (err: any) => void;
    onClose: () => void;
    onSpeaking: (isSpeaking: boolean) => void;
  }) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            if (!this.stream || !this.inputAudioContext) return;
            const source = this.inputAudioContext.createMediaStreamSource(this.stream);
            const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = this.createBlob(inputData);
              // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.outputTranscription) {
              callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
            } else if (message.serverContent?.inputTranscription) {
              callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
            }

            if (message.serverContent?.turnComplete) {
              callbacks.onTurnComplete();
            }

            // Handle Audio Playback - Extract audio data and manage playback queue.
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64EncodedAudioString && this.outputAudioContext) {
              // Ensure context is running
              if (this.outputAudioContext.state === 'suspended') {
                await this.outputAudioContext.resume();
              }

              callbacks.onSpeaking(true);
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              // The audio bytes returned by the API is raw PCM data. Do not use AudioContext.decodeAudioData directly.
              const buffer = await decodeAudioData(decode(base64EncodedAudioString), this.outputAudioContext, 24000, 1);
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(this.outputAudioContext.destination);
              
              source.addEventListener('ended', () => {
                this.sources.delete(source);
                if (this.sources.size === 0) {
                  callbacks.onSpeaking(false);
                }
              });

              // Scheduling each new audio chunk to start at this time ensures smooth, gapless playback.
              source.start(this.nextStartTime);
              this.nextStartTime += buffer.duration;
              this.sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => s.stop());
              this.sources.clear();
              this.nextStartTime = 0;
              callbacks.onSpeaking(false);
            }
          },
          onerror: callbacks.onError,
          onclose: callbacks.onClose,
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      this.session = await sessionPromise;
    } catch (err) {
      callbacks.onError(err);
    }
  }

  private createBlob(data: Float32Array): Blob {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      // The supported audio MIME type is 'audio/pcm'.
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  stop() {
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
    if (this.session) {
      this.session.close();
    }
  }
}
