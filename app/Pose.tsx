import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import InteractiveAvatar from '../components/InteractiveAvatar';
import ScreenFrame from '../components/ScreenFrame';
import { acceptPrivacy, addBadgeXP, addWeeklySquatReps, addWorkoutSession, addXP, incrementPoseRep, markWeeklyXPAwarded, resetPoseSession, setFormFeedback, setPoseExercise } from '../store';
import { AVATAR_ANIMATIONS, getAvatarAnimationDuration, resolveAvatarAnimationConfig } from '../utils/avatarAnimationConfig';
import { resolveAvatarModelSelection } from '../utils/avatarModels';
import { getPoseExerciseDefinition, getPoseExerciseForAnimation, getPoseExerciseMetricLabel, isHoldBasedPoseExercise, POSE_EXERCISE_OPTIONS } from '../utils/poseExerciseConfig';
import { createWorkoutSessionRecord } from '../utils/workoutSessionXP';

const { POSE_DETECTOR_HTML } = Platform.OS === 'web'
  ? require('../utils/poseDetectorHtml.web')
  : require('../utils/poseDetectorHtml');

const POSE_PREVIEW_REPEAT_COUNT = 2;
const FEEDBACK_COOLDOWN_MS = 3500;
const MOTIVATION_COOLDOWN_MS = 22000;
const MILESTONE_COOLDOWN_MS = 2500;
const REP_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];
const HOLD_MILESTONES = [10, 20, 30, 45, 60, 90, 120];
const AI_PLAN_STORAGE_KEY = 'bodify:web-workout-plan';
const MOTIVATION_LINES = [
  'Keep that pace going.',
  'Stay locked in. You are doing great.',
  'Nice work. Keep your form controlled.',
  'Strong effort. Keep pushing.',
  'You are in rhythm now. Stay with it.',
];

const resolveSafePosePreviewAnimation = (animationType: string, gender: string) => {
  const requestedConfig = resolveAvatarAnimationConfig(animationType, gender);
  if (requestedConfig?.asset && !requestedConfig?.disabled) {
    return requestedConfig.key;
  }

  const fallbackCandidates = [
    AVATAR_ANIMATIONS.WARMUP,
    AVATAR_ANIMATIONS.SQUAT,
    AVATAR_ANIMATIONS.PUSHUP,
  ];

  for (const candidate of fallbackCandidates) {
    const candidateConfig = resolveAvatarAnimationConfig(candidate, gender);
    if (candidateConfig?.asset && !candidateConfig?.disabled) {
      return candidateConfig.key;
    }
  }

  return AVATAR_ANIMATIONS.WARMUP;
};

const buildStablePosePreviewDemo = (animationType: string, gender: string) => {
  const safeAnimationType = resolveSafePosePreviewAnimation(animationType, gender);
  const animationConfig = resolveAvatarAnimationConfig(safeAnimationType, gender);
  const isLooping = animationConfig?.loop !== false;

  return {
    animationType: safeAnimationType,
    label: `${animationConfig?.label || safeAnimationType} Preview`,
    sequence: [{
      animationType: safeAnimationType,
      duration: getAvatarAnimationDuration(safeAnimationType, gender, isLooping ? 2600 : 1800),
      repeatCount: isLooping ? 1 : POSE_PREVIEW_REPEAT_COUNT,
    }],
  };
};

const resolveAiPlanRaw = (aiPlanParam: unknown) => {
  const aiPlanFromQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('aiPlan') || ''
    : '';
  const aiPlanFromSession = typeof window !== 'undefined'
    ? (() => {
        try {
          return window.sessionStorage.getItem(AI_PLAN_STORAGE_KEY) || '';
        } catch (_) {
          return '';
        }
      })()
    : '';
  const rawAiPlanValue = typeof aiPlanParam === 'string' && aiPlanParam.length > 0
    ? aiPlanParam
    : aiPlanFromQuery || aiPlanFromSession;

  if (!rawAiPlanValue) {
    return '';
  }

  try {
    return decodeURIComponent(rawAiPlanValue);
  } catch (_) {
    return rawAiPlanValue;
  }
};

const inferPoseExerciseFromItem = (item: any = {}) => {
  const label = String(item?.label || '').toLowerCase();

  if (label.includes('single-leg') || label.includes('pistol')) return 'lunge';
  if (label.includes('push')) return 'pushup';
  if (label.includes('plank')) return 'plank';
  if (label.includes('sit')) return 'situp';
  if (label.includes('bicycle')) return 'bicycle_crunch';
  if (label.includes('circle')) return 'circle_crunch';
  if (label.includes('crunch')) return 'crunch';
  if (label.includes('jack')) return 'jumping_jacks';
  if (label.includes('burpee')) return 'burpee';
  if (label.includes('run')) return 'running';
  if (label.includes('warm')) return 'warmup';
  if (label.includes('tree')) return 'tree_pose';
  if (label.includes('meditat')) return 'meditation';
  if (label.includes('pike')) return 'pike_walk';
  if (label.includes('crouch')) return 'crouch_hold';
  if (label.includes('squat')) return 'squat';

  return getPoseExerciseForAnimation(item?.animationType) || '';
};

const inferPlanTarget = (item: any = {}) => {
  const key = String(item?.poseExercise || inferPoseExerciseFromItem(item) || item?.label || '').toLowerCase();

  if (key.includes('warm') || key.includes('run')) {
    return { targetValue: 60, targetUnit: 'sec', targetLabel: '60 sec' };
  }
  if (key.includes('plank') || key.includes('meditat') || key.includes('tree') || key.includes('hold')) {
    return { targetValue: 30, targetUnit: 'sec', targetLabel: '30 sec' };
  }
  if (key.includes('pistol') || key.includes('single')) {
    return { targetValue: 8, targetUnit: 'reps', targetLabel: '8 reps' };
  }

  return { targetValue: 10, targetUnit: 'reps', targetLabel: '10 reps' };
};

const normalizePlanExercise = (item: any = {}, index: number) => {
  const fallbackTarget = inferPlanTarget(item);
  const targetValue = Number(item?.targetValue);
  const targetUnit = String(item?.targetUnit || fallbackTarget.targetUnit);
  const resolvedTargetValue = Number.isFinite(targetValue) && targetValue > 0 ? targetValue : fallbackTarget.targetValue;
  const targetLabel = item?.targetLabel || `${resolvedTargetValue} ${targetUnit === 'sec' ? 'sec' : 'reps'}`;

  return {
    id: String(item?.id || item?.poseExercise || item?.animationType || item?.label || `plan-item-${index}`),
    label: String(item?.label || `Exercise ${index + 1}`),
    poseExercise: item?.poseExercise || inferPoseExerciseFromItem(item) || '',
    animationType: item?.animationType || '',
    targetValue: resolvedTargetValue,
    targetUnit,
    targetLabel,
  };
};

const formatTimerLabel = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return safeSeconds >= 3600
    ? new Date(safeSeconds * 1000).toISOString().slice(11, 19)
    : new Date(safeSeconds * 1000).toISOString().slice(14, 19);
};

export default function PoseScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const poseState = useSelector((s:any)=> s.pose || {});
  const user = useSelector((s:any) => s.user || {});
  const { currentExercise, privacyAccepted, formFeedback } = poseState;
  const weeklySquatRepsByWeek = useSelector((s:any) => s.quests?.weeklySquatRepsByWeek || {});
  const weeklyXPAwardedByWeek = useSelector((s:any) => s.quests?.weeklyXPAwardedByWeek || {});
  const { width, height: windowHeight } = useWindowDimensions();
  const selectedGender = String(user.gender || 'male');
  const selectedHeight = String(user.height || '175');
  const selectedWeight = String(user.weight || '70');
  const selectedPhotoUri = user.photoUri || '';
  const selectedModel = resolveAvatarModelSelection(user.avatarModel, selectedGender);
  const [reps, setReps] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStepStartedAt, setActiveStepStartedAt] = useState<number | null>(null);
  const [activeStepElapsedSeconds, setActiveStepElapsedSeconds] = useState(0);
  const [isWorkoutPlanRunning, setIsWorkoutPlanRunning] = useState(false);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [completedPlanIndexes, setCompletedPlanIndexes] = useState<number[]>([]);
  const [planProgressById, setPlanProgressById] = useState<Record<string, number>>({});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const avatarRef = useRef<any>(null);
  const lastFeedbackAnnouncementRef = useRef('');
  const lastFeedbackAtRef = useRef(0);
  const lastMilestoneRef = useRef(0);
  const lastMilestoneAtRef = useRef(0);
  const lastMotivationAtRef = useRef(0);
  const lastMotivationIndexRef = useRef(-1);
  const saveInFlightRef = useRef(false);
  const hasSavedSessionRef = useRef(false);
  const [demoLabel, setDemoLabel] = useState('Squat preview');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveMessageTone, setSaveMessageTone] = useState<'idle' | 'success' | 'warning'>('idle');
  const [isAutoSavingSession, setIsAutoSavingSession] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [saveSummaryModal, setSaveSummaryModal] = useState<null | {
    title: string;
    xp: number;
    calories: number;
    elapsedSeconds: number;
    nextAiPlan: string;
    subtitle?: string;
    buttonLabel?: string;
    navigateOnClose?: boolean;
  }>(null);
  const [compactOverlayOpen, setCompactOverlayOpen] = useState(false);
  const [detectorStatus, setDetectorStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [detectorError, setDetectorError] = useState('');
  const aiPlanParam = Array.isArray(params?.aiPlan) ? params.aiPlan[0] : params?.aiPlan;
  const currentExerciseDefinition = getPoseExerciseDefinition(currentExercise) || getPoseExerciseDefinition('squat');
  const metricLabel = getPoseExerciseMetricLabel(currentExercise);
  const isHoldExercise = isHoldBasedPoseExercise(currentExercise);
  const isWideLayout = Platform.OS !== 'web' && width >= 1120;
  const isCompactMobile = width < 980;
  const useCompactWebShell = Platform.OS === 'web' && isCompactMobile;
  const compactSheetHeight = Math.min(Math.max(windowHeight * 0.42, 250), 320);
  const compactSheetCollapsedOffset = -compactSheetHeight;
  const sessionMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const sessionTimerLabel = formatTimerLabel(elapsedSeconds);
  const liveCue = formFeedback || currentExerciseDefinition?.validHint || currentExerciseDefinition?.lowerHint || 'Match the guide and hold steady.';
  const sessionSummary = isHoldExercise
    ? `${reps} seconds banked`
    : `${reps} reps tracked`;
  const workoutPlan = useMemo(() => {
    const rawAiPlan = resolveAiPlanRaw(aiPlanParam);
    if (!rawAiPlan) return null;

    try {
      const parsed = JSON.parse(rawAiPlan);
      if (!parsed || typeof parsed !== 'object') return null;

      return {
        title: String(parsed?.title || 'Workout Plan'),
        summary: String(parsed?.summary || ''),
        exercises: Array.isArray(parsed?.exercises)
          ? parsed.exercises.map((item: any, index: number) => normalizePlanExercise(item, index))
          : [],
      };
    } catch (_) {
      return null;
    }
  }, [aiPlanParam]);
  const resolvedAiPlanRaw = useMemo(() => resolveAiPlanRaw(aiPlanParam), [aiPlanParam]);
  const isStructuredWorkout = !!resolvedAiPlanRaw || (Array.isArray(workoutPlan?.exercises) && workoutPlan.exercises.length > 0);
  const workoutPlanExercises = useMemo(() => {
    if (Array.isArray(workoutPlan?.exercises) && workoutPlan.exercises.length > 0) {
      return workoutPlan.exercises;
    }
    return [normalizePlanExercise({
      label: currentExerciseDefinition?.label || 'Pose workout',
      poseExercise: currentExercise,
      animationType: getPoseExerciseForAnimation(currentExercise),
      targetUnit: isHoldExercise ? 'sec' : 'reps',
      targetValue: isHoldExercise ? 30 : 10,
      targetLabel: isHoldExercise ? '30 sec' : '10 reps',
    }, 0)];
  }, [currentExercise, currentExerciseDefinition?.label, isHoldExercise, workoutPlan?.exercises]);
  const activePlanItem = workoutPlanExercises[activePlanIndex] || null;
  const activePlanProgress = activePlanItem
    ? Math.min(
        Math.max(
          Number.isFinite(planProgressById[activePlanItem.id])
            ? planProgressById[activePlanItem.id]
            : activePlanItem.targetUnit === 'sec'
              ? activeStepElapsedSeconds
              : reps,
          0,
        ),
        activePlanItem.targetValue,
      )
    : 0;
  const statCountLabel = metricLabel;
  const statCountValue = `${reps}`;
  const statCountMeta = sessionSummary;
  const statTimerValue = sessionTimerLabel;
  const statTimerMeta = isWorkoutPlanRunning && activePlanItem?.targetUnit === 'sec'
    ? `${Math.min(activePlanProgress, activePlanItem.targetValue)} / ${activePlanItem.targetLabel}`
    : isWorkoutPlanRunning
      ? 'Workout running'
      : sessionStartedAt
        ? 'Session active'
        : 'Ready to start';
  const statWorkoutMeta = isWorkoutPlanRunning
    ? `Step ${Math.min(activePlanIndex + 1, workoutPlanExercises.length)} of ${workoutPlanExercises.length}`
    : isHoldExercise ? 'Hold mode' : 'Rep mode';
  const visiblePlanIndex = Math.max(
    0,
    isWorkoutPlanRunning
      ? activePlanIndex
      : workoutPlanExercises.findIndex((item) => item.poseExercise === currentExercise),
  );
  const compactVisiblePlanWindowStart = Math.min(
    Math.max(visiblePlanIndex - 1, 0),
    Math.max(workoutPlanExercises.length - 3, 0),
  );
  const compactVisiblePlanItems = workoutPlanExercises.slice(compactVisiblePlanWindowStart, compactVisiblePlanWindowStart + 3);
  const compactPlanListHeight = 68;
  const compactOverlayTopOffset = 144 + compactPlanListHeight;
  const hasWorkoutPlanStarted = isWorkoutPlanRunning || elapsedSeconds > 0 || completedPlanIndexes.length > 0 || Object.keys(planProgressById).length > 0;

  const compactSheetTranslateY = useRef(new Animated.Value(compactSheetCollapsedOffset)).current;

  useEffect(() => {
    Animated.spring(compactSheetTranslateY, {
      toValue: compactOverlayOpen ? 0 : compactSheetCollapsedOffset,
      useNativeDriver: true,
      bounciness: 0,
      speed: 22,
    }).start();
  }, [compactOverlayOpen, compactSheetCollapsedOffset, compactSheetTranslateY]);

  const handleDetectorMessage = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'reps') {
      setReps(data.payload?.reps || 0);
      dispatch(incrementPoseRep());
      return;
    }

    if (data.type === 'feedback' && data.payload?.text) {
      dispatch(setFormFeedback(data.payload.text));
      return;
    }

    if (data.type === 'ready') {
      setDetectorStatus('ready');
      setDetectorError('');
      return;
    }

    if (data.type === 'error') {
      const rawError = String(data.payload || '').trim();
      const permissionBlocked = /NotAllowedError|Permission|denied/i.test(rawError);
      setDetectorStatus('error');
      setDetectorError(
        permissionBlocked
          ? 'Camera access is blocked in the browser. Allow camera access for localhost and reload the workout.'
          : rawError || 'Pose detector failed to initialize.'
      );
    }
  }, [dispatch]);

  const onNativeMessage = useCallback((ev:any) => {
    try {
      handleDetectorMessage(JSON.parse(ev.nativeEvent.data));
    } catch (_) {}
  }, [handleDetectorMessage]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      handleDetectorMessage(event.data);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleDetectorMessage]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || detectorStatus === 'ready') return;

    const syncDetectorStatus = () => {
      const statusText = iframeRef.current?.contentDocument?.getElementById('status')?.textContent?.trim() || '';
      if (!statusText) return;

      if (/detecting/i.test(statusText)) {
        setDetectorStatus('ready');
        setDetectorError('');
        return;
      }

      if (/starting camera session|loading model|camera\.\.\./i.test(statusText)) {
        return;
      }

      if (/blocked|error|failed/i.test(statusText)) {
        setDetectorStatus('error');
        setDetectorError(statusText);
      }
    };

    syncDetectorStatus();
    const intervalId = window.setInterval(syncDetectorStatus, 600);
    return () => window.clearInterval(intervalId);
  }, [detectorStatus]);

  useEffect(() => {
    if (!privacyAccepted) {
      setDetectorStatus('idle');
      setDetectorError('');
    }
  }, [privacyAccepted]);

  // Send config when exercise changes
  useEffect(()=>{
    if (Platform.OS === 'web') {
      try { iframeRef.current?.contentWindow?.postMessage({ type:'config', exercise: currentExercise }, '*'); } catch(_) {}
    }
  }, [currentExercise]);

  const playPoseDemo = useCallback((exercise = currentExercise) => {
    const definition = getPoseExerciseDefinition(exercise) || getPoseExerciseDefinition('squat');
    const animationType = definition?.animationType || AVATAR_ANIMATIONS.SQUAT;
    const demo = buildStablePosePreviewDemo(animationType, selectedGender);
    const label = `${definition?.label || 'Form'} preview`;

    setDemoLabel(label);
    if (demo) {
      avatarRef.current?.setCameraShot?.('full');
      avatarRef.current?.triggerWorkoutDemo?.(demo, { returnToIdle: false });
    }
  }, [currentExercise, selectedGender]);

  const handlePoseBack = useCallback(() => {
    try {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
        return;
      }
    } catch (_) {}

    try {
      router.replace('/Workout');
    } catch (_) {
      router.push('/Workout');
    }
  }, [router]);

  const navigateToWorkoutAfterSave = useCallback((sessionTitle: string, nextAiPlan: string) => {
    router.replace(nextAiPlan
      ? { pathname: '/Workout', params: { aiPlan: nextAiPlan, sessionSaved: '1', sessionSavedTitle: sessionTitle } }
      : { pathname: '/Workout', params: { sessionSaved: '1', sessionSavedTitle: sessionTitle } });
  }, [router]);

  const handleCloseSaveSummaryModal = useCallback(() => {
    if (!saveSummaryModal) return;
    const { title, nextAiPlan, navigateOnClose = true } = saveSummaryModal;
    setSaveSummaryModal(null);
    if (navigateOnClose) {
      navigateToWorkoutAfterSave(title, nextAiPlan);
    }
  }, [navigateToWorkoutAfterSave, saveSummaryModal]);

  const speakCoachLine = useCallback((message: string) => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage || Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(nextMessage);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => playPoseDemo(currentExercise), 250);
    return () => clearTimeout(timer);
  }, [currentExercise, playPoseDemo]);

  useEffect(() => {
    lastFeedbackAnnouncementRef.current = '';
    lastFeedbackAtRef.current = 0;
    lastMilestoneRef.current = 0;
    lastMilestoneAtRef.current = 0;
    lastMotivationAtRef.current = 0;
    lastMotivationIndexRef.current = -1;
  }, [currentExercise, privacyAccepted]);

  useEffect(() => {
    if (!privacyAccepted || !formFeedback) return;

    const nextFeedback = String(formFeedback).trim();
    if (!nextFeedback) return;

    const now = Date.now();
    if (nextFeedback === lastFeedbackAnnouncementRef.current) return;
    if (now - lastFeedbackAtRef.current < FEEDBACK_COOLDOWN_MS) return;

    if (speakCoachLine(nextFeedback)) {
      lastFeedbackAnnouncementRef.current = nextFeedback;
      lastFeedbackAtRef.current = now;
    }
  }, [formFeedback, privacyAccepted, speakCoachLine]);

  useEffect(() => {
    if (!privacyAccepted || reps <= 0) return;

    const milestones = isHoldExercise ? HOLD_MILESTONES : REP_MILESTONES;
    const reachedMilestone = milestones.filter((value) => reps >= value).pop();
    if (!reachedMilestone || reachedMilestone <= lastMilestoneRef.current) return;

    const now = Date.now();
    if (now - lastMilestoneAtRef.current < MILESTONE_COOLDOWN_MS) return;

    const message = isHoldExercise
      ? `${reachedMilestone} seconds. Hold it strong.`
      : reachedMilestone === 5
        ? 'Five reps. Nice start.'
        : `${reachedMilestone} reps. Keep it going.`;

    if (speakCoachLine(message)) {
      lastMilestoneRef.current = reachedMilestone;
      lastMilestoneAtRef.current = now;
    }
  }, [isHoldExercise, privacyAccepted, reps, speakCoachLine]);

  useEffect(() => {
    if (!privacyAccepted || elapsedSeconds < 18) return;

    const now = Date.now();
    if (now - lastMotivationAtRef.current < MOTIVATION_COOLDOWN_MS) return;

    const nextIndex = (lastMotivationIndexRef.current + 1) % MOTIVATION_LINES.length;
    const message = MOTIVATION_LINES[nextIndex];

    if (speakCoachLine(message)) {
      lastMotivationIndexRef.current = nextIndex;
      lastMotivationAtRef.current = now;
    }
  }, [elapsedSeconds, privacyAccepted, speakCoachLine]);

  useEffect(() => {
    if (!isWorkoutPlanRunning || !sessionStartedAt) return;

    const syncElapsedSeconds = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000)));
    };

    syncElapsedSeconds();
    const intervalId = setInterval(syncElapsedSeconds, 250);
    return () => clearInterval(intervalId);
  }, [isWorkoutPlanRunning, sessionStartedAt]);

  useEffect(() => {
    if (!isWorkoutPlanRunning || !activeStepStartedAt) return;

    const syncActiveStepElapsedSeconds = () => {
      setActiveStepElapsedSeconds(Math.max(0, Math.floor((Date.now() - activeStepStartedAt) / 1000)));
    };

    syncActiveStepElapsedSeconds();
    const intervalId = setInterval(syncActiveStepElapsedSeconds, 250);
    return () => clearInterval(intervalId);
  }, [activeStepStartedAt, isWorkoutPlanRunning]);

  const resetDetectorCounter = useCallback(() => {
    setReps(0);
    dispatch(resetPoseSession());
    if (Platform.OS === 'web') {
      try { iframeRef.current?.contentWindow?.postMessage({ type: 'reset' }, '*'); } catch (_) {}
    }
  }, [dispatch]);

  const handleSelectCompactPlanItem = useCallback((index: number) => {
    const item = workoutPlanExercises[index];
    if (!item?.poseExercise) return;

    dispatch(setPoseExercise(item.poseExercise));
    if (isWorkoutPlanRunning) {
      setActivePlanIndex(index);
      setActiveStepStartedAt(Date.now());
      setActiveStepElapsedSeconds(0);
      resetDetectorCounter();
    }
  }, [dispatch, isWorkoutPlanRunning, resetDetectorCounter, workoutPlanExercises]);

  const startWorkoutPlan = useCallback(() => {
    const firstItem = workoutPlanExercises[0];
    if (!firstItem) return;

    saveInFlightRef.current = false;
    hasSavedSessionRef.current = false;
    setHasSavedSession(false);
    setIsAutoSavingSession(false);
    setPlanProgressById({});
    setCompletedPlanIndexes([]);
    setActivePlanIndex(0);
    setIsWorkoutPlanRunning(true);
    setSessionStartedAt(Date.now());
    setActiveStepStartedAt(Date.now());
    setActiveStepElapsedSeconds(0);
    setElapsedSeconds(0);
    setSaveMessage(isStructuredWorkout ? 'Workout started. Session auto-saves when all moves are complete.' : 'Workout started. Warm-up begins now.');
    setSaveMessageTone('idle');

    if (firstItem.poseExercise) {
      dispatch(setPoseExercise(firstItem.poseExercise));
      playPoseDemo(firstItem.poseExercise);
    }

    resetDetectorCounter();
    speakCoachLine(`Starting ${workoutPlan?.title || 'your workout'}. First up: ${firstItem.label}.`);
  }, [dispatch, isStructuredWorkout, playPoseDemo, resetDetectorCounter, speakCoachLine, workoutPlan?.title, workoutPlanExercises]);

  const stopWorkoutPlan = useCallback(() => {
    if (!isWorkoutPlanRunning) return;

    setIsWorkoutPlanRunning(false);
    setActiveStepStartedAt(null);
    setSaveMessage('Workout paused. Continue when you are ready or save your progress.');
    setSaveMessageTone('idle');
    speakCoachLine('Workout paused.');
  }, [isWorkoutPlanRunning, speakCoachLine]);

  const continueWorkoutPlan = useCallback(() => {
    if (isWorkoutPlanRunning || !hasWorkoutPlanStarted) return;

    const resumedSessionStartedAt = Date.now() - (elapsedSeconds * 1000);
    const resumedActiveStepStartedAt = Date.now() - (activeStepElapsedSeconds * 1000);

    setIsWorkoutPlanRunning(true);
    setSessionStartedAt(resumedSessionStartedAt);
    setActiveStepStartedAt(resumedActiveStepStartedAt);
    setSaveMessage('Workout resumed. Keep going.');
    setSaveMessageTone('idle');

    if (activePlanItem?.poseExercise) {
      dispatch(setPoseExercise(activePlanItem.poseExercise));
    }

    speakCoachLine(`Continuing ${workoutPlan?.title || 'your workout'}.`);
  }, [activePlanItem?.poseExercise, activeStepElapsedSeconds, dispatch, elapsedSeconds, hasWorkoutPlanStarted, isWorkoutPlanRunning, speakCoachLine, workoutPlan?.title]);

  const saveSession = useCallback((options?: {
    progressById?: Record<string, number>;
    completedIndexes?: number[];
    auto?: boolean;
  }) => {
    if (saveInFlightRef.current || hasSavedSessionRef.current) return;

    const progressSnapshot = options?.progressById || planProgressById;
    const completedIndexesSnapshot = options?.completedIndexes || completedPlanIndexes;
    const totalTrackedValueSnapshot = workoutPlanExercises.reduce((sum, item, index) => {
      const storedProgress = progressSnapshot[item.id];
      const liveProgress = index === activePlanIndex ? reps : 0;
      const resolvedProgress = Number.isFinite(storedProgress) ? storedProgress : liveProgress;

      return sum + Math.min(Math.max(resolvedProgress || 0, 0), item.targetValue);
    }, 0);

    if (totalTrackedValueSnapshot <= 0) {
      setSaveMessage(isHoldExercise ? 'Hold the pose before saving this session.' : 'Complete at least 1 rep before saving.');
      setSaveMessageTone('warning');
      if (!options?.auto) {
        setSaveSummaryModal({
          title: 'No workout saved yet',
          xp: 0,
          calories: 0,
          elapsedSeconds,
          nextAiPlan: '',
          subtitle: isHoldExercise ? 'Hold the pose for a few seconds before saving.' : 'Complete at least 1 rep before saving.',
          buttonLabel: 'Keep Training',
          navigateOnClose: false,
        });
      }
      return;
    }

    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
    const calories = Math.max(40, Math.round(totalTrackedValueSnapshot * 0.5));
    const exerciseLabel = currentExerciseDefinition?.label || currentExercise;
    const sessionTitle = workoutPlan?.title || `${exerciseLabel} (pose)`;
    const sessionNotes = isHoldExercise
      ? `Tracked ${totalTrackedValueSnapshot} seconds via pose hold detection`
      : `Auto-counted ${totalTrackedValueSnapshot} reps via pose`;
    const nextAiPlan = resolvedAiPlanRaw || (workoutPlan ? JSON.stringify(workoutPlan) : '');

    const sessionRecord = createWorkoutSessionRecord({
      title: sessionTitle,
      durationMin,
      calories,
      notes: workoutPlan?.summary ? `${sessionNotes}. ${workoutPlan.summary}` : sessionNotes,
      type: currentExercise,
      reps: String(totalTrackedValueSnapshot),
      exerciseDetails: workoutPlanExercises.map((item, index) => {
        const progressValue = completedIndexesSnapshot.includes(index)
          ? item.targetValue
          : Math.min(
            Math.max(
              Number.isFinite(progressSnapshot[item.id])
                ? progressSnapshot[item.id]
                : index === activePlanIndex
                  ? item.targetUnit === 'sec' ? activeStepElapsedSeconds : reps
                  : 0,
              0,
            ),
            item.targetValue,
          );
        const isCurrentPlanItem = index === activePlanIndex;

        return {
          label: item.label,
          type: item.poseExercise || item.animationType || currentExercise,
          reps: item.targetUnit === 'reps' ? progressValue : 0,
          seconds: item.targetUnit === 'sec' ? progressValue : 0,
          targetReps: item.targetUnit === 'reps' ? item.targetValue : 0,
          targetSeconds: item.targetUnit === 'sec' ? item.targetValue : 0,
          targetLabel: item.targetLabel,
          status: completedIndexesSnapshot.includes(index) || progressValue >= item.targetValue ? 'completed' : isWorkoutPlanRunning && isCurrentPlanItem ? 'in-progress' : progressValue > 0 ? 'in-progress' : 'planned',
          durationMin,
        };
      }),
    });

    saveInFlightRef.current = true;
    if (options?.auto) {
      setIsAutoSavingSession(true);
      setSaveMessage('Workout complete. Saving session and returning to Workout...');
      setSaveMessageTone('success');
    }

    dispatch(addWorkoutSession({
      date: dateKey,
      session: sessionRecord as any,
    }));
    let weeklyBonusXP = 0;
    if (currentExercise === 'squat') {
      dispatch(addWeeklySquatReps({ date: dateKey, reps: totalTrackedValueSnapshot }));
      const dt = new Date(dateKey + 'T00:00:00');
      const target = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
      const week = 1 + Math.floor(diff / 7);
      const weekKey = `${target.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
      const total = (weeklySquatRepsByWeek[weekKey] || 0) + totalTrackedValueSnapshot;
      const WEEK_GOAL = 100; const WEEK_XP = 100;
      if (!weeklyXPAwardedByWeek[weekKey] && total >= WEEK_GOAL) {
        weeklyBonusXP = WEEK_XP;
        dispatch(addXP({
          amount: WEEK_XP,
          source: 'weekly_goal',
          title: 'Weekly squat goal complete',
          subtitle: `${WEEK_XP} XP for reaching 100 reps`,
        }));
        dispatch(addBadgeXP({
          amount: WEEK_XP,
          categories: ['workout', 'strongman', 'mass'],
        }));
        dispatch(markWeeklyXPAwarded({ weekKey }));
      }
    }

    hasSavedSessionRef.current = true;
    setHasSavedSession(true);
    setSaveMessage(options?.auto
      ? `${sessionTitle} saved. XP awarded. Returning to Workout...`
      : `${sessionTitle} saved with ${workoutPlanExercises.length} planned move${workoutPlanExercises.length === 1 ? '' : 's'}. XP awarded.`);
    setSaveMessageTone('success');

    if (options?.auto) {
      navigateToWorkoutAfterSave(sessionTitle, nextAiPlan);
      return;
    }

    setSaveSummaryModal({
      title: sessionTitle,
      xp: Math.max(0, Number(sessionRecord.awardedXP) || 0) + weeklyBonusXP,
      calories,
      elapsedSeconds,
      nextAiPlan,
      subtitle: 'Here is your session result.',
      buttonLabel: 'Close',
      navigateOnClose: false,
    });
  }, [activePlanIndex, activeStepElapsedSeconds, completedPlanIndexes, currentExercise, currentExerciseDefinition?.label, dispatch, elapsedSeconds, isHoldExercise, isWorkoutPlanRunning, navigateToWorkoutAfterSave, planProgressById, reps, resolvedAiPlanRaw, workoutPlan, workoutPlanExercises, weeklySquatRepsByWeek, weeklyXPAwardedByWeek]);

  const advanceWorkoutPlan = useCallback(() => {
    if (!isWorkoutPlanRunning || !activePlanItem) return;

    const currentItem = activePlanItem;
    const nextIndex = activePlanIndex + 1;

    setPlanProgressById((prev) => ({
      ...prev,
      [currentItem.id]: currentItem.targetValue,
    }));
    setCompletedPlanIndexes((prev) => prev.includes(activePlanIndex) ? prev : [...prev, activePlanIndex]);

    if (nextIndex >= workoutPlanExercises.length) {
      const completedProgressSnapshot = {
        ...planProgressById,
        [currentItem.id]: currentItem.targetValue,
      };
      const completedIndexesSnapshot = completedPlanIndexes.includes(activePlanIndex)
        ? completedPlanIndexes
        : [...completedPlanIndexes, activePlanIndex];
      setIsWorkoutPlanRunning(false);
      setSaveMessage(isStructuredWorkout ? 'Workout plan complete. Saving session and returning to Workout...' : 'Workout plan complete. Save session when ready.');
      setSaveMessageTone('success');
      speakCoachLine(isStructuredWorkout ? 'Workout complete. Nice job. Saving your session now.' : 'Workout complete. Nice job.');
      if (isStructuredWorkout) {
        saveSession({
          progressById: completedProgressSnapshot,
          completedIndexes: completedIndexesSnapshot,
          auto: true,
        });
      }
      return;
    }

    const nextItem = workoutPlanExercises[nextIndex];
    setActivePlanIndex(nextIndex);
    setActiveStepStartedAt(Date.now());
    setActiveStepElapsedSeconds(0);
    setSaveMessage(`${currentItem.label} complete. ${nextItem.label} is up next.`);
    setSaveMessageTone('idle');

    if (nextItem.poseExercise) {
      dispatch(setPoseExercise(nextItem.poseExercise));
      playPoseDemo(nextItem.poseExercise);
    }

    resetDetectorCounter();
    speakCoachLine(`${currentItem.label} complete. Next: ${nextItem.label}.`);
  }, [activePlanIndex, activePlanItem, completedPlanIndexes, dispatch, isStructuredWorkout, isWorkoutPlanRunning, planProgressById, playPoseDemo, resetDetectorCounter, saveSession, speakCoachLine, workoutPlanExercises]);

  useEffect(() => {
    if (!isWorkoutPlanRunning || !activePlanItem?.id) return;

    setPlanProgressById((prev) => {
      const nextValue = Math.min(reps, activePlanItem.targetValue);
      const resolvedValue = Math.min(activePlanItem.targetUnit === 'sec' ? activeStepElapsedSeconds : reps, activePlanItem.targetValue);
      if (prev[activePlanItem.id] === resolvedValue) {
        return prev;
      }

      return {
        ...prev,
        [activePlanItem.id]: resolvedValue,
      };
    });
  }, [activePlanItem, activeStepElapsedSeconds, isWorkoutPlanRunning, reps]);

  useEffect(() => {
    if (!isWorkoutPlanRunning || !activePlanItem) return;
    if (activePlanProgress < activePlanItem.targetValue) return;

    advanceWorkoutPlan();
  }, [activePlanItem, activePlanProgress, advanceWorkoutPlan, isWorkoutPlanRunning]);

  const reset = () => {
    saveInFlightRef.current = false;
    hasSavedSessionRef.current = false;
    setHasSavedSession(false);
    setIsAutoSavingSession(false);
    setIsWorkoutPlanRunning(false);
    setActivePlanIndex(0);
    setCompletedPlanIndexes([]);
    setPlanProgressById({});
    setSessionStartedAt(null);
    setActiveStepStartedAt(null);
    setActiveStepElapsedSeconds(0);
    setElapsedSeconds(0);
    setSaveMessage('');
    setSaveMessageTone('idle');
    resetDetectorCounter();
  };

  const iframeSrc = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return '';

    const htmlBlob = new Blob([POSE_DETECTOR_HTML], { type: 'text/html' });
    return window.URL.createObjectURL(htmlBlob);
  }, []);

  useEffect(() => {
    if (!iframeSrc || Platform.OS !== 'web' || typeof window === 'undefined') return;

    return () => {
      window.URL.revokeObjectURL(iframeSrc);
    };
  }, [iframeSrc]);

  const iframeStyle: any = { border: '0', width: '100%', height: '100%', display: 'block' };

  const renderExerciseAvatarCard = () => {
    if (isCompactMobile) {
      return (
        <View style={[styles.panelCardCompact, styles.avatarCard, styles.avatarCardCompact]}>
          <View style={styles.avatarCardHeaderCompact}>
            <View style={styles.avatarCardTitleWrapCompact}>
              <Text style={styles.sectionEyebrow}>Avatar Guide</Text>
              <Text style={styles.avatarCardTitleCompact}>{currentExerciseDefinition?.label || 'Form'} preview</Text>
              <Text style={styles.avatarCardMetaCompact}>{demoLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => playPoseDemo(currentExercise)} activeOpacity={0.85}>
              <LinearGradient colors={["#00E7FF", "#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.replayBtnCompact}>
                <Text style={styles.replayBtnText}>Replay</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View style={[styles.avatarStage, styles.avatarStageCompact, styles.avatarStageCompactMobile]}>
            <InteractiveAvatar
              ref={avatarRef}
              model={selectedModel}
              gender={selectedGender}
              height={selectedHeight}
              weight={selectedWeight}
              photoUri={selectedPhotoUri}
              enableVoice={false}
              enableTTS={true}
              sizeMultiplier={0.82}
              yOffset={-0.05}
              alignFootToBottom={true}
              bottomPadding={0.02}
            />
          </View>
          <View style={styles.mergedCardDivider} />
          <View style={styles.compactMovePickerHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Switch Movement</Text>
              <Text style={styles.compactMovePickerTitle}>Quick exercise picker</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{statWorkoutMeta}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseChipRow}>
            {POSE_EXERCISE_OPTIONS.map((exerciseOption) => {
              const isActive = currentExercise === exerciseOption.key;
              return (
                <TouchableOpacity
                  key={exerciseOption.key}
                  onPress={() => dispatch(setPoseExercise(exerciseOption.key))}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={isActive ? ['#00E7FF', '#6A00FF'] : ['rgba(28,36,54,0.96)', 'rgba(10,14,22,0.96)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.exerciseChip, isActive && styles.exerciseChipActive]}
                  >
                    <Text style={styles.exerciseChipText}>{exerciseOption.chipLabel}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    const exerciseContent = isCompactMobile ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseChipRow}>
        {POSE_EXERCISE_OPTIONS.map((exerciseOption) => {
          const isActive = currentExercise === exerciseOption.key;
          return (
            <TouchableOpacity
              key={exerciseOption.key}
              onPress={() => dispatch(setPoseExercise(exerciseOption.key))}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isActive ? ['#00E7FF', '#6A00FF'] : ['rgba(28,36,54,0.96)', 'rgba(10,14,22,0.96)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.exerciseChip, isActive && styles.exerciseChipActive]}
              >
                <Text style={styles.exerciseChipText}>{exerciseOption.chipLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    ) : (
      <ScrollView style={styles.exerciseGridViewport} showsVerticalScrollIndicator={false}>
        <View style={styles.exerciseGrid}>
          {POSE_EXERCISE_OPTIONS.map((exerciseOption) => {
            const isActive = currentExercise === exerciseOption.key;
            return (
              <TouchableOpacity
                key={exerciseOption.key}
                onPress={() => dispatch(setPoseExercise(exerciseOption.key))}
                activeOpacity={0.85}
                style={styles.exerciseCardTouch}
              >
                <LinearGradient
                  colors={isActive ? ['#00E7FF', '#6A00FF'] : ['rgba(28,36,54,0.96)', 'rgba(10,14,22,0.96)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.exerciseCard, isActive && styles.exerciseCardActive]}
                >
                  <Text style={[styles.exerciseCardText, isActive && styles.exerciseCardTextActive]}>{exerciseOption.chipLabel}</Text>
                  <Text style={[styles.exerciseCardSubtext, isActive && styles.exerciseCardSubtextActive]}>{exerciseOption.mode.includes('hold') ? 'Hold focus' : 'Rep flow'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );

    return (
      <View style={[isCompactMobile ? styles.panelCardCompact : styles.panelCard, styles.avatarCard, isCompactMobile && styles.avatarCardCompact]}>
        <View style={isCompactMobile ? styles.sectionHeaderCompact : styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Exercise Library</Text>
            <Text style={isCompactMobile ? styles.sectionTitleCompact : styles.sectionTitle}>{isCompactMobile ? 'Switch movement' : 'Choose a movement to track'}</Text>
          </View>
          {!isCompactMobile ? (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{POSE_EXERCISE_OPTIONS.length} modes</Text>
            </View>
          ) : null}
        </View>
        {exerciseContent}
        <View style={styles.mergedCardDivider} />
        <View style={styles.avatarCardHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Avatar Guide</Text>
            <Text style={isCompactMobile ? styles.avatarCardTitleCompact : styles.avatarCardTitle}>Avatar form preview</Text>
            {!isCompactMobile ? <Text style={styles.avatarCardMeta}>{demoLabel}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => playPoseDemo(currentExercise)} activeOpacity={0.85}>
            <LinearGradient colors={["#00E7FF", "#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.replayBtn}>
              <Text style={styles.replayBtnText}>Replay</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={[styles.avatarStage, isCompactMobile && styles.avatarStageCompact]}>
          <InteractiveAvatar
            ref={avatarRef}
            model={selectedModel}
            gender={selectedGender}
            height={selectedHeight}
            weight={selectedWeight}
            photoUri={selectedPhotoUri}
            enableVoice={false}
            enableTTS={true}
            sizeMultiplier={0.88}
            yOffset={-0.05}
            alignFootToBottom={true}
            bottomPadding={0.02}
          />
        </View>
      </View>
    );
  };

  const renderCompactDetailCard = () => {
    const isGuideTab = compactDetailTab === 'guide';

    return (
      <View style={styles.panelCardCompact}>
        <View style={styles.compactDetailHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Session Tools</Text>
            <Text style={styles.sectionTitleCompact}>{isGuideTab ? 'Form guide' : 'Workout plan'}</Text>
          </View>
          <View style={styles.compactTabRow}>
            <TouchableOpacity
              onPress={() => setCompactDetailTab('guide')}
              activeOpacity={0.85}
              style={[styles.compactTabButton, isGuideTab && styles.compactTabButtonActive]}
            >
              <Text style={[styles.compactTabButtonText, isGuideTab && styles.compactTabButtonTextActive]}>Guide</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCompactDetailTab('plan')}
              activeOpacity={0.85}
              style={[styles.compactTabButton, !isGuideTab && styles.compactTabButtonActive]}
            >
              <Text style={[styles.compactTabButtonText, !isGuideTab && styles.compactTabButtonTextActive]}>Plan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isGuideTab ? (
          <>
            <Text style={[styles.guideText, styles.guideTextCompact]}>{currentExerciseDefinition?.help || 'Match the pose guide to start tracking.'}</Text>
            <View style={styles.tipPills}>
              {currentExerciseDefinition?.lowerHint ? (
                <View style={styles.tipPill}>
                  <Text style={styles.tipPillText}>Drive: {currentExerciseDefinition.lowerHint}</Text>
                </View>
              ) : null}
              {currentExerciseDefinition?.upperHint ? (
                <View style={styles.tipPill}>
                  <Text style={styles.tipPillText}>Reset: {currentExerciseDefinition.upperHint}</Text>
                </View>
              ) : null}
              {currentExerciseDefinition?.validHint ? (
                <View style={styles.tipPill}>
                  <Text style={styles.tipPillText}>Lock in: {currentExerciseDefinition.validHint}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.sectionHeaderCompact, styles.compactPlanHeader]}>
              <View style={styles.compactPlanTitleWrap}>
                <Text style={styles.compactPlanTitle}>{workoutPlan?.title || 'Current session targets'}</Text>
                {workoutPlan?.summary ? <Text style={[styles.guideText, styles.guideTextCompact, styles.planSummaryCompact]}>{workoutPlan.summary}</Text> : null}
              </View>
              <TouchableOpacity onPress={isWorkoutPlanRunning ? stopWorkoutPlan : hasWorkoutPlanStarted ? continueWorkoutPlan : startWorkoutPlan} activeOpacity={0.85}>
                <LinearGradient colors={['#00E7FF', '#6A00FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planStartButtonCompact}>
                  <Text style={styles.planStartButtonText}>{isWorkoutPlanRunning ? 'Stop' : hasWorkoutPlanStarted ? 'Continue' : 'Start'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <View style={styles.planList}>
              {workoutPlanExercises.map((item, index) => {
                const storedProgress = planProgressById[item.id];
                const progressValue = completedPlanIndexes.includes(index)
                  ? item.targetValue
                  : Math.min(
                    Math.max(
                      Number.isFinite(storedProgress)
                        ? storedProgress
                        : isWorkoutPlanRunning && index === activePlanIndex
                          ? item.targetUnit === 'sec' ? activeStepElapsedSeconds : reps
                          : item.poseExercise === currentExercise
                            ? reps
                            : 0,
                      0,
                    ),
                    item.targetValue,
                  );
                const isActiveItem = isWorkoutPlanRunning ? index === activePlanIndex : item.poseExercise === currentExercise;
                const isCompletedItem = completedPlanIndexes.includes(index) || progressValue >= item.targetValue;
                const progressLabel = item.targetUnit === 'sec'
                  ? `${progressValue}s / ${item.targetValue}s`
                  : `${progressValue} / ${item.targetValue} reps`;

                return (
                  <TouchableOpacity
                    key={`${item.id}-${index}`}
                    onPress={() => {
                      if (!item.poseExercise) return;
                      dispatch(setPoseExercise(item.poseExercise));
                      if (isWorkoutPlanRunning) {
                        setActivePlanIndex(index);
                        setActiveStepStartedAt(Date.now());
                        setActiveStepElapsedSeconds(0);
                        resetDetectorCounter();
                      }
                    }}
                    activeOpacity={item.poseExercise ? 0.85 : 1}
                    style={[styles.planItem, isActiveItem && styles.planItemActive]}
                  >
                    <View style={styles.planItemIndex}>
                      <Text style={styles.planItemIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.planItemBody}>
                      <Text style={styles.planItemLabel}>{item.label}</Text>
                      <Text style={styles.planItemMeta}>{item.targetLabel}</Text>
                    </View>
                    <View style={styles.planItemProgress}>
                      <Text style={[styles.planItemProgressText, isActiveItem && styles.planItemProgressTextActive]}>
                        {isCompletedItem ? 'Done' : isActiveItem ? progressLabel : 'Queued'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderGuidanceCard = () => (
    <View style={isCompactMobile ? styles.panelCardCompact : styles.panelCard}>
      <Text style={styles.sectionEyebrow}>Form Guide</Text>
      <Text style={isCompactMobile ? styles.sectionTitleCompact : styles.sectionTitle}>How to score this move</Text>
      <Text style={[styles.guideText, isCompactMobile && styles.guideTextCompact]}>{currentExerciseDefinition?.help || 'Match the pose guide to start tracking.'}</Text>
      <View style={styles.tipPills}>
        {currentExerciseDefinition?.lowerHint ? (
          <View style={styles.tipPill}>
            <Text style={styles.tipPillText}>Drive: {currentExerciseDefinition.lowerHint}</Text>
          </View>
        ) : null}
        {currentExerciseDefinition?.upperHint ? (
          <View style={styles.tipPill}>
            <Text style={styles.tipPillText}>Reset: {currentExerciseDefinition.upperHint}</Text>
          </View>
        ) : null}
        {currentExerciseDefinition?.validHint ? (
          <View style={styles.tipPill}>
            <Text style={styles.tipPillText}>Lock in: {currentExerciseDefinition.validHint}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const renderWorkoutPlanCard = () => (
    <View style={isCompactMobile ? styles.panelCardCompact : styles.panelCard}>
      <View style={isCompactMobile ? styles.sectionHeaderCompact : styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Workout Plan</Text>
          <Text style={isCompactMobile ? styles.sectionTitleCompact : styles.sectionTitle}>{workoutPlan?.title || 'Current session targets'}</Text>
        </View>
        <View style={styles.planHeaderActions}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{workoutPlanExercises.length} moves</Text>
          </View>
          <TouchableOpacity onPress={isWorkoutPlanRunning ? stopWorkoutPlan : hasWorkoutPlanStarted ? continueWorkoutPlan : startWorkoutPlan} activeOpacity={0.85}>
            <LinearGradient colors={['#00E7FF', '#6A00FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planStartButton}>
              <Text style={styles.planStartButtonText}>{isWorkoutPlanRunning ? 'Stop' : hasWorkoutPlanStarted ? 'Continue' : 'Start Workout'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      {workoutPlan?.summary ? <Text style={[styles.guideText, isCompactMobile && styles.guideTextCompact, styles.planSummary]}>{workoutPlan.summary}</Text> : null}
      <View style={styles.planList}>
        {workoutPlanExercises.map((item, index) => {
          const storedProgress = planProgressById[item.id];
          const progressValue = completedPlanIndexes.includes(index)
            ? item.targetValue
            : Math.min(
            Math.max(
              Number.isFinite(storedProgress)
                ? storedProgress
                : isWorkoutPlanRunning && index === activePlanIndex
                  ? item.targetUnit === 'sec' ? activeStepElapsedSeconds : reps
                  : item.poseExercise === currentExercise
                    ? reps
                    : 0,
              0,
            ),
            item.targetValue,
          );
          const isActiveItem = isWorkoutPlanRunning ? index === activePlanIndex : item.poseExercise === currentExercise;
          const isCompletedItem = completedPlanIndexes.includes(index) || progressValue >= item.targetValue;
          const progressLabel = item.targetUnit === 'sec'
            ? `${progressValue}s / ${item.targetValue}s`
            : `${progressValue} / ${item.targetValue} reps`;

          return (
            <TouchableOpacity
              key={`${item.id}-${index}`}
              onPress={() => {
                if (!item.poseExercise) return;
                dispatch(setPoseExercise(item.poseExercise));
                if (isWorkoutPlanRunning) {
                  setActivePlanIndex(index);
                  setActiveStepStartedAt(Date.now());
                  setActiveStepElapsedSeconds(0);
                  resetDetectorCounter();
                }
              }}
              activeOpacity={item.poseExercise ? 0.85 : 1}
              style={[styles.planItem, isActiveItem && styles.planItemActive]}
            >
              <View style={styles.planItemIndex}>
                <Text style={styles.planItemIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.planItemBody}>
                <Text style={styles.planItemLabel}>{item.label}</Text>
                <Text style={styles.planItemMeta}>{item.targetLabel}</Text>
              </View>
              <View style={styles.planItemProgress}>
                <Text style={[styles.planItemProgressText, isActiveItem && styles.planItemProgressTextActive]}>
                  {isCompletedItem ? 'Done' : isActiveItem ? progressLabel : 'Queued'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderActionBar = () => (
    <View style={[styles.actionBar, isCompactMobile && styles.actionBarCompact, useCompactWebShell && styles.actionBarCompactWeb]}>
      <View>
        <Text style={isCompactMobile ? styles.actionBarTitleCompact : styles.actionBarTitle}>{metricLabel}: {reps}</Text>
        <Text style={[
          styles.actionBarMeta,
          isCompactMobile && styles.actionBarMetaCompact,
          saveMessageTone === 'success' && styles.actionBarMetaSuccess,
          saveMessageTone === 'warning' && styles.actionBarMetaWarning,
        ]}>
          {saveMessage || `${currentExerciseDefinition?.label || 'Pose training'} in progress`}
        </Text>
      </View>
      <View style={[styles.actionButtons, isCompactMobile && styles.actionButtonsCompact]}>
        <PillButton label="Reset" onPress={reset} variant="secondary" />
        <PillButton
          label={isAutoSavingSession ? 'Saving...' : hasSavedSession ? 'Saved' : isStructuredWorkout ? 'Save Now' : 'Save Session'}
          onPress={hasSavedSession || isAutoSavingSession ? undefined : () => saveSession()}
        />
      </View>
    </View>
  );

  const renderDetectorStage = () => (
    <View style={[isCompactMobile ? styles.panelCardCompact : styles.panelCard, styles.detectorShell, isCompactMobile && styles.detectorShellCompact]}>
      <View style={[styles.detectorHeader, isCompactMobile && styles.detectorHeaderCompact]}>
        <View>
          <Text style={styles.sectionEyebrow}>Tracking Stage</Text>
          <Text style={isCompactMobile ? styles.sectionTitleCompact : styles.sectionTitle}>Live camera + pose overlay</Text>
        </View>
      </View>
      <View style={[styles.detectorStatsWidget, isCompactMobile && styles.detectorStatsWidgetCompact]}>
        <View style={styles.detectorStatItem}>
          <Text style={styles.detectorStatLabel}>{statCountLabel}</Text>
          <Text style={styles.detectorStatValue}>{statCountValue}</Text>
        </View>
        <View style={styles.detectorStatDivider} />
        <View style={styles.detectorStatItem}>
          <Text style={styles.detectorStatLabel}>Timer</Text>
          <Text style={styles.detectorStatValue}>{statTimerValue}</Text>
        </View>
        <View style={styles.detectorStatDivider} />
        <View style={styles.detectorStatItem}>
          <Text style={styles.detectorStatLabel}>Workout</Text>
          <Text style={styles.detectorStatValue}>{currentExerciseDefinition?.label || 'Pose workout'}</Text>
        </View>
      </View>
      <View style={[styles.viewer, isCompactMobile && styles.viewerCompact, Platform.OS === 'web' && styles.viewerWeb]}>
        {Platform.OS !== 'web' ? (
          <WebView
            source={{ html: POSE_DETECTOR_HTML }}
            style={styles.webView}
            onMessage={onNativeMessage}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            domStorageEnabled
          />
        ) : (
          <View style={[styles.phoneFrame, isCompactMobile && styles.phoneFrameCompact]}>
            <iframe ref={iframeRef} src={iframeSrc || undefined} srcDoc={iframeSrc ? undefined : POSE_DETECTOR_HTML} style={iframeStyle} allow="camera *; microphone *;" />
          </View>
        )}
      </View>
      {Platform.OS === 'web' && (detectorStatus !== 'ready' || detectorError) ? (
        <View style={[
          styles.statusPill,
          isCompactMobile && styles.statusPillCompact,
          detectorStatus === 'error' && styles.statusPillError,
        ]}>
          <Text style={styles.statusPillText}>
            {detectorError || 'Starting camera session...'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderCompactSecondaryColumn = () => (
    <View style={styles.compactSecondaryColumn}>
      {renderCompactDetailCard()}
    </View>
  );

  const renderCompactOverlayContent = () => {
    return (
      <>
        <View style={styles.compactOverlayAvatarHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Avatar Example</Text>
            <Text style={styles.avatarCardTitleCompact}>{demoLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => playPoseDemo(currentExercise)} activeOpacity={0.85}>
            <LinearGradient colors={["#00E7FF", "#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.replayBtnCompact}>
              <Text style={styles.replayBtnText}>Replay</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.compactOverlayAvatarStage}>
          <InteractiveAvatar
            ref={avatarRef}
            model={selectedModel}
            gender={selectedGender}
            height={selectedHeight}
            weight={selectedWeight}
            photoUri={selectedPhotoUri}
            enableVoice={false}
            enableTTS={true}
            sizeMultiplier={0.72}
            yOffset={-0.05}
            alignFootToBottom={true}
            bottomPadding={0.02}
          />
        </View>
        <View style={styles.compactMovePickerHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Switch Movement</Text>
            <Text style={styles.compactMovePickerTitle}>Choose your live exercise</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.exerciseChipRow, styles.compactMovePickerScrollContent]}
          style={styles.compactMovePickerScroll}
        >
          {POSE_EXERCISE_OPTIONS.map((exerciseOption) => {
            const isActive = currentExercise === exerciseOption.key;
            return (
              <TouchableOpacity
                key={exerciseOption.key}
                onPress={() => {
                  dispatch(setPoseExercise(exerciseOption.key));
                  setCompactOverlayOpen(false);
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isActive ? ['#00E7FF', '#6A00FF'] : ['rgba(28,36,54,0.96)', 'rgba(10,14,22,0.96)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.exerciseChip, isActive && styles.exerciseChipActive]}
                >
                  <Text style={styles.exerciseChipText}>{exerciseOption.chipLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </>
    );
  };

  const renderCompactPersistentPlanTray = () => (
    <View style={styles.compactPersistentPlanCard}>
      <View style={styles.compactPersistentPlanHeader}>
        <View style={styles.compactPersistentPlanLeadGroup}>
          <View style={styles.compactPersistentPlanBackButtonWrap}>
            <BackButton onPress={handlePoseBack} />
          </View>
          <View style={styles.compactPersistentPlanTitleWrap}>
            <Text style={styles.sectionEyebrow}>Workout Plan</Text>
            <Text style={styles.compactPersistentPlanTitle}>{workoutPlan?.title || 'Current session targets'}</Text>
            <View style={styles.compactPersistentPlanStatsRow}>
              <View style={styles.compactPersistentPlanStatChip}>
                <Text style={styles.compactPersistentPlanStatLabel}>{statCountLabel}</Text>
                <Text style={styles.compactPersistentPlanStatValue}>{statCountValue}</Text>
              </View>
              <View style={styles.compactPersistentPlanStatChip}>
                <Text style={styles.compactPersistentPlanStatLabel}>Timer</Text>
                <Text style={styles.compactPersistentPlanStatValue}>{statTimerValue}</Text>
              </View>
            </View>
            <Text style={styles.compactPersistentPlanMeta}>
              {isWorkoutPlanRunning && activePlanItem
                ? `Now: ${activePlanItem.label} · ${activePlanItem.targetLabel}`
                : `${workoutPlanExercises.length} move${workoutPlanExercises.length === 1 ? '' : 's'} ready`}
            </Text>
          </View>
        </View>
        <View style={styles.compactPersistentPlanActionsColumn}>
          <View style={styles.compactPersistentPlanActionsTopRow}>
            <TouchableOpacity
              onPress={hasSavedSession || isAutoSavingSession ? undefined : () => saveSession()}
              activeOpacity={0.85}
              style={[styles.compactPersistentPlanActionCell, (hasSavedSession || isAutoSavingSession) ? styles.compactFloatingButtonDisabled : undefined]}
            >
              <LinearGradient
                colors={['rgba(0,231,255,0.22)', 'rgba(106,0,255,0.22)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.compactPersistentPlanSecondaryAction, styles.compactPersistentPlanActionWide]}
              >
                <Text style={styles.compactPersistentPlanSecondaryActionText}>{isAutoSavingSession ? 'Saving' : hasSavedSession ? 'Saved' : 'Save'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={isWorkoutPlanRunning ? stopWorkoutPlan : hasWorkoutPlanStarted ? continueWorkoutPlan : startWorkoutPlan}
              activeOpacity={0.85}
              style={styles.compactPersistentPlanActionCell}
            >
              <LinearGradient
                colors={isWorkoutPlanRunning ? ['#FF7A59', '#FF3D54'] : hasWorkoutPlanStarted ? ['#22C55E', '#0EA5A4'] : ['#00E7FF', '#6A00FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.compactPersistentPlanAction, styles.compactPersistentPlanActionWide]}
              >
                <Text style={styles.compactPersistentPlanActionText}>{isWorkoutPlanRunning ? 'Stop' : hasWorkoutPlanStarted ? 'Continue' : 'Start'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => {
              setCompactOverlayOpen((prev) => {
                const nextOpen = !prev;
                if (nextOpen) {
                  playPoseDemo(currentExercise);
                }
                return nextOpen;
              });
            }}
            activeOpacity={0.85}
            style={styles.compactPersistentPlanExampleButtonWrap}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.compactPersistentPlanSecondaryAction, styles.compactPersistentPlanActionWide]}
            >
              <Text style={styles.compactPersistentPlanSecondaryActionText}>Example</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.compactPersistentPlanViewerRow}>
        {workoutPlanExercises.length > 3 ? (
          <TouchableOpacity
            onPress={() => handleSelectCompactPlanItem(Math.max(0, visiblePlanIndex - 1))}
            activeOpacity={0.85}
            disabled={visiblePlanIndex <= 0}
            style={[styles.compactPersistentPlanSideButton, visiblePlanIndex <= 0 && styles.compactFloatingButtonDisabled]}
          >
            <Text style={styles.compactPersistentPlanSideButtonText}>{'<'}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.compactPersistentPlanScroll}>
          <View style={styles.compactPersistentPlanScrollContent}>
        {compactVisiblePlanItems.map((item, visibleIndex) => {
          const index = compactVisiblePlanWindowStart + visibleIndex;
          const storedProgress = planProgressById[item.id];
          const progressValue = completedPlanIndexes.includes(index)
            ? item.targetValue
            : Math.min(
              Math.max(
                Number.isFinite(storedProgress)
                  ? storedProgress
                  : isWorkoutPlanRunning && index === activePlanIndex
                    ? item.targetUnit === 'sec' ? activeStepElapsedSeconds : reps
                    : item.poseExercise === currentExercise
                      ? reps
                      : 0,
                0,
              ),
              item.targetValue,
            );
          const isActiveItem = isWorkoutPlanRunning ? index === activePlanIndex : item.poseExercise === currentExercise;
          const isCompletedItem = completedPlanIndexes.includes(index) || progressValue >= item.targetValue;
          const progressLabel = item.targetUnit === 'sec'
            ? `${progressValue}s / ${item.targetValue}s`
            : `${progressValue} / ${item.targetValue} reps`;

          return (
            <TouchableOpacity
              key={`${item.id}-${index}`}
              onPress={() => handleSelectCompactPlanItem(index)}
              activeOpacity={item.poseExercise ? 0.85 : 1}
              style={[
                styles.compactPersistentPlanChip,
                isActiveItem && styles.compactPersistentPlanChipActive,
                isCompletedItem && styles.compactPersistentPlanChipDone,
              ]}
            >
              <Text style={styles.compactPersistentPlanChipIndex}>{index + 1}</Text>
              <View style={styles.compactPersistentPlanChipBody}>
                <Text style={styles.compactPersistentPlanChipLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.compactPersistentPlanChipMeta} numberOfLines={1}>
                  {isCompletedItem ? 'Done' : `${progressValue}/${item.targetValue} ${item.targetUnit === 'sec' ? 'sec' : 'reps'}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
          </View>
        </View>

        {workoutPlanExercises.length > 3 ? (
          <TouchableOpacity
            onPress={() => handleSelectCompactPlanItem(Math.min(workoutPlanExercises.length - 1, visiblePlanIndex + 1))}
            activeOpacity={0.85}
            disabled={visiblePlanIndex >= workoutPlanExercises.length - 1}
            style={[styles.compactPersistentPlanSideButton, visiblePlanIndex >= workoutPlanExercises.length - 1 && styles.compactFloatingButtonDisabled]}
          >
            <Text style={styles.compactPersistentPlanSideButtonText}>{'>'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderCompactImmersiveLayout = () => (
    <View style={styles.compactRealtimeShell}>
      <View style={styles.compactCameraBase}>
        {Platform.OS !== 'web' ? (
          <WebView
            source={{ html: POSE_DETECTOR_HTML }}
            style={styles.compactImmersiveWebView}
            onMessage={onNativeMessage}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            domStorageEnabled
          />
        ) : (
          <iframe ref={iframeRef} src={iframeSrc || undefined} srcDoc={iframeSrc ? undefined : POSE_DETECTOR_HTML} style={iframeStyle} allow="camera *; microphone *;" />
        )}
      </View>

      <LinearGradient colors={['rgba(3,8,14,0.78)', 'rgba(3,8,14,0.18)', 'rgba(3,8,14,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.compactTopFade} />
      <LinearGradient colors={['rgba(3,8,14,0)', 'rgba(3,8,14,0.18)', 'rgba(3,8,14,0.92)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.compactBottomFade} />

      <View style={[styles.compactHudLayer, styles.compactHudLayerPointerEvents]}>
        <View style={styles.compactPersistentPlanWrap}>
          {renderCompactPersistentPlanTray()}
        </View>

        {isWorkoutPlanRunning ? (
          <View style={styles.compactGuidePopup}>
            <Text style={styles.compactGuidePopupTitle}>{currentExerciseDefinition?.label || 'Live guide'}</Text>
            <Text style={styles.compactGuidePopupText}>{liveCue}</Text>
          </View>
        ) : null}

        <View style={[styles.compactOverlayDock, { top: compactOverlayTopOffset, height: compactSheetHeight }]} pointerEvents="box-none">
          {compactOverlayOpen ? (
            <Animated.View style={[styles.compactOverlaySheet, { height: compactSheetHeight, transform: [{ translateY: compactSheetTranslateY }] }]}>
              <View style={styles.compactOverlayBody}>
                <View style={styles.compactOverlayActionRow}>
                  <TouchableOpacity onPress={reset} activeOpacity={0.85} style={styles.compactSheetActionButton}>
                    <Text style={styles.compactSheetActionButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.compactOverlayScroll} contentContainerStyle={styles.compactOverlayScrollContent} showsVerticalScrollIndicator={false}>
                  {renderCompactOverlayContent()}
                </ScrollView>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </View>

      {(detectorStatus !== 'ready' || detectorError) ? (
        <View style={styles.compactStatusPill}>
          <Text style={styles.statusPillText}>{detectorError || 'Starting camera session...'}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderSaveSummaryModal = () => {
    if (!saveSummaryModal) return null;

    return (
      <View style={styles.saveSummaryOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.saveSummaryBackdrop} activeOpacity={1} onPress={handleCloseSaveSummaryModal} />
        <View style={styles.saveSummaryOverlayContent}>
          <LinearGradient colors={['#0D1624', '#101B2B', '#0A1019']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveSummaryCard}>
            <Text style={styles.sectionEyebrow}>Workout Saved</Text>
            <Text style={styles.saveSummaryTitle}>{saveSummaryModal.title}</Text>
            <Text style={styles.saveSummarySubtitle}>{saveSummaryModal.subtitle || 'Here is your session result.'}</Text>

            <View style={styles.saveSummaryMetricsRow}>
              <View style={styles.saveSummaryMetricCard}>
                <Text style={styles.saveSummaryMetricLabel}>XP</Text>
                <Text style={styles.saveSummaryMetricValue}>{saveSummaryModal.xp}</Text>
              </View>
              <View style={styles.saveSummaryMetricCard}>
                <Text style={styles.saveSummaryMetricLabel}>Time</Text>
                <Text style={styles.saveSummaryMetricValue}>{formatTimerLabel(saveSummaryModal.elapsedSeconds)}</Text>
              </View>
              <View style={styles.saveSummaryMetricCard}>
                <Text style={styles.saveSummaryMetricLabel}>Calories</Text>
                <Text style={styles.saveSummaryMetricValue}>{saveSummaryModal.calories}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleCloseSaveSummaryModal} activeOpacity={0.85}>
              <LinearGradient colors={['#00E7FF', '#6A00FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveSummaryPrimaryButton}>
                <Text style={styles.saveSummaryPrimaryButtonText}>{saveSummaryModal.buttonLabel || 'Back to Workout'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    );
  };

  if (!privacyAccepted) {
    return (
      <ScreenFrame backgroundColor="#0a0c10">
        <SafeAreaView style={styles.root}> 
          <View style={[styles.privacyWrap, useCompactWebShell && styles.privacyWrapCompactWeb]}> 
            <View style={styles.privacyCard}>
              <View style={[styles.topRow, { marginBottom: 12 }]}> 
                <BackButton />
                <View>
                  <Text style={styles.sectionEyebrow}>Pose Lab</Text>
                  <Text style={[styles.privacyTitle, { marginBottom: 0 }]}>Pose Detection</Text>
                </View>
              </View>
              <Text style={styles.privacyDesc}>Train with a guided camera workout surface, live rep tracking, and avatar-led form preview.</Text>
              <View style={styles.privacyBullets}>
                <Text style={styles.privacyBullet}>Live camera tracking runs locally on your device.</Text>
                <Text style={styles.privacyBullet}>Avatar preview demonstrates the target movement.</Text>
                <Text style={styles.privacyBullet}>Completed guided workouts save back into history and award XP automatically.</Text>
              </View>
              <View style={{marginTop:24}}>
                <TouchableOpacity onPress={()=>dispatch(acceptPrivacy())} activeOpacity={0.85}>
                  <LinearGradient colors={["#00E7FF","#6A00FF"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.acceptBtn}> 
                    <Text style={styles.acceptBtnText}>Allow Camera & Start</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame backgroundColor="#0a0c10">
      <SafeAreaView style={styles.root}>
        <LinearGradient colors={['#08111E', '#0E1526', '#080B12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rootGradient}>
        <View style={[styles.appShell, useCompactWebShell && styles.appShellCompactWeb]}>
        {!isCompactMobile ? (
          <View style={styles.header}> 
              <View style={styles.topRow}>
                <BackButton />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={isCompactMobile ? styles.titleCompact : styles.title}>Realtime Workout</Text>
                </View>
              </View>
          </View>
        ) : null}
        {isCompactMobile ? renderCompactImmersiveLayout() : (
          <ScrollView contentContainerStyle={[styles.contentScroll, isCompactMobile && styles.contentScrollCompact]} showsVerticalScrollIndicator={false}>
            <>
              <View style={[styles.contentGrid, isWideLayout && styles.contentGridWide]}>
                <View style={[styles.stageColumn, isWideLayout && styles.stageColumnWide]}>
                  {renderDetectorStage()}
                  {renderWorkoutPlanCard()}
                </View>
                <View style={[styles.sidebarColumn, isWideLayout && styles.sidebarColumnWide]}>
                  {renderExerciseAvatarCard()}
                  {renderGuidanceCard()}
                </View>
              </View>
            </>
          </ScrollView>
        )}
        {!isCompactMobile ? renderActionBar() : null}
        </View>
        {renderSaveSummaryModal()}
        </LinearGradient>
      </SafeAreaView>
    </ScreenFrame>
  );
}

function PillButton({ label, onPress, variant = 'primary' }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary' }) {
  const colors = variant === 'secondary'
    ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)']
    : ['#00E7FF', '#6A00FF'];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.btn, variant === 'secondary' && styles.btnSecondary]}> 
        <Text style={styles.btnText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0c10' },
  rootGradient: { flex: 1 },
  appShell: { flex: 1 },
  appShellCompactWeb: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7,10,16,0.94)',
  },
  header: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerSummary: { color: 'rgba(230,240,255,0.64)', marginTop: 6, fontSize: 12, lineHeight: 18, maxWidth: 780 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#f0f6fc', fontSize: 23, fontWeight: '800' },
  titleCompact: { color: '#f0f6fc', fontSize: 19, fontWeight: '800' },
  sectionEyebrow: { color: '#00E7FF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  sectionTitle: { color: '#F4FBFF', fontSize: 18, fontWeight: '800', marginTop: 6 },
  sectionTitleCompact: { color: '#F4FBFF', fontSize: 16, fontWeight: '800', marginTop: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sectionHeaderCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  sectionBadgeText: { color: '#D7F7FF', fontSize: 11, fontWeight: '700' },
  contentScroll: { padding: 18, gap: 16, paddingBottom: 110 },
  contentScrollCompact: { padding: 12, gap: 12, paddingBottom: 104 },
  contentGrid: { gap: 16 },
  contentGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  sidebarColumn: { gap: 16 },
  sidebarColumnWide: { width: 360, flexShrink: 0 },
  stageColumn: { gap: 16 },
  stageColumnWide: { flex: 1 },
  compactSecondaryColumn: { gap: 12, position: 'relative', zIndex: 1 },
  compactRealtimeShell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#02060a',
  },
  compactCameraBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  compactImmersiveWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  compactTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  compactBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  compactHudLayer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 14,
  },
  compactHudLayerPointerEvents: {
    pointerEvents: 'box-none',
  },
  compactStatusPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(9,16,26,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 2,
  },
  compactPersistentPlanWrap: {
    width: '100%',
    zIndex: 2,
  },
  compactPersistentPlanCard: {
    borderRadius: 18,
    padding: 10,
    backgroundColor: 'rgba(6,12,20,0.84)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: { boxShadow: '0px 16px 32px rgba(0, 0, 0, 0.24)' },
      default: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    }),
  },
  compactPersistentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  compactPersistentPlanLeadGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  compactPersistentPlanBackButtonWrap: {
    paddingTop: 1,
  },
  compactPersistentPlanActionsColumn: {
    width: 164,
    gap: 8,
    alignItems: 'stretch',
  },
  compactPersistentPlanActionsTopRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactPersistentPlanActionCell: {
    flex: 1,
  },
  compactPersistentPlanExampleButtonWrap: {
    alignSelf: 'flex-end',
    width: 98,
  },
  compactPersistentPlanTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  compactPersistentPlanTitle: {
    color: '#F4FBFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  compactPersistentPlanMeta: {
    color: 'rgba(244,251,255,0.72)',
    fontSize: 11,
    marginTop: 4,
  },
  compactPersistentPlanMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  compactPersistentPlanNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactPersistentPlanNavButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactPersistentPlanNavButtonText: {
    color: '#D8F7FF',
    fontSize: 10,
    fontWeight: '800',
  },
  compactPersistentPlanStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  compactPersistentPlanStatChip: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactPersistentPlanStatLabel: {
    color: '#8BCFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  compactPersistentPlanStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  compactPersistentPlanAction: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPersistentPlanActionWide: {
    minWidth: 0,
    width: '100%',
  },
  compactPersistentPlanSecondaryAction: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.24)',
  },
  compactPersistentPlanSecondaryActionText: {
    color: '#F4FBFF',
    fontSize: 12,
    fontWeight: '800',
  },
  compactPersistentPlanActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  compactPersistentPlanScroll: {
    flex: 1,
    marginTop: 10,
  },
  compactPersistentPlanScrollContent: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    paddingBottom: 2,
  },
  compactPersistentPlanViewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactPersistentPlanSideButton: {
    width: 28,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 10,
  },
  compactPersistentPlanSideButtonText: {
    color: '#D8F7FF',
    fontSize: 14,
    fontWeight: '900',
  },
  compactPersistentPlanChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactPersistentPlanChipActive: {
    backgroundColor: 'rgba(0,231,255,0.12)',
    borderColor: 'rgba(0,231,255,0.34)',
  },
  compactPersistentPlanChipDone: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.34)',
  },
  compactPersistentPlanChipIndex: {
    color: '#8BCFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  compactPersistentPlanChipBody: {
    flex: 1,
    minWidth: 0,
  },
  compactPersistentPlanChipLabel: {
    color: '#F4FBFF',
    fontSize: 11,
    fontWeight: '800',
  },
  compactPersistentPlanChipMeta: {
    color: 'rgba(244,251,255,0.68)',
    fontSize: 9,
    marginTop: 2,
  },
  compactGuidePopup: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(4,12,20,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.18)',
    zIndex: 2,
  },
  compactGuidePopupTitle: {
    color: '#8BCFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  compactGuidePopupText: {
    color: '#F4FBFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 17,
  },
  compactFloatingButtonDisabled: {
    opacity: 0.6,
  },
  compactOverlayDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    overflow: 'hidden',
    pointerEvents: 'box-none',
  },
  compactOverlaySheet: {
    flex: 1,
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: 'rgba(6,12,20,0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  compactOverlayBody: {
    flex: 1,
  },
  compactOverlayActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  compactSheetActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compactSheetActionButtonPrimary: {
    backgroundColor: 'rgba(0,231,255,0.18)',
    borderColor: 'rgba(0,231,255,0.28)',
  },
  compactSheetActionButtonText: {
    color: '#F4FBFF',
    fontSize: 12,
    fontWeight: '800',
  },
  compactOverlayScroll: {
    flex: 1,
  },
  compactOverlayScrollContent: {
    paddingBottom: 8,
  },
  compactOverlayAvatarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  compactOverlayAvatarStage: {
    height: 160,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,10,18,0.92)',
    marginBottom: 12,
  },
  panelCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(10,16,27,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
    ...Platform.select({
      web: { boxShadow: '0px 18px 40px rgba(0, 0, 0, 0.22)' },
      default: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    }),
  },
  panelCardCompact: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(10,16,27,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  avatarCard: {
    padding: 16,
  },
  avatarCardCompact: {
    padding: 12,
  },
  mergedCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  avatarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarCardHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  avatarCardTitleWrapCompact: { flex: 1, minWidth: 0 },
  avatarCardTitle: { color: '#f0f6fc', fontSize: 16, fontWeight: '800', marginTop: 6 },
  avatarCardTitleCompact: { color: '#f0f6fc', fontSize: 15, fontWeight: '800', marginTop: 6 },
  avatarCardMeta: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  avatarCardMetaCompact: { color: '#8b949e', fontSize: 11, marginTop: 4 },
  replayBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minWidth: 88, alignItems: 'center' },
  replayBtnCompact: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, minWidth: 74, alignItems: 'center' },
  replayBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  avatarStage: {
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,10,18,0.92)',
  },
  avatarStageCompact: {
    height: 168,
    borderRadius: 16,
  },
  avatarStageCompactMobile: {
    height: 190,
  },
  compactMovePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  compactMovePickerTitle: {
    color: '#F4FBFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  compactMovePickerScroll: {
    marginHorizontal: -2,
  },
  compactMovePickerScrollContent: {
    alignItems: 'center',
    paddingRight: 12,
  },
  compactDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  compactTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactTabButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  compactTabButtonActive: {
    backgroundColor: 'rgba(0,231,255,0.14)',
    borderColor: 'rgba(0,231,255,0.34)',
  },
  compactTabButtonText: {
    color: '#9CB2C7',
    fontSize: 12,
    fontWeight: '800',
  },
  compactTabButtonTextActive: {
    color: '#F4FBFF',
  },
  compactPlanHeader: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  compactPlanTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  compactPlanTitle: {
    color: '#F4FBFF',
    fontSize: 14,
    fontWeight: '800',
  },
  planSummaryCompact: {
    marginBottom: 0,
    color: '#AFC0D1',
  },
  planStartButtonCompact: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  detectorShell: { padding: 14, width: '100%', alignSelf: 'stretch' },
  detectorShellCompact: { padding: 10 },
  detectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  detectorHeaderCompact: { gap: 8, marginBottom: 8, flexDirection: 'column' },
  detectorStatsWidget: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detectorStatsWidgetCompact: {
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
    borderRadius: 12,
  },
  detectorStatItem: {
    flex: 1,
    minWidth: 0,
  },
  detectorStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  detectorStatLabel: {
    color: '#7DCBFF',
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detectorStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  detectorStatValueSmall: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  detectorStatMeta: {
    color: '#91A4B8',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 13,
  },
  statusPill: { maxWidth: 260, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  statusPillCompact: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  statusPillError: { maxWidth: '100%', marginTop: 10, backgroundColor: 'rgba(255, 180, 0, 0.12)', borderColor: 'rgba(255, 200, 80, 0.32)' },
  statusPillText: { color: '#E9FBFF', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  viewer: { minHeight: 340, width: '100%' },
  viewerCompact: { minHeight: 340, width: '100%' },
  viewerWeb: { width: '100%', alignSelf: 'stretch', alignItems: 'stretch', justifyContent: 'center' },
  phoneFrame: { width: '100%', alignSelf: 'stretch', height: 620, maxWidth: '100%', maxHeight: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#000' },
  phoneFrameCompact: { width: '100%', alignSelf: 'stretch', maxWidth: '100%', height: 360, borderRadius: 18 },
  webView: { flex: 1, width: '100%', backgroundColor: '#000' },
  actionBar: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(4,8,14,0.94)' },
  actionBarCompact: { paddingHorizontal: 12, paddingVertical: 10, gap: 10, alignItems: 'stretch' },
  actionBarCompactWeb: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
  },
  actionBarTitle: { color: '#F4FBFF', fontSize: 18, fontWeight: '800' },
  actionBarTitleCompact: { color: '#F4FBFF', fontSize: 15, fontWeight: '800' },
  actionBarMeta: { color: '#8EA5B9', fontSize: 12, marginTop: 4 },
  actionBarMetaCompact: { maxWidth: 220 },
  actionBarMetaSuccess: { color: '#77F7C4' },
  actionBarMetaWarning: { color: '#FFD36E' },
  actionButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionButtonsCompact: { gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', minWidth: 110, alignItems: 'center' },
  btnSecondary: { borderColor: 'rgba(255,255,255,0.16)' },
  btnText: { color: '#fff', fontWeight: '700' },
  exerciseScrollContent: { paddingRight: 8 },
  exerciseChipRow: { gap: 8, paddingRight: 6 },
  exerciseChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  exerciseChipActive: { borderColor: 'rgba(255,255,255,0.28)' },
  exerciseChipText: { color: '#F4FBFF', fontSize: 12, fontWeight: '700' },
  exerciseGridViewport: { maxHeight: 154 },
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  exerciseCardTouch: { width: Platform.OS === 'web' ? 'calc(50% - 5px)' : undefined },
  exerciseCard: { minWidth: 146, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  exerciseCardActive: { borderColor: 'rgba(255,255,255,0.28)' },
  exerciseCardText: { color:'#EAF7FF', fontWeight:'800', fontSize:13 },
  exerciseCardTextActive: { color: '#FFFFFF' },
  exerciseCardSubtext: { color:'rgba(234,247,255,0.58)', fontSize:11, marginTop: 5, fontWeight: '600' },
  exerciseCardSubtextActive: { color: 'rgba(255,255,255,0.78)' },
  metricRow: { gap: 12 },
  metricRowCompact: { gap: 8 },
  metricCard: { padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  metricLabel: { color: '#7DCBFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  metricValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  metricCue: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 8, lineHeight: 24 },
  metricCueCompact: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 8, lineHeight: 20 },
  metricCaption: { color: '#91A4B8', fontSize: 12, marginTop: 6, lineHeight: 18 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  liveBadgeText: { color: '#F4FBFF', fontSize: 11, fontWeight: '800' },
  guideText: { color: '#D3DFEA', fontSize: 14, lineHeight: 22, marginTop: 10 },
  guideTextCompact: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  planSummary: { marginTop: 0, marginBottom: 12 },
  planHeaderActions: { alignItems: 'flex-end', gap: 8 },
  planStartButton: { minWidth: 122, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  planStartButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  planList: { gap: 10 },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planItemActive: {
    borderColor: 'rgba(0,231,255,0.45)',
    backgroundColor: 'rgba(0,231,255,0.08)',
  },
  planItemIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  planItemIndexText: { color: '#F4FBFF', fontSize: 12, fontWeight: '800' },
  planItemBody: { flex: 1, minWidth: 0 },
  planItemLabel: { color: '#F4FBFF', fontSize: 13, fontWeight: '800' },
  planItemMeta: { color: '#91A4B8', fontSize: 11, marginTop: 3 },
  planItemProgress: { alignItems: 'flex-end' },
  planItemProgressText: { color: '#8EA5B9', fontSize: 11, fontWeight: '700' },
  planItemProgressTextActive: { color: '#77F7C4' },
  tipPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  tipPill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  tipPillText: { color: '#EAF7FF', fontSize: 12, fontWeight: '700' },
  privacyWrap: { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  privacyWrapCompactWeb: { paddingHorizontal: 14 },
  privacyCard: { width: '100%', maxWidth: 560, borderRadius: 28, padding: 26, backgroundColor: 'rgba(10,16,27,0.96)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  privacyTitle: { color:'#fff', fontSize:22, fontWeight:'800', marginBottom:16 },
  privacyDesc: { color:'#c9d1d9', fontSize:14, lineHeight:22, marginTop: 8 },
  privacyBullets: { marginTop: 18, gap: 10 },
  privacyBullet: { color: '#DCEAF5', fontSize: 13, lineHeight: 20 },
  acceptBtn: { paddingHorizontal:22, paddingVertical:14, borderRadius:999, alignItems: 'center' },
  acceptBtnText: { color:'#fff', fontWeight:'700', fontSize:16 },
  saveSummaryOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  saveSummaryBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 10, 24, 0.72)',
  },
  saveSummaryOverlayContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  saveSummaryCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  saveSummaryTitle: {
    color: '#F4FBFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  saveSummarySubtitle: {
    color: 'rgba(244,251,255,0.72)',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
  },
  saveSummaryMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  saveSummaryMetricCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveSummaryMetricLabel: {
    color: '#8BCFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  saveSummaryMetricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  saveSummaryPrimaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSummaryPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
