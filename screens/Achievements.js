import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import FitnessBadgeCard from '../components/Achievements/FitnessBadgeCard.native';
import BackButton from '../components/BackButton';

function AchievementsScreen() {
  const user = useSelector((s) => s.user || {});
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((s) => s.workouts?.sessionsByDate || {});

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Lifetime and period aggregates
  const lifetimeSteps = useMemo(() => {
    return Object.values(stepsByDate).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [stepsByDate]);

  const todaySteps = stepsByDate[todayKey] || 0;
  const todaySessions = sessionsByDate[todayKey] || [];
  const todayCalories = todaySessions.reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const maxCaloriesToday = todaySessions.reduce((m, s) => Math.max(m, Number(s.calories) || 0), 0);

  const maxCaloriesAllTime = useMemo(() => {
    let maxC = 0;
    for (const key of Object.keys(sessionsByDate)) {
      const list = sessionsByDate[key] || [];
      for (const s of list) maxC = Math.max(maxC, Number(s.calories) || 0);
    }
    return maxC;
  }, [sessionsByDate]);

  // Simple rank from level
  const rank = useMemo(() => {
    const lvl = Number(user.level || 1);
    if (lvl >= 20) return 'S';
    if (lvl >= 15) return 'A';
    if (lvl >= 10) return 'B';
    if (lvl >= 5) return 'C';
    return 'D';
  }, [user.level]);

  // Compute week aggregates (last 7 days including today)
  const { weekSessions, weekCalories, weekSteps } = useMemo(() => {
    const res = { weekSessions: 0, weekCalories: 0, weekSteps: 0 };
    const base = new Date(todayKey);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = sessionsByDate[key] || [];
      res.weekSessions += list.length;
      res.weekCalories += list.reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
      res.weekSteps += Number(stepsByDate[key] || 0);
    }
    return res;
  }, [sessionsByDate, stepsByDate, todayKey]);

  // Running distance (km) derived from running sessions. If a session provides
  // distanceKm or distance (km), use it; otherwise estimate from duration.
  const estimateKmFromSession = (s) => {
    const dist = Number(s.distanceKm ?? s.distance);
    if (Number.isFinite(dist) && dist > 0) return dist;
    const dur = Number(s.durationMin);
    if (!Number.isFinite(dur) || dur <= 0) return 0;
    // Conservative average running speed ~8.0 km/h
    return (8.0 * dur) / 60;
  };

  const isRun = (s) => {
    const t = (s.type || '').toString().toLowerCase();
    return t.includes('run');
  };

  const lifetimeRunningKm = useMemo(() => {
    let total = 0;
    for (const key of Object.keys(sessionsByDate)) {
      const list = sessionsByDate[key] || [];
      for (const s of list) if (isRun(s)) total += estimateKmFromSession(s);
    }
    return Math.round(total * 100) / 100;
  }, [sessionsByDate]);

  const weekRunningKm = useMemo(() => {
    let total = 0;
    const base = new Date(todayKey);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = sessionsByDate[key] || [];
      for (const s of list) if (isRun(s)) total += estimateKmFromSession(s);
    }
    return Math.round(total * 100) / 100;
  }, [sessionsByDate, todayKey]);

  const { monthSessions, monthCalories } = useMemo(() => {
    const res = { monthSessions: 0, monthCalories: 0 };
    const base = new Date(todayKey);
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = sessionsByDate[key] || [];
      res.monthSessions += list.length;
      res.monthCalories += list.reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
    }
    return res;
  }, [sessionsByDate, todayKey]);

  // Derive strength-focus stats for mass builder and fat-loss estimates for weight cutter (simple heuristics)
  const { monthStrengthSessions, estWeightGainedKg, estMusclePct, estWeightLostKg, estBodyFatReducedPct } = useMemo(() => {
    let strength = 0;
    const base = new Date(todayKey);
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = sessionsByDate[key] || [];
      for (const s of list) {
        const t = (s.type || '').toString().toLowerCase();
        if (t.includes('strength') || t.includes('weight') || t.includes('resistance')) strength += 1;
      }
    }
    // Heuristic: ~0.1 kg lean mass per strength session (very rough, capped)
    const estGain = Math.min(15, Math.round(strength * 0.1 * 10) / 10);
    const estMuscle = Math.min(15, Math.round(strength * 0.2 * 10) / 10);
    // Fat loss: ~7700 kcal per kg
    const lostKg = Math.round((monthCalories / 7700) * 10) / 10;
    const fatPct = Math.min(20, Math.round(lostKg * 0.8 * 10) / 10);
    return { monthStrengthSessions: strength, estWeightGainedKg: estGain, estMusclePct: estMuscle, estWeightLostKg: lostKg, estBodyFatReducedPct: fatPct };
  }, [sessionsByDate, monthCalories, todayKey]);

  // Lifetime aggregates for sessions and calories (for Cardio Master)
  const { lifetimeSessions, lifetimeCalories } = useMemo(() => {
    let ls = 0; let lc = 0;
    for (const key of Object.keys(sessionsByDate)) {
      const list = sessionsByDate[key] || [];
      ls += list.length;
      lc += list.reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
    }
    return { lifetimeSessions: ls, lifetimeCalories: lc };
  }, [sessionsByDate]);

  // Map current metrics to badge achievements the card understands
  const runnerAchievements = useMemo(() => {
    const arr = [];
    if (lifetimeRunningKm >= 10) arr.push('runner-10k');
    if (lifetimeRunningKm >= 50) arr.push('runner-50k');
    if (lifetimeRunningKm >= 200) arr.push('runner-200k');
    if (weekRunningKm >= 20) arr.push('weekly-run-20');
    if ((user.streakCount || 0) >= 7) arr.push('streak-7');
    if ((user.streakCount || 0) >= 30) arr.push('streak-30');
    return arr;
  }, [lifetimeRunningKm, weekRunningKm, user.streakCount]);

  const warriorAchievements = useMemo(() => {
    const arr = [];
    if (weekSessions >= 5) arr.push('weekly-5');
    if (weekSessions >= 10) arr.push('weekly-10');
    if (monthSessions >= 20) arr.push('monthly-20');
    if (maxCaloriesAllTime >= 600) arr.push('calorie-600');
    if ((user.streakCount || 0) >= 7) arr.push('streak-7');
    if ((user.streakCount || 0) >= 30) arr.push('streak-30');
    return arr;
  }, [weekSessions, monthSessions, maxCaloriesAllTime, user.streakCount]);

  // Additional pools for new cards
  const cardioAchievements = useMemo(() => {
    const arr = [];
    if (weekSessions >= 5) arr.push('weekly-5');
    if (weekSessions >= 10) arr.push('weekly-10');
    if (monthSessions >= 20) arr.push('monthly-20');
    if (maxCaloriesAllTime >= 600) arr.push('calorie-600');
    if ((user.streakCount || 0) >= 7) arr.push('streak-7');
    if ((user.streakCount || 0) >= 30) arr.push('streak-30');
    return arr;
  }, [weekSessions, monthSessions, maxCaloriesAllTime, user.streakCount]);

  const walkerAchievements = useMemo(() => {
    const arr = [];
    if (lifetimeSteps >= 50000) arr.push('walker-50k');
    if (lifetimeSteps >= 200000) arr.push('walker-200k');
    if (lifetimeSteps >= 1000000) arr.push('walker-1m');
    if ((user.streakCount || 0) >= 7) arr.push('streak-7');
    if ((user.streakCount || 0) >= 30) arr.push('streak-30');
    return arr;
  }, [lifetimeSteps, user.streakCount]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />
      <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
        <Text style={styles.header}>Achievements</Text>
        <Text style={styles.subtitle}>Collect badges as you progress</Text>
      </LinearGradient>
      <View style={styles.badgeGallery}>
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Elite Runner"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={lifetimeRunningKm}
          primaryStatLabel="Running Distance (km)"
          secondaryStat={weekRunningKm}
          secondaryStatLabel="Running (7d km)"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={runnerAchievements}
          glowColor="cyan"
        />
        </View>
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Iron Warrior"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={weekSessions}
          primaryStatLabel="Sessions (7d)"
          secondaryStat={Math.round(weekCalories / Math.max(1, weekSessions))}
          secondaryStatLabel="Avg Cals/Session"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={warriorAchievements}
          glowColor="red"
        />
        </View>
        {/* New: Workout Killer */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Gym Destroyer"
          typeLabel="WORKOUT KILLER"
          typeIconName="dumbbell"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={lifetimeSessions}
          primaryStatLabel="Workouts"
          secondaryStat={Math.round(monthCalories / 30)}
          secondaryStatLabel="Calories/Day"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={warriorAchievements}
          glowColor="orange"
        />
        </View>
        {/* New: Cardio Master */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Heart Champion"
          typeLabel="CARDIO"
          typeIconName="heart-pulse"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={lifetimeSessions}
          primaryStatLabel="Sessions"
          secondaryStat={Math.round(lifetimeCalories / Math.max(1, lifetimeSessions))}
          secondaryStatLabel="Avg Cals/Session"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={cardioAchievements}
          glowColor="magenta"
        />
        </View>
        {/* New: Walker */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Step Master"
          typeLabel="WALKER"
          typeIconName="shoe-print"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={lifetimeSteps}
          primaryStatLabel="Steps"
          secondaryStat={Math.round(weekSteps / 7)}
          secondaryStatLabel="Daily Avg"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={walkerAchievements}
          glowColor="purple"
        />
        </View>
        {/* New: On Diet */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Nutrition Pro"
          typeLabel="ON DIET"
          typeIconName="food-apple"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={0}
          primaryStatLabel="Clean Days"
          secondaryStat={1800}
          secondaryStatLabel="Cal Target"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={[]}
          glowColor="green"
        />
        </View>
        {/* New: Mass Builder */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Bulk Champion"
          typeLabel="MASS BUILDER"
          typeIconName="weight-lifter"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={estWeightGainedKg}
          primaryStatLabel="Weight Gained (kg)"
          secondaryStat={estMusclePct}
          secondaryStatLabel="Muscle Mass (%)"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={warriorAchievements}
          glowColor="blue"
        />
        </View>
        {/* New: Weight Cutter */}
        <View style={styles.gridItem}>
        <FitnessBadgeCard
          level={user.level ?? 1}
          levelName="Shredder Pro"
          typeLabel="WEIGHT CUTTER"
          typeIconName="scale-bathroom"
          xp={user.points ?? 0}
          maxXp={user.pointsMax ?? 100}
          primaryStat={estWeightLostKg}
          primaryStatLabel="Weight Lost (kg)"
          secondaryStat={estBodyFatReducedPct}
          secondaryStatLabel="Body Fat Reduced (%)"
          rank={rank}
          streak={user.streakCount ?? 0}
          achievements={cardioAchievements}
          glowColor="green"
        />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#05020B',
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerCard: {
    width: '100%',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    alignItems: 'center',
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textShadowColor: 'rgba(0,231,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  badgeGallery: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 12,
    marginBottom: 2,
    gap: 10,
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
  },
  badgeItem: {
    backgroundColor: 'rgba(0,231,255,0.18)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 2,
    shadowColor: '#00E7FF',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.35)',
  },
  badgeIcon: {
    fontSize: 28,
    color: '#00E7FF',
    textShadowColor: '#6A00FF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  achievementsList: {
    width: '100%',
    marginTop: 8,
  },
  achievement: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#00E7FF',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(0,231,255,0.35)',
  },
  achieved: {
    borderColor: '#00E7FF',
    shadowOpacity: 0.35,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    fontSize: 28,
    marginRight: 8,
    color: '#00E7FF',
    textShadowColor: '#6A00FF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,231,255,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    fontSize: 15,
    color: '#E8F9FF',
    marginVertical: 2,
    fontWeight: '500',
  },
  status: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '700',
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
  },
  statusAchieved: {
    backgroundColor: 'rgba(0,231,255,0.18)',
    color: '#00E7FF',
  },
  statusLocked: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#888',
  },
});

export default AchievementsScreen;
