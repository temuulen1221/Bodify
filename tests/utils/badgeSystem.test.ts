import {
    BADGE_XP_LEVEL_STEP_BY_CATEGORY,
    buildBadgeData,
    deriveBadgeLevelFromCategoryXp,
    getRankForLevel,
    getTodayDateKey,
} from '../../utils/badgeSystem';

// ---------------------------------------------------------------------------
// BADGE_XP_LEVEL_STEP_BY_CATEGORY constant
// ---------------------------------------------------------------------------
describe('BADGE_XP_LEVEL_STEP_BY_CATEGORY', () => {
  it('contains all expected category keys', () => {
    const expected = ['runner', 'strongman', 'workout', 'cardio', 'walker', 'diet', 'mass', 'shred'];
    expected.forEach((key) => expect(BADGE_XP_LEVEL_STEP_BY_CATEGORY).toHaveProperty(key));
  });

  it('has positive step values for every category', () => {
    Object.values(BADGE_XP_LEVEL_STEP_BY_CATEGORY).forEach((step) => {
      expect(step).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getTodayDateKey
// ---------------------------------------------------------------------------
describe('getTodayDateKey', () => {
  it('formats a given Date as YYYY-MM-DD', () => {
    expect(getTodayDateKey(new Date('2024-03-05T12:00:00'))).toBe('2024-03-05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(getTodayDateKey(new Date('2024-01-07T00:00:00'))).toBe('2024-01-07');
  });

  it('returns a string matching YYYY-MM-DD when called with no argument', () => {
    expect(getTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accepts a Date-like string argument', () => {
    // Coerced via new Date(baseDate)
    expect(getTodayDateKey(new Date('2025-12-31'))).toBe('2025-12-31');
  });
});

// ---------------------------------------------------------------------------
// deriveBadgeLevelFromCategoryXp
// ---------------------------------------------------------------------------
describe('deriveBadgeLevelFromCategoryXp', () => {
  // runner step = 100
  it('returns 0 for 0 XP', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', 0)).toBe(0);
  });

  it('returns 1 for XP between 1 and 100 (runner)', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', 1)).toBe(1);
    expect(deriveBadgeLevelFromCategoryXp('runner', 50)).toBe(1);
    expect(deriveBadgeLevelFromCategoryXp('runner', 100)).toBe(1);
  });

  it('returns 2 for XP of 101 (runner step=100)', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', 101)).toBe(2);
  });

  it('returns 2 for XP of 200 (runner)', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', 200)).toBe(2);
  });

  it('returns 5 for XP of 401 (runner)', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', 401)).toBe(5);
  });

  // workout step = 120
  it('returns 1 for XP of 1-120 (workout step=120)', () => {
    expect(deriveBadgeLevelFromCategoryXp('workout', 120)).toBe(1);
  });

  it('returns 2 for XP of 121 (workout step=120)', () => {
    expect(deriveBadgeLevelFromCategoryXp('workout', 121)).toBe(2);
  });

  it('falls back to step 120 for an unknown category', () => {
    expect(deriveBadgeLevelFromCategoryXp('unknown', 120)).toBe(1);
    expect(deriveBadgeLevelFromCategoryXp('unknown', 121)).toBe(2);
  });

  it('handles negative XP gracefully (returns 0)', () => {
    expect(deriveBadgeLevelFromCategoryXp('runner', -50)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getRankForLevel
// ---------------------------------------------------------------------------
describe('getRankForLevel', () => {
  it('returns "D" for level 1', () => expect(getRankForLevel(1)).toBe('D'));
  it('returns "D" for level 4', () => expect(getRankForLevel(4)).toBe('D'));
  it('returns "C" for level 5', () => expect(getRankForLevel(5)).toBe('C'));
  it('returns "C" for level 9', () => expect(getRankForLevel(9)).toBe('C'));
  it('returns "B" for level 10', () => expect(getRankForLevel(10)).toBe('B'));
  it('returns "B" for level 14', () => expect(getRankForLevel(14)).toBe('B'));
  it('returns "A" for level 15', () => expect(getRankForLevel(15)).toBe('A'));
  it('returns "A" for level 19', () => expect(getRankForLevel(19)).toBe('A'));
  it('returns "S" for level 20', () => expect(getRankForLevel(20)).toBe('S'));
  it('returns "S" for level 50', () => expect(getRankForLevel(50)).toBe('S'));
  it('handles falsy input as level 1 → "D"', () => expect(getRankForLevel(0)).toBe('D'));
});

// ---------------------------------------------------------------------------
// buildBadgeData
// ---------------------------------------------------------------------------
describe('buildBadgeData', () => {
  const configs = (result: any) => result.badgeConfigs as any[];

  it('returns an object with badgeConfigs array', () => {
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate: {} });
    expect(Array.isArray(configs(result))).toBe(true);
    expect(configs(result).length).toBeGreaterThan(0);
  });

  it('every badge has key, level, rank, progress, and detailProps', () => {
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate: {} });
    configs(result).forEach((badge) => {
      expect(typeof badge.key).toBe('string');
      expect(typeof badge.level).toBe('number');
      expect(typeof badge.rank).toBe('string');
      expect(typeof badge.progress).toBe('number');
      expect(badge.detailProps).toBeDefined();
    });
  });

  it('returns level 0 for all badges when data is empty', () => {
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate: {} });
    configs(result).forEach((badge) => expect(badge.level).toBe(0));
  });

  it('returns rank "D" for all badges when data is empty', () => {
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate: {} });
    configs(result).forEach((badge) => expect(badge.rank).toBe('D'));
  });

  it('runner badge level rises with accumulated storedBadgeXP', () => {
    const user = { badgeXPByCategory: { runner: 250 } };
    const result = buildBadgeData({ user, stepsByDate: {}, sessionsByDate: {} });
    const runner = configs(result).find((b) => b.key === 'runner');
    expect(runner.level).toBeGreaterThan(0);
  });

  it('walker badge level rises with step XP in storedBadgeXP', () => {
    const user = { badgeXPByCategory: { walker: 200 } };
    const result = buildBadgeData({ user, stepsByDate: {}, sessionsByDate: {} });
    const walker = configs(result).find((b) => b.key === 'walker');
    expect(walker.level).toBeGreaterThan(0);
  });

  it('strongman badge level rises with strength session data', () => {
    const session = { title: 'Push-up session', type: 'strength', awardedXP: 150, durationMin: 30, calories: 200 };
    const sessionsByDate = { '2024-01-01': [session] };
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate });
    const strongman = configs(result).find((b) => b.key === 'strongman');
    expect(strongman.level).toBeGreaterThan(0);
  });

  it('includes all 8 badge keys', () => {
    const result = buildBadgeData({ user: {}, stepsByDate: {}, sessionsByDate: {} });
    const keys = configs(result).map((b) => b.key);
    ['runner', 'strongman', 'workout', 'cardio', 'walker', 'diet', 'mass', 'shred'].forEach(
      (key) => expect(keys).toContain(key),
    );
  });
});
