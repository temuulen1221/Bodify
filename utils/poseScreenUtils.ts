import { AVATAR_ANIMATIONS, getAvatarAnimationDuration, resolveAvatarAnimationConfig } from './avatarAnimationConfig';
import { getPoseExerciseForAnimation } from './poseExerciseConfig';

export const POSE_PREVIEW_REPEAT_COUNT = 2;
export const FEEDBACK_COOLDOWN_MS = 3500;
export const MOTIVATION_COOLDOWN_MS = 22000;
export const MILESTONE_COOLDOWN_MS = 2500;
export const REP_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50];
export const HOLD_MILESTONES = [10, 20, 30, 45, 60, 90, 120];
export const AI_PLAN_STORAGE_KEY = 'bodify:web-workout-plan';
export const MOTIVATION_LINES = [
  'Keep that pace going.',
  'Stay locked in. You are doing great.',
  'Nice work. Keep your form controlled.',
  'Strong effort. Keep pushing.',
  'You are in rhythm now. Stay with it.',
];

export const resolveSafePosePreviewAnimation = (animationType: string, gender: string) => {
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

export const buildStablePosePreviewDemo = (animationType: string, gender: string) => {
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

export const resolveAiPlanRaw = (aiPlanParam: unknown) => {
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

export const inferPoseExerciseFromItem = (item: any = {}) => {
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

export const inferPlanTarget = (item: any = {}) => {
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

export const normalizePlanExercise = (item: any = {}, index: number) => {
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

export const formatTimerLabel = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return safeSeconds >= 3600
    ? new Date(safeSeconds * 1000).toISOString().slice(11, 19)
    : new Date(safeSeconds * 1000).toISOString().slice(14, 19);
};
