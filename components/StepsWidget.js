import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS, GRADIENTS } from '../utils/constants';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StepsWidget({ compact = true, style }) {
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const currentDay = todayKey();
  const totalSteps = Math.max(0, Number(stepsByDate[currentDay] || 0));

  if (Platform.OS === 'web') {
    return null; // Hide on web to avoid confusion
  }

  return (
    <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.pillOuter, style]}>
      <View style={styles.pillInner}>
        <Text style={styles.pillIcon}>👟</Text>
        <Text style={styles.pillText}>{totalSteps.toLocaleString()}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pillOuter: {
    borderRadius: 18,
    padding: 1,
    ...Platform.select({
      web: { boxShadow: `0px 2px 8px ${COLORS.neonPurple}40` },
      default: {
        ...require('../utils/shadow').makeShadow(COLORS.neonPurple, 0, 2, 8, 0.25),
        elevation: 3,
      },
    }),
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.5)'
  },
  pillIcon: { fontSize: 16, marginRight: 6, transform: [{ translateY: -2 }] },
  pillText: { fontSize: 15, fontWeight: 'bold', color: '#E8F9FF' },
});
