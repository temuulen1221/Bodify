const SESSION_ID_RANDOM_LENGTH = 6;

const TYPE_XP_BONUS = {
  burpee: 8,
  lunge: 6,
  pistol: 6,
  squat: 6,
  pushup: 6,
  push_up: 6,
  plank: 5,
  situp: 5,
  crunch: 5,
  bicycle_crunch: 6,
  circle_crunch: 6,
  jumping_jacks: 5,
  running: 4,
  cycling: 4,
  biking: 4,
  biking_outdoor: 4,
  hiking: 5,
  cardio: 4,
  strength: 4,
  warmup: 2,
  warm_up: 2,
  general: 2,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toFiniteNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const normalizeExerciseType = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));

const buildGeneratedSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 2 + SESSION_ID_RANDOM_LENGTH)}`;
};

const parseExerciseDetailsFromNotes = (notes) => {
  const raw = String(notes || '').trim();
  if (!raw || !raw.includes('·')) return [];

  return raw
    .split('·')
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      type: normalizeExerciseType(label),
    }));
};

export const normalizeWorkoutExerciseDetails = (session = {}) => {
  const details = [];
  const sourceDetails = Array.isArray(session.exerciseDetails) ? session.exerciseDetails : [];

  sourceDetails.forEach((detail) => {
    const label = String(detail?.label || detail?.title || '').trim();
    const type = normalizeExerciseType(detail?.type || detail?.animationType || detail?.poseExercise || label);
    const reps = Math.max(0, Math.floor(toFiniteNumber(detail?.reps)));
    const seconds = Math.max(0, Math.floor(toFiniteNumber(detail?.seconds ?? detail?.durationSec ?? detail?.plankSeconds)));
    const durationMin = Math.max(0, Math.round(toFiniteNumber(detail?.durationMin) * 10) / 10);
    if (!label && !type && reps <= 0 && seconds <= 0 && durationMin <= 0) return;
    details.push({
      ...detail,
      label: label || detail?.label || detail?.title || 'Exercise',
      type,
      reps,
      seconds,
      durationMin,
    });
  });

  if (details.length > 0) return details;

  const fallbackLabel = String(session.title || '').trim();
  const fallbackType = normalizeExerciseType(session.type || fallbackLabel || 'general');
  const fallbackReps = Math.max(0, Math.floor(toFiniteNumber(session.reps ?? session.pushups)));
  const fallbackSeconds = Math.max(0, Math.floor(toFiniteNumber(session.seconds ?? session.plankSeconds)));

  if (fallbackReps > 0 || fallbackSeconds > 0) {
    return [{
      label: fallbackLabel || 'Workout',
      type: fallbackType || 'general',
      reps: fallbackReps,
      seconds: fallbackSeconds,
      durationMin: Math.max(0, Math.round(toFiniteNumber(session.durationMin) * 10) / 10),
    }];
  }

  return parseExerciseDetailsFromNotes(session.notes);
};

export const calculateWorkoutSessionXP = (session = {}) => {
  const durationMin = clamp(Math.floor(toFiniteNumber(session.durationMin)), 0, 180);
  const calories = clamp(Math.floor(toFiniteNumber(session.calories)), 0, 2500);
  const sessionType = normalizeExerciseType(session.type);
  const details = normalizeWorkoutExerciseDetails(session);
  const totalReps = details.reduce((sum, detail) => sum + Math.max(0, Math.floor(toFiniteNumber(detail.reps))), 0);
  const totalHoldSeconds = details.reduce((sum, detail) => sum + Math.max(0, Math.floor(toFiniteNumber(detail.seconds))), 0);
  const uniqueTypes = uniqueValues(details.map((detail) => normalizeExerciseType(detail.type || detail.label)));
  const typeBonus = uniqueTypes.reduce((sum, type) => sum + (TYPE_XP_BONUS[type] || 0), 0);
  const hasWorkoutEvidence = durationMin > 0 || calories > 0 || totalReps > 0 || totalHoldSeconds > 0 || uniqueTypes.length > 0;
  if (!hasWorkoutEvidence) return 0;
  const baseXP = 8;
  const durationXP = Math.min(24, Math.floor(durationMin / 2));
  const calorieXP = Math.min(24, Math.floor(calories / 25));
  const repsXP = Math.min(20, Math.floor(totalReps / 5));
  const holdXP = Math.min(18, Math.floor(totalHoldSeconds / 20));
  const varietyXP = Math.min(15, Math.max(0, uniqueTypes.length - 1) * 5);
  const sessionTypeBonus = TYPE_XP_BONUS[sessionType] || 0;
  const totalXP = clamp(baseXP + durationXP + calorieXP + repsXP + holdXP + Math.min(18, typeBonus + sessionTypeBonus) + varietyXP, 5, 95);
  return Math.floor(totalXP);
};

export const createWorkoutSessionRecord = (session = {}) => {
  const normalizedDuration = Math.max(0, Math.round(toFiniteNumber(session.durationMin) * 10) / 10);
  const normalizedCalories = Math.max(0, Math.floor(toFiniteNumber(session.calories)));
  const normalizedDetails = normalizeWorkoutExerciseDetails(session);
  const record = {
    ...session,
    id: typeof session.id === 'string' && session.id.trim() ? session.id : buildGeneratedSessionId(),
    title: String(session.title || 'Workout'),
    durationMin: normalizedDuration,
    calories: normalizedCalories,
    notes: String(session.notes || ''),
    type: normalizeExerciseType(session.type || 'general') || 'general',
    createdAt: Number.isFinite(Number(session.createdAt)) ? Number(session.createdAt) : Date.now(),
  };

  if (normalizedDetails.length > 0) {
    record.exerciseDetails = normalizedDetails;
  }

  record.awardedXP = calculateWorkoutSessionXP({ ...record, exerciseDetails: normalizedDetails });
  return record;
};