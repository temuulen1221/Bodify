import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const achievementIcons = {
  // Legacy daily-oriented examples
  'speed-demon': { icon: 'flash', name: 'Speed Demon', color: '#FFD600' },
  'distance-master': { icon: 'target', name: 'Distance Master', color: '#2196F3' },
  'early-bird': { icon: 'star', name: 'Early Bird', color: '#FF9800' },
  'night-owl': { icon: 'crown', name: 'Night Owl', color: '#9C27B0' },
  'marathon': { icon: 'medal', name: 'Marathon', color: '#4CAF50' },
  // Harder, multi-day / cumulative goals
  'walker-50k': { icon: 'shoe-print', name: 'Walker 50K', color: '#00BCD4' },
  'walker-200k': { icon: 'shoe-print', name: 'Walker 200K', color: '#00ACC1' },
  'walker-1m': { icon: 'shoe-print', name: 'Walker 1M', color: '#00838F' },
  'streak-7': { icon: 'calendar-star', name: '7-Day Streak', color: '#FF5722' },
  'streak-30': { icon: 'calendar-star', name: '30-Day Streak', color: '#F44336' },
  'weekly-5': { icon: 'calendar-week', name: 'Weekly 5 Sessions', color: '#8BC34A' },
  'weekly-10': { icon: 'calendar-week', name: 'Weekly 10 Sessions', color: '#4CAF50' },
  'monthly-20': { icon: 'calendar-month', name: 'Monthly 20 Sessions', color: '#3F51B5' },
  'calorie-600': { icon: 'fire', name: '600+ Cal Session', color: '#E91E63' },
  // Running distance-based achievements (km)
  'runner-10k': { icon: 'run-fast', name: 'Runner 10K', color: '#00E676' },
  'runner-50k': { icon: 'run-fast', name: 'Runner 50K', color: '#1DE9B6' },
  'runner-200k': { icon: 'run-fast', name: 'Runner 200K', color: '#00BFA5' },
  'weekly-run-20': { icon: 'run', name: 'Weekly 20km', color: '#00BCD4' },
};

// native card: no glowStyles needed here

export default function FitnessBadgeCard({
  level = 12,
  levelName = 'Elite Runner',
  xp = 2840,
  maxXp = 3000,
  primaryStat = 150,
  primaryStatLabel = 'Distance (km)',
  secondaryStat = 8.5,
  secondaryStatLabel = 'Speed (km/h)',
  rank = 'A+',
  streak = 15,
  achievements = ['speed-demon', 'distance-master', 'early-bird'],
  glowColor = 'cyan',
  // Optional overrides for the small type pill in the header row
  typeLabel,
  typeIconName,
}) {
  // removed unused local state and helpers (kept minimal for native card variant)

  // Dynamic color and icon selection
  const colorMap = {
    cyan: '#22d3ee',
    red: '#FF3B3B',
    purple: '#c084fc',
    magenta: '#e879f9',
    orange: '#FF9800',
    green: '#22c55e',
    blue: '#60a5fa',
  };
  const mainColor = colorMap[glowColor] || '#22d3ee';
  const lower = levelName.toLowerCase();
  const isStrongman = lower.includes('iron warrior') || lower.includes('strongman');
  const resolvedTypeLabel = typeLabel || (isStrongman ? 'STRONGMAN' : 'RUNNER');
  const resolvedTypeIcon = typeIconName || (isStrongman ? 'weight-lifter' : 'run-fast');
  return (
    <View style={[styles.card, { borderColor: mainColor, shadowColor: mainColor, backgroundColor: '#18181b' }]}>  
      {/* Header: Level and Rank */}
      <View style={styles.headerRow}>
        <View style={[styles.levelBadge, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name="trophy-outline" size={24} color={mainColor} />
          <Text style={[styles.levelText, { color: mainColor }]}>LVL {level}</Text>
        </View>
        <View style={[styles.rankBadge, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Text style={[styles.rankText, { color: mainColor }]}>RANK {rank}</Text>
        </View>
      </View>
      {/* Type box */}
      <View style={styles.runnerBox}>
        <View style={[styles.runnerIconWrap, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name={resolvedTypeIcon} size={22} color={mainColor} />
        </View>
        <Text style={[styles.runnerText, { color: mainColor }]}>{resolvedTypeLabel}</Text>
      </View>
      {/* Badge type and name */}
      <View style={styles.typeRow}>
        <Text style={[styles.levelName, { color: mainColor, fontWeight: 'bold' }]}>{levelName}</Text>
      </View>
      {/* XP Progress bar */}
      <View style={styles.xpBarRow}>
        <Text style={styles.xpLabel}>XP</Text>
        <Text style={styles.xpValue}>{xp.toLocaleString()} / {maxXp.toLocaleString()}</Text>
      </View>
      <View style={styles.xpBarBg}>
        <View style={[styles.xpBarFill, { width: `${Math.round((xp / maxXp) * 100)}%`, backgroundColor: mainColor }]} />
      </View>
      {/* Streak */}
      <View style={[styles.streakRow, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
        <Icon name="fire" size={20} color="#FF9800" />
        <Text style={styles.streakLabel}>Streak</Text>
        <Text style={[styles.streakValue, { color: '#FF9800', fontWeight: 'bold' }]}>{streak} Days</Text>
        <Text style={[styles.streakXP, { color: mainColor }]}>+{streak * 10} XP</Text>
      </View>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name={isStrongman ? 'arm-flex' : 'target'} size={18} color={mainColor} />
          <Text style={styles.statLabel}>{primaryStatLabel}</Text>
          <Text style={[styles.statValue, { color: mainColor, fontWeight: 'bold' }]}>{primaryStat.toLocaleString()}</Text>
          <Text style={{ color: mainColor, fontSize: 12, marginTop: 2 }}>+{isStrongman ? 1250 : 75} XP</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name={isStrongman ? 'numeric' : 'flash'} size={18} color={mainColor} />
          <Text style={styles.statLabel}>{secondaryStatLabel}</Text>
          <Text style={[styles.statValue, { color: mainColor, fontWeight: 'bold' }]}>{secondaryStat.toLocaleString()}</Text>
          <Text style={{ color: mainColor, fontSize: 12, marginTop: 2 }}>+{isStrongman ? 850 : 85} XP</Text>
        </View>
      </View>
      {/* Achievements */}
      <View style={styles.achievementsHeader}>
        <Icon name="medal" size={18} color={mainColor} />
        <Text style={styles.achievementsLabel}>Achievements</Text>
        <Text style={[styles.achievementsCount, { color: mainColor }]}>
          {achievements.length}/{Object.keys(achievementIcons).length}
        </Text>
      </View>
      <View style={styles.achievementsList}>
        {Object.keys(achievementIcons).map((key, idx) => (
          <View style={styles.achievementItem} key={key}>
            <Icon name={achievementIcons[key].icon} size={16} color={achievements.includes(key) ? achievementIcons[key].color : '#444'} />
          </View>
        ))}
      </View>
      {/* Next Level Bar */}
      <View style={{ marginTop: 8 }}>
        <Text style={{ color: mainColor, fontWeight: 'bold', marginBottom: 2 }}>Next Level</Text>
        <View style={[styles.xpBarBg, { backgroundColor: '#18181b', borderColor: mainColor, borderWidth: 1 }]}> 
          <View style={[styles.xpBarFill, { width: `${Math.round((xp / maxXp) * 100)}%`, backgroundColor: mainColor }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    alignSelf: 'center',
    margin: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#18181b',
    shadowColor: '#6A00FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 2,
  },
  hexBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  runnerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 4,
    marginTop: 1
  },
  runnerIconWrap: {
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 4,
    marginRight: 4,
    shadowColor: '#6A00FF',
    shadowOpacity: 0.12,
    shadowRadius: 4
  },
  runnerText: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: '#6A00FF',
    textShadowRadius: 4
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    marginRight: 4
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6
  },
  rankBadge: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 4
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    zIndex: 2
  },
  typeText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 8
  },
  levelName: {
    fontSize: 15,
    fontWeight: '600'
  },
  xpBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 1
  },
  xpLabel: {
    color: '#aaa',
    fontSize: 13
  },
  xpValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  xpBarBg: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4
  },
  xpBarFill: {
    height: 6,
    borderRadius: 4
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    marginBottom: 4
  },
  streakLabel: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 6
  },
  streakValue: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6
  },
  streakXP: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 'auto'
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  statBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    marginHorizontal: 2,
    alignItems: 'center'
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 2
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  achievementsBtn: {
    marginTop: 4,
    marginBottom: 1
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  achievementsLabel: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 6
  },
  achievementsCount: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6
  },
  achievementsList: {
    marginTop: 2
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1
  },
  achievementName: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
    flex: 1
  },
  achievementXP: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 6
  }
});
