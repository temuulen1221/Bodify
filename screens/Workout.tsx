import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import InteractiveAvatar from '../components/InteractiveAvatar';
import { listBodyParts, listByBodyPart, searchExercises } from '../services/exercisedb';
import { fetchRecentActivities, getStoredToken, signInWithStrava } from '../services/strava';
import { addBadgeXP, addWorkoutSession, addXP, setPoseExercise } from '../store';
import { AVATAR_ANIMATIONS, getAvatarAnimationDuration, resolveAvatarAnimationConfig, WORKOUT_ANIMATION_TYPES } from '../utils/avatarAnimationConfig';
import { resolveAvatarModelSelection } from '../utils/avatarModels';
import { getPoseExerciseForAnimation } from '../utils/poseExerciseConfig';

const PREVIEW_LOOP_REPEAT_COUNT = 999;
const WORKOUT_ANIMATION_TYPE_SET = new Set(WORKOUT_ANIMATION_TYPES.map((value) => String(value || '').toLowerCase()));

const normalizeAnimationLookupValue = (value: any): string => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const buildAnimationLookupCandidates = (value: any): string[] => {
  const base = normalizeAnimationLookupValue(value);
  if (!base) return [];

  const variants = new Set([base]);

  if (base.endsWith('es')) variants.add(base.slice(0, -2));
  if (base.endsWith('s')) variants.add(base.slice(0, -1));

  return Array.from(variants).filter(Boolean);
};

const createEditableWorkoutPlan = () => ({
  title: 'Workout Plan',
  summary: 'Build a workout by adding exercises below or jump in from Today\'s Workout.',
  durationMin: 0,
  exercises: [] as any[],
});

const SAMPLE_ASSET_WORKOUTS = [
  {
    key: 'starter-flow',
    title: 'Starter Flow',
    level: 'Beginner',
    focus: 'Full Body',
    summary: 'Fast full-body starter built from pose-ready avatar assets.',
    durationMin: 8,
    exercises: [
      { label: 'Warm-Up', animationType: AVATAR_ANIMATIONS.WARMUP, demoLabel: 'Warm-Up Demo' },
      { label: 'Jumping Jacks', animationType: AVATAR_ANIMATIONS.JUMPING_JACKS, demoLabel: 'Jumping Jack Demo' },
      { label: 'Squat', animationType: AVATAR_ANIMATIONS.SQUAT, demoLabel: 'Squat Demo' },
      { label: 'Plank', animationType: AVATAR_ANIMATIONS.PLANK, demoLabel: 'Plank Demo' },
    ],
  },
  {
    key: 'core-pose-burn',
    title: 'Core Pose Burn',
    level: 'Intermediate',
    focus: 'Core',
    summary: 'Core-focused sample plan using tracked crunch and plank assets.',
    durationMin: 9,
    exercises: [
      { label: 'Warm-Up', animationType: AVATAR_ANIMATIONS.WARMUP, demoLabel: 'Warm-Up Demo' },
      { label: 'Crunch', animationType: AVATAR_ANIMATIONS.CRUNCH, demoLabel: 'Crunch Demo' },
      { label: 'Bicycle Crunch', animationType: AVATAR_ANIMATIONS.BICYCLE_CRUNCH, demoLabel: 'Bicycle Crunch Demo' },
      { label: 'Plank', animationType: AVATAR_ANIMATIONS.PLANK, demoLabel: 'Plank Demo' },
    ],
  },
  {
    key: 'cardio-legs-circuit',
    title: 'Cardio Legs Circuit',
    level: 'Intermediate',
    focus: 'Cardio',
    summary: 'Leg-heavy cardio sample built from fully pose-ready avatar workout assets.',
    durationMin: 10,
    exercises: [
      { label: 'Warm-Up', animationType: AVATAR_ANIMATIONS.WARMUP, demoLabel: 'Warm-Up Demo' },
      { label: 'Running', animationType: AVATAR_ANIMATIONS.RUNNING, demoLabel: 'Running Demo' },
      { label: 'Squat', animationType: AVATAR_ANIMATIONS.SQUAT, demoLabel: 'Squat Demo' },
      { label: 'Jumping Jacks', animationType: AVATAR_ANIMATIONS.JUMPING_JACKS, demoLabel: 'Jumping Jack Demo' },
    ],
  },
];

const QUICK_ACTIVITY_MODES = [
  {
    key: 'running',
    label: 'Running',
    subtitle: 'Outdoor run or treadmill block',
    type: 'running',
    icon: 'walk',
    durationMin: 25,
    caloriesPerMinute: 11,
    distanceKm: 4.2,
    coachLabel: 'Running mode ready',
  },
  {
    key: 'cycling',
    label: 'Cycling',
    subtitle: 'Road ride, spin, or commute',
    type: 'cycling',
    icon: 'bicycle',
    durationMin: 35,
    caloriesPerMinute: 9,
    distanceKm: 12,
    coachLabel: 'Cycling mode ready',
  },
  {
    key: 'hiking',
    label: 'Hiking',
    subtitle: 'Trail day, incline walk, or trek',
    type: 'hiking',
    icon: 'map',
    durationMin: 45,
    caloriesPerMinute: 8,
    distanceKm: 5.5,
    coachLabel: 'Hiking mode ready',
  },
];

const WEARABLE_PROVIDERS = [
  { key: 'strava', label: 'Strava', status: 'live' },
  { key: 'garmin', label: 'Garmin', status: 'soon' },
  { key: 'fitbit', label: 'Fitbit', status: 'soon' },
  { key: 'apple-health', label: 'Apple Health', status: 'soon' },
];

const resolveImportedActivityType = (activity: any = {}) => {
  const raw = `${activity?.sport_type || ''} ${activity?.type || ''}`.toLowerCase();
  if (raw.includes('run') || raw.includes('jog') || raw.includes('treadmill')) return 'running';
  if (raw.includes('ride') || raw.includes('cycle') || raw.includes('bike')) return 'cycling';
  if (raw.includes('hike') || raw.includes('walk') || raw.includes('trail')) return 'hiking';
  if (raw.includes('strength') || raw.includes('weight')) return 'strength';
  return 'cardio';
};

const getSessionTypeIconName = (type: any) => {
  const normalizedType = String(type || '').toLowerCase();
  if (normalizedType.includes('strength')) return 'barbell';
  if (normalizedType.includes('run')) return 'walk';
  if (normalizedType.includes('cycl') || normalizedType.includes('bike')) return 'bicycle';
  if (normalizedType.includes('hike') || normalizedType.includes('trail')) return 'map';
  if (normalizedType.includes('cardio')) return 'pulse';
  return 'flash';
};

const getExerciseCapabilityLabel = (exercise: any) => {
  const hasPreview = !!exercise?.animationType;
  const hasPose = !!exercise?.poseExercise;

  if (hasPreview && hasPose) return 'Preview-ready · Pose-ready';
  if (hasPreview) return 'Preview-ready · Pose-unready';
  return 'Preview-unready · Pose-unready';
};

const buildExerciseLoopSequence = (animationType: any, gender: any) => {
  switch (String(animationType || '').toLowerCase()) {
    case AVATAR_ANIMATIONS.PUSHUP:
      return [{
        animationType: AVATAR_ANIMATIONS.PUSHUP,
        duration: getAvatarAnimationDuration(AVATAR_ANIMATIONS.PUSHUP, gender, 1600),
        repeatCount: PREVIEW_LOOP_REPEAT_COUNT,
      }];
    case AVATAR_ANIMATIONS.SQUAT:
      return [{
        animationType: AVATAR_ANIMATIONS.SQUAT,
        duration: getAvatarAnimationDuration(AVATAR_ANIMATIONS.SQUAT, gender, 1700),
        repeatCount: PREVIEW_LOOP_REPEAT_COUNT,
      }];
    case AVATAR_ANIMATIONS.PLANK:
      return [{
        animationType: AVATAR_ANIMATIONS.PLANK,
        duration: getAvatarAnimationDuration(AVATAR_ANIMATIONS.PLANK, gender, 2600),
      }];
    case AVATAR_ANIMATIONS.WARMUP:
      return [{
        animationType: AVATAR_ANIMATIONS.WARMUP,
        duration: getAvatarAnimationDuration(AVATAR_ANIMATIONS.WARMUP, gender, 2400),
      }];
    default:
      if (!animationType) return [];
      return [{
        animationType,
        duration: getAvatarAnimationDuration(animationType, gender, 1800),
        repeatCount: PREVIEW_LOOP_REPEAT_COUNT,
      }];
  }
};

export default function Workout({ aiPlanRaw = '' }) {
  const dispatch = useDispatch();
  const params = useLocalSearchParams();
  const router = useRouter();
  const sessionsByDate = useSelector((state: any) => state.workouts?.sessionsByDate || {});
  const user = useSelector((state: any) => state.user || {});
  const avatarRef = React.useRef<any>(null);
  const selectedGender = String(user.gender || 'male');
  const selectedHeight = String(user.height || '175');
  const selectedWeight = String(user.weight || '70');
  const selectedPhotoUri = user.photoUri || '';
  const selectedModel = resolveAvatarModelSelection(user.avatarModel, selectedGender);
  const restingAnimation = AVATAR_ANIMATIONS.WARMUP;
  const [coachLabel, setCoachLabel] = useState('Warm-up preview');

  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [wearableConnected, setWearableConnected] = useState(false);
  const savedSession = Array.isArray(params?.sessionSaved) ? params.sessionSaved[0] : params?.sessionSaved;
  const savedSessionTitle = Array.isArray(params?.sessionSavedTitle) ? params.sessionSavedTitle[0] : params?.sessionSavedTitle;

  // ExerciseDB state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [exdbError, setExdbError] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [sampleWorkoutsExpanded, setSampleWorkoutsExpanded] = useState(false);
  const [debugXpNotice, setDebugXpNotice] = useState('');

  const aiPlan = useMemo(() => {
    if (!aiPlanRaw) return null;
    try {
      const parsed = JSON.parse(aiPlanRaw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }, [aiPlanRaw]);
  const [workoutPlan, setWorkoutPlan] = useState(() => createEditableWorkoutPlan());

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Enable LayoutAnimation on Android to smooth layout changes
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Load ExerciseDB body parts once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPartsLoading(true);
        const data = await listBodyParts();
        if (!cancelled) setParts(Array.isArray(data) ? data as any[] : []);
      } catch (e: unknown) {
        if (!cancelled) setExdbError(String((e as Error)?.message || e));
      } finally {
        if (!cancelled) setPartsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear search state whenever this screen is focused (so a "refresh"/re-enter resets results)
  useFocusEffect(
    useCallback(() => {
      setSearchQuery('');
      setSelectedPart('');
      setResults([]);
      setExdbError('');
      return undefined;
    }, [])
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const token = await getStoredToken();
        if (active) {
          setWearableConnected(Boolean(token?.access_token));
        }
      } catch (_) {
        if (active) {
          setWearableConnected(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const resolvePoseExercise = useCallback((animationType: any) => {
    return getPoseExerciseForAnimation(animationType);
  }, []);

  const resolveSupportedAnimationType = useCallback((animationType: any) => {
    const normalizedType = String(animationType || '').trim().toLowerCase();
    if (!normalizedType) return null;

    const config = resolveAvatarAnimationConfig(normalizedType, selectedGender);
    const resolvedKey = String(config?.key || '').toLowerCase();
    if (!resolvedKey) return null;
    if (!WORKOUT_ANIMATION_TYPE_SET.has(resolvedKey)) return null;
    if (!config?.asset || config?.disabled) return null;
    return resolvedKey;
  }, [selectedGender]);

  const grantDebugWorkoutXp = useCallback(() => {
    const amount = 60;
    dispatch(addXP({
      amount,
      source: 'workout',
      title: 'Workout test XP',
      subtitle: `${amount} XP added for sync check`,
    }));
    dispatch(addBadgeXP({
      amount,
      source: 'workout',
      title: 'Workout test XP',
      subtitle: `${amount} XP added for sync check`,
    }));
    setDebugXpNotice(`Added ${amount} workout XP for sync check.`);
  }, [dispatch]);

  const normalizePlanExercise = useCallback((exercise: any) => {
    const animationType = resolveSupportedAnimationType(exercise?.animationType);
    const poseExercise = resolvePoseExercise(animationType);

    return {
      ...exercise,
      animationType,
      poseExercise,
    };
  }, [resolvePoseExercise, resolveSupportedAnimationType]);

  const canPreviewExercise = useCallback((exercise: any) => {
    return !!exercise?.animationType && !!exercise?.poseExercise;
  }, []);

  const sampleAssetWorkouts = useMemo(() => {
    return SAMPLE_ASSET_WORKOUTS.map((plan) => {
      const exercises = plan.exercises.map((item) => normalizePlanExercise(item));
      const poseReadyCount = exercises.filter((item) => !!item?.poseExercise).length;

      return {
        ...plan,
        exercises,
        poseReadyCount,
      };
    });
  }, [normalizePlanExercise]);

  const previewAiExercise = useCallback((exercise: any) => {
    const normalizedExercise = normalizePlanExercise(exercise);
    if (!canPreviewExercise(normalizedExercise)) {
      setCoachLabel(`${normalizedExercise?.label || 'Exercise'} added · pose preview unavailable`);
      return;
    }

    const previewSequence = buildExerciseLoopSequence(normalizedExercise.animationType, selectedGender);
    if (previewSequence.length === 0) {
      setCoachLabel(`${normalizedExercise?.label || 'Exercise'} added · pose preview unavailable`);
      return;
    }

    avatarRef.current?.setCameraShot?.('full');
    setCoachLabel(normalizedExercise?.demoLabel || normalizedExercise?.label || 'Exercise preview');
    avatarRef.current?.triggerWorkoutDemo?.({
      animationType: normalizedExercise.animationType,
      label: normalizedExercise?.demoLabel || normalizedExercise?.label || 'Exercise preview',
      sequence: previewSequence,
    }, { returnToIdle: false });
  }, [canPreviewExercise, normalizePlanExercise, selectedGender]);

  useEffect(() => {
    const timer = setTimeout(() => {
      avatarRef.current?.setCameraShot?.('full');
    }, 500);

    return () => clearTimeout(timer);
  }, [aiPlanRaw]);

  const resolveExerciseAnimationFromName = useCallback((exerciseName: any) => {
    const candidates = buildAnimationLookupCandidates(exerciseName);

    for (const candidate of candidates) {
      const config = resolveAvatarAnimationConfig(candidate, selectedGender);
      const resolvedKey = String(config?.key || '').toLowerCase();
      if (!resolvedKey) continue;
      if (!WORKOUT_ANIMATION_TYPE_SET.has(resolvedKey)) continue;
      if (!config?.asset || config?.disabled) continue;
      return resolvedKey;
    }

    return null;
  }, [selectedGender]);

  useEffect(() => {
    if (!aiPlan) {
      setWorkoutPlan(createEditableWorkoutPlan());
      return;
    }

    setWorkoutPlan({
      ...aiPlan,
      exercises: Array.isArray(aiPlan.exercises)
        ? aiPlan.exercises.map((item: any) => normalizePlanExercise(item))
        : [],
    });
  }, [aiPlan, normalizePlanExercise]);

  const buildPlanExerciseFromApi = useCallback((exercise: any) => {
    const label = (exercise?.name || 'Exercise').replace(/\b\w/g, (m: string) => m.toUpperCase());
    const animationType = resolveExerciseAnimationFromName(exercise?.name);
    const poseExercise = resolvePoseExercise(animationType);

    return {
      animationType,
      label,
      demoLabel: `${label} Demo`,
      poseExercise,
      source: 'exercisedb',
    };
  }, [resolveExerciseAnimationFromName, resolvePoseExercise]);

  const runSearch = async () => {
    try {
      setExdbError('');
      setResultsLoading(true);
      let data: any[] = [];
      const query = searchQuery.trim();
      if (query) {
        data = (await searchExercises(query, 0, 20)) as any[];
      } else if (selectedPart) {
        data = (await listByBodyPart(selectedPart, 0, 20)) as any[];
      } else {
        data = [];
      }
      setResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      console.warn('ExerciseDB search/list failed', e);
      setExdbError(String((e as Error)?.message || e));
    } finally {
      setResultsLoading(false);
    }
  };

  const pickPart = async (part: any) => {
    const next = part === selectedPart ? '' : part;
    setSelectedPart(next);
    setSearchQuery('');
    if (!next) {
      setResults([]);
      return;
    }
    try {
      setExdbError('');
      setResultsLoading(true);
      const data = (await listByBodyPart(next, 0, 20)) as any[];
      setResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      console.warn('ExerciseDB list failed', e);
      setExdbError(String((e as Error)?.message || e));
    } finally {
      setResultsLoading(false);
    }
  };

  const addExerciseToWorkoutPlan = useCallback((exercise: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const planExercise = buildPlanExerciseFromApi(exercise);

    setWorkoutPlan((currentPlan) => {
      const currentExercises = Array.isArray(currentPlan?.exercises) ? currentPlan.exercises : [];
      const nextExercises = [...currentExercises, planExercise];
      const baseDuration = Number(currentPlan?.durationMin) || 0;

      return {
        ...(currentPlan || {}),
        title: currentPlan?.title || 'Workout Plan',
        summary: currentPlan?.summary || 'Custom workout plan built from AI and ExerciseDB picks.',
        durationMin: Math.max(baseDuration, nextExercises.length * 2 || 5),
        exercises: nextExercises,
      };
    });

    if (canPreviewExercise(planExercise)) {
      previewAiExercise(planExercise);
      return;
    }

    setCoachLabel(`${planExercise.label} added · pose preview unavailable`);
  }, [buildPlanExerciseFromApi, canPreviewExercise, previewAiExercise]);

  const removeExerciseFromWorkoutPlan = useCallback((indexToRemove: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setWorkoutPlan((currentPlan) => {
      const currentExercises = Array.isArray(currentPlan?.exercises) ? currentPlan.exercises : [];
      if (!currentExercises[indexToRemove]) {
        return currentPlan;
      }

      const removedExercise = currentExercises[indexToRemove];
      const nextExercises = currentExercises.filter((_, index) => index !== indexToRemove);
      const baseDuration = Number(currentPlan?.durationMin) || 0;

      setCoachLabel(`${removedExercise?.label || 'Exercise'} removed from plan`);

      return {
        ...(currentPlan || {}),
        durationMin: nextExercises.length > 0 ? Math.max(baseDuration, nextExercises.length * 2) : 0,
        exercises: nextExercises,
      };
    });
  }, []);

  const loadSampleWorkoutPlan = useCallback((samplePlan: any) => {
    if (!samplePlan) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkoutPlan({
      title: samplePlan.title,
      summary: samplePlan.summary,
      durationMin: samplePlan.durationMin,
      exercises: Array.isArray(samplePlan.exercises) ? samplePlan.exercises : [],
    });

    const firstPreviewableExercise = Array.isArray(samplePlan.exercises)
      ? samplePlan.exercises.find((item: any) => canPreviewExercise(item))
      : null;

    if (firstPreviewableExercise) {
      previewAiExercise(firstPreviewableExercise);
    } else {
      setCoachLabel(`${samplePlan.title} loaded`);
    }
  }, [canPreviewExercise, previewAiExercise]);

  const appendSampleWorkoutPlan = useCallback((samplePlan: any) => {
    if (!samplePlan || !Array.isArray(samplePlan.exercises) || samplePlan.exercises.length === 0) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWorkoutPlan((currentPlan) => {
      const currentExercises = Array.isArray(currentPlan?.exercises) ? currentPlan.exercises : [];
      const nextExercises = [...currentExercises, ...samplePlan.exercises];

      return {
        title: currentPlan?.title || 'Workout Plan',
        summary: currentPlan?.summary || 'Custom workout plan built from AI, presets, and ExerciseDB picks.',
        durationMin: Math.max(Number(currentPlan?.durationMin) || 0, nextExercises.length * 2),
        exercises: nextExercises,
      };
    });

    const firstPreviewableExercise = samplePlan.exercises.find((item: any) => canPreviewExercise(item));
    if (firstPreviewableExercise) {
      previewAiExercise(firstPreviewableExercise);
    } else {
      setCoachLabel(`${samplePlan.title} added to plan`);
    }
  }, [canPreviewExercise, previewAiExercise]);

  const logAiPlan = useCallback(() => {
    if (!Array.isArray(workoutPlan?.exercises) || workoutPlan.exercises.length === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    dispatch(
      addWorkoutSession({
        date: todayKey,
        session: {
          title: workoutPlan.title || 'AI Workout Plan',
          durationMin: Number(workoutPlan.durationMin) || 20,
          calories: Math.max(80, (Number(workoutPlan.durationMin) || 20) * 10),
          type: 'strength',
          notes: Array.isArray(workoutPlan.exercises) ? workoutPlan.exercises.map((item) => item.label).join(' · ') : '',
          exerciseDetails: Array.isArray(workoutPlan.exercises)
            ? workoutPlan.exercises.map((item) => ({
                label: item?.label || 'Exercise',
                type: item?.poseExercise || item?.animationType || 'general',
              }))
            : [],
          createdAt: Date.now(),
        },
      })
    );
  }, [dispatch, todayKey, workoutPlan]);

  const openOutdoorTracker = useCallback((mode: any) => {
    if (!mode) return;
    setCoachLabel(`${mode.coachLabel} · opening live tracker`);
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

  const firstPoseExercise = workoutPlan?.exercises?.find((item) => item?.poseExercise)?.poseExercise || '';

  const recent = useMemo(() => {
    const items = [];
    const keys = Object.keys(sessionsByDate);
    for (const k of keys) {
      const list = sessionsByDate[k] || [];
      for (const s of list) {
        const ts = typeof s.createdAt === 'number'
          ? s.createdAt
          : (/^\d+$/.test(String(s.id || '')) ? Number(s.id) : new Date(k).getTime());
        items.push({ date: k, ...s, _sort: ts });
      }
    }
    items.sort((a, b) => (b._sort || 0) - (a._sort || 0));
    return items.slice(0, 50);
  }, [sessionsByDate]);

  const aiRecent = useMemo(() => (
    recent.filter((item) => /\bai\b/i.test(String(item?.title || '')))
  ), [recent]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={(styles as any).contentContainer} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#0d1024", "#0a0f1e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerWrap}>
        <LinearGradient colors={["rgba(122,92,255,0.35)", "rgba(0,234,255,0.35)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <BackButton />
          <Text style={styles.headerText}>Workout</Text>
        </LinearGradient>
      </LinearGradient>

      {savedSession ? (
        <View style={styles.sessionSavedBanner}>
          <Text style={styles.sessionSavedBannerText}>
            {savedSessionTitle ? `${savedSessionTitle} saved. XP awarded.` : 'Workout session saved. XP awarded.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.avatarCard}>
        <View style={styles.avatarCardHeader}>
          <View>
            <Text style={styles.avatarLabel}>Avatar Coach</Text>
            <Text style={styles.avatarMeta}>{coachLabel}</Text>
          </View>
          <Text style={styles.avatarHint}>
            {Array.isArray(workoutPlan?.exercises) && workoutPlan.exercises.length > 0
              ? 'Tap any pose-ready exercise to preview it'
              : 'Add exercises below to build your plan'}
          </Text>
        </View>
        <View style={styles.previewSplitLayout}>
          <View style={styles.previewPlanPanel}>
            <View style={styles.previewPlanHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewPlanEyebrow}>Workout Plan</Text>
                <Text style={styles.previewPlanMeta}>{`${workoutPlan.durationMin || 0} min${Array.isArray(workoutPlan.exercises) && workoutPlan.exercises.length ? ` · ${workoutPlan.exercises.length} moves` : ''}`}</Text>
              </View>
              <Text style={styles.previewPlanHint}>
                {Array.isArray(workoutPlan.exercises) && workoutPlan.exercises.length > 0 ? 'Coach handoff' : 'Always available'}
              </Text>
            </View>
            <View style={styles.previewPlanList}>
              {Array.isArray(workoutPlan.exercises) && workoutPlan.exercises.length > 0 ? (
                (workoutPlan.exercises || []).map((item, index) => (
                  <View
                    key={`${item?.animationType || item?.label || 'plan'}-${index}`}
                    style={styles.previewPlanItemRow}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item?.label || 'exercise'} from workout plan`}
                      onPress={() => removeExerciseFromWorkoutPlan(index)}
                      style={({ pressed }) => [
                        styles.previewPlanRemoveButton,
                        pressed && styles.previewPlanRemoveButtonPressed,
                      ]}
                    >
                      <Ionicons name="close" size={11} color="#dff8ff" />
                    </Pressable>
                    <Pressable
                      disabled={!canPreviewExercise(item)}
                      onPress={() => previewAiExercise(item)}
                      style={({ pressed }) => [
                        styles.previewPlanItem,
                        !canPreviewExercise(item) && styles.previewPlanItemDisabled,
                        pressed && canPreviewExercise(item) && styles.previewPlanItemPressed,
                      ]}
                    >
                      <Text style={styles.previewPlanItemIndex}>{index + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewPlanItemLabel}>{item?.label || 'Exercise'}</Text>
                        <Text style={styles.previewPlanItemMeta}>{getExerciseCapabilityLabel(item)}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.previewPlanEmptyState}>
                  <Ionicons name="fitness" size={18} color="#9feaff" />
                  <Text style={styles.previewPlanEmptyTitle}>Your plan is ready to build</Text>
                  <Text style={styles.previewPlanEmptyText}>Add exercises from search or use Today&apos;s Workout to fill this section.</Text>
                </View>
              )}
            </View>
            <View style={styles.aiPlanActions}>
              <Pressable
                onPress={grantDebugWorkoutXp}
                style={({ pressed }) => [styles.aiPlanPrimaryBtn, styles.debugXpBtn, pressed && { opacity: 0.92 }]}
              >
                <Text style={[styles.aiPlanPrimaryText, styles.debugXpBtnText]}>+60 Workout XP</Text>
              </Pressable>
              <Pressable
                disabled={!Array.isArray(workoutPlan.exercises) || workoutPlan.exercises.length === 0}
                onPress={logAiPlan}
                style={({ pressed }) => [
                  styles.aiPlanSecondaryBtn,
                  (!Array.isArray(workoutPlan.exercises) || workoutPlan.exercises.length === 0) && styles.aiPlanDisabledBtn,
                  pressed && Array.isArray(workoutPlan.exercises) && workoutPlan.exercises.length > 0 && { opacity: 0.92 },
                ]}
              >
                <Text style={styles.aiPlanSecondaryText}>Log Plan</Text>
              </Pressable>
              {firstPoseExercise ? (
                <Pressable
                  onPress={() => {
                    dispatch(setPoseExercise(firstPoseExercise));
                    router.push({
                      pathname: '/Pose',
                      params: {
                        aiPlan: aiPlanRaw || JSON.stringify(workoutPlan),
                      },
                    });
                  }}
                  style={({ pressed }) => [styles.aiPlanTertiaryBtn, pressed && { opacity: 0.92 }]}
                >
                    <Text style={styles.aiPlanTertiaryText}>Start AR</Text>
                </Pressable>
              ) : null}
            </View>
            {debugXpNotice ? <Text style={styles.debugXpNotice}>{debugXpNotice}</Text> : null}
          </View>
          <View style={styles.previewStagePanel}>
            <View style={[styles.avatarStage, styles.avatarStageCompact]}>
              <InteractiveAvatar
                {...{ ref: avatarRef } as any}
                model={selectedModel}
                gender={selectedGender}
                height={selectedHeight}
                weight={selectedWeight}
                photoUri={selectedPhotoUri}
                restingAnimation={restingAnimation}
                enableVoice={false}
                enableTTS={false}
                enableReactionGestures={false}
                sizeMultiplier={0.72}
                yOffset={-0.015}
                alignFootToBottom={true}
                bottomPadding={0.02}
                headMargin={0.22}
                autoFit={true}
                focus="full"
                fitMode="tight"
                targetFill={0.74}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.modeSection}>
        <View style={styles.modeSectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>Outdoor Modes</Text>
            <Text style={styles.modeSectionMeta}>Open a live tracking screen with realtime GPS, route map, and save-on-finish XP.</Text>
          </View>
          <Text style={styles.modeSectionHint}>Run · Ride · Hike</Text>
        </View>
        <View style={styles.modeGrid}>
          {QUICK_ACTIVITY_MODES.map((mode) => (
            <View key={mode.key} style={styles.modeCard}>
              <View style={styles.modeCardHeader}>
                <View style={styles.modeIconWrap}>
                  <Ionicons name={mode.icon as any} size={18} color="#dff8ff" />
                </View>
                <Text style={styles.modeCardMeta}>{`${mode.durationMin} min starter`}</Text>
              </View>
              <Text style={styles.modeCardTitle}>{mode.label}</Text>
              <Text style={styles.modeCardSubtitle}>{mode.subtitle}</Text>
              <Text style={styles.modeCardStats}>{`${mode.distanceKm} km est. · ${Math.round(mode.durationMin * mode.caloriesPerMinute)} kcal`}</Text>
              <Pressable
                onPress={() => openOutdoorTracker(mode)}
                style={({ pressed }) => [styles.modeCardButton, pressed && styles.modeCardButtonPressed]}
              >
                <Text style={styles.modeCardButtonText}>Track {mode.label} Live</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.wearableCard}>
        <View style={styles.modeSectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>Wearable Connections</Text>
            <Text style={styles.modeSectionMeta}>Import outdoor sessions from connected fitness platforms.</Text>
          </View>
          <Text style={styles.modeSectionHint}>{wearableConnected ? 'Strava connected' : 'Strava ready'}</Text>
        </View>
        <View style={styles.providerRow}>
          {WEARABLE_PROVIDERS.map((provider) => {
            const isLive = provider.status === 'live';
            const isConnected = isLive && wearableConnected;
            return (
              <View
                key={provider.key}
                style={[
                  styles.providerChip,
                  isLive ? styles.providerChipLive : styles.providerChipSoon,
                  isConnected && styles.providerChipConnected,
                ]}
              >
                <Text style={styles.providerChipText}>{provider.label}</Text>
                <Text style={styles.providerChipStatus}>{isConnected ? 'Connected' : isLive ? 'Available' : 'Soon'}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.connectRow}>
          <Pressable
            disabled={connecting}
            onPress={async () => {
              try {
                setConnecting(true);
                await signInWithStrava();
                setWearableConnected(true);
              } catch (e) {
                console.warn('Strava connect failed', e);
              } finally {
                setConnecting(false);
              }
            }}
            style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.connectText}>{connecting ? 'Connecting…' : wearableConnected ? 'Reconnect Strava' : 'Connect Strava'}</Text>
          </Pressable>
          <Pressable
            disabled={importing}
            onPress={async () => {
              try {
                setImporting(true);
                const token = await getStoredToken();
                if (!token) {
                  await signInWithStrava();
                  setWearableConnected(true);
                }
                const acts = await fetchRecentActivities(5);
                for (const a of acts) {
                  const start = new Date(a.start_date_local || a.start_date);
                  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                  dispatch(
                    addWorkoutSession({
                      date: key,
                      session: {
                        id: String(a.id),
                        title: a.name || 'Strava Activity',
                        durationMin: Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)),
                        calories: Math.round(a.kilojoules || a.calories || 0),
                        distanceKm: Number(a.distance) > 0 ? Math.round((Number(a.distance) / 1000) * 10) / 10 : undefined,
                        type: resolveImportedActivityType(a),
                        notes: a.sport_type || a.type || 'Imported from Strava',
                        createdAt: new Date(a.start_date_local || a.start_date).getTime(),
                      },
                    })
                  );
                }
              } catch (e) {
                console.warn('Import failed', e);
              } finally {
                setImporting(false);
              }
            }}
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.connectText}>{importing ? 'Importing…' : 'Import Strava'}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sampleWorkoutsExpanded ? 'Hide sample workouts' : 'Browse sample workouts'}
        onPress={() => setSampleWorkoutsExpanded((value) => !value)}
        style={({ pressed }) => [styles.sampleWorkoutToggle, pressed && styles.sampleWorkoutTogglePressed]}
      >
        <View>
          <Text style={styles.sectionLabel}>Sample Workouts</Text>
          <Text style={styles.sampleWorkoutToggleMeta}>{`${sampleAssetWorkouts.length} presets ready`}</Text>
        </View>
        <View style={styles.sampleWorkoutToggleRight}>
          <Text style={styles.sampleWorkoutToggleAction}>{sampleWorkoutsExpanded ? 'Hide' : 'Browse Samples'}</Text>
          <Ionicons name={sampleWorkoutsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#dff8ff" />
        </View>
      </Pressable>
      {sampleWorkoutsExpanded ? (
        <View style={styles.sampleWorkoutList}>
          {sampleAssetWorkouts.map((samplePlan) => (
            <View key={samplePlan.key} style={styles.sampleWorkoutCard}>
              <View style={styles.sampleWorkoutHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleWorkoutTitle}>{samplePlan.title}</Text>
                  <Text style={styles.sampleWorkoutMeta}>{`${samplePlan.durationMin} min · ${samplePlan.exercises.length} moves · ${samplePlan.poseReadyCount}/${samplePlan.exercises.length} pose-ready`}</Text>
                </View>
                <Text style={styles.sampleWorkoutBadge}>Assets + Pose</Text>
              </View>
              <View style={styles.sampleWorkoutTagRow}>
                <View style={styles.sampleWorkoutTag}>
                  <Text style={styles.sampleWorkoutTagText}>{samplePlan.level}</Text>
                </View>
                <View style={styles.sampleWorkoutTag}>
                  <Text style={styles.sampleWorkoutTagText}>{samplePlan.focus}</Text>
                </View>
              </View>
              <Text style={styles.sampleWorkoutSummary} numberOfLines={2}>{samplePlan.summary}</Text>
              <Text style={styles.sampleWorkoutExerciseList} numberOfLines={1}>
                {samplePlan.exercises.map((item) => item.label).join(' · ')}
              </Text>
              <View style={styles.sampleWorkoutActions}>
                <Pressable
                  onPress={() => loadSampleWorkoutPlan(samplePlan)}
                  style={({ pressed }) => [styles.sampleWorkoutButton, pressed && styles.sampleWorkoutButtonPressed]}
                >
                  <Text style={styles.sampleWorkoutButtonText}>Replace Plan</Text>
                </Pressable>
                <Pressable
                  onPress={() => appendSampleWorkoutPlan(samplePlan)}
                  style={({ pressed }) => [styles.sampleWorkoutSecondaryButton, pressed && styles.sampleWorkoutButtonPressed]}
                >
                  <Text style={styles.sampleWorkoutSecondaryButtonText}>Add To Plan</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* ExerciseDB search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            placeholder="Search exercises by name"
            placeholderTextColor="#9fb3ff"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <Pressable onPress={runSearch} style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSearchQuery('');
            setSelectedPart('');
            setResults([]);
            setExdbError('');
          }}
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.searchBtnText}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partsRow}>
        {partsLoading ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator color="#00eaff" />
          </View>
        ) : (
          parts.map((p) => {
            const active = p === selectedPart;
            return (
              <Pressable key={String(p)} onPress={() => pickPart(p)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={styles.chipText}>{String(p).replace(/\b\w/g, (m) => m.toUpperCase())}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {exdbError ? <Text style={styles.errorText}>{exdbError}</Text> : null}

      {resultsLoading ? (
        <View style={{ paddingVertical: 12 }}>
          <ActivityIndicator color="#7a5cff" />
        </View>
      ) : (searchQuery.trim() || selectedPart) && results.length ? (
        <View style={styles.scrollSection}>
          <ScrollView
            nestedScrollEnabled
            style={styles.resultsScrollArea}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {results.map((item, idx) => (
              <View key={String(item.id ?? `${item.name}-${idx}`)} style={styles.resultItem}>
                {item?.gifUrl ? (
                  <Image source={{ uri: item.gifUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbFallback}>
                    <Ionicons name="body" size={20} color="#7a5cff" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemTitle}>{(item.name || 'Exercise').replace(/\b\w/g, (m: string) => m.toUpperCase())}</Text>
                  <Text style={styles.itemMeta}>{[item.bodyPart, item.target, item.equipment].filter(Boolean).join(' · ')}</Text>
                </View>
                <Pressable onPress={() => addExerciseToWorkoutPlan(item)} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>Add to Plan</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {results.length > 3 ? <Text style={styles.scrollHint}>Scroll for more exercises</Text> : null}
        </View>
      ) : null}

  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>AI Workouts</Text>
      {aiRecent.length > 0 ? (
        <View style={styles.scrollSection}>
          <ScrollView
            nestedScrollEnabled
            style={styles.recentScrollArea}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {aiRecent.map((item, idx) => (
              <View key={`${item.date}-${item.id}-${idx}`} style={styles.item}>
                <Ionicons name={getSessionTypeIconName(item.type)} size={16} color="#00eaff" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMeta}>{`${item.date} · ${item.durationMin} min · ${item.calories} kcal · ${item.awardedXP || 0} XP`}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          {aiRecent.length > 2 ? <Text style={styles.scrollHint}>Scroll for older workouts</Text> : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>No AI workouts yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080b16',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerWrap: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 12,
  },
  header: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  sessionSavedBanner: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,234,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,234,255,0.32)',
  },
  sessionSavedBannerText: {
    color: '#E7FCFF',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(13,19,48,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.22)',
  },
  avatarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  avatarLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  avatarMeta: {
    color: '#9feaff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  avatarHint: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 120,
  },
  avatarStage: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.2)',
    marginBottom: 10,
  },
  avatarStageCompact: {
    flex: 1,
    height: '100%',
    minHeight: 260,
    marginBottom: 0,
  },
  previewSplitLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  previewPlanPanel: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewStagePanel: {
    flex: 1,
    minWidth: 0,
  },
  previewPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  previewPlanEyebrow: {
    color: '#9feaff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewPlanTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  previewPlanItemRow: {
    position: 'relative',
  },
  previewPlanMeta: {
    color: '#a7c2ff',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  previewPlanHint: {
    color: '#dff8ff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  previewPlanList: {
    marginTop: 10,
    gap: 6,
    flex: 1,
  },
  previewPlanEmptyState: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewPlanEmptyTitle: {
    color: '#f4fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  previewPlanEmptyText: {
    color: '#9fb3ff',
    fontSize: 11,
    lineHeight: 17,
  },
  previewPlanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingRight: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewPlanItemPressed: {
    opacity: 0.9,
    borderColor: 'rgba(0,234,255,0.32)',
    backgroundColor: 'rgba(0,234,255,0.08)',
  },
  previewPlanItemDisabled: {
    opacity: 0.58,
  },
  previewPlanItemIndex: {
    width: 14,
    color: '#00eaff',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  previewPlanItemLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  previewPlanItemMeta: {
    color: '#9feaff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  previewPlanRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 11, 22, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0, 234, 255, 0.22)',
    zIndex: 2,
  },
  previewPlanRemoveButtonPressed: {
    backgroundColor: 'rgba(0, 234, 255, 0.14)',
    borderColor: 'rgba(0, 234, 255, 0.34)',
  },
  avatarActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,234,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.26)',
  },
  avatarActionText: {
    color: '#dff8ff',
    fontSize: 12,
    fontWeight: '800',
  },
  aiPlanCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(10,16,38,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.24)',
  },
  aiPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  aiPlanEyebrow: {
    color: '#9feaff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  aiPlanTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  aiPlanMeta: {
    color: '#a7c2ff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  aiPlanHint: {
    color: '#dff8ff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  aiPlanSummary: {
    color: '#e8f3ff',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  aiSessionCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.18)',
  },
  aiSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  aiSessionEyebrow: {
    color: '#9feaff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  aiSessionTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  aiSessionMetaWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  aiSessionMeta: {
    color: '#dff8ff',
    fontSize: 11,
    fontWeight: '700',
  },
  aiSessionProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 12,
  },
  aiSessionProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#00eaff',
  },
  aiSessionFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  aiSessionNowLabel: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  aiSessionNowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  aiSessionStatus: {
    color: '#dff8ff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 120,
  },
  aiPlanList: {
    marginTop: 14,
    gap: 8,
  },
  aiPlanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  aiPlanItemIndex: {
    width: 22,
    color: '#00eaff',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  aiPlanItemLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  aiPlanItemMeta: {
    color: '#9feaff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  aiPlanActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  aiPlanPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#00eaff',
  },
  aiPlanPrimaryText: {
    color: '#06111f',
    fontWeight: '900',
  },
  debugXpBtn: {
    backgroundColor: '#40df9b',
  },
  debugXpBtnText: {
    color: '#062114',
  },
  aiPlanDangerBtn: {
    backgroundColor: '#ff7d66',
  },
  aiPlanDangerText: {
    color: '#2a0810',
  },
  aiPlanSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(122,92,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
  },
  aiPlanSecondaryText: {
    color: '#e8f3ff',
    fontWeight: '900',
  },
  aiPlanDisabledBtn: {
    opacity: 0.45,
  },
  aiPlanDisabledText: {
    color: '#afbdd8',
  },
  aiPlanTertiaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  aiPlanTertiaryText: {
    color: '#fff',
    fontWeight: '900',
  },
  debugXpNotice: {
    color: '#8df1bf',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  headerText: { color: '#d9eaff', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 },
  sectionLabel: { color: '#9feaff', fontWeight: '900', fontSize: 13, marginBottom: 6 },
  modeSection: {
    marginBottom: 12,
  },
  modeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  modeSectionMeta: {
    color: '#a7c2ff',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 240,
  },
  modeSectionHint: {
    color: '#dff8ff',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  modeCard: {
    flexGrow: 1,
    flexBasis: 180,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(12,17,38,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.18)',
  },
  modeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  modeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,234,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.24)',
  },
  modeCardMeta: {
    color: '#9feaff',
    fontSize: 10,
    fontWeight: '800',
  },
  modeCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  modeCardSubtitle: {
    color: '#a7c2ff',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  modeCardStats: {
    color: '#dff8ff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
  },
  modeCardButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(122,92,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.34)',
    alignItems: 'center',
  },
  modeCardButtonPressed: {
    opacity: 0.9,
  },
  modeCardButtonText: {
    color: '#f4fbff',
    fontSize: 12,
    fontWeight: '900',
  },
  wearableCard: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(13,19,48,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.24)',
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  providerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 86,
  },
  providerChipLive: {
    backgroundColor: 'rgba(0,234,255,0.08)',
    borderColor: 'rgba(0,234,255,0.24)',
  },
  providerChipSoon: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  providerChipConnected: {
    backgroundColor: 'rgba(64,223,155,0.12)',
    borderColor: 'rgba(64,223,155,0.26)',
  },
  providerChipText: {
    color: '#f4fbff',
    fontSize: 11,
    fontWeight: '900',
  },
  providerChipStatus: {
    color: '#a7c2ff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  connectRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  connectBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,234,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtn: {
    flex: 1,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: { color: '#e8f3ff', fontWeight: '900' },
  sampleWorkoutToggle: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(122,92,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sampleWorkoutTogglePressed: {
    opacity: 0.92,
  },
  sampleWorkoutToggleMeta: {
    color: '#a7c2ff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  sampleWorkoutToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleWorkoutToggleAction: {
    color: '#dff8ff',
    fontSize: 11,
    fontWeight: '900',
  },
  sampleWorkoutList: {
    gap: 8,
    marginBottom: 10,
  },
  sampleWorkoutCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(122,92,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.24)',
  },
  sampleWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  sampleWorkoutTitle: {
    color: '#f4fbff',
    fontSize: 14,
    fontWeight: '900',
  },
  sampleWorkoutMeta: {
    color: '#b9c8ff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  sampleWorkoutBadge: {
    color: '#dff8ff',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sampleWorkoutTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  sampleWorkoutTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sampleWorkoutTagText: {
    color: '#dff8ff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sampleWorkoutSummary: {
    color: '#e8f3ff',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  sampleWorkoutExerciseList: {
    color: '#9feaff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
  },
  sampleWorkoutActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  sampleWorkoutButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,234,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.3)',
  },
  sampleWorkoutSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sampleWorkoutButtonPressed: {
    opacity: 0.9,
  },
  sampleWorkoutButtonText: {
    color: '#e8f3ff',
    fontWeight: '900',
    fontSize: 11,
  },
  sampleWorkoutSecondaryButtonText: {
    color: '#dff8ff',
    fontWeight: '800',
    fontSize: 11,
  },
  list: { marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)',
    marginBottom: 6,
  },
  itemTitle: { color: '#e8f3ff', fontSize: 14, fontWeight: '900' },
  itemMeta: { color: '#a7c2ff', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#8aa4ff', fontSize: 12 },
  // ExerciseDB styles
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  searchInputWrap: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
    backgroundColor: 'rgba(122,92,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: { color: '#e8f3ff', fontSize: 13, fontWeight: '700', padding: 0 },
  searchBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  clearBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,234,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)'
  },
  searchBtnText: { color: '#e8f3ff', fontWeight: '900' },
  partsRow: { paddingVertical: 4, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(122,92,255,0.18)',
    borderColor: 'rgba(122,92,255,0.55)'
  },
  chipText: { color: '#d9eaff', fontWeight: '800', fontSize: 12 },
  scrollSection: {
    marginBottom: 4,
  },
  resultsScrollArea: {
    maxHeight: 258,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.16)',
    backgroundColor: 'rgba(8,11,22,0.55)',
  },
  recentScrollArea: {
    maxHeight: 118,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.16)',
    backgroundColor: 'rgba(8,11,22,0.55)',
  },
  scrollHint: {
    color: '#7ea4d6',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(122,92,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.25)',
    marginBottom: 8,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: 'rgba(122,92,255,0.12)'
  },
  thumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122,92,255,0.12)'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,234,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.45)'
  },
  addBtnText: { color: '#ffffff', fontWeight: '900' },
  errorText: { color: '#ff9b9b', fontWeight: '800', marginBottom: 6 },
  moreBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  moreBtnText: { color: '#e8f3ff', fontWeight: '900' },
});
