/**
 * GeminiLiveService - WebSocket client for Gemini Live API (web-first).
 * Uses client API key from Expo env for direct connection.
 */

const LIVE_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const LIVE_MODEL = process.env.EXPO_PUBLIC_GEMINI_LIVE_MODEL || 'gemini-2.0-flash-live-001';
const LIVE_VOICE = process.env.EXPO_PUBLIC_GEMINI_LIVE_VOICE || 'Aoede';
const LIVE_SYSTEM_INSTRUCTION = process.env.EXPO_PUBLIC_GEMINI_LIVE_SYSTEM_INSTRUCTION || [
  'You are Bodify, a live fitness coach.',
  'Reply briefly and directly for someone actively working out.',
  'Use 1 to 2 short sentences max.',
  'Give one practical next step, not meta commentary or chain-of-thought.',
  'Do not describe your reasoning process.',
  'Never mention protocols, plans, strategy, internal thoughts, or what you are about to do.',
  'Do not use markdown headings or stage directions.',
  'Speak to the user directly like a coach.',
].join(' ');

export default class GeminiLiveService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || LIVE_API_KEY;
    this.model = options.model || LIVE_MODEL;
    this.isNativeAudioModel = /native-audio|live-.*audio/i.test(this.model);
    this.responseModalities = options.responseModalities || (this.isNativeAudioModel ? ['AUDIO'] : ['TEXT']);
    this.voiceName = options.voiceName || LIVE_VOICE;
    this.onText = options.onText || (() => {});
    this.onOpen = options.onOpen || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onError = options.onError || (() => {});
    this.onTurnComplete = options.onTurnComplete || (() => {});
    this.systemInstruction = options.systemInstruction || LIVE_SYSTEM_INSTRUCTION;

    this.ws = null;
    this.isConnected = false;
    this.pendingText = '';
    this.openedAt = 0;
    this.protocol = options.protocol || 'setup';
  }

  extractTextFromParts(parts = []) {
    if (!Array.isArray(parts)) return '';
    return parts
      .map((part) => {
        if (part?.thought) return '';
        if (typeof part?.text === 'string') return part.text;
        if (Array.isArray(part?.parts)) return this.extractTextFromParts(part.parts);
        if (Array.isArray(part?.content?.parts)) return this.extractTextFromParts(part.content.parts);
        return '';
      })
      .join('');
  }

  mergePendingText(nextText, { replace = false } = {}) {
    const incoming = String(nextText || '');
    if (!incoming.trim()) return this.pendingText;

    if (replace || !this.pendingText) {
      this.pendingText = incoming;
      return this.pendingText;
    }

    if (incoming === this.pendingText) {
      return this.pendingText;
    }

    if (incoming.startsWith(this.pendingText)) {
      this.pendingText = incoming;
      return this.pendingText;
    }

    if (this.pendingText.startsWith(incoming)) {
      return this.pendingText;
    }

    this.pendingText += incoming;
    return this.pendingText;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        reject(new Error('WebSocket not available in this environment'));
        return;
      }
      if (!this.apiKey) {
        reject(new Error('Gemini API key missing for Live API'));
        return;
      }
      if (this.isConnected && this.ws) {
        resolve();
        return;
      }

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(wsUrl);
      this.openedAt = Date.now();

      this.ws.onopen = () => {
        try {
          const initialMsg = this.protocol === 'config'
            ? {
              config: {
                model: `models/${this.model}`,
                generationConfig: {
                  responseModalities: this.responseModalities,
                  maxOutputTokens: 120,
                  ...(this.responseModalities.includes('AUDIO') ? {
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: this.voiceName,
                        },
                      },
                    },
                  } : {}),
                },
                ...(this.responseModalities.includes('AUDIO') ? {
                  outputAudioTranscription: {},
                } : {}),
                systemInstruction: this.systemInstruction ? {
                  parts: [{ text: this.systemInstruction }],
                } : undefined,
              },
            }
            : {
              setup: {
                model: `models/${this.model}`,
                generationConfig: {
                  responseModalities: this.responseModalities,
                  maxOutputTokens: 120,
                  ...(this.responseModalities.includes('AUDIO') ? {
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: {
                          voiceName: this.voiceName,
                        },
                      },
                    },
                  } : {}),
                },
                ...(this.responseModalities.includes('AUDIO') ? {
                  outputAudioTranscription: {},
                } : {}),
                systemInstruction: this.systemInstruction ? {
                  parts: [{ text: this.systemInstruction }],
                } : undefined,
              },
            };
          this.ws.send(JSON.stringify(initialMsg));
          this.isConnected = true;
          this.onOpen();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        const error = new Error('Gemini Live websocket transport error');
        this.onError(error);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.ws = null;
        const closeDetail = `Gemini Live disconnected (code ${event?.code || 'unknown'}${event?.reason ? `: ${event.reason}` : ''})`;
        this.onError(new Error(closeDetail));
        this.onClose();
      };
    });
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
    }
    this.ws = null;
    this.isConnected = false;
    this.pendingText = '';
  }

  sendText(text) {
    if (!this.ws || !this.isConnected) {
      throw new Error('Gemini Live websocket is not connected');
    }

    this.pendingText = '';

    const payload = this.isNativeAudioModel
      ? {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      }
      : {
        realtimeInput: {
          text,
        },
      };

    this.ws.send(JSON.stringify(payload));
  }

  async handleMessage(rawData) {
    try {
      let payloadText = rawData;

      // Live API messages can arrive as Blob/ArrayBuffer on some browsers.
      if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
        payloadText = await rawData.text();
      } else if (rawData instanceof ArrayBuffer) {
        payloadText = new TextDecoder().decode(rawData);
      }

      if (typeof payloadText !== 'string') {
        return;
      }

      const data = JSON.parse(payloadText);

      // Newer shape (serverContent)
      const serverContent = data.serverContent;
      if (serverContent?.outputTranscription?.text) {
        const mergedText = this.mergePendingText(serverContent.outputTranscription.text, { replace: true });
        this.onText(mergedText, { partial: !serverContent.turnComplete });
      }
      if (serverContent?.modelTurn?.parts) {
        const textDelta = this.extractTextFromParts(serverContent.modelTurn.parts);
        if (textDelta) {
          const mergedText = this.mergePendingText(textDelta);
          this.onText(mergedText, { partial: !serverContent.turnComplete });
        }
      }

      const candidateText = this.extractTextFromParts(
        data.candidates?.flatMap((candidate) => candidate?.content?.parts || candidate?.parts || []) || []
      );
      if (candidateText) {
        const mergedText = this.mergePendingText(candidateText);
        this.onText(mergedText, { partial: !(serverContent?.turnComplete || data.done === true) });
      }

      const responseText = this.extractTextFromParts(
        data.response?.candidates?.flatMap((candidate) => candidate?.content?.parts || candidate?.parts || []) || []
      );
      if (responseText) {
        const mergedText = this.mergePendingText(responseText);
        this.onText(mergedText, { partial: !(serverContent?.turnComplete || data.done === true) });
      }

      const directMessageText = this.extractTextFromParts(data.modelTurn?.parts || data.content?.parts || []);
      if (directMessageText) {
        const mergedText = this.mergePendingText(directMessageText);
        this.onText(mergedText, { partial: !(serverContent?.turnComplete || data.done === true) });
      }

      if (serverContent?.turnComplete) {
        this.onTurnComplete(this.pendingText);
      }

      // Alternate shape (output)
      const outputText = data.output?.[0]?.content?.[0]?.text;
      if (outputText) {
        const mergedText = this.mergePendingText(outputText);
        this.onText(mergedText, { partial: true });
      }
      if (data.done === true && this.pendingText) {
        this.onTurnComplete(this.pendingText);
      }

      // Error shape
      if (data.error) {
        const message = data.error.message || 'Gemini Live API error';
        if (message.includes('Unknown name "config"')) {
          this.onError(new Error('Gemini Live protocol mismatch: endpoint expects setup/clientContent format'));
          return;
        }
        if (message.includes('Unknown name "setup"')) {
          this.onError(new Error('Gemini Live protocol mismatch: endpoint expects config/realtimeInput format'));
          return;
        }
        this.onError(new Error(message));
      }
    } catch (error) {
      this.onError(error);
    }
  }
}
