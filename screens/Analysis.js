import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import BackButton from '../components/BackButton';
import MonthlyStepsChart from '../components/MonthlyStepsChart';
import WeeklyStepsChart from '../components/WeeklyStepsChart';
import WeeklyWorkoutsChart from '../components/WeeklyWorkoutsChart';
import { auth, db } from '../services/firebase';
import { setStepsForDate } from '../store';
import { GRADIENTS } from '../utils/constants';

export default function Analysis() {
  const dispatch = useDispatch();
  const [mode, setMode] = useState('weekly'); // 'weekly' | 'monthly'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user?.uid) return;
      try {
  const stepsCol = collection(db, 'users', user.uid, 'metrics', 'steps');
  // Fetch up to ~14 months to support monthly view aggregation
  const q = query(stepsCol, orderBy('date', 'desc'), limit(420));
        const snap = await getDocs(q);
        const fetched = new Set();
        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const date = data.date || docSnap.id;
          const steps = Number(data.steps || 0);
          if (date && Number.isFinite(steps)) dispatch(setStepsForDate({ date, steps }));
          if (date) fetched.add(date);
        });

        // Backfill last 7 days with zeros if missing
        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!fetched.has(key)) {
            // Update Redux
            dispatch(setStepsForDate({ date: key, steps: 0 }));
            // Create/merge Firestore doc
            try {
              const ref = doc(db, 'users', user.uid, 'metrics', 'steps', key);
              await setDoc(ref, { date: key, steps: 0, updatedAt: serverTimestamp() }, { merge: true });
            } catch (e) {
              console.warn('[Analysis] Backfill write failed for', key, e);
            }
          }
        }
      } catch (e) {
        console.warn('[Analysis] Failed to load steps history', e);
      }
    });
    return () => unsub();
  }, [dispatch]);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <BackButton />
        <Text style={styles.title}>Analysis</Text>
        <Text style={styles.subtitle}>Insights about your workouts, steps, and progress</Text>
        <View style={styles.block}> 
          <Text style={styles.blockText}>Charts and insights coming soon…</Text>
        </View>
        {mode === 'weekly' ? (
          <>
            <WeeklyStepsChart weeksBack={8} onPressMonthly={() => setMode('monthly')} />
            <Text style={styles.hint}>Swipe horizontally to browse weeks</Text>
          </>
        ) : (
          <>
            <MonthlyStepsChart monthsBack={6} onPressWeekly={() => setMode('weekly')} />
            <Text style={styles.hint}>Monthly totals for the last 6 months</Text>
          </>
        )}
        <WeeklyWorkoutsChart weeksBack={8} />
        <Text style={styles.hint}>Counts completed workout sessions per day</Text>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 120, backgroundColor: '#05020B' },
  card: { borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textShadowColor: 'rgba(0,231,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 6, marginBottom: 12 },
  block: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20, alignItems: 'center', justifyContent: 'center' },
  blockText: { color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  hint: { color: '#cfe3ff', marginTop: 8, fontSize: 12, textAlign: 'center' },
});
