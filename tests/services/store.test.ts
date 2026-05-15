// Mock storage to prevent Firebase/AsyncStorage calls during tests.
// jest.mock is hoisted before imports by Jest's transform.
jest.mock('../../services/storage', () => ({
  saveUserState: jest.fn(),
  saveAwardsState: jest.fn(),
  saveRemoteUserState: jest.fn(),
  saveStepsState: jest.fn(),
}));

import store, {
    addBadgeXP,
    addXP,
    categorizeWorkoutSessionForBadgeXp,
    hydrateUser,
    markDayComplete,
    registerWorkoutDay,
} from '../../store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the user slice to a clean, known baseline. */
const resetUser = () =>
  store.dispatch(
    hydrateUser({
      level: 1,
      points: 0,
      pointsMax: 100,
      totalXP: 0,
      energy: 0,
      streakCount: 0,
      bestStreak: 0,
      lastWorkoutDate: null,
      streakShields: 0,
      badgeXPByCategory: {},
      recentRewards: [],
    })
  );

const user = () => store.getState().user;
const quests = () => store.getState().quests;

// ---------------------------------------------------------------------------
// categorizeWorkoutSessionForBadgeXp — pure function, no store required
// ---------------------------------------------------------------------------
describe('categorizeWorkoutSessionForBadgeXp', () => {
  it('always includes "workout" for any session', () => {
    expect(categorizeWorkoutSessionForBadgeXp({})).toContain('workout');
  });

  it('tags running sessions as "runner" and "cardio"', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ type: 'running', title: 'Morning run' });
    expect(cats).toContain('runner');
    expect(cats).toContain('cardio');
  });

  it('tags jogging as "runner" and "cardio"', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ title: 'Jogging session' });
    expect(cats).toContain('runner');
    expect(cats).toContain('cardio');
  });

  it('tags strength sessions as "strongman" and "mass"', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ type: 'strength', title: 'Push-up session' });
    expect(cats).toContain('strongman');
    expect(cats).toContain('mass');
  });

  it('tags squat/bench/deadlift titles as strength', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ title: 'Deadlift and squats' });
    expect(cats).toContain('strongman');
  });

  it('tags walking sessions as "walker"', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ title: 'Evening walk' });
    expect(cats).toContain('walker');
  });

  it('tags hiking sessions as "walker"', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ title: 'Mountain hike' });
    expect(cats).toContain('walker');
  });

  it('adds "shred" when calories >= 120', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ calories: 150 });
    expect(cats).toContain('shred');
  });

  it('adds "diet" when duration > 0', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ durationMin: 30 });
    expect(cats).toContain('diet');
  });

  it('returns no duplicate categories', () => {
    const cats = categorizeWorkoutSessionForBadgeXp({ type: 'running', title: 'run' });
    expect(cats.length).toBe(new Set(cats).size);
  });
});

// ---------------------------------------------------------------------------
// addXP reducer
// ---------------------------------------------------------------------------
describe('addXP', () => {
  beforeEach(resetUser);

  it('increases points by the given numeric amount', () => {
    store.dispatch(addXP(50));
    expect(user().points).toBe(50);
  });

  it('accepts an object payload with amount', () => {
    store.dispatch(addXP({ amount: 30, source: 'workout', title: 'Test' }));
    expect(user().points).toBe(30);
  });

  it('accumulates totalXP across dispatches', () => {
    store.dispatch(addXP(25));
    store.dispatch(addXP(25));
    expect(user().totalXP).toBeGreaterThanOrEqual(50);
  });

  it('ignores zero XP', () => {
    store.dispatch(addXP(0));
    expect(user().points).toBe(0);
  });

  it('ignores negative XP', () => {
    store.dispatch(addXP(-10));
    expect(user().points).toBe(0);
  });

  it('levels up when points reach pointsMax and resets points', () => {
    store.dispatch(addXP(100)); // exactly meets the 100-point cap
    expect(user().level).toBeGreaterThan(1);
    expect(user().points).toBe(0);
  });

  it('awards energy on level-up', () => {
    store.dispatch(addXP(100));
    expect(user().energy).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// addBadgeXP reducer
// ---------------------------------------------------------------------------
describe('addBadgeXP', () => {
  beforeEach(resetUser);

  it('adds XP to a known category', () => {
    store.dispatch(addBadgeXP({ amount: 50, category: 'runner' }));
    expect(user().badgeXPByCategory.runner).toBe(50);
  });

  it('accumulates XP across multiple dispatches', () => {
    store.dispatch(addBadgeXP({ amount: 30, category: 'workout' }));
    store.dispatch(addBadgeXP({ amount: 70, category: 'workout' }));
    expect(user().badgeXPByCategory.workout).toBe(100);
  });

  it('accepts multiple categories at once', () => {
    store.dispatch(addBadgeXP({ amount: 20, categories: ['runner', 'cardio'] }));
    expect(user().badgeXPByCategory.runner).toBe(20);
    expect(user().badgeXPByCategory.cardio).toBe(20);
  });

  it('ignores unknown categories silently', () => {
    store.dispatch(addBadgeXP({ amount: 50, category: 'not_a_real_category' }));
    // All valid keys should remain at 0
    expect(user().badgeXPByCategory.runner).toBe(0);
    expect(user().badgeXPByCategory.workout).toBe(0);
  });

  it('ignores zero amount', () => {
    store.dispatch(addBadgeXP({ amount: 0, category: 'runner' }));
    expect(user().badgeXPByCategory.runner).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// registerWorkoutDay reducer — streak logic
// ---------------------------------------------------------------------------
describe('registerWorkoutDay', () => {
  beforeEach(resetUser);

  it('sets streakCount to 1 for first workout', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    expect(user().streakCount).toBe(1);
  });

  it('records lastWorkoutDate', () => {
    store.dispatch(registerWorkoutDay('2024-03-10'));
    expect(user().lastWorkoutDate).toBe('2024-03-10');
  });

  it('increments streak for consecutive days', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    store.dispatch(registerWorkoutDay('2024-01-02'));
    expect(user().streakCount).toBe(2);
  });

  it('extends streak over three consecutive days', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    store.dispatch(registerWorkoutDay('2024-01-02'));
    store.dispatch(registerWorkoutDay('2024-01-03'));
    expect(user().streakCount).toBe(3);
  });

  it('resets streak to 1 after a gap of more than one day', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    store.dispatch(registerWorkoutDay('2024-01-05')); // 4-day gap
    expect(user().streakCount).toBe(1);
  });

  it('does not double-count the same day', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    store.dispatch(registerWorkoutDay('2024-01-01'));
    expect(user().streakCount).toBe(1);
  });

  it('updates bestStreak when streak is a new high', () => {
    store.dispatch(registerWorkoutDay('2024-01-01'));
    store.dispatch(registerWorkoutDay('2024-01-02'));
    store.dispatch(registerWorkoutDay('2024-01-03'));
    expect(user().bestStreak).toBeGreaterThanOrEqual(3);
  });

  it('ignores invalid date strings (too short)', () => {
    store.dispatch(registerWorkoutDay('bad'));
    expect(user().streakCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// markDayComplete reducer (quests slice)
// ---------------------------------------------------------------------------
describe('markDayComplete', () => {
  it('marks a valid date as complete', () => {
    store.dispatch(markDayComplete('2024-06-15'));
    expect(quests().dailyCompletion['2024-06-15']).toBe(true);
  });

  it('ignores strings shorter than 10 characters', () => {
    store.dispatch(markDayComplete('2024-6-15'));
    expect(quests().dailyCompletion['2024-6-15']).toBeUndefined();
  });

  it('ignores non-string payloads gracefully', () => {
    // @ts-expect-error — intentional wrong type test
    store.dispatch(markDayComplete(null));
    expect(quests().dailyCompletion).not.toHaveProperty('null');
  });
});
