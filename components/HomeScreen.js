import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { auth, db } from '../services/firebase';
import { addBadgeXP, addXP, categorizeWorkoutSessionForBadgeXp, markDayComplete, markQuestXPAwarded, markSessionXPAwarded, registerWorkoutDay, showLevelUpPreview } from '../store';
import { AVATAR_ANIMATIONS, IDLE_LOOP_ANIMATION_OPTIONS, getAvatarAnimationDuration } from '../utils/avatarAnimationConfig';
import { buildAiWorkoutPlanFromGuide, inferPendingWorkoutGuideFromExchange, isWorkoutDemoConfirmation, isWorkoutStartConfirmation } from '../utils/avatarWorkoutHelpers';
import { COLORS, GRADIENTS } from '../utils/constants';
import AvatarWeb from './AvatarWeb';
import { useAIAvatar } from './useAIAvatar';
import { useVroidAuth } from './useVroidAuth';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const InteractiveAvatar = Platform.OS === 'web' ? null : require('./InteractiveAvatar').default;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const WORKOUT_PLAN_STORAGE_KEY = 'bodify:web-workout-plan';
const HOME_IDLE_ROTATION_MIN_DELAY_MS = 36000;
const HOME_IDLE_ROTATION_VARIANCE_MS = 18000;
const HOME_PREFERRED_IDLE_WEIGHT = 0.72;
const HOME_IDLE_POOL = IDLE_LOOP_ANIMATION_OPTIONS
  .map((option) => option.key)
  .filter((key) => [
    'holding_idle',
    'standard_idle_fbx',
    'idle_male_fbx',
    'idle_female_fbx',
    'bored_idle_fbx',
    'catwalk_idle_01',
    'catwalk_idle_twist_l',
    'sad_idle_fbx',
    'offensive_idle',
  ].includes(key));

const HOME_WEB_IDLE_POOL = [
  'holding_idle',
  'standard_idle_fbx',
  'bored_idle_fbx',
  'sad_idle_fbx',
  'catwalk_idle_01',
  'catwalk_idle_twist_l',
  'offensive_idle',
  'standing_briefcase_idle',
];

const getHomeIdlePool = (gender) => {
  const normalizedGender = String(gender || 'neutral').toLowerCase();
  const preferredIdle = normalizedGender === 'female'
    ? 'idle_female_fbx'
    : normalizedGender === 'male'
      ? 'idle_male_fbx'
      : 'standard_idle_fbx';
  if (Platform.OS === 'web') {
    return Array.from(new Set([
      preferredIdle,
      ...HOME_WEB_IDLE_POOL,
    ])).filter((key) => {
      if (normalizedGender === 'female') return key !== 'idle_male_fbx';
      if (normalizedGender === 'male') return key !== 'idle_female_fbx';
      return true;
    });
  }
  const filteredPool = HOME_IDLE_POOL.filter((key) => {
    if (normalizedGender === 'female') return key !== 'idle_male_fbx';
    if (normalizedGender === 'male') return key !== 'idle_female_fbx';
    return true;
  });
  return Array.from(new Set([preferredIdle, ...filteredPool])).filter(Boolean);
};

const getPreferredHomeIdle = (gender) => getHomeIdlePool(gender)[0] || 'standard_idle_fbx';

const getQuestBadgeCategories = (quest = {}) => {
  const title = String(quest?.title || '').toLowerCase();

  if (title.includes('step')) return ['walker'];
  if (title.includes('water')) return ['diet'];
  if (title.includes('push-up') || title.includes('push up')) return ['workout', 'strongman', 'mass'];

  return [];
};

const pickNextHomeIdle = (currentIdle, gender) => {
  const pool = getHomeIdlePool(gender);
  if (pool.length === 0) return AVATAR_ANIMATIONS.IDLE;
  const preferredIdle = getPreferredHomeIdle(gender);
  const nextPool = pool.filter((key) => key !== currentIdle);
  const options = nextPool.length > 0 ? nextPool : pool;
  const nonPreferredOptions = options.filter((key) => key !== preferredIdle);

  if (preferredIdle && options.includes(preferredIdle) && Math.random() < HOME_PREFERRED_IDLE_WEIGHT) {
    return preferredIdle;
  }

  if (nonPreferredOptions.length > 0) {
    return nonPreferredOptions[Math.floor(Math.random() * nonPreferredOptions.length)] || preferredIdle;
  }

  return options[0] || preferredIdle || pool[0];
};

const getSafeWebHomeAnimation = (animationType, gender) => {
  const normalized = String(animationType || '').toLowerCase();
  if (!normalized) return getPreferredHomeIdle(gender);

  if (
    normalized === AVATAR_ANIMATIONS.IDLE
    || normalized === AVATAR_ANIMATIONS.PROCEDURAL_IDLE
    || HOME_IDLE_POOL.includes(normalized)
  ) {
    return normalized === AVATAR_ANIMATIONS.IDLE
      || normalized === AVATAR_ANIMATIONS.PROCEDURAL_IDLE
      ? getPreferredHomeIdle(gender)
      : normalized;
  }

  // Home web currently uses a model that cannot reliably bind the broader FBX/GLB set.
  // Keep the avatar in a stable idle pose instead of letting unsupported clips break into bind pose.
  return AVATAR_ANIMATIONS.PROCEDURAL_IDLE;
};

const WORKOUT_SECTION_INVITE_PATTERN = /(do this together|with you in workout|take you there|open workout|go to workout|workout section)/i;
const OUTDOOR_ACTIVITY_PATTERNS = {
  running: /\brun(ning)?\b|\bjog(ging)?\b|treadmill/i,
  cycling: /\bcycl(ing)?\b|\bbike\b|\bbiking\b|\bride\b|spinning/i,
  hiking: /\bhik(e|ing)\b|trail|trek|incline walk/i,
};
const OUTDOOR_TRACKER_MODES = {
  running: {
    label: 'Running',
    type: 'running',
    icon: 'walk',
    caloriesPerMinute: 11,
    coachLabel: 'Running mode ready',
  },
  cycling: {
    label: 'Cycling',
    type: 'cycling',
    icon: 'bicycle',
    caloriesPerMinute: 9,
    coachLabel: 'Cycling mode ready',
  },
  hiking: {
    label: 'Hiking',
    type: 'hiking',
    icon: 'map',
    caloriesPerMinute: 8,
    coachLabel: 'Hiking mode ready',
  },
};

const appendWorkoutSectionInvite = (message, guide) => {
  const baseMessage = String(message || '').trim();
  if (!guide?.items?.length || !baseMessage) return baseMessage;
  if (WORKOUT_SECTION_INVITE_PATTERN.test(baseMessage)) return baseMessage;

  return `${baseMessage} If you want, I can do this with you in Workout. Say "let's do it".`;
};

const inferOutdoorTrackerMode = (...values) => {
  const combinedValue = values.map((value) => String(value || '').trim()).filter(Boolean).join(' ');
  if (!combinedValue) return null;

  if (OUTDOOR_ACTIVITY_PATTERNS.cycling.test(combinedValue)) return OUTDOOR_TRACKER_MODES.cycling;
  if (OUTDOOR_ACTIVITY_PATTERNS.running.test(combinedValue)) return OUTDOOR_TRACKER_MODES.running;
  if (OUTDOOR_ACTIVITY_PATTERNS.hiking.test(combinedValue)) return OUTDOOR_TRACKER_MODES.hiking;
  return null;
};

const buildTodayWorkoutPlan = ({ todaySteps, pushupReps }) => {
  const cardioBias = Number(todaySteps || 0) >= 6000;

  if (cardioBias) {
    return {
      title: "Today's Cardio Reset",
      summary: '1 minute warm-up, 2 minutes jogging in place, 1 minute jumping jacks, then a 2 minute plank-finisher cadence.',
      durationMin: 6,
      exercises: [
        { label: 'Warm-Up', animationType: AVATAR_ANIMATIONS.WARMUP, demoLabel: 'Warm-Up Demo' },
        { label: 'Running', animationType: AVATAR_ANIMATIONS.RUNNING, demoLabel: 'Running Demo' },
        { label: 'Jumping Jacks', animationType: AVATAR_ANIMATIONS.JUMPING_JACKS, demoLabel: 'Jumping Jack Demo' },
        { label: 'Plank', animationType: AVATAR_ANIMATIONS.PLANK, demoLabel: 'Plank Demo' },
      ],
    };
  }

  return {
    title: 'Starter Strength Flow',
    summary: `1 minute warm-up, 2 minutes squats, ${pushupReps >= 10 ? '1 minute push-up quality work' : '1 minute incline push-ups'}, then a 2 minute plank to finish.`,
    durationMin: 6,
    exercises: [
      { label: 'Warm-Up', animationType: AVATAR_ANIMATIONS.WARMUP, demoLabel: 'Warm-Up Demo' },
      { label: 'Squat', animationType: AVATAR_ANIMATIONS.SQUAT, demoLabel: 'Squat Demo' },
      { label: 'Push-up', animationType: AVATAR_ANIMATIONS.PUSHUP, demoLabel: 'Push-up Demo' },
      { label: 'Plank', animationType: AVATAR_ANIMATIONS.PLANK, demoLabel: 'Plank Demo' },
    ],
  };
};

const getWorkoutPreviewEmoji = (label) => {
  const normalizedLabel = String(label || '').toLowerCase();
  if (normalizedLabel.includes('warm')) return '🔥';
  if (normalizedLabel.includes('run')) return '🏃';
  if (normalizedLabel.includes('jump')) return '⚡';
  if (normalizedLabel.includes('squat')) return '🦵';
  if (normalizedLabel.includes('push')) return '💪';
  if (normalizedLabel.includes('plank')) return '🧱';
  return '•';
};

const MenuGlyph = ({ open }) => {
  if (open) {
    return (
      <View style={styles.menuGlyphThreeDots}>
        {[0, 1, 2].map((dot) => (
          <View key={`open-dot-${dot}`} style={styles.menuGlyphOpenDot} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.menuGlyphList}>
      {[0, 1, 2].map((row) => (
        <View key={`list-row-${row}`} style={styles.menuGlyphRow}>
          <View style={styles.menuGlyphDot} />
          <View style={styles.menuGlyphLine} />
        </View>
      ))}
    </View>
  );
};

const HomeScreen = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const avatarRef = useRef(null);
  const homeAnimationResetRef = useRef(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuRendered, setMenuRendered] = useState(false);
  const [mobileQuestOpen, setMobileQuestOpen] = useState(false);
  const [workoutSuggestionExpanded, setWorkoutSuggestionExpanded] = useState(false);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState('');
  const [coachListening, setCoachListening] = useState(false);
  const [coachMicError, setCoachMicError] = useState('');
  const [latestUserPrompt, setLatestUserPrompt] = useState('');
  const [coachReplyOverride, setCoachReplyOverride] = useState('');
  const [pendingWorkoutGuide, setPendingWorkoutGuide] = useState(null);
  const [pendingOutdoorMode, setPendingOutdoorMode] = useState(null);
  const [activeIdleAnimation, setActiveIdleAnimation] = useState(() => pickNextHomeIdle(null, 'neutral'));
  const [homeAvatarAnimation, setHomeAvatarAnimation] = useState(null);
  const coachRecognitionRef = useRef(null);
  const { level, points, pointsMax, avatarName, gender, height, weight, photoUri, avatarModel, streakCount, energy } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((s) => s.workouts?.sessionsByDate || {});
  const dateObj = new Date();
  const todayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const todaySteps = stepsByDate[todayKey] || 0;
  const todaySessions = sessionsByDate[todayKey] || [];
  const pushupReps = todaySessions.reduce((sum, s) => {
    const reps = Number(s.reps ?? s.pushups);
    const type = (s.type || '').toString().toLowerCase();
    if (Number.isFinite(reps) && reps > 0) return sum + reps;
    if (type.includes('push')) return sum;
    return sum;
  }, 0);
  const waterLiters = 0;
  const dailyQuests = useMemo(() => ([
    {
      title: 'Complete 10,000 steps',
      shortTitle: '10,000 steps',
      icon: '👟',
      progress: todaySteps,
      goal: 10000,
      reward: '50 XP',
    },
    {
      title: 'Drink 2L of water',
      shortTitle: 'Drink 2L water',
      icon: '💧',
      progress: waterLiters,
      goal: 2,
      reward: '10 XP',
    },
    {
      title: 'Do 20 push-ups',
      shortTitle: '20 push-ups',
      icon: '💪',
      progress: pushupReps,
      goal: 20,
      reward: '15 XP',
    },
  ]), [todaySteps, waterLiters, pushupReps]);
  const completedQuestCount = dailyQuests.filter((quest) => quest.progress >= quest.goal).length;
  const questCompletionPct = Math.round((completedQuestCount / Math.max(1, dailyQuests.length)) * 100);
  const totalQuestXP = dailyQuests.reduce((total, quest) => {
    const match = String(quest.reward || '').match(/(\d+)\s*XP/i);
    return total + (match ? parseInt(match[1], 10) : 0);
  }, 0);
  const menuActions = useMemo(() => ([
    { icon: '🏆', route: '/Leaderboard' },
    { icon: '🧘‍♂️', route: '/Rest' },
    { icon: '🛒', route: '/Shop' },
    { icon: '⚙️', route: '/settings' },
    { icon: '⚔️', route: '/battle-replay' },
    { icon: '🧍', route: '/Pose' },
  ]), []);
  const menuAnim = useRef(new Animated.Value(0)).current;

  const [treasureClaimed, setTreasureClaimed] = useState(false);
  const [treasureClaimedAt, setTreasureClaimedAt] = useState(null);
  const [usd, setUsd] = useState(0);

  const canClaimTreasure = dailyQuests.every(q => q.progress >= q.goal) && (!treasureClaimedAt || (Date.now() - treasureClaimedAt > 24 * 60 * 60 * 1000));

  useEffect(() => {
    const allDone = dailyQuests.every(q => q.progress >= q.goal);
    if (allDone) {
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dispatch(markDayComplete(key));
    }
  }, [dailyQuests, dispatch]);

  const questsAwardedMap = useSelector((state) => state.quests?.xpAwardedByDate || {});
  useEffect(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const awardedToday = questsAwardedMap[todayKey] || {};
    dailyQuests.forEach((q, i) => {
      if (q.progress >= q.goal) {
        const questKey = `quest_${i}`;
        if (!awardedToday[questKey]) {
          const match = String(q.reward || '').match(/(\d+)\s*XP/i);
          const xp = match ? parseInt(match[1], 10) : 0;
          if (xp > 0) {
            dispatch(addXP(xp));
            dispatch(addBadgeXP({
              amount: xp,
              categories: getQuestBadgeCategories(q),
            }));
            dispatch(markQuestXPAwarded({ date: todayKey, key: questKey }));
          }
        }
      }
    });
  }, [dailyQuests, questsAwardedMap, dispatch]);

  useEffect(() => {
    if (!treasureClaimed || !treasureClaimedAt) return;
    if (Date.now() - treasureClaimedAt <= 24 * 60 * 60 * 1000) return;
    setTreasureClaimed(false);
    setTreasureClaimedAt(null);
  }, [treasureClaimed, treasureClaimedAt]);

  useEffect(() => {
    const resetDailyQuestsIfNeeded = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      let snap;
      let data = {};
      try {
        snap = await getDoc(userRef);
        data = snap.exists() ? snap.data() : {};
      } catch (err) {
        console.warn('[Home] Firestore getDoc failed (offline?): using defaults, will retry later.', err);
        return;
      }
      const lastReset = data.lastQuestReset;
      const today = new Date().toISOString().slice(0, 10);
      if (lastReset !== today) {
        const defaultQuests = [
          {
            title: 'Complete 10,000 steps',
            progress: 0,
            goal: 10000,
            reward: '50 XP',
          },
          {
            title: 'Drink 2L of water',
            progress: 0,
            goal: 2,
            reward: '10 XP',
          },
          {
            title: 'Do 20 push-ups',
            progress: 0,
            goal: 20,
            reward: '15 XP',
          },
        ];
        try {
          await setDoc(userRef, {
            dailyQuests: defaultQuests,
            lastQuestReset: today
          }, { merge: true });
        } catch (err) {
          console.warn('[Home] Firestore setDoc failed (offline?): changes not saved yet.', err);
        }
      }
    };
    resetDailyQuestsIfNeeded();
  }, []);

  const { selectedAvatarUrl } = useVroidAuth();
  const {
    aiResponse,
    isThinking: coachThinking,
    currentEmotion,
    conversationHistory,
    error: coachError,
    chat,
    resetConversation,
  } = useAIAvatar({
    personality: 'friendly_coach',
    preferDirectGemini: true,
    userName: avatarName || 'User',
    gender: String(gender || 'male'),
    height: String(height || '175'),
    weight: String(weight || '70'),
  });
  const todayWorkoutPlan = useMemo(() => buildTodayWorkoutPlan({ todaySteps, pushupReps }), [pushupReps, todaySteps]);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setActiveIdleAnimation((currentIdle) => pickNextHomeIdle(currentIdle, gender));
  }, [gender]);

  useEffect(() => {
    if (homeAvatarAnimation || coachThinking) return undefined;

    const timeout = setTimeout(() => {
      setActiveIdleAnimation((currentIdle) => pickNextHomeIdle(currentIdle, gender));
    }, HOME_IDLE_ROTATION_MIN_DELAY_MS + Math.round(Math.random() * HOME_IDLE_ROTATION_VARIANCE_MS));

    return () => clearTimeout(timeout);
  }, [activeIdleAnimation, coachThinking, gender, homeAvatarAnimation]);

  useEffect(() => {
    if (!coachThinking && !aiResponse && !coachError) return;
    setCoachExpanded(true);
  }, [aiResponse, coachError, coachThinking]);

  useEffect(() => {
    return () => {
      if (homeAnimationResetRef.current) {
        clearTimeout(homeAnimationResetRef.current);
      }
    };
  }, []);

  const openWorkoutSuggestion = useCallback((plan) => {
    const serializedPlan = JSON.stringify(plan);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(WORKOUT_PLAN_STORAGE_KEY, serializedPlan);
      } catch (_) {}
      router.push('/(tabs)/Workout');
      return;
    }

    router.push({
      pathname: '/(tabs)/Workout',
      params: { aiPlan: serializedPlan },
    });
  }, [router]);

  const openOutdoorTracker = useCallback((mode) => {
    if (!mode) return;
    router.push({
      pathname: '/outdoor-tracker',
      params: {
        label: mode.label,
        type: mode.type,
        icon: mode.icon,
        caloriesPerMinute: String(mode.caloriesPerMinute),
      },
    });
  }, [router]);

  const queueHomeAvatarAnimation = useCallback((animationType, durationMs = 0) => {
    if (homeAnimationResetRef.current) {
      clearTimeout(homeAnimationResetRef.current);
      homeAnimationResetRef.current = null;
    }

    const nextAnimationType = Platform.OS === 'web'
      ? getSafeWebHomeAnimation(animationType, gender)
      : (animationType || null);

    setHomeAvatarAnimation(nextAnimationType || null);

    if (!nextAnimationType || durationMs <= 0) return;

    homeAnimationResetRef.current = setTimeout(() => {
      setHomeAvatarAnimation(null);
      homeAnimationResetRef.current = null;
    }, durationMs + 320);
  }, [gender]);

  const playWorkoutGuide = useCallback(async (guide) => {
    if (!guide?.sequence?.length) return false;

    const totalDuration = guide.sequence.reduce((sum, step) => {
      const repeatCount = Math.max(1, Number(step?.repeatCount) || 1);
      const stepDuration = typeof step?.duration === 'number'
        ? step.duration
        : getAvatarAnimationDuration(step?.animationType, gender, 900);
      return sum + (stepDuration * repeatCount);
    }, 0);

    setCoachExpanded(true);
    setPendingWorkoutGuide(null);

    if (Platform.OS === 'web') {
      queueHomeAvatarAnimation(guide.animationType, totalDuration);
      return true;
    }

    await avatarRef.current?.triggerAnimationSequence?.(guide.sequence);
    return true;
  }, [gender, queueHomeAvatarAnimation]);

  const applyCoachOutcome = useCallback(async (response, promptText = '') => {
    if (!response) return;

    const pendingGuide = inferPendingWorkoutGuideFromExchange(promptText, response.message) || response.workoutDemo || null;
    const outdoorMode = inferOutdoorTrackerMode(promptText, response.message);
    const spokenMessage = appendWorkoutSectionInvite(response.message, pendingGuide);
    const animationDuration = response.workoutDemo?.sequence?.reduce((sum, step) => {
      const repeatCount = Math.max(1, Number(step?.repeatCount) || 1);
      const stepDuration = typeof step?.duration === 'number'
        ? step.duration
        : getAvatarAnimationDuration(step?.animationType, gender, 900);
      return sum + (stepDuration * repeatCount);
    }, 0) || getAvatarAnimationDuration(response.animation, gender, 1500);

    if (promptText) {
      setLatestUserPrompt(promptText);
    }
    setPendingWorkoutGuide(pendingGuide);
    setPendingOutdoorMode(outdoorMode);
    setCoachExpanded(true);
    if (spokenMessage && spokenMessage !== response.message) {
      response = {
        ...response,
        message: spokenMessage,
      };
    }
    setCoachReplyOverride(response.message || '');

    if (Platform.OS === 'web') {
      queueHomeAvatarAnimation(response.workoutDemo?.animationType || response.animation, animationDuration);
      if (response.message) {
        await avatarRef.current?.speak?.(response.message, { preserveAnimation: Boolean(response.workoutDemo) });
      }
      return;
    }

    if (response.workoutDemo?.sequence?.length) {
      await avatarRef.current?.triggerAnimationSequence?.(response.workoutDemo.sequence);
    } else if (response.animation) {
      await avatarRef.current?.triggerAnimation?.(response.animation, animationDuration);
    }

    if (response.message) {
      avatarRef.current?.speak?.(response.message, { preserveAnimation: Boolean(response.workoutDemo) });
    }
  }, [gender, queueHomeAvatarAnimation]);

  const submitCoachPrompt = useCallback(async (rawPromptText) => {
    const promptText = String(rawPromptText || '').trim();
    if (!promptText || coachThinking) return;

    setCoachPrompt('');

    if (pendingWorkoutGuide && isWorkoutDemoConfirmation(promptText)) {
      setLatestUserPrompt(promptText);
      await playWorkoutGuide(pendingWorkoutGuide);
      return;
    }

    if (isWorkoutStartConfirmation(promptText)) {
      setLatestUserPrompt(promptText);
      if (pendingOutdoorMode) {
        openOutdoorTracker(pendingOutdoorMode);
        return;
      }
      openWorkoutSuggestion(buildAiWorkoutPlanFromGuide(pendingWorkoutGuide) || todayWorkoutPlan);
      return;
    }

    const response = await chat(promptText);
    await applyCoachOutcome(response, promptText);
  }, [applyCoachOutcome, chat, coachThinking, openOutdoorTracker, openWorkoutSuggestion, pendingOutdoorMode, pendingWorkoutGuide, playWorkoutGuide, todayWorkoutPlan]);

  const handleCoachSend = useCallback(async () => {
    await submitCoachPrompt(coachPrompt);
  }, [coachPrompt, submitCoachPrompt]);

  const stopCoachMic = useCallback(async () => {
    const recognition = coachRecognitionRef.current;
    coachRecognitionRef.current = null;
    setCoachListening(false);

    try {
      recognition?.stop?.();
    } catch (_) {}

    try {
      recognition?.abort?.();
    } catch (_) {}

    try {
      await avatarRef.current?.stopMicLipSync?.();
    } catch (_) {}
  }, []);

  const handleCoachMicToggle = useCallback(async () => {
    if (coachThinking) return;

    if (coachListening) {
      await stopCoachMic();
      return;
    }

    setCoachMicError('');

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      const started = await avatarRef.current?.startMicLipSync?.();
      if (started !== false) {
        setCoachListening(true);
      } else {
        setCoachMicError('Microphone access is unavailable on this device right now.');
      }
      return;
    }

    try {
      if (navigator.permissions?.query) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permissionStatus.state === 'denied') {
          setCoachMicError('Microphone access is blocked in this browser. Allow microphone access for localhost and try again.');
          return;
        }
      }
    } catch (_) {}

    const micReady = await avatarRef.current?.startMicLipSync?.();
    if (micReady === false) {
      setCoachMicError('Unable to access the microphone. Check your browser permissions and try again.');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      setCoachListening(true);
      setCoachMicError('Speech recognition is not supported in this browser. You can use the text prompt instead.');
      return;
    }

    let transcript = '';
    const recognition = new SpeechRecognition();
    coachRecognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = async () => {
      setCoachListening(true);
      setCoachMicError('');
      await avatarRef.current?.startMicLipSync?.();
    };

    recognition.onresult = (event) => {
      transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        setCoachPrompt(transcript);
      }
    };

    recognition.onerror = async (event) => {
      console.warn('[HomeScreen] Voice recognition failed:', event?.error || event);
      const errorCode = String(event?.error || '');
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        setCoachMicError('Microphone access is blocked in this browser. Allow microphone access for localhost and try again.');
      } else if (errorCode === 'no-speech') {
        setCoachMicError('No speech was detected. Try speaking a little closer to the microphone.');
      } else if (errorCode) {
        setCoachMicError(`Voice recognition failed: ${errorCode}.`);
      }
      await stopCoachMic();
    };

    recognition.onend = async () => {
      const finalTranscript = transcript.trim();
      coachRecognitionRef.current = null;
      setCoachListening(false);
      await avatarRef.current?.stopMicLipSync?.();
      if (finalTranscript) {
        await submitCoachPrompt(finalTranscript);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn('[HomeScreen] Unable to start voice recognition:', error);
      coachRecognitionRef.current = null;
      setCoachListening(false);
      setCoachMicError('Voice recognition could not start in this browser.');
      await avatarRef.current?.stopMicLipSync?.();
    }
  }, [coachListening, coachThinking, stopCoachMic, submitCoachPrompt]);

  useEffect(() => () => {
    try {
      coachRecognitionRef.current?.abort?.();
    } catch (_) {}
    avatarRef.current?.stopMicLipSync?.();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -20,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  const [showGreeting, setShowGreeting] = useState(true);
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const greetTranslate = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (!showGreeting) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(greetOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(greetTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.delay(1800),
      Animated.parallel([
        Animated.timing(greetOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(greetTranslate, {
          toValue: -6,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start(() => setShowGreeting(false));
  }, [greetOpacity, greetTranslate, showGreeting]);

  const topSweep = useRef(new Animated.Value(0)).current;
  const [topBarWidth, setTopBarWidth] = useState(0);
  const [topBarHeightMeasured, setTopBarHeightMeasured] = useState(0);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(topSweep, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(topSweep, { toValue: 0, duration: 5000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [topSweep]);

  useEffect(() => {
    if (menuVisible) {
      setMenuRendered(true);
      Animated.spring(menuAnim, {
        toValue: 1,
        friction: 8,
        tension: 130,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      return;
    }
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) {
        setMenuRendered(false);
      }
    });
  }, [menuAnim, menuVisible]);

  const goToProfile = () => router.push('/Profile');
  const handleMenuToggle = () => setMenuVisible((visible) => !visible);
  const handlePreviewLevelUp = () => {
    const currentLevel = Math.max(1, Number(level) || 1);
    dispatch(showLevelUpPreview({ level: currentLevel + 1, previousLevel: currentLevel }));
  };
  const handleMenuActionPress = (route) => {
    setMenuVisible(false);
    router.push(route);
  };
  const sessionAwardsByDate = useSelector((state) => state.workouts?.xpAwardedSessionIdsByDate || {});
  useEffect(() => {
    const sessions = sessionsByDate[todayKey] || [];
    const awarded = sessionAwardsByDate[todayKey] || {};
    const xpFromCalories = (c) => {
      if (c >= 500) return 50;
      if (c >= 400) return 35;
      if (c >= 300) return 20;
      return 0;
    };
    sessions.forEach((s) => {
      const already = awarded[s.id];
      const xp = xpFromCalories(Number(s.calories || 0));
      if (!already && xp > 0) {
        dispatch(addXP(xp));
        dispatch(addBadgeXP({
          amount: xp,
          categories: categorizeWorkoutSessionForBadgeXp(s),
        }));
        dispatch(markSessionXPAwarded({ date: todayKey, sessionId: s.id }));
        dispatch(registerWorkoutDay(todayKey));
      }
    });
  }, [sessionsByDate, sessionAwardsByDate, dispatch, todayKey]);

  const layout = useMemo(() => {
    const frameWidth = Math.min(windowWidth, 390);
    const frameHeight = Math.min(windowHeight, 844);
    const frameOffsetX = Math.max(0, (windowWidth - frameWidth) / 2);
    const framedViewport = windowWidth > frameWidth + 40 || windowHeight > frameHeight + 40;
    const smallScreen = true;
    const screenPadding = clamp(frameWidth * 0.024, 10, 16);
    const topBarMarginTop = clamp(frameHeight * 0.022, 12, 22);
    const topBarPaddingX = clamp(frameWidth * 0.022, 12, 16);
    const topBarPaddingY = clamp(frameHeight * 0.012, 8, 12);
    const topBarHeight = Math.max(clamp(frameWidth * 0.065, 44, 52), 44) + (topBarPaddingY * 2);
    const effectiveTopBarHeight = Math.max(topBarHeight, topBarHeightMeasured);
    const topRightDirection = 'row';
    const topRightReserve = 0;
    const heroCardWidth = frameWidth - (screenPadding * 2);
    const utilityRowTop = topBarMarginTop + effectiveTopBarHeight + clamp(frameHeight * 0.012, 8, 10);
    const utilityRowHeight = clamp(frameHeight * 0.044, 32, 38);
    const questWidth = clamp(frameWidth * 0.62, 220, 250);
    const questTriggerWidth = smallScreen ? 40 : questWidth;
    const questTop = utilityRowTop + utilityRowHeight + clamp(frameHeight * 0.008, 6, 10);
    const questMaxHeight = clamp(frameHeight * 0.072, 46, 58);
    const questPanelHeight = smallScreen ? questMaxHeight + 10 : questMaxHeight + 54;
    const mobileQuestBottom = clamp(frameHeight * 0.18, 134, 152);
    const mobileMenuBottom = clamp(frameHeight * 0.13, 92, 112);
    const menuTop = topBarMarginTop + effectiveTopBarHeight + 10;
    const menuTabWidth = clamp(frameWidth * 0.074, 44, 52);
    const menuTabHeight = clamp(frameHeight * 0.032, 24, 28);
    const menuIconSize = clamp(frameWidth * 0.072, 26, 30);
    const menuGap = clamp(frameHeight * 0.006, 4, 6);
    const menuActionSize = menuIconSize + 8;
    const menuItemWidth = menuActionSize + 4;
    const menuItemHeight = menuActionSize + 4;
    const menuPanelWidth = menuItemWidth;
    const menuPanelHeight = (menuActions.length * menuItemHeight) + ((menuActions.length - 1) * menuGap);
    const workoutCardTop = topBarMarginTop + effectiveTopBarHeight + 8;
    const avatarWidth = clamp(frameWidth * 0.72, 246, 292);
    const avatarStageTop = menuTop + menuTabHeight + clamp(frameHeight * 0.012, 8, 12);
    const avatarStageBottom = clamp(frameHeight * 0.05, 34, 42);
    const bottomInsetPx = clamp(frameHeight * 0.0015, 0, 2);
    const topRightTop = utilityRowTop;
    const levelBadgeSize = clamp(frameWidth * 0.068, 40, 46);
    const levelTextSize = clamp(frameWidth * 0.026, 16, 20);
    const levelTextTop = clamp(levelBadgeSize * 0.24, 10, 12);
    const utilityBlockWidth = 74;
    const statsMaxWidth = Math.max(144, heroCardWidth - levelBadgeSize - utilityBlockWidth - (topBarPaddingX * 2) - 22);
    const pointsBarWidth = clamp(statsMaxWidth * 0.78, 126, 164);
    const profileButtonSize = clamp(frameWidth * 0.096, 36, 42);
    const profileAvatarSize = clamp(profileButtonSize * 0.72, 24, 30);
    const topGlowWidth = clamp(frameWidth * 0.24, 110, 150);
    const coachCardBottom = clamp(frameHeight * 0.102, 80, 94);
    return {
      smallScreen,
      frameWidth,
      frameHeight,
      frameOffsetX,
      framedViewport,
      screenPadding,
      topBarMarginTop,
      topBarPaddingX,
      topBarPaddingY,
      topBarHeight,
      effectiveTopBarHeight,
      topRightDirection,
      topRightReserve,
      heroCardWidth,
      utilityRowTop,
      utilityRowHeight,
      questWidth,
      questTriggerWidth,
      questTop,
      questMaxHeight,
      questPanelHeight,
      mobileQuestBottom,
      menuTop,
      menuTabWidth,
      menuTabHeight,
      menuIconSize,
      menuGap,
      menuPanelWidth,
      menuItemWidth,
      menuActionSize,
      menuItemHeight,
      menuPanelHeight,
      avatarWidth,
      workoutCardTop,
      avatarStageTop,
      avatarStageBottom,
      bottomInsetPx,
      topRightTop,
      levelBadgeSize,
      levelTextSize,
      levelTextTop,
      statsMaxWidth,
      pointsBarWidth,
      profileButtonSize,
      profileAvatarSize,
      topGlowWidth,
      mobileMenuBottom,
      coachCardBottom,
      compactMeta: windowWidth < 640,
    };
  }, [menuActions.length, topBarHeightMeasured, windowHeight, windowWidth]);

  const normalizedCoachError = String(coachError || '').toLowerCase();
  const coachSummary = coachError
    ? normalizedCoachError.includes('denied access') || normalizedCoachError.includes('403')
      ? 'Gemini access is denied for Home coach. Enable the Generative Language API in the same Google Cloud project, allow it in the key restrictions, and rotate the key if it was exposed.'
      : normalizedCoachError.includes('api key')
        ? 'Home coach could not find a Gemini API key at runtime. Restart Expo after updating the env so the key is loaded.'
        : 'Home coach could not reach Gemini right now. Check your network or service configuration and try again.'
    : coachMicError
      ? coachMicError
    : aiResponse || 'Ask Bodify for a quick nudge, a short workout, or what to do next based on today\'s progress.';
  const coachStatusChip = coachError
    ? {
        icon: '⚠️',
        label: normalizedCoachError.includes('denied access') || normalizedCoachError.includes('403')
          ? 'No access'
          : normalizedCoachError.includes('api key')
            ? 'No key'
            : 'Offline',
        style: styles.coachStatusChipAlert,
      }
    : coachMicError
      ? { icon: '🚫', label: 'Mic off', style: styles.coachStatusChipAlert }
      : coachListening
        ? { icon: '🎙️', label: 'Listening', style: styles.coachStatusChipLive }
        : coachThinking
          ? { icon: '✨', label: 'Thinking', style: styles.coachStatusChipIdle }
          : { icon: '🟢', label: 'Ready', style: styles.coachStatusChipLive };
  const latestCoachReply = conversationHistory.length > 0
    ? [...conversationHistory].reverse().find((entry) => entry.role === 'ai')?.message || coachSummary
    : coachSummary;
  const resolvedCoachReply = String(coachReplyOverride || latestCoachReply || coachSummary).trim() || coachSummary;
  const isDemoHomeState = !String(avatarName || '').trim()
    && Math.max(1, Math.floor(Number(level) || 1)) === 1
    && Math.max(0, Math.floor(Number(points) || 0)) === 0
    && Math.max(0, Math.floor(Number(energy) || 0)) === 0;
  const displayName = isDemoHomeState ? 'temuulen' : (avatarName || 'Player');
  const displayLevel = isDemoHomeState ? 2 : level;
  const displayPoints = isDemoHomeState ? 11 : points;
  const displayPointsMax = isDemoHomeState ? 110 : pointsMax;
  const energyDisplay = isDemoHomeState ? 25 : Math.max(0, Math.floor(Number(energy) || 0));
  const streakDisplay = isDemoHomeState ? 1 : Math.max(0, Math.floor(Number(streakCount) || 0));
  const displayWorkoutTitle = isDemoHomeState ? "Today's Cardio Reset" : todayWorkoutPlan.title;
  const displayCoachReply = isDemoHomeState && conversationHistory.length === 0
    ? "Try a 5-minute session: 1 minute warm-up, then 4 minutes rotating squats, incline push-ups, and a plank with short rests. Keep the pace steady and stop if your form slips. If you want, I can do this together with you in Workout. Say \"let's do it\"."
    : resolvedCoachReply;
  const displayLastAsk = latestUserPrompt
    ? `You asked: ${latestUserPrompt}`
    : isDemoHomeState
      ? 'You asked: give me 5 min beginner workout plan'
      : 'You asked: try a quick action or ask for a short plan';
  const homeAvatarExpression = useMemo(() => {
    const normalizedEmotion = String(currentEmotion || '').toLowerCase();

    if (normalizedEmotion.includes('joy') || normalizedEmotion.includes('happy') || normalizedEmotion.includes('fun')) {
      return { name: 'happy', value: 0.55 };
    }
    if (normalizedEmotion.includes('sad') || normalizedEmotion.includes('sorrow')) {
      return { name: 'sad', value: 0.5 };
    }
    if (normalizedEmotion.includes('surpris')) {
      return { name: 'surprised', value: 0.5 };
    }
    if (normalizedEmotion.includes('look') || normalizedEmotion.includes('think') || coachThinking) {
      return { name: 'relaxed', value: 0.38 };
    }

    return null;
  }, [coachThinking, currentEmotion]);

  return (
    <View style={styles.container}>
      <View style={[styles.viewportFrame, { width: layout.frameWidth, height: layout.frameHeight }, layout.framedViewport && styles.viewportFrameDesktop]}>
      <Image
        source={require('../assets/images/homescreen.png')}
        style={styles.background}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(79,142,247,0.20)", "rgba(0,0,0,0.25)"]}
        start={{x:0.5, y:0}}
        end={{x:0.5, y:1}}
        style={styles.gradientOverlay}
      />

      <LinearGradient
        colors={["#4C3BFF", "#7A13FF", "#1FC7F7"]}
        start={{x:0,y:0}}
        end={{x:1,y:1}}
        style={[
          styles.topBar,
          {
            marginTop: layout.topBarMarginTop,
            marginLeft: layout.screenPadding,
            marginRight: layout.screenPadding + layout.topRightReserve,
            paddingHorizontal: layout.topBarPaddingX,
            paddingVertical: layout.topBarPaddingY,
            width: layout.heroCardWidth,
          },
        ]}
        onLayout={(e) => {
          setTopBarWidth(e.nativeEvent.layout.width);
          setTopBarHeightMeasured(e.nativeEvent.layout.height);
        }}
      >
        {topBarWidth > 0 && (
          <Animated.View
            style={[
              styles.topGlowSweep,
              { width: layout.topGlowWidth },
              { pointerEvents: 'none' }, // TODO: Move pointerEvents to style if needed for web
              {
                transform: [
                  {
                    translateX: topSweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-topBarWidth * 0.5, topBarWidth * 0.5],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(0,231,255,0)',
                'rgba(0,231,255,0.35)',
                'rgba(0,231,255,0)',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}
        <View style={styles.levelBadgeContainer}>
          <Svg height={layout.levelBadgeSize} width={layout.levelBadgeSize} viewBox="0 0 48 48">
            <Polygon
              points="24,4 44,14 44,34 24,44 4,34 4,14"
              fill="rgba(0,0,0,0.35)"
              stroke="rgba(0,231,255,0.75)"
              strokeWidth="1.5"
            />
          </Svg>
          <Text style={[styles.levelText, { top: layout.levelTextTop, fontSize: layout.levelTextSize }]}>{displayLevel}</Text>
          <TouchableOpacity style={styles.levelPreviewButton} activeOpacity={0.85} onPress={handlePreviewLevelUp}>
            <Text style={styles.levelPreviewButtonText}>Preview</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.statsContainer, { maxWidth: layout.statsMaxWidth }] }>
          <Text style={[styles.h3Title, layout.smallScreen && styles.h3TitleCompact, { maxWidth: layout.statsMaxWidth }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.statsPoints, layout.smallScreen && styles.statsPointsCompact, {color:'#E8F9FF', opacity: 0.95}]} numberOfLines={1}>{displayPoints}/{displayPointsMax} XP</Text>
          <View style={[styles.pointsBarBg, { width: layout.pointsBarWidth }]}>
            <LinearGradient
              colors={["#00E7FF", "#6A00FF"]}
              start={{x:0,y:0}}
              end={{x:1,y:0}}
              style={[styles.pointsBarFill, { width: `${Math.min(100, Math.round((displayPoints/Math.max(1,displayPointsMax))*100))}%` }]}
            />
          </View>
          <View style={[styles.statsMetaRow, layout.compactMeta && styles.statsMetaRowCompact]}>
            <TouchableOpacity style={[styles.statsMetaPill, styles.statsMetaPillInteractive]} activeOpacity={0.85} onPress={() => setMobileQuestOpen(true)}>
              <Text style={[styles.treasureIcon, styles.statsMetaQuestIcon, canClaimTreasure ? styles.treasureIconActive : styles.treasureIconInactive]}>
                {treasureClaimed && treasureClaimedAt && (Date.now() - treasureClaimedAt <= 24 * 60 * 60 * 1000) ? '🎉' : '🪙'}
              </Text>
              <Text style={styles.statsMetaPillText}>{completedQuestCount}/{dailyQuests.length} quests</Text>
            </TouchableOpacity>
            <View style={styles.statsMetaPill}>
              <Text style={styles.statsMetaPillText}>{`${Math.max(1, streakDisplay)} day streak`}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.userUtilitySection, layout.smallScreen && styles.userUtilitySectionCompact]}>
          <TouchableOpacity onPress={goToProfile} style={[styles.utilityProfileCard, layout.smallScreen && styles.utilityProfileCardCompact]} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.profileRing}>
              <View style={[styles.profileButton, { width: layout.profileButtonSize, height: layout.profileButtonSize, borderRadius: layout.profileButtonSize / 2 }]}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={[
                      styles.profileAvatar,
                      styles.profileAvatarPhoto,
                      {
                        width: layout.profileAvatarSize,
                        height: layout.profileAvatarSize,
                        borderRadius: layout.profileAvatarSize / 2,
                      },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.profileAvatarFallbackText}>
                    {String(displayName || 'P').trim().charAt(0).toUpperCase() || 'P'}
                  </Text>
                )}
              </View>
            </LinearGradient>
            <Text style={[styles.utilityProfileTopLabel, styles.utilityProfileLabelBelow, layout.smallScreen && styles.utilityProfileTopLabelCompact]}>Profile</Text>
            <View style={styles.utilityProfileMeta}>
              <View style={styles.utilityWalletChip}>
                <Text style={styles.utilityWalletText}>{`🔥 ${energyDisplay}`}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {workoutSuggestionExpanded ? (
        <View
          style={[
            styles.todayWorkoutCard,
            styles.todayWorkoutExpandedCard,
            {
              top: layout.workoutCardTop,
              right: layout.screenPadding,
              width: layout.smallScreen ? 172 : 184,
            },
          ]}
        >
          <View style={styles.todayWorkoutExpandedHeader}>
            <Text style={styles.todayWorkoutCompactLabel}>Workout</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setWorkoutSuggestionExpanded(false)} style={styles.todayWorkoutCloseButton}>
              <Text style={styles.todayWorkoutCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.todayWorkoutExpandedTitle} numberOfLines={2}>{displayWorkoutTitle}</Text>
          <Text style={styles.todayWorkoutSummary} numberOfLines={3}>{todayWorkoutPlan.summary}</Text>
          <View style={styles.todayWorkoutPreviewList}>
            {todayWorkoutPlan.exercises.slice(0, 3).map((exercise) => (
              <View key={exercise.label} style={styles.todayWorkoutPreviewChip}>
                <Text style={styles.todayWorkoutPreviewChipText}>{getWorkoutPreviewEmoji(exercise.label)} {exercise.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setWorkoutSuggestionExpanded(false);
              openWorkoutSuggestion(todayWorkoutPlan);
            }}
            style={styles.todayWorkoutActionButton}
          >
            <Text style={styles.todayWorkoutActionButtonText}>Go workout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setWorkoutSuggestionExpanded(true)}
          style={[
            styles.todayWorkoutCard,
            styles.todayWorkoutCompactCard,
            {
              top: layout.workoutCardTop,
              right: layout.screenPadding,
            },
          ]}
        >
          <Text style={styles.todayWorkoutCompactLabel}>Today&apos;s{`\n`}Workout</Text>
          <Text style={styles.todayWorkoutCompactValue} numberOfLines={1}>{todayWorkoutPlan.durationMin} min</Text>
          <Text style={styles.todayWorkoutCompactHint}>tap</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.room, { top: layout.avatarStageTop, bottom: layout.avatarStageBottom }] }>
        <View style={[styles.avatarAnchor, { width: layout.avatarWidth, height: '100%' }] }>
          {Platform.OS === 'web' ? (
            <AvatarWeb
              ref={avatarRef}
              gender={gender}
              height={height}
              weight={weight}
              modelUrl={selectedAvatarUrl || avatarModel}
              sizeMultiplier={1}
              scaleBoost={1}
              animationSpeed={0.72}
              xOffset={0}
              yOffset={-0.085}
              alignFootToBottom
              bottomPadding={0.002}
              bottomInsetPx={layout.bottomInsetPx}
              headMargin={0.12}
              autoFit
              focus="upper"
              fitMode="tight"
              targetFill={0.75}
              footLift={0}
              initialTheta={-0.22}
              initialPhi={Math.PI / 2 - 0.08}
              animationType={homeAvatarAnimation || activeIdleAnimation}
              expressionName={homeAvatarExpression?.name}
              expressionValue={homeAvatarExpression?.value}
            />
          ) : selectedAvatarUrl ? (
            <InteractiveAvatar
              ref={avatarRef}
              model={selectedAvatarUrl}
              height={height}
              weight={weight}
              gender={gender}
              photoUri={photoUri}
              enableVoice={true}
              enableTTS={true}
              restingAnimation={activeIdleAnimation}
            />
          ) : (
            <InteractiveAvatar
              ref={avatarRef}
              model={avatarModel}
              height={height}
              weight={weight}
              gender={gender}
              photoUri={photoUri}
              sizeMultiplier={1.2}
              enableVoice={true}
              enableTTS={true}
              restingAnimation={activeIdleAnimation}
            />
          )}
        </View>
      </View>

      {coachExpanded ? (
        <View
          style={[
            styles.coachBubble,
            {
              left: layout.screenPadding + 18,
              right: layout.screenPadding + 18,
              bottom: layout.coachCardBottom,
            },
          ]}
        >
          <View style={styles.coachBubbleHeader}>
            <View style={styles.coachBubbleTitleWrap}>
              <Text style={styles.coachBubbleTitle}>Coach mode</Text>
              <Text style={styles.coachBubbleSubtitle}>💬 Ask, plan, go</Text>
            </View>
            <View style={styles.coachControlsRow}>
              <View style={[styles.coachStatusChip, coachStatusChip.style]}>
                <Text style={styles.coachStatusChipText}>{coachStatusChip.icon} {coachStatusChip.label}</Text>
              </View>
              <TouchableOpacity onPress={handleCoachMicToggle} activeOpacity={0.85} style={styles.coachIconAction}>
                <Text style={styles.coachIconActionText}>{coachListening ? '⏹️' : '🎙️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  resetConversation();
                  setPendingWorkoutGuide(null);
                  setPendingOutdoorMode(null);
                  setLatestUserPrompt('');
                  setCoachReplyOverride('');
                  setHomeAvatarAnimation(null);
                }}
                activeOpacity={0.85}
                style={styles.coachIconAction}
              >
                <Text style={styles.coachIconActionText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCoachExpanded(false)} activeOpacity={0.85} style={styles.coachIconAction}>
                <Text style={styles.coachIconActionText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.coachBubbleBodyScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Text style={styles.coachBubbleBody}>{coachThinking ? 'Thinking...' : displayCoachReply}</Text>
          </ScrollView>

          <Text style={styles.coachLastAskText} numberOfLines={1}>
            {displayLastAsk}
          </Text>

          <View style={styles.coachPromptRow}>
            <TextInput
              value={coachPrompt}
              onChangeText={setCoachPrompt}
              placeholder="Ask anything..."
              placeholderTextColor="rgba(232,249,255,0.42)"
              style={styles.coachPromptInput}
              onSubmitEditing={handleCoachSend}
              returnKeyType="send"
            />
            <TouchableOpacity onPress={handleCoachSend} activeOpacity={0.88} style={styles.coachSendButton}>
              <Text style={styles.coachSendButtonText}>🚀</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.coachBubbleTail} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setCoachExpanded(true)}
          style={[
            styles.coachThoughtButton,
            {
              left: layout.screenPadding,
              top: layout.menuTop + layout.menuTabHeight + layout.menuPanelHeight + 18,
            },
          ]}
        >
          <Text style={styles.coachThoughtLabel}>AI Coach</Text>
          <Text style={styles.coachThoughtStatus}>{coachThinking ? 'Thinking…' : 'Tap to chat'}</Text>
        </TouchableOpacity>
      )}

      {mobileQuestOpen ? (
        <View style={styles.mobileQuestOverlay}>
          <TouchableOpacity style={styles.mobileQuestBackdrop} activeOpacity={1} onPress={() => setMobileQuestOpen(false)} />
          <View style={[styles.mobileQuestSheetWrap, !layout.smallScreen && styles.desktopQuestSheetWrap]}>
            <View style={styles.mobileQuestSheet}>
              <View style={styles.questCompactTopRow}>
                <View style={styles.questSectionHeaderMain}>
                  <TouchableOpacity
                    style={styles.treasureIconButton}
                    disabled={!canClaimTreasure}
                    onPress={() => {
                      if (canClaimTreasure) {
                        setTreasureClaimed(true);
                        setTreasureClaimedAt(Date.now());
                        setUsd(usd + 1);
                      }
                    }}
                  >
                    <Text style={[
                      styles.treasureIcon,
                      canClaimTreasure ? styles.treasureIconActive : styles.treasureIconInactive
                    ]}>
                      {treasureClaimed && treasureClaimedAt && (Date.now() - treasureClaimedAt <= 24 * 60 * 60 * 1000) ? '🎉' : '🪙'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.questCompactLabel}>Daily quests</Text>
                </View>
                <TouchableOpacity onPress={() => setMobileQuestOpen(false)} style={styles.mobileQuestCloseButton} activeOpacity={0.85}>
                  <Text style={styles.mobileQuestCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.questCompactSummaryRow}>
                <Text style={styles.questCompactSummaryText}>{questCompletionPct}% complete</Text>
                <Text style={styles.questCompactSummaryText}>{totalQuestXP} XP</Text>
              </View>
              <ScrollView style={styles.mobileQuestListScroll} contentContainerStyle={styles.questCompactList} showsVerticalScrollIndicator={false}>
                {dailyQuests.map((q, i) => {
                  const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                  return (
                    <View key={i} style={[styles.questItemPill, styles.questPillSingle, styles.questCompactListItem]}>
                      <View style={styles.questPillHeaderRow}>
                        <View style={styles.questTitleWrap}>
                          <Text style={styles.questEmoji}>{q.icon}</Text>
                          <Text style={styles.questTitle} numberOfLines={1}>{q.shortTitle}</Text>
                        </View>
                        <Text style={styles.questReward}>{q.reward}</Text>
                      </View>
                      <View style={styles.questProgressBarBg}>
                        <LinearGradient
                          colors={[COLORS.neonCyan, COLORS.neonPurple]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.questProgressBarFill, { width: `${pct}%` }]}
                        />
                      </View>
                      <View style={styles.questFooterRow}>
                        <Text style={styles.questProgressText}>{q.progress} / {q.goal}</Text>
                        <Text style={styles.questStatusText}>{pct >= 100 ? 'Complete' : `${pct}%`}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.menuTabContainer, { left: layout.screenPadding, top: layout.menuTop, width: layout.menuTabWidth + 10 }]}>
        <TouchableOpacity onPress={handleMenuToggle}>
          <View style={[styles.menuTabButton, { width: layout.menuTabWidth, height: layout.menuTabHeight }]}>
            <View style={styles.menuTabInnerRow}>
              <MenuGlyph open={menuVisible} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
      {menuRendered && (
        <View style={[styles.menuStackedAll, { left: layout.screenPadding, top: layout.menuTop + layout.menuTabHeight + 8, width: layout.menuPanelWidth, height: layout.menuPanelHeight, pointerEvents: menuVisible ? 'box-none' : 'none' }]}>
          {menuActions.map((action, index) => {
            const revealStart = index * 0.08;
            const revealEnd = Math.min(1, revealStart + 0.26);
            const itemProgress = menuAnim.interpolate({
              inputRange: [revealStart, revealEnd],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            });
            const targetLeft = 0;
            const targetTop = index * (layout.menuItemHeight + layout.menuGap);
            return (
              <Animated.View
                key={action.route}
                style={[
                  styles.menuStackedItem,
                  {
                    width: layout.menuItemWidth,
                    left: targetLeft,
                    top: targetTop,
                    opacity: itemProgress,
                    transform: [
                      {
                        translateX: itemProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                      {
                        translateY: itemProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-(targetTop + layout.menuTabHeight + 10), 0],
                        }),
                      },
                      {
                        scale: itemProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.6, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => handleMenuActionPress(action.route)}
                  style={styles.menuActionPressable}
                >
                  <View style={[styles.menuActionOuter, { width: layout.menuActionSize, height: layout.menuActionSize, borderRadius: layout.menuActionSize / 2 }]}>
                    <LinearGradient colors={["#8A00FF", "#FF00E5"]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.menuActionInner, { width: layout.menuIconSize, height: layout.menuIconSize, borderRadius: layout.menuIconSize / 2 }]}>
                      <Text style={styles.menuIcon}>{action.icon}</Text>
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  questSectionContainer: {
    position: 'absolute',
    zIndex: 25,
    borderRadius: 22,
    padding: 1,
  },
  questCardInner: {
    backgroundColor: 'rgba(8,12,28,0.62)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.35)',
    ...Platform.select({
      boxShadow: '0px 16px 32px rgba(3,8,24,0.28)',
      shadowColor: '#040814',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 10,
    }),
  },
  questCompactCard: {
    gap: 6,
  },
  questCompactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questCompactSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  questCompactSummaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(232,249,255,0.72)',
  },
  questCompactList: {
    gap: 6,
  },
  questCompactListItem: {
    marginBottom: 0,
  },
  mobileQuestOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    justifyContent: 'flex-end',
  },
  mobileQuestBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 8, 24, 0.46)',
  },
  mobileQuestSheetWrap: {
    paddingHorizontal: 16,
    paddingBottom: 106,
  },
  desktopQuestSheetWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 28,
    paddingRight: 28,
    paddingBottom: 0,
  },
  mobileQuestSheet: {
    backgroundColor: 'rgba(8,12,28,0.96)',
    borderRadius: 24,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.35)',
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      boxShadow: '0px 18px 36px rgba(3,8,24,0.44)',
      shadowColor: '#040814',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.34,
      shadowRadius: 24,
      elevation: 12,
    }),
  },
  mobileQuestCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mobileQuestCloseText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  mobileQuestListScroll: {
    maxHeight: 250,
  },
  questCompactBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  questCompactLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  questCompactMeta: {
    color: 'rgba(232,249,255,0.78)',
    fontSize: 11,
    fontWeight: '800',
  },
  questSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    minHeight: 1,
  },
  questSectionHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  treasureIconButton: {
    marginRight: 4,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
  },
  treasureIcon: {
    fontSize: 20,
    marginRight: 2,
    marginLeft: 2,
    ...Platform.select({
      textShadow: '0px 1px 2px #FFD700',
      textShadowColor: '#FFD700',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    }),
  },
  treasureIconActive: {
    opacity: 1,
    color: '#FFD700',
  },
  treasureIconInactive: {
    opacity: 0.4,
    color: '#aaa',
  },
  questSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4F8EF7',
    letterSpacing: 0.4,
  },
  questTitlePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  questCountPill: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  questCountPillText: {
    color: '#E8F9FF',
    fontSize: 11,
    fontWeight: '800',
  },
  questSectionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  questSectionSummaryText: {
    color: 'rgba(232,249,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  questSectionBody: { marginTop: 0, marginBottom: 0 },
  questListContent: { paddingBottom: 4 },
  questSectionSummary: { marginTop: 2, marginBottom: 1 },
  questItemPill: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.28)', marginBottom: 8 },
  questPillSingle: { width: '100%' },
  questPillHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  questTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  questEmoji: {
    fontSize: 13,
    marginRight: 6,
  },
  questTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 0,
  },
  questProgressBarBg: { width: '100%', height: 6, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 4, overflow: 'hidden', marginVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  questProgressBarFill: {
    height: 6,
    borderRadius: 4,
  },
  questProgressText: {
    fontSize: 10,
    color: '#e9f1ff',
    fontWeight: '700',
    marginBottom: 0,
  },
  questFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  questStatusText: {
    fontSize: 10,
    color: 'rgba(232,249,255,0.72)',
    fontWeight: '700',
  },
  questReward: {
    fontSize: 10,
    color: '#d9ffd6',
    fontWeight: '800',
    marginTop: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(56,255,146,0.12)',
  },
  menuTabContainer: {
    position: 'absolute',
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 18, 54, 0.42)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(140, 203, 255, 0.22)',
    ...Platform.select({
      boxShadow: '0px 0px 16px rgba(122, 92, 255, 0.16)',
      shadowColor: '#7A5CFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 3,
    }),
  },
  menuTabInnerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  menuGlyphList: {
    justifyContent: 'center',
    gap: 4,
  },
  menuGlyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuGlyphDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginRight: 5,
    backgroundColor: '#86B7FF',
    ...Platform.select({
      boxShadow: '0px 0px 8px rgba(134,183,255,0.92)',
      shadowColor: '#86B7FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.92,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  menuGlyphLine: {
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#A784FF',
    ...Platform.select({
      boxShadow: '0px 0px 10px rgba(167,132,255,0.95)',
      shadowColor: '#A784FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 10,
      elevation: 4,
    }),
  },
  menuGlyphThreeDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuGlyphOpenDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#A784FF',
    ...Platform.select({
      boxShadow: '0px 0px 8px rgba(167,132,255,0.92)',
      shadowColor: '#A784FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.92,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(125,182,255,0.35)',
    ...Platform.select({
      web: { boxShadow: '0px 18px 32px rgba(17,20,60,0.38)' },
      default: {
        shadowColor: '#12163D',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 10,
      },
    }),
    zIndex: 10,
    opacity: 0.99,
    overflow: 'hidden',
  },
  topGlowSweep: {
    position: 'absolute',
    left: '50%',
    top: 0,
    height: '100%',
    opacity: 0.8,
  },
  levelBadgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  levelPreviewButton: {
    marginTop: 6,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelPreviewButtonText: {
    color: '#F6FAFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  levelText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '900',
    color: '#fff',
    ...Platform.select({
      textShadow: '0px 1px 2px rgba(34,34,34,0.85)',
      textShadowColor: '#222',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    })
  },
  statsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },
  h3Title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#E8F9FF',
    marginBottom: 2,
    ...Platform.select({
      textShadow: '0px 1px 3px rgba(0,0,0,0.35)',
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    }),
  },
  h3TitleCompact: {
    fontSize: 16,
    marginBottom: 1,
  },
  statsText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4F8EF7',
    marginBottom: 2,
  },
  statsPoints: {
    fontSize: 11,
    color: '#F5FBFF',
    fontWeight: '800',
    marginBottom: 6,
  },
  statsPointsCompact: {
    fontSize: 10,
    marginBottom: 5,
  },
  statsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statsMetaRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statsMetaPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  statsMetaPillInteractive: {
    paddingRight: 12,
  },
  statsMetaPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statsMetaQuestIcon: {
    fontSize: 10,
    lineHeight: 10,
    marginRight: 5,
  },
  statsHint: {
    flex: 1,
    color: 'rgba(232,249,255,0.72)',
    fontSize: 10,
    fontWeight: '600',
  },
  pointsBarBg: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pointsBarFill: {
    height: 8,
    borderRadius: 6,
  },
  topBarRight: {
    position: 'absolute',
    zIndex: 10,
  },
  mobileStepsWidget: {
    marginLeft: 0,
  },
  desktopStepsWidget: {
    marginLeft: 0,
  },
  userUtilitySection: {
    marginLeft: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  userUtilitySectionCompact: {
    marginLeft: 8,
  },
  utilityProfileCard: {
    alignItems: 'center',
    gap: 5,
  },
  utilityProfileCardCompact: {
    gap: 4,
  },
  utilityProfileTopLabel: {
    color: '#E8F9FF',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  utilityProfileTopLabelCompact: {
    fontSize: 9,
  },
  utilityProfileLabelBelow: {
    marginTop: 2,
  },
  utilityProfileMeta: {
    alignItems: 'center',
    gap: 4,
  },
  utilityProfileLabel: { color: '#fff', fontWeight: '700', fontSize: 12, marginTop: 3 },
  utilityProfileLabelDesktopCompact: { fontSize: 11, marginTop: 2 },
  utilityWalletChip: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 44, 81, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(137,219,255,0.24)',
    alignItems: 'center',
  },
  utilityWalletText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 9,
  },
  profileSection: { marginLeft: 10, alignItems: 'center' },
  profileSectionInline: { marginLeft: 12 },
  profileSectionStacked: { marginLeft: 0, marginTop: 10 },
  profileTouch: { alignItems: 'center' },
  profileRing: { borderRadius: 999, padding: 2.5 },
  profileButton: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {},
  profileAvatarPhoto: {
    overflow: 'hidden',
  },
  profileAvatarFallbackText: {
    color: '#F7FBFF',
    fontSize: 13,
    fontWeight: '800',
  },
  todayWorkoutCard: {
    position: 'absolute',
    zIndex: 18,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: 'rgba(10, 17, 43, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(86, 214, 255, 0.38)',
    ...Platform.select({
      web: { boxShadow: '0px 16px 28px rgba(3,8,24,0.34)' },
      default: { shadowColor: '#040814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 10 },
    }),
  },
  todayWorkoutCompactCard: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  todayWorkoutExpandedCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  todayWorkoutExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  todayWorkoutCompactLabel: {
    color: 'rgba(232,249,255,0.68)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  todayWorkoutCompactValue: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  todayWorkoutCompactHint: {
    color: '#00E7FF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  todayWorkoutCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  todayWorkoutCloseText: {
    color: '#F5FBFF',
    fontSize: 12,
    fontWeight: '800',
  },
  todayWorkoutExpandedTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  todayWorkoutSummary: {
    color: 'rgba(232,249,255,0.76)',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  todayWorkoutPreviewList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  todayWorkoutPreviewChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(86,214,255,0.18)',
  },
  todayWorkoutPreviewChipText: {
    color: '#F3FAFF',
    fontSize: 9,
    fontWeight: '800',
  },
  todayWorkoutActionButton: {
    minHeight: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,231,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.32)',
    marginTop: 10,
  },
  todayWorkoutActionButtonText: {
    color: '#EFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  todayWorkoutDotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 5,
  },
  todayWorkoutDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  todayWorkoutLabel: {
    color: '#F3FAFF',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  todayWorkoutTapHint: {
    color: '#00E7FF',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
  },
  todayWorkoutTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  coachThoughtButton: {
    position: 'absolute',
    zIndex: 22,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(10, 16, 36, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.34)',
    alignItems: 'flex-start',
    ...Platform.select({
      web: { boxShadow: '0px 12px 24px rgba(3,8,24,0.34)' },
      default: { shadowColor: '#040814', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 22, elevation: 10 },
    }),
  },
  coachThoughtLabel: {
    color: '#00E7FF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  coachThoughtStatus: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  coachBubble: {
    position: 'absolute',
    zIndex: 24,
    borderRadius: 20,
    padding: 10,
    backgroundColor: 'rgba(10, 13, 52, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(26, 205, 255, 0.42)',
    ...Platform.select({
      web: { boxShadow: '0px 18px 34px rgba(3,8,24,0.4)' },
      default: { shadowColor: '#040814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12 },
    }),
  },
  coachBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  coachBubbleTitleWrap: {
    flex: 1,
    flexShrink: 1,
  },
  coachControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  coachBubbleTitle: {
    color: '#F8FBFF',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  coachBubbleSubtitle: {
    marginTop: 2,
    color: 'rgba(232,249,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  coachStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  coachStatusChipLive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  coachStatusChipIdle: {
    backgroundColor: 'rgba(0,231,255,0.12)',
    borderColor: 'rgba(0,231,255,0.28)',
  },
  coachStatusChipAlert: {
    backgroundColor: 'rgba(255,107,107,0.14)',
    borderColor: 'rgba(255,107,107,0.28)',
  },
  coachStatusChipText: {
    color: '#EFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  coachIconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: { boxShadow: '0px 6px 14px rgba(0,0,0,0.12)' },
      default: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  coachIconActionText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  coachStatusRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  coachStatusMeta: {
    color: 'rgba(232,249,255,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  coachDemoChip: {
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,231,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.28)',
  },
  coachDemoChipText: {
    color: '#8EF2FF',
    fontSize: 11,
    fontWeight: '800',
  },
  coachBubbleBody: {
    color: '#F7FBFF',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  coachBubbleBodyScroll: {
    marginTop: 8,
    maxHeight: 150,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(25,205,255,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coachLastAskText: {
    marginTop: 8,
    color: 'rgba(232,249,255,0.62)',
    fontSize: 11,
    fontWeight: '600',
  },
  coachPromptRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachPromptInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.28)',
  },
  coachSendButton: {
    minWidth: 52,
    minHeight: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,155,215,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.3)',
  },
  coachSendButtonText: {
    color: '#EFFFFF',
    fontSize: 16,
  },
  coachBubbleTail: {
    position: 'absolute',
    left: '50%',
    bottom: -11,
    width: 20,
    height: 20,
    marginLeft: -10,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(10, 13, 52, 0.92)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(26, 205, 255, 0.42)',
  },
  coachStrip: {
    position: 'absolute',
    zIndex: 14,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(8, 12, 28, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.34)',
    ...Platform.select({
      web: { boxShadow: '0px 18px 36px rgba(3,8,24,0.34)' },
      default: { shadowColor: '#040814', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.34, shadowRadius: 24, elevation: 12 },
    }),
  },
  coachStripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  coachStripEyebrow: {
    color: 'rgba(0,231,255,0.78)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  coachStripTitle: {
    marginTop: 2,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  coachOpenButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coachOpenButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  coachStripBody: {
    marginTop: 10,
    color: 'rgba(232,249,255,0.92)',
    fontSize: 12,
    lineHeight: 18,
    minHeight: 38,
  },
  coachActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coachActionChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  coachActionChipDisabled: {
    opacity: 0.6,
  },
  coachActionChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  profileLabel: { color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 4 },
  room: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  avatarAnchor: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 3,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
    alignItems: 'center',
    overflow: 'hidden',
  },
  viewportFrame: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0b1020',
  },
  viewportFrameDesktop: {
    marginVertical: 12,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({
      web: { boxShadow: '0px 18px 48px rgba(0,0,0,0.38)' },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.38, shadowRadius: 32, elevation: 18 },
    }),
  },
  menuWrapper: {
    position: 'absolute',
    right: 18,
    top: 160,
  },
  menuStackedAll: {
    position: 'absolute',
    zIndex: 20,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  menuStackedItem: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  menuActionPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  menuActionOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,231,255,0.52)',
    backgroundColor: 'rgba(0,231,255,0.1)',
    ...Platform.select({
      web: { boxShadow: '0px 0px 18px rgba(0,231,255,0.24)' },
      default: { shadowColor: '#00E7FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 6 },
    }),
  },
  menuActionInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 15,
  },
});

export default HomeScreen;
