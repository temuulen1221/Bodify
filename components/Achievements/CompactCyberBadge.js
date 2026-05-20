import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

export const compactBadgePalette = {
  cyan: { color: '#10D9FF', glow: 'rgba(16,217,255,0.42)' },
  red: { color: '#FF5A67', glow: 'rgba(255,90,103,0.35)' },
  orange: { color: '#FF9A1F', glow: 'rgba(255,154,31,0.35)' },
  magenta: { color: '#F26CFF', glow: 'rgba(242,108,255,0.34)' },
  purple: { color: '#B86CFF', glow: 'rgba(184,108,255,0.34)' },
  green: { color: '#14E7A8', glow: 'rgba(20,231,168,0.32)' },
  blue: { color: '#7C86FF', glow: 'rgba(124,134,255,0.34)' },
  teal: { color: '#14E7D7', glow: 'rgba(20,231,215,0.32)' },
};

export default function CompactCyberBadge({ iconName, label, level, rank, progress, tone = 'cyan', size = 76, selected = false }) {
  const palette = compactBadgePalette[tone] || compactBadgePalette.cyan;
  const ringSize = Math.max(42, size - 18);
  const panelSize = Math.max(28, size - 36);

  return (
    <View style={[styles.compactBadgeWrap, { width: size }]}> 
      <View
        style={[
          styles.compactBadgeShadow,
          selected && styles.compactBadgeShadowSelected,
          { width: size, height: size, backgroundColor: selected ? palette.glow : 'transparent' },
        ]}
      />
      {selected ? <View style={[styles.compactBadgeHalo, { width: size + 20, height: size + 20, borderColor: `${palette.color}45`, backgroundColor: palette.glow }]} /> : null}
      <LinearGradient
        colors={['#121B2F', '#192338', '#141A2A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.compactBadgeCard,
          selected && styles.compactBadgeCardSelected,
          {
            width: size,
            height: size,
            borderColor: palette.color,
            backgroundColor: selected ? `${palette.color}18` : undefined,
          },
        ]}
      >
        <View style={[styles.compactBadgeCorner, styles.compactBadgeCornerTopLeft, { borderColor: palette.color }]} />
        <View style={[styles.compactBadgeCorner, styles.compactBadgeCornerBottomRight, { borderColor: palette.color }]} />
        <View style={[styles.compactBadgeRank, { borderColor: `${palette.color}90`, backgroundColor: `${palette.color}18` }]}>
          <Text style={[styles.compactBadgeRankText, { color: palette.color }]}>{rank}</Text>
        </View>
        <View style={[styles.compactBadgeRing, { width: ringSize, height: ringSize, borderColor: `${palette.color}D0` }]} />
        <View style={[styles.compactBadgeInnerRing, { width: ringSize - 16, height: ringSize - 16, borderColor: `${palette.color}35` }]} />
        <View style={[styles.compactBadgeCore, { width: panelSize, height: panelSize, borderColor: `${palette.color}AA`, backgroundColor: `${palette.color}12` }]}>
          <Icon name={iconName} size={size < 90 ? 18 : 22} color={palette.color} />
          <Text style={[styles.compactBadgeLevel, { color: palette.color }]}>{level}</Text>
        </View>
        <View style={[styles.compactBadgeProgress, { borderColor: `${palette.color}90`, backgroundColor: '#1C2135' }]}>
          <Icon name="flash" size={8} color={palette.color} />
          <Text style={[styles.compactBadgeProgressText, { color: palette.color }]}>{progress}%</Text>
        </View>
      </LinearGradient>
      <Text style={[styles.compactBadgeLabel, selected && styles.compactBadgeLabelSelected, selected && { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = {
  compactBadgeWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  compactBadgeShadow: {
    position: 'absolute',
    borderRadius: 18,
    opacity: 0.18,
  },
  compactBadgeShadowSelected: {
    opacity: 0.32,
  },
  compactBadgeHalo: {
    position: 'absolute',
    borderRadius: 26,
    borderWidth: 1,
  },
  compactBadgeCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBadgeCardSelected: {
    transform: [{ scale: 1.02 }],
  },
  compactBadgeCorner: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderWidth: 2,
  },
  compactBadgeCornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 18,
  },
  compactBadgeCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 18,
  },
  compactBadgeRank: {
    position: 'absolute',
    top: 1,
    right: 1,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 3,
  },
  compactBadgeRankText: {
    fontSize: 8,
    fontWeight: '900',
  },
  compactBadgeRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  compactBadgeInnerRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  compactBadgeCore: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    zIndex: 2,
  },
  compactBadgeLevel: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
  },
  compactBadgeProgress: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 3,
  },
  compactBadgeProgressText: {
    fontSize: 8,
    fontWeight: '800',
  },
  compactBadgeLabel: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 78,
  },
  compactBadgeLabelSelected: {
    fontWeight: '900',
  },
};