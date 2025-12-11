import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Pedometer } from 'expo-sensors';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { currentUserId, db } from '../services/firebase';
import { setStepsForDate } from '../store';
import { COLORS, GRADIENTS } from '../utils/constants';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function StepsWidget({ compact = true, style }) {
  const dispatch = useDispatch();
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const [isAvailable, setIsAvailable] = useState(false);
  const [baseTodaySteps, setBaseTodaySteps] = useState(0);
  const [liveSteps, setLiveSteps] = useState(0);
  const [currentDay, setCurrentDay] = useState(todayKey());
  const currentDayRef = useRef(currentDay);
  const watchRef = useRef(null);

  const totalSteps = Math.max(0, (stepsByDate[currentDay] ?? (baseTodaySteps + liveSteps)));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (Platform.OS === 'web') {
        setIsAvailable(false);
        return;
      }
      try {
        const avail = await Pedometer.isAvailableAsync();
        if (!mounted) return;
        setIsAvailable(!!avail);
        if (!avail) return;

        // Load today's steps so far
        try {
          const count = await Pedometer.getStepCountAsync(startOfToday(), new Date());
          if (!mounted) return;
          const base = count?.steps ?? 0;
          setBaseTodaySteps(base);
          dispatch(setStepsForDate({ date: todayKey(), steps: base }));
        } catch (_e) {
          // Some devices may not support historical query; fall back to 0
          setBaseTodaySteps(0);
        }

        // Start live watcher
        try {
          watchRef.current = Pedometer.watchStepCount((result) => {
            // result.steps is since subscription start
            setLiveSteps(result.steps || 0);
          });
        } catch (_e) {
          // ignore
        }
      } catch (_e) {
        setIsAvailable(false);
      }
    })();

    // Day rollover check every ~60s
    const dayTimer = setInterval(async () => {
      const key = todayKey();
      if (key !== currentDayRef.current) {
        currentDayRef.current = key;
        setCurrentDay(key);
        setLiveSteps(0);
        try {
          const count = await Pedometer.getStepCountAsync(startOfToday(), new Date());
          const base = count?.steps ?? 0;
          setBaseTodaySteps(base);
          dispatch(setStepsForDate({ date: key, steps: base }));
        } catch (_e) {
          setBaseTodaySteps(0);
          dispatch(setStepsForDate({ date: key, steps: 0 }));
        }
      }
    }, 60 * 1000);

    return () => {
      mounted = false;
      try { watchRef.current && watchRef.current.remove && watchRef.current.remove(); } catch {}
      clearInterval(dayTimer);
    };
  }, [dispatch]);

  // Keep ref in sync when state changes
  useEffect(() => {
    currentDayRef.current = currentDay;
  }, [currentDay]);

  // Pick up background-updated step counts from AsyncStorage (if a background task ran)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = todayKey();
        const raw = await AsyncStorage.getItem(`steps:${key}`);
        const fromBg = raw != null ? Number(raw) : NaN;
        if (mounted && Number.isFinite(fromBg) && fromBg > 0) {
          setBaseTodaySteps(fromBg); // align baseline to the latest known value
          setLiveSteps(0);
          dispatch(setStepsForDate({ date: key, steps: fromBg }));
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Push updates to Redux when total changes
  useEffect(() => {
    const key = todayKey();
    dispatch(setStepsForDate({ date: key, steps: baseTodaySteps + liveSteps }));
  }, [baseTodaySteps, liveSteps, dispatch]);

  // Debounced persist to Firestore when steps change and user is signed in
  useEffect(() => {
    if (!currentUserId) return;
    const key = todayKey();
    const steps = baseTodaySteps + liveSteps;
    const t = setTimeout(async () => {
      try {
        const ref = doc(db, 'users', currentUserId, 'metrics', 'steps', key);
        await setDoc(
          ref,
          { steps, date: key, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn('[StepsWidget] Persist failed', e);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [baseTodaySteps, liveSteps]);

  if (Platform.OS === 'web') {
    return null; // Hide on web to avoid confusion
  }

  if (!isAvailable) {
    return (
      <View style={[styles.pillOuter, style]}>
        <View style={styles.pillInner}>
          <Text style={styles.pillIcon}>👟</Text>
          <Text style={styles.pillText}>Steps N/A</Text>
        </View>
      </View>
    );
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
    shadowColor: COLORS.neonPurple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
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
