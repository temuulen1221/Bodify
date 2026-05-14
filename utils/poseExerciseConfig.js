import { AVATAR_ANIMATIONS } from './avatarAnimationConfig';

const RAW_POSE_EXERCISE_DATASET = require('../assets/data/exercisePoseDataset.json');

const LANDMARK_INDEX_BY_NAME = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const toFiniteNumberList = (values) => (
  Array.isArray(values)
    ? values.map((value) => Number(value)).filter(Number.isFinite)
    : []
);

const getQuantile = (values, quantile) => {
  const sorted = [...toFiniteNumberList(values)].sort((left, right) => left - right);
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];

  const clampedQuantile = Math.max(0, Math.min(1, Number(quantile) || 0));
  const position = (sorted.length - 1) * clampedQuantile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const ratio = position - lowerIndex;
  return sorted[lowerIndex] + ((sorted[upperIndex] - sorted[lowerIndex]) * ratio);
};

const resolveRequiredLandmarkIndices = (requiredLandmarks) => {
  const indices = Array.isArray(requiredLandmarks)
    ? requiredLandmarks
      .map((landmark) => LANDMARK_INDEX_BY_NAME[String(landmark || '').trim()])
      .filter(Number.isInteger)
    : [];

  return indices.length ? indices : null;
};

const deriveAngleThresholdsFromSamples = (samples) => {
  const downSamples = toFiniteNumberList(samples?.down);
  const upSamples = toFiniteNumberList(samples?.up);
  if (!downSamples.length || !upSamples.length) return null;

  const downThreshold = getQuantile(downSamples, 0.85);
  const upThreshold = getQuantile(upSamples, 0.2);
  if (!Number.isFinite(downThreshold) || !Number.isFinite(upThreshold) || downThreshold >= upThreshold - 4) {
    return null;
  }

  return {
    down: Math.round((downThreshold + 2) * 10) / 10,
    up: Math.round((upThreshold - 2) * 10) / 10,
  };
};

const resolveDatasetOverrides = (exerciseKey, definition) => {
  const entry = RAW_POSE_EXERCISE_DATASET?.[exerciseKey];
  if (!entry || typeof entry !== 'object') return null;

  const thresholds = entry.thresholds && typeof entry.thresholds === 'object' ? entry.thresholds : {};
  const quality = entry.quality && typeof entry.quality === 'object' ? entry.quality : {};
  const derivedThresholds = definition.mode === 'angle'
    ? deriveAngleThresholdsFromSamples(entry.samples)
    : null;

  return {
    down: Number.isFinite(Number(thresholds.down)) ? Number(thresholds.down) : derivedThresholds?.down,
    up: Number.isFinite(Number(thresholds.up)) ? Number(thresholds.up) : derivedThresholds?.up,
    downFrames: Number.isFinite(Number(thresholds.downFrames)) ? Number(thresholds.downFrames) : null,
    upFrames: Number.isFinite(Number(thresholds.upFrames)) ? Number(thresholds.upFrames) : null,
    min: Number.isFinite(Number(thresholds.min)) ? Number(thresholds.min) : null,
    max: Number.isFinite(Number(thresholds.max)) ? Number(thresholds.max) : null,
    minVisibility: Number.isFinite(Number(quality.minVisibility)) ? Number(quality.minVisibility) : null,
    requiredLandmarkIndices: resolveRequiredLandmarkIndices(quality.requiredLandmarks),
    invalidFrameHint: typeof quality.invalidFrameHint === 'string' ? quality.invalidFrameHint : '',
  };
};

export const POSE_EXERCISE_DEFINITIONS = {
  squat: {
    key: 'squat',
    label: 'Squat',
    chipLabel: '🦵 Squat',
    animationType: AVATAR_ANIMATIONS.SQUAT,
    mode: 'angle',
    metric: 'kneeAvg',
    down: 108,
    up: 154,
    downFrames: 3,
    upFrames: 4,
    help: 'Squat: knee avg below 100°, then stand back above 160°.',
    lowerHint: 'Go deeper',
    upperHint: 'Stand taller',
  },
  pushup: {
    key: 'pushup',
    label: 'Push-up',
    chipLabel: '🤸 Push-up',
    animationType: AVATAR_ANIMATIONS.PUSHUP,
    mode: 'angle',
    metric: 'elbowAvg',
    down: 92,
    up: 142,
    downFrames: 3,
    upFrames: 4,
    help: 'Push-up: elbow avg below 80°, then extend above 150°.',
    lowerHint: 'Lower more',
    upperHint: 'Extend fully',
  },
  lunge: {
    key: 'lunge',
    label: 'Single-Leg Squat',
    chipLabel: '🦿 Single-Leg',
    animationType: AVATAR_ANIMATIONS.PISTOL,
    mode: 'angle',
    metric: 'kneeMin',
    down: 102,
    up: 152,
    downFrames: 3,
    upFrames: 4,
    help: 'Single-leg squat: drive one knee below 92°, then extend above 158°.',
    lowerHint: 'Sink lower',
    upperHint: 'Rise fully',
  },
  plank: {
    key: 'plank',
    label: 'Plank Hold',
    chipLabel: '🧱 Plank',
    animationType: AVATAR_ANIMATIONS.PLANK,
    mode: 'hold',
    metric: 'bodyLine',
    min: 148,
    maxHipOffset: 0.22,
    reportEveryMs: 1000,
    help: 'Plank: hold a straight shoulder-hip-ankle line to bank time.',
    validHint: 'Hold steady',
    invalidHint: 'Keep your body straighter',
  },
  situp: {
    key: 'situp',
    label: 'Sit-up',
    chipLabel: '🪑 Sit-up',
    animationType: AVATAR_ANIMATIONS.SITUP,
    mode: 'angle',
    metric: 'hipAvg',
    down: 94,
    up: 128,
    downFrames: 2,
    upFrames: 3,
    help: 'Sit-up: curl torso below 82°, then open above 132°.',
    lowerHint: 'Curl higher',
    upperHint: 'Lower back down',
  },
  crunch: {
    key: 'crunch',
    label: 'Crunch',
    chipLabel: '🔥 Crunch',
    animationType: AVATAR_ANIMATIONS.CRUNCH,
    mode: 'angle',
    metric: 'hipAvg',
    down: 108,
    up: 144,
    downFrames: 2,
    upFrames: 3,
    help: 'Crunch: contract below 96°, then relax above 138°.',
    lowerHint: 'Crunch tighter',
    upperHint: 'Release slowly',
  },
  bicycle_crunch: {
    key: 'bicycle_crunch',
    label: 'Bicycle Crunch',
    chipLabel: '🚴 Bicycle',
    animationType: AVATAR_ANIMATIONS.BICYCLE_CRUNCH,
    mode: 'cross',
    close: 0.84,
    open: 1.02,
    help: 'Bicycle crunch: bring elbow to opposite knee, then switch sides.',
    lowerHint: 'Twist more',
    upperHint: 'Open back up',
  },
  circle_crunch: {
    key: 'circle_crunch',
    label: 'Circle Crunch',
    chipLabel: '⭕ Circle Crunch',
    animationType: AVATAR_ANIMATIONS.CIRCLE_CRUNCH,
    mode: 'angle',
    metric: 'hipAvg',
    down: 110,
    up: 148,
    downFrames: 2,
    upFrames: 3,
    help: 'Circle crunch: compress torso below 100°, then extend above 145°.',
    lowerHint: 'Tighten the circle',
    upperHint: 'Open back up',
  },
  jumping_jacks: {
    key: 'jumping_jacks',
    label: 'Jumping Jacks',
    chipLabel: '⭐ Jacks',
    animationType: AVATAR_ANIMATIONS.JUMPING_JACKS,
    mode: 'jack',
    openArm: 1.55,
    openLeg: 1.28,
    closedArm: 1.18,
    closedLeg: 1.18,
    help: 'Jumping jacks: open arms and feet wide, then close together.',
    lowerHint: 'Open wider',
    upperHint: 'Close fully',
  },
  burpee: {
    key: 'burpee',
    label: 'Burpee',
    chipLabel: '💥 Burpee',
    animationType: AVATAR_ANIMATIONS.BURPEE,
    mode: 'burpee',
    standKnee: 148,
    squatKnee: 118,
    plankLine: 144,
    help: 'Burpee: stand, drop low, hit plank, then come back up.',
    lowerHint: 'Drop lower',
    upperHint: 'Stand tall to finish',
  },
  running: {
    key: 'running',
    label: 'Running In Place',
    chipLabel: '🏃 Running',
    animationType: AVATAR_ANIMATIONS.RUNNING,
    mode: 'steps',
    lift: 0.055,
    help: 'Running: drive knees up and alternate legs.',
    lowerHint: 'Lift knees higher',
  },
  warmup: {
    key: 'warmup',
    label: 'Warm-up',
    chipLabel: '✨ Warm-up',
    animationType: AVATAR_ANIMATIONS.WARMUP,
    mode: 'arms',
    upLift: 0.045,
    downLift: 0.005,
    help: 'Warm-up: raise both hands above shoulder height, then lower.',
    lowerHint: 'Reach higher',
    upperHint: 'Lower arms down',
  },
  tree_pose: {
    key: 'tree_pose',
    label: 'Tree Pose',
    chipLabel: '🌳 Tree Pose',
    animationType: AVATAR_ANIMATIONS.TREE_POSE,
    mode: 'tree_hold',
    reportEveryMs: 1000,
    ankleToKneeMax: 0.28,
    minBodyLine: 145,
    help: 'Tree pose: place one foot near the opposite knee and hold balance.',
    validHint: 'Hold balance',
    invalidHint: 'Bring one foot to the standing leg',
  },
  meditation: {
    key: 'meditation',
    label: 'Meditation',
    chipLabel: '🧘 Meditation',
    animationType: AVATAR_ANIMATIONS.MEDITATION,
    mode: 'still_hold',
    reportEveryMs: 1000,
    motionThreshold: 0.04,
    help: 'Meditation: stay calm and still to build a streak.',
    validHint: 'Stay still',
    invalidHint: 'Reduce movement',
  },
  pike_walk: {
    key: 'pike_walk',
    label: 'Pike Walk',
    chipLabel: '📐 Pike Walk',
    animationType: AVATAR_ANIMATIONS.PIKE_WALK,
    mode: 'pike_steps',
    hipFoldMax: 130,
    lift: 0.03,
    help: 'Pike walk: lift hips high and take alternating small steps.',
    lowerHint: 'Lift hips higher',
  },
  crouch_hold: {
    key: 'crouch_hold',
    label: 'Crouch Hold',
    chipLabel: '🪑 Crouch Hold',
    animationType: AVATAR_ANIMATIONS.CROUCH_IDLE,
    mode: 'hold',
    metric: 'kneeAvg',
    max: 124,
    reportEveryMs: 1000,
    help: 'Crouch hold: stay low with bent knees to keep scoring.',
    validHint: 'Stay low',
    invalidHint: 'Bend your knees more',
  },
};

export const POSE_EXERCISE_OPTIONS = [
  'squat',
  'pushup',
  'lunge',
  'plank',
  'situp',
  'crunch',
  'bicycle_crunch',
  'circle_crunch',
  'jumping_jacks',
  'burpee',
  'warmup',
  'tree_pose',
  'pike_walk',
  'crouch_hold',
].map((key) => POSE_EXERCISE_DEFINITIONS[key]).filter(Boolean);

const POSE_EXERCISE_BY_ANIMATION = {
  [AVATAR_ANIMATIONS.SQUAT]: 'squat',
  [AVATAR_ANIMATIONS.SQUAT_BENT_ARMS]: 'squat',
  [AVATAR_ANIMATIONS.PUSHUP]: 'pushup',
  [AVATAR_ANIMATIONS.PUSHUP_TO_IDLE]: 'pushup',
  [AVATAR_ANIMATIONS.IDLE_TO_PUSHUP]: 'pushup',
  [AVATAR_ANIMATIONS.PLANK]: 'plank',
  [AVATAR_ANIMATIONS.START_PLANK]: 'plank',
  [AVATAR_ANIMATIONS.END_PLANK]: 'plank',
  [AVATAR_ANIMATIONS.SITUP]: 'situp',
  [AVATAR_ANIMATIONS.IDLE_TO_SITUP]: 'situp',
  [AVATAR_ANIMATIONS.BICYCLE_CRUNCH]: 'bicycle_crunch',
  [AVATAR_ANIMATIONS.START_BICYCLE_SITUP]: 'bicycle_crunch',
  [AVATAR_ANIMATIONS.END_BICYCLE_SITUP]: 'bicycle_crunch',
  [AVATAR_ANIMATIONS.CIRCLE_CRUNCH]: 'circle_crunch',
  [AVATAR_ANIMATIONS.CRUNCH]: 'crunch',
  [AVATAR_ANIMATIONS.JUMPING_JACKS]: 'jumping_jacks',
  [AVATAR_ANIMATIONS.START_JUMPING_JACKS]: 'jumping_jacks',
  [AVATAR_ANIMATIONS.STOP_JUMPING_JACKS]: 'jumping_jacks',
  [AVATAR_ANIMATIONS.BURPEE]: 'burpee',
  [AVATAR_ANIMATIONS.BURPEE_START]: 'burpee',
  [AVATAR_ANIMATIONS.BURPEE_END]: 'burpee',
  [AVATAR_ANIMATIONS.RUNNING]: 'running',
  [AVATAR_ANIMATIONS.WARMUP]: 'warmup',
  [AVATAR_ANIMATIONS.MEDITATION]: 'meditation',
  [AVATAR_ANIMATIONS.TREE_POSE]: 'tree_pose',
  [AVATAR_ANIMATIONS.PIKE_WALK]: 'pike_walk',
  [AVATAR_ANIMATIONS.PISTOL]: 'lunge',
  [AVATAR_ANIMATIONS.PISTOL_START]: 'lunge',
  [AVATAR_ANIMATIONS.PISTOL_TO_IDLE]: 'lunge',
  [AVATAR_ANIMATIONS.CROUCH_IDLE]: 'crouch_hold',
};

export const POSE_EXERCISE_RUNTIME_CONFIG = Object.fromEntries(
  Object.entries(POSE_EXERCISE_DEFINITIONS).map(([key, value]) => {
    const datasetOverrides = resolveDatasetOverrides(key, value) || {};

    return [key, {
      key,
      label: value.label,
      mode: value.mode,
      metric: value.metric || null,
      down: datasetOverrides.down ?? value.down ?? null,
      up: datasetOverrides.up ?? value.up ?? null,
      downFrames: datasetOverrides.downFrames ?? value.downFrames ?? null,
      upFrames: datasetOverrides.upFrames ?? value.upFrames ?? null,
      close: value.close ?? null,
      open: value.open ?? null,
      openArm: value.openArm ?? null,
      openLeg: value.openLeg ?? null,
      closedArm: value.closedArm ?? null,
      closedLeg: value.closedLeg ?? null,
      min: datasetOverrides.min ?? value.min ?? null,
      max: datasetOverrides.max ?? value.max ?? null,
      maxHipOffset: value.maxHipOffset ?? null,
      reportEveryMs: value.reportEveryMs ?? null,
      motionThreshold: value.motionThreshold ?? null,
      ankleToKneeMax: value.ankleToKneeMax ?? null,
      minBodyLine: value.minBodyLine ?? null,
      hipFoldMax: value.hipFoldMax ?? null,
      lift: value.lift ?? null,
      upLift: value.upLift ?? null,
      downLift: value.downLift ?? null,
      standKnee: value.standKnee ?? null,
      squatKnee: value.squatKnee ?? null,
      plankLine: value.plankLine ?? null,
      minVisibility: datasetOverrides.minVisibility ?? null,
      requiredLandmarkIndices: datasetOverrides.requiredLandmarkIndices ?? null,
      invalidFrameHint: datasetOverrides.invalidFrameHint || '',
      help: value.help,
      lowerHint: value.lowerHint || '',
      upperHint: value.upperHint || '',
      validHint: value.validHint || '',
      invalidHint: value.invalidHint || '',
    }];
  })
);

export const getPoseExerciseDefinition = (exerciseKey) => {
  const key = String(exerciseKey || '').trim().toLowerCase();
  return POSE_EXERCISE_DEFINITIONS[key] || null;
};

export const isHoldBasedPoseExercise = (exerciseKey) => {
  const definition = getPoseExerciseDefinition(exerciseKey);
  return definition ? ['hold', 'tree_hold', 'still_hold'].includes(definition.mode) : false;
};

export const getPoseExerciseMetricLabel = (exerciseKey) => {
  return isHoldBasedPoseExercise(exerciseKey) ? 'Seconds' : 'Count';
};

export const getPoseExerciseForAnimation = (animationType) => {
  const key = String(animationType || '').trim().toLowerCase();
  return POSE_EXERCISE_BY_ANIMATION[key] || null;
};