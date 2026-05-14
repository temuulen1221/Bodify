const STEPS_PER_XP_BUCKET = 1000;
const XP_PER_STEP_BUCKET = 5;
const DAILY_STEP_XP_CAP = 75;

const toFiniteNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

export const calculateDailyStepXP = (steps) => {
  const normalizedSteps = Math.max(0, Math.floor(toFiniteNumber(steps)));
  const bucketXp = Math.floor(normalizedSteps / STEPS_PER_XP_BUCKET) * XP_PER_STEP_BUCKET;
  return Math.min(DAILY_STEP_XP_CAP, bucketXp);
};

export const sumStepXPByDateMap = (stepsByDate = {}) => {
  if (!stepsByDate || typeof stepsByDate !== 'object') return 0;
  return Object.values(stepsByDate).reduce((sum, steps) => sum + calculateDailyStepXP(steps), 0);
};