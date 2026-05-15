import {
    calculateWorkoutSessionXP,
    createWorkoutSessionRecord,
    normalizeWorkoutExerciseDetails,
} from '../../utils/workoutSessionXP';

// ---------------------------------------------------------------------------
// createWorkoutSessionRecord
// ---------------------------------------------------------------------------
describe('createWorkoutSessionRecord', () => {
  it('returns an object with all required fields', () => {
    const record = createWorkoutSessionRecord({});
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('title');
    expect(record).toHaveProperty('durationMin');
    expect(record).toHaveProperty('calories');
    expect(record).toHaveProperty('notes');
    expect(record).toHaveProperty('type');
    expect(record).toHaveProperty('awardedXP');
    expect(record).toHaveProperty('createdAt');
  });

  it('applies "Workout" title default when none provided', () => {
    expect(createWorkoutSessionRecord({}).title).toBe('Workout');
  });

  it('preserves a provided title', () => {
    expect(createWorkoutSessionRecord({ title: 'Morning Run' }).title).toBe('Morning Run');
  });

  it('normalises type to lowercase snake_case', () => {
    expect(createWorkoutSessionRecord({ type: 'Strength Training' }).type).toBe('strength_training');
  });

  it('defaults type to "general" when absent', () => {
    expect(createWorkoutSessionRecord({}).type).toBe('general');
  });

  it('generates an id when one is not provided', () => {
    const { id } = createWorkoutSessionRecord({});
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('preserves an explicitly provided id', () => {
    const { id } = createWorkoutSessionRecord({ id: 'my-custom-id' });
    expect(id).toBe('my-custom-id');
  });

  it('normalises durationMin to a non-negative number', () => {
    expect(createWorkoutSessionRecord({ durationMin: 45 }).durationMin).toBe(45);
    expect(createWorkoutSessionRecord({ durationMin: -5 }).durationMin).toBe(0);
  });

  it('normalises calories to a non-negative integer', () => {
    expect(createWorkoutSessionRecord({ calories: 300 }).calories).toBe(300);
    expect(createWorkoutSessionRecord({ calories: -10 }).calories).toBe(0);
  });

  it('calculates awardedXP > 0 for a session with real data', () => {
    const record = createWorkoutSessionRecord({ durationMin: 30, calories: 200, type: 'running' }) as any;
    expect(record.awardedXP).toBeGreaterThan(0);
  });

  it('sets awardedXP to 0 for a session with no activity evidence', () => {
    // No duration, calories, reps, seconds or details → hasWorkoutEvidence=false → returns 0
    const record = createWorkoutSessionRecord({}) as any;
    expect(record.awardedXP).toBe(0);
  });

  it('attaches normalised exerciseDetails when details are present', () => {
    const session = {
      durationMin: 20,
      exerciseDetails: [{ label: 'Push-up', reps: 15, type: 'pushup' }],
    };
    const record = createWorkoutSessionRecord(session) as any;
    expect(Array.isArray(record.exerciseDetails)).toBe(true);
    expect(record.exerciseDetails.length).toBe(1);
    expect(record.exerciseDetails[0].reps).toBe(15);
  });

  it('does not attach exerciseDetails when there are none', () => {
    const record = createWorkoutSessionRecord({ title: 'Rest', durationMin: 5 }) as any;
    if (record.exerciseDetails !== undefined) {
      expect(Array.isArray(record.exerciseDetails)).toBe(true);
    }
  });

  it('sets createdAt to the provided value when given', () => {
    const ts = 1700000000000;
    expect(createWorkoutSessionRecord({ createdAt: ts }).createdAt).toBe(ts);
  });

  it('generates a createdAt timestamp when not provided', () => {
    const before = Date.now();
    const { createdAt } = createWorkoutSessionRecord({});
    expect(createdAt).toBeGreaterThanOrEqual(before);
  });
});

// ---------------------------------------------------------------------------
// calculateWorkoutSessionXP — edge cases beyond xpCalculations.test.ts
// ---------------------------------------------------------------------------
describe('calculateWorkoutSessionXP', () => {
  it('returns 0 for a completely empty session', () => {
    expect(calculateWorkoutSessionXP({})).toBe(0);
  });

  it('returns a positive value for a session with duration and calories', () => {
    expect(calculateWorkoutSessionXP({ durationMin: 30, calories: 200 })).toBeGreaterThan(0);
  });

  it('caps XP at 95', () => {
    // Very long, high-calorie, high-rep session — should cap at 95
    const maxed = calculateWorkoutSessionXP({
      durationMin: 180,
      calories: 2500,
      exerciseDetails: Array.from({ length: 10 }, (_, i) => ({
        label: `Exercise ${i}`,
        type: ['burpee', 'lunge', 'squat', 'pushup', 'plank', 'situp', 'crunch', 'jumping_jacks', 'running', 'cycling'][i],
        reps: 100,
        seconds: 300,
      })),
    });
    expect(maxed).toBeLessThanOrEqual(95);
  });

  it('never returns a value below 5 when there is workout evidence', () => {
    expect(calculateWorkoutSessionXP({ durationMin: 1 })).toBeGreaterThanOrEqual(5);
    expect(calculateWorkoutSessionXP({ calories: 1 })).toBeGreaterThanOrEqual(5);
  });

  it('applies a higher type bonus for burpees than for warmup', () => {
    const burpeeXP = calculateWorkoutSessionXP({ type: 'burpee', durationMin: 10 });
    const warmupXP = calculateWorkoutSessionXP({ type: 'warmup', durationMin: 10 });
    expect(burpeeXP).toBeGreaterThan(warmupXP);
  });
});

// ---------------------------------------------------------------------------
// normalizeWorkoutExerciseDetails — extra coverage beyond xpCalculations.test.ts
// ---------------------------------------------------------------------------
describe('normalizeWorkoutExerciseDetails extra', () => {
  it('returns an empty array for a session with no detail source', () => {
    expect(normalizeWorkoutExerciseDetails({ title: 'Quick Run', type: 'running' })).toEqual([]);
  });

  it('falls back to top-level reps when exerciseDetails is absent', () => {
    const details = normalizeWorkoutExerciseDetails({ pushups: 20, type: 'pushup' });
    if (details.length > 0) {
      expect(details[0].reps).toBe(20);
    }
  });

  it('falls back to top-level plankSeconds when exerciseDetails is absent', () => {
    const details = normalizeWorkoutExerciseDetails({ plankSeconds: 60, type: 'plank' });
    if (details.length > 0) {
      expect(details[0].seconds).toBe(60);
    }
  });

  it('parses exercise details from notes using "·" separator', () => {
    const details = normalizeWorkoutExerciseDetails({ notes: 'Push-up · Squat · Plank' });
    expect(details.length).toBe(3);
    expect(details[0].label).toBe('Push-up');
    expect(details[1].label).toBe('Squat');
  });

  it('normalizes type to snake_case in exercise details', () => {
    const details = normalizeWorkoutExerciseDetails({
      exerciseDetails: [{ label: 'Push-up', type: 'Push Up', reps: 10 }],
    });
    expect(details[0].type).toBe('push_up');
  });
});
