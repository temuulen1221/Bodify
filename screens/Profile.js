import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { auth, db } from '../services/firebase';
import { setProfile } from '../store';
import { COLORS, GRADIENTS } from '../utils/constants';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { height, weight, bodyShape, avatarName, points, pointsMax, photoUri, level, gender } = useSelector((state) => state.user);
  const [editMode, setEditMode] = useState(false);
  const [nameInput, setNameInput] = useState(avatarName || '');
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const lastSyncedRef = useRef(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, [sweep]);

  const normalizeProfile = (src) => ({
    avatarName: (src?.avatarName ?? '').trim(),
    height: String(src?.height ?? '').trim(),
    weight: String(src?.weight ?? '').trim(),
    bodyShape: String(src?.bodyShape ?? '').trim(),
    photoUri: String(src?.photoUri ?? '').trim(),
    gender: String(src?.gender ?? '').trim(),
  });

  useEffect(() => {
    // Header is managed by expo-router; keep this for interop safety
    navigation.setOptions?.({
      title: 'Profile',
      headerStyle: { backgroundColor: '#4F8EF7' },
      headerTintColor: '#FFF',
    });
  }, [navigation]);

  // Listen for auth changes and load profile from Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid || null);
      if (!user?.uid) return;
      setLoading(true);
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          // Merge remote data into Redux profile
          dispatch(setProfile({
            avatarName: data.avatarName ?? avatarName,
            height: data.height ?? height,
            weight: data.weight ?? weight,
            bodyShape: data.bodyShape ?? bodyShape,
            photoUri: data.photoUri ?? photoUri,
            gender: data.gender ?? gender,
          }));
          if (typeof data.avatarName === 'string') setNameInput(data.avatarName);
          // Track last synced snapshot to prevent immediate auto write-back
          lastSyncedRef.current = normalizeProfile({
            avatarName: data.avatarName,
            height: data.height,
            weight: data.weight,
            bodyShape: data.bodyShape,
            photoUri: data.photoUri,
            gender: data.gender,
          });
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [auth]);

  const bmi = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) return null;
    const meters = h / 100;
    const b = w / (meters * meters);
    if (!isFinite(b)) return null;
    return Math.round(b * 10) / 10; // 1 decimal
  }, [height, weight]);

  const progressPct = useMemo(() => {
    const max = Number(pointsMax) || 1;
    const val = Math.min(max, Math.max(0, Number(points) || 0));
    return Math.round((val / max) * 100);
  }, [points, pointsMax]);

  const handleSaveName = async () => {
    const name = nameInput.trim();
    dispatch(setProfile({ avatarName: name }));
    setEditMode(false);
    if (!uid) return;
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(ref, { avatarName: name }, { merge: true });
      // Update last-synced snapshot for name
      lastSyncedRef.current = {
        ...(lastSyncedRef.current || {}),
        avatarName: name,
        height: String(height || ''),
        weight: String(weight || ''),
        bodyShape: String(bodyShape || ''),
        photoUri: String(photoUri || ''),
        gender: String(gender || ''),
      };
    } catch (e) {
      console.warn('Failed to save name', e);
    }
  };

  const handleSyncAll = async () => {
    if (!uid) return;
    setSyncing(true);
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(
        ref,
        {
          avatarName: avatarName || '',
          height: height || '',
          weight: weight || '',
          bodyShape: bodyShape || '',
          photoUri: photoUri || '',
          gender: gender || '',
        },
        { merge: true }
      );
      lastSyncedRef.current = normalizeProfile({ avatarName, height, weight, bodyShape, photoUri, gender });
      alert('Profile synced');
    } catch (e) {
      console.warn('Sync failed', e);
      alert('Could not sync profile.');
    } finally {
      setSyncing(false);
    }
  };

  // Debounced auto-sync for profile changes
  useEffect(() => {
    if (!uid || loading) return;
    const current = normalizeProfile({ avatarName, height, weight, bodyShape, photoUri, gender });
    const last = lastSyncedRef.current;
    const changed = !last || Object.keys(current).some((k) => current[k] !== last[k]);
    if (!changed) return;

    const timer = setTimeout(async () => {
      try {
        const ref = doc(db, 'users', uid);
        await setDoc(ref, current, { merge: true });
        lastSyncedRef.current = current;
      } catch (e) {
        console.warn('Auto-sync failed', e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [uid, loading, avatarName, height, weight, bodyShape, photoUri, gender]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      alert('Signed out');
    } catch (e) {
      console.warn('Sign out failed', e);
      alert('Could not sign out.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0f1a' }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard} onLayout={(e) => setHeaderWidth(e.nativeEvent.layout.width)}>
          <View style={{ marginBottom: 8 }}>
            <BackButton />
          </View>
          {headerWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.headerGlowSweep,
                {
                  transform: [
                    {
                      translateX: sweep.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-headerWidth * 0.5, headerWidth * 0.5],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  'rgba(0,231,255,0)',
                  'rgba(0,231,255,0.35)',
                  'rgba(0,231,255,0)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          )}
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(avatarName || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              {editMode ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameInput}
                    onChangeText={setNameInput}
                    placeholder="Enter display name"
                    placeholderTextColor="rgba(255,255,255,0.75)"
                    style={styles.nameInput}
                  />
                  <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
                    <Text style={styles.saveNameBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>{avatarName || 'Unknown User'}</Text>
                  <TouchableOpacity onPress={() => setEditMode(true)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.levelText}>Level {level ?? 1}</Text>
              <View style={styles.progressWrap}>
                <View style={styles.progressBarBg}>
                  <LinearGradient colors={[COLORS.neonCyan, COLORS.neonPurple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{points}/{pointsMax} XP</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => navigation.navigate('Avatar')} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.neonAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGrad}> 
                <Text style={styles.headerActionText}>Edit Avatar</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => alert('Tracking progress...')} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.neonAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGrad}> 
                <Text style={styles.headerActionText}>Track</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleSyncAll} disabled={!uid || syncing} activeOpacity={0.9}>
              <LinearGradient colors={GRADIENTS.neonAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGrad}> 
                <Text style={styles.headerActionText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerActionBtn, styles.signOutBtn]} onPress={handleSignOut} activeOpacity={0.9}>
              <LinearGradient colors={[ '#E53935', '#D81B60' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGrad}> 
                <Text style={styles.headerActionText}>Sign out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.title}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Height</Text>
              <Text style={styles.statValue}>{height ? `${height} cm` : '—'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>{weight ? `${weight} kg` : '—'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>BMI</Text>
              <Text style={styles.statValue}>{bmi ?? '—'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Body Shape</Text>
              <Text style={styles.statValue}>{bodyShape ? bodyShape.charAt(0).toUpperCase() + bodyShape.slice(1) : '—'}</Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.title}>Achievements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
            {[
              { key: 'streak', label: '7-day Streak', emoji: '🔥' },
              { key: 'first', label: 'First Workout', emoji: '🏅' },
              { key: 'lvl', label: `Level ${level ?? 1}`, emoji: '⭐' },
              { key: 'bmi', label: bmi ? `BMI ${bmi}` : 'Health Check', emoji: '💙' },
            ].map((b) => (
              <View key={b.key} style={styles.badge}>
                <LinearGradient colors={GRADIENTS.neonBar} style={styles.badgeCircle}>
                  <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                </LinearGradient>
                <Text style={styles.badgeLabel}>{b.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom Settings shortcut */}
      <View style={[styles.menuWrapper, { left: 24, right: undefined }]}>
        <LinearGradient colors={GRADIENTS.neonBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.menuIconCircle}>
          <TouchableOpacity style={styles.menuIconInner} onPress={() => navigation.navigate('settings')}>
            <Text style={styles.menuIcon}>⚙️</Text>
          </TouchableOpacity>
        </LinearGradient>
        <Text style={[styles.menuDesc, styles.menuLabelPill]}>Settings</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerCard: { margin: 15, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.4)', shadowColor: COLORS.neonPurple, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.32, shadowRadius: 16, elevation: 8 },
  headerGlowSweep: { position: 'absolute', left: '50%', top: 0, width: 140, height: '100%', opacity: 0.8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: { width: 72, height: 72 },
  avatarImg: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(0,231,255,0.7)' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,231,255,0.5)' },
  avatarInitial: { color: '#fff', fontSize: 28, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,231,255,0.45)' },
  saveNameBtn: { marginLeft: 8, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 10, overflow: 'hidden' },
  saveNameBtnText: { color: '#fff', fontWeight: '700' },
  displayName: { fontSize: 20, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,231,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  editBtnText: { color: '#cfe3ff', fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4 },
  levelText: { color: '#cfe3ff', marginTop: 4, marginBottom: 8, fontWeight: '700' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 10, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', overflow: 'hidden' },
  progressBarFill: { height: 10, borderRadius: 6 },
  progressLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  headerActionBtn: { paddingHorizontal: 0, paddingVertical: 0, borderRadius: 10, overflow: 'hidden' },
  actionGrad: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, shadowColor: COLORS.neonMagenta, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 },
  headerActionText: { color: '#fff', fontWeight: '700' },
  signOutBtn: { },
  menuWrapper: { position: 'absolute', right: 24, bottom: 40, alignItems: 'center', width: 70, zIndex: 20 },
  menuIconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.neonPurple, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', overflow: 'hidden' },
  menuIconInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 28,
    color: '#fff',
  },
  menuDesc: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  menuLabelPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  container: { flex: 1, backgroundColor: 'transparent' },
  card: { backgroundColor: 'rgba(0,0,0,0.35)', padding: 16, margin: 15, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', shadowColor: COLORS.neonPurple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  title: { fontSize: 18, fontWeight: '800', color: '#E8F9FF', marginBottom: 10, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1.2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', paddingVertical: 8 },
  statLabel: { fontSize: 12, color: '#b9c6ff', marginBottom: 4, fontWeight: '700' },
  statValue: { fontSize: 18, color: '#ffffff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});

export default ProfileScreen;