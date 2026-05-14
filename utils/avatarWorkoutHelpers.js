import { AVATAR_ANIMATIONS, getAvatarAnimationDuration } from './avatarAnimationConfig';
import { getPoseExerciseForAnimation } from './poseExerciseConfig';

const EXERCISE_PATTERNS = [
  { animationType: AVATAR_ANIMATIONS.PUSHUP, pattern: /push[ -]?ups?|pushup/i },
  { animationType: AVATAR_ANIMATIONS.SQUAT, pattern: /air squat|squats?|squat/i },
  { animationType: AVATAR_ANIMATIONS.PLANK, pattern: /planks?/i },
  { animationType: AVATAR_ANIMATIONS.SITUP, pattern: /sit[ -]?ups?|situp/i },
  { animationType: AVATAR_ANIMATIONS.BICYCLE_CRUNCH, pattern: /bicycle crunch/i },
  { animationType: AVATAR_ANIMATIONS.CIRCLE_CRUNCH, pattern: /circle crunch/i },
  { animationType: AVATAR_ANIMATIONS.CRUNCH, pattern: /crunches?|crunch/i },
  { animationType: AVATAR_ANIMATIONS.JUMPING_JACKS, pattern: /jumping[ -]?jacks?/i },
  { animationType: AVATAR_ANIMATIONS.BURPEE, pattern: /burpees?|burpee/i },
  { animationType: AVATAR_ANIMATIONS.RUNNING, pattern: /running|runner|run\b|jogging|jog\b/i },
  { animationType: AVATAR_ANIMATIONS.WARMUP, pattern: /warm[ -]?up|warmup|mobility/i },
  { animationType: AVATAR_ANIMATIONS.MEDITATION, pattern: /meditat|breathwork|cooldown/i },
  { animationType: AVATAR_ANIMATIONS.TREE_POSE, pattern: /tree pose|vrikshasana|yoga/i },
  { animationType: AVATAR_ANIMATIONS.PIKE_WALK, pattern: /pike walk/i },
  { animationType: AVATAR_ANIMATIONS.PISTOL, pattern: /pistol squat|pistol/i },
];

const DEMO_REQUEST_PATTERN = /(show|demo|demonstrat|example|proper form|correct form|how do i do|how to do|can you show|show me|teach me|what does .* look like|visualize)/i;
const DEMO_RESPONSE_PATTERN = /(i can show|let me show|watch this|here'?s how|this is how|follow this form|use this form|our avatar can show)/i;
const DEMO_CONFIRMATION_PATTERN = /^(yes|yeah|yep|sure|ok|okay|show me|please do|go ahead|do it|let'?s do it|demo it|show it|yes please)(?:\s|$)/i;
const WORKOUT_START_CONFIRMATION_PATTERN = /^(yes|yeah|yep|sure|ok|okay|i'?m in|let'?s do it|let'?s go|start it|start workout|take me there|open workout|go to workout|do this together|together|yes let'?s do it|yes let'?s go)(?:\s|$)/i;
const WORKOUT_PLAN_PATTERN = /(workout|plan|routine|exercise|session|circuit|full body|full workout)/i;

const WORKOUT_PLAN_METADATA = {
  [AVATAR_ANIMATIONS.PUSHUP]: { label: 'Push-up', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.PUSHUP) },
  [AVATAR_ANIMATIONS.SQUAT]: { label: 'Squat', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.SQUAT) },
  [AVATAR_ANIMATIONS.PLANK]: { label: 'Plank', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.PLANK) },
  [AVATAR_ANIMATIONS.SITUP]: { label: 'Sit-up', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.SITUP) },
  [AVATAR_ANIMATIONS.BICYCLE_CRUNCH]: { label: 'Bicycle Crunch', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.BICYCLE_CRUNCH) },
  [AVATAR_ANIMATIONS.CIRCLE_CRUNCH]: { label: 'Circle Crunch', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.CIRCLE_CRUNCH) },
  [AVATAR_ANIMATIONS.CRUNCH]: { label: 'Crunch', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.CRUNCH) },
  [AVATAR_ANIMATIONS.JUMPING_JACKS]: { label: 'Jumping Jacks', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.JUMPING_JACKS) },
  [AVATAR_ANIMATIONS.BURPEE]: { label: 'Burpee', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.BURPEE) },
  [AVATAR_ANIMATIONS.RUNNING]: { label: 'Running', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.RUNNING) },
  [AVATAR_ANIMATIONS.WARMUP]: { label: 'Warm-up', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.WARMUP) },
  [AVATAR_ANIMATIONS.MEDITATION]: { label: 'Cooldown', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.MEDITATION) },
  [AVATAR_ANIMATIONS.TREE_POSE]: { label: 'Tree Pose', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.TREE_POSE) },
  [AVATAR_ANIMATIONS.PIKE_WALK]: { label: 'Pike Walk', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.PIKE_WALK) },
  [AVATAR_ANIMATIONS.PISTOL]: { label: 'Single-Leg Squat', poseExercise: getPoseExerciseForAnimation(AVATAR_ANIMATIONS.PISTOL) },
};

const buildSequenceStep = (animationType, duration) => ({
  animationType,
  duration: typeof duration === 'number' ? duration : getAvatarAnimationDuration(animationType, 'neutral', 900),
});

export const inferWorkoutAnimationFromText = (text) => {
  const value = String(text || '').trim();
  if (!value) return null;

  for (const entry of EXERCISE_PATTERNS) {
    if (entry.pattern.test(value)) return entry.animationType;
  }

  return null;
};

export const inferWorkoutAnimationsFromText = (text) => {
  const value = String(text || '').trim();
  if (!value) return [];

  const matches = [];
  for (const entry of EXERCISE_PATTERNS) {
    if (entry.pattern.test(value) && !matches.includes(entry.animationType)) {
      matches.push(entry.animationType);
    }
  }

  return matches;
};

const inferWorkoutDurationMin = (...values) => {
  for (const value of values) {
    const match = String(value || '').match(/(\d{1,2})\s*(min|mins|minute|minutes)\b/i);
    if (match?.[1]) {
      return Math.max(3, Math.min(60, Number(match[1])));
    }
  }

  return null;
};

export const buildWorkoutDemoSequence = (animationType, options = {}) => {
  const reps = Math.max(1, Math.min(6, Number(options.reps) || 3));

  switch (String(animationType || '').toLowerCase()) {
    case AVATAR_ANIMATIONS.PUSHUP:
      return {
        animationType: AVATAR_ANIMATIONS.PUSHUP,
        label: 'Push-up Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.IDLE_TO_PUSHUP, 1200),
          ...Array.from({ length: reps }, () => buildSequenceStep(AVATAR_ANIMATIONS.PUSHUP, 1600)),
          buildSequenceStep(AVATAR_ANIMATIONS.PUSHUP_TO_IDLE, 1200),
        ],
      };
    case AVATAR_ANIMATIONS.SQUAT:
      return {
        animationType: AVATAR_ANIMATIONS.SQUAT,
        label: 'Squat Demo',
        sequence: Array.from({ length: reps }, () => buildSequenceStep(AVATAR_ANIMATIONS.SQUAT, 1700)),
      };
    case AVATAR_ANIMATIONS.PLANK:
      return {
        animationType: AVATAR_ANIMATIONS.PLANK,
        label: 'Plank Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.START_PLANK, 1300),
          buildSequenceStep(AVATAR_ANIMATIONS.PLANK, Math.max(2400, Number(options.holdMs) || 3200)),
          buildSequenceStep(AVATAR_ANIMATIONS.END_PLANK, 1300),
        ],
      };
    case AVATAR_ANIMATIONS.SITUP:
      return {
        animationType: AVATAR_ANIMATIONS.SITUP,
        label: 'Sit-up Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.IDLE_TO_SITUP, 1300),
          ...Array.from({ length: reps }, () => buildSequenceStep(AVATAR_ANIMATIONS.SITUP, 1700)),
        ],
      };
    case AVATAR_ANIMATIONS.BICYCLE_CRUNCH:
      return {
        animationType: AVATAR_ANIMATIONS.BICYCLE_CRUNCH,
        label: 'Bicycle Crunch Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.START_BICYCLE_SITUP, 1300),
          ...Array.from({ length: Math.max(1, Math.min(4, reps)) }, () => buildSequenceStep(AVATAR_ANIMATIONS.BICYCLE_CRUNCH, 1800)),
          buildSequenceStep(AVATAR_ANIMATIONS.END_BICYCLE_SITUP, 1300),
        ],
      };
    case AVATAR_ANIMATIONS.CIRCLE_CRUNCH:
      return {
        animationType: AVATAR_ANIMATIONS.CIRCLE_CRUNCH,
        label: 'Circle Crunch Demo',
        sequence: Array.from({ length: Math.max(1, Math.min(4, reps)) }, () => buildSequenceStep(AVATAR_ANIMATIONS.CIRCLE_CRUNCH, 1800)),
      };
    case AVATAR_ANIMATIONS.CRUNCH:
      return {
        animationType: AVATAR_ANIMATIONS.CRUNCH,
        label: 'Crunch Demo',
        sequence: Array.from({ length: reps }, () => buildSequenceStep(AVATAR_ANIMATIONS.CRUNCH, 1500)),
      };
    case AVATAR_ANIMATIONS.JUMPING_JACKS:
      return {
        animationType: AVATAR_ANIMATIONS.JUMPING_JACKS,
        label: 'Jumping Jacks Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.START_JUMPING_JACKS, 1000),
          ...Array.from({ length: Math.max(1, Math.min(4, reps)) }, () => buildSequenceStep(AVATAR_ANIMATIONS.JUMPING_JACKS, 1800)),
          buildSequenceStep(AVATAR_ANIMATIONS.STOP_JUMPING_JACKS, 1000),
        ],
      };
    case AVATAR_ANIMATIONS.BURPEE:
      return {
        animationType: AVATAR_ANIMATIONS.BURPEE,
        label: 'Burpee Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.BURPEE_START, 1200),
          ...Array.from({ length: Math.max(1, Math.min(3, reps)) }, () => buildSequenceStep(AVATAR_ANIMATIONS.BURPEE, 1900)),
          buildSequenceStep(AVATAR_ANIMATIONS.BURPEE_END, 1200),
        ],
      };
    case AVATAR_ANIMATIONS.RUNNING:
      return {
        animationType: AVATAR_ANIMATIONS.RUNNING,
        label: 'Running Demo',
        sequence: [buildSequenceStep(AVATAR_ANIMATIONS.RUNNING, Math.max(2600, Number(options.holdMs) || 3600))],
      };
    case AVATAR_ANIMATIONS.WARMUP:
      return {
        animationType: AVATAR_ANIMATIONS.WARMUP,
        label: 'Warm-up Demo',
        sequence: [buildSequenceStep(AVATAR_ANIMATIONS.WARMUP, 2400)],
      };
    case AVATAR_ANIMATIONS.MEDITATION:
      return {
        animationType: AVATAR_ANIMATIONS.MEDITATION,
        label: 'Meditation Demo',
        sequence: [buildSequenceStep(AVATAR_ANIMATIONS.MEDITATION, Math.max(2600, Number(options.holdMs) || 3600))],
      };
    case AVATAR_ANIMATIONS.TREE_POSE:
      return {
        animationType: AVATAR_ANIMATIONS.TREE_POSE,
        label: 'Tree Pose Demo',
        sequence: [buildSequenceStep(AVATAR_ANIMATIONS.TREE_POSE, Math.max(2600, Number(options.holdMs) || 3600))],
      };
    case AVATAR_ANIMATIONS.PIKE_WALK:
      return {
        animationType: AVATAR_ANIMATIONS.PIKE_WALK,
        label: 'Pike Walk Demo',
        sequence: [buildSequenceStep(AVATAR_ANIMATIONS.PIKE_WALK, 2200)],
      };
    case AVATAR_ANIMATIONS.PISTOL:
      return {
        animationType: AVATAR_ANIMATIONS.PISTOL,
        label: 'Pistol Squat Demo',
        sequence: [
          buildSequenceStep(AVATAR_ANIMATIONS.PISTOL_START, 1200),
          ...Array.from({ length: Math.max(1, Math.min(3, reps)) }, () => buildSequenceStep(AVATAR_ANIMATIONS.PISTOL, 1900)),
          buildSequenceStep(AVATAR_ANIMATIONS.PISTOL_TO_IDLE, 1200),
        ],
      };
    default:
      return null;
  }
};

export const inferWorkoutDemoFromExchange = (userText, aiText = '', options = {}) => {
  const userValue = String(userText || '').trim();
  const aiValue = String(aiText || '').trim();
  const requestedAnimation = inferWorkoutAnimationFromText(userValue) || inferWorkoutAnimationFromText(aiValue);
  const explicitRequest = DEMO_REQUEST_PATTERN.test(userValue);
  const shouldDemo = Boolean(options.force || (explicitRequest && requestedAnimation));

  if (!shouldDemo || !requestedAnimation) return null;
  return buildWorkoutDemoSequence(requestedAnimation, options);
};

export const isWorkoutDemoConfirmation = (text) => DEMO_CONFIRMATION_PATTERN.test(String(text || '').trim());

export const isWorkoutStartConfirmation = (text) => WORKOUT_START_CONFIRMATION_PATTERN.test(String(text || '').trim());

export const inferPendingWorkoutGuideFromExchange = (userText, aiText = '', options = {}) => {
  const userValue = String(userText || '').trim();
  const aiValue = String(aiText || '').trim();
  const aiAnimations = inferWorkoutAnimationsFromText(aiValue);
  const fallbackAnimations = inferWorkoutAnimationsFromText(userValue);
  const animations = (aiAnimations.length > 0 ? aiAnimations : fallbackAnimations).slice(0, 3);
  const hasOffer = DEMO_RESPONSE_PATTERN.test(aiValue);
  const hasWorkoutPlanContext = WORKOUT_PLAN_PATTERN.test(userValue) || WORKOUT_PLAN_PATTERN.test(aiValue);

  if (animations.length === 0 || (!options.force && !hasOffer && !hasWorkoutPlanContext)) {
    return null;
  }

  const demos = animations
    .map((animationType) => buildWorkoutDemoSequence(animationType, { reps: 2, holdMs: 2400, ...options }))
    .filter((demo) => demo?.sequence?.length);

  if (demos.length === 0) return null;

  const durationMin = inferWorkoutDurationMin(userValue, aiValue) || Math.max(5, demos.length * 2);
  const exerciseItems = demos.map((demo) => {
    const metadata = WORKOUT_PLAN_METADATA[demo.animationType] || {};
    return {
      animationType: demo.animationType,
      label: metadata.label || demo.label || 'Exercise',
      demoLabel: demo.label,
      poseExercise: metadata.poseExercise || null,
    };
  });

  return {
    animationType: demos[0].animationType,
    label: demos.length > 1 ? 'Workout Guide Demo' : demos[0].label,
    exercises: demos.map((demo) => demo.label),
    items: exerciseItems,
    sequence: demos.flatMap((demo) => demo.sequence),
    durationMin,
    title: `${durationMin}-Minute AI Workout`,
    summary: aiValue || userValue,
    sourceText: aiValue || userValue,
  };
};

export const buildAiWorkoutPlanFromGuide = (guide) => {
  if (!guide?.sequence?.length) return null;

  return {
    title: guide.title || 'AI Workout Plan',
    durationMin: guide.durationMin || 5,
    summary: guide.summary || guide.sourceText || '',
    exercises: Array.isArray(guide.items) ? guide.items : [],
    sequence: guide.sequence,
  };
};