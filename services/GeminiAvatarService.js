/**
 * GeminiAvatarService - Connect avatar to Google Gemini AI
 * Provides intelligent conversations, emotion detection, and dynamic responses
 */

import { httpsCallable } from 'firebase/functions';
import { functions, getFunctionsEmulatorHttpBaseUrl } from './firebase';

const CHAT_WITH_AI = 'chatWithAI';
const LOCAL_HTTP_CHAT_WITH_AI = 'chatWithAIHttp';
const DIRECT_GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';
const DIRECT_GEMINI_MODEL_FALLBACKS = process.env.EXPO_PUBLIC_GEMINI_MODEL_FALLBACKS || '';
const DIRECT_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const parseGeminiModelList = (...values) => {
  const parsed = values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(parsed));
};
const DIRECT_GEMINI_MODELS = parseGeminiModelList(DIRECT_GEMINI_MODEL, DIRECT_GEMINI_MODEL_FALLBACKS);
const DIRECT_GEMINI_MAX_OUTPUT_TOKENS = 160;
const DIRECT_GEMINI_MAX_RESPONSE_CHARS = 280;
const isLocalWebDev = () => (
  typeof window !== 'undefined' &&
  __DEV__ &&
  /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/.test(String(window.location?.hostname || ''))
);
const DIRECT_GEMINI_ENABLED =
  String(process.env.EXPO_PUBLIC_USE_DIRECT_GEMINI_FALLBACK || '').toLowerCase() === 'true' ||
  (Boolean(DIRECT_GEMINI_API_KEY) && (__DEV__ || isLocalWebDev()));
const DIRECT_GEMINI_PRIMARY = DIRECT_GEMINI_ENABLED && Boolean(DIRECT_GEMINI_API_KEY);
const buildDirectGeminiApiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const DEFAULT_RESPONSE = {
  message: 'You are doing well. Let\'s keep moving with one small next step.',
  emotion: 'neutral',
  animation: 'talk',
  xp: 0,
  action: 'none',
  bondDelta: 0,
  missionImpact: {
    missionId: null,
    progressDelta: 0,
    completed: false,
  },
  ui: {
    animation: 'talk',
    tts: true,
  },
};

const trimCoachText = (value, maxChars = DIRECT_GEMINI_MAX_RESPONSE_CHARS) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;

  const boundarySlice = normalized.slice(0, maxChars + 1);
  const sentenceBoundary = Math.max(
    boundarySlice.lastIndexOf('. '),
    boundarySlice.lastIndexOf('! '),
    boundarySlice.lastIndexOf('? ')
  );

  if (sentenceBoundary >= Math.floor(maxChars * 0.6)) {
    return boundarySlice.slice(0, sentenceBoundary + 1).trim();
  }

  const wordBoundary = boundarySlice.lastIndexOf(' ');
  if (wordBoundary >= Math.floor(maxChars * 0.7)) {
    return `${boundarySlice.slice(0, wordBoundary).trim()}...`;
  }

  return `${normalized.slice(0, maxChars).trim()}...`;
};

export class GeminiAvatarService {
  constructor(config = {}) {
    this.conversationHistory = [];
    this.userProfile = config.userProfile || { name: 'User', gender: 'male', height: '175', weight: '70' };
    this.avatarPersonality = config.personality || 'friendly_coach'; // friendly_coach, wise_mentor, fun_buddy, motivator
    this.preferDirectGemini = Boolean(config.preferDirectGemini);
    this.maxHistoryLength = 10; // Keep last 10 exchanges for context
    this.chatCallable = httpsCallable(functions, CHAT_WITH_AI);
  }

  usesDirectGemini() {
    return this.preferDirectGemini || DIRECT_GEMINI_ENABLED;
  }

  shouldUseDirectAsPrimary() {
    return Boolean(DIRECT_GEMINI_API_KEY) && (this.preferDirectGemini || DIRECT_GEMINI_PRIMARY);
  }

  recordModelResponse(response) {
    this.conversationHistory.push({
      role: 'model',
      content: response.message,
    });

    if (this.conversationHistory.length > this.maxHistoryLength * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
    }
  }

  /**
   * Get system prompt based on avatar personality
   */
  getSystemPrompt() {
    const personalities = {
      friendly_coach: `You are a friendly fitness coach avatar named Bodify. You're encouraging, positive, and motivating. 
        You help users with workout advice, form correction, and daily motivation. Keep replies as short as possible. Use 1 sentence by default. If the user asks for a workout, routine, or plan, give only the essential plan in at most 2 short sentences with no extra explanation.
        User profile: ${JSON.stringify(this.userProfile)}`,
      
      wise_mentor: `You are a wise mentor avatar. You provide thoughtful, insightful advice on health, fitness, and wellness.
        You speak with calm wisdom and focus on long-term sustainable growth. Keep replies as short as possible. Use 1 sentence by default. If the user asks for a workout, routine, or plan, give only the essential plan in at most 2 short sentences with no extra explanation.
        User profile: ${JSON.stringify(this.userProfile)}`,
      
      fun_buddy: `You are a fun, playful companion avatar. You're energetic, encouraging, and make fitness fun!
        You use humor, emojis are fine, and keep things light and enjoyable. Keep replies as short as possible. Use 1 sentence by default. If the user asks for a workout, routine, or plan, give only the essential plan in at most 2 short sentences with no extra explanation.
        User profile: ${JSON.stringify(this.userProfile)}`,
      
      motivator: `You are an intense motivator avatar. You're fired up about helping users reach their goals.
        You're energetic, push for excellence, and celebrate wins. Keep replies as short as possible. Use 1 sentence by default. If the user asks for a workout, routine, or plan, give only the essential plan in at most 2 short sentences with no extra explanation.
        User profile: ${JSON.stringify(this.userProfile)}`,
    };

    return personalities[this.avatarPersonality] || personalities.friendly_coach;
  }

  getLocalEmulatorChatUrl() {
    const baseUrl = getFunctionsEmulatorHttpBaseUrl();
    if (!baseUrl || typeof window === 'undefined') return '';
    return `${baseUrl}/${LOCAL_HTTP_CHAT_WITH_AI}`;
  }

  async chatViaLocalEmulator(userMessage, history) {
    const localUrl = this.getLocalEmulatorChatUrl();
    if (!localUrl) return null;

    const response = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        personality: this.avatarPersonality,
        userProfile: this.userProfile,
        history,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = payload?.error || response.statusText || 'Local emulator chat failed';
      throw new Error(`Local emulator chat failed: ${details}`);
    }

    return payload;
  }

  /**
   * Send message to Firebase Functions and get structured Gemini response
   */
  async chat(userMessage) {
    try {
      // Add user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      const history = this.conversationHistory.slice(-this.maxHistoryLength * 2).map((msg) => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        text: msg.content,
      }));

      if (this.preferDirectGemini && !DIRECT_GEMINI_API_KEY) {
        throw new Error('Direct Gemini is required for Home coach but EXPO_PUBLIC_GEMINI_API_KEY is missing');
      }

      if (this.shouldUseDirectAsPrimary()) {
        try {
          const directResponse = await this.chatDirectlyWithGemini(userMessage);
          this.recordModelResponse(directResponse);
          return directResponse;
        } catch (directError) {
          if (this.preferDirectGemini) {
            throw directError;
          }
          console.warn('[GeminiAvatarService] Direct Gemini primary path failed, falling back to Functions:', directError);
        }
      }

      const localResponse = await this.chatViaLocalEmulator(userMessage, history);
      const result = localResponse || await this.chatCallable({
        message: userMessage,
        personality: this.avatarPersonality,
        userProfile: this.userProfile,
        history,
      });
      const normalized = this.normalizeStructuredResponse(localResponse || result?.data, userMessage);

      this.recordModelResponse(normalized);

      return normalized;
    } catch (error) {
      if (this.shouldUseDirectFallback(error)) {
        const fallbackResponse = await this.chatDirectlyWithGemini(userMessage);
        this.recordModelResponse(fallbackResponse);
        return fallbackResponse;
      }
      console.error('[GeminiAvatarService] Chat error:', error);
      throw error;
    }
  }

  shouldUseDirectFallback(error) {
    // Always allow fallback to direct Gemini when the API key is available,
    // regardless of platform or DIRECT_GEMINI_ENABLED (which requires window.location on web).
    if (!DIRECT_GEMINI_API_KEY) {
      return false;
    }
    const message = String(error?.message || error || '').toLowerCase();
    return (
      message.includes('failed-precondition') ||
      message.includes('not-found') ||
      message.includes('unavailable') ||
      message.includes('internal') ||
      message.includes('functions') ||
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('local emulator chat failed')
    );
  }

  async chatDirectlyWithGemini(userMessage) {
    const messageHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    const modelCandidates = DIRECT_GEMINI_MODELS.length > 0 ? DIRECT_GEMINI_MODELS : ['gemini-2.5-flash'];
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            this.getSystemPrompt(),
            'Respond only as JSON with fields: text, emotion, xp, action, bondDelta, missionImpact, ui.',
            'Keep the response game-like, direct, and minimal.',
            `Keep text under ${DIRECT_GEMINI_MAX_RESPONSE_CHARS} characters. Avoid unnecessary exercise explanation.`,
          ].join('\n'),
        }],
      },
      contents: messageHistory,
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: DIRECT_GEMINI_MAX_OUTPUT_TOKENS,
      },
    });

    let lastError = null;

    for (const model of modelCandidates) {
      const response = await fetch(`${buildDirectGeminiApiUrl(model)}?key=${DIRECT_GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        let details = response.statusText;
        try {
          const err = await response.json();
          details = err.error?.message || details;
        } catch (_) {}
        lastError = { status: response.status, details, model };
        continue;
      }

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) {
        lastError = { status: 200, details: 'Direct Gemini returned no response content', model };
        continue;
      }

      return this.normalizeStructuredResponse(aiText, userMessage);
    }

    if (lastError?.status === 403) {
      throw new Error(`Direct Gemini access denied for models: ${modelCandidates.join(', ')}. Enable the Generative Language API in the same Google Cloud project, allow that API in the key restrictions, and rotate the key if it was exposed.`);
    }

    throw new Error(`Direct Gemini fallback failed: ${lastError?.details || 'No configured Gemini model succeeded'}`);
  }

  normalizeStructuredResponse(payload, userMessage = '') {
    const parsedPayload = this.parseStructuredPayload(payload);
    const safe = parsedPayload && typeof parsedPayload === 'object' ? parsedPayload : {};
    let textCandidate = typeof safe.text === 'string' ? safe.text : typeof safe.message === 'string' ? safe.message : '';
    const nestedPayload = this.parseStructuredPayload(textCandidate);
    if (nestedPayload && typeof nestedPayload === 'object' && nestedPayload !== safe) {
      textCandidate = typeof nestedPayload.text === 'string'
        ? nestedPayload.text
        : typeof nestedPayload.message === 'string'
          ? nestedPayload.message
          : textCandidate;
    }
    const normalizedTextCandidate = typeof textCandidate === 'string' ? textCandidate.trim() : '';
    const message = this.isMalformedStructuredText(normalizedTextCandidate)
      ? this.buildPromptFallbackMessage(userMessage)
      : normalizedTextCandidate.length > 0
        ? trimCoachText(normalizedTextCandidate)
        : DEFAULT_RESPONSE.message;
    const emotion = typeof safe.emotion === 'string' && safe.emotion.trim().length > 0
      ? safe.emotion
      : this.detectEmotion(message);
    const action = typeof safe.action === 'string' && safe.action.trim().length > 0
      ? safe.action
      : 'none';
    const ui = safe.ui && typeof safe.ui === 'object' ? safe.ui : DEFAULT_RESPONSE.ui;
    const animation = this.isMalformedStructuredText(normalizedTextCandidate)
      ? 'wave'
      : typeof ui.animation === 'string' && ui.animation.trim().length > 0
      ? ui.animation
      : this.suggestAnimation(message);

    return {
      message,
      emotion,
      animation,
      xp: Number.isFinite(Number(safe.xp)) ? Math.max(0, Math.min(20, Math.round(Number(safe.xp)))) : 0,
      action,
      bondDelta: Number.isFinite(Number(safe.bondDelta)) ? Math.max(-3, Math.min(5, Math.round(Number(safe.bondDelta)))) : 0,
      missionImpact: safe.missionImpact && typeof safe.missionImpact === 'object'
        ? {
            missionId: typeof safe.missionImpact.missionId === 'string' ? safe.missionImpact.missionId : null,
            progressDelta: Number.isFinite(Number(safe.missionImpact.progressDelta)) ? Math.max(0, Math.round(Number(safe.missionImpact.progressDelta))) : 0,
            completed: Boolean(safe.missionImpact.completed),
          }
        : DEFAULT_RESPONSE.missionImpact,
      ui: {
        animation,
        tts: ui.tts !== false,
      },
    };
  }

  parseStructuredPayload(payload) {
    if (payload && typeof payload === 'object') {
      const wrappedPayload = payload.data || payload.result || payload.response || payload.payload;
      if (wrappedPayload && wrappedPayload !== payload) {
        return this.parseStructuredPayload(wrappedPayload);
      }

      const candidateText = typeof payload.text === 'string'
        ? payload.text
        : typeof payload.message === 'string'
          ? payload.message
          : '';
      if (candidateText) {
        const parsedCandidate = this.parseStructuredPayload(candidateText);
        if (parsedCandidate && typeof parsedCandidate === 'object') {
          const parsedText = typeof parsedCandidate.text === 'string' ? parsedCandidate.text.trim() : '';
          const parsedMessage = typeof parsedCandidate.message === 'string' ? parsedCandidate.message.trim() : '';
          if (parsedText || parsedMessage) {
            return {
              ...payload,
              ...parsedCandidate,
            };
          }
        }
      }

      return payload;
    }

    if (typeof payload !== 'string') {
      return {};
    }

    const trimmed = payload.trim();
    if (!trimmed) {
      return {};
    }

    const withoutCodeFence = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const withoutWrappingQuotes = withoutCodeFence.startsWith('"') && withoutCodeFence.endsWith('"')
      ? withoutCodeFence.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      : withoutCodeFence;

    if (withoutWrappingQuotes !== withoutCodeFence) {
      return this.parseStructuredPayload(withoutWrappingQuotes);
    }

    try {
      return JSON.parse(withoutCodeFence);
    } catch (_) {
      try {
        return JSON.parse(withoutCodeFence.replace(/\\"/g, '"'));
      } catch (_) {}

      const objectStart = withoutCodeFence.indexOf('{');
      const objectEnd = withoutCodeFence.lastIndexOf('}');
      if (objectStart >= 0 && objectEnd > objectStart) {
        const objectSlice = withoutCodeFence.slice(objectStart, objectEnd + 1);
        try {
          return JSON.parse(objectSlice);
        } catch (_) {}

        try {
          return JSON.parse(objectSlice.replace(/\\"/g, '"'));
        } catch (_) {}
      }

      const pickStringField = (fieldName) => {
        const match = withoutCodeFence.match(new RegExp(`"${fieldName}"\\s*:\\s*"((?:\\\\.|[^\\"])*)"`, 'i'));
        if (!match?.[1]) return undefined;
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch (_) {
          return match[1].replace(/\\"/g, '"');
        }
      };

      const pickLooseTextField = (fieldName) => {
        const match = withoutCodeFence.match(new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)(?=",\\s*"(?:emotion|xp|action|bondDelta|missionImpact|ui)"|"\\s*}|$)`, 'i'));
        if (!match?.[1]) return undefined;
        return match[1]
          .replace(/\\n/g, ' ')
          .replace(/\\t/g, ' ')
          .replace(/\\"/g, '"')
          .trim();
      };

      const pickNumberField = (fieldName) => {
        const match = withoutCodeFence.match(new RegExp(`"${fieldName}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
        return match ? Number(match[1]) : undefined;
      };

      const extractedPayload = {
        text: pickStringField('text') || pickStringField('message') || pickLooseTextField('text') || pickLooseTextField('message'),
        emotion: pickStringField('emotion'),
        action: pickStringField('action'),
        xp: pickNumberField('xp'),
        bondDelta: pickNumberField('bondDelta'),
      };

      if (Object.values(extractedPayload).some((value) => value !== undefined && value !== null && value !== '')) {
        return extractedPayload;
      }

      return { text: withoutCodeFence };
    }
  }

  isMalformedStructuredText(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    if (/^\{?[\s\n\r\\"]*text\b[\s\n\r\\":]*$/i.test(text)) return true;
    if (/^\{[\s\S]{0,40}$/i.test(text) && /text|message/i.test(text)) return true;
    if ((text.startsWith('{') || text.startsWith('[') || text.startsWith('"{')) && !/[a-z]{3,}/i.test(text.replace(/"text"|"message"/gi, ''))) {
      return true;
    }
    return false;
  }

  buildPromptFallbackMessage(userMessage) {
    const prompt = String(userMessage || '').trim();
    const minuteMatch = prompt.match(/(\d{1,2})\s*(min|mins|minute|minutes)\b/i);
    const requestedMinutes = minuteMatch ? Math.max(3, Math.min(20, Number(minuteMatch[1]))) : null;

    if (/workout|plan|routine|exercise|session/i.test(prompt) && requestedMinutes) {
      const workBlockMinutes = Math.max(2, requestedMinutes - 1);
      return `Try a ${requestedMinutes}-minute session: 1 minute warm-up, then ${workBlockMinutes} minutes rotating squats, incline push-ups, and a plank with short rests. Keep the pace steady and stop if your form slips.`;
    }

    if (/workout|plan|routine|exercise|session/i.test(prompt)) {
      return 'Try a short circuit of squats, push-ups, and plank holds for 3 rounds with brief rests, and keep the form clean over speed.';
    }

    return DEFAULT_RESPONSE.message;
  }

  /**
   * Detect emotion from AI response to trigger appropriate animation
   */
  detectEmotion(message) {
    const emotionPatterns = {
      excited: /(!{2,}|amazing|awesome|incredible|fantastic|let's go|woohoo)/i,
      happy: /(happy|great|wonderful|love|perfect|smiling|laugh)/i,
      surprised: /(\?{2,}|wow|incredible|unbelievable|really|seriously)/i,
      sad: /(sorry|sad|difficult|tough|struggling)/i,
      thinking: /(think|consider|let me think|hmm|interesting|curious)/i,
      confused: /(\?|not sure|unclear|confused|don't understand)/i,
      angry: /(frustrated|upset|annoyed|disappointed)/i,
      encouraging: /(you can|believe in|keep going|don't give up)/i,
      celebrating: /(congratulations|celebrate|great job|amazing work)/i,
    };

    for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
      if (pattern.test(message)) {
        return emotion;
      }
    }

    return 'neutral';
  }

  /**
   * Suggest animation based on message content and emotion
   */
  suggestAnimation(message) {
    const emotion = this.detectEmotion(message);

    const emotionToAnimation = {
      excited: 'dance',
      happy: 'happy',
      surprised: 'surprised',
      sad: 'sad',
      thinking: 'thinking',
      confused: 'confused',
      angry: 'angry',
      encouraging: 'wave',
      celebrating: 'laugh',
      neutral: 'talk',
    };

    return emotionToAnimation[emotion] || 'talk';
  }

  /**
   * Generate personalized workout recommendation
   */
  async getWorkoutAdvice(workoutType = 'general') {
    const prompt = `${workoutType === 'general' ? 'Give me a short motivational message to get me started' : `Give me specific advice for ${workoutType}`}`;
    return this.chat(prompt);
  }

  /**
   * Analyze health metrics and provide feedback
   */
  async analyzeMetrics(metrics = {}) {
    const { steps, pushups, plankSeconds, waterIntake, sleepHours } = metrics;
    const prompt = `I did ${steps || 0} steps, ${pushups || 0} pushups, ${plankSeconds || 0}s plank, drank ${waterIntake || 0}L water, and slept ${sleepHours || 0} hours. How am I doing?`;
    return this.chat(prompt);
  }

  /**
   * Get encouragement based on user state
   */
  async getEncouragement(userState = 'tired') {
    const messages = {
      tired: "I'm feeling tired and unmotivated",
      sore: 'My muscles are sore from yesterday',
      busy: "I don't have much time today",
      injured: 'I have a minor injury',
      plateaued: "I'm not seeing progress",
      discouraged: "I'm feeling discouraged",
    };

    const prompt = messages[userState] || messages.discouraged;
    return this.chat(prompt);
  }

  /**
   * Clear conversation history for new session
   */
  resetConversation() {
    this.conversationHistory = [];
  }

  /**
   * Update user profile for personalized responses
   */
  setUserProfile(profile) {
    this.userProfile = { ...this.userProfile, ...profile };
  }

  /**
   * Change avatar personality
   */
  setPersonality(personality) {
    if (['friendly_coach', 'wise_mentor', 'fun_buddy', 'motivator'].includes(personality)) {
      this.avatarPersonality = personality;
    }
  }
}

export default GeminiAvatarService;
