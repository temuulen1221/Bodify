import { calculateDailyStepXP, sumStepXPByDateMap } from '../../utils/stepXP';
import { calculateWorkoutSessionXP, normalizeWorkoutExerciseDetails } from '../../utils/workoutSessionXP';

// ---------------------------------------------------------------------------
// calculateDailyStepXP
// ---------------------------------------------------------------------------
describe('calculateDailyStepXP', () => {
  it('returns 0 for 0 steps', () => {
    expect(calculateDailyStepXP(0)).toBe(0);
  });

  it('returns 0 for fewer than 1000 steps', () => {
    expect(calculateDailyStepXP(999)).toBe(0);
  });

  it('awards 5 XP per 1000 steps', () => {
    expect(calculateDailyStepXP(1000)).toBe(5);
    expect(calculateDailyStepXP(2000)).toBe(10);
    expect(calculateDailyStepXP(5000)).toBe(25);
  });

  it('caps at 75 XP regardless of steps', () => {
    expect(calculateDailyStepXP(15000)).toBe(75);
    expect(calculateDailyStepXP(50000)).toBe(75);
  });

  it('handles fractional / string-like inputs gracefully', () => {
    expect(calculateDailyStepXP(1500.9)).toBe(5); // floor to 1500 → 1 bucket
    expect(calculateDailyStepXP(-100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sumStepXPByDateMap
// ---------------------------------------------------------------------------
describe('sumStepXPByDateMap', () => {
  it('returns 0 for an empty map', () => {
    expect(sumStepXPByDateMap({})).toBe(0);
  });

  it('sums XP across multiple dates', () => {
    const map = {
      '2026-01-01': 5000, // 25 XP
      '2026-01-02': 1000, // 5 XP
      '2026-01-03': 0,    // 0 XP
    };
    expect(sumStepXPByDateMap(map)).toBe(30);
  });

  it('returns 0 for null/undefined input', () => {
    expect(sumStepXPByDateMap(null as any)).toBe(0);
    expect(sumStepXPByDateMap(undefined as any)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateWorkoutSessionXP
// ---------------------------------------------------------------------------
describe('calculateWorkoutSessionXP', () => {
  it('returns 0 for an empty session', () => {
    expect(calculateWorkoutSessionXP({})).toBe(0);
  });

  it('awards base XP for a session with only duration', () => {
    const xp = calculateWorkoutSessionXP({ durationMin: 30 });
    expect(xp).toBeGreaterThanOrEqual(5);
  });

  it('awards more XP for a session with reps', () => {
    const withReps = calculateWorkoutSessionXP({ durationMin: 20, reps: 30 });
    const withoutReps = calculateWorkoutSessionXP({ durationMin: 20 });
    expect(withReps).toBeGreaterThan(withoutReps);
  });

  it('gives a bonus for high-effort exercises (burpee)', () => {
    const burpeeXP = calculateWorkoutSessionXP({ type: 'burpee', durationMin: 15, reps: 20 });
    const genericXP = calculateWorkoutSessionXP({ type: 'general', durationMin: 15, reps: 20 });
    expect(burpeeXP).toBeGreaterThanOrEqual(genericXP);
  });

  it('caps at 95 XP', () => {
    const xp = calculateWorkoutSessionXP({
      durationMin: 180,
      calories: 2500,
      reps: 200,
      type: 'burpee',
    });
    expect(xp).toBeLessThanOrEqual(95);
  });

  it('awards at least 5 XP when there is workout evidence', () => {
    expect(calculateWorkoutSessionXP({ reps: 1 })).toBeGreaterThanOrEqual(5);
    expect(calculateWorkoutSessionXP({ seconds: 10 })).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// normalizeWorkoutExerciseDetails
// ---------------------------------------------------------------------------
describe('normalizeWorkoutExerciseDetails', () => {
  it('returns empty array for session with no details', () => {
    expect(normalizeWorkoutExerciseDetails({})).toEqual([]);
  });

  it('normalizes detail reps to integers', () => {
    const result = normalizeWorkoutExerciseDetails({
      exerciseDetails: [{ label: 'Squats', type: 'squat', reps: 15.7 }],
    });
    expect(result[0].reps).toBe(15);
  });

  it('falls back to notes parsing when exerciseDetails is absent', () => {
    const result = normalizeWorkoutExerciseDetails({
      reps: 20,
      seconds: 60,
      title: 'Plank hold',
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('skips empty detail entries', () => {
    const result = normalizeWorkoutExerciseDetails({
      exerciseDetails: [
        { label: '', type: '', reps: 0, seconds: 0 },
        { label: 'Pushups', type: 'pushup', reps: 10 },
      ],
    });
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('Pushups');
  });
});
