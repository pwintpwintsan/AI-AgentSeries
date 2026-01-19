
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from './audioUtils.ts';
import { MODEL_NAME, VOICE_NAME, SYSTEM_INSTRUCTION } from '../constants.ts';

export class InterviewSession {
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private stream: MediaStream | null = null;
  private isClosing: boolean = false;

  constructor() {}

  async start(callbacks: {
    onTranscription: (text: string, isUser: boolean) => void;
    onTurnComplete: () => void;
    onError: (err: any) => void;
    onClose: () => void;
    onSpeaking: (isSpeaking: boolean) => void;
  }) {
    try {
      this.isClosing = false;
      // 1. Validate API Key
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("API Key is missing or invalid. Please ensure process.env.API_KEY is configured.");
      }

      // 2. Initialize Media & Audio Contexts
      // We request microphone access first.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Ensure contexts are running (especially on Chrome)
      if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
      if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

      // 3. Create fresh AI instance
      const ai = new GoogleGenAI({ apiKey });

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.debug("Live session connection opened.");
            if (!this.stream || !this.inputAudioContext) return;
            
            const source = this.inputAudioContext.createMediaStreamSource(this.stream);
            const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

            scriptProcessor.onaudioprocess = (e) => {
              if (this.isClosing) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = this.createBlob(inputData);
              
              // Rely solely on sessionPromise resolve to send data
              sessionPromise.then((session: any) => {
                if (session && !this.isClosing) {
                  session.sendRealtimeInput({ media: pcmBlob });
                }
              }).catch(() => {
                // Ignore errors during streaming if session is closing
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(this.inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcriptions
            if (message.serverContent?.outputTranscription) {
              callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
            } else if (message.serverContent?.inputTranscription) {
              callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
            }

            if (message.serverContent?.turnComplete) {
              callbacks.onTurnComplete();
            }

            // Handle Audio Output
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64EncodedAudioString && this.outputAudioContext) {
              callbacks.onSpeaking(true);
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              
              try {
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

                source.start(this.nextStartTime);
                this.nextStartTime += buffer.duration;
                this.sources.add(source);
              } catch (decodeErr) {
                console.error("Audio decoding error:", decodeErr);
              }
            }

            // Handle Interruptions
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
            console.error("Live session SDK error:", e);
            if (!this.isClosing) {
              callbacks.onError(new Error("Network or Protocol error. Please check your connection and API key."));
            }
          },
          onclose: (e: any) => {
            console.debug("Live session connection closed.", e);
            if (!this.isClosing) {
              callbacks.onClose();
            }
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
      console.error("Session start failure:", err);
      this.stop();
      throw err; // Re-throw to be handled by the UI
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
    this.isClosing = true;
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close().catch(() => {});
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close().catch(() => {});
      this.outputAudioContext = null;
    }
    if (this.session) {
      try { this.session.close(); } catch(e) {}
      this.session = null;
    }
  }
}
