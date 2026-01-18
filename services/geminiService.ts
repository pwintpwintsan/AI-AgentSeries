
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from './audioUtils.ts';
import { MODEL_NAME, VOICE_NAME, SYSTEM_INSTRUCTION } from '../constants.ts';

export class InterviewSession {
  private ai: GoogleGenAI;
  private session: any;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private stream: MediaStream | null = null;

  constructor() {
    // Correctly initialize with the required named parameter and environment variable
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
              // Send input data only after the session promise resolves
              sessionPromise.then((session: any) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => console.error("Session input error:", err));
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Process transcriptions
            if (message.serverContent?.outputTranscription) {
              callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
            } else if (message.serverContent?.inputTranscription) {
              callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
            }

            if (message.serverContent?.turnComplete) {
              callbacks.onTurnComplete();
            }

            // Process audio output from the model
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64EncodedAudioString && this.outputAudioContext) {
              if (this.outputAudioContext.state === 'suspended') {
                await this.outputAudioContext.resume();
              }

              callbacks.onSpeaking(true);
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              // Use manual decode functions as per guidelines for raw PCM streams
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

              // Gapless playback scheduling
              source.start(this.nextStartTime);
              this.nextStartTime += buffer.duration;
              this.sources.add(source);
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              this.sources.clear();
              this.nextStartTime = 0;
              callbacks.onSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error("Live session error:", e);
            callbacks.onError(e);
          },
          onclose: () => {
            console.debug("Live session closed");
            callbacks.onClose();
          },
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
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  stop() {
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close().catch(() => {});
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close().catch(() => {});
    }
    if (this.session) {
      try { this.session.close(); } catch(e) {}
    }
  }
}
