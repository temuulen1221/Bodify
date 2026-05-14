import { useCallback, useRef, useState } from 'react';

/**
 * useInteractiveAvatar - Hook to manage interactive avatar state, animations, and responses
 */
export const useInteractiveAvatar = (options = {}) => {
  const {
    enableVoice = true,
    enableTTS = true,
    soundEnabled = true,
    customResponses = [],
    gender = 'male',
  } = options;

  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastInteraction, setLastInteraction] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEnabled);
  const animationQueueRef = useRef([]);

  const queueAnimation = useCallback((animation, duration = 500) => {
    if (isAnimating) {
      animationQueueRef.current.push({ animation, duration });
    }
  }, [isAnimating]);

  const triggerAnimation = useCallback(async (animation, duration = 500) => {
    setIsAnimating(true);
    setCurrentAnimation(animation);

    await new Promise(resolve => setTimeout(resolve, duration));

    setCurrentAnimation('idle');
    setIsAnimating(false);

    // Process queued animations
    if (animationQueueRef.current.length > 0) {
      const next = animationQueueRef.current.shift();
      triggerAnimation(next.animation, next.duration);
    }
  }, []);

  const recordInteraction = useCallback((type, data) => {
    setLastInteraction({
      type,
      timestamp: Date.now(),
      data,
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn(prev => !prev);
  }, []);

  const toggleVoice = useCallback(() => {
    // Toggle voice recording
  }, []);

  const getRandomResponse = useCallback((gestureType) => {
    const responses = customResponses.filter(r => r.gesture === gestureType);
    if (responses.length === 0) return null;
    return responses[Math.floor(Math.random() * responses.length)];
  }, [customResponses]);

  const getEmotionAnimation = useCallback((emotion) => {
    const emotionMap = {
      happy: 'happy',
      sad: 'sad',
      excited: 'dance',
      surprised: 'surprised',
      angry: 'angry',
      thinking: 'thinking',
      confused: 'confused',
      tired: 'tired',
      energetic: 'jump',
      playful: 'laugh',
    };
    return emotionMap[emotion] || 'idle';
  }, []);

  const speak = useCallback((text) => {
    if (!enableTTS) return;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = gender === 'female' ? 1.2 : 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, [enableTTS]);

  return {
    currentAnimation,
    isAnimating,
    lastInteraction,
    micActive,
    soundOn,
    queueAnimation,
    triggerAnimation,
    recordInteraction,
    toggleSound,
    toggleVoice,
    getRandomResponse,
    getEmotionAnimation,
    speak,
    setMicActive,
  };
};

/**
 * Predefined emotion animations and expressions
 */
export const AVATAR_EMOTIONS = {
  HAPPY: 'happy',
  SAD: 'sad',
  SURPRISED: 'surprised',
  ANGRY: 'angry',
  THINKING: 'thinking',
  CONFUSED: 'confused',
  TIRED: 'tired',
  ENERGETIC: 'energetic',
  PLAYFUL: 'playful',
  NEUTRAL: 'idle',
};

/**
 * Predefined gesture types
 */
export const AVATAR_GESTURES = {
  TAP: 'tap',
  DOUBLE_TAP: 'doubleTap',
  SWIPE_LEFT: 'swipeLeft',
  SWIPE_RIGHT: 'swipeRight',
  LONG_PRESS: 'longPress',
  PINCH: 'pinch',
  VOICE: 'voice',
  PROXIMITY: 'proximity',
};

/**
 * Default avatar response templates
 */
export const DEFAULT_RESPONSES = [
  { gesture: 'tap', animation: 'happy', sound: 'tap.mp3', text: 'Hey there!' },
  { gesture: 'doubleTap', animation: 'laugh', sound: 'laugh.mp3', text: 'That tickles!' },
  { gesture: 'swipeLeft', animation: 'wave', sound: 'wave.mp3', text: 'See you later!' },
  { gesture: 'swipeRight', animation: 'dance', sound: 'dance.mp3', text: 'Let\'s dance!' },
  { gesture: 'longPress', animation: 'surprised', sound: 'surprised.mp3', text: 'Oh!' },
  { gesture: 'pinch', animation: 'talk', sound: 'talk.mp3', text: 'Whoa, that\'s tight!' },
  { gesture: 'voice', animation: 'talk', sound: 'listen.mp3', text: 'I heard you!' },
];
