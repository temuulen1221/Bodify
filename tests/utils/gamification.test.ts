import { BADGE_XP_LEVEL_STEP_BY_CATEGORY, deriveBadgeLevelFromCategoryXp, getRankForLevel } from '../../utils/badgeSystem';
import {
    formatTimerLabel,
    inferPlanTarget,
    inferPoseExerciseFromItem,
    normalizePlanExercise,
} from '../../utils/poseScreenUtils';

// ---------------------------------------------------------------------------
// deriveBadgeLevelFromCategoryXp
// ---------------------------------------------------------------------------
describe('deriveBadgeLevelFromCategoryXp', () => {
  it('returns level 0 for 0 XP', () => {
    expect(deriveBadgeLevelFromCategoryXp('workout', 0)).toBe(0);
  });

  it('returns level 1 at the step threshold (120 XP for workout)', () => {
    const step = BADGE_XP_LEVEL_STEP_BY_CATEGORY.workout; // 120
    expect(deriveBadgeLevelFromCategoryXp('workout', step)).toBe(1);
  });

  it('increases level proportionally', () => {
    const step = BADGE_XP_LEVEL_STEP_BY_CATEGORY.runner; // 100
    expect(deriveBadgeLevelFromCategoryXp('runner', step * 3)).toBe(3);
  });

  it('uses 120 as default step for unknown category keys', () => {
    expect(deriveBadgeLevelFromCategoryXp('unknown_category', 120)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getRankForLevel
// ---------------------------------------------------------------------------
describe('getRankForLevel', () => {
  it('returns D for low levels', () => {
    expect(getRankForLevel(1)).toBe('D');
    expect(getRankForLevel(4)).toBe('D');
  });

  it('returns C for level 5', () => {
    expect(getRankForLevel(5)).toBe('C');
  });

  it('returns B for level 10', () => {
    expect(getRankForLevel(10)).toBe('B');
  });

  it('returns A for level 15', () => {
    expect(getRankForLevel(15)).toBe('A');
  });

  it('returns S for level 20+', () => {
    expect(getRankForLevel(20)).toBe('S');
    expect(getRankForLevel(50)).toBe('S');
  });
});

// ---------------------------------------------------------------------------
// formatTimerLabel
// ---------------------------------------------------------------------------
describe('formatTimerLabel', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTimerLabel(0)).toBe('00:00');
  });

  it('formats sub-minute seconds', () => {
    expect(formatTimerLabel(45)).toBe('00:45');
  });

  it('formats 90 seconds as 01:30', () => {
    expect(formatTimerLabel(90)).toBe('01:30');
  });

  it('formats hours when seconds >= 3600', () => {
    expect(formatTimerLabel(3661)).toBe('01:01:01');
  });

  it('floors fractional seconds', () => {
    expect(formatTimerLabel(61.9)).toBe('01:01');
  });

  it('clamps negative values to 00:00', () => {
    expect(formatTimerLabel(-5)).toBe('00:00');
  });
});

// ---------------------------------------------------------------------------
// inferPoseExerciseFromItem
// ---------------------------------------------------------------------------
describe('inferPoseExerciseFromItem', () => {
  it('infers pushup from label', () => {
    expect(inferPoseExerciseFromItem({ label: 'Push ups' })).toBe('pushup');
  });

  it('infers squat from label', () => {
    expect(inferPoseExerciseFromItem({ label: 'Squat challenge' })).toBe('squat');
  });

  it('infers plank from label', () => {
    expect(inferPoseExerciseFromItem({ label: 'Plank hold' })).toBe('plank');
  });

  it('infers running from label', () => {
    expect(inferPoseExerciseFromItem({ label: 'Running warmup' })).toBe('running');
  });

  it('infers lunge for pistol/single-leg label', () => {
    expect(inferPoseExerciseFromItem({ label: 'Pistol squat' })).toBe('lunge');
    expect(inferPoseExerciseFromItem({ label: 'Single-leg squat' })).toBe('lunge');
  });

  it('returns empty string for unknown labels', () => {
    expect(inferPoseExerciseFromItem({ label: 'unknown exercise xyz' })).toBe('');
  });

  it('handles missing item gracefully', () => {
    expect(inferPoseExerciseFromItem()).toBe('');
    expect(inferPoseExerciseFromItem(null as any)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// inferPlanTarget
// ---------------------------------------------------------------------------
describe('inferPlanTarget', () => {
  it('returns 10 reps for squat by default', () => {
    const result = inferPlanTarget({ poseExercise: 'squat' });
    expect(result.targetValue).toBe(10);
    expect(result.targetUnit).toBe('reps');
  });

  it('returns 30 sec for plank', () => {
    const result = inferPlanTarget({ poseExercise: 'plank' });
    expect(result.targetValue).toBe(30);
    expect(result.targetUnit).toBe('sec');
  });

  it('returns 60 sec for warmup / running', () => {
    expect(inferPlanTarget({ poseExercise: 'warmup' }).targetValue).toBe(60);
    expect(inferPlanTarget({ poseExercise: 'running' }).targetValue).toBe(60);
  });

  it('returns 8 reps when poseExercise contains pistol', () => {
    // label 'Pistol squat' maps to 'lunge' via inferPoseExerciseFromItem;
    // must pass poseExercise directly to hit the pistol/single branch.
    const result = inferPlanTarget({ poseExercise: 'pistol' });
    expect(result.targetValue).toBe(8);
    expect(result.targetUnit).toBe('reps');
  });
});

// ---------------------------------------------------------------------------
// normalizePlanExercise
// ---------------------------------------------------------------------------
describe('normalizePlanExercise', () => {
  it('preserves explicit targetValue and targetUnit', () => {
    const result = normalizePlanExercise({ label: 'Squats', targetValue: 15, targetUnit: 'reps' }, 0);
    expect(result.targetValue).toBe(15);
    expect(result.targetUnit).toBe('reps');
  });

  it('falls back to inferred target when targetValue is missing', () => {
    const result = normalizePlanExercise({ label: 'Plank hold', poseExercise: 'plank' }, 0);
    expect(result.targetValue).toBe(30);
    expect(result.targetUnit).toBe('sec');
  });

  it('generates an id from index when no id/poseExercise/animationType/label present', () => {
    // label is used as id fallback before index; pass an empty object.
    const result = normalizePlanExercise({}, 3);
    expect(result.id).toContain('plan-item-3');
  });

  it('returns a label fallback for missing label', () => {
    const result = normalizePlanExercise({}, 1);
    expect(result.label).toBe('Exercise 2');
  });
});
