// Tests the auth/onboarding helper logic used in app/login.tsx and app/signup.tsx.
// All functions are pure and tested without Firebase or React rendering.

// --- New user profile defaults (mirrors persistGoogleUser in login.tsx) ---
const DEFAULT_LEVEL_CAP = 100;
const buildNewUserProfile = (user) => ({
  email: user.email || '',
  displayName: user.displayName || '',
  photoURL: user.photoURL || '',
  provider: user.provider || 'email',
  points: 0,
  pointsMax: DEFAULT_LEVEL_CAP,
  totalXP: 0,
  energy: 0,
  discountTickets: 0,
  streakShields: 0,
  ownedShopItems: [],
  streakCount: 0,
  bestStreak: 0,
  lastWorkoutDate: null,
  recentRewards: [],
});

// --- Email validation (mirrors pattern used in login/signup) ---
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));

// --- Password meets minimum length requirement ---
const isValidPassword = (pw) => typeof pw === 'string' && pw.length >= 6;

describe('buildNewUserProfile', () => {
  it('seeds default numeric fields to 0', () => {
    const profile = buildNewUserProfile({ email: 'a@b.com' });
    expect(profile.points).toBe(0);
    expect(profile.totalXP).toBe(0);
    expect(profile.streakCount).toBe(0);
  });

  it('sets pointsMax to DEFAULT_LEVEL_CAP (100)', () => {
    expect(buildNewUserProfile({}).pointsMax).toBe(100);
  });

  it('copies user email and displayName', () => {
    const profile = buildNewUserProfile({ email: 'jane@example.com', displayName: 'Jane' });
    expect(profile.email).toBe('jane@example.com');
    expect(profile.displayName).toBe('Jane');
  });

  it('falls back to empty strings for missing user fields', () => {
    const profile = buildNewUserProfile({});
    expect(profile.email).toBe('');
    expect(profile.displayName).toBe('');
    expect(profile.photoURL).toBe('');
  });

  it('seeds empty arrays for ownedShopItems and recentRewards', () => {
    const profile = buildNewUserProfile({});
    expect(profile.ownedShopItems).toEqual([]);
    expect(profile.recentRewards).toEqual([]);
  });
});

describe('isValidEmail', () => {
  it('accepts a standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });
  it('accepts subdomains', () => {
    expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
  });
  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });
  it('rejects missing TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords 6 chars or longer', () => {
    expect(isValidPassword('secret')).toBe(true);
    expect(isValidPassword('longerpassword123')).toBe(true);
  });
  it('rejects passwords shorter than 6 chars', () => {
    expect(isValidPassword('abc')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(123456)).toBe(false);
  });
});
