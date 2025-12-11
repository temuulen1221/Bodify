import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { GRADIENTS } from '../utils/constants';

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

export default function WeeklyStepsChart({ weeksBack = 8, weekStartsOn = 1, onPressMonthly }) {
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const { width: SCREEN_W } = Dimensions.get('window');
  const pagerRef = useRef(null);
  const currentIndexRef = useRef(0);
  const setCurrentIndex = (v) => { currentIndexRef.current = v; };

  const data = useMemo(() => {
    const weeks = [];
    // Current week start
    const now = new Date();
    let start = startOfWeek(now, weekStartsOn);
    for (let i = 0; i < weeksBack; i++) {
      const end = addDays(start, 6);
      const days = Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
      const rows = days.map((d) => ({
        key: formatKey(d),
        label: String(d.getDate()), // show day only
        value: Number(stepsByDate[formatKey(d)] || 0),
      }));
      const max = Math.max(1, ...rows.map((r) => r.value));
      const total = rows.reduce((a, r) => a + r.value, 0);
      const avg = Math.round(total / rows.length);
      weeks.push({ start, end, rows, max, total, avg, title: formatRangeLabel(start, end) });
      // Move to previous week
      start = addDays(start, -7);
    }
    // Latest week last for natural scrolling left->right
    return weeks.reverse();
  }, [stepsByDate, weeksBack, weekStartsOn]);

  // Auto-snap to the most recent week (last page) when multiple weeks are shown
  useEffect(() => {
    const pageWidth = SCREEN_W - 2 * 16; // Match container padding from Analysis screen
    if (!pagerRef.current || !data || data.length <= 1 || pageWidth <= 0) return;
    const x = pageWidth * (data.length - 1);
    const t = setTimeout(() => {
      try { pagerRef.current.scrollTo({ x, y: 0, animated: false }); } catch {}
      setCurrentIndex(data.length - 1);
    }, 0);
    return () => clearTimeout(t);
  }, [data, SCREEN_W]);

  const pageWidth = SCREEN_W - 2 * 16;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  // gotoIndex removed (unused)

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Weekly Steps</Text>
        {onPressMonthly ? (
          <Pressable onPress={onPressMonthly} style={styles.actionBtn} hitSlop={6}>
            <Text style={styles.actionBtnText}>Monthly</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={pagerRef}
        onMomentumScrollEnd={(e) => {
          const x = e?.nativeEvent?.contentOffset?.x || 0;
          const idx = Math.round(x / (pageWidth || 1));
          setCurrentIndex(clamp(idx, 0, (data?.length || 1) - 1));
        }}
        contentContainerStyle={{}}
      >
        {data.map((wk, idx) => (
          <View key={`${wk.title}-${idx}`} style={[styles.weekPage, { width: SCREEN_W - 2 * 16 /* approx card horizontal padding in Analysis */ }]}>
            <Text style={styles.weekTitle}>{wk.title}</Text>
            <View style={styles.chartArea}>
              {wk.rows.map((r) => {
                const hPct = Math.round((r.value / wk.max) * 100);
                return (
                  <View key={r.key} style={styles.barItem}>
                    <Text style={styles.barValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {r.value.toLocaleString()}
                    </Text>
                    <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.bar, { height: `${hPct}%` }]} />
                    <Text style={styles.barLabel}>{r.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Total: {wk.total.toLocaleString()}</Text>
              <Text style={styles.summaryText}>Avg: {wk.avg.toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      {/* Swipe horizontally to navigate weeks; chevrons removed per request */}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 12, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: '#E8F9FF', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  weekPage: { paddingHorizontal: 0 },
  weekTitle: { color: '#cfe3ff', fontWeight: '700', marginBottom: 6 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 190, paddingBottom: 8, paddingTop: 12 },
  barItem: { alignItems: 'center', width: 40 },
  bar: { width: 24, borderRadius: 8 },
  barLabel: { color: '#cfe3ff', fontSize: 10, marginTop: 6 },
  barValue: { color: '#fff', fontSize: 10, marginBottom: 2, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  summaryText: { color: '#fff', fontWeight: '700' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  actionBtnText: { color: '#E8F9FF', fontWeight: '800', fontSize: 12 },
  // Chevron styles removed
});
