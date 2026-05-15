import {
    buildAiWorkoutPlanFromGuide,
    buildWorkoutDemoSequence,
    inferPendingWorkoutGuideFromExchange,
    inferWorkoutAnimationFromText,
    inferWorkoutAnimationsFromText,
    inferWorkoutDemoFromExchange,
    isWorkoutDemoConfirmation,
    isWorkoutStartConfirmation,
} from '../../utils/avatarWorkoutHelpers';

// ---------------------------------------------------------------------------
// inferWorkoutAnimationFromText
// ---------------------------------------------------------------------------
describe('inferWorkoutAnimationFromText', () => {
  it('returns null for empty string', () => {
    expect(inferWorkoutAnimationFromText('')).toBeNull();
  });

  it('returns null for unrecognised text', () => {
    expect(inferWorkoutAnimationFromText('random stuff here')).toBeNull();
  });

  it('recognises "push-ups"', () => {
    expect(inferWorkoutAnimationFromText('do some push-ups')).toBe('pushup');
  });

  it('recognises "pushup" (no hyphen)', () => {
    expect(inferWorkoutAnimationFromText('pushup form')).toBe('pushup');
  });

  it('recognises "squats"', () => {
    expect(inferWorkoutAnimationFromText('air squats')).toBe('squat');
  });

  it('recognises "plank"', () => {
    expect(inferWorkoutAnimationFromText('hold a plank')).toBe('plank');
  });

  it('recognises "sit-ups"', () => {
    expect(inferWorkoutAnimationFromText('20 sit-ups')).toBe('situp');
  });

  it('recognises "burpees"', () => {
    expect(inferWorkoutAnimationFromText('10 burpees')).toBe('burpee');
  });

  it('recognises "jumping jacks"', () => {
    expect(inferWorkoutAnimationFromText('jumping jacks')).toBe('jumping_jacks');
  });

  it('recognises "running"', () => {
    expect(inferWorkoutAnimationFromText('go for a run')).toBe('running');
  });

  it('recognises "warm-up"', () => {
    expect(inferWorkoutAnimationFromText('start with a warm-up')).toBe('warmup');
  });

  it('recognises "meditation" / cooldown', () => {
    expect(inferWorkoutAnimationFromText('cooldown session')).toBe('meditation');
  });

  it('is case-insensitive', () => {
    expect(inferWorkoutAnimationFromText('PUSH-UPS')).toBe('pushup');
  });

  it('returns the first matching animation type', () => {
    // "push-ups and squats" — pushup pattern comes first in EXERCISE_PATTERNS
    const result = inferWorkoutAnimationFromText('push-ups and squats');
    expect(result).toBe('pushup');
  });
});

// ---------------------------------------------------------------------------
// inferWorkoutAnimationsFromText
// ---------------------------------------------------------------------------
describe('inferWorkoutAnimationsFromText', () => {
  it('returns empty array for empty string', () => {
    expect(inferWorkoutAnimationsFromText('')).toEqual([]);
  });

  it('returns empty array for unrecognised text', () => {
    expect(inferWorkoutAnimationsFromText('hello world')).toEqual([]);
  });

  it('returns a single match for text with one exercise', () => {
    const result = inferWorkoutAnimationsFromText('squats');
    expect(result).toContain('squat');
    expect(result).toHaveLength(1);
  });

  it('returns multiple matches when text contains several exercises', () => {
    const result = inferWorkoutAnimationsFromText('push-ups and squats and burpees');
    expect(result).toContain('pushup');
    expect(result).toContain('squat');
    expect(result).toContain('burpee');
  });

  it('does not duplicate animation types', () => {
    // "run" and "running" both map to the same animationType
    const result = inferWorkoutAnimationsFromText('run running jog jogging');
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// isWorkoutDemoConfirmation
// ---------------------------------------------------------------------------
describe('isWorkoutDemoConfirmation', () => {
  it.each(['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'show me', 'please do', 'go ahead', 'do it'])(
    'returns true for "%s"',
    (text) => expect(isWorkoutDemoConfirmation(text)).toBe(true),
  );

  it('returns true for "let\'s do it"', () => {
    expect(isWorkoutDemoConfirmation("let's do it")).toBe(true);
  });

  it('returns true for "yes please"', () => {
    expect(isWorkoutDemoConfirmation('yes please')).toBe(true);
  });

  it('returns false for "no thank you"', () => {
    expect(isWorkoutDemoConfirmation('no thank you')).toBe(false);
  });

  it('returns false for "not right now"', () => {
    expect(isWorkoutDemoConfirmation('not right now')).toBe(false);
  });

  it('handles null/undefined without throwing', () => {
    expect(() => isWorkoutDemoConfirmation(null as unknown as string)).not.toThrow();
    expect(isWorkoutDemoConfirmation(null as unknown as string)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isWorkoutStartConfirmation
// ---------------------------------------------------------------------------
describe('isWorkoutStartConfirmation', () => {
  it.each(["let's go", 'start workout', 'start it', "i'm in", 'yes', 'sure'])(
    'returns true for "%s"',
    (text) => expect(isWorkoutStartConfirmation(text)).toBe(true),
  );

  it('returns true for "let\'s do it"', () => {
    expect(isWorkoutStartConfirmation("let's do it")).toBe(true);
  });

  it('returns false for "not yet"', () => {
    expect(isWorkoutStartConfirmation('not yet')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isWorkoutStartConfirmation('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildWorkoutDemoSequence
// ---------------------------------------------------------------------------
describe('buildWorkoutDemoSequence', () => {
  it('returns null for an unknown animation type', () => {
    expect(buildWorkoutDemoSequence('unknown_animation')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(buildWorkoutDemoSequence('')).toBeNull();
  });

  it('returns a sequence object for "pushup"', () => {
    const result = buildWorkoutDemoSequence('pushup');
    expect(result).not.toBeNull();
    expect(result!.sequence.length).toBeGreaterThan(0);
    expect(result!.animationType).toBe('pushup');
  });

  it('returns a sequence object for "squat"', () => {
    const result = buildWorkoutDemoSequence('squat');
    expect(result).not.toBeNull();
    expect(result!.sequence.length).toBeGreaterThan(0);
  });

  it('returns a sequence object for "plank"', () => {
    const result = buildWorkoutDemoSequence('plank');
    expect(result).not.toBeNull();
    expect(result!.sequence.length).toBeGreaterThan(0);
  });

  it('each step in the sequence has animationType and duration', () => {
    const result = buildWorkoutDemoSequence('pushup', { reps: 2 });
    expect(result).not.toBeNull();
    for (const step of result!.sequence) {
      expect(typeof step.animationType).toBe('string');
      expect(typeof step.duration).toBe('number');
    }
  });

  it('respects reps option — more reps means more steps', () => {
    const short = buildWorkoutDemoSequence('squat', { reps: 1 });
    const long = buildWorkoutDemoSequence('squat', { reps: 3 });
    expect(long!.sequence.length).toBeGreaterThanOrEqual(short!.sequence.length);
  });
});

// ---------------------------------------------------------------------------
// buildAiWorkoutPlanFromGuide
// ---------------------------------------------------------------------------
describe('buildAiWorkoutPlanFromGuide', () => {
  it('returns null for null guide', () => {
    expect(buildAiWorkoutPlanFromGuide(null)).toBeNull();
  });

  it('returns null for a guide with empty sequence', () => {
    expect(buildAiWorkoutPlanFromGuide({ sequence: [] })).toBeNull();
  });

  it('returns null when guide has no sequence property', () => {
    expect(buildAiWorkoutPlanFromGuide({} as any)).toBeNull();
  });

  it('transforms a complete guide into a plan', () => {
    const guide = {
      title: 'Test Workout',
      durationMin: 20,
      summary: 'A quick test',
      items: [{ animationType: 'squat', label: 'Squat' }],
      sequence: [{ animationType: 'squat', duration: 1700 }],
    };
    const plan = buildAiWorkoutPlanFromGuide(guide);
    expect(plan).not.toBeNull();
    expect(plan!.title).toBe('Test Workout');
    expect(plan!.durationMin).toBe(20);
    expect(plan!.summary).toBe('A quick test');
    expect(plan!.exercises).toHaveLength(1);
    expect(plan!.sequence).toHaveLength(1);
  });

  it('uses defaults when optional fields are absent', () => {
    const guide = { sequence: [{ animationType: 'plank', duration: 2000 }] };
    const plan = buildAiWorkoutPlanFromGuide(guide);
    expect(plan).not.toBeNull();
    expect(plan!.title).toBe('AI Workout Plan');
    expect(plan!.durationMin).toBe(5);
    expect(plan!.exercises).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// inferWorkoutDemoFromExchange
// ---------------------------------------------------------------------------
describe('inferWorkoutDemoFromExchange', () => {
  it('returns null when user text has no exercise and no explicit request', () => {
    expect(inferWorkoutDemoFromExchange('hello', '')).toBeNull();
  });

  it('returns a demo when force option is set and an exercise is mentioned', () => {
    const result = inferWorkoutDemoFromExchange('push-ups', '', { force: true });
    expect(result).not.toBeNull();
    expect(result!.animationType).toBe('pushup');
  });

  it('returns a demo when user explicitly requests and exercise is present', () => {
    const result = inferWorkoutDemoFromExchange('show me push-ups', '');
    expect(result).not.toBeNull();
  });

  it('returns null when demo is requested but no exercise is detected', () => {
    const result = inferWorkoutDemoFromExchange('show me something', '');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// inferPendingWorkoutGuideFromExchange
// ---------------------------------------------------------------------------
describe('inferPendingWorkoutGuideFromExchange', () => {
  it('returns null when no exercises are found', () => {
    const result = inferPendingWorkoutGuideFromExchange('hello', 'world');
    expect(result).toBeNull();
  });

  it('returns null without force/offer/plan context even if exercises detected', () => {
    // Has an exercise but no workout plan context, no offer, no force
    const result = inferPendingWorkoutGuideFromExchange('push-ups', 'some random response');
    expect(result).toBeNull();
  });

  it('returns a guide with force option and known exercises', () => {
    const result = inferPendingWorkoutGuideFromExchange('squats', '', { force: true });
    expect(result).not.toBeNull();
    expect(result!.sequence.length).toBeGreaterThan(0);
    expect(result!.items.length).toBeGreaterThan(0);
    expect(typeof result!.durationMin).toBe('number');
  });

  it('returns a guide when ai text contains workout plan context', () => {
    const result = inferPendingWorkoutGuideFromExchange(
      'I want to do push-ups',
      'Here is a full body workout routine for you',
    );
    expect(result).not.toBeNull();
    expect(result!.sequence.length).toBeGreaterThan(0);
  });

  it('infers duration from text containing "X min"', () => {
    const result = inferPendingWorkoutGuideFromExchange(
      'squats',
      'Here is a 15 min workout plan for you',
      { force: true },
    );
    expect(result).not.toBeNull();
    expect(result!.durationMin).toBe(15);
  });

  it('includes title in the returned guide', () => {
    const result = inferPendingWorkoutGuideFromExchange('planks', '', { force: true });
    expect(result).not.toBeNull();
    expect(typeof result!.title).toBe('string');
    expect(result!.title.length).toBeGreaterThan(0);
  });
});
