// WeeklyWorkoutsChart
// Displays the count of completed workout sessions per day for each week.
// Data source: Redux state at workouts.sessionsByDate keyed by 'YYYY-MM-DD'.
// Assumes ExerciseDB-logged or template/Strava-imported sessions all flow through addWorkoutSession.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { GRADIENTS } from '../utils/constants';

const HOME_FRAME_WIDTH = 414;

function formatKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d, weekStartsOn = 1) { // 0=Sun, 1=Mon
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn; // days since week start
  const s = new Date(d);
  s.setDate(d.getDate() - diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function formatRangeLabel(start, end) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const s = `${months[start.getMonth()]} ${start.getDate()}`;
  const e = `${months[end.getMonth()]} ${end.getDate()}`;
  return `${s} – ${e}`;
}

export default function WeeklyWorkoutsChart({ weeksBack = 8, weekStartsOn = 1 }) {
  const sessionsByDate = useSelector((s) => s.workouts?.sessionsByDate || {});
  const { width: SCREEN_W } = Dimensions.get('window');
  const frameWidth = Math.min(SCREEN_W, HOME_FRAME_WIDTH);
  const pagerRef = useRef(null);

  const data = useMemo(() => {
    const weeks = [];
    const now = new Date();
    let start = startOfWeek(now, weekStartsOn);
    for (let i = 0; i < weeksBack; i++) {
      const end = addDays(start, 6);
      const days = Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
      const rows = days.map((d) => {
        const key = formatKey(d);
        const arr = Array.isArray(sessionsByDate[key]) ? sessionsByDate[key] : [];
        return {
          key,
          label: String(d.getDate()),
          value: arr.length, // number of completed workout sessions for that day
        };
      });
      const max = Math.max(1, ...rows.map((r) => r.value));
      const total = rows.reduce((a, r) => a + r.value, 0);
      const avg = Math.round(total / rows.length);
      weeks.push({ start, end, rows, max, total, avg, title: formatRangeLabel(start, end) });
      start = addDays(start, -7);
    }
    return weeks.reverse();
  }, [sessionsByDate, weeksBack, weekStartsOn]);

  // Auto-snap to most recent week
  useEffect(() => {
    const pageWidth = frameWidth - 2 * 16; // match Analysis card padding
    if (!pagerRef.current || !data || data.length <= 1 || pageWidth <= 0) return;
    const x = pageWidth * (data.length - 1);
    const t = setTimeout(() => {
      try { pagerRef.current.scrollTo({ x, y: 0, animated: false }); } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [data, frameWidth]);

  const pageWidth = frameWidth - 2 * 16;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Weekly Workouts Completed</Text>
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{}}
      >
        {data.map((wk, idx) => (
          <View key={`${wk.title}-${idx}`} style={[styles.weekPage, { width: pageWidth }]}> 
            <Text style={styles.weekTitle}>{wk.title}</Text>
            <View style={styles.chartArea}>
              {wk.rows.map((r) => {
                const hPct = Math.round((r.value / wk.max) * 100);
                return (
                  <View key={r.key} style={styles.barItem}>
                    <Text style={styles.barValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {r.value}
                    </Text>
                    <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.bar, { height: `${hPct}%` }]} />
                    <Text style={styles.barLabel}>{r.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Total: {wk.total}</Text>
              <Text style={styles.summaryText}>Avg: {wk.avg}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 12, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  title: { color: '#E8F9FF', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  weekPage: { paddingHorizontal: 0 },
  weekTitle: { color: '#cfe3ff', fontWeight: '700', marginBottom: 6 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingBottom: 8, paddingTop: 12 },
  barItem: { alignItems: 'center', width: 40 },
  bar: { width: 24, borderRadius: 8 },
  barLabel: { color: '#cfe3ff', fontSize: 10, marginTop: 6 },
  barValue: { color: '#fff', fontSize: 12, marginBottom: 2, textAlign: 'center', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  summaryText: { color: '#fff', fontWeight: '700' },
});
