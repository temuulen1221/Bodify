import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { listBodyParts, listByBodyPart, searchExercises } from '../services/exercisedb';
import { fetchRecentActivities, getStoredToken, signInWithStrava } from '../services/strava';
import { addWorkoutSession } from '../store';

const templates = [
  { key: 'strength_full', title: 'Full Body Circuit', type: 'strength', durationMin: 40, calories: 350, icon: 'barbell' },
  { key: 'cardio_blast', title: 'Cardio Blast', type: 'cardio', durationMin: 25, calories: 220, icon: 'pulse' },
  { key: 'core_focus', title: 'Core Focus', type: 'strength', durationMin: 20, calories: 150, icon: 'flash' },
  { key: 'yoga_flow', title: 'Yoga Flow', type: 'mobility', durationMin: 30, calories: 120, icon: 'leaf' },
];

const QuickStartList = React.memo(function QuickStartList({ onPick }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.templatesScroller}
      contentContainerStyle={styles.templatesRow}
    >
      {templates.map((tpl) => (
        <Pressable key={tpl.key} onPress={() => onPick(tpl)} style={styles.cardPress}>
          <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <Ionicons name={tpl.icon} size={22} color="#fff" />
            <Text numberOfLines={2} style={styles.cardTitle}>{tpl.title}</Text>
            <Text style={styles.cardMeta}>{`${tpl.durationMin} min · ${tpl.calories} kcal`}</Text>
            <Text style={styles.cardHint}>Tap to log</Text>
          </LinearGradient>
        </Pressable>
      ))}
    </ScrollView>
  );
});

export default function Workout() {
  const dispatch = useDispatch();
  const sessionsByDate = useSelector((state) => state.workouts?.sessionsByDate || {});

  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);

  // ExerciseDB state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [exdbError, setExdbError] = useState('');
  const [parts, setParts] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Enable LayoutAnimation on Android to smooth layout changes
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Load ExerciseDB body parts once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPartsLoading(true);
        const data = await listBodyParts();
        if (!cancelled) setParts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setExdbError(String(e?.message || e));
      } finally {
        if (!cancelled) setPartsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear search state whenever this screen is focused (so a "refresh"/re-enter resets results)
  useFocusEffect(
    useCallback(() => {
      setSearchQuery('');
      setSelectedPart('');
      setResults([]);
      setExdbError('');
      return undefined;
    }, [])
  );

  const runSearch = async () => {
    try {
      setExdbError('');
      setResultsLoading(true);
      let data = [];
      const query = searchQuery.trim();
      if (query) {
        data = await searchExercises(query, 0, 20);
      } else if (selectedPart) {
        data = await listByBodyPart(selectedPart, 0, 20);
      } else {
        data = [];
      }
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('ExerciseDB search/list failed', e);
      setExdbError(String(e?.message || e));
    } finally {
      setResultsLoading(false);
    }
  };

  const pickPart = async (part) => {
    const next = part === selectedPart ? '' : part;
    setSelectedPart(next);
    setSearchQuery('');
    if (!next) {
      setResults([]);
      return;
    }
    try {
      setExdbError('');
      setResultsLoading(true);
      const data = await listByBodyPart(next, 0, 20);
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('ExerciseDB list failed', e);
      setExdbError(String(e?.message || e));
    } finally {
      setResultsLoading(false);
    }
  };

  const logExercise = (ex) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const title = (ex?.name || 'Exercise').replace(/\b\w/g, (m) => m.toUpperCase());
    const notes = [ex?.bodyPart, ex?.target, ex?.equipment].filter(Boolean).join(' · ');
    dispatch(
      addWorkoutSession({
        date: todayKey,
        session: {
          title,
          durationMin: 20,
          calories: 120,
          type: 'strength',
          notes,
          createdAt: Date.now(),
        },
      })
    );
  };

  const logTemplate = useCallback((tpl) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    dispatch(
      addWorkoutSession({
        date: todayKey,
        session: {
          title: tpl.title,
          durationMin: tpl.durationMin,
          calories: tpl.calories,
          type: tpl.type,
          createdAt: Date.now(),
        },
      })
    );
  }, [dispatch, todayKey]);

  const todays = sessionsByDate[todayKey] || [];
  const recent = useMemo(() => {
    const items = [];
    const keys = Object.keys(sessionsByDate);
    for (const k of keys) {
      const list = sessionsByDate[k] || [];
      for (const s of list) {
        const ts = typeof s.createdAt === 'number'
          ? s.createdAt
          : (/^\d+$/.test(String(s.id || '')) ? Number(s.id) : new Date(k).getTime());
        items.push({ date: k, ...s, _sort: ts });
      }
    }
    items.sort((a, b) => (b._sort || 0) - (a._sort || 0));
    return items.slice(0, 50);
  }, [sessionsByDate]);
  // Recent list is always scrollable; no expand/collapse, so show full data

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0d1024", "#0a0f1e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerWrap}>
        <LinearGradient colors={["rgba(122,92,255,0.35)", "rgba(0,234,255,0.35)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <BackButton />
          <Text style={styles.headerText}>Workout</Text>
        </LinearGradient>
      </LinearGradient>

      {/* Connect/import from Strava */}
      <View style={styles.connectRow}>
        <Pressable
          disabled={connecting}
          onPress={async () => {
            try {
              setConnecting(true);
              await signInWithStrava();
            } catch (e) {
              console.warn('Strava connect failed', e);
            } finally {
              setConnecting(false);
            }
          }}
          style={({ pressed }) => [styles.connectBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.connectText}>{connecting ? 'Connecting…' : 'Connect Strava'}</Text>
        </Pressable>
        <Pressable
          disabled={importing}
          onPress={async () => {
            try {
              setImporting(true);
              const token = await getStoredToken();
              if (!token) {
                await signInWithStrava();
              }
              const acts = await fetchRecentActivities(5);
              for (const a of acts) {
                const start = new Date(a.start_date_local || a.start_date);
                const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                dispatch(
                  addWorkoutSession({
                    date: key,
                    session: {
                      id: String(a.id),
                      title: a.name || 'Strava Activity',
                      durationMin: Math.max(1, Math.round((a.moving_time || a.elapsed_time || 0) / 60)),
                      calories: Math.round(a.kilojoules || a.calories || 0),
                      type: (a.sport_type || a.type || 'cardio').toLowerCase().includes('run') || (a.sport_type || '').toLowerCase().includes('ride') ? 'cardio' : 'strength',
                      createdAt: new Date(a.start_date_local || a.start_date).getTime(),
                    },
                  })
                );
              }
            } catch (e) {
              console.warn('Import failed', e);
            } finally {
              setImporting(false);
            }
          }}
          style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.connectText}>{importing ? 'Importing…' : 'Import Strava'}</Text>
        </Pressable>
      </View>

      {/* Quick templates */}
      <Text style={styles.sectionLabel}>Quick Start</Text>
      <QuickStartList onPick={logTemplate} />

      {/* ExerciseDB search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            placeholder="Search exercises by name"
            placeholderTextColor="#9fb3ff"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={runSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <Pressable onPress={runSearch} style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSearchQuery('');
            setSelectedPart('');
            setResults([]);
            setExdbError('');
          }}
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.searchBtnText}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partsRow}>
        {partsLoading ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator color="#00eaff" />
          </View>
        ) : (
          parts.map((p) => {
            const active = p === selectedPart;
            return (
              <Pressable key={String(p)} onPress={() => pickPart(p)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={styles.chipText}>{String(p).replace(/\b\w/g, (m) => m.toUpperCase())}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {exdbError ? <Text style={styles.errorText}>{exdbError}</Text> : null}

      {resultsLoading ? (
        <View style={{ paddingVertical: 12 }}>
          <ActivityIndicator color="#7a5cff" />
        </View>
      ) : (searchQuery.trim() || selectedPart) && results?.length ? (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => String(item.id ?? `${item.name}-${idx}`)}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.resultItem}>
              {item?.gifUrl ? (
                <Image source={{ uri: item.gifUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons name="body" size={20} color="#7a5cff" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{(item.name || 'Exercise').replace(/\b\w/g, (m) => m.toUpperCase())}</Text>
                <Text style={styles.itemMeta}>{[item.bodyPart, item.target, item.equipment].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pressable onPress={() => logExercise(item)} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          )}
        />
      ) : null}

  {/* Today section removed per request to save space */}

  {/* Spacer to push Recent towards the bottom */}
  <View style={{ flexGrow: 1 }} />
  <View style={{ height: 84 }} />

  {/* Recent history (fixed-height list; scroll for more) */}
  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Recent</Text>
      {recent.length > 0 ? (
        <FlatList
          data={recent}
          keyExtractor={(item, idx) => `${item.date}-${item.id}-${idx}`}
          style={[styles.list, { height: 110 }]}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Ionicons name={item.type === 'strength' ? 'barbell' : (item.type === 'cardio' ? 'pulse' : 'flash')} size={16} color="#00eaff" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>{`${item.date} · ${item.durationMin} min · ${item.calories} kcal`}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>No recent sessions.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080b16',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerWrap: {
    borderRadius: 18,
    padding: 2,
    marginBottom: 12,
  },
  header: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  headerText: { color: '#d9eaff', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 },
  sectionLabel: { color: '#9feaff', fontWeight: '900', fontSize: 13, marginBottom: 6 },
  templatesRow: { paddingHorizontal: 2, gap: 8 },
  templatesScroller: { height: 140 },
  cardPress: { marginRight: 8 },
  card: {
    width: 180,
    height: 120,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#0d1330',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.35)'
  },
  cardTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  cardMeta: { color: '#e6f1ff', fontWeight: '700', fontSize: 12, opacity: 0.95 },
  cardHint: { color: '#ffffff', fontWeight: '800', fontSize: 11, opacity: 0.85 },
  connectRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  connectBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,234,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtn: {
    flex: 1,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: { color: '#e8f3ff', fontWeight: '900' },
  list: { marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)',
    marginBottom: 6,
  },
  itemTitle: { color: '#e8f3ff', fontSize: 14, fontWeight: '900' },
  itemMeta: { color: '#a7c2ff', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#8aa4ff', fontSize: 12 },
  // ExerciseDB styles
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
  searchInputWrap: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)',
    backgroundColor: 'rgba(122,92,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: { color: '#e8f3ff', fontSize: 13, fontWeight: '700', padding: 0 },
  searchBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  clearBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,234,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)'
  },
  searchBtnText: { color: '#e8f3ff', fontWeight: '900' },
  partsRow: { paddingVertical: 4, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,234,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.25)',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(122,92,255,0.18)',
    borderColor: 'rgba(122,92,255,0.55)'
  },
  chipText: { color: '#d9eaff', fontWeight: '800', fontSize: 12 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(122,92,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.25)',
    marginBottom: 8,
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: 'rgba(122,92,255,0.12)'
  },
  thumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(122,92,255,0.12)'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,234,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0,234,255,0.45)'
  },
  addBtnText: { color: '#ffffff', fontWeight: '900' },
  errorText: { color: '#ff9b9b', fontWeight: '800', marginBottom: 6 },
  moreBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(122,92,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(122,92,255,0.35)'
  },
  moreBtnText: { color: '#e8f3ff', fontWeight: '900' },
});
