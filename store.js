import { configureStore, createListenerMiddleware, createSlice } from '@reduxjs/toolkit';
import { saveAwardsState, saveRemoteUserState, saveStepsState, saveUserState } from './services/storage';
import { BADGE_XP_LEVEL_STEP_BY_CATEGORY, deriveBadgeLevelFromCategoryXp } from './utils/badgeSystem';
import { calculateDailyStepXP } from './utils/stepXP';
import { createWorkoutSessionRecord } from './utils/workoutSessionXP';

const BASE_LEVEL_CAP = 100;
const RECENT_REWARD_LIMIT = 8;
const STREAK_REWARD_MILESTONES = [3, 7, 14, 30, 60];
const BADGE_XP_CATEGORY_KEYS = ['runner', 'strongman', 'workout', 'cardio', 'walker', 'diet', 'mass', 'shred'];
const BADGE_CATEGORY_LABELS = {
  runner: 'Runner',
  strongman: 'Strongman',
  workout: 'Workout Killer',
  cardio: 'Cardio Master',
  walker: 'Walker',
  diet: 'On Diet',
  mass: 'Mass Builder',
  shred: 'Weight Cutter',
};

const getLevelUpEnergyReward = (level) => 20 + (Math.max(1, Math.floor(Number(level) || 1)) - 1) * 5;

const LEVEL_MILESTONE_REWARD_MAP = {
  5: {
    level: 5,
    title: 'Level 5 Milestone',
    summary: 'Free premium cosmetic unlocked',
    items: ['a1'],
    tickets: 0,
    shields: 0,
  },
  10: {
    level: 10,
    title: 'Level 10 Milestone',
    summary: 'Discount ticket and rare accessory unlocked',
    items: ['a4'],
    tickets: 1,
    shields: 0,
  },
  15: {
    level: 15,
    title: 'Level 15 Milestone',
    summary: 'Badge unlock and streak protection awarded',
    items: ['a5'],
    tickets: 1,
    shields: 1,
  },
  20: {
    level: 20,
    title: 'Level 20 Milestone',
    summary: 'Premium course unlock and reward bundle awarded',
    items: ['o2'],
    tickets: 1,
    shields: 1,
  },
};

const getLevelMilestoneReward = (level) => LEVEL_MILESTONE_REWARD_MAP[Math.max(1, Math.floor(Number(level) || 1))] || null;

const buildLevelUpRewardSnapshot = (level, previousLevel = Math.max(1, level - 1)) => {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
  const normalizedPreviousLevel = Math.max(1, Math.floor(Number(previousLevel) || 1));
  const milestoneRewards = [];
  let energyAwarded = 0;

  for (let currentLevel = normalizedPreviousLevel + 1; currentLevel <= normalizedLevel; currentLevel += 1) {
    energyAwarded += getLevelUpEnergyReward(currentLevel);
    const milestoneReward = getLevelMilestoneReward(currentLevel);
    if (milestoneReward) {
      milestoneRewards.push({
        ...milestoneReward,
        items: [...(milestoneReward.items || [])],
      });
    }
  }

  return {
    level: normalizedLevel,
    levelsGained: Math.max(1, normalizedLevel - normalizedPreviousLevel),
    energyAwarded,
    milestoneRewards,
    createdAt: Date.now(),
  };
};

const mergeOwnedShopItems = (currentItems, nextItems) => {
  const merged = new Set(Array.isArray(currentItems) ? currentItems.filter(Boolean) : []);
  (Array.isArray(nextItems) ? nextItems : []).forEach((itemId) => {
    if (typeof itemId === 'string' && itemId) merged.add(itemId);
  });
  return Array.from(merged);
};

const createBadgeXpLedger = (source = {}) => Object.fromEntries(
  BADGE_XP_CATEGORY_KEYS.map((key) => [key, Math.max(0, Math.floor(Number(source?.[key]) || 0))])
);

const normalizeActivitySearchText = (session = {}) => {
  const detailText = Array.isArray(session?.exerciseDetails)
    ? session.exerciseDetails.map((detail) => `${detail?.label || ''} ${detail?.type || ''}`).join(' ')
    : '';

  return [session?.type, session?.title, session?.notes, detailText]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
};

export const categorizeWorkoutSessionForBadgeXp = (session = {}) => {
  const text = normalizeActivitySearchText(session);
  const calories = Math.max(0, Math.floor(Number(session?.calories) || 0));
  const durationMin = Math.max(0, Math.floor(Number(session?.durationMin) || 0));
  const isRun = /\brun(ning|ner)?\b|\bjog(ging)?\b/.test(text);
  const isCycling = /\bcycl(ing|e)?\b|\bbik(e|ing)\b|ride\b|spinning\b/.test(text);
  const isHiking = /\bhik(e|ing)\b|trail\b|trek\b|incline walk\b/.test(text);
  const isWalking = /\bwalk(ing)?\b|steps?\b/.test(text);
  const isCardio = isRun || isCycling || isHiking || isWalking || /cardio|hiit|jumping_jacks|jump rope/.test(text);
  const isStrength = /strength|weight|resistance|squat|push|plank|lunge|burpee|situp|crunch|deadlift|bench|pull/.test(text);
  const categories = new Set(['workout']);

  if (isRun) categories.add('runner');
  if (isCardio) categories.add('cardio');
  if (isWalking || isHiking) categories.add('walker');
  if (isStrength) {
    categories.add('strongman');
    categories.add('mass');
  }
  if (isCardio || calories >= 120) categories.add('shred');
  if (durationMin > 0 || calories > 0) categories.add('diet');

  return Array.from(categories);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateKeyToUtc = (dateStr) => {
  if (typeof dateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day);
};

const getTodayDateKey = (baseDate = new Date()) => {
  const date = baseDate instanceof Date ? baseDate : new Date(baseDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const shiftDateKey = (dateStr, offsetDays) => {
  const utc = parseDateKeyToUtc(dateStr);
  if (!Number.isFinite(utc)) return dateStr;
  const shifted = new Date(utc + (Number(offsetDays) || 0) * DAY_MS);
  return getTodayDateKey(shifted);
};

const getDateKeyDiff = (currentDateKey, previousDateKey) => {
  const currentUtc = parseDateKeyToUtc(currentDateKey);
  const previousUtc = parseDateKeyToUtc(previousDateKey);
  if (!Number.isFinite(currentUtc) || !Number.isFinite(previousUtc)) return null;
  return Math.floor((currentUtc - previousUtc) / DAY_MS);
};

const getLiveStreakCount = (lastWorkoutDate, streakCount, todayDateKey = getTodayDateKey()) => {
  const normalizedStreak = Math.max(0, Math.floor(Number(streakCount) || 0));
  if (!lastWorkoutDate || normalizedStreak <= 0) return 0;
  const diff = getDateKeyDiff(todayDateKey, lastWorkoutDate);
  if (diff == null) return normalizedStreak;
  if (diff <= 1) return normalizedStreak;
  return 0;
};

const maybeConsumeStreakShield = (state, currentDateKey) => {
  const normalizedStreak = Math.max(0, Math.floor(Number(state?.streakCount) || 0));
  const availableShields = Math.max(0, Math.floor(Number(state?.streakShields) || 0));
  if (!state?.lastWorkoutDate || normalizedStreak <= 0 || availableShields <= 0) return false;

  const diff = getDateKeyDiff(currentDateKey, state.lastWorkoutDate);
  if (diff !== 2) return false;

  state.streakShields = availableShields - 1;
  state.lastWorkoutDate = shiftDateKey(currentDateKey, -1);
  pushRecentReward(state, {
    source: 'streak_shield',
    xp: 0,
    title: 'Streak shield used',
    subtitle: 'One missed day was covered automatically',
  });
  return true;
};

const hasLegacyDemoProgress = (userState) => {
  const normalizedTotalXp = Math.max(0, Math.floor(Number(userState?.totalXP) || 0));
  const noRewards = !Array.isArray(userState?.recentRewards) || userState.recentRewards.length === 0;
  return (
    Number(userState?.level) === 3
    && Number(userState?.points) === 255
    && Number(userState?.pointsMax) === 300
    && normalizedTotalXp === inferTotalXPFromProgress(3, 255, 300)
    && !userState?.lastWorkoutDate
    && Number(userState?.streakCount || 0) === 0
    && Number(userState?.bestStreak || 0) === 0
    && noRewards
  );
};

const getNextLevelCap = (currentCap) => {
  const inc = Math.round(currentCap * 0.1 / 10) * 10;
  return currentCap + Math.max(10, inc);
};

const inferTotalXPFromProgress = (level, points, pointsMax) => {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
  const normalizedPoints = Math.max(0, Math.floor(Number(points) || 0));
  let cap = BASE_LEVEL_CAP;
  let total = 0;

  for (let currentLevel = 1; currentLevel < normalizedLevel; currentLevel += 1) {
    total += cap;
    cap = getNextLevelCap(cap);
  }

  const fallbackCap = Math.max(BASE_LEVEL_CAP, Math.floor(Number(pointsMax) || 0));
  return total + Math.min(normalizedPoints, normalizedLevel > 1 ? Math.max(cap, fallbackCap) : fallbackCap);
};

const normalizeXpPayload = (payload) => {
  if (typeof payload === 'number') {
    return {
      amount: payload,
      source: 'generic',
      title: '',
      subtitle: '',
    };
  }

  return {
    amount: Number(payload?.amount) || 0,
    source: String(payload?.source || 'generic'),
    title: String(payload?.title || ''),
    subtitle: String(payload?.subtitle || ''),
  };
};

const pushRecentReward = (state, reward) => {
  const nextReward = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    xp: 0,
    source: 'generic',
    title: 'Reward unlocked',
    subtitle: '',
    ...reward,
  };
  state.recentRewards = [nextReward, ...(Array.isArray(state.recentRewards) ? state.recentRewards : [])]
    .slice(0, RECENT_REWARD_LIMIT);
  state.lastRewardAt = nextReward.createdAt;
};

const initialState = {
  level: 1,
  points: 0,
  pointsMax: BASE_LEVEL_CAP,
  totalXP: 0,
  energy: 0,
  discountTickets: 0,
  streakShields: 0,
  ownedShopItems: [],
  // Streaks
  streakCount: 0,
  bestStreak: 0,
  lastWorkoutDate: null, // 'YYYY-MM-DD'
  recentRewards: [],
  lastRewardAt: null,
  lastLevelUpAt: null,
  lastLevelUpReward: null,
  lastLevelUpModalSeenAt: null,
  lastBadgeLevelUpAt: null,
  lastBadgeLevelUpReward: null,
  lastBadgeLevelUpSeenAt: null,
  levelUpPreviewReward: null,
  // Profile fields
  avatarName: '',
  height: '',
  weight: '',
  bodyShape: 'athletic',
  photoUri: '',
  gender: 'male',
  avatarSetupComplete: false,
  dailyStepGoal: 10000,
  weeklyWorkoutGoal: 5,
  targetWeight: '',
  avatarModel: 'AvatarSample_M.vrm',
  hairstyle: 'short_fade',
  eyeColor: 'blue',
  skinTone: 'medium',
  clothingStyle: 'starter_armor',
  accessoryStyle: 'adventurer_pack',
  hatStyle: 'none',
  selectedBadgeKey: null,
  badgeXPByCategory: createBadgeXpLedger(),
  avatar: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setPoints(state, action) {
      state.points = action.payload;
    },
    setLevel(state, action) {
      state.level = action.payload;
    },
    setPointsMax(state, action) {
      state.pointsMax = action.payload;
    },
    setEnergy(state, action) {
      state.energy = Math.max(0, Math.floor(Number(action.payload) || 0));
    },
    addOwnedShopItem(state, action) {
      state.ownedShopItems = mergeOwnedShopItems(state.ownedShopItems, [action.payload]);
    },
    consumeDiscountTicket(state) {
      state.discountTickets = Math.max(0, Math.floor(Number(state.discountTickets) || 0) - 1);
    },
    spendEnergy(state, action) {
      const amount = Math.max(0, Math.floor(Number(action.payload) || 0));
      if (amount <= 0) return;
      state.energy = Math.max(0, Math.floor(Number(state.energy) || 0) - amount);
    },
    showLevelUpPreview(state, action) {
      const payload = action.payload || {};
      const targetLevel = Math.max(2, Math.floor(Number(payload.level) || Math.max(5, Number(state.level || 1) + 1)));
      const previewPreviousLevel = Math.max(1, Math.min(targetLevel - 1, Math.floor(Number(payload.previousLevel) || Math.max(1, targetLevel - 1))));
      state.levelUpPreviewReward = buildLevelUpRewardSnapshot(targetLevel, previewPreviousLevel);
    },
    addXP(state, action) {
      const reward = normalizeXpPayload(action.payload);
      const delta = reward.amount;
      if (!Number.isFinite(delta) || delta <= 0) return;
      const now = Date.now();
      const previousLevel = state.level || 1;
      let pts = (state.points || 0) + delta;
      let lvl = previousLevel;
      let cap = state.pointsMax || BASE_LEVEL_CAP;
      let energyAwarded = 0;
      const milestoneRewards = [];
      while (pts >= cap) {
        pts -= cap;
        lvl += 1;
        energyAwarded += getLevelUpEnergyReward(lvl);
        const milestoneReward = getLevelMilestoneReward(lvl);
        if (milestoneReward) {
          if (milestoneReward.tickets > 0) {
            state.discountTickets = Math.max(0, Math.floor(Number(state.discountTickets) || 0)) + milestoneReward.tickets;
          }
          if (milestoneReward.shields > 0) {
            state.streakShields = Math.max(0, Math.floor(Number(state.streakShields) || 0)) + milestoneReward.shields;
          }
          if (Array.isArray(milestoneReward.items) && milestoneReward.items.length > 0) {
            state.ownedShopItems = mergeOwnedShopItems(state.ownedShopItems, milestoneReward.items);
          }
          milestoneRewards.push({
            ...milestoneReward,
            items: [...(milestoneReward.items || [])],
          });
        }
        cap = getNextLevelCap(cap);
      }
      state.points = Math.floor(pts);
      state.level = lvl;
      state.pointsMax = cap;
      state.totalXP = Math.max(
        Math.floor(Number(state.totalXP) || 0),
        inferTotalXPFromProgress(previousLevel, state.points || 0, cap) - delta
      ) + delta;

      if (reward.title) {
        pushRecentReward(state, {
          source: reward.source,
          xp: Math.floor(delta),
          title: reward.title,
          subtitle: reward.subtitle,
          createdAt: now,
        });
      }

      if (lvl > previousLevel) {
        state.lastLevelUpAt = now;
        state.energy = Math.max(0, Math.floor(Number(state.energy) || 0)) + energyAwarded;
        state.lastLevelUpReward = {
          level: lvl,
          levelsGained: lvl - previousLevel,
          energyAwarded,
          milestoneRewards,
          createdAt: now,
        };
        pushRecentReward(state, {
          source: 'level_up',
          xp: 0,
          title: `Level ${lvl} reached`,
          subtitle: `+${energyAwarded} energy · ${cap} XP needed for level ${lvl + 1}`,
          createdAt: now,
        });
        milestoneRewards.forEach((milestoneReward) => {
          pushRecentReward(state, {
            source: 'milestone_reward',
            xp: 0,
            title: milestoneReward.title,
            subtitle: milestoneReward.summary,
            createdAt: now,
          });
        });
      }
    },
    addBadgeXP(state, action) {
      const amount = Math.max(0, Math.floor(Number(action.payload?.amount) || 0));
      if (amount <= 0) return;
      const categories = Array.isArray(action.payload?.categories)
        ? action.payload.categories
        : [action.payload?.category];

      state.badgeXPByCategory = createBadgeXpLedger(state.badgeXPByCategory);
      const badgeRewards = [];
      categories.forEach((category) => {
        const key = String(category || '').trim().toLowerCase();
        if (!BADGE_XP_CATEGORY_KEYS.includes(key)) return;
        const previousXp = Math.max(0, Math.floor(Number(state.badgeXPByCategory[key]) || 0));
        const nextXp = previousXp + amount;
        const previousLevel = deriveBadgeLevelFromCategoryXp(key, previousXp);
        const nextLevel = deriveBadgeLevelFromCategoryXp(key, nextXp);
        state.badgeXPByCategory[key] = nextXp;
        if (nextLevel > previousLevel) {
          badgeRewards.push({
            key,
            label: BADGE_CATEGORY_LABELS[key] || key,
            level: nextLevel,
            levelsGained: Math.max(1, nextLevel - previousLevel),
            xp: amount,
            totalXp: nextXp,
            nextLevelStep: BADGE_XP_LEVEL_STEP_BY_CATEGORY[key] || 120,
          });
        }
      });

      if (badgeRewards.length > 0) {
        const createdAt = Date.now();
        state.lastBadgeLevelUpAt = createdAt;
        state.lastBadgeLevelUpSeenAt = null;
        state.lastBadgeLevelUpReward = {
          createdAt,
          rewards: badgeRewards,
        };
        const leadReward = badgeRewards[0];
        pushRecentReward(state, {
          source: 'badge_level',
          xp: 0,
          title: badgeRewards.length === 1 ? `${leadReward.label} badge leveled up` : `${badgeRewards.length} badges leveled up`,
          subtitle: badgeRewards.length === 1
            ? `Reached level ${leadReward.level}`
            : badgeRewards.map((reward) => reward.label).join(' · '),
          createdAt,
        });
      }
    },
    dismissLevelUpModal(state) {
      if (state.levelUpPreviewReward) {
        state.levelUpPreviewReward = null;
        return;
      }
      state.lastLevelUpModalSeenAt = state.lastLevelUpAt || Date.now();
    },
    dismissBadgeLevelUpModal(state) {
      state.lastBadgeLevelUpSeenAt = state.lastBadgeLevelUpAt || Date.now();
    },
    registerWorkoutDay(state, action) {
      // Update streaks based on a completed workout on a given date (YYYY-MM-DD)
      const dateStr = action.payload;
      if (typeof dateStr !== 'string' || dateStr.length !== 10) return;
      maybeConsumeStreakShield(state, dateStr);
      const prev = state.lastWorkoutDate;
      if (prev === dateStr) return;
      state.lastWorkoutDate = dateStr;
      const previousStreak = getLiveStreakCount(prev, state.streakCount || 0, dateStr);
      const diff = prev ? getDateKeyDiff(dateStr, prev) : null;
      if (diff === null || prev == null) {
        state.streakCount = 1;
      } else if (diff === 1) {
        state.streakCount = previousStreak + 1;
      } else if (diff > 1) {
        state.streakCount = 1;
      } else {
        state.streakCount = Math.max(previousStreak, state.streakCount || 0);
      }

      state.bestStreak = Math.max(state.bestStreak || 0, state.streakCount || 0);

      if ((state.streakCount || 0) > previousStreak && STREAK_REWARD_MILESTONES.includes(state.streakCount || 0)) {
        pushRecentReward(state, {
          source: 'streak',
          xp: 0,
          title: `${state.streakCount}-day streak`,
          subtitle: 'Consistency milestone unlocked',
        });
      }
    },
    setProfile(state, action) {
      const {
        avatarName,
        height,
        weight,
        bodyShape,
        photoUri,
        gender,
        dailyStepGoal,
        weeklyWorkoutGoal,
        targetWeight,
        avatarModel,
        hairstyle,
        eyeColor,
        skinTone,
        clothingStyle,
        accessoryStyle,
        hatStyle,
      } = action.payload || {};
      if (typeof avatarName === 'string') state.avatarName = avatarName;
      if (typeof height === 'string' || typeof height === 'number') state.height = String(height);
      if (typeof weight === 'string' || typeof weight === 'number') state.weight = String(weight);
      if (typeof bodyShape === 'string') state.bodyShape = bodyShape;
      if (typeof photoUri === 'string') state.photoUri = photoUri;
      if (typeof gender === 'string') state.gender = gender;
      if (typeof dailyStepGoal === 'string' || typeof dailyStepGoal === 'number') state.dailyStepGoal = Math.max(0, Number(dailyStepGoal) || 0);
      if (typeof weeklyWorkoutGoal === 'string' || typeof weeklyWorkoutGoal === 'number') state.weeklyWorkoutGoal = Math.max(0, Number(weeklyWorkoutGoal) || 0);
      if (typeof targetWeight === 'string' || typeof targetWeight === 'number') state.targetWeight = String(targetWeight);
      if (typeof avatarModel === 'string') state.avatarModel = avatarModel;
      if (typeof hairstyle === 'string') state.hairstyle = hairstyle;
      if (typeof eyeColor === 'string') state.eyeColor = eyeColor;
      if (typeof skinTone === 'string') state.skinTone = skinTone;
      if (typeof clothingStyle === 'string') state.clothingStyle = clothingStyle;
      if (typeof accessoryStyle === 'string') state.accessoryStyle = accessoryStyle;
      if (typeof hatStyle === 'string') state.hatStyle = hatStyle;
    },
    setAvatar(state, action) {
      state.avatar = action.payload;
    },
    setSelectedBadgeKey(state, action) {
      state.selectedBadgeKey = action.payload || null;
    },
    hydrateUser(state, action) {
      // Merge persisted user subset safely
      const data = action.payload || {};
      const keys = [
        'level','points','pointsMax','totalXP','energy','discountTickets','streakShields','ownedShopItems','streakCount','bestStreak','lastWorkoutDate',
        'recentRewards','lastRewardAt','lastLevelUpAt','lastLevelUpReward','lastLevelUpModalSeenAt','lastBadgeLevelUpAt','lastBadgeLevelUpReward','lastBadgeLevelUpSeenAt',
        'avatarName','height','weight','bodyShape','photoUri','gender','avatarSetupComplete','dailyStepGoal','weeklyWorkoutGoal','targetWeight','avatarModel','selectedBadgeKey','avatar'
        ,'hairstyle','eyeColor','skinTone','clothingStyle','accessoryStyle','hatStyle','badgeXPByCategory'
      ];
      keys.forEach((k) => {
        if (data[k] !== undefined) state[k] = data[k];
      });

      state.level = Math.max(1, Math.floor(Number(state.level) || 1));
      state.points = Math.max(0, Math.floor(Number(state.points) || 0));
      state.pointsMax = Math.max(BASE_LEVEL_CAP, Math.floor(Number(state.pointsMax) || BASE_LEVEL_CAP));
      state.totalXP = Math.max(
        0,
        Math.floor(Number(state.totalXP) || inferTotalXPFromProgress(state.level, state.points, state.pointsMax))
      );
      state.energy = Math.max(0, Math.floor(Number(state.energy) || 0));
      state.discountTickets = Math.max(0, Math.floor(Number(state.discountTickets) || 0));
      state.streakShields = Math.max(0, Math.floor(Number(state.streakShields) || 0));
      state.ownedShopItems = mergeOwnedShopItems([], state.ownedShopItems);
      state.badgeXPByCategory = createBadgeXpLedger(state.badgeXPByCategory);
      maybeConsumeStreakShield(state, getTodayDateKey());
      state.streakCount = getLiveStreakCount(state.lastWorkoutDate, state.streakCount);
      state.bestStreak = Math.max(state.bestStreak || 0, state.streakCount || 0);

      if (hasLegacyDemoProgress(state)) {
        state.level = 1;
        state.points = 0;
        state.pointsMax = BASE_LEVEL_CAP;
        state.totalXP = 0;
      }
    },
  },
});

export const { setPoints, setLevel, setPointsMax, setEnergy, addOwnedShopItem, consumeDiscountTicket, spendEnergy, showLevelUpPreview, addXP, addBadgeXP, dismissLevelUpModal, dismissBadgeLevelUpModal, registerWorkoutDay, setProfile, setAvatar, setSelectedBadgeKey, hydrateUser } = userSlice.actions;
// --- Quests slice to track daily completions and XP awards (YYYY-MM-DD => true) ---
const questsSlice = createSlice({
  name: 'quests',
  initialState: {
    dailyCompletion: {},
    // xpAwardedByDate: { 'YYYY-MM-DD': { 'quest_0': true, 'quest_1': true } }
    xpAwardedByDate: {},
    // Weekly squat tracking: { 'YYYY-WW': number }
    weeklySquatRepsByWeek: {},
    // Weekly XP awarded flags: { 'YYYY-WW': true }
    weeklyXPAwardedByWeek: {},
  },
  reducers: {
    markDayComplete(state, action) {
      const dateStr = action.payload; // expected 'YYYY-MM-DD'
      if (typeof dateStr === 'string' && dateStr.length === 10) {
        state.dailyCompletion[dateStr] = true;
      }
    },
    resetDay(state, action) {
      const dateStr = action.payload;
      if (state.dailyCompletion[dateStr]) delete state.dailyCompletion[dateStr];
    },
    markQuestXPAwarded(state, action) {
      const { date, key } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      if (typeof key !== 'string' || key.length === 0) return;
      if (!state.xpAwardedByDate[date]) state.xpAwardedByDate[date] = {};
      state.xpAwardedByDate[date][key] = true;
    },
    addWeeklySquatReps(state, action) {
      const { date, reps } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      const n = Number(reps);
      if (!Number.isFinite(n) || n <= 0) return;
      // Compute ISO week number (simplified): week starts Monday.
      const d = new Date(date + 'T00:00:00');
      // Thursday trick to ensure week number matches ISO
      const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0
      target.setUTCDate(target.getUTCDate() - dayNr + 3); // move to Thursday
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
      const week = 1 + Math.floor(diff / 7);
      const weekKey = `${target.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
      state.weeklySquatRepsByWeek[weekKey] = (state.weeklySquatRepsByWeek[weekKey] || 0) + n;
    },
    markWeeklyXPAwarded(state, action) {
      const { weekKey } = action.payload || {};
      if (!weekKey || typeof weekKey !== 'string') return;
      state.weeklyXPAwardedByWeek[weekKey] = true;
    },
    hydrateQuests(state, action) {
      const data = action.payload || {};
      const dc = data.dailyCompletion; const xa = data.xpAwardedByDate;
      if (dc && typeof dc === 'object') state.dailyCompletion = dc;
      if (xa && typeof xa === 'object') state.xpAwardedByDate = xa;
      if (data.weeklySquatRepsByWeek && typeof data.weeklySquatRepsByWeek === 'object') {
        state.weeklySquatRepsByWeek = data.weeklySquatRepsByWeek;
      }
      if (data.weeklyXPAwardedByWeek && typeof data.weeklyXPAwardedByWeek === 'object') {
        state.weeklyXPAwardedByWeek = data.weeklyXPAwardedByWeek;
      }
    },
  },
});

export const { markDayComplete, resetDay, markQuestXPAwarded, addWeeklySquatReps, markWeeklyXPAwarded, hydrateQuests } = questsSlice.actions;

// --- Workouts slice to track per-day completed workout sessions and XP awards ---
const workoutsSlice = createSlice({
  name: 'workouts',
  initialState: {
    // sessionsByDate: { 'YYYY-MM-DD': [{ id, title, durationMin, calories, notes }] }
    sessionsByDate: {},
    // xpAwardedSessionIdsByDate: { 'YYYY-MM-DD': { [sessionId]: true } }
    xpAwardedSessionIdsByDate: {},
  },
  reducers: {
    addWorkoutSession: {
      reducer(state, action) {
        const { date, session } = action.payload || {};
        if (!date || typeof date !== 'string' || date.length !== 10) return;
        if (!state.sessionsByDate[date]) state.sessionsByDate[date] = [];
        state.sessionsByDate[date].push(session);
      },
      prepare(payload) {
        const date = payload?.date;
        return {
          payload: {
            date,
            session: createWorkoutSessionRecord(payload?.session || {}),
          },
        };
      },
    },
    clearDayWorkouts(state, action) {
      const date = action.payload;
      if (state.sessionsByDate[date]) delete state.sessionsByDate[date];
    },
    markSessionXPAwarded(state, action) {
      const { date, sessionId } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      if (!sessionId || typeof sessionId !== 'string') return;
      if (!state.xpAwardedSessionIdsByDate[date]) state.xpAwardedSessionIdsByDate[date] = {};
      state.xpAwardedSessionIdsByDate[date][sessionId] = true;
    },
    hydrateWorkouts(state, action) {
      const data = action.payload || {};
      const sbd = data.sessionsByDate; const awarded = data.xpAwardedSessionIdsByDate;
      if (sbd && typeof sbd === 'object') {
        const normalizedSessionsByDate = {};
        Object.entries(sbd).forEach(([date, list]) => {
          if (typeof date !== 'string' || date.length !== 10) return;
          normalizedSessionsByDate[date] = Array.isArray(list)
            ? list.filter(Boolean).map((session) => createWorkoutSessionRecord(session || {}))
            : [];
        });
        state.sessionsByDate = normalizedSessionsByDate;
      }
      if (awarded && typeof awarded === 'object') state.xpAwardedSessionIdsByDate = awarded;
    },
  },
});

export const { addWorkoutSession, clearDayWorkouts, markSessionXPAwarded, hydrateWorkouts } = workoutsSlice.actions;

// --- Steps slice to track daily step counts ---
const stepsSlice = createSlice({
  name: 'steps',
  initialState: {
    // stepsByDate: { 'YYYY-MM-DD': number }
    stepsByDate: {},
  },
  reducers: {
    setStepsForDate(state, action) {
      const { date, steps } = action.payload || {};
      if (!date || typeof date !== 'string' || date.length !== 10) return;
      const n = Number(steps);
      if (!Number.isFinite(n) || n < 0) return;
      state.stepsByDate[date] = Math.floor(n);
    },
    clearStepsForDate(state, action) {
      const date = action.payload;
      if (state.stepsByDate[date] != null) delete state.stepsByDate[date];
    },
    hydrateSteps(state, action) {
      const data = action.payload || {};
      if (data.stepsByDate && typeof data.stepsByDate === 'object') {
        state.stepsByDate = data.stepsByDate;
      }
    },
  },
});

export const { setStepsForDate, clearStepsForDate, hydrateSteps } = stepsSlice.actions;

const workoutSessionRewardsListener = createListenerMiddleware();

const poseSlice = createSlice({
  name: 'pose',
  initialState: {
    currentExercise: 'squat',
    currentReps: 0,
    startedAt: null,
    cameraTrackingEnabled: true,
    privacyAccepted: false,
    formFeedback: '',
  },
  reducers: {
    setPoseExercise(state, action) { const e = String(action.payload || ''); if (e) state.currentExercise = e; },
    incrementPoseRep(state) { state.currentReps = (state.currentReps || 0) + 1; },
    resetPoseSession(state) { state.currentReps = 0; state.startedAt = Date.now(); },
    setCameraTrackingEnabled(state, action) { state.cameraTrackingEnabled = !!action.payload; },
    acceptPrivacy(state) { state.privacyAccepted = true; },
    setFormFeedback(state, action) { state.formFeedback = String(action.payload || ''); },
  },
});

workoutSessionRewardsListener.startListening({
  actionCreator: addWorkoutSession,
  effect: async (action, listenerApi) => {
    const date = action.payload?.date;
    const session = action.payload?.session || {};
    const sessionId = String(session.id || '');
    if (!date || !sessionId) return;

    const state = listenerApi.getState();
    const awardedByDate = state.workouts?.xpAwardedSessionIdsByDate || {};
    const alreadyAwarded = !!awardedByDate?.[date]?.[sessionId];
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (date === todayKey) {
      listenerApi.dispatch(registerWorkoutDay(date));
    }

    const xp = Math.max(0, Math.floor(Number(session.awardedXP) || 0));
    if (!alreadyAwarded && xp > 0) {
      listenerApi.dispatch(addXP({
        amount: xp,
        source: 'workout',
        title: session.title || 'Workout complete',
        subtitle: `${xp} XP from session rewards`,
      }));
      listenerApi.dispatch(addBadgeXP({
        amount: xp,
        categories: categorizeWorkoutSessionForBadgeXp(session),
      }));
      listenerApi.dispatch(markSessionXPAwarded({ date, sessionId }));
    }
  },
});

workoutSessionRewardsListener.startListening({
  actionCreator: setStepsForDate,
  effect: async (action, listenerApi) => {
    const { date, steps } = action.payload || {};
    if (!date || typeof date !== 'string' || date.length !== 10) return;

    const originalState = typeof listenerApi.getOriginalState === 'function'
      ? listenerApi.getOriginalState()
      : null;
    const previousSteps = Math.max(0, Math.floor(Number(originalState?.steps?.stepsByDate?.[date]) || 0));
    const nextSteps = Math.max(0, Math.floor(Number(steps) || 0));
    const previousXp = calculateDailyStepXP(previousSteps);
    const nextXp = calculateDailyStepXP(nextSteps);
    const deltaXp = Math.max(0, nextXp - previousXp);

    if (deltaXp <= 0) return;

    listenerApi.dispatch(addXP({
      amount: deltaXp,
      source: 'steps',
      title: 'Walking progress',
      subtitle: `${deltaXp} XP from step activity`,
    }));
    listenerApi.dispatch(addBadgeXP({
      amount: deltaXp,
      categories: ['walker'],
    }));
  },
});

const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    quests: questsSlice.reducer,
    workouts: workoutsSlice.reducer,
    steps: stepsSlice.reducer,
    pose: poseSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(workoutSessionRewardsListener.middleware),
});

export default store;
export const { setPoseExercise, incrementPoseRep, resetPoseSession, setCameraTrackingEnabled, acceptPrivacy, setFormFeedback } = poseSlice.actions;

// --- Persistence subscription: save a lightweight user subset on changes ---
try {
  let lastSavedJson = '';
  let lastAwardsJson = '';
  let lastStepsJson = '';
  let remoteUserSaveTimer = null;
  store.subscribe(() => {
    const state = store.getState();
    const user = state.user || {};
    const subset = {
      level: user.level,
      points: user.points,
      pointsMax: user.pointsMax,
      totalXP: user.totalXP,
      energy: user.energy,
      discountTickets: user.discountTickets,
      streakShields: user.streakShields,
      ownedShopItems: user.ownedShopItems,
      streakCount: user.streakCount,
      bestStreak: user.bestStreak,
      lastWorkoutDate: user.lastWorkoutDate,
      recentRewards: user.recentRewards,
      lastRewardAt: user.lastRewardAt,
      lastLevelUpAt: user.lastLevelUpAt,
      lastLevelUpReward: user.lastLevelUpReward,
      lastLevelUpModalSeenAt: user.lastLevelUpModalSeenAt,
      lastBadgeLevelUpAt: user.lastBadgeLevelUpAt,
      lastBadgeLevelUpReward: user.lastBadgeLevelUpReward,
      lastBadgeLevelUpSeenAt: user.lastBadgeLevelUpSeenAt,
      avatarName: user.avatarName,
      height: user.height,
      weight: user.weight,
      bodyShape: user.bodyShape,
      photoUri: user.photoUri,
      gender: user.gender,
      avatarSetupComplete: user.avatarSetupComplete,
      dailyStepGoal: user.dailyStepGoal,
      weeklyWorkoutGoal: user.weeklyWorkoutGoal,
      targetWeight: user.targetWeight,
      avatarModel: user.avatarModel,
      hairstyle: user.hairstyle,
      eyeColor: user.eyeColor,
      skinTone: user.skinTone,
      clothingStyle: user.clothingStyle,
      accessoryStyle: user.accessoryStyle,
      hatStyle: user.hatStyle,
      selectedBadgeKey: user.selectedBadgeKey,
      badgeXPByCategory: user.badgeXPByCategory,
    };
    const json = JSON.stringify(subset);
    if (json !== lastSavedJson) {
      lastSavedJson = json;
      saveUserState(subset);
      if (remoteUserSaveTimer) clearTimeout(remoteUserSaveTimer);
      remoteUserSaveTimer = setTimeout(() => {
        saveRemoteUserState(subset);
      }, 300);
    }

    // Persist awards markers for quests/workouts
    const awardsSubset = {
      quests: {
        dailyCompletion: state.quests?.dailyCompletion ?? {},
        xpAwardedByDate: state.quests?.xpAwardedByDate ?? {},
        weeklySquatRepsByWeek: state.quests?.weeklySquatRepsByWeek ?? {},
        weeklyXPAwardedByWeek: state.quests?.weeklyXPAwardedByWeek ?? {},
      },
      workouts: {
        sessionsByDate: state.workouts?.sessionsByDate ?? {},
        xpAwardedSessionIdsByDate: state.workouts?.xpAwardedSessionIdsByDate ?? {},
      },
    };
    const awardsJson = JSON.stringify(awardsSubset);
    if (awardsJson !== lastAwardsJson) {
      lastAwardsJson = awardsJson;
      saveAwardsState(awardsSubset);
    }

    const stepsSubset = {
      stepsByDate: state.steps?.stepsByDate ?? {},
    };
    const stepsJson = JSON.stringify(stepsSubset);
    if (stepsJson !== lastStepsJson) {
      lastStepsJson = stepsJson;
      saveStepsState(stepsSubset);
    }
  });
} catch (_) {
  // ignore subscription errors in non-standard environments
}
