import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { addWorkoutSession } from '../store';

const HOME_FRAME_WIDTH = 414;

const getSessionTypeIconName = (type: any) => {
  const normalizedType = String(type || '').toLowerCase();
  if (normalizedType.includes('strength')) return 'barbell';
  if (normalizedType.includes('run')) return 'walk';
  if (normalizedType.includes('cycl') || normalizedType.includes('bike')) return 'bicycle';
  if (normalizedType.includes('hike') || normalizedType.includes('trail')) return 'map';
  if (normalizedType.includes('cardio')) return 'pulse';
  return 'flash';
};

// Simple calendar month view with stars on completed days
export default function CalendarScreen() {
  const completions = useSelector((s: any) => s.quests?.dailyCompletion || {});
  const sessionsByDate = useSelector((s: any) => s.workouts?.sessionsByDate || {});
  const stepsByDate = useSelector((s: any) => s.steps?.stepsByDate || {});
  const dispatch = useDispatch();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // 'YYYY-MM-DD'
  const { width: winW } = useWindowDimensions();
  const frameWidth = Math.min(winW, HOME_FRAME_WIDTH);
  const maxGridWidth = Math.min(560, Math.max(320, Math.floor(frameWidth - 32))); // leave side padding
  const cellPx = Math.floor(maxGridWidth / 7) - 2; // -2 for gutter

  const { year, month, firstDayOfWeek, daysInMonth, monthLabel } = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1).getDay(); // 0=Sun
    const dim = new Date(y, m + 1, 0).getDate();
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return { year: y, month: m, firstDayOfWeek: first, daysInMonth: dim, monthLabel: label };
  }, [monthOffset, today]);

  // Today's date string for "Today's Activity" panel
  const todayStr = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today]
  );

  // Title-only add activity modal state
  const [addVisible, setAddVisible] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDateTarget, setAddDateTarget] = useState<string | null>(null);

  const openAdd = (dateStr: string | null = null) => {
    setAddDateTarget(dateStr || todayStr);
    setAddTitle('');
    setAddVisible(true);
  };

  const confirmAdd = () => {
    const title = addTitle.trim() || 'Workout';
    const when = addDateTarget || todayStr;
    dispatch(addWorkoutSession({ date: when, session: { title, type: 'general' } }));
    setAddVisible(false);
  };

  const grid = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let day = 1; day <= daysInMonth; day++) grid.push(day);

  const fmt = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <BackButton />
      <LinearGradient
        colors={["#0d1024", "#0a0f1e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerWrap}
      >
        <LinearGradient
          colors={["rgba(122,92,255,0.35)", "rgba(0,234,255,0.35)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => setMonthOffset((v) => v - 1)}
            style={styles.navBtn}
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={22} color="#9feaff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={() => setMonthOffset((v) => v + 1)}
            style={styles.navBtn}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={22} color="#9feaff" />
          </TouchableOpacity>
        </LinearGradient>
      </LinearGradient>

      <View style={[styles.weekdays, { width: cellPx * 7, alignSelf: 'center' }]}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
          <Text style={[styles.weekday, { width: cellPx }]} key={w}>{w}</Text>
        ))}
      </View>

      <View style={[styles.grid, { width: cellPx * 7, alignSelf: 'center' }]}>
        {grid.map((d, i) => {
          if (d === null) return <View style={[styles.cellSpacer, { width: cellPx, height: cellPx }]} key={`e${i}`} />;
          const dateStr = fmt(year, month, d);
          const done = !!completions[dateStr];
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = selectedDate === dateStr;

          const CellInner = (
            <View style={[
              styles.cell,
              (done || isToday) && styles.cellActive,
              isToday && styles.todayCell,
              isSelected && styles.selectedCell,
            ]}>
              <Text style={[styles.day, done && styles.dayDone, isToday && styles.dayToday]}>{d}</Text>
              {done && (
                <View style={styles.starWrap}>
                  <Ionicons name="star" size={14} color="#00eaff" style={styles.starIcon} />
                </View>
              )}
            </View>
          );

          if (isToday) {
            return (
              <TouchableOpacity key={dateStr} onPress={() => setSelectedDate(dateStr)} activeOpacity={0.8}>
                <LinearGradient
                colors={["rgba(0,234,255,0.25)", "rgba(122,92,255,0.18)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cellGradient, { width: cellPx, height: cellPx }]}
              >
                {CellInner}
              </LinearGradient>
              </TouchableOpacity>
            );
          }

          if (done) {
            return (
              <TouchableOpacity key={dateStr} onPress={() => setSelectedDate(dateStr)} activeOpacity={0.8}>
                <LinearGradient
                colors={["rgba(122,92,255,0.18)", "rgba(0,234,255,0.12)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cellGradient, { width: cellPx, height: cellPx }]}
              >
                {CellInner}
              </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity onPress={() => setSelectedDate(dateStr)} activeOpacity={0.8} key={dateStr}>
              <View style={[styles.cellGradient, { width: cellPx, height: cellPx }]}>{CellInner}</View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.legend}>Star = all daily quests completed</Text>

      {/* Unified activity panel: shows Today by default, switches to selected day when tapped */}
      {(() => {
        const panelKey = selectedDate || todayStr;
        const isTodayPanel = panelKey === todayStr;
        const headerIcon = isTodayPanel ? 'time' : 'calendar';
        const headerTitle = isTodayPanel ? "Today's Activity" : panelKey;
        const sessions = sessionsByDate[panelKey] || [];
        const done = !!completions[panelKey];
        const steps = stepsByDate[panelKey];
        const maxH = isTodayPanel ? 160 : 220;
        return (
          <View style={[styles.detailsWrap, { width: cellPx * 7, alignSelf: 'center' }]}>
            <LinearGradient
              colors={["rgba(0,234,255,0.25)", "rgba(122,92,255,0.18)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.detailsInner}
            >
              <View style={styles.detailsHeader}>
                <Ionicons name={headerIcon as any} size={18} color="#9feaff" />
                <Text style={styles.detailsTitle}>{headerTitle}</Text>
                <TouchableOpacity onPress={() => openAdd(panelKey)} style={styles.actionBtn} activeOpacity={0.9}>
                  <LinearGradient colors={["#00eaff", "#7a5cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnGrad}>
                    <Text style={styles.actionBtnText}>Add</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {/* No close button for other days as requested */}
              </View>

              <View style={styles.detailRow}>
                <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? '#3cffb3' : '#8aa4ff'} />
                <Text style={styles.detailText}>
                  Daily quests {done ? 'completed' : 'not completed'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="walk" size={18} color="#00eaff" />
                <Text style={styles.detailText}>
                  Steps: {steps != null ? steps.toLocaleString() : '\u2014'}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Workouts</Text>
              {Array.isArray(sessions) && sessions.length > 0 ? (
                <ScrollView style={{ maxHeight: maxH }} contentContainerStyle={{ paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
                  {sessions.map((s, idx) => (
                    <View key={s.id || idx} style={styles.workoutItem}>
                      <Ionicons name={getSessionTypeIconName(s.type) as any} size={18} color="#00eaff" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.workoutTitle}>{s.title || 'Workout'}</Text>
                        <Text style={styles.workoutMeta}>{`${s.durationMin ?? 0} min \u00b7 ${s.calories ?? 0} kcal \u00b7 ${s.awardedXP ?? 0} XP`}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No workouts logged.</Text>
              )}
            </LinearGradient>
          </View>
        );
      })()}
      {/* Title-only Add Activity modal */}
      <Modal visible={addVisible} transparent animationType="fade" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <LinearGradient colors={["rgba(0,234,255,0.25)", "rgba(122,92,255,0.18)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Activity</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Title (e.g., Morning Run)"
              placeholderTextColor="#a8c8ff"
              value={addTitle}
              onChangeText={setAddTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmAdd}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setAddVisible(false)} style={styles.modalBtnOutline} activeOpacity={0.85}>
                <Text style={styles.modalBtnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmAdd} activeOpacity={0.9}>
                <LinearGradient colors={["#00eaff", "#7a5cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalBtnGrad}>
                  <Text style={styles.modalBtnText}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080b16',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  headerWrap: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#d9eaff',
    letterSpacing: 0.5,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 0,
  },
  weekday: {
    textAlign: 'center',
    color: '#00eaff',
    fontWeight: '800',
    fontSize: 13,
    opacity: 0.9,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellSpacer: {
    // width/height set inline
  },
  cellGradient: {
    // width/height set inline
    padding: 2,
    borderRadius: 12,
  },
  cell: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e1530',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.18)',
  },
  cellActive: {
    boxShadow: '0px 0px 8px rgba(0,234,255,0.4)',
    elevation: 3,
  },
  todayCell: {
    borderColor: 'rgba(0,234,255,0.7)',
    backgroundColor: 'rgba(0,234,255,0.06)',
  },
  day: { fontSize: 18, color: '#cfe6ff', fontWeight: '800' },
  dayDone: { color: '#bcd9ff' },
  dayToday: { color: '#ffffff' },
  starWrap: { position: 'absolute', bottom: 6, right: 6 },
  starIcon: {
    textShadow: '0px 0px 6px rgba(0,234,255,0.8)',
  },
  legend: { textAlign: 'center', marginTop: 12, color: '#8aa4ff' },
  selectedCell: {
    borderColor: 'rgba(122,92,255,0.75)',
  },
  detailsWrap: {
    marginTop: 12,
    padding: 2,
    borderRadius: 14,
  },
  detailsInner: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionBtn: { marginLeft: 'auto', borderRadius: 10, overflow: 'hidden' },
  actionBtnGrad: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  detailsTitle: {
    marginLeft: 6,
    color: '#d9eaff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
    flex: 1,
  },
  detailsClose: { padding: 4, borderRadius: 8 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  detailText: { color: '#cfe6ff', fontSize: 13, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(122,92,255,0.25)',
    marginVertical: 10,
  },
  sectionLabel: { color: '#9feaff', fontSize: 13, fontWeight: '900', marginBottom: 6 },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)',
    marginBottom: 8,
  },
  workoutTitle: { color: '#e8f3ff', fontSize: 14, fontWeight: '900' },
  workoutMeta: { color: '#a7c2ff', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#8aa4ff', opacity: 0.9, fontSize: 13 },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  modalTitle: { color: '#e8f3ff', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  modalBtnOutline: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,234,255,0.35)' },
  modalBtnOutlineText: { color: '#cfe6ff', fontWeight: '800' },
  modalBtnGrad: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  modalBtnText: { color: '#fff', fontWeight: '900' },
}) as unknown as Record<string, any>;
