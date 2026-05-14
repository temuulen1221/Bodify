import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const USER_KEY = 'bodify:user@v1';
const AWARDS_KEY = 'bodify:awards@v1';
const STEPS_KEY = 'bodify:steps@v1';
const DEFAULT_AVATAR_MODEL = 'AvatarSample_M.vrm';

const hasOwnKeys = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);

const mergeHydratedField = (localValue, remoteValue) => {
  if (remoteValue === undefined || remoteValue === null) return localValue;

  if (typeof remoteValue === 'string') {
    return remoteValue.trim() ? remoteValue : localValue;
  }

  if (Array.isArray(remoteValue)) {
    return remoteValue.length > 0 ? remoteValue : localValue;
  }

  if (hasOwnKeys(remoteValue)) {
    return {
      ...(hasOwnKeys(localValue) ? localValue : {}),
      ...remoteValue,
    };
  }

  if (typeof remoteValue === 'object') {
    return localValue ?? remoteValue;
  }

  return remoteValue;
};

const buildPersistedUserSubset = (user = {}) => ({
  level: user.level ?? 1,
  points: user.points ?? 0,
  pointsMax: user.pointsMax ?? 100,
  totalXP: user.totalXP ?? 0,
  energy: user.energy ?? 0,
  discountTickets: user.discountTickets ?? 0,
  streakShields: user.streakShields ?? 0,
  ownedShopItems: Array.isArray(user.ownedShopItems) ? user.ownedShopItems : [],
  streakCount: user.streakCount ?? 0,
  bestStreak: user.bestStreak ?? 0,
  lastWorkoutDate: user.lastWorkoutDate ?? null,
  recentRewards: Array.isArray(user.recentRewards) ? user.recentRewards.slice(0, 8) : [],
  lastRewardAt: user.lastRewardAt ?? null,
  lastLevelUpAt: user.lastLevelUpAt ?? null,
  lastLevelUpReward: user.lastLevelUpReward ?? null,
  lastLevelUpModalSeenAt: user.lastLevelUpModalSeenAt ?? null,
  lastBadgeLevelUpAt: user.lastBadgeLevelUpAt ?? null,
  lastBadgeLevelUpReward: user.lastBadgeLevelUpReward ?? null,
  lastBadgeLevelUpSeenAt: user.lastBadgeLevelUpSeenAt ?? null,
  avatarName: user.avatarName ?? '',
  height: user.height ?? '',
  weight: user.weight ?? '',
  bodyShape: user.bodyShape ?? 'athletic',
  photoUri: user.photoUri ?? '',
  gender: user.gender ?? 'male',
  avatarSetupComplete: user.avatarSetupComplete ?? false,
  avatarModel: user.avatarModel ?? 'AvatarSample_M.vrm',
  dailyStepGoal: user.dailyStepGoal ?? 10000,
  weeklyWorkoutGoal: user.weeklyWorkoutGoal ?? 5,
  targetWeight: user.targetWeight ?? '',
  hairstyle: user.hairstyle ?? 'short_fade',
  eyeColor: user.eyeColor ?? 'blue',
  skinTone: user.skinTone ?? 'medium',
  clothingStyle: user.clothingStyle ?? 'starter_armor',
  accessoryStyle: user.accessoryStyle ?? 'adventurer_pack',
  hatStyle: user.hatStyle ?? 'none',
  selectedBadgeKey: user.selectedBadgeKey ?? null,
  badgeXPByCategory: user.badgeXPByCategory && typeof user.badgeXPByCategory === 'object' ? user.badgeXPByCategory : {},
});

export const mergeHydratedUserState = (localUser = null, remoteUser = null) => {
  const localData = localUser && typeof localUser === 'object' ? localUser : {};
  const remoteData = remoteUser && typeof remoteUser === 'object' ? remoteUser : {};
  const merged = { ...localData };

  Object.keys(remoteData).forEach((key) => {
    merged[key] = mergeHydratedField(localData[key], remoteData[key]);
  });

  return merged;
};

export const hasCompletedAvatarSetup = (user = {}) => Boolean(
  user?.avatarSetupComplete
  || String(user?.avatarName || '').trim()
  || String(user?.photoUri || '').trim()
  || String(user?.height || '').trim()
  || String(user?.weight || '').trim()
  || (typeof user?.avatarModel === 'string' && user.avatarModel.trim() && user.avatarModel !== DEFAULT_AVATAR_MODEL)
);

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
    const subset = buildPersistedUserSubset(user);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(subset));
  } catch (err) {
    console.warn('[storage] saveUserState failed', err);
  }
}

export async function loadRemoteUserState() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (data && typeof data === 'object') {
      return buildPersistedUserSubset(data);
    }
    return null;
  } catch (err) {
    console.warn('[storage] loadRemoteUserState failed', err);
    return null;
  }
}

export async function saveRemoteUserState(user) {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const subset = buildPersistedUserSubset(user);
    await setDoc(doc(db, 'users', userId), {
      ...subset,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[storage] saveRemoteUserState failed', err);
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
        weeklySquatRepsByWeek: awards?.quests?.weeklySquatRepsByWeek ?? {},
        weeklyXPAwardedByWeek: awards?.quests?.weeklyXPAwardedByWeek ?? {},
      },
      workouts: {
        sessionsByDate: awards?.workouts?.sessionsByDate ?? {},
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

export async function loadStepsState() {
  try {
    const s = await AsyncStorage.getItem(STEPS_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch (err) {
    console.warn('[storage] loadStepsState failed', err);
    return null;
  }
}

export async function saveStepsState(steps) {
  try {
    const subset = {
      stepsByDate: steps?.stepsByDate ?? {},
    };
    await AsyncStorage.setItem(STEPS_KEY, JSON.stringify(subset));
  } catch (err) {
    console.warn('[storage] saveStepsState failed', err);
  }
}

export async function clearStepsState() {
  try {
    await AsyncStorage.removeItem(STEPS_KEY);
  } catch (err) {
    console.warn('[storage] clearStepsState failed', err);
  }
}
