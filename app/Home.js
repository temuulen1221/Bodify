import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import Avatar from '../components/avatar';
import AvatarWeb from '../components/AvatarWeb';
import StepsWidget from '../components/StepsWidget';
import { useVroidAuth } from '../components/useVroidAuth';
import { auth, db } from '../services/firebase';
import { addXP, markDayComplete, markQuestXPAwarded, markSessionXPAwarded, registerWorkoutDay } from '../store';
import { COLORS, GRADIENTS } from '../utils/constants';

// Avatar implementation now uses unified Avatar component

// Module-scope window dimensions for use in StyleSheet
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const HomeScreen = () => {
  const router = useRouter();
  // State for menu visibility
  const [menuVisible, setMenuVisible] = useState(false);
  // Redux state for user stats and profile name
  const { level, points, pointsMax, avatarName, gender, height, weight, photoUri } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  // Wire daily quests to live trackers
  const stepsByDate = useSelector((s) => s.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((s) => s.workouts?.sessionsByDate || {});
  const dateObj = new Date();
  const todayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const todaySteps = stepsByDate[todayKey] || 0;
  // Infer push-up reps if present in session data (field `reps` or `pushups`), else 0
  const todaySessions = sessionsByDate[todayKey] || [];
  const pushupReps = todaySessions.reduce((sum, s) => {
    const reps = Number(s.reps ?? s.pushups);
    const type = (s.type || '').toString().toLowerCase();
    if (Number.isFinite(reps) && reps > 0) return sum + reps;
    if (type.includes('push')) return sum; // no explicit reps yet
    return sum;
  }, 0);
  // Hydration not yet tracked; keep placeholder progress until we add a hydration tracker slice
  const waterLiters = 0; // TODO: replace with hydration tracker state
  const dailyQuests = [
    {
      title: 'Complete 10,000 steps',
      progress: todaySteps,
      goal: 10000,
      reward: '50 XP',
    },
    {
      title: 'Drink 2L of water',
      progress: waterLiters,
      goal: 2,
      reward: '10 XP',
    },
    {
      title: 'Do 20 push-ups',
      progress: pushupReps,
      goal: 20,
      reward: '15 XP',
    },
  ];

  // State for treasure claim and USD
  const [treasureClaimed, setTreasureClaimed] = useState(false);
  const [treasureClaimedAt, setTreasureClaimedAt] = useState(null);
  const [usd, setUsd] = useState(0);

  // Check if 24h passed since last claim
  const canClaimTreasure = dailyQuests.every(q => q.progress >= q.goal) && (!treasureClaimedAt || (Date.now() - treasureClaimedAt > 24 * 60 * 60 * 1000));

  // Mark calendar day complete if all quests done
  useEffect(() => {
    // Use JSON stringification to create a stable dependency for the array contents
    const allDone = dailyQuests.every(q => q.progress >= q.goal);
    if (allDone) {
      const d = new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dispatch(markDayComplete(key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dailyQuests), dispatch]);

  // Automatically award XP for each completed daily quest once per day
  const questsAwardedMap = useSelector((state) => state.quests?.xpAwardedByDate || {});
  useEffect(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const awardedToday = questsAwardedMap[todayKey] || {};
    dailyQuests.forEach((q, i) => {
      if (q.progress >= q.goal) {
        const questKey = `quest_${i}`;
        if (!awardedToday[questKey]) {
          // Parse reward like '50 XP'
          const match = String(q.reward || '').match(/(\d+)\s*XP/i);
          const xp = match ? parseInt(match[1], 10) : 0;
          if (xp > 0) {
            dispatch(addXP(xp));
            dispatch(markQuestXPAwarded({ date: todayKey, key: questKey }));
          }
        }
      }
    });
  }, [dailyQuests, questsAwardedMap, dispatch]);

  // Reset treasure after 24h
  if (treasureClaimed && treasureClaimedAt && (Date.now() - treasureClaimedAt > 24 * 60 * 60 * 1000)) {
    setTreasureClaimed(false);
    setTreasureClaimedAt(null);
  }

  // Reset dailyQuests if last reset is not today
  useEffect(() => {
    const resetDailyQuestsIfNeeded = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
  let snap;
  let data = {};
      try {
        snap = await getDoc(userRef);
        data = snap.exists() ? snap.data() : {};
      } catch (err) {
        console.warn('[Home] Firestore getDoc failed (offline?): using defaults, will retry later.', err);
        return; // abort reset logic silently; next render/effect will retry
      }
      const lastReset = data.lastQuestReset;
      const today = new Date().toISOString().slice(0, 10);
      if (lastReset !== today) {
        // Use the same default quests as in your UI
        const defaultQuests = [
          {
            title: 'Complete 10,000 steps',
            progress: 0,
            goal: 10000,
            reward: '50 XP',
          },
          {
            title: 'Drink 2L of water',
            progress: 0,
            goal: 2,
            reward: '10 XP',
          },
          {
            title: 'Do 20 push-ups',
            progress: 0,
            goal: 20,
            reward: '15 XP',
          },
        ];
        try {
          await setDoc(userRef, {
            dailyQuests: defaultQuests,
            lastQuestReset: today
          }, { merge: true });
        } catch (err) {
          console.warn('[Home] Firestore setDoc failed (offline?): changes not saved yet.', err);
        }
      }
    };
    resetDailyQuestsIfNeeded();
  }, []);

  const { avatars, selectedAvatarUrl, signIn, selectAvatar } = useVroidAuth();

  // Animation for character
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -20,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  // One-time greeting bubble that fades away after entering Home
  const [showGreeting, setShowGreeting] = useState(true);
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const greetTranslate = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (!showGreeting) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(greetOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(greetTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1800),
      Animated.parallel([
        Animated.timing(greetOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(greetTranslate, {
          toValue: -6,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setShowGreeting(false));
  }, [showGreeting, greetOpacity, greetTranslate]);

  // Neon glow sweep for top bar (to match tab bar)
  const [topBarWidth, setTopBarWidth] = useState(0);
  const topSweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(topSweep, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(topSweep, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, [topSweep]);

  // Removed workout handler as workout menu was deleted
  // workout handler removed — no placeholder needed
  const goToProfile = () => router.push('/Profile');

  // Responsive avatar surface size based on screen
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
  // Responsive avatar box: derive directly from screen percentages with light breakpoints
  // Width: occupy ~95% of screen width (centered). Height: scale by viewport height tier.
  // This removes prior clamp logic so large screens can show a proportionally larger avatar while
  // still capping extreme small screens with sensible minimums.
  const AVATAR_W = Math.max(280, Math.round(SCREEN_W * 0.95));
  const AVATAR_H = (() => {
    if (SCREEN_H < 640) return Math.round(SCREEN_H * 0.56);      // very small displays
    if (SCREEN_H < 800) return Math.round(SCREEN_H * 0.60);      // phones / short viewports
    if (SCREEN_H < 1000) return Math.round(SCREEN_H * 0.66);     // tablets / medium
    return Math.round(SCREEN_H * 0.72);                          // large desktop screens
  })();

  // Dynamic bottom inset (in pixels) to keep feet above global tab bar / bottom UI.
  // Uses ~12% of screen height as heuristic; can be refined by measuring tab bar onLayout if needed.
  const BOTTOM_INSET_PX = Math.round(SCREEN_H * 0.12);

  // Responsive anchors based on device dimensions handled in StyleSheet via WINDOW_WIDTH/HEIGHT

  // Automatically award XP for workouts based on burned calories
  const sessionAwardsByDate = useSelector((state) => state.workouts?.xpAwardedSessionIdsByDate || {});
  useEffect(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const sessions = sessionsByDate[todayKey] || [];
    const awarded = sessionAwardsByDate[todayKey] || {};
    const xpFromCalories = (c) => {
      if (c >= 500) return 50;
      if (c >= 400) return 35;
      if (c >= 300) return 20;
      return 0;
    };
    sessions.forEach((s) => {
      const already = awarded[s.id];
      const xp = xpFromCalories(Number(s.calories || 0));
      if (!already && xp > 0) {
        dispatch(addXP(xp));
        dispatch(markSessionXPAwarded({ date: todayKey, sessionId: s.id }));
        dispatch(registerWorkoutDay(todayKey));
      }
    });
  }, [sessionsByDate, sessionAwardsByDate, dispatch]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/homescreen.png')}
        style={styles.background}
        resizeMode="cover"
      />
      {/* Subtle cozy gradient overlay */}
      <LinearGradient
        colors={["rgba(79,142,247,0.20)", "rgba(0,0,0,0.25)"]}
        start={{x:0.5, y:0}}
        end={{x:0.5, y:1}}
        style={styles.gradientOverlay}
      />

      {/* Top bar with user stats (cyberpunk neon) */}
      <LinearGradient
        colors={["#5421FF", "#6A00FF", "#00E7FF"]}
        start={{x:0,y:0}}
        end={{x:1,y:1}}
        style={styles.topBar}
        onLayout={(e) => setTopBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Animated glow sweep */}
        {topBarWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.topGlowSweep,
              {
                transform: [
                  {
                    translateX: topSweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-topBarWidth * 0.5, topBarWidth * 0.5],
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
        <View style={styles.levelBadgeContainer}>
          <Svg height="48" width="48" viewBox="0 0 48 48">
            <Polygon
              points="24,4 44,14 44,34 24,44 4,34 4,14"
              fill="rgba(0,0,0,0.35)"
              stroke="rgba(0,231,255,0.75)"
              strokeWidth="1.5"
            />
          </Svg>
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <View style={styles.statsContainer}>
          <Text style={styles.h3Title} numberOfLines={1}>{avatarName || 'Player'}</Text>
          <Text style={[styles.statsPoints, {color:'#E8F9FF', opacity: 0.95}]}>{points}/{pointsMax} points</Text>
          <View style={styles.pointsBarBg}>
            <LinearGradient
              colors={["#00E7FF", "#6A00FF"]}
              start={{x:0,y:0}}
              end={{x:1,y:0}}
              style={[styles.pointsBarFill, { width: `${Math.min(100, Math.round((points/Math.max(1,pointsMax))*100))}%` }]}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Quest section (transparent) */}
  <View style={styles.questSectionContainer}>
        <View style={styles.questCardInner}>
  <View style={styles.questSectionHeader}>
          {/* Treasure icon left of Daily Quests */}
          <TouchableOpacity
            style={styles.treasureIconButton}
            disabled={!canClaimTreasure}
            onPress={() => {
              if (canClaimTreasure) {
                setTreasureClaimed(true);
                setTreasureClaimedAt(Date.now());
                setUsd(usd + 1);
              }
            }}
          >
            <Text style={[
              styles.treasureIcon,
              canClaimTreasure ? styles.treasureIconActive : styles.treasureIconInactive
            ]}>
              {treasureClaimed && treasureClaimedAt && (Date.now() - treasureClaimedAt <= 24 * 60 * 60 * 1000) ? '🎉' : '🪙'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.questSectionTitle, styles.questTitlePill]}>Daily Quests</Text>
        </View>
        <ScrollView
          style={styles.questSectionBody}
          contentContainerStyle={styles.questListContent}
          showsVerticalScrollIndicator={false}
        >
          {dailyQuests.map((q, i) => {
            const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
            return (
              <View key={i} style={[styles.questItemPill, styles.questPillSingle]}> 
                <View style={styles.questPillHeaderRow}>
                  <Text style={styles.questTitle} numberOfLines={1}>{q.title}</Text>
                  <Text style={styles.questReward}>{q.reward}</Text>
                </View>
                <View style={styles.questProgressBarBg}>
                  <LinearGradient
                    colors={[COLORS.neonCyan, COLORS.neonPurple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.questProgressBarFill, { width: `${pct}%` }]}
                  />
                </View>
                <Text style={styles.questProgressText}>{q.progress} / {q.goal}</Text>
              </View>
            );
          })}
        </ScrollView>
        </View>
      </View>

      {/* Collected USD and Profile section at top right (neon, no animation) */}
      <View style={styles.topBarRight}>
        <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.usdPillOuter}>
          <View style={styles.usdSection}>
            <Text style={styles.usdIcon}>💵</Text>
            <Text style={styles.usdText}>{`$${usd.toFixed(2)}`}</Text>
          </View>
        </LinearGradient>
        <StepsWidget style={{ marginLeft: 8 }} />
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={goToProfile} style={styles.profileTouch} activeOpacity={0.85}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.profileRing}>
              <View style={styles.profileButton}>
                <Image
                  source={require('../assets/images/react-logo.png')}
                  style={styles.profileAvatar}
                />
              </View>
            </LinearGradient>
            <Text style={styles.profileLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.room}>
  <View style={[styles.avatarAnchor, { width: AVATAR_W, height: AVATAR_H }]}> 
        {/* VRM Avatar integration for HomeScreen */}
        {/* Unified avatar: use WebGL-based fiber VRM viewer on web, native GLView avatar elsewhere */}
        {Platform.OS === 'web' ? (
          <AvatarWeb
            gender={gender}
            height={height}
            weight={weight}
            alignFootToBottom
            bottomPadding={0.02}
            bottomInsetPx={BOTTOM_INSET_PX}
            headMargin={0.06}
            autoFit
            focus="upper"
            fitMode="shrink"
            targetFill={0.92}
            footLift={-0.015}
            showExpressionButtons
            expressionButtons={[
              { label: 'Neutral', emoji: '😐' },
              { label: 'Smiling', emoji: '🙂' },
              { label: 'Happy', emoji: '😄' },
              { label: 'Angry', emoji: '😠' },
              { label: 'Surprised', emoji: '😮' },
              { label: 'Sad', emoji: '😢' },
              { label: 'Closed', emoji: '😴' },
              { label: 'A', emoji: '🅰️' },
              { label: 'I', emoji: 'ℹ️' },
              { label: 'U', emoji: '🔄' },
              { label: 'E', emoji: '📧' },
              { label: 'O', emoji: '⭕' },
            ]}
          />
        ) : selectedAvatarUrl ? (
          <Avatar
            model={selectedAvatarUrl}
            height={height}
            weight={weight}
            gender={gender}
            photoUri={photoUri}
          />
        ) : (
          <Avatar
            height={height}
            weight={weight}
            gender={gender}
            photoUri={photoUri}
            sizeMultiplier={1.2}
          />
        )}
        
      </View>
      </View>

      {/* Bottom tab navigation removed; using the global Tabs bar */}

      {/* Hide/Show tab for stacked blue menu buttons */}
      <View style={styles.menuTabContainer}>
        <TouchableOpacity onPress={() => setMenuVisible((v) => !v)}>
          <LinearGradient colors={GRADIENTS.blue50} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuTabButton}>
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
              <Text style={styles.menuTabText}>MENU</Text>
              <Text style={styles.menuTabArrow}>{menuVisible ? '▲' : '▼'}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      {menuVisible && (
        <View style={styles.menuStackedAll}>
          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/Leaderboard')}>
                <Text style={styles.menuIcon}>🏆</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>{'  Leader  \nboard'}</Text>
          </View>

          {/* Workout menu item removed */}
          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/Rest')}>
                <Text style={styles.menuIcon}>🧘‍♂️</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>Rest</Text>
          </View>

          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/Shop')}>
                <Text style={styles.menuIcon}>🛒</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>Shop</Text>
          </View>

          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/Analysis')}>
                <Text style={styles.menuIcon}>📈</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>Analysis</Text>
          </View>

          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/battle-replay')}>
                <Text style={styles.menuIcon}>⚔️</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>Battle</Text>
          </View>

          <View style={styles.menuStackedItem}>
            <LinearGradient colors={GRADIENTS.neonBar} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.menuIconCircle}>
              <TouchableOpacity style={styles.menuIconInner} onPress={() => router.push('/Pose')}>
                <Text style={styles.menuIcon}>�</Text>
              </TouchableOpacity>
            </LinearGradient>
            <Text style={[styles.menuDesc, styles.menuLabelPill]}>Pose</Text>
          </View>
        </View>

      )}
    </View>
  );
}

const styles = StyleSheet.create({
  questSectionContainer: {
    position: 'absolute',
    left: 15,
    top: 118,
    right: 200,
    zIndex: 25,
    borderRadius: 22,
    padding: 1,
    shadowColor: 'transparent',
  },
  questCardInner: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 22, paddingVertical: 1, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  questSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
    minHeight: 1,
    gap: 1,
  },
  treasureIconButton: {
    marginRight: 4,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
  },
  treasureIcon: {
    fontSize: 20,
    marginRight: 2,
    marginLeft: 2,
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  treasureIconActive: {
    opacity: 1,
    color: '#FFD700',
  },
  treasureIconInactive: {
    opacity: 0.4,
    color: '#aaa',
  },
  questSectionTitle: {
    fontSize: 13,
  fontWeight: 'bold',
    color: '#4F8EF7',
    letterSpacing: 0.2,
  },
  questTitlePill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  questSectionBody: { marginTop: 1, marginBottom: 5, maxHeight: 50 },
  questListContent: { paddingBottom: 4 },
  questSectionSummary: { marginTop: 2, marginBottom: 1 },
  questItemPill: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', marginBottom: 6 },
  questPillSingle: { width: '100%' },
  questPillHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  questTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 0,
  },
  // questDesc removed for minimalist look
  questProgressBarBg: { width: '100%', height: 6, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 4, overflow: 'hidden', marginVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)' },
  questProgressBarFill: {
    height: 6,
    borderRadius: 4,
  },
  questProgressText: {
    fontSize: 10,
    color: '#e9f1ff',
    fontWeight: '700',
    marginBottom: 0,
  },
  questReward: {
    fontSize: 11,
    color: '#d9ffd6',
    fontWeight: '800',
    marginTop: 1,
  },
  menuTabContainer: {
    position: 'absolute',
    right: 16,
    top: 120,
    zIndex: 30,
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTabButton: {
    width: 60,
    height: 32,
    backgroundColor: 'rgba(0,231,255,0.85)',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...Platform.select({
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.18)' },
      default: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 3 }
    }),
  },
  menuTabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
    marginRight: 4,
  },
  menuTabArrow: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 32,
    marginHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.6)',
    ...Platform.select({
      web: { boxShadow: '0px 6px 16px rgba(106,0,255,0.35)' },
      default: { shadowColor: '#6A00FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }
    }),
    zIndex: 10,
    opacity: 0.99,
    overflow: 'hidden',
  },
  topGlowSweep: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 140,
    height: '100%',
    opacity: 0.8,
  },
  levelBadgeContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  levelText: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(34,34,34,0.85)' },
      default: { textShadowColor: '#222', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }
    })
  },
  statsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  h3Title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E8F9FF',
    marginBottom: 2,
    ...Platform.select({
      web: { textShadow: '0px 1px 3px rgba(0,0,0,0.35)' },
      default: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }
    }),
    maxWidth: 220,
  },
  statsText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4F8EF7',
    marginBottom: 2,
  },
  statsPoints: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },
  pointsBarBg: {
    width: 200,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.35)'
  },
  pointsBarFill: {
    height: 6,
    borderRadius: 4,
  },
  menuWrapper: {
    // unused, kept for reference
  },
  menuStackedAll: {
    position: 'absolute',
    right: 16,
    top: 152,
    zIndex: 20,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.0)',
    paddingVertical: 8,
    borderRadius: 18,
  },
  menuStackedItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    marginBottom: 0,
  },
  menuIconInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDesc: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
    ...Platform.select({ web: { textShadow: '0px 1px 2px rgba(0,0,0,0.25)' }, default: {} })
  },
  menuLabelPill: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
    ...Platform.select({ web: { textShadow: '0px 1px 2px rgba(0,0,0,0.25)' }, default: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } })
  },
  profileSection: {
    marginLeft: 16,
    zIndex: 10,
  },
  profileTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.5)',
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: '0px 2px 8px rgba(106,0,255,0.25)' }, default: { shadowColor: '#6A00FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 } }),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)'
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profileLabel: {
    marginTop: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#E8F9FF',
    ...Platform.select({ web: { textShadow: '0px 1px 2px rgba(0,0,0,0.25)' }, default: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } })
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
    // gradient set in element
    ...Platform.select({ web: { pointerEvents: 'none' }, default: {} })
  },
  // topBar, score, level, coins styles removed
  room: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Lower zIndex so top bars and bottom tabs can cover the avatar when overlapping
    zIndex: 5,
    pointerEvents: 'box-none',
  },
  avatarAnchor: {
    // Centered by parent .room (flex:1, justifyContent/alignItems:'center')
    // Remove absolute positioning so avatar remains centered on any viewport/frame size.
    zIndex: 3,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  character: {
    width: WINDOW_WIDTH * 0.25, // ~25% of screen width
    height: WINDOW_WIDTH * 0.4, // proportional height
    borderRadius: WINDOW_WIDTH * 0.125, // half width for circle
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  avatarSurface: {
    marginTop: WINDOW_HEIGHT * 0.02, // ~2% margin
  },
  speechBubble: {
    position: 'absolute',
    top: 12,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: 220,
  },
  speechText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  speechTail: {
    position: 'absolute',
    right: -8,
    top: 10,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#4F8EF7',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  // bottomBar removed for floating menu
  menuWorkout: {
    position: 'absolute',
    left: 20,
    bottom: 40,
    zIndex: 20,
  },
  menuTrack: {
    position: 'absolute',
    right: 20,
    bottom: 40,
    zIndex: 20,
  },
  menuRest: {
    position: 'absolute',
    left: 20,
    top: 120,
    zIndex: 20,
  },
  menuProfile: {
    position: 'absolute',
    right: 20,
    top: 120,
    zIndex: 20,
  },
  menuIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,231,255,0.35)', ...Platform.select({ web: { boxShadow: '0px 2px 8px rgba(106,0,255,0.25)' }, default: { shadowColor: '#6A00FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 } }) },
  menuIcon: {
    fontSize: 20,
    color: '#fff',
  },
  topBarRight: {
    position: 'absolute',
    top: 40,
    right: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 10,
    width: 140,
    justifyContent: 'flex-end',
  },
  usdPillOuter: {
    borderRadius: 18,
    padding: 1,
    ...Platform.select({ web: { boxShadow: '0px 2px 8px rgba(106,0,255,0.25)' }, default: { shadowColor: '#6A00FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 } }),
    marginTop: 8,
  },
  usdSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.5)'
  },
  usdIcon: {
    fontSize: 16,
    marginRight: 4,
    transform: [{ translateY: -2 }],
  },
  usdText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#E8F9FF',
  },
  workoutSection: {
    position: 'absolute',
    left: 20,
    bottom: 28,
    zIndex: 30,
    alignItems: 'flex-start',
  },
  workoutButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(79,142,247,0.28)' }, default: { shadowColor: COLORS.instaMid1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6 } }),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)'
  },
  workoutInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutIcon: {
    fontSize: 30,
    color: '#fff',
  },
  workoutButtonLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    ...Platform.select({ web: { textShadow: '0px 1px 2px rgba(0,0,0,0.25)' }, default: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } }),
  },
  workoutLabel: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2233',
    ...Platform.select({ web: { textShadow: '0px 1px 1px rgba(255,255,255,0.7)' }, default: { textShadowColor: 'rgba(255,255,255,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 } }),
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    zIndex: 50,
  },
});

export default HomeScreen;