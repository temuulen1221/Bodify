const AVATAR_ANIMATIONS = {
  IDLE: 'idle',
  PROCEDURAL_IDLE: 'procedural_idle',
  HAPPY: 'happy',
  SURPRISED: 'surprised',
  SAD: 'sad',
  DANCE: 'dance',
  WAVE: 'wave',
  LAUGH: 'laugh',
  TALK: 'talk',
  THINKING: 'thinking',
  WARMUP: 'warmup',
  RUNNING: 'running',
  SQUAT: 'squat',
  SQUAT_BENT_ARMS: 'squat_bent_arms',
  PUSHUP: 'pushup',
  PUSHUP_TO_IDLE: 'pushup_to_idle',
  IDLE_TO_PUSHUP: 'idle_to_pushup',
  PLANK: 'plank',
  START_PLANK: 'start_plank',
  END_PLANK: 'end_plank',
  SITUP: 'situp',
  IDLE_TO_SITUP: 'idle_to_situp',
  BICYCLE_CRUNCH: 'bicycle_crunch',
  CIRCLE_CRUNCH: 'circle_crunch',
  CRUNCH: 'crunch',
  START_BICYCLE_SITUP: 'start_bicycle_situp',
  END_BICYCLE_SITUP: 'end_bicycle_situp',
  JUMPING_JACKS: 'jumping_jacks',
  START_JUMPING_JACKS: 'start_jumping_jacks',
  STOP_JUMPING_JACKS: 'stop_jumping_jacks',
  BURPEE: 'burpee',
  BURPEE_START: 'burpee_start',
  BURPEE_END: 'burpee_end',
  CROUCH_IDLE: 'crouch_idle',
  PIKE_WALK: 'pike_walk',
  PISTOL: 'pistol',
  PISTOL_START: 'pistol_start',
  PISTOL_TO_IDLE: 'pistol_to_idle',
  MEDITATION: 'meditation',
  TREE_POSE: 'tree_pose',
};

const animationAliases = {
  procedural_idle: AVATAR_ANIMATIONS.PROCEDURAL_IDLE,
  proceduralidle: AVATAR_ANIMATIONS.PROCEDURAL_IDLE,
  rest: AVATAR_ANIMATIONS.PROCEDURAL_IDLE,
  run: AVATAR_ANIMATIONS.RUNNING,
  running: AVATAR_ANIMATIONS.RUNNING,
  jog: AVATAR_ANIMATIONS.RUNNING,
  squat: AVATAR_ANIMATIONS.SQUAT,
  squats: AVATAR_ANIMATIONS.SQUAT,
  air_squat: AVATAR_ANIMATIONS.SQUAT,
  air_squat_bent_arms: AVATAR_ANIMATIONS.SQUAT_BENT_ARMS,
  pushup: AVATAR_ANIMATIONS.PUSHUP,
  'push-up': AVATAR_ANIMATIONS.PUSHUP,
  pushups: AVATAR_ANIMATIONS.PUSHUP,
  'push-ups': AVATAR_ANIMATIONS.PUSHUP,
  plank: AVATAR_ANIMATIONS.PLANK,
  situp: AVATAR_ANIMATIONS.SITUP,
  'sit-up': AVATAR_ANIMATIONS.SITUP,
  situps: AVATAR_ANIMATIONS.SITUP,
  'sit-ups': AVATAR_ANIMATIONS.SITUP,
  bicycle: AVATAR_ANIMATIONS.BICYCLE_CRUNCH,
  bicycle_crunch: AVATAR_ANIMATIONS.BICYCLE_CRUNCH,
  crunch: AVATAR_ANIMATIONS.CRUNCH,
  circle_crunch: AVATAR_ANIMATIONS.CIRCLE_CRUNCH,
  jumping_jacks: AVATAR_ANIMATIONS.JUMPING_JACKS,
  jumpingjacks: AVATAR_ANIMATIONS.JUMPING_JACKS,
  burpee: AVATAR_ANIMATIONS.BURPEE,
  crouch: AVATAR_ANIMATIONS.CROUCH_IDLE,
  crouch_idle: AVATAR_ANIMATIONS.CROUCH_IDLE,
  pike_walk: AVATAR_ANIMATIONS.PIKE_WALK,
  pistol: AVATAR_ANIMATIONS.PISTOL,
  meditation: AVATAR_ANIMATIONS.MEDITATION,
  yoga: AVATAR_ANIMATIONS.TREE_POSE,
  vrikshasana: AVATAR_ANIMATIONS.TREE_POSE,
  warmup: AVATAR_ANIMATIONS.WARMUP,
  warm_up: AVATAR_ANIMATIONS.WARMUP,
};

const customFbxAnimationEntries = [
  { key: 'idle_transition', label: 'Idle Transition', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Idle Transition.fbx'), loop: false, durationMs: 1400, format: 'fbx', startOffsetMs: 260 },
  { key: 'holding_idle', label: 'Holding Idle', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Holding Idle.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'catwalk_idle_twist_l', label: 'Catwalk Idle Twist L', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Catwalk Idle Twist L.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'catwalk_idle_01', label: 'Catwalk Idle 01', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Catwalk Idle 01.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'bored_idle_fbx', label: 'Bored', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Bored.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'idle_male_fbx', label: 'Idle Male FBX', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/idle_male.fbx'), loop: true, durationMs: 0, format: 'fbx', startOffsetMs: 140 },
  { key: 'idle_female_fbx', label: 'Idle Female FBX', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Idle_female.fbx'), loop: true, durationMs: 0, format: 'fbx', startOffsetMs: 140 },
  { key: 'offensive_idle', label: 'Offensive Idle', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Offensive Idle.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'sad_idle_fbx', label: 'Sad Idle', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Sad Idle.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'standard_idle_fbx', label: 'Standard Idle FBX', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Standard Idle.fbx'), loop: true, durationMs: 0, format: 'fbx', startOffsetMs: 120 },
  { key: 'standing_briefcase_idle', label: 'Briefcase Idle', category: 'idle-fbx', asset: require('../assets/animations/animations fbx/idle fbx/Standing W_Briefcase Idle.fbx'), loop: true, durationMs: 0, format: 'fbx' },
  { key: 'acknowledging_fbx', label: 'Acknowledging', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/acknowledging.fbx'), loop: false, durationMs: 1500, format: 'fbx', startOffsetMs: 160 },
  { key: 'angry_gesture', label: 'Angry Gesture', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/angry gesture.fbx'), loop: false, durationMs: 1700, format: 'fbx' },
  { key: 'annoyed_head_shake', label: 'Annoyed Head Shake', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/annoyed head shake.fbx'), loop: false, durationMs: 1500, format: 'fbx' },
  { key: 'arm_stretching_fbx', label: 'Arm Stretching', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Arm Stretching.fbx'), loop: false, durationMs: 2200, format: 'fbx' },
  { key: 'being_cocky', label: 'Being Cocky', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/being cocky.fbx'), loop: false, durationMs: 1900, format: 'fbx' },
  { key: 'crazy_gesture', label: 'Crazy Gesture', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Crazy Gesture.fbx'), loop: false, durationMs: 2100, format: 'fbx' },
  { key: 'dismissing_gesture', label: 'Dismissing Gesture', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/dismissing gesture.fbx'), loop: false, durationMs: 1700, format: 'fbx' },
  { key: 'fist_pump_fbx', label: 'Fist Pump', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Fist Pump.fbx'), loop: false, durationMs: 1400, format: 'fbx' },
  { key: 'happy_hand_gesture', label: 'Happy Hand Gesture', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/happy hand gesture.fbx'), loop: false, durationMs: 1700, format: 'fbx' },
  { key: 'hard_head_nod', label: 'Hard Head Nod', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/hard head nod.fbx'), loop: false, durationMs: 1300, format: 'fbx' },
  { key: 'head_nod_yes', label: 'Head Nod Yes', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/head nod yes.fbx'), loop: false, durationMs: 1200, format: 'fbx' },
  { key: 'lengthy_head_nod', label: 'Lengthy Head Nod', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/lengthy head nod.fbx'), loop: false, durationMs: 1800, format: 'fbx' },
  { key: 'look_around_fbx', label: 'Look Around', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Look Around.fbx'), loop: false, durationMs: 2000, format: 'fbx', startOffsetMs: 180 },
  { key: 'look_away_gesture', label: 'Look Away Gesture', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/look away gesture.fbx'), loop: false, durationMs: 1600, format: 'fbx' },
  { key: 'neck_stretching_fbx', label: 'Neck Stretching', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Neck Stretching.fbx'), loop: false, durationMs: 2100, format: 'fbx' },
  { key: 'pointing_male_fbx', label: 'Pointing Male', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Pointing_male.fbx'), loop: false, durationMs: 1800, format: 'fbx' },
  { key: 'relieved_sigh', label: 'Relieved Sigh', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/relieved sigh.fbx'), loop: false, durationMs: 1800, format: 'fbx', startOffsetMs: 160 },
  { key: 'sarcastic_head_nod', label: 'Sarcastic Head Nod', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/sarcastic head nod.fbx'), loop: false, durationMs: 1500, format: 'fbx' },
  { key: 'shaking_head_no', label: 'Shaking Head No', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/shaking head no.fbx'), loop: false, durationMs: 1400, format: 'fbx' },
  { key: 'thoughtful_head_shake', label: 'Thoughtful Head Shake', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Thoughtful Head Shake.fbx'), loop: false, durationMs: 1600, format: 'fbx', startOffsetMs: 150 },
  { key: 'weight_shift_fbx', label: 'Weight Shift', category: 'gesture-fbx', asset: require('../assets/animations/animations fbx/Gestures Pack Basic/weight shift.fbx'), loop: false, durationMs: 2200, format: 'fbx', startOffsetMs: 180 },
];

const recommendedCustomFbxKeys = [
  'idle_male_fbx',
  'idle_female_fbx',
  'standard_idle_fbx',
  'holding_idle',
  'acknowledging_fbx',
  'happy_hand_gesture',
  'fist_pump_fbx',
  'look_around_fbx',
  'thoughtful_head_shake',
  'relieved_sigh',
  'shaking_head_no',
  'weight_shift_fbx',
  'pointing_male_fbx',
];

const customFbxAnimationMap = Object.fromEntries(
  customFbxAnimationEntries.map(({ key, ...value }) => [key, value])
);

Object.assign(animationAliases, Object.fromEntries(
  customFbxAnimationEntries.map(({ key, label }) => [label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), key])
));

const genderIdleDefaults = {
  male: 'idle_male_fbx',
  female: 'idle_female_fbx',
  neutral: 'standard_idle_fbx',
};

const workoutAnimationMap = {
  warmup: {
    asset: require('../assets/animations/animations fbx/workout/warmup.fbx'),
    label: 'Warm-up',
    loop: true,
    durationMs: 2400,
    format: 'fbx',
  },
  running: {
    asset: require('../assets/animations/animations fbx/workout/Running.fbx'),
    label: 'Running',
    loop: true,
    durationMs: 3600,
    format: 'fbx',
  },
  squat: {
    asset: require('../assets/animations/animations fbx/workout/Air Squat.fbx'),
    label: 'Air Squat',
    loop: false,
    durationMs: 1800,
    format: 'fbx',
  },
  squat_bent_arms: {
    asset: require('../assets/animations/animations fbx/workout/Air Squat Bent Arms.fbx'),
    label: 'Air Squat Bent Arms',
    loop: false,
    durationMs: 1800,
    format: 'fbx',
  },
  pushup: {
    asset: require('../assets/animations/animations fbx/workout/Push Up.fbx'),
    label: 'Push-up',
    loop: false,
    durationMs: 1600,
    format: 'fbx',
  },
  pushup_to_idle: {
    asset: require('../assets/animations/animations fbx/workout/Push Up To Idle.fbx'),
    label: 'Push-up To Idle',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  idle_to_pushup: {
    asset: require('../assets/animations/animations fbx/workout/Idle To Push Up.fbx'),
    label: 'Idle To Push-up',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  plank: {
    asset: require('../assets/animations/animations fbx/workout/Plank.fbx'),
    label: 'Plank',
    loop: true,
    durationMs: 3200,
    format: 'fbx',
  },
  start_plank: {
    asset: require('../assets/animations/animations fbx/workout/Start Plank.fbx'),
    label: 'Start Plank',
    loop: false,
    durationMs: 1300,
    format: 'fbx',
  },
  end_plank: {
    asset: require('../assets/animations/animations fbx/workout/End Plank.fbx'),
    label: 'End Plank',
    loop: false,
    durationMs: 1300,
    format: 'fbx',
  },
  situp: {
    asset: require('../assets/animations/animations fbx/workout/Situps.fbx'),
    label: 'Sit-up',
    loop: false,
    durationMs: 1700,
    format: 'fbx',
  },
  idle_to_situp: {
    asset: require('../assets/animations/animations fbx/workout/Idle To Situp.fbx'),
    label: 'Idle To Sit-up',
    loop: false,
    durationMs: 1300,
    format: 'fbx',
  },
  bicycle_crunch: {
    asset: require('../assets/animations/animations fbx/workout/Bicycle Crunch.fbx'),
    label: 'Bicycle Crunch',
    loop: false,
    durationMs: 1800,
    format: 'fbx',
  },
  circle_crunch: {
    asset: require('../assets/animations/animations fbx/workout/Circle Crunch.fbx'),
    label: 'Circle Crunch',
    loop: false,
    durationMs: 1800,
    format: 'fbx',
  },
  crunch: {
    asset: require('../assets/animations/animations fbx/workout/Situps.fbx'),
    label: 'Crunch',
    loop: false,
    durationMs: 1500,
    format: 'fbx',
  },
  start_bicycle_situp: {
    asset: require('../assets/animations/animations fbx/workout/Start Bicycle Sit Up.fbx'),
    label: 'Start Bicycle Sit-up',
    loop: false,
    durationMs: 1300,
    format: 'fbx',
  },
  end_bicycle_situp: {
    asset: require('../assets/animations/animations fbx/workout/End Bicycle Sit Up.fbx'),
    label: 'End Bicycle Sit-up',
    loop: false,
    durationMs: 1300,
    format: 'fbx',
  },
  jumping_jacks: {
    asset: require('../assets/animations/animations fbx/workout/Jumping Jacks.fbx'),
    label: 'Jumping Jacks',
    loop: false,
    durationMs: 1800,
    format: 'fbx',
  },
  start_jumping_jacks: {
    asset: require('../assets/animations/animations fbx/workout/Start Jumping Jacks.fbx'),
    label: 'Start Jumping Jacks',
    loop: false,
    durationMs: 1000,
    format: 'fbx',
  },
  stop_jumping_jacks: {
    asset: require('../assets/animations/animations fbx/workout/Stop Jumping Jacks.fbx'),
    label: 'Stop Jumping Jacks',
    loop: false,
    durationMs: 1000,
    format: 'fbx',
  },
  burpee: {
    asset: require('../assets/animations/animations fbx/workout/Burpee.fbx'),
    label: 'Burpee',
    loop: false,
    durationMs: 1900,
    format: 'fbx',
  },
  burpee_start: {
    asset: require('../assets/animations/animations fbx/workout/Burpee Start.fbx'),
    label: 'Burpee Start',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  burpee_end: {
    asset: require('../assets/animations/animations fbx/workout/Burpee End.fbx'),
    label: 'Burpee End',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  crouch_idle: {
    asset: require('../assets/animations/animations fbx/idle fbx/Holding Idle.fbx'),
    label: 'Crouch Idle',
    loop: true,
    durationMs: 2200,
    format: 'fbx',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/Trend dance moves/Crouch_Idle_Break_v01.glb'),
    glbFormat: 'gltf',
  },
  pike_walk: {
    asset: require('../assets/animations/animations fbx/workout/Pike Walk.fbx'),
    label: 'Pike Walk',
    loop: false,
    durationMs: 2200,
    format: 'fbx',
  },
  pistol: {
    asset: require('../assets/animations/animations fbx/workout/Pistol.fbx'),
    label: 'Pistol Squat',
    loop: false,
    durationMs: 1900,
    format: 'fbx',
  },
  pistol_start: {
    asset: require('../assets/animations/animations fbx/workout/Pistol Start.fbx'),
    label: 'Pistol Start',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  pistol_to_idle: {
    asset: require('../assets/animations/animations fbx/workout/Pistol To Idle.fbx'),
    label: 'Pistol To Idle',
    loop: false,
    durationMs: 1200,
    format: 'fbx',
  },
  meditation: {
    asset: require('../assets/animations/animations fbx/idle fbx/Holding Idle.fbx'),
    label: 'Meditation',
    loop: true,
    durationMs: 3600,
    format: 'fbx',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/Standard_SittingOnGroundRelaxingFeminine.glb'),
    glbFormat: 'gltf',
  },
  tree_pose: {
    asset: require('../assets/animations/animations fbx/idle fbx/Holding Idle.fbx'),
    label: 'Tree Pose',
    loop: true,
    durationMs: 3600,
    format: 'fbx',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/idle/Standard_Waiting.glb'),
    glbFormat: 'gltf',
  },
};

const createDisabledAnimationEntry = (label, durationMs = 900) => ({
  asset: null,
  label,
  loop: false,
  durationMs,
  disabled: true,
});

const disabledAnimationMap = {
  procedural_idle: {
    asset: null,
    label: 'Procedural Idle',
    loop: true,
    durationMs: 0,
    disabled: true,
  },
  surprised: createDisabledAnimationEntry('Surprised', 1400),
};

const animationAssetMap = {
  idle: {
    male: customFbxAnimationMap[genderIdleDefaults.male].asset,
    female: customFbxAnimationMap[genderIdleDefaults.female].asset,
    neutral: customFbxAnimationMap[genderIdleDefaults.neutral].asset,
    format: 'fbx',
    label: 'Idle',
    loop: true,
    durationMs: 0,
  },
  talk: {
    male: require('../assets/animations/animations fbx/Gestures Pack Basic/Talking.fbx'),
    female: require('../assets/animations/animations fbx/Gestures Pack Basic/Talking_female.fbx'),
    neutral: require('../assets/animations/animations fbx/Gestures Pack Basic/Talking.fbx'),
    label: 'Talk',
    loop: true,
    durationMs: 1400,
    format: 'fbx',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/Standard_VtubingMovement.glb'),
    glbFormat: 'gltf',
  },
  thinking: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Thoughtful Head Shake.fbx'),
    label: 'Thinking',
    loop: false,
    durationMs: 1600,
    format: 'fbx',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/idle/Relaxed_Stand_Idle_Break_v03.glb'),
    glbFormat: 'gltf',
  },
  wave: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Waving.fbx'),
    loop: false,
    durationMs: 1800,
    format: 'fbx',
    label: 'Waving',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/Standard_Waving_woman.glb'),
    glbFormat: 'gltf',
  },
  happy: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/happy hand gesture.fbx'),
    loop: false,
    durationMs: 1700,
    format: 'fbx',
    label: 'Happy Hand Gesture',
  },
  laugh: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Fist Pump.fbx'),
    loop: false,
    durationMs: 1400,
    format: 'fbx',
    label: 'Fist Pump',
  },
  sad: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/relieved sigh.fbx'),
    loop: false,
    durationMs: 1800,
    format: 'fbx',
    label: 'Relieved Sigh',
  },
  dance: {
    asset: require('../assets/animations/animations fbx/Gestures Pack Basic/Crazy Gesture.fbx'),
    loop: false,
    durationMs: 2600,
    format: 'fbx',
    label: 'Dance',
    disabled: true,
    glbAsset: require('../assets/animations/avatar animations/Trend dance moves/SugarOnMyTongueV2.glb'),
    glbFormat: 'gltf',
  },
  ...workoutAnimationMap,
  ...disabledAnimationMap,
  ...customFbxAnimationMap,
};

const normalizeGender = (gender) => {
  const value = String(gender || '').toLowerCase();
  if (value === 'female') return 'female';
  if (value === 'male') return 'male';
  return 'neutral';
};

export const isIdleAnimationType = (animationType) => {
  const value = String(animationType || '').toLowerCase();
  return value === AVATAR_ANIMATIONS.IDLE || value === AVATAR_ANIMATIONS.PROCEDURAL_IDLE;
};

export const resolveAvatarAnimationConfig = (animationType, gender = 'neutral') => {
  const requestedKey = String(animationType || AVATAR_ANIMATIONS.IDLE).toLowerCase();
  const key = animationAliases[requestedKey] || requestedKey;
  const entry = animationAssetMap[key] || animationAssetMap[AVATAR_ANIMATIONS.IDLE];
  const normalizedGender = normalizeGender(gender);
  const asset = entry.asset || entry[normalizedGender] || entry.neutral || entry.male || entry.female;

  return {
    key,
    id: `${key}-${normalizedGender}`,
    asset,
    format: asset ? (entry.format || 'gltf') : null,
    label: entry.label || key,
    loop: entry.loop !== false,
    durationMs: entry.durationMs || 0,
    startOffsetMs: Math.max(0, Number(entry.startOffsetMs) || 0),
    disabled: entry.disabled === true,
    phase: key === AVATAR_ANIMATIONS.IDLE ? 'loop' : 'state',
  };
};

export const getAvatarAnimationDuration = (animationType, gender = 'neutral', fallbackMs = 900) => {
  const config = resolveAvatarAnimationConfig(animationType, gender);
  return config.loop ? fallbackMs : (config.durationMs || fallbackMs);
};

const expressionConfig = (name, value = 1) => ({ name, value });

const animationExpressionMap = {
  [AVATAR_ANIMATIONS.IDLE]: expressionConfig('neutral', 0.9),
  [AVATAR_ANIMATIONS.PROCEDURAL_IDLE]: expressionConfig('neutral', 0.9),
  [AVATAR_ANIMATIONS.TALK]: expressionConfig('happy', 0.28),
  [AVATAR_ANIMATIONS.THINKING]: expressionConfig('relaxed', 0.45),
  [AVATAR_ANIMATIONS.WAVE]: expressionConfig('happy', 0.72),
  [AVATAR_ANIMATIONS.HAPPY]: expressionConfig('happy', 0.95),
  [AVATAR_ANIMATIONS.LAUGH]: expressionConfig('happy', 1),
  [AVATAR_ANIMATIONS.DANCE]: expressionConfig('happy', 0.9),
  [AVATAR_ANIMATIONS.SAD]: expressionConfig('sad', 0.88),
  [AVATAR_ANIMATIONS.SURPRISED]: expressionConfig('surprised', 1),
  [AVATAR_ANIMATIONS.WARMUP]: expressionConfig('happy', 0.4),
  [AVATAR_ANIMATIONS.RUNNING]: expressionConfig('happy', 0.34),
  [AVATAR_ANIMATIONS.SQUAT]: expressionConfig('neutral', 0.5),
  [AVATAR_ANIMATIONS.SQUAT_BENT_ARMS]: expressionConfig('neutral', 0.5),
  [AVATAR_ANIMATIONS.PUSHUP]: expressionConfig('neutral', 0.52),
  [AVATAR_ANIMATIONS.PUSHUP_TO_IDLE]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.IDLE_TO_PUSHUP]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.PLANK]: expressionConfig('neutral', 0.6),
  [AVATAR_ANIMATIONS.START_PLANK]: expressionConfig('neutral', 0.45),
  [AVATAR_ANIMATIONS.END_PLANK]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.SITUP]: expressionConfig('neutral', 0.52),
  [AVATAR_ANIMATIONS.IDLE_TO_SITUP]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.BICYCLE_CRUNCH]: expressionConfig('neutral', 0.55),
  [AVATAR_ANIMATIONS.CIRCLE_CRUNCH]: expressionConfig('neutral', 0.55),
  [AVATAR_ANIMATIONS.CRUNCH]: expressionConfig('neutral', 0.52),
  [AVATAR_ANIMATIONS.START_BICYCLE_SITUP]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.END_BICYCLE_SITUP]: expressionConfig('neutral', 0.42),
  [AVATAR_ANIMATIONS.JUMPING_JACKS]: expressionConfig('happy', 0.5),
  [AVATAR_ANIMATIONS.START_JUMPING_JACKS]: expressionConfig('happy', 0.38),
  [AVATAR_ANIMATIONS.STOP_JUMPING_JACKS]: expressionConfig('happy', 0.32),
  [AVATAR_ANIMATIONS.BURPEE]: expressionConfig('neutral', 0.58),
  [AVATAR_ANIMATIONS.BURPEE_START]: expressionConfig('neutral', 0.44),
  [AVATAR_ANIMATIONS.BURPEE_END]: expressionConfig('neutral', 0.38),
  [AVATAR_ANIMATIONS.CROUCH_IDLE]: expressionConfig('neutral', 0.48),
  [AVATAR_ANIMATIONS.PIKE_WALK]: expressionConfig('neutral', 0.5),
  [AVATAR_ANIMATIONS.PISTOL]: expressionConfig('neutral', 0.55),
  [AVATAR_ANIMATIONS.PISTOL_START]: expressionConfig('neutral', 0.45),
  [AVATAR_ANIMATIONS.PISTOL_TO_IDLE]: expressionConfig('neutral', 0.4),
  [AVATAR_ANIMATIONS.MEDITATION]: expressionConfig('relaxed', 0.92),
  [AVATAR_ANIMATIONS.TREE_POSE]: expressionConfig('relaxed', 0.88),
};

const patternedAnimationExpressions = [
  { pattern: /happy|fist_pump|dance|celebrat/i, config: expressionConfig('happy', 0.9) },
  { pattern: /angry|annoyed/i, config: expressionConfig('angry', 0.82) },
  { pattern: /sad|relieved_sigh/i, config: expressionConfig('sad', 0.82) },
  { pattern: /surpris/i, config: expressionConfig('surprised', 0.95) },
  { pattern: /think|thoughtful|look_around|look_away/i, config: expressionConfig('relaxed', 0.45) },
  { pattern: /meditation|tree_pose|idle|laying|sitting/i, config: expressionConfig('relaxed', 0.72) },
  { pattern: /wave|acknowledg|pointing/i, config: expressionConfig('happy', 0.68) },
];

export const resolveAvatarExpressionConfig = (animationType, gender = 'neutral') => {
  const config = resolveAvatarAnimationConfig(animationType, gender);
  if (animationExpressionMap[config.key]) return animationExpressionMap[config.key];

  const match = patternedAnimationExpressions.find((entry) => entry.pattern.test(config.key) || entry.pattern.test(config.label));
  if (match) return match.config;

  return expressionConfig('neutral', 0.4);
};

export const WORKOUT_ANIMATION_TYPES = [
  AVATAR_ANIMATIONS.WARMUP,
  AVATAR_ANIMATIONS.RUNNING,
  AVATAR_ANIMATIONS.SQUAT,
  AVATAR_ANIMATIONS.SQUAT_BENT_ARMS,
  AVATAR_ANIMATIONS.PUSHUP,
  AVATAR_ANIMATIONS.PUSHUP_TO_IDLE,
  AVATAR_ANIMATIONS.IDLE_TO_PUSHUP,
  AVATAR_ANIMATIONS.PLANK,
  AVATAR_ANIMATIONS.START_PLANK,
  AVATAR_ANIMATIONS.END_PLANK,
  AVATAR_ANIMATIONS.SITUP,
  AVATAR_ANIMATIONS.IDLE_TO_SITUP,
  AVATAR_ANIMATIONS.BICYCLE_CRUNCH,
  AVATAR_ANIMATIONS.CIRCLE_CRUNCH,
  AVATAR_ANIMATIONS.CRUNCH,
  AVATAR_ANIMATIONS.START_BICYCLE_SITUP,
  AVATAR_ANIMATIONS.END_BICYCLE_SITUP,
  AVATAR_ANIMATIONS.JUMPING_JACKS,
  AVATAR_ANIMATIONS.START_JUMPING_JACKS,
  AVATAR_ANIMATIONS.STOP_JUMPING_JACKS,
  AVATAR_ANIMATIONS.BURPEE,
  AVATAR_ANIMATIONS.BURPEE_START,
  AVATAR_ANIMATIONS.BURPEE_END,
  AVATAR_ANIMATIONS.CROUCH_IDLE,
  AVATAR_ANIMATIONS.PIKE_WALK,
  AVATAR_ANIMATIONS.PISTOL,
  AVATAR_ANIMATIONS.PISTOL_START,
  AVATAR_ANIMATIONS.PISTOL_TO_IDLE,
  AVATAR_ANIMATIONS.MEDITATION,
  AVATAR_ANIMATIONS.TREE_POSE,
];

export const CUSTOM_FBX_ANIMATION_OPTIONS = customFbxAnimationEntries.map(({ key, label, category, loop, format, durationMs }) => ({
  key,
  label,
  category,
  loop,
  format,
  durationMs,
}));

export const IDLE_LOOP_ANIMATION_OPTIONS = customFbxAnimationEntries
  .filter(({ category, loop, key }) => category === 'idle-fbx' && loop !== false && key !== 'idle_transition')
  .map(({ key, label, category, loop, format, durationMs }) => ({
    key,
    label,
    category,
    loop,
    format,
    durationMs,
  }));

export const RECOMMENDED_FBX_ANIMATION_OPTIONS = recommendedCustomFbxKeys
  .map((key) => customFbxAnimationEntries.find((entry) => entry.key === key))
  .filter(Boolean)
  .map(({ key, label, category, loop, format, durationMs }) => ({
    key,
    label,
    category,
    loop,
    format,
    durationMs,
  }));

export { AVATAR_ANIMATIONS };

