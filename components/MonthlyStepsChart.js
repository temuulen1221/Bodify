import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { GRADIENTS } from '../utils/constants';

function monthKey(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}`; // YYYY-MM
}

export default function MonthlyStepsChart({ monthsPerPage = 7, monthsTotal = 14, onPressWeekly }) {
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const { width: SCREEN_W } = Dimensions.get('window');
  const pagerRef = useRef(null);
  const CARD_HPAD = 16; // matches Analysis card padding

  const data = useMemo(() => {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();
    const months = [];
    const count = Math.max(monthsPerPage, monthsTotal);
    for (let i = 0; i < count; i++) {
      const key = monthKey(y, m);
      // Sum all steps entries in this month
      let total = 0;
      Object.entries(stepsByDate).forEach(([dateStr, steps]) => {
        if (typeof dateStr !== 'string' || dateStr.length !== 10) return;
        const yy = Number(dateStr.slice(0, 4));
        const mm = Number(dateStr.slice(5, 7)); // 1-12
        if (yy === y && mm === m + 1) total += Number(steps || 0);
      });
      const dateObj = new Date(y, m, 1);
      months.push({ key, label: dateObj.toLocaleString(undefined, { month: 'short' }), value: total, dateObj });
      // Move to previous month
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    }
    return months.reverse();
  }, [stepsByDate, monthsPerPage, monthsTotal]);

  const max = Math.max(1, ...data.map((d) => d.value));
  const pageWidth = SCREEN_W - 2 * CARD_HPAD;

  // Chunk months into pages
  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < data.length; i += monthsPerPage) {
      const slice = data.slice(i, i + monthsPerPage);
      if (slice.length > 0) chunks.push(slice);
    }
    return chunks;
  }, [data, monthsPerPage]);

  // Build a page title like "May – Nov 2025" or with years if crossing
  const formatRangeLabel = (slice) => {
    if (!slice?.length) return '';
    const first = slice[0]?.dateObj;
    const last = slice[slice.length - 1]?.dateObj;
    if (!first || !last) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sameYear = first.getFullYear() === last.getFullYear();
    const s = `${months[first.getMonth()]}${sameYear ? '' : ' ' + first.getFullYear()}`;
    const e = `${months[last.getMonth()]} ${last.getFullYear()}`;
    return `${s} – ${e}`;
  };

  // Auto-snap to the most recent page (last page)
  useEffect(() => {
    if (!pagerRef.current || pages.length <= 1 || pageWidth <= 0) return;
    const x = pageWidth * (pages.length - 1);
    const t = setTimeout(() => {
      try { pagerRef.current.scrollTo({ x, y: 0, animated: false }); } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [pages.length, pageWidth]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Monthly Steps</Text>
        {onPressWeekly ? (
          <Pressable onPress={onPressWeekly} style={styles.actionBtn} hitSlop={6}>
            <Text style={styles.actionBtnText}>Weekly</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{}}
      >
        {pages.map((slice, idx) => (
          <View key={`month-page-${idx}`} style={[styles.monthPage, { width: pageWidth }]}> 
            <Text style={styles.weekTitle}>{formatRangeLabel(slice)}</Text>
            <View style={styles.chartArea}> 
              {slice.map((m) => {
                const hPct = Math.round((m.value / max) * 100);
                return (
                  <View key={m.key} style={styles.barItem}> 
                    <Text style={styles.barValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {m.value.toLocaleString()}
                    </Text>
                    <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.bar, { height: `${hPct}%` }]} />
                    <Text style={styles.barLabel}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 12, marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: '#E8F9FF', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  monthPage: { paddingHorizontal: 6 },
  weekTitle: { color: '#cfe3ff', fontWeight: '700', marginBottom: 6 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 180 },
  barItem: { alignItems: 'center', width: 40 },
  bar: { width: 24, borderRadius: 8 },
  barLabel: { color: '#cfe3ff', fontSize: 10, marginTop: 6 },
  barValue: { color: '#fff', fontSize: 10, marginTop: 2 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  actionBtnText: { color: '#E8F9FF', fontWeight: '800', fontSize: 12 },
});
