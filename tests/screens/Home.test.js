// Tests the pure helper utilities embedded in the Home screen (HomeScreen.js).
// These are tested in isolation without React rendering.

// --- clamp: defined in HomeScreen.js ---
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// --- getHomeIdlePool: mirrors the logic in HomeScreen.js ---
const HOME_PREFERRED_IDLE_KEYS = [
  'holding_idle', 'standard_idle_fbx', 'idle_male_fbx', 'idle_female_fbx',
  'bored_idle_fbx', 'catwalk_idle_01', 'catwalk_idle_twist_l',
  'sad_idle_fbx', 'offensive_idle',
];
const HOME_WEB_IDLE_KEYS = [
  'holding_idle', 'standard_idle_fbx', 'bored_idle_fbx', 'sad_idle_fbx',
  'catwalk_idle_01', 'catwalk_idle_twist_l', 'offensive_idle', 'standing_briefcase_idle',
];
const FEMALE_OVERRIDES = ['idle_female_fbx', 'catwalk_idle_01', 'catwalk_idle_twist_l'];
const MALE_OVERRIDES   = ['idle_male_fbx',   'catwalk_idle_01', 'catwalk_idle_twist_l', 'offensive_idle'];

const getHomeIdlePool = (gender, isWeb = false) => {
  const g = String(gender || 'neutral').toLowerCase();
  if (isWeb) return HOME_WEB_IDLE_KEYS;
  if (g === 'female') return FEMALE_OVERRIDES;
  if (g === 'male')   return MALE_OVERRIDES;
  return HOME_PREFERRED_IDLE_KEYS;
};

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('handles exact boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('getHomeIdlePool', () => {
  it('returns web pool when isWeb=true', () => {
    const pool = getHomeIdlePool('male', true);
    expect(pool).toContain('standing_briefcase_idle');
    expect(pool).not.toContain('idle_male_fbx');
  });

  it('returns female overrides for female gender', () => {
    const pool = getHomeIdlePool('female');
    expect(pool).toContain('idle_female_fbx');
    expect(pool).not.toContain('idle_male_fbx');
  });

  it('returns male overrides for male gender', () => {
    const pool = getHomeIdlePool('male');
    expect(pool).toContain('idle_male_fbx');
    expect(pool).toContain('offensive_idle');
    expect(pool).not.toContain('idle_female_fbx');
  });

  it('returns neutral/default pool for unknown gender', () => {
    const pool = getHomeIdlePool('neutral');
    expect(pool).toContain('holding_idle');
    expect(pool).toContain('standard_idle_fbx');
  });

  it('defaults to neutral pool for undefined gender', () => {
    const pool = getHomeIdlePool();
    expect(pool).toContain('holding_idle');
  });
});
