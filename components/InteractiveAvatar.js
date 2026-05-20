import { Asset } from 'expo-asset';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { LipSync } from '../CharacterStudio/src/library/lipsync';
import { useAvatarGestures } from '../hooks/useAvatarGestures';
import { AVATAR_ANIMATIONS, getAvatarAnimationDuration, resolveAvatarAnimationConfig } from '../utils/avatarAnimationConfig';
import { buildWorkoutDemoSequence, inferWorkoutAnimationFromText } from '../utils/avatarWorkoutHelpers';
import Avatar from './avatar';

/**
 * InteractiveAvatar - Fully interactive avatar with tap, gestures, voice, and animations
 * Features:
 * - Tap/click to trigger animations and sounds
 * - Gesture recognition (swipe, pinch, long press)
 * - Voice/microphone detection
 * - Text-to-speech responses
 * - Animated expressions (happy, surprised, sad, etc.)
 * - Proximity detection (mobile)
 */

const ANIMATIONS = AVATAR_ANIMATIONS;

const CONVERSATION_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

const TTS_ENDPOINT = process.env.EXPO_PUBLIC_TTS_ENDPOINT || '';
const TTS_API_KEY = process.env.EXPO_PUBLIC_TTS_API_KEY || '';
const TTS_PROVIDER = String(process.env.EXPO_PUBLIC_TTS_PROVIDER || '').toLowerCase();
const TTS_MODEL = process.env.EXPO_PUBLIC_TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.EXPO_PUBLIC_TTS_VOICE || 'coral';
const TTS_VOICE_FEMALE = process.env.EXPO_PUBLIC_TTS_VOICE_FEMALE || '';
const TTS_VOICE_MALE = process.env.EXPO_PUBLIC_TTS_VOICE_MALE || '';
const TTS_DEFAULT_VOICE_TYPE = String(process.env.EXPO_PUBLIC_TTS_DEFAULT_VOICE_TYPE || '').toLowerCase();
const TTS_RATE = Number(process.env.EXPO_PUBLIC_TTS_RATE || 0.96);
const TTS_PITCH = Number(process.env.EXPO_PUBLIC_TTS_PITCH || 1.03);
const TTS_INSTRUCTIONS = process.env.EXPO_PUBLIC_TTS_INSTRUCTIONS || 'Speak naturally and conversationally with warm tone, subtle pauses, and varied intonation. Avoid robotic cadence.';
const BROWSER_TTS_LANG = process.env.EXPO_PUBLIC_TTS_LANG || 'en-US';
const TTS_GOOGLE_VOICE_FEMALE = process.env.EXPO_PUBLIC_GOOGLE_TTS_VOICE_FEMALE || 'en-US-Neural2-F';
const TTS_GOOGLE_VOICE_MALE = process.env.EXPO_PUBLIC_GOOGLE_TTS_VOICE_MALE || 'en-US-Neural2-J';
const TTS_GOOGLE_LANGUAGE_CODE = process.env.EXPO_PUBLIC_GOOGLE_TTS_LANGUAGE_CODE || 'en-US';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isGoogleProxyEndpoint = (endpoint) => /\/google-tts(?:$|[/?#])/i.test(String(endpoint || ''));
const normalizeVoiceType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  return 'neutral';
};
const isAutoVoiceType = (value) => {
  const v = String(value || '').toLowerCase();
  return v === '' || v === 'auto' || v === 'default';
};

const maleVoiceNameHints = /(guy|davis|daniel|matthew|george|james|liam|adam|male|man|bro)/i;
const femaleVoiceNameHints = /(aria|jenny|samantha|victoria|karen|ava|bella|nova|female|woman|girl)/i;

const normalizeSpeechText = (text) => {
  const input = String(text || '');
  if (!input.trim()) return '';
  return input
    .replace(/\s+/g, ' ')
    .replace(/([a-zA-Z0-9])([;:])\s*/g, '$1, ')
    .replace(/\s*([,.!?])\s*/g, '$1 ')
    .trim();
};

const scoreVoice = (voice, preferredVoiceType = 'neutral') => {
  const name = String(voice?.name || '').toLowerCase();
  const lang = String(voice?.lang || '').toLowerCase();
  let score = 0;

  if (lang.startsWith('en-us')) score += 28;
  else if (lang.startsWith('en')) score += 20;
  if (voice?.localService) score += 7;

  // Prefer more natural-sounding families across common platforms.
  if (/(siri|natural|premium|enhanced|neural|studio)/.test(name)) score += 22;
  if (/(aria|jenny|guy|davis|microsoft)/.test(name)) score += 16;
  if (/(google us|english united states)/.test(name)) score += 12;
  if (/(sam|alex|victoria|samantha|karen|daniel)/.test(name)) score += 10;
  if (/(compact|espeak|festival)/.test(name)) score -= 20;
  if (preferredVoiceType === 'male' && maleVoiceNameHints.test(name)) score += 10;
  if (preferredVoiceType === 'female' && femaleVoiceNameHints.test(name)) score += 10;

  return score;
};

const pickBrowserVoice = (voices, preferredLang = 'en-US', preferredVoiceType = 'neutral') => {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const lang = String(preferredLang || 'en-US').toLowerCase();
  const langPrefix = lang.split('-')[0];

  const inLang = voices.filter((v) => {
    const voiceLang = String(v?.lang || '').toLowerCase();
    return voiceLang.startsWith(lang) || voiceLang.startsWith(langPrefix);
  });

  const pool = inLang.length > 0 ? inLang : voices;
  const matchedByType = preferredVoiceType === 'male' ?
    pool.filter((v) => maleVoiceNameHints.test(String(v?.name || ''))) :
    preferredVoiceType === 'female' ?
      pool.filter((v) => femaleVoiceNameHints.test(String(v?.name || ''))) :
      [];
  const candidatePool = matchedByType.length > 0 ? matchedByType : pool;

  return candidatePool
    .slice()
    .sort((a, b) => scoreVoice(b, preferredVoiceType) - scoreVoice(a, preferredVoiceType))[0] || null;
};

const InteractiveAvatar = forwardRef(({
  height = '175',
  weight = '70',
  gender = 'male',
  photoUri,
  model,
  sizeMultiplier = 1.15,
  xOffset = 0,
  yOffset = 0,
  zOffset = 0,
  alignFootToBottom = false,
  bottomPadding = 0.05,
  autoFit = true,
  headMargin = 0.08,
  bottomInsetPx = 0,
  focus = 'chest',
  fitMode = 'shrink',
  targetFill = 0.94,
  footLift = 0,
  preserveTPose = false,
  playAnimation = true,
  restingAnimation = ANIMATIONS.IDLE,
  enableVoice = true,
  enableTTS = true,
  enableReactionGestures = true,
  enableProximity = false,
  onInteraction = null,
}, ref) => {
  const [currentAnimation, setCurrentAnimation] = useState(restingAnimation);
  const [animationReplayNonce, setAnimationReplayNonce] = useState(0);
  const [animationRepeatCount, setAnimationRepeatCount] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const micListenerRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationQueueRef = useRef([]);
  const lipSyncRef = useRef(null);
  const vrmInstanceRef = useRef(null);
  const avatarRef = useRef(null);
  const managersRef = useRef({
    lookAtManager: null,
    blinkManager: null,
    emotionManager: null,
    cameraFrameManager: null,
  });
  const lipRafRef = useRef(null);
  const lipPulseTimersRef = useRef([]);
  const lipCurrentRef = useRef({ aa: 0, ee: 0, oh: 0 });
  const lipTargetRef = useRef({ aa: 0, ee: 0, oh: 0 });
  const ttsEndTimerRef = useRef(null);
  const returnToRestTimerRef = useRef(null);
  const preserveAnimationRef = useRef(false);
  const currentAnimationRef = useRef(restingAnimation || ANIMATIONS.IDLE);
  const restingAnimationRef = useRef(restingAnimation || ANIMATIONS.IDLE);
  const animationReplayNonceRef = useRef(0);
  const animationRepeatCountRef = useRef(1);
  const pendingAnimationCompletionRef = useRef(null);
  const animationRunIdRef = useRef(0);
  const sequenceRunIdRef = useRef(0);
  const getAutoVoiceType = useCallback((genderValue) => {
    const fromGender = normalizeVoiceType(genderValue);
    if (fromGender !== 'neutral') return fromGender;
    return normalizeVoiceType(TTS_DEFAULT_VOICE_TYPE);
  }, []);

  const voiceTypeModeRef = useRef('auto');
  const activeVoiceTypeRef = useRef(getAutoVoiceType(gender));

  useEffect(() => {
    if (voiceTypeModeRef.current === 'auto') {
      activeVoiceTypeRef.current = getAutoVoiceType(gender);
    }
  }, [gender, getAutoVoiceType]);

  const clearReturnToRestTimer = useCallback(() => {
    if (returnToRestTimerRef.current) {
      clearTimeout(returnToRestTimerRef.current);
      returnToRestTimerRef.current = null;
    }
  }, []);

  const clearPendingAnimationCompletion = useCallback((shouldResolve = false) => {
    const pending = pendingAnimationCompletionRef.current;
    if (!pending) return;
    if (pending.timerId) {
      clearTimeout(pending.timerId);
    }
    pendingAnimationCompletionRef.current = null;
    if (shouldResolve && typeof pending.resolve === 'function') {
      pending.resolve({ completed: false, timedOut: false, cancelled: true });
    }
  }, []);

  const setAnimationState = useCallback((animationType, options = {}) => {
    const nextAnimation = animationType || ANIMATIONS.IDLE;
    const nextRepeatCount = Math.max(1, Number(options.repeatCount) || 1);
    const nextReplayNonce = animationReplayNonceRef.current + 1;
    animationReplayNonceRef.current = nextReplayNonce;
    animationRepeatCountRef.current = nextRepeatCount;
    currentAnimationRef.current = nextAnimation;
    setCurrentAnimation(nextAnimation);
    setAnimationReplayNonce(nextReplayNonce);
    setAnimationRepeatCount(nextRepeatCount);
    return { animationType: nextAnimation, replayNonce: nextReplayNonce, repeatCount: nextRepeatCount };
  }, []);

  const waitForAnimationStep = useCallback(({ animationType, replayNonce, repeatCount = 1, duration }) => {
    const resolvedDuration = typeof duration === 'number'
      ? duration
      : getAvatarAnimationDuration(animationType, gender, 900);
    const animationConfig = resolveAvatarAnimationConfig(animationType, gender);
    const resolvedRepeatCount = Math.max(1, Number(repeatCount) || 1);
    const totalDuration = animationConfig.loop
      ? resolvedDuration
      : Math.max(resolvedDuration * resolvedRepeatCount, resolvedDuration);

    clearPendingAnimationCompletion();

    return new Promise((resolve) => {
      const timerId = setTimeout(() => {
        if (pendingAnimationCompletionRef.current?.timerId === timerId) {
          pendingAnimationCompletionRef.current = null;
        }
        resolve({ completed: animationConfig.loop, timedOut: !animationConfig.loop, cancelled: false });
      }, animationConfig.loop ? totalDuration : Math.max(totalDuration + 350, 900));

      pendingAnimationCompletionRef.current = {
        animationType,
        replayNonce,
        repeatCount: resolvedRepeatCount,
        resolve,
        timerId,
        loop: animationConfig.loop,
      };
    });
  }, [clearPendingAnimationCompletion, gender]);

  const handleAnimationComplete = useCallback((payload = {}) => {
    const pending = pendingAnimationCompletionRef.current;
    if (!pending || pending.loop) return;
    if (payload.animationType !== pending.animationType) return;
    if (payload.replayNonce !== pending.replayNonce) return;
    if (pending.timerId) {
      clearTimeout(pending.timerId);
    }
    pendingAnimationCompletionRef.current = null;
    pending.resolve?.({ completed: true, timedOut: false, cancelled: false });
  }, []);

  const preloadAnimationSequence = useCallback(async (steps = []) => {
    const assetModules = [];
    const seenKeys = new Set();

    steps.forEach((step) => {
      const animationType = step?.animationType || step?.animation || step?.type;
      if (!animationType) return;
      const animationConfig = resolveAvatarAnimationConfig(animationType, gender);
      if (!animationConfig.asset) return;
      const cacheKey = animationConfig.id || animationType;
      if (seenKeys.has(cacheKey)) return;
      seenKeys.add(cacheKey);
      assetModules.push(animationConfig.asset);
    });

    if (assetModules.length === 0) return;

    try {
      await Promise.all(assetModules.map(async (assetModule) => {
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
      }));
    } catch (error) {
      console.warn('[InteractiveAvatar] Failed to preload animation sequence assets:', error);
    }
  }, [gender]);

  const interruptRestingAnimationFlow = useCallback(() => {
    clearReturnToRestTimer();
  }, [clearReturnToRestTimer]);

  const returnToRestingAnimation = useCallback((options = {}) => {
    interruptRestingAnimationFlow();
    const nextRestingAnimation = options.animationType || restingAnimationRef.current || ANIMATIONS.IDLE;
    setAnimationState(nextRestingAnimation);
  }, [interruptRestingAnimationFlow, setAnimationState]);

  const scheduleReturnToRestingAnimation = useCallback((delayMs = 0) => {
    interruptRestingAnimationFlow();
    if (delayMs <= 0) {
      returnToRestingAnimation();
      return;
    }
    returnToRestTimerRef.current = setTimeout(() => {
      returnToRestTimerRef.current = null;
      returnToRestingAnimation();
    }, delayMs);
  }, [interruptRestingAnimationFlow, returnToRestingAnimation]);

  useEffect(() => {
    restingAnimationRef.current = restingAnimation || ANIMATIONS.IDLE;
    if (!isAnimating && !micActive) {
      returnToRestingAnimation();
    }
  }, [isAnimating, micActive, restingAnimation, returnToRestingAnimation]);

  const resolveVoiceId = useCallback((voiceTypeInput) => {
    const voiceType = normalizeVoiceType(voiceTypeInput || activeVoiceTypeRef.current || TTS_DEFAULT_VOICE_TYPE || gender);
    if (voiceType === 'male') return String(TTS_VOICE_MALE || TTS_VOICE || '').trim();
    if (voiceType === 'female') return String(TTS_VOICE_FEMALE || TTS_VOICE || '').trim();
    return String(TTS_VOICE || TTS_VOICE_FEMALE || TTS_VOICE_MALE || '').trim();
  }, [gender]);

  const resolveGoogleVoiceName = useCallback((voiceTypeInput) => {
    const voiceType = normalizeVoiceType(voiceTypeInput || activeVoiceTypeRef.current || TTS_DEFAULT_VOICE_TYPE || gender);
    if (voiceType === 'male') return String(TTS_GOOGLE_VOICE_MALE || '').trim();
    if (voiceType === 'female') return String(TTS_GOOGLE_VOICE_FEMALE || '').trim();
    return String(TTS_GOOGLE_VOICE_FEMALE || TTS_GOOGLE_VOICE_MALE || '').trim();
  }, [gender]);

  const setVoiceType = useCallback((voiceTypeInput) => {
    if (isAutoVoiceType(voiceTypeInput)) {
      voiceTypeModeRef.current = 'auto';
      const auto = getAutoVoiceType(gender);
      activeVoiceTypeRef.current = auto;
      return auto;
    }

    voiceTypeModeRef.current = 'manual';
    const next = normalizeVoiceType(voiceTypeInput);
    activeVoiceTypeRef.current = next;
    return next;
  }, [gender, getAutoVoiceType]);

  const getVoiceType = useCallback(() => activeVoiceTypeRef.current, []);

  // Initialize LipSync with VRM instance when avatar loads
  const initializeLipSync = useCallback((vrmInstance) => {
    if (!vrmInstance) return;
    try {
      vrmInstanceRef.current = vrmInstance;
      lipSyncRef.current = new LipSync(vrmInstance);
      console.log('[InteractiveAvatar] LipSync initialized with VRM');
    } catch (error) {
      console.warn('[InteractiveAvatar] LipSync initialization failed:', error);
    }
  }, []);

  // Initialize audio playback
  useEffect(() => {
    // Audio setup handled by audioManager and device settings
  }, [enableVoice]);

  // Play sound effect
  const playSound = useCallback((soundName) => {
    if (!soundOn || !soundName) return;
    // Sound playback handled by audioManager
    console.log('[InteractiveAvatar] Playing sound:', soundName);
  }, [soundOn]);

  const onManagersReady = useCallback((managers) => {
    if (!managers) return;
    managersRef.current = {
      lookAtManager: managers.lookAtManager || null,
      blinkManager: managers.blinkManager || null,
      emotionManager: managers.emotionManager || null,
      cameraFrameManager: managers.cameraFrameManager || null,
    };
  }, []);

  const setEmotion = useCallback((emotion, intensity = 0.55, duration = 0.22, continuous = false) => {
    const emotionManager = managersRef.current?.emotionManager;
    if (!emotionManager) return;
    try {
      if (emotionManager.hasEmotion?.(emotion)) {
        emotionManager.playEmotion(emotion, duration, continuous, intensity);
      }
    } catch (_) {}
  }, []);

  const setCameraShot = useCallback((shot) => {
    const cameraFrameManager = managersRef.current?.cameraFrameManager;
    if (!cameraFrameManager) return;
    try {
      if (shot === 'closeup') cameraFrameManager.frameCloseupShot();
      else if (shot === 'cowboy') cameraFrameManager.frameCowboyShot();
      else if (shot === 'full') cameraFrameManager.frameFullShot();
      else cameraFrameManager.frameMediumShot();
    } catch (_) {}
  }, []);

  const setConversationState = useCallback((state = CONVERSATION_STATES.IDLE) => {
    const normalized = String(state || CONVERSATION_STATES.IDLE).toLowerCase();

    if (normalized === CONVERSATION_STATES.LISTENING) {
      interruptRestingAnimationFlow();
      setMicActive(true);
      setIsAnimating(true);
      setAnimationState(ANIMATIONS.TALK);
      setEmotion('fun', 0.4, 0.16, true);
      setCameraShot('closeup');
      return;
    }

    if (normalized === CONVERSATION_STATES.THINKING) {
      interruptRestingAnimationFlow();
      setMicActive(false);
      setIsAnimating(true);
      setAnimationState(ANIMATIONS.THINKING);
      setEmotion('lookUp', 0.34, 0.22, true);
      setCameraShot('medium');
      return;
    }

    if (normalized === CONVERSATION_STATES.SPEAKING) {
      interruptRestingAnimationFlow();
      setMicActive(false);
      setIsAnimating(true);
      setAnimationState(ANIMATIONS.TALK);
      setEmotion('joy', 0.5, 0.16, true);
      setCameraShot('closeup');
      return;
    }

    setMicActive(false);
    setIsAnimating(false);
    returnToRestingAnimation();
    setEmotion('fun', 0.2, 0.12, false);
    setCameraShot('medium');
  }, [interruptRestingAnimationFlow, returnToRestingAnimation, setAnimationState, setCameraShot, setEmotion]);

  const startMicLipSync = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    if (!lipSyncRef.current) return;
    if (micStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      lipSyncRef.current.start(stream);
      setConversationState(CONVERSATION_STATES.LISTENING);
    } catch (error) {
      console.warn('[InteractiveAvatar] Unable to start microphone lip sync:', error);
    }
  }, [setConversationState]);

  const stopMicLipSync = useCallback(async () => {
    const stream = micStreamRef.current;
    micStreamRef.current = null;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setMicActive(false);
    try {
      await lipSyncRef.current?.destroy?.();
    } catch (_) {}
    if (vrmInstanceRef.current) {
      try {
        lipSyncRef.current = new LipSync(vrmInstanceRef.current);
      } catch (_) {}
    }
    setConversationState(CONVERSATION_STATES.IDLE);
  }, [setConversationState]);

  const clearLipPulseTimers = useCallback(() => {
    lipPulseTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    lipPulseTimersRef.current = [];
  }, []);

  const setMouthImmediate = useCallback((aa, ee, oh) => {
    const mgr = vrmInstanceRef.current?.expressionManager;
    if (!mgr) return;
    try {
      mgr.setValue('aa', Math.max(0, Math.min(1, aa)));
      mgr.setValue('ee', Math.max(0, Math.min(1, ee)));
      mgr.setValue('oh', Math.max(0, Math.min(1, oh)));
      mgr.update(0);
    } catch (_) {}
  }, []);

  const stopLipLoop = useCallback((reset = true) => {
    if (lipRafRef.current) {
      cancelAnimationFrame(lipRafRef.current);
      lipRafRef.current = null;
    }
    clearLipPulseTimers();
    lipTargetRef.current = { aa: 0, ee: 0, oh: 0 };
    lipCurrentRef.current = { aa: 0, ee: 0, oh: 0 };
    if (ttsEndTimerRef.current) {
      clearTimeout(ttsEndTimerRef.current);
      ttsEndTimerRef.current = null;
    }
    if (reset) setMouthImmediate(0, 0, 0);
  }, [clearLipPulseTimers, setMouthImmediate]);

  const buildTtsRequest = useCallback((text, options = {}) => {
    const normalizedText = normalizeSpeechText(text);
    if (!normalizedText) return null;
    const selectedVoiceType = normalizeVoiceType(options.voiceType || activeVoiceTypeRef.current || TTS_DEFAULT_VOICE_TYPE || gender);
    const selectedVoiceId = resolveVoiceId(selectedVoiceType);
    const selectedGoogleVoiceName = resolveGoogleVoiceName(selectedVoiceType);

    const resolvedProvider = TTS_PROVIDER ||
      (isGoogleProxyEndpoint(TTS_ENDPOINT) ? 'google-proxy' : 'openai');

    if (resolvedProvider === 'google-proxy') {
      if (!TTS_ENDPOINT) return null;
      const headers = {
        'Content-Type': 'application/json',
      };

      const body = {
        text: normalizedText,
        voiceName: selectedGoogleVoiceName,
        languageCode: TTS_GOOGLE_LANGUAGE_CODE,
        speakingRate: clamp(TTS_RATE, 0.25, 2),
        pitch: clamp((TTS_PITCH - 1) * 6, -20, 20),
        audioEncoding: 'MP3',
      };

      return { endpoint: TTS_ENDPOINT, headers, body };
    }

    if (!TTS_API_KEY) return null;
    if (!TTS_ENDPOINT) return null;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TTS_API_KEY}`,
    };

    // OpenAI-compatible speech endpoint payload
    const body = {
      model: TTS_MODEL,
      voice: selectedVoiceId,
      input: normalizedText,
      format: 'mp3',
      speed: clamp(TTS_RATE, 0.8, 1.2),
    };

    if (TTS_INSTRUCTIONS) {
      body.instructions = TTS_INSTRUCTIONS;
    }

    return { endpoint: TTS_ENDPOINT, headers, body };
  }, [gender, resolveGoogleVoiceName, resolveVoiceId]);

  const synthesizeSpeechAudio = useCallback(async (text, options = {}) => {
    const req = buildTtsRequest(text, options);
    if (!req) return null;
    try {
      const response = await fetch(req.endpoint, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS endpoint error ${response.status}: ${errText.slice(0, 180)}`);
      }
      const audioBuffer = await response.arrayBuffer();
      if (!audioBuffer || audioBuffer.byteLength < 256) return null;
      return audioBuffer;
    } catch (error) {
      console.warn('[InteractiveAvatar] Remote TTS synth failed, falling back to browser TTS:', error?.message || error);
      return null;
    }
  }, [buildTtsRequest]);

  const playAudioBufferWithLipSync = useCallback(async (audioBuffer, options = {}) => {
    const onSpeechEnd = typeof options.onEnd === 'function' ? options.onEnd : null;
    const preserveAnimation = Boolean(options.preserveAnimation);
    if (!audioBuffer || !lipSyncRef.current) return false;
    let durationMs = 1800;
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));
        durationMs = Math.max(600, Math.round((decoded.duration || 1.8) * 1000));
        try { await ctx.close(); } catch (_) {}
      }
    } catch (_) {}

    try {
      lipSyncRef.current.startFromAudioFile(audioBuffer.slice(0));
      if (ttsEndTimerRef.current) clearTimeout(ttsEndTimerRef.current);
      ttsEndTimerRef.current = setTimeout(() => {
        if (!preserveAnimation) {
          setConversationState(CONVERSATION_STATES.IDLE);
        }
        onSpeechEnd?.();
        setMouthImmediate(0, 0, 0);
      }, durationMs + 120);
      return true;
    } catch (error) {
      console.warn('[InteractiveAvatar] LipSync audio playback failed:', error);
      return false;
    }
  }, [setConversationState, setMouthImmediate]);

  const startLipLoop = useCallback(() => {
    if (lipRafRef.current) return;

    const tick = () => {
      const mgr = vrmInstanceRef.current?.expressionManager;
      if (!mgr) {
        lipRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const cur = lipCurrentRef.current;
      const target = lipTargetRef.current;
      const attack = 0.36;
      const release = 0.22;

      const easeAxis = (value, next) => {
        const factor = next > value ? attack : release;
        return value + (next - value) * factor;
      };

      cur.aa = easeAxis(cur.aa, target.aa);
      cur.ee = easeAxis(cur.ee, target.ee);
      cur.oh = easeAxis(cur.oh, target.oh);

      try {
        mgr.setValue('aa', Math.max(0, Math.min(1, cur.aa)));
        mgr.setValue('ee', Math.max(0, Math.min(1, cur.ee)));
        mgr.setValue('oh', Math.max(0, Math.min(1, cur.oh)));
      } catch (_) {}

      // Android: VRM lives in WebView, drive viseme via imperative ref
      try {
        avatarRef.current?.setViseme?.(cur.aa, cur.ee, cur.oh, true);
      } catch (_) {}

      lipRafRef.current = requestAnimationFrame(tick);
    };

    lipRafRef.current = requestAnimationFrame(tick);
  }, []);

  const getVisemeForToken = useCallback((token) => {
    const textToken = String(token || '').toLowerCase();
    if (!textToken.trim()) return { aa: 0, ee: 0, oh: 0 };

    const aaCount = (textToken.match(/[a]/g) || []).length;
    const eeCount = (textToken.match(/[eiy]/g) || []).length;
    const ohCount = (textToken.match(/[ouw]/g) || []).length;
    const hardStop = /[bmp]/.test(textToken);
    const len = Math.max(1, textToken.replace(/[^a-z]/g, '').length);
    const energy = Math.max(0.25, Math.min(0.95, 0.3 + len * 0.04));

    let aa = (aaCount / len) * energy;
    let ee = (eeCount / len) * energy;
    let oh = (ohCount / len) * energy;

    // Small baseline open to avoid "dead mouth" during consonants.
    if (aa + ee + oh < 0.18) {
      aa = 0.14;
      ee = 0.05;
      oh = 0.06;
    }

    // Bilabials close the mouth briefly before opening into the next sound.
    if (hardStop) {
      aa *= 0.55;
      ee *= 0.55;
      oh *= 0.55;
    }

    return { aa, ee, oh };
  }, []);

  const pulseViseme = useCallback((token, durationMs = 140) => {
    const base = getVisemeForToken(token);
    lipTargetRef.current = {
      aa: Math.max(0, Math.min(1, base.aa + (Math.random() * 0.08 - 0.04))),
      ee: Math.max(0, Math.min(1, base.ee + (Math.random() * 0.06 - 0.03))),
      oh: Math.max(0, Math.min(1, base.oh + (Math.random() * 0.06 - 0.03))),
    };

    const timerId = setTimeout(() => {
      lipTargetRef.current = { aa: 0.06, ee: 0.02, oh: 0.03 };
    }, durationMs);
    lipPulseTimersRef.current.push(timerId);
  }, [getVisemeForToken]);

  const runConversationalGesture = useCallback((text = '', options = {}) => {
    if (options?.preserveAnimation || preserveAnimationRef.current) return;
    const t = String(text).toLowerCase();
    if (t.includes('?')) {
      setEmotion('lookUp', 0.35, 0.16, false);
      setAnimationState(ANIMATIONS.SURPRISED);
      scheduleReturnToRestingAnimation(420);
      return;
    }
    if (t.includes('great') || t.includes('awesome') || t.includes('nice') || t.includes('!')) {
      setEmotion('joy', 0.62, 0.18, false);
      setAnimationState(ANIMATIONS.HAPPY);
      scheduleReturnToRestingAnimation(460);
      return;
    }
    if (t.includes('sorry') || t.includes('sad') || t.includes('difficult')) {
      setEmotion('sorrow', 0.45, 0.2, false);
      setAnimationState(ANIMATIONS.SAD);
      scheduleReturnToRestingAnimation(460);
      return;
    }
    setEmotion('fun', 0.35, 0.16, false);
    setAnimationState(ANIMATIONS.TALK);
    scheduleReturnToRestingAnimation(420);
  }, [scheduleReturnToRestingAnimation, setAnimationState, setEmotion]);

  // Speak via text-to-speech with lip sync
  const speak = useCallback(async (text, options = {}) => {
    if (!enableTTS) return;
    try {
      const speechText = normalizeSpeechText(text);
      if (!speechText) return;
      const preserveAnimation = Boolean(options.preserveAnimation);
      const selectedVoiceType = normalizeVoiceType(options.voiceType || activeVoiceTypeRef.current || TTS_DEFAULT_VOICE_TYPE || gender);
      const onSpeechStart = typeof options.onStart === 'function' ? options.onStart : null;
      const onSpeechEnd = typeof options.onEnd === 'function' ? options.onEnd : null;
      preserveAnimationRef.current = preserveAnimation;

      // Preferred path: remote TTS audio buffer + audio-reactive lipsync.
      const audioBuffer = await synthesizeSpeechAudio(speechText, { voiceType: selectedVoiceType });

      // Native: play the fetched MP3 via expo-av with token-based lip pulse.
      if (audioBuffer && Platform.OS !== 'web') {
        try {
          const bytes = new Uint8Array(audioBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const FileSystem = require('expo-file-system');
          const tempUri = FileSystem.cacheDirectory + 'tts_response.mp3';
          await FileSystem.writeAsStringAsync(tempUri, base64, { encoding: FileSystem.EncodingType.Base64 });

          if (!preserveAnimation) {
            setCameraShot('closeup');
            setEmotion('joy', 0.35, 0.16, false);
            setConversationState(CONVERSATION_STATES.SPEAKING);
          }
          runConversationalGesture(speechText, { preserveAnimation });
          onSpeechStart?.();
          startLipLoop();
          lipTargetRef.current = { aa: 0.1, ee: 0.04, oh: 0.05 };
          const tokens = speechText.split(/\s+/).filter(Boolean);
          tokens.forEach((token, index) => {
            const tid = setTimeout(() => pulseViseme(token, 100 + Math.round(Math.random() * 70)), index * 130);
            lipPulseTimersRef.current.push(tid);
          });

          const { Audio } = require('expo-av');
          const { sound } = await Audio.Sound.createAsync({ uri: tempUri });
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              clearLipPulseTimers();
              lipTargetRef.current = { aa: 0, ee: 0, oh: 0 };
              const tid = setTimeout(() => stopLipLoop(true), 140);
              lipPulseTimersRef.current.push(tid);
              preserveAnimationRef.current = false;
              if (!preserveAnimation) setConversationState(CONVERSATION_STATES.IDLE);
              onSpeechEnd?.();
            }
          });
          await sound.playAsync();
          return;
        } catch (nativeAudioError) {
          console.warn('[InteractiveAvatar] Native audio playback failed, falling back to expo-speech:', nativeAudioError);
        }
      }

      if (audioBuffer && lipSyncRef.current) {
        stopLipLoop(true);
        if (!preserveAnimation) {
          setConversationState(CONVERSATION_STATES.SPEAKING);
        }
        onSpeechStart?.();
        if (!preserveAnimation) {
          setCameraShot('closeup');
          setEmotion('joy', 0.35, 0.16, false);
        }
        runConversationalGesture(speechText, { preserveAnimation });
        const played = await playAudioBufferWithLipSync(audioBuffer, {
          preserveAnimation,
          onEnd: () => {
            preserveAnimationRef.current = false;
            onSpeechEnd?.();
          },
        });
        if (played) return;
      }

      // For web, use native Web Speech API
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        stopLipLoop(true);
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = clamp(TTS_RATE, 0.84, 1.08);
        utterance.pitch = clamp(TTS_PITCH, 0.92, 1.16);
        utterance.lang = BROWSER_TTS_LANG;

        const availableVoices = window.speechSynthesis.getVoices();
        const bestVoice = pickBrowserVoice(availableVoices, BROWSER_TTS_LANG, selectedVoiceType);
        if (bestVoice) utterance.voice = bestVoice;

        let boundarySeen = false;

        utterance.onstart = () => {
          if (lipSyncRef.current) {
            console.log('[InteractiveAvatar] Speech started, smooth lip loop enabled');
          }
          if (!preserveAnimation) {
            setCameraShot('closeup');
            setEmotion('joy', 0.35, 0.16, false);
            setConversationState(CONVERSATION_STATES.SPEAKING);
          }
          runConversationalGesture(speechText, { preserveAnimation });
          onSpeechStart?.();
          startLipLoop();
          lipTargetRef.current = { aa: 0.1, ee: 0.04, oh: 0.05 };
        };

        utterance.onboundary = (event) => {
          boundarySeen = true;
          if (typeof event.charIndex !== 'number') return;
          const start = Math.max(0, event.charIndex - 8);
          const end = Math.min(speechText.length, event.charIndex + 8);
          const chunk = speechText.slice(start, end);
          const match = chunk.match(/[A-Za-z']+/);
          const token = match ? match[0] : chunk;
          pulseViseme(token, 90 + Math.round(Math.random() * 80));
        };

        // Fallback pulse schedule for browsers with weak/absent boundary events.
        const fallbackTokens = speechText.split(/\s+/).filter(Boolean);
        fallbackTokens.forEach((token, index) => {
          const timerId = setTimeout(() => {
            if (!boundarySeen) {
              pulseViseme(token, 100 + Math.round(Math.random() * 70));
            }
          }, index * 125);
          lipPulseTimersRef.current.push(timerId);
        });

        // Reset mouth to neutral when speech ends
        const handleSpeechDone = () => {
          clearLipPulseTimers();
          lipTargetRef.current = { aa: 0, ee: 0, oh: 0 };
          const timerId = setTimeout(() => stopLipLoop(true), 140);
          lipPulseTimersRef.current.push(timerId);
          preserveAnimationRef.current = false;
          if (!preserveAnimation) {
            setConversationState(CONVERSATION_STATES.IDLE);
          }
          onSpeechEnd?.();
          console.log('[InteractiveAvatar] Speech ended, mouth reset to neutral');
        };

        utterance.onend = handleSpeechDone;
        utterance.onerror = handleSpeechDone;

        window.speechSynthesis.speak(utterance);
        return;
      }

      preserveAnimationRef.current = false;
      if (!preserveAnimation) {
        setConversationState(CONVERSATION_STATES.IDLE);
      }
      onSpeechEnd?.();

      // Native (Android / iOS) — expo-speech with token-based lip pulse
      if (Platform.OS !== 'web') {
        const Speech = require('expo-speech');
        try {
          Speech.stop();
        } catch (_) {}
        if (!preserveAnimation) {
          setCameraShot('closeup');
          setEmotion('joy', 0.35, 0.16, false);
          setConversationState(CONVERSATION_STATES.SPEAKING);
        }
        runConversationalGesture(speechText, { preserveAnimation });
        onSpeechStart?.();
        startLipLoop();
        lipTargetRef.current = { aa: 0.1, ee: 0.04, oh: 0.05 };

        // Approximate word timing for lip pulses
        const tokens = speechText.split(/\s+/).filter(Boolean);
        tokens.forEach((token, index) => {
          const timerId = setTimeout(() => {
            pulseViseme(token, 100 + Math.round(Math.random() * 70));
          }, index * 130);
          lipPulseTimersRef.current.push(timerId);
        });

        Speech.speak(speechText, {
          rate: clamp(TTS_RATE, 0.8, 1.2),
          pitch: clamp(TTS_PITCH, 0.8, 1.2),
          onDone: () => {
            clearLipPulseTimers();
            lipTargetRef.current = { aa: 0, ee: 0, oh: 0 };
            const timerId = setTimeout(() => stopLipLoop(true), 140);
            lipPulseTimersRef.current.push(timerId);
            preserveAnimationRef.current = false;
            if (!preserveAnimation) setConversationState(CONVERSATION_STATES.IDLE);
            onSpeechEnd?.();
          },
          onError: () => {
            stopLipLoop(true);
            preserveAnimationRef.current = false;
            if (!preserveAnimation) setConversationState(CONVERSATION_STATES.IDLE);
            onSpeechEnd?.();
          },
        });
        return;
      }
    } catch (error) {
      preserveAnimationRef.current = false;
      if (!options.preserveAnimation) {
        setConversationState(CONVERSATION_STATES.IDLE);
      }
      if (typeof options.onEnd === 'function') options.onEnd();
      console.warn('[InteractiveAvatar] TTS failed:', error);
    }
  }, [
    enableTTS,
    clearLipPulseTimers,
    playAudioBufferWithLipSync,
    pulseViseme,
    runConversationalGesture,
    setCameraShot,
    setEmotion,
    setConversationState,
    startLipLoop,
    stopLipLoop,
    synthesizeSpeechAudio,
    gender,
  ]);

  // Trigger animation with queueing
  const triggerAnimation = useCallback(async (animationType, duration) => {
    if (isAnimating) {
      animationQueueRef.current.push({ animationType, duration });
      return;
    }

    const runId = ++animationRunIdRef.current;

    const resolvedDuration = typeof duration === 'number'
      ? duration
      : getAvatarAnimationDuration(animationType, gender, 900);

    interruptRestingAnimationFlow();
    setIsAnimating(true);
    const animationState = setAnimationState(animationType);

    await waitForAnimationStep({ ...animationState, duration: resolvedDuration });

  if (runId !== animationRunIdRef.current) return false;

    returnToRestingAnimation();
    setIsAnimating(false);

    // Process queued animations
    if (animationQueueRef.current.length > 0) {
      const next = animationQueueRef.current.shift();
      triggerAnimation(next.animationType, next.duration);
    }
    return true;
  }, [gender, interruptRestingAnimationFlow, isAnimating, returnToRestingAnimation, setAnimationState]);

  const triggerAnimationSequence = useCallback(async (sequence = [], options = {}) => {
    const rawSteps = Array.isArray(sequence) ? sequence.filter(Boolean) : [];
    const steps = rawSteps.reduce((accumulator, step) => {
      const animationType = step?.animationType || step?.animation || step?.type;
      if (!animationType) return accumulator;

      const duration = typeof step.duration === 'number'
        ? step.duration
        : getAvatarAnimationDuration(animationType, gender, 900);
      const repeatCount = Math.max(1, Number(step.repeatCount || step.repetitions) || 1);
      const animationConfig = resolveAvatarAnimationConfig(animationType, gender);
      const previous = accumulator[accumulator.length - 1];

      if (
        previous
        && !animationConfig.loop
        && previous.animationType === animationType
      ) {
        previous.duration += duration;
        previous.repeatCount += repeatCount;
        return accumulator;
      }

      accumulator.push({
        ...step,
        animationType,
        duration,
        repeatCount,
      });
      return accumulator;
    }, []);
    if (steps.length === 0) return false;

    const runId = ++sequenceRunIdRef.current;
    await preloadAnimationSequence(steps);
    if (runId !== sequenceRunIdRef.current) {
      preserveAnimationRef.current = false;
      return false;
    }
    preserveAnimationRef.current = true;
    interruptRestingAnimationFlow();
    setIsAnimating(true);
    for (const step of steps) {
      if (runId !== sequenceRunIdRef.current) {
        preserveAnimationRef.current = false;
        setIsAnimating(false);
        return false;
      }
      const animationType = step.animationType || step.animation || step.type;
      if (!animationType) continue;
      const duration = typeof step.duration === 'number'
        ? step.duration
        : getAvatarAnimationDuration(animationType, gender, 900);
      const animationState = setAnimationState(animationType, { repeatCount: step.repeatCount });
      // eslint-disable-next-line no-await-in-loop
      await waitForAnimationStep({ ...animationState, duration });
      if (runId !== sequenceRunIdRef.current) {
        preserveAnimationRef.current = false;
        setIsAnimating(false);
        return false;
      }
    }
    preserveAnimationRef.current = false;

    if (options.returnToIdle !== false) {
      returnToRestingAnimation();
    }
    setIsAnimating(false);
    return true;
  }, [gender, interruptRestingAnimationFlow, preloadAnimationSequence, returnToRestingAnimation, setAnimationState]);

  const stopAnimationPlayback = useCallback(() => {
    animationRunIdRef.current += 1;
    sequenceRunIdRef.current += 1;
    animationQueueRef.current = [];
    preserveAnimationRef.current = false;
    clearPendingAnimationCompletion(true);
    interruptRestingAnimationFlow();
    setIsAnimating(false);
    returnToRestingAnimation();
    return true;
  }, [clearPendingAnimationCompletion, interruptRestingAnimationFlow, returnToRestingAnimation]);

  const triggerWorkoutDemo = useCallback(async (exerciseOrDemo, options = {}) => {
    let demo = null;

    if (exerciseOrDemo && typeof exerciseOrDemo === 'object' && Array.isArray(exerciseOrDemo.sequence)) {
      demo = exerciseOrDemo;
    } else if (typeof exerciseOrDemo === 'string') {
      const inferredAnimation = inferWorkoutAnimationFromText(exerciseOrDemo) || exerciseOrDemo;
      demo = buildWorkoutDemoSequence(inferredAnimation, options);
    }

    if (!demo?.sequence?.length) return false;
    return triggerAnimationSequence(demo.sequence, options);
  }, [triggerAnimationSequence]);

  // Expose speak and triggerAnimation to parent components
  useImperativeHandle(ref, () => ({
    speak,
    setVoiceType,
    getVoiceType,
    setConversationState,
    triggerAnimation,
    triggerAnimationSequence,
    triggerWorkoutDemo,
    stopAnimationPlayback,
    initializeLipSync,
    startMicLipSync,
    stopMicLipSync,
    setEmotion,
    setCameraShot,
  }), [speak, setVoiceType, getVoiceType, setConversationState, triggerAnimation, triggerAnimationSequence, triggerWorkoutDemo, stopAnimationPlayback, initializeLipSync, startMicLipSync, stopMicLipSync, setEmotion, setCameraShot]);

  // Gesture handlers (tap, double-tap, swipe, long-press)
  const { gestures } = useAvatarGestures({ playSound, speak, triggerAnimation, onInteraction });

  // Voice detection setup (mobile)
  useEffect(() => {
    if (!enableVoice) return;

    const setupVoiceDetection = async () => {
      try {
        // For native platforms, integrate speech-to-text
        // For web, use Web Speech API
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
          const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;

          recognition.onstart = () => setMicActive(true);
          recognition.onend = () => setMicActive(false);
          recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map(result => result[0].transcript)
              .join('');
            // Trigger response based on voice input
            speak(`You said: ${transcript}`);
            triggerAnimation(ANIMATIONS.TALK);
            onInteraction?.({ type: 'voice', text: transcript });
          };

          micListenerRef.current = recognition;
        }
      } catch (error) {
        console.warn('[InteractiveAvatar] Voice detection setup failed:', error);
      }
    };

    setupVoiceDetection();

    return () => {
      if (micListenerRef.current) {
        micListenerRef.current.abort?.();
      }
    };
  }, [enableVoice, speak, triggerAnimation, onInteraction]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearReturnToRestTimer();
      clearPendingAnimationCompletion(true);
      stopMicLipSync();
      stopLipLoop(true);
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
    };
  }, [clearPendingAnimationCompletion, clearReturnToRestTimer, stopLipLoop, stopMicLipSync]);

  const avatarContent = (
    <Animated.View style={[styles.container, { opacity: isAnimating ? 0.9 : 1 }]}>
      <Avatar
        ref={avatarRef}
        height={height}
        weight={weight}
        gender={gender}
        photoUri={photoUri}
        model={model}
        sizeMultiplier={sizeMultiplier}
        xOffset={xOffset}
        yOffset={yOffset}
        zOffset={zOffset}
        alignFootToBottom={alignFootToBottom}
        bottomPadding={bottomPadding}
        autoFit={autoFit}
        headMargin={headMargin}
        bottomInsetPx={bottomInsetPx}
        focus={focus}
        fitMode={fitMode}
        targetFill={targetFill}
        footLift={footLift}
        preserveTPose={preserveTPose}
        playAnimation={playAnimation}
        animationType={currentAnimation}
        animationReplayNonce={animationReplayNonce}
        animationRepeatCount={animationRepeatCount}
        onAnimationComplete={handleAnimationComplete}
        onVrmLoad={initializeLipSync}
        onManagersReady={onManagersReady}
      />
      {/* Overlay UI indicators */}
      <View style={styles.overlay}>
        {micActive && <View style={styles.micIndicator} />}
        {isAnimating && <View style={styles.animationIndicator} />}
      </View>
    </Animated.View>
  );

  if (!enableReactionGestures) {
    return avatarContent;
  }

  return (
    <GestureDetector gesture={gestures}>
      {avatarContent}
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
  },
  micIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4444',
    boxShadow: '0px 0px 4px rgba(255,68,68,0.8)',
    elevation: 5,
  },
  animationIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#44FF44',
    boxShadow: '0px 0px 4px rgba(68,255,68,0.8)',
    elevation: 5,
  },
});

InteractiveAvatar.displayName = 'InteractiveAvatar';

export default InteractiveAvatar;
