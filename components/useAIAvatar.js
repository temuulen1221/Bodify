import { useCallback, useEffect, useRef, useState } from 'react';
import GeminiAvatarService from '../services/GeminiAvatarService';
import { inferWorkoutDemoFromExchange } from '../utils/avatarWorkoutHelpers';

/**
 * useAIAvatar - Hook to connect interactive avatar with Gemini AI
 * Enables intelligent conversations, emotion detection, and dynamic animations
 */
export const useAIAvatar = (options = {}) => {
  const {
    personality = 'friendly_coach',
    userName = 'User',
    gender = 'male',
    height = '175',
    weight = '70',
    preferDirectGemini = false,
  } = options;

  const [aiResponse, setAiResponse] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [latestAiOutcome, setLatestAiOutcome] = useState(null);

  const geminiRef = useRef(null);

  const enrichOutcome = useCallback((userMessage, response, options = {}) => {
    if (!response) return null;
    return {
      ...response,
      workoutDemo: inferWorkoutDemoFromExchange(userMessage, response.message, options),
    };
  }, []);

  // Initialize Gemini service
  useEffect(() => {
    geminiRef.current = new GeminiAvatarService({
      personality,
      preferDirectGemini,
      userProfile: {
        name: userName,
        gender,
        height,
        weight,
      },
    });
  }, [personality, preferDirectGemini, userName, gender, height, weight]);

  // Send message to AI and get response
  const chat = useCallback(async (userMessage) => {
    if (!userMessage?.trim()) return;

    setIsThinking(true);
    setError(null);

    try {
      const rawResponse = await geminiRef.current.chat(userMessage);
      const response = enrichOutcome(userMessage, rawResponse);

      // Update state with AI response
      setAiResponse(response.message);
      setCurrentEmotion(response.emotion);
      setCurrentAnimation(response.animation);
      setLatestAiOutcome(response);

      // Update conversation history for UI display
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', message: userMessage },
        {
          role: 'ai',
          message: response.message,
          emotion: response.emotion,
          xp: response.xp,
          action: response.action,
          bondDelta: response.bondDelta,
        },
      ].slice(-10)); // Keep last 5 exchanges

      return response;
    } catch (err) {
      console.error('[useAIAvatar] Chat error:', err);
      setError(err.message);
      return null;
    } finally {
      setIsThinking(false);
    }
  }, [enrichOutcome]);

  // Get workout advice
  const getWorkoutAdvice = useCallback(async (workoutType = 'general') => {
    setIsThinking(true);
    try {
      const prompt = `${workoutType === 'general' ? 'Give me a short motivational message to get me started' : `Give me specific advice for ${workoutType}`}`;
      const rawResponse = await geminiRef.current.getWorkoutAdvice(workoutType);
      const response = enrichOutcome(prompt, rawResponse);
      setAiResponse(response.message);
      setCurrentEmotion(response.emotion);
      setCurrentAnimation(response.animation);
      setLatestAiOutcome(response);
      return response;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsThinking(false);
    }
  }, [enrichOutcome]);

  // Analyze metrics
  const analyzeMetrics = useCallback(async (metrics) => {
    setIsThinking(true);
    try {
      const prompt = `I did ${metrics?.steps || 0} steps, ${metrics?.pushups || 0} pushups, ${metrics?.plankSeconds || metrics?.plankSec || 0}s plank, drank ${metrics?.waterIntake || 0}L water, and slept ${metrics?.sleepHours || 0} hours. How am I doing?`;
      const rawResponse = await geminiRef.current.analyzeMetrics(metrics);
      const response = enrichOutcome(prompt, rawResponse);
      setAiResponse(response.message);
      setCurrentEmotion(response.emotion);
      setCurrentAnimation(response.animation);
      setLatestAiOutcome(response);
      return response;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsThinking(false);
    }
  }, [enrichOutcome]);

  // Get encouragement
  const getEncouragement = useCallback(async (state = 'discouraged') => {
    setIsThinking(true);
    try {
      const rawResponse = await geminiRef.current.getEncouragement(state);
      const response = enrichOutcome(state, rawResponse);
      setAiResponse(response.message);
      setCurrentEmotion(response.emotion);
      setCurrentAnimation(response.animation);
      setLatestAiOutcome(response);
      return response;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsThinking(false);
    }
  }, [enrichOutcome]);

  // Reset conversation
  const resetConversation = useCallback(() => {
    geminiRef.current?.resetConversation();
    setConversationHistory([]);
    setAiResponse(null);
    setCurrentEmotion('neutral');
    setCurrentAnimation('idle');
    setLatestAiOutcome(null);
    setError(null);
  }, []);

  // Change personality
  const setPersonality = useCallback((newPersonality) => {
    geminiRef.current?.setPersonality(newPersonality);
  }, []);

  // Update user profile
  const setUserProfile = useCallback((profile) => {
    geminiRef.current?.setUserProfile(profile);
  }, []);

  return {
    // State
    aiResponse,
    isThinking,
    currentEmotion,
    currentAnimation,
    conversationHistory,
    error,
    latestAiOutcome,

    // Methods
    chat,
    getWorkoutAdvice,
    analyzeMetrics,
    getEncouragement,
    resetConversation,
    setPersonality,
    setUserProfile,
  };
};

/**
 * Avatar personality options
 */
export const AVATAR_PERSONALITIES = {
  FRIENDLY_COACH: 'friendly_coach',
  WISE_MENTOR: 'wise_mentor',
  FUN_BUDDY: 'fun_buddy',
  MOTIVATOR: 'motivator',
};

/**
 * Emotion to animation mapping for AI responses
 */
export const EMOTION_ANIMATIONS = {
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

export default useAIAvatar;
