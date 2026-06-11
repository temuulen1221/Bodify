import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { addReminder, addWorkoutSession, deleteReminder, setDayNote, toggleReminder } from '../store';

const HOME_FRAME_WIDTH = 414;

const WORKOUT_TYPES = [
  { id: 'strength', label: 'Lift',   icon: 'barbell',  color: '#7a5cff' },
  { id: 'cardio',   label: 'Cardio', icon: 'pulse',    color: '#00eaff' },
  { id: 'run',      label: 'Run',    icon: 'walk',     color: '#3cffb3' },
  { id: 'cycling',  label: 'Cycle',  icon: 'bicycle',  color: '#ff9f43' },
  { id: 'hike',     label: 'Hike',   icon: 'map',      color: '#a29bfe' },
] as const;

type WorkoutTypeId = typeof WORKOUT_TYPES[number]['id'];

const CALS_PER_MIN: Record<WorkoutTypeId, number> = {
  strength: 8, cardio: 10, run: 11, cycling: 9, hike: 6,
};

const getSessionTypeIconName = (type: any): string => {
  const t = String(type || '').toLowerCase();
  if (t.includes('strength')) return 'barbell';
  if (t.includes('run'))      return 'walk';
  if (t.includes('cycl') || t.includes('bike')) return 'bicycle';
  if (t.includes('hike') || t.includes('trail')) return 'map';
  if (t.includes('cardio'))   return 'pulse';
  return 'flash';
};

const getSessionTypeColor = (type: any): string => {
  const t = String(type || '').toLowerCase();
  if (t.includes('strength')) return '#7a5cff';
  if (t.includes('run'))      return '#3cffb3';
  if (t.includes('cycl') || t.includes('bike')) return '#ff9f43';
  if (t.includes('hike') || t.includes('trail')) return '#a29bfe';
  if (t.includes('cardio'))   return '#00eaff';
  return '#00eaff';
};

// Calendar screen with stats, dot indicators, rich add modal
export default function CalendarScreen() {
  const completions = useSelector((s: any) => s.quests?.dailyCompletion || {});
  const sessionsByDate = useSelector((s: any) => s.workouts?.sessionsByDate || {});
  const stepsByDate = useSelector((s: any) => s.steps?.stepsByDate || {});
  const notesByDate = useSelector((s: any) => s.notes?.notesByDate || {});
  const remindersByDate = useSelector((s: any) => s.notes?.remindersByDate || {});
  const dispatch = useDispatch();
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { width: winW } = useWindowDimensions();
  const frameWidth = Math.min(winW, HOME_FRAME_WIDTH);
  const maxGridWidth = Math.min(560, Math.max(320, Math.floor(frameWidth - 32)));
  const cellPx = Math.floor(maxGridWidth / 7) - 2;

  const fmt = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const todayStr = useMemo(
    () => fmt(today.getFullYear(), today.getMonth(), today.getDate()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today.toDateString()]
  );

  const { year, month, firstDayOfWeek, daysInMonth, monthLabel } = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return { year: y, month: m, firstDayOfWeek: first, daysInMonth: dim, monthLabel: label };
  }, [monthOffset, today.getFullYear(), today.getMonth()]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    let workouts = 0;
    let steps = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = fmt(year, month, d);
      workouts += (sessionsByDate[key] || []).length;
      steps += stepsByDate[key] || 0;
    }
    return { workouts, steps };
  }, [year, month, daysInMonth, sessionsByDate, stepsByDate]);

  // Streak: consecutive active days from today backwards
  const streak = useMemo(() => {
    let count = 0;
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < 365; i++) {
      const d = new Date(base.getTime() - i * 86400000);
      const key = fmt(d.getFullYear(), d.getMonth(), d.getDate());
      const active = !!completions[key] || ((sessionsByDate[key] || []).length > 0);
      if (active) count++;
      else if (i > 0) break; // allow today to be empty
    }
    return count;
  }, [today.toDateString(), completions, sessionsByDate]);

  // Unified add modal
  type AddMode = null | 'picker' | 'workout' | 'note' | 'reminder';
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addDateTarget, setAddDateTarget] = useState<string | null>(null);

  // Workout fields
  const [addTitle, setAddTitle] = useState('');
  const [addType, setAddType] = useState<WorkoutTypeId>('strength');
  const [addDuration, setAddDuration] = useState('30');
  const [addCalories, setAddCalories] = useState('');

  // Note fields
  const [noteText, setNoteText] = useState('');

  // Reminder fields
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderHour, setReminderHour] = useState(7);    // 1-12
  const [reminderMin, setReminderMin] = useState(0);      // 0-55 step 5
  const [reminderAmpm, setReminderAmpm] = useState<'AM'|'PM'>('AM');

  const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
  const MINS  = Array.from({ length: 12 }, (_, i) => i * 5);

  const openPicker = (dateStr: string) => {
    setAddDateTarget(dateStr);
    setAddMode('picker');
  };

  const selectMode = (mode: 'workout' | 'note' | 'reminder') => {
    if (mode === 'workout') {
      setAddTitle('');
      setAddType('strength');
      setAddDuration('30');
      setAddCalories('');
    } else if (mode === 'note') {
      setNoteText(notesByDate[addDateTarget || todayStr] || '');
    } else {
      setReminderTitle('');
      setReminderHour(7);
      setReminderMin(0);
      setReminderAmpm('AM');
    }
    setAddMode(mode);
  };

  const closeModal = () => setAddMode(null);

  const handleTypeSelect = (tid: WorkoutTypeId) => {
    setAddType(tid);
    const dur = parseInt(addDuration, 10) || 30;
    setAddCalories(String(dur * CALS_PER_MIN[tid]));
  };

  const handleDurationChange = (val: string) => {
    setAddDuration(val);
    const dur = parseInt(val, 10);
    if (!isNaN(dur)) setAddCalories(String(dur * CALS_PER_MIN[addType]));
  };

  const confirmWorkout = () => {
    const title = addTitle.trim() || WORKOUT_TYPES.find(t => t.id === addType)?.label || 'Workout';
    const when = addDateTarget || todayStr;
    const dur = parseInt(addDuration, 10) || 0;
    const cal = parseInt(addCalories, 10) || 0;
    dispatch(addWorkoutSession({
      date: when,
      session: { title, type: addType, durationMin: dur, calories: cal, createdAt: Date.now() },
    }));
    closeModal();
  };

  const confirmNote = () => {
    dispatch(setDayNote({ date: addDateTarget || todayStr, text: noteText }));
    closeModal();
  };

  const confirmReminder = () => {
    if (!reminderTitle.trim()) return;
    const timeStr = `${String(reminderHour).padStart(2,'0')}:${String(reminderMin).padStart(2,'0')} ${reminderAmpm}`;
    dispatch(addReminder({
      date: addDateTarget || todayStr,
      reminder: { id: String(Date.now()), title: reminderTitle.trim(), time: timeStr },
    }));
    closeModal();
  };



  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let day = 1; day <= daysInMonth; day++) grid.push(day);

  return (
    <View style={styles.container}>
      <BackButton />

      {/* Header row with month nav + Today button */}
      <View style={styles.headerWrap}>
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
          <TouchableOpacity onPress={() => setMonthOffset(0)} activeOpacity={0.7}>
            <Text style={styles.headerText}>{monthLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMonthOffset((v) => v + 1)}
            style={styles.navBtn}
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={22} color="#9feaff" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Monthly stats bar */}
      <View style={[styles.statsBar, { width: cellPx * 7, alignSelf: 'center' }]}>
        <View style={styles.statPill}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statPill}>
          <Ionicons name="barbell" size={14} color="#7a5cff" />
          <Text style={styles.statValue}>{monthlyStats.workouts}</Text>
          <Text style={styles.statLabel}>workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statPill}>
          <Ionicons name="walk" size={14} color="#00eaff" />
          <Text style={styles.statValue}>{monthlyStats.steps >= 1000 ? `${(monthlyStats.steps / 1000).toFixed(1)}k` : String(monthlyStats.steps)}</Text>
          <Text style={styles.statLabel}>steps</Text>
        </View>
      </View>

      {/* Weekday labels */}
      <View style={[styles.weekdays, { width: cellPx * 7, alignSelf: 'center' }]}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((w) => (
          <Text style={[styles.weekday, { width: cellPx }]} key={w}>{w}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={[styles.grid, { width: cellPx * 7, alignSelf: 'center' }]}>
        {grid.map((d, i) => {
          if (d === null) return <View style={[styles.cellSpacer, { width: cellPx, height: cellPx }]} key={`e${i}`} />;
          const dateStr = fmt(year, month, d);
          const done = !!completions[dateStr];
          const sessions: any[] = sessionsByDate[dateStr] || [];
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const isSelected = selectedDate === dateStr;
          const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

          // Up to 3 dot colors for session types
          const dots = sessions.slice(0, 3).map((s) => getSessionTypeColor(s.type));
          const hasNote = !!notesByDate[dateStr];
          const hasReminder = (remindersByDate[dateStr] || []).length > 0;

          const CellInner = (
            <View style={[
              styles.cell,
              isToday && styles.todayCell,
              isSelected && styles.selectedCell,
              !isToday && !isSelected && isPast && sessions.length === 0 && !done && styles.pastEmpty,
            ]}>
              <Text style={[styles.day, done && styles.dayDone, isToday && styles.dayToday, isSelected && styles.daySelected]}>
                {d}
              </Text>
              {/* Dot row */}
              {(done || dots.length > 0 || hasNote || hasReminder) && (
                <View style={styles.dotRow}>
                  {done && <View style={[styles.dot, { backgroundColor: '#00eaff' }]} />}
                  {dots.map((color, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                  {hasNote && <View style={[styles.dot, { backgroundColor: '#ffd700' }]} />}
                  {hasReminder && <View style={[styles.dot, { backgroundColor: '#ff6b9d' }]} />}
                </View>
              )}
            </View>
          );

          const gradColors: [string, string] = isToday
            ? ["rgba(0,234,255,0.28)", "rgba(122,92,255,0.18)"]
            : isSelected
            ? ["rgba(122,92,255,0.32)", "rgba(0,234,255,0.18)"]
            : done || sessions.length > 0
            ? ["rgba(122,92,255,0.15)", "rgba(0,234,255,0.10)"]
            : ["transparent", "transparent"];

          const useGrad = isToday || isSelected || done || sessions.length > 0 || hasNote || hasReminder;

          return (
            <TouchableOpacity
              key={dateStr}
              onPress={() => {
                setSelectedDate(isSelected ? null : dateStr);
              }}
              activeOpacity={0.75}
            >
              {useGrad ? (
                <LinearGradient
                  colors={gradColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.cellGradient, { width: cellPx, height: cellPx }]}
                >
                  {CellInner}
                </LinearGradient>
              ) : (
                <View style={[styles.cellGradient, { width: cellPx, height: cellPx }]}>
                  {CellInner}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.legend}>● quests  ● workout  ● note  ● reminder</Text>

      {/* Activity panel */}
      {(() => {
        const panelKey = selectedDate || todayStr;
        const isTodayPanel = panelKey === todayStr;
        const sessions: any[] = sessionsByDate[panelKey] || [];
        const done = !!completions[panelKey];
        const steps = stepsByDate[panelKey];
        const note = notesByDate[panelKey] || '';
        const reminders: any[] = remindersByDate[panelKey] || [];
        const maxH = 180;
        return (
          <>
            {/* ── Activity card (workouts / stats) ── */}
            <View style={[styles.detailsWrap, { width: cellPx * 7, alignSelf: 'center' }]}>
              <LinearGradient
                colors={["rgba(0,234,255,0.22)", "rgba(122,92,255,0.16)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.detailsInner}
              >
                <View style={styles.detailsHeader}>
                  <Ionicons name={isTodayPanel ? 'time' : 'calendar'} size={18} color="#9feaff" />
                  <Text style={styles.detailsTitle}>{isTodayPanel ? "Today's Activity" : panelKey}</Text>
                  <TouchableOpacity onPress={() => openPicker(panelKey)} style={styles.actionBtn} activeOpacity={0.9}>
                    <LinearGradient colors={["#00eaff", "#7a5cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnGrad}>
                      <Ionicons name="add" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.miniStat}>
                    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={done ? '#3cffb3' : '#8aa4ff'} />
                    <Text style={[styles.miniStatText, done && { color: '#3cffb3' }]}>
                      Quests {done ? 'done' : 'pending'}
                    </Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Ionicons name="walk" size={16} color="#00eaff" />
                    <Text style={styles.miniStatText}>
                      {steps != null ? steps.toLocaleString() : '—'} steps
                    </Text>
                  </View>
                  <View style={styles.miniStat}>
                    <Ionicons name="barbell" size={16} color="#7a5cff" />
                    <Text style={styles.miniStatText}>
                      {sessions.length} workout{sessions.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {Array.isArray(sessions) && sessions.length > 0 ? (
                  <ScrollView style={{ maxHeight: maxH }} contentContainerStyle={{ paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
                    {sessions.map((s, idx) => (
                      <View key={s.id || idx} style={[styles.workoutItem, { borderLeftColor: getSessionTypeColor(s.type) }]}>
                        <View style={[styles.workoutIconWrap, { backgroundColor: getSessionTypeColor(s.type) + '22' }]}>
                          <Ionicons name={getSessionTypeIconName(s.type) as any} size={18} color={getSessionTypeColor(s.type)} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.workoutTitle}>{s.title || 'Workout'}</Text>
                          <Text style={styles.workoutMeta}>
                            {[
                              s.durationMin ? `${s.durationMin} min` : null,
                              s.calories ? `${s.calories} kcal` : null,
                              s.awardedXP ? `${s.awardedXP} XP` : null,
                            ].filter(Boolean).join(' · ') || 'Logged'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyText}>No workouts logged — tap Add to record one.</Text>
                )}
              </LinearGradient>
            </View>

            {/* ── Notes & Reminders card ── */}
            <View style={[styles.notesCard, { width: cellPx * 7, alignSelf: 'center' }]}>
              {/* Note section */}
              <View style={styles.noteSection}>
                <View style={styles.notesCardHeader}>
                  <Ionicons name="pencil" size={15} color="#ffd700" />
                  <Text style={styles.notesCardTitle}>Note</Text>
                </View>
                {note ? (
                  <Text style={styles.noteSummary}>{note}</Text>
                ) : (
                  <Text style={styles.emptyTextDim}>No note — tap Add → Note.</Text>
                )}
              </View>

              <View style={styles.notesCardDivider} />

              {/* Reminders section */}
              <View style={styles.remindersSection}>
                <View style={styles.notesCardHeader}>
                  <Ionicons name="alarm" size={15} color="#ff6b9d" />
                  <Text style={[styles.notesCardTitle, { color: '#ff6b9d' }]}>Reminders</Text>
                  <Text style={styles.reminderCount}>
                    {reminders.length > 0 ? `${reminders.filter(r => !r.done).length} pending` : ''}
                  </Text>
                </View>
                {reminders.length === 0 ? (
                  <Text style={styles.emptyTextDim}>No reminders — tap Add → Reminder.</Text>
                ) : (
                  reminders.map((r) => (
                    <View key={r.id} style={[styles.reminderItem, r.done && styles.reminderDone]}>
                      <TouchableOpacity onPress={() => dispatch(toggleReminder({ date: panelKey, id: r.id }))} activeOpacity={0.7}>
                        <Ionicons name={r.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={r.done ? '#3cffb3' : '#ff6b9d'} />
                      </TouchableOpacity>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.reminderTitle, r.done && styles.reminderTitleDone]}>{r.title}</Text>
                        {!!r.time && (
                          <View style={styles.reminderTimeRow}>
                            <Ionicons name="time-outline" size={12} color="#ff6b9d" />
                            <Text style={styles.reminderTime}>{r.time}</Text>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => dispatch(deleteReminder({ date: panelKey, id: r.id }))} activeOpacity={0.7} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={16} color="#8aa4ff" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        );
      })()}

      {/* Unified Add modal */}
      <Modal visible={addMode !== null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <LinearGradient colors={["#0d1330", "#0a0f22"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalCard}>

            {/* ── Picker screen ── */}
            {addMode === 'picker' && (
              <>
                <Text style={styles.modalTitle}>Add to {addDateTarget}</Text>
                <Text style={styles.modalDate}>What would you like to log?</Text>
                <View style={styles.pickerRow}>
                  <TouchableOpacity onPress={() => selectMode('workout')} style={styles.pickerOption} activeOpacity={0.8}>
                    <LinearGradient colors={["rgba(122,92,255,0.25)", "rgba(0,234,255,0.15)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pickerOptionGrad}>
                      <View style={[styles.pickerIcon, { backgroundColor: '#7a5cff22' }]}>
                        <Ionicons name="barbell" size={26} color="#7a5cff" />
                      </View>
                      <Text style={styles.pickerLabel}>Workout</Text>
                      <Text style={styles.pickerSub}>Log a session</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => selectMode('note')} style={styles.pickerOption} activeOpacity={0.8}>
                    <LinearGradient colors={["rgba(255,215,0,0.18)", "rgba(255,165,0,0.10)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pickerOptionGrad}>
                      <View style={[styles.pickerIcon, { backgroundColor: '#ffd70022' }]}>
                        <Ionicons name="pencil" size={26} color="#ffd700" />
                      </View>
                      <Text style={styles.pickerLabel}>Note</Text>
                      <Text style={styles.pickerSub}>Write a note</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => selectMode('reminder')} style={styles.pickerOption} activeOpacity={0.8}>
                    <LinearGradient colors={["rgba(255,107,157,0.22)", "rgba(201,79,181,0.12)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pickerOptionGrad}>
                      <View style={[styles.pickerIcon, { backgroundColor: '#ff6b9d22' }]}>
                        <Ionicons name="alarm" size={26} color="#ff6b9d" />
                      </View>
                      <Text style={styles.pickerLabel}>Reminder</Text>
                      <Text style={styles.pickerSub}>Set an alert</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.modalBtnOutline} activeOpacity={0.85}>
                  <Text style={[styles.modalBtnOutlineText, { textAlign: 'center' }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Workout screen ── */}
            {addMode === 'workout' && (
              <>
                <View style={styles.modalTitleRow}>
                  <TouchableOpacity onPress={() => setAddMode('picker')} style={{ marginRight: 8 }} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={20} color="#9feaff" />
                  </TouchableOpacity>
                  <Ionicons name="barbell" size={18} color="#7a5cff" />
                  <Text style={[styles.modalTitle, { marginLeft: 6 }]}>Log Workout</Text>
                </View>
                <Text style={styles.modalDate}>{addDateTarget}</Text>
                <Text style={styles.modalLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {WORKOUT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => handleTypeSelect(t.id)}
                      style={[styles.typeChip, addType === t.id && { borderColor: t.color, backgroundColor: t.color + '22' }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={t.icon as any} size={14} color={addType === t.id ? t.color : '#8aa4ff'} />
                      <Text style={[styles.typeChipText, addType === t.id && { color: t.color }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.modalLabel}>Title (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Morning Run"
                  placeholderTextColor="#a8c8ff"
                  value={addTitle}
                  onChangeText={setAddTitle}
                  returnKeyType="next"
                />
                <View style={styles.inputRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.modalLabel}>Duration (min)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="30"
                      placeholderTextColor="#a8c8ff"
                      value={addDuration}
                      onChangeText={handleDurationChange}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Calories</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="auto"
                      placeholderTextColor="#a8c8ff"
                      value={addCalories}
                      onChangeText={setAddCalories}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={confirmWorkout}
                    />
                  </View>
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeModal} style={styles.modalBtnOutline} activeOpacity={0.85}>
                    <Text style={styles.modalBtnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmWorkout} activeOpacity={0.9}>
                    <LinearGradient colors={["#00eaff", "#7a5cff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalBtnGrad}>
                      <Text style={styles.modalBtnText}>Log It</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Note screen ── */}
            {addMode === 'note' && (
              <>
                <View style={styles.modalTitleRow}>
                  <TouchableOpacity onPress={() => setAddMode('picker')} style={{ marginRight: 8 }} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={20} color="#9feaff" />
                  </TouchableOpacity>
                  <Ionicons name="pencil" size={18} color="#ffd700" />
                  <Text style={[styles.modalTitle, { marginLeft: 6 }]}>Note</Text>
                </View>
                <Text style={styles.modalDate}>{addDateTarget}</Text>
                <Text style={styles.modalLabel}>Your note</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
                  placeholder="Write anything — goals, feelings, diet notes…"
                  placeholderTextColor="#a8c8ff"
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeModal} style={styles.modalBtnOutline} activeOpacity={0.85}>
                    <Text style={styles.modalBtnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmNote} activeOpacity={0.9}>
                    <LinearGradient colors={["#ffd700", "#ff9f43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalBtnGrad}>
                      <Text style={styles.modalBtnText}>Save</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Reminder screen ── */}
            {addMode === 'reminder' && (
              <>
                <View style={styles.modalTitleRow}>
                  <TouchableOpacity onPress={() => setAddMode('picker')} style={{ marginRight: 8 }} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={20} color="#9feaff" />
                  </TouchableOpacity>
                  <Ionicons name="alarm" size={18} color="#ff6b9d" />
                  <Text style={[styles.modalTitle, { marginLeft: 6 }]}>Add Reminder</Text>
                </View>
                <Text style={styles.modalDate}>{addDateTarget}</Text>

                <Text style={styles.modalLabel}>What to remind</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Drink water, Take protein"
                  placeholderTextColor="#a8c8ff"
                  value={reminderTitle}
                  onChangeText={setReminderTitle}
                  autoFocus
                  returnKeyType="done"
                />

                <Text style={styles.modalLabel}>Time</Text>

                {/* Drum-roll time picker — always visible */}
                <View style={styles.drumRow}>
                    {/* Hours */}
                    <View style={styles.drumCol}>
                      <Text style={styles.drumColLabel}>HH</Text>
                      <View style={styles.drumWrap}>
                        <View style={styles.drumSelector} pointerEvents="none" />
                        <ScrollView
                          style={styles.drumScroll}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                          contentContainerStyle={{ paddingVertical: 40 }}
                        >
                          {HOURS.map((h) => (
                            <TouchableOpacity key={h} onPress={() => setReminderHour(h)} style={styles.drumItem} activeOpacity={0.7}>
                              <Text style={[styles.drumItemText, reminderHour === h && styles.drumItemActive]}>
                                {String(h).padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    <Text style={styles.drumColon}>:</Text>

                    {/* Minutes */}
                    <View style={styles.drumCol}>
                      <Text style={styles.drumColLabel}>MM</Text>
                      <View style={styles.drumWrap}>
                        <View style={styles.drumSelector} pointerEvents="none" />
                        <ScrollView
                          style={styles.drumScroll}
                          showsVerticalScrollIndicator={false}
                          snapToInterval={40}
                          decelerationRate="fast"
                          contentContainerStyle={{ paddingVertical: 40 }}
                        >
                          {MINS.map((m) => (
                            <TouchableOpacity key={m} onPress={() => setReminderMin(m)} style={styles.drumItem} activeOpacity={0.7}>
                              <Text style={[styles.drumItemText, reminderMin === m && styles.drumItemActive]}>
                                {String(m).padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>

                    {/* AM / PM */}
                    <View style={styles.drumCol}>
                      <Text style={styles.drumColLabel}> </Text>
                      <View style={styles.ampmCol}>
                        {(['AM', 'PM'] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            onPress={() => setReminderAmpm(p)}
                            style={[styles.ampmBtn, reminderAmpm === p && styles.ampmBtnActive]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.ampmText, reminderAmpm === p && styles.ampmTextActive]}>{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={closeModal} style={styles.modalBtnOutline} activeOpacity={0.85}>
                    <Text style={styles.modalBtnOutlineText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmReminder} activeOpacity={0.9}>
                    <LinearGradient colors={["#ff6b9d", "#c94fb5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalBtnGrad}>
                      <Text style={styles.modalBtnText}>Set</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

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
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  // Monthly stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(13,19,48,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: { fontSize: 14 },
  statValue: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  statLabel: { color: '#8aa4ff', fontSize: 11, fontWeight: '700' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(122,92,255,0.3)' },
  // Weekdays & grid
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekday: {
    textAlign: 'center',
    color: '#00eaff',
    fontWeight: '800',
    fontSize: 12,
    opacity: 0.85,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellSpacer: {},
  cellGradient: {
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
    paddingBottom: 4,
  },
  pastEmpty: {
    opacity: 0.5,
  },
  todayCell: {
    borderColor: 'rgba(0,234,255,0.75)',
    borderWidth: 2,
    backgroundColor: 'rgba(0,234,255,0.06)',
  },
  selectedCell: {
    borderColor: 'rgba(122,92,255,0.9)',
    borderWidth: 2,
  },
  day: { fontSize: 16, color: '#cfe6ff', fontWeight: '800', marginTop: 4 },
  dayDone: { color: '#bcd9ff' },
  dayToday: { color: '#ffffff' },
  daySelected: { color: '#c9b4ff' },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legend: { textAlign: 'center', marginTop: 8, color: '#8aa4ff', fontSize: 11 },
  // Activity panel
  detailsWrap: {
    marginTop: 10,
    borderRadius: 14,
  },
  detailsInner: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailsTitle: {
    marginLeft: 6,
    color: '#d9eaff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
    flex: 1,
  },
  actionBtn: { marginLeft: 'auto', borderRadius: 10, overflow: 'hidden' },
  actionBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatText: { color: '#cfe6ff', fontSize: 12, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(122,92,255,0.25)',
    marginVertical: 8,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,234,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.2)',
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  workoutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutTitle: { color: '#e8f3ff', fontSize: 14, fontWeight: '900' },
  workoutMeta: { color: '#a7c2ff', fontSize: 12, fontWeight: '700', marginTop: 1 },
  emptyText: { color: '#8aa4ff', fontSize: 13 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.4)',
  },
  modalTitle: { color: '#e8f3ff', fontSize: 18, fontWeight: '900', marginBottom: 2 },
  modalDate: { color: '#9feaff', fontSize: 12, fontWeight: '700', marginBottom: 14, opacity: 0.8 },
  modalLabel: { color: '#9feaff', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
    backgroundColor: 'rgba(122,92,255,0.08)',
  },
  typeChipText: { color: '#8aa4ff', fontSize: 12, fontWeight: '800' },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  inputRow: { flexDirection: 'row', marginBottom: 0 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 14 },
  modalBtnOutline: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,234,255,0.35)' },
  modalBtnOutlineText: { color: '#cfe6ff', fontWeight: '800' },
  modalBtnGrad: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  modalBtnText: { color: '#fff', fontWeight: '900' },
  // Note + Reminder styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  sectionHeaderText: {
    color: '#d9eaff',
    fontWeight: '900',
    fontSize: 13,
    flex: 1,
  },
  noteSummary: {
    color: '#cfe6ff',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderLeftWidth: 3,
    borderLeftColor: '#ffd700',
  },
  // Notes & Reminders card
  notesCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    backgroundColor: 'rgba(255,215,0,0.04)',
    overflow: 'hidden',
  },
  noteSection: {
    padding: 14,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  notesCardTitle: {
    color: '#ffd700',
    fontWeight: '900',
    fontSize: 13,
    flex: 1,
  },
  reminderCount: {
    color: '#ff6b9d',
    fontSize: 11,
    fontWeight: '800',
  },
  notesCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,107,157,0.2)',
    marginHorizontal: 0,
  },
  remindersSection: {
    padding: 14,
    borderTopWidth: 0,
  },
  emptyTextDim: {
    color: '#4a5a7e',
    fontSize: 12,
    fontStyle: 'italic',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,107,157,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.22)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff6b9d',
    marginBottom: 8,
  },
  reminderDone: {
    opacity: 0.5,
    borderLeftColor: '#3cffb3',
  },
  reminderTitle: {
    color: '#e8f3ff',
    fontSize: 13,
    fontWeight: '800',
  },
  reminderTitleDone: {
    textDecorationLine: 'line-through',
    color: '#8aa4ff',
  },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  reminderTime: { color: '#ff6b9d', fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: 4 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  // Time picker drum-roll
  timeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.3)',
    backgroundColor: 'rgba(255,107,157,0.06)',
    marginBottom: 12,
    marginTop: 4,
  },
  timeToggleLabel: {
    flex: 1,
    color: '#8aa4ff',
    fontWeight: '800',
    fontSize: 15,
  },
  drumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 4,
  },
  drumCol: {
    alignItems: 'center',
  },
  drumColLabel: {
    color: '#5a6e9e',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  drumWrap: {
    width: 56,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(122,92,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.25)',
    position: 'relative',
  },
  drumSelector: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,107,157,0.15)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,107,157,0.45)',
    zIndex: 1,
  },
  drumScroll: {
    flex: 1,
  },
  drumItem: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumItemText: {
    color: '#8aa4ff',
    fontSize: 20,
    fontWeight: '700',
  },
  drumItemActive: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 22,
  },
  drumColon: {
    color: '#ff6b9d',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 20,
    marginHorizontal: 2,
  },
  ampmCol: {
    gap: 8,
    marginTop: 0,
  },
  ampmBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.3)',
    backgroundColor: 'rgba(122,92,255,0.08)',
  },
  ampmBtnActive: {
    borderColor: '#ff6b9d',
    backgroundColor: 'rgba(255,107,157,0.18)',
  },
  ampmText: {
    color: '#8aa4ff',
    fontWeight: '900',
    fontSize: 13,
  },
  ampmTextActive: {
    color: '#ff6b9d',
  },
  // Picker styles
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 16,
  },
  pickerOption: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  pickerOptionGrad: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  pickerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pickerLabel: {
    color: '#e8f3ff',
    fontWeight: '900',
    fontSize: 13,
  },
  pickerSub: {
    color: '#8aa4ff',
    fontSize: 11,
    fontWeight: '700',
  },
}) as unknown as Record<string, any>;


