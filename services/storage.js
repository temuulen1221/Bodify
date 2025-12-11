import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'bodify:user@v1';
const AWARDS_KEY = 'bodify:awards@v1';

export async function loadUserState() {
  try {
    const s = await AsyncStorage.getItem(USER_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    // Basic validation
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch (err) {
    console.warn('[storage] loadUserState failed', err);
    return null;
  }
}

export async function saveUserState(user) {
  try {
    const subset = {
      level: user.level ?? 1,
      points: user.points ?? 0,
      pointsMax: user.pointsMax ?? 100,
      streakCount: user.streakCount ?? 0,
      lastWorkoutDate: user.lastWorkoutDate ?? null,
      avatarName: user.avatarName ?? '',
      height: user.height ?? '',
      weight: user.weight ?? '',
      bodyShape: user.bodyShape ?? 'athletic',
      photoUri: user.photoUri ?? '',
      gender: user.gender ?? 'male',
      // avatar: user.avatar ?? null, // avoid heavy objects; persist separately if needed
    };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(subset));
  } catch (err) {
    console.warn('[storage] saveUserState failed', err);
  }
}

export async function clearUserState() {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (err) {
    console.warn('[storage] clearUserState failed', err);
  }
}

export async function loadAwardsState() {
  try {
    const s = await AsyncStorage.getItem(AWARDS_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch (err) {
    console.warn('[storage] loadAwardsState failed', err);
    return null;
  }
}

export async function saveAwardsState(awards) {
  try {
    const subset = {
      quests: {
        dailyCompletion: awards?.quests?.dailyCompletion ?? {},
        xpAwardedByDate: awards?.quests?.xpAwardedByDate ?? {},
      },
      workouts: {
        // Persist only award markers to keep payload small
        xpAwardedSessionIdsByDate: awards?.workouts?.xpAwardedSessionIdsByDate ?? {},
      },
    };
    await AsyncStorage.setItem(AWARDS_KEY, JSON.stringify(subset));
  } catch (err) {
    console.warn('[storage] saveAwardsState failed', err);
  }
}

export async function clearAwardsState() {
  try {
    await AsyncStorage.removeItem(AWARDS_KEY);
  } catch (err) {
    console.warn('[storage] clearAwardsState failed', err);
  }
}
