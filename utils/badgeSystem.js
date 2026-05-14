import { calculateDailyStepXP, sumStepXPByDateMap } from './stepXP';

export const BADGE_XP_LEVEL_STEP_BY_CATEGORY = {
  runner: 100,
  strongman: 120,
  workout: 120,
  cardio: 120,
  walker: 100,
  diet: 120,
  mass: 120,
  shred: 120,
};

export function getTodayDateKey(baseDate = new Date()) {
  const date = baseDate instanceof Date ? baseDate : new Date(baseDate);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getSessionXP(session) {
  return Math.max(0, Math.floor(Number(session?.awardedXP) || 0));
}

function appendXpTierAchievements(list, xp) {
  if (xp >= 100) list.push('xp-100');
  if (xp >= 500) list.push('xp-500');
  if (xp >= 1000) list.push('xp-1000');
  if (xp >= 2500) list.push('xp-2500');
}

function nextXpGoal(xp) {
  const normalized = Math.max(0, Math.floor(Number(xp) || 0));
  if (normalized < 100) return 100;
  return Math.ceil((normalized + 1) / 100) * 100;
}

function nextCategoryXpGoal(categoryKey, xp) {
  const normalized = Math.max(0, Math.floor(Number(xp) || 0));
  const step = Math.max(1, Number(BADGE_XP_LEVEL_STEP_BY_CATEGORY[String(categoryKey || '').trim().toLowerCase()]) || 100);
  if (normalized <= 0) return step;
  return Math.ceil((normalized + 1) / step) * step;
}

function estimateKmFromSession(session) {
  const distance = Number(session?.distanceKm ?? session?.distance);
  if (Number.isFinite(distance) && distance > 0) return distance;
  const duration = Number(session?.durationMin);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return (8.0 * duration) / 60;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function extractSessionSearchText(session) {
  const detailText = Array.isArray(session?.exerciseDetails)
    ? session.exerciseDetails
      .map((detail) => `${detail?.label || ''} ${detail?.type || ''}`)
      .join(' ')
    : '';

  return [
    session?.type,
    session?.title,
    session?.notes,
    detailText,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function classifySession(session) {
  const text = extractSessionSearchText(session);

  return {
    isRun: /\brun(ning|ner)?\b|\bjog(ging)?\b/.test(text),
    isCycling: /\bcycl(ing|e)?\b|\bbik(e|ing)\b|ride\b|spinning\b/.test(text),
    isHiking: /\bhik(e|ing)\b|trail\b|trek\b|incline walk\b/.test(text),
    isWalking: /\bwalk(ing)?\b|steps?\b/.test(text),
    isStrength: /strength|weight|resistance|squat|push|plank|lunge|burpee|situp|crunch|deadlift|bench|pull/.test(text),
  };
}

function isWorkoutReward(reward) {
  return String(reward?.source || '').toLowerCase() === 'workout' && Number(reward?.xp) > 0;
}

function classifyWorkoutReward(reward) {
  const title = String(reward?.title || '').toLowerCase();
  const subtitle = String(reward?.subtitle || '').toLowerCase();
  const text = `${title} ${subtitle}`;
  const isRun = /\brun(ning|ner)?\b|\bjog(ging)?\b/.test(text);
  const isCycling = /\bcycl(ing|e)?\b|\bbik(e|ing)\b|ride\b|spinning\b/.test(text);
  const isHiking = /\bhik(e|ing)\b|trail\b|trek\b/.test(text);
  const isWalking = /\bwalk(ing)?\b|steps?\b/.test(text);
  const isStrength = /strength|squat|push|plank|lunge|burpee|workout|deadlift|bench|pull/.test(text);

  return {
    isRun,
    isCycling,
    isHiking,
    isWalking,
    isCardio: isRun || isCycling || isHiking || isWalking || text.includes('cardio'),
    isStrength,
  };
}

function isRewardWithinDays(reward, days) {
  const createdAt = Number(reward?.createdAt || 0);
  if (!createdAt || !Number.isFinite(createdAt)) return false;
  return (Date.now() - createdAt) <= days * 24 * 60 * 60 * 1000;
}

function isCardioType(type) {
  return type.includes('cardio') || type.includes('run') || type.includes('cycl') || type.includes('bike') || type.includes('hike') || type.includes('walk');
}

function isStrengthType(type) {
  return type.includes('strength') || type.includes('weight') || type.includes('resistance') || type.includes('squat') || type.includes('push') || type.includes('plank') || type.includes('lunge');
}

function compactProgress(xpValue, maxXpValue, fallbackLevel) {
  if (xpValue > 0 && maxXpValue > 0) return Math.max(12, Math.min(99, Math.round((xpValue / maxXpValue) * 100)));
  if (fallbackLevel > 0) return Math.max(10, Math.min(95, fallbackLevel * 12));
  return 0;
}

function deriveBadgeLevel(metricValue, pointsPerLevel) {
  const normalizedMetric = Math.max(0, Number(metricValue) || 0);
  const threshold = Math.max(1, Number(pointsPerLevel) || 1);
  if (normalizedMetric <= 0) return 0;
  return 1 + Math.floor((normalizedMetric - 1) / threshold);
}

export function deriveBadgeLevelFromCategoryXp(categoryKey, xpValue) {
  const normalizedKey = String(categoryKey || '').trim().toLowerCase();
  const step = BADGE_XP_LEVEL_STEP_BY_CATEGORY[normalizedKey] || 120;
  return deriveBadgeLevel(xpValue, step);
}

export function getRankForLevel(level) {
  const numericLevel = Number(level || 1);
  if (numericLevel >= 20) return 'S';
  if (numericLevel >= 15) return 'A';
  if (numericLevel >= 10) return 'B';
  if (numericLevel >= 5) return 'C';
  return 'D';
}

export function buildBadgeData({ user = {}, stepsByDate = {}, sessionsByDate = {}, todayKey = getTodayDateKey() }) {
  const storedBadgeXP = user?.badgeXPByCategory && typeof user.badgeXPByCategory === 'object'
    ? user.badgeXPByCategory
    : {};
  const lifetimeSteps = Object.values(stepsByDate).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const todaySteps = Number(stepsByDate[todayKey] || 0);
  const todayStepXP = calculateDailyStepXP(todaySteps);
  const todaySessions = sessionsByDate[todayKey] || [];
  const todayCalories = todaySessions.reduce((sum, session) => sum + (Number(session?.calories) || 0), 0);
  const todayWorkoutXP = todaySessions.reduce((sum, session) => sum + getSessionXP(session), 0);

  let maxCaloriesAllTime = 0;
  let lifetimeSessions = 0;
  let lifetimeCalories = 0;
  let lifetimeWorkoutXP = 0;
  let lifetimeRunningXP = 0;
  let lifetimeCardioXP = 0;
  let lifetimeStrengthXP = 0;
  let maxSessionXPAllTime = 0;
  let lifetimeRunningKm = 0;

  Object.keys(sessionsByDate).forEach((key) => {
    const list = sessionsByDate[key] || [];
    lifetimeSessions += list.length;
    lifetimeCalories += list.reduce((sum, session) => sum + (Number(session?.calories) || 0), 0);
    list.forEach((session) => {
      const xp = getSessionXP(session);
      const type = String(session?.type || '').toLowerCase();
      const category = classifySession(session);
      maxCaloriesAllTime = Math.max(maxCaloriesAllTime, Number(session?.calories) || 0);
      lifetimeWorkoutXP += xp;
      maxSessionXPAllTime = Math.max(maxSessionXPAllTime, xp);
      if (category.isRun) {
        lifetimeRunningXP += xp;
        lifetimeRunningKm += estimateKmFromSession(session);
      }
      if (category.isCardio || isCardioType(type)) lifetimeCardioXP += xp;
      if (category.isStrength || isStrengthType(type)) lifetimeStrengthXP += xp;
    });
  });

  const recentRewards = Array.isArray(user?.recentRewards) ? user.recentRewards : [];
  if (lifetimeSessions === 0 && recentRewards.length > 0) {
    recentRewards.forEach((reward) => {
      if (!isWorkoutReward(reward)) return;
      const xp = Math.max(0, Math.floor(Number(reward?.xp) || 0));
      const rewardType = classifyWorkoutReward(reward);
      lifetimeWorkoutXP += xp;
      maxSessionXPAllTime = Math.max(maxSessionXPAllTime, xp);
      lifetimeSessions += 1;
      if (rewardType.isRun) lifetimeRunningXP += xp;
      if (rewardType.isCardio) lifetimeCardioXP += xp;
      if (rewardType.isStrength) lifetimeStrengthXP += xp;
    });
  }

  lifetimeRunningXP = Math.max(lifetimeRunningXP, Math.max(0, Number(storedBadgeXP.runner) || 0));
  lifetimeWorkoutXP = Math.max(lifetimeWorkoutXP, Math.max(0, Number(storedBadgeXP.workout) || 0));
  lifetimeCardioXP = Math.max(lifetimeCardioXP, Math.max(0, Number(storedBadgeXP.cardio) || 0));
  lifetimeStrengthXP = Math.max(lifetimeStrengthXP, Math.max(0, Number(storedBadgeXP.strongman) || 0));

  const baseDate = new Date(todayKey);
  const weekMetrics = {
    weekSessions: 0,
    weekCalories: 0,
    weekSteps: 0,
    weekWorkoutXP: 0,
    weekRunningXP: 0,
    weekStrengthXP: 0,
    weekCardioXP: 0,
    weekStepXP: 0,
    weekRunningKm: 0,
  };
  const monthMetrics = {
    monthSessions: 0,
    monthCalories: 0,
    monthWorkoutXP: 0,
    monthStrengthXP: 0,
    monthStrengthSessions: 0,
  };

  for (let i = 0; i < 30; i += 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - i);
    const key = getTodayDateKey(date);
    const list = sessionsByDate[key] || [];
    const steps = Number(stepsByDate[key] || 0);

    if (i < 7) {
      weekMetrics.weekSessions += list.length;
      weekMetrics.weekCalories += list.reduce((sum, session) => sum + (Number(session?.calories) || 0), 0);
      weekMetrics.weekSteps += steps;
      weekMetrics.weekStepXP += calculateDailyStepXP(steps);
    }

    monthMetrics.monthSessions += list.length;
    monthMetrics.monthCalories += list.reduce((sum, session) => sum + (Number(session?.calories) || 0), 0);

    list.forEach((session) => {
      const xp = getSessionXP(session);
      const type = String(session?.type || '').toLowerCase();
      const category = classifySession(session);

      if (i < 7) {
        weekMetrics.weekWorkoutXP += xp;
        if (category.isRun) {
          weekMetrics.weekRunningXP += xp;
          weekMetrics.weekRunningKm += estimateKmFromSession(session);
        }
        if (category.isCardio || isCardioType(type)) weekMetrics.weekCardioXP += xp;
        if (category.isStrength || isStrengthType(type)) weekMetrics.weekStrengthXP += xp;
      }

      monthMetrics.monthWorkoutXP += xp;
      if (category.isStrength || isStrengthType(type)) {
        monthMetrics.monthStrengthXP += xp;
        monthMetrics.monthStrengthSessions += 1;
      }
    });
  }

  if (Object.keys(sessionsByDate).length === 0 && recentRewards.length > 0) {
    recentRewards.forEach((reward) => {
      if (!isWorkoutReward(reward) || !isRewardWithinDays(reward, 30)) return;
      const xp = Math.max(0, Math.floor(Number(reward?.xp) || 0));
      const rewardType = classifyWorkoutReward(reward);

      monthMetrics.monthWorkoutXP += xp;
      monthMetrics.monthSessions += 1;

      if (isRewardWithinDays(reward, 7)) {
        weekMetrics.weekWorkoutXP += xp;
        weekMetrics.weekSessions += 1;
        if (rewardType.isRun) weekMetrics.weekRunningXP += xp;
        if (rewardType.isCardio) weekMetrics.weekCardioXP += xp;
        if (rewardType.isStrength) weekMetrics.weekStrengthXP += xp;
      }

      if (rewardType.isStrength) {
        monthMetrics.monthStrengthXP += xp;
        monthMetrics.monthStrengthSessions += 1;
      }
    });
  }

  const estWeightGainedKg = Math.min(15, Math.round(monthMetrics.monthStrengthSessions * 0.1 * 10) / 10);
  const estMusclePct = Math.min(15, Math.round(monthMetrics.monthStrengthSessions * 0.2 * 10) / 10);
  const estWeightLostKg = Math.round((monthMetrics.monthCalories / 7700) * 10) / 10;
  const estBodyFatReducedPct = Math.min(20, Math.round(estWeightLostKg * 0.8 * 10) / 10);
  const lifetimeWorkoutBadgeXP = Math.max(lifetimeWorkoutXP, Math.max(0, Number(storedBadgeXP.workout) || 0));
  const lifetimeStepXP = Math.max(sumStepXPByDateMap(stepsByDate), Math.max(0, Number(storedBadgeXP.walker) || 0));
  const lifetimeDietXP = Math.max(lifetimeWorkoutXP, Math.max(0, Number(storedBadgeXP.diet) || 0));
  const lifetimeMassXP = Math.max(lifetimeStrengthXP, Math.max(0, Number(storedBadgeXP.mass) || 0));
  const lifetimeShredXP = Math.max(lifetimeCardioXP, Math.max(0, Number(storedBadgeXP.shred) || 0));
  const currentStreak = Math.max(0, Number(user?.streakCount || 0));

  const runnerAchievements = [];
  if (lifetimeRunningKm >= 10) runnerAchievements.push('runner-10k');
  if (lifetimeRunningKm >= 50) runnerAchievements.push('runner-50k');
  if (lifetimeRunningKm >= 200) runnerAchievements.push('runner-200k');
  if (weekMetrics.weekRunningKm >= 20) runnerAchievements.push('weekly-run-20');
  if (currentStreak >= 7) runnerAchievements.push('streak-7');
  if (currentStreak >= 30) runnerAchievements.push('streak-30');
  appendXpTierAchievements(runnerAchievements, lifetimeRunningXP);

  const warriorAchievements = [];
  if (weekMetrics.weekSessions >= 5) warriorAchievements.push('weekly-5');
  if (weekMetrics.weekSessions >= 10) warriorAchievements.push('weekly-10');
  if (monthMetrics.monthSessions >= 20) warriorAchievements.push('monthly-20');
  if (maxCaloriesAllTime >= 600) warriorAchievements.push('calorie-600');
  if (currentStreak >= 7) warriorAchievements.push('streak-7');
  if (currentStreak >= 30) warriorAchievements.push('streak-30');
  appendXpTierAchievements(warriorAchievements, lifetimeStrengthXP);

  const cardioAchievements = [];
  if (weekMetrics.weekSessions >= 5) cardioAchievements.push('weekly-5');
  if (weekMetrics.weekSessions >= 10) cardioAchievements.push('weekly-10');
  if (monthMetrics.monthSessions >= 20) cardioAchievements.push('monthly-20');
  if (maxCaloriesAllTime >= 600) cardioAchievements.push('calorie-600');
  if (currentStreak >= 7) cardioAchievements.push('streak-7');
  if (currentStreak >= 30) cardioAchievements.push('streak-30');
  appendXpTierAchievements(cardioAchievements, lifetimeCardioXP);

  const walkerAchievements = [];
  if (lifetimeSteps >= 50000) walkerAchievements.push('walker-50k');
  if (lifetimeSteps >= 200000) walkerAchievements.push('walker-200k');
  if (lifetimeSteps >= 1000000) walkerAchievements.push('walker-1m');
  if (currentStreak >= 7) walkerAchievements.push('streak-7');
  if (currentStreak >= 30) walkerAchievements.push('streak-30');
  appendXpTierAchievements(walkerAchievements, lifetimeStepXP);

  const compactBadgeLevels = {
    runner: deriveBadgeLevelFromCategoryXp('runner', lifetimeRunningXP),
    strongman: deriveBadgeLevelFromCategoryXp('strongman', lifetimeStrengthXP),
    workout: deriveBadgeLevelFromCategoryXp('workout', lifetimeWorkoutBadgeXP),
    cardio: deriveBadgeLevelFromCategoryXp('cardio', lifetimeCardioXP),
    walker: deriveBadgeLevelFromCategoryXp('walker', lifetimeStepXP),
    diet: deriveBadgeLevelFromCategoryXp('diet', lifetimeDietXP),
    mass: deriveBadgeLevelFromCategoryXp('mass', lifetimeMassXP),
    shred: deriveBadgeLevelFromCategoryXp('shred', lifetimeShredXP),
  };
  const badgeRanks = Object.fromEntries(
    Object.entries(compactBadgeLevels).map(([key, level]) => [key, getRankForLevel(level)])
  );

  const badgeConfigs = [
    {
      key: 'runner',
      label: 'Runner',
      iconName: 'run-fast',
      level: compactBadgeLevels.runner,
      rank: badgeRanks.runner,
      progress: compactProgress(lifetimeRunningXP, nextCategoryXpGoal('runner', lifetimeRunningXP), compactBadgeLevels.runner),
      tone: 'cyan',
      detailProps: {
        level: compactBadgeLevels.runner,
        levelName: 'Elite Runner',
        xp: lifetimeRunningXP,
        maxXp: nextCategoryXpGoal('runner', lifetimeRunningXP),
        primaryStat: lifetimeRunningKm,
        primaryStatLabel: 'Running Distance (km)',
        secondaryStat: weekMetrics.weekRunningXP,
        secondaryStatLabel: 'Running XP (7d)',
        xpDetailLabel: 'Earned This Week',
        xpDetailValue: weekMetrics.weekRunningXP,
        primaryHint: `${todayWorkoutXP} XP today`,
        secondaryHint: `${weekMetrics.weekRunningKm.toLocaleString()} km in 7d`,
        rank: badgeRanks.runner,
        streak: currentStreak,
        achievements: runnerAchievements,
        glowColor: 'cyan',
      },
    },
    {
      key: 'strongman',
      label: 'Strongman',
      iconName: 'dumbbell',
      level: compactBadgeLevels.strongman,
      rank: badgeRanks.strongman,
      progress: compactProgress(lifetimeStrengthXP, nextCategoryXpGoal('strongman', lifetimeStrengthXP), compactBadgeLevels.strongman),
      tone: 'red',
      detailProps: {
        level: compactBadgeLevels.strongman,
        levelName: 'Iron Warrior',
        xp: lifetimeStrengthXP,
        maxXp: nextCategoryXpGoal('strongman', lifetimeStrengthXP),
        primaryStat: weekMetrics.weekSessions,
        primaryStatLabel: 'Sessions (7d)',
        secondaryStat: weekMetrics.weekStrengthXP,
        secondaryStatLabel: 'Strength XP (7d)',
        xpDetailLabel: 'Earned This Week',
        xpDetailValue: weekMetrics.weekStrengthXP,
        primaryHint: `${monthMetrics.monthStrengthSessions} strength sessions`,
        secondaryHint: `${todayWorkoutXP} workout XP today`,
        rank: badgeRanks.strongman,
        streak: currentStreak,
        achievements: warriorAchievements,
        glowColor: 'red',
      },
    },
    {
      key: 'workout',
      label: 'Workout Killer',
      iconName: 'check-circle-outline',
      level: compactBadgeLevels.workout,
      rank: badgeRanks.workout,
      progress: compactProgress(lifetimeWorkoutBadgeXP, nextCategoryXpGoal('workout', lifetimeWorkoutBadgeXP), compactBadgeLevels.workout),
      tone: 'orange',
      detailProps: {
        level: compactBadgeLevels.workout,
        levelName: 'Gym Destroyer',
        typeLabel: 'WORKOUT KILLER',
        typeIconName: 'dumbbell',
        xp: lifetimeWorkoutBadgeXP,
        maxXp: nextCategoryXpGoal('workout', lifetimeWorkoutBadgeXP),
        primaryStat: lifetimeSessions,
        primaryStatLabel: 'Workouts',
        secondaryStat: monthMetrics.monthWorkoutXP,
        secondaryStatLabel: 'Workout XP (30d)',
        xpDetailLabel: 'Earned This Week',
        xpDetailValue: weekMetrics.weekWorkoutXP,
        primaryHint: `${maxSessionXPAllTime} best session XP`,
        secondaryHint: `${monthMetrics.monthSessions} sessions in 30d`,
        rank: badgeRanks.workout,
        streak: currentStreak,
        achievements: warriorAchievements,
        glowColor: 'orange',
      },
    },
    {
      key: 'cardio',
      label: 'Cardio Master',
      iconName: 'heart-pulse',
      level: compactBadgeLevels.cardio,
      rank: badgeRanks.cardio,
      progress: compactProgress(lifetimeCardioXP, nextCategoryXpGoal('cardio', lifetimeCardioXP), compactBadgeLevels.cardio),
      tone: 'magenta',
      detailProps: {
        level: compactBadgeLevels.cardio,
        levelName: 'Heart Champion',
        typeLabel: 'CARDIO',
        typeIconName: 'heart-pulse',
        xp: lifetimeCardioXP,
        maxXp: nextCategoryXpGoal('cardio', lifetimeCardioXP),
        primaryStat: lifetimeSessions,
        primaryStatLabel: 'Sessions',
        secondaryStat: weekMetrics.weekCardioXP,
        secondaryStatLabel: 'Cardio XP (7d)',
        xpDetailLabel: 'Earned This Week',
        xpDetailValue: weekMetrics.weekCardioXP,
        primaryHint: `${Math.round(lifetimeCalories / Math.max(1, lifetimeSessions))} avg kcal/session`,
        secondaryHint: `${weekMetrics.weekCalories} kcal in 7d`,
        rank: badgeRanks.cardio,
        streak: currentStreak,
        achievements: cardioAchievements,
        glowColor: 'magenta',
      },
    },
    {
      key: 'walker',
      label: 'Walker',
      iconName: 'shoe-print',
      level: compactBadgeLevels.walker,
      rank: badgeRanks.walker,
      progress: compactProgress(lifetimeStepXP, nextCategoryXpGoal('walker', lifetimeStepXP), compactBadgeLevels.walker),
      tone: 'purple',
      detailProps: {
        level: compactBadgeLevels.walker,
        levelName: 'Step Master',
        typeLabel: 'WALKER',
        typeIconName: 'shoe-print',
        xp: lifetimeStepXP,
        maxXp: nextCategoryXpGoal('walker', lifetimeStepXP),
        primaryStat: lifetimeSteps,
        primaryStatLabel: 'Steps',
        secondaryStat: weekMetrics.weekStepXP,
        secondaryStatLabel: 'Step XP (7d)',
        xpDetailLabel: 'Earned Today',
        xpDetailValue: todayStepXP,
        primaryHint: `${Math.round(weekMetrics.weekSteps / 7)} avg daily steps`,
        secondaryHint: `${todaySteps.toLocaleString()} steps today`,
        rank: badgeRanks.walker,
        streak: currentStreak,
        achievements: walkerAchievements,
        glowColor: 'purple',
      },
    },
    {
      key: 'diet',
      label: 'On Diet',
      iconName: 'food-apple',
      level: compactBadgeLevels.diet,
      rank: badgeRanks.diet,
      progress: compactProgress(lifetimeDietXP, nextCategoryXpGoal('diet', lifetimeDietXP), compactBadgeLevels.diet),
      tone: 'green',
      detailProps: {
        level: compactBadgeLevels.diet,
        levelName: 'Nutrition Pro',
        typeLabel: 'ON DIET',
        typeIconName: 'food-apple',
        xp: lifetimeDietXP,
        maxXp: nextCategoryXpGoal('diet', lifetimeDietXP),
        primaryStat: 0,
        primaryStatLabel: 'Clean Days',
        secondaryStat: 1800,
        secondaryStatLabel: 'Cal Target',
        xpDetailLabel: 'Workout XP (7d)',
        xpDetailValue: weekMetrics.weekWorkoutXP,
        primaryHint: `${todayCalories} kcal today`,
        secondaryHint: 'Target 1800 kcal',
        rank: badgeRanks.diet,
        streak: currentStreak,
        achievements: [],
        glowColor: 'green',
      },
    },
    {
      key: 'mass',
      label: 'Mass Builder',
      iconName: 'trending-up',
      level: compactBadgeLevels.mass,
      rank: badgeRanks.mass,
      progress: compactProgress(lifetimeMassXP, nextCategoryXpGoal('mass', lifetimeMassXP), compactBadgeLevels.mass),
      tone: 'blue',
      detailProps: {
        level: compactBadgeLevels.mass,
        levelName: 'Bulk Champion',
        typeLabel: 'MASS BUILDER',
        typeIconName: 'weight-lifter',
        xp: lifetimeMassXP,
        maxXp: nextCategoryXpGoal('mass', lifetimeMassXP),
        primaryStat: estWeightGainedKg,
        primaryStatLabel: 'Weight Gained (kg)',
        secondaryStat: monthMetrics.monthStrengthXP,
        secondaryStatLabel: 'Strength XP (30d)',
        xpDetailLabel: 'Earned This Month',
        xpDetailValue: monthMetrics.monthStrengthXP,
        primaryHint: `${estMusclePct}% muscle estimate`,
        secondaryHint: `${monthMetrics.monthStrengthSessions} strength sessions`,
        rank: badgeRanks.mass,
        streak: currentStreak,
        achievements: warriorAchievements,
        glowColor: 'blue',
      },
    },
    {
      key: 'shred',
      label: 'Weight Cutter',
      iconName: 'trending-down',
      level: compactBadgeLevels.shred,
      rank: badgeRanks.shred,
      progress: compactProgress(lifetimeShredXP, nextCategoryXpGoal('shred', lifetimeShredXP), compactBadgeLevels.shred),
      tone: 'teal',
      detailProps: {
        level: compactBadgeLevels.shred,
        levelName: 'Shredder Pro',
        typeLabel: 'WEIGHT CUTTER',
        typeIconName: 'scale-bathroom',
        xp: lifetimeShredXP,
        maxXp: nextCategoryXpGoal('shred', lifetimeShredXP),
        primaryStat: estWeightLostKg,
        primaryStatLabel: 'Weight Lost (kg)',
        secondaryStat: monthMetrics.monthCalories,
        secondaryStatLabel: 'Calories Burned (30d)',
        xpDetailLabel: 'Earned This Week',
        xpDetailValue: weekMetrics.weekCardioXP,
        primaryHint: `${estBodyFatReducedPct}% body-fat estimate`,
        secondaryHint: `${monthMetrics.monthCalories} kcal in 30d`,
        rank: badgeRanks.shred,
        streak: currentStreak,
        achievements: cardioAchievements,
        glowColor: 'green',
      },
    },
  ];

  const unlockedAchievementCount = new Set([
    ...runnerAchievements,
    ...warriorAchievements,
    ...cardioAchievements,
    ...walkerAchievements,
  ]).size;

  return {
    badgeConfigs,
    summaryMetrics: {
      totalXp: Math.max(user?.totalXP || 0, lifetimeWorkoutXP + lifetimeStepXP),
      unlockedAchievementCount,
      bestStreak: Math.max(user?.bestStreak ?? 0, user?.streakCount ?? 0),
      averageBadgeLevel: Number((badgeConfigs.reduce((sum, badge) => sum + badge.level, 0) / badgeConfigs.length).toFixed(1)),
    },
  };
}

export function getFeaturedBadgeConfig(badgeConfigs = []) {
  if (!Array.isArray(badgeConfigs) || badgeConfigs.length === 0) return null;
  return [...badgeConfigs].sort((left, right) => {
    if (right.level !== left.level) return right.level - left.level;
    if (right.progress !== left.progress) return right.progress - left.progress;
    return right.detailProps?.xp - left.detailProps?.xp;
  })[0];
}

export function getActiveBadgeConfig(badgeConfigs = [], activeBadgeKey = null) {
  if (!Array.isArray(badgeConfigs) || badgeConfigs.length === 0) return null;
  if (activeBadgeKey) {
    const matchedBadge = badgeConfigs.find((badge) => badge.key === activeBadgeKey);
    if (matchedBadge) return matchedBadge;
  }
  return getFeaturedBadgeConfig(badgeConfigs) || badgeConfigs[0] || null;
}