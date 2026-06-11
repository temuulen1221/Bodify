import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';

export default function BoosterIndicator() {
  const xpBoosters = useSelector((s: any) => s.user?.xpBoosters || []);
  const [timeRemaining, setTimeRemaining] = useState('');

  const activeBooster = useMemo(() => {
    const now = Date.now();
    const active = (Array.isArray(xpBoosters) ? xpBoosters : []).find(
      (b: any) => b && (!b.expiresAt || now < b.expiresAt)
    );
    return active;
  }, [xpBoosters]);

  useEffect(() => {
    if (!activeBooster?.expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, activeBooster.expiresAt - now);
      
      if (remaining <= 0) {
        setTimeRemaining('');
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeRemaining(
        hours > 0
          ? `${hours}h ${minutes}m left`
          : minutes > 0
            ? `${minutes}m ${seconds}s left`
            : `${seconds}s left`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeBooster?.expiresAt]);

  if (!activeBooster) return null;

  const multiplierDisplay = activeBooster.multiplier ? `${activeBooster.multiplier.toFixed(2)}x` : '1.5x';
  const workoutsRemaining = activeBooster.remainingWorkouts || 0;

  return (
    <LinearGradient
      colors={['rgba(18,217,255,0.2)', 'rgba(127,0,255,0.1)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>⚡</Text>
        <View style={styles.textContainer}>
          <Text style={styles.multiplier}>{multiplierDisplay} XP</Text>
          <View style={styles.metaRow}>
            <Text style={styles.remaining}>{workoutsRemaining} workouts</Text>
            {timeRemaining && <Text style={styles.timer}>• {timeRemaining}</Text>}
          </View>
        </View>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: workoutsRemaining > 0 ? Math.min((workoutsRemaining / 5) * 100, 100) : 0 },
          ]}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  multiplier: {
    color: '#12D9FF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  remaining: {
    color: '#A7B5CD',
    fontSize: 11,
  },
  timer: {
    color: '#7287A9',
    fontSize: 11,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(18,217,255,0.1)',
    borderRadius: 1.5,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#12D9FF',
    borderRadius: 1.5,
  },
});
