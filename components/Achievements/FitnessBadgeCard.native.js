import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  'xp-100': { icon: 'star-four-points', name: '100 XP', color: '#FFE082' },
  'xp-500': { icon: 'star-circle', name: '500 XP', color: '#FFD54F' },
  'xp-1000': { icon: 'creation', name: '1K XP', color: '#FFCA28' },
  'xp-2500': { icon: 'trophy-award', name: '2.5K XP', color: '#FFB300' },
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
  xpDetailLabel,
  xpDetailValue,
  primaryHint,
  secondaryHint,
  containerStyle,
  compact = false,
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
  const accentGradientMap = {
    cyan: ['#22d3ee', '#4f46e5'],
    red: ['#fb7185', '#ef4444'],
    purple: ['#c084fc', '#7c3aed'],
    magenta: ['#f472b6', '#d946ef'],
    orange: ['#fb923c', '#f59e0b'],
    green: ['#4ade80', '#06b6d4'],
    blue: ['#60a5fa', '#2563eb'],
  };
  const accentGradient = accentGradientMap[glowColor] || ['#22d3ee', '#4f46e5'];
  const lower = levelName.toLowerCase();
  const isStrongman = lower.includes('iron warrior') || lower.includes('strongman');
  const resolvedTypeLabel = typeLabel || (isStrongman ? 'STRONGMAN' : 'RUNNER');
  const resolvedTypeIcon = typeIconName || (isStrongman ? 'weight-lifter' : 'run-fast');
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const safeMaxXp = Math.max(1, Math.floor(Number(maxXp) || 1));
  const progressPct = Math.max(0, Math.min(100, Math.round((safeXp / safeMaxXp) * 100)));
  const xpMetaValue = Number.isFinite(Number(xpDetailValue)) ? Number(xpDetailValue) : null;
  const achievementKeys = compact ? Object.keys(achievementIcons).slice(0, 10) : Object.keys(achievementIcons);
  return (
    <View style={[styles.cardShell, compact && styles.cardShellCompact, { shadowColor: mainColor }]}>  
      <LinearGradient
        colors={[`${mainColor}55`, '#232a4d', '#0A0915']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={[styles.cardFrame, { borderWidth: 2, borderColor: `${mainColor}AA` }]}
      >
        <LinearGradient
          colors={['#0A0915', '#181C2F', '#090C16']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.card, compact && styles.cardCompact, { borderColor: `${mainColor}B0`, borderWidth: 2, shadowColor: mainColor, shadowOpacity: 0.32, shadowRadius: 24, elevation: 12 }, containerStyle]}
        >
          <LinearGradient colors={[`${mainColor}33`, 'transparent']} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGlow} />
          <View style={[styles.cornerBracket, styles.cornerTopLeft, { borderColor: `${mainColor}E0` }]} />
          <View style={[styles.cornerBracket, styles.cornerBottomRight, { borderColor: `${mainColor}E0` }]} />
          {/* Animated scanline effect */}
          <View style={[styles.scanLine, { backgroundColor: `${mainColor}22`, height: 2, top: 48 }]} />
      <View style={[styles.codeRow, compact && styles.codeRowCompact]}>
        <Text style={[styles.codeText, compact && styles.metaTextCompact]}>XR-01</Text>
        <Text style={[styles.codeStatus, compact && styles.metaTextCompact, { color: mainColor }]}>ACTIVE</Text>
      </View>
      {/* Header: Level and Rank */}
      <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
        <View style={[styles.levelBadge, compact && styles.levelBadgeCompact, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name="trophy-outline" size={compact ? 18 : 24} color={mainColor} />
          <Text style={[styles.levelText, compact && styles.levelTextCompact, { color: mainColor }]}>LVL {level}</Text>
        </View>
        <View style={[styles.rankBadge, compact && styles.rankBadgeCompact, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Text style={[styles.rankText, compact && styles.rankTextCompact, { color: mainColor }]}>RANK {rank}</Text>
        </View>
      </View>
      {/* Type box */}
      <View style={[styles.runnerBox, compact && styles.runnerBoxCompact]}>
        <View style={[styles.runnerIconWrap, compact && styles.runnerIconWrapCompact, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: mainColor }]}>  
          <Icon name={resolvedTypeIcon} size={compact ? 18 : 22} color={mainColor} />
        </View>
        <LinearGradient colors={[`${mainColor}26`, 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.runnerPill}>
          <Text style={[styles.runnerText, compact && styles.runnerTextCompact, { color: mainColor }]}>{resolvedTypeLabel}</Text>
        </LinearGradient>
      </View>
      {/* Badge type and name */}
      <View style={[styles.typeRow, compact && styles.typeRowCompact]}>
        <Text style={[styles.levelName, compact && styles.levelNameCompact, { color: mainColor, fontWeight: 'bold' }]}>{levelName}</Text>
      </View>
      {/* XP Progress bar */}
      <View style={[styles.xpBarRow, compact && styles.xpBarRowCompact]}>
        <Text style={[styles.xpLabel, compact && styles.xpTextCompact]}>XP</Text>
        <Text style={[styles.xpValue, compact && styles.xpTextCompact]}>{safeXp.toLocaleString()} / {safeMaxXp.toLocaleString()}</Text>
      </View>
      <View style={[styles.xpBarBg, compact && styles.xpBarBgCompact]}>
        <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.xpBarFill, { width: `${progressPct}%` }]} />
      </View>
      {xpDetailLabel && xpMetaValue !== null ? (
        <View style={[styles.xpMetaRow, compact && styles.xpMetaRowCompact, { borderColor: `${mainColor}40` }]}>
          <Text style={[styles.xpMetaLabel, compact && styles.metaTextCompact]}>{xpDetailLabel}</Text>
          <Text style={[styles.xpMetaValue, compact && styles.metaTextCompact, { color: mainColor }]}>{Math.floor(xpMetaValue).toLocaleString()} XP</Text>
        </View>
      ) : null}
      {/* Streak */}
      <View style={[styles.streakRow, compact && styles.streakRowCompact, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
        <Icon name="fire" size={compact ? 16 : 20} color="#FF9800" />
        <Text style={[styles.streakLabel, compact && styles.metaTextCompact]}>Streak</Text>
        <Text style={[styles.streakValue, compact && styles.metaTextCompact, { color: '#FF9800', fontWeight: 'bold' }]}>{streak} Days</Text>
        <Text style={[styles.streakXP, compact && styles.metaTextCompact, { color: mainColor }]}>+{streak * 10} XP</Text>
      </View>
      {/* Stats */}
      <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
        <View style={[styles.statBox, compact && styles.statBoxCompact, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name={isStrongman ? 'arm-flex' : 'target'} size={compact ? 15 : 18} color={mainColor} />
          <Text style={[styles.statLabel, compact && styles.metaTextCompact]}>{primaryStatLabel}</Text>
          <Text style={[styles.statValue, compact && styles.statValueCompact, { color: mainColor, fontWeight: 'bold' }]}>{primaryStat.toLocaleString()}</Text>
          {primaryHint ? <Text style={[styles.statHint, compact && styles.statHintCompact, { color: mainColor }]}>{primaryHint}</Text> : null}
        </View>
        <View style={[styles.statBox, compact && styles.statBoxCompact, { backgroundColor: '#18181b', borderColor: mainColor }]}>  
          <Icon name={isStrongman ? 'numeric' : 'flash'} size={compact ? 15 : 18} color={mainColor} />
          <Text style={[styles.statLabel, compact && styles.metaTextCompact]}>{secondaryStatLabel}</Text>
          <Text style={[styles.statValue, compact && styles.statValueCompact, { color: mainColor, fontWeight: 'bold' }]}>{secondaryStat.toLocaleString()}</Text>
          {secondaryHint ? <Text style={[styles.statHint, compact && styles.statHintCompact, { color: mainColor }]}>{secondaryHint}</Text> : null}
        </View>
      </View>
      {/* Achievements */}
      <View style={[styles.achievementsHeader, compact && styles.achievementsHeaderCompact]}>
        <Icon name="medal" size={compact ? 15 : 18} color={mainColor} />
        <Text style={[styles.achievementsLabel, compact && styles.metaTextCompact]}>Achievements</Text>
        <Text style={[styles.achievementsCount, compact && styles.metaTextCompact, { color: mainColor }]}>
          {achievements.length}/{Object.keys(achievementIcons).length}
        </Text>
      </View>
      <View style={[styles.achievementsList, compact && styles.achievementsListCompact]}>
        {achievementKeys.map((key) => (
          <View style={[
            styles.achievementItem,
            compact && styles.achievementItemCompact,
            achievements.includes(key) && { borderColor: `${achievementIcons[key].color}55`, backgroundColor: 'rgba(255,255,255,0.06)' },
          ]} key={key}>
            <Icon name={achievementIcons[key].icon} size={compact ? 14 : 16} color={achievements.includes(key) ? achievementIcons[key].color : '#444'} />
          </View>
        ))}
      </View>
      {/* Next Level Bar */}
      <View style={[styles.nextLevelWrap, compact && styles.nextLevelWrapCompact]}>
        <Text style={[styles.nextLevelText, compact && styles.metaTextCompact, { color: mainColor }]}>Next Level</Text>
        <View style={[styles.xpBarBg, compact && styles.xpBarBgCompact, { backgroundColor: '#18181b', borderColor: mainColor, borderWidth: 1 }]}> 
          <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.xpBarFill, { width: `${progressPct}%` }]} />
        </View>
      </View>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    width: '100%',
    borderRadius: 26,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  cardShellCompact: {
    borderRadius: 20,
  },
  cardFrame: {
    borderRadius: 26,
    padding: 1,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    margin: 0,
    padding: 14,
    borderRadius: 25,
    borderWidth: 1,
    backgroundColor: '#18181b',
    overflow: 'hidden',
  },
  cardCompact: {
    maxWidth: 344,
    padding: 8,
    borderRadius: 17,
  },
  cardGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  scanLine: {
    position: 'absolute',
    top: 52,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#22d3ee',
  },
  cornerTopLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  cornerBottomRight: {
    right: 12,
    bottom: 12,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeRowCompact: {
    marginBottom: 6,
  },
  codeText: {
    color: '#8399C9',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  codeStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 2,
  },
  headerRowCompact: {
    marginBottom: 2,
    marginTop: 0,
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
    alignSelf: 'flex-start',
    marginBottom: 6,
    marginTop: 1,
  },
  runnerBoxCompact: {
    marginBottom: 1,
  },
  runnerIconWrap: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 6,
    marginRight: 4,
  },
  runnerIconWrapCompact: {
    borderRadius: 9,
    padding: 3,
  },
  runnerPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  runnerText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  runnerTextCompact: {
    fontSize: 10,
    letterSpacing: 0.4,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 4,
  },
  levelBadgeCompact: {
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  levelTextCompact: {
    fontSize: 11,
    marginLeft: 3,
  },
  rankBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rankBadgeCompact: {
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rankTextCompact: {
    fontSize: 11,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    zIndex: 2,
  },
  typeRowCompact: {
    marginBottom: 0,
  },
  typeText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 8
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  levelNameCompact: {
    fontSize: 15,
    marginBottom: 1,
  },
  xpBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 1,
  },
  xpBarRowCompact: {
    marginTop: 2,
  },
  xpLabel: {
    color: '#8FA7C9',
    fontSize: 12,
    fontWeight: '700',
  },
  xpValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  xpTextCompact: {
    fontSize: 10,
  },
  xpBarBg: {
    height: 8,
    backgroundColor: '#131728',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  xpBarBgCompact: {
    height: 6,
    marginBottom: 2,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  xpMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  xpMetaRowCompact: {
    marginBottom: 5,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  xpMetaLabel: {
    color: '#8FA7C9',
    fontSize: 11,
    fontWeight: '700',
  },
  xpMetaValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  streakRowCompact: {
    borderRadius: 10,
    padding: 5,
    marginBottom: 5,
  },
  streakLabel: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 6,
  },
  streakValue: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  streakXP: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 'auto',
  },
  metaTextCompact: {
    fontSize: 9,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  statsRowCompact: {
    gap: 5,
    marginBottom: 5,
  },
  statBox: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statBoxCompact: {
    minHeight: 64,
    borderRadius: 10,
    padding: 5,
  },
  statLabel: {
    color: '#9CB1D5',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 21,
    fontWeight: 'bold',
  },
  statValueCompact: {
    fontSize: 13,
  },
  statHint: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
    textAlign: 'center',
  },
  statHintCompact: {
    fontSize: 8,
    marginTop: 1,
  },
  achievementsBtn: {
    marginTop: 4,
    marginBottom: 1
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achievementsHeaderCompact: {
    marginTop: 1,
  },
  achievementsLabel: {
    color: '#AAB7D0',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '700',
  },
  achievementsCount: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  achievementsList: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achievementsListCompact: {
    marginTop: 5,
    gap: 4,
  },
  achievementItem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  achievementItemCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    marginLeft: 6,
  },
  nextLevelWrap: {
    marginTop: 8,
  },
  nextLevelWrapCompact: {
    marginTop: 4,
  },
  nextLevelText: {
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
});
