import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const glowStyles = {
  cyan: {
    borderColor: '#22d3ee',
    shadowColor: '#22d3ee',
    backgroundColor: 'rgba(34,211,238,0.08)',
    textColor: '#22d3ee',
  },
  magenta: {
    borderColor: '#e879f9',
    shadowColor: '#e879f9',
    backgroundColor: 'rgba(232,121,249,0.08)',
    textColor: '#e879f9',
  },
  purple: {
    borderColor: '#c084fc',
    shadowColor: '#c084fc',
    backgroundColor: 'rgba(192,132,252,0.08)',
    textColor: '#c084fc',
  },
  green: {
    borderColor: '#34d399',
    shadowColor: '#34d399',
    backgroundColor: 'rgba(52,211,153,0.08)',
    textColor: '#34d399',
  },
  orange: {
    borderColor: '#fb923c',
    shadowColor: '#fb923c',
    backgroundColor: 'rgba(251,146,60,0.08)',
    textColor: '#fb923c',
  },
};

export default function RunnerBadgeCompact({
  level,
  rank,
  xp,
  maxXp,
  glowColor = 'cyan',
}) {
  const xpPercentage = (xp / maxXp) * 100;
  const colors = glowStyles[glowColor];

  return (
    <View style={[styles.container, { borderColor: colors.borderColor, shadowColor: colors.shadowColor, backgroundColor: colors.backgroundColor }]}>  
      {/* SVG Circuit Pattern */}
      <Svg style={styles.circuit} width={100} height={100}>
        <Circle cx={50} cy={50} r={35} stroke={colors.textColor} strokeWidth={0.5} fill="none" />
        <Circle cx={50} cy={50} r={25} stroke={colors.textColor} strokeWidth={0.5} fill="none" />
        <Line x1={50} y1={15} x2={50} y2={85} stroke={colors.textColor} strokeWidth={0.5} />
        <Line x1={15} y1={50} x2={85} y2={50} stroke={colors.textColor} strokeWidth={0.5} />
      </Svg>
      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>  
        <Text style={[styles.rankText, { color: colors.textColor }]}>{rank}</Text>
      </View>
      {/* Level icon and number */}
      <View style={[styles.levelBadge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>  
        <MaterialCommunityIcons name="trophy-outline" size={24} color={colors.textColor} />
        <Text style={[styles.levelText, { color: colors.textColor }]}>{level}</Text>
      </View>
      {/* XP Progress ring */}
      <Svg style={styles.progressRing} width={100} height={100}>
        <Circle cx={50} cy={50} r={45} stroke="rgba(71,85,105,0.3)" strokeWidth={3} fill="none" />
        <Circle
          cx={50}
          cy={50}
          r={45}
          stroke={colors.textColor}
          strokeWidth={3}
          fill="none"
          strokeDasharray={2 * Math.PI * 45}
          strokeDashoffset={2 * Math.PI * 45 * (1 - xpPercentage / 100)}
        />
      </Svg>
      {/* XP indicator */}
      <View style={[styles.xpIndicator, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>  
        <MaterialCommunityIcons name="lightning-bolt-outline" size={12} color={colors.textColor} />
        <Text style={[styles.xpText, { color: colors.textColor }]}>{Math.round(xpPercentage)}%</Text>
      </View>
      {/* Corner accents */}
      <View style={[styles.cornerTL, { borderColor: colors.borderColor }]} />
      <View style={[styles.cornerBR, { borderColor: colors.borderColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  circuit: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  rankText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  levelBadge: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    zIndex: 2,
  },
  levelText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  xpIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 50,
    transform: [{ translateX: -25 }],
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  xpText: {
    fontSize: 10,
    marginLeft: 2,
    fontWeight: 'bold',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRadius: 6,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderRadius: 6,
  },
});
