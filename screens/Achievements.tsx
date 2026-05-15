import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import CompactCyberBadge from '../components/Achievements/CompactCyberBadge';
import FitnessBadgeCard from '../components/Achievements/FitnessBadgeCard.native';
import BackButton from '../components/BackButton';
import { setSelectedBadgeKey } from '../store';
import { buildBadgeData, getFeaturedBadgeConfig } from '../utils/badgeSystem';

const WEB_FRAME_WIDTH = 414;
const PAGE_CHROME_HORIZONTAL_PADDING = 14;
const USE_NATIVE_DRIVER = false;
const DETAIL_SWIPE_THRESHOLD = 52;

function AchievementsScreen() {
  const dispatch = useDispatch();
  const detailAnim = useRef(new Animated.Value(0)).current;
  const detailSwipeX = useRef(new Animated.Value(0)).current;
  const user = useSelector((s: any) => s.user || {});
  const selectedBadgeKey = user?.selectedBadgeKey || null;
  const stepsByDate = useSelector((s: any) => s.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((s: any) => s.workouts?.sessionsByDate || {});
  const { width: windowWidth } = useWindowDimensions();
  const layoutWidth = Platform.OS === 'web' ? Math.min(windowWidth, WEB_FRAME_WIDTH) : windowWidth;
  const [detailBadgeKey, setDetailBadgeKey] = useState<string | null>(null);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const { badgeConfigs, summaryMetrics } = useMemo(
    () => buildBadgeData({ user, stepsByDate, sessionsByDate, todayKey }),
    [user, stepsByDate, sessionsByDate, todayKey]
  );

  useEffect(() => {
    if (!badgeConfigs.length) return;
    if (!selectedBadgeKey || !badgeConfigs.some((badge) => badge.key === selectedBadgeKey)) {
      const featuredBadge = getFeaturedBadgeConfig(badgeConfigs);
      dispatch(setSelectedBadgeKey(featuredBadge?.key || badgeConfigs[0].key));
    }
  }, [badgeConfigs, dispatch, selectedBadgeKey]);

  useEffect(() => {
    if (!badgeConfigs.length) return;
    if (!detailBadgeKey || !badgeConfigs.some((badge) => badge.key === detailBadgeKey)) {
      setDetailBadgeKey(selectedBadgeKey && badgeConfigs.some((badge) => badge.key === selectedBadgeKey)
        ? selectedBadgeKey
        : badgeConfigs[0].key);
    }
  }, [badgeConfigs, detailBadgeKey, selectedBadgeKey]);

  const isCompactMobile = layoutWidth < 480;
  const horizontalPadding = isCompactMobile ? 12 : 18;
  const contentWidth = Math.min(Math.max(layoutWidth - (horizontalPadding * 2), 300), 1200);
  const pageInnerWidth = Math.max(280, contentWidth - (PAGE_CHROME_HORIZONTAL_PADDING * 2));
  const badgeCardWidth = isCompactMobile ? Math.min(pageInnerWidth, 338) : pageInnerWidth;
  const detailCardWidth = isCompactMobile ? Math.max(272, badgeCardWidth - 56) : Math.max(304, badgeCardWidth - 48);
  const compactBadgeSize = isCompactMobile ? 76 : 100;
  const compactBadgeGap = isCompactMobile ? 12 : 18;
  const showcasedBadge = badgeConfigs.find((badge) => badge.key === selectedBadgeKey) || badgeConfigs[0];
  const detailBadge = badgeConfigs.find((badge) => badge.key === detailBadgeKey) || showcasedBadge || badgeConfigs[0];
  const detailBadgeIndex = Math.max(0, badgeConfigs.findIndex((badge) => badge.key === detailBadge?.key));
  const level = Math.max(1, Number(user?.level || 1));
  const points = Math.max(0, Number(user?.points || 0));
  const pointsMax = Math.max(1, Number(user?.pointsMax || 100));
  const totalXP = Math.max(0, Number(user?.totalXP || summaryMetrics.totalXp || 0));
  const streakCount = Math.max(0, Number(user?.streakCount || 0));
  const bestStreak = Math.max(0, Number(user?.bestStreak || summaryMetrics.bestStreak || 0));
  const recentRewards = Array.isArray(user?.recentRewards) ? user.recentRewards.slice(0, 4) : [];
  const levelProgressPct = Math.max(0, Math.min(100, Math.round((points / pointsMax) * 100)));

  const formatRewardTimestamp = (value: any) => {
    const timestamp = Number(value || 0);
    if (!timestamp) return 'Recently';
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };
  const showBadgeDetails = (badgeKey: any) => {
    const nextIndex = badgeConfigs.findIndex((badge) => badge.key === badgeKey);
    const direction = nextIndex > detailBadgeIndex ? 1 : nextIndex < detailBadgeIndex ? -1 : 0;

    if (direction === 0) {
      Animated.sequence([
        Animated.timing(detailAnim, { toValue: 0.8, duration: 90, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(detailAnim, { toValue: 1, friction: 7, tension: 100, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      return;
    }

    Animated.timing(detailAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      setDetailBadgeKey(badgeKey);
      detailAnim.setValue(0);
      detailSwipeX.setValue(direction > 0 ? 34 : -34);
      Animated.spring(detailAnim, {
        toValue: 1,
        friction: 8,
        tension: 92,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      Animated.spring(detailSwipeX, {
        toValue: 0,
        friction: 8,
        tension: 92,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });
  };

  const cycleBadgeDetails = (offset: any) => {
    const nextIndex = (detailBadgeIndex + offset + badgeConfigs.length) % badgeConfigs.length;
    showBadgeDetails(badgeConfigs[nextIndex].key);
  };

  const applyShowcaseBadge = () => {
    if (!detailBadge?.key || detailBadge.key === selectedBadgeKey) return;
    dispatch(setSelectedBadgeKey(detailBadge.key));
  };

  useEffect(() => {
    detailAnim.setValue(1);
    detailSwipeX.setValue(0);
    return undefined;
  }, [detailAnim, detailSwipeX]);

  const detailPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderMove: (_, gestureState) => {
      detailSwipeX.setValue(Math.max(-72, Math.min(72, gestureState.dx)));
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx <= -DETAIL_SWIPE_THRESHOLD) {
        cycleBadgeDetails(1);
        return;
      }
      if (gestureState.dx >= DETAIL_SWIPE_THRESHOLD) {
        cycleBadgeDetails(-1);
        return;
      }
      Animated.spring(detailSwipeX, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(detailSwipeX, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
  }), [cycleBadgeDetails, detailSwipeX]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.container, { paddingHorizontal: horizontalPadding }]}> 
      <LinearGradient colors={['#0B1120', '#1B2339', '#3A3D53']} start={{ x: 0, y: 0.1 }} end={{ x: 1, y: 0.9 }} style={[styles.pageChrome, { maxWidth: contentWidth }]}> 
        <View style={styles.topRow}>
          <BackButton />
        </View>
        <View style={styles.profileSection}>
          <Text style={styles.profileName}>Achievements</Text>
          <Text style={styles.profileSubtitle}>Track active badges and fitness progression.</Text>
        </View>

        <View style={styles.progressionPanel}>
          <LinearGradient colors={['rgba(18, 217, 255, 0.16)', 'rgba(59, 130, 246, 0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.progressionHero}>
            <View style={styles.progressionHeroTopRow}>
              <View>
                <Text style={styles.progressionEyebrow}>Progression System</Text>
                <Text style={styles.progressionLevelTitle}>Level {level}</Text>
                <Text style={styles.progressionLevelMeta}>{points} / {pointsMax} XP to next level</Text>
              </View>
              <View style={styles.progressionLevelChip}>
                <Text style={styles.progressionLevelChipText}>{levelProgressPct}%</Text>
              </View>
            </View>
            <View style={styles.progressBarTrack}>
              <LinearGradient colors={['#14D8FF', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressBarFill, { width: `${levelProgressPct}%` }]} />
            </View>
            <View style={styles.progressionStatsRow}>
              <View style={styles.progressionStatPill}>
                <Text style={styles.progressionStatLabel}>Lifetime XP</Text>
                <Text style={styles.progressionStatValue}>{totalXP}</Text>
              </View>
              <View style={styles.progressionStatPill}>
                <Text style={styles.progressionStatLabel}>Achievements</Text>
                <Text style={styles.progressionStatValue}>{summaryMetrics.unlockedAchievementCount}/30</Text>
              </View>
              <View style={styles.progressionStatPill}>
                <Text style={styles.progressionStatLabel}>Current Streak</Text>
                <Text style={styles.progressionStatValue}>{streakCount} days</Text>
              </View>
              <View style={styles.progressionStatPill}>
                <Text style={styles.progressionStatLabel}>Best Streak</Text>
                <Text style={styles.progressionStatValue}>{bestStreak} days</Text>
              </View>
              <View style={styles.progressionStatPill}>
                <Text style={styles.progressionStatLabel}>Avg Badge Level</Text>
                <Text style={styles.progressionStatValue}>{summaryMetrics.averageBadgeLevel.toFixed(1)}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.rewardFeedCard}>
            <View style={styles.rewardFeedHeader}>
              <Text style={styles.rewardFeedTitle}>Recent Awards</Text>
              <Text style={styles.rewardFeedSubtitle}>Workouts, quests, streaks, and level-ups now feed one reward timeline.</Text>
            </View>
            {recentRewards.length ? recentRewards.map((reward: any) => (
              <View key={reward.id} style={styles.rewardRow}>
                <View style={styles.rewardIconWrap}>
                  <Icon
                    name={reward.source === 'level_up' ? 'star-four-points' : reward.source === 'badge_level' ? 'shield-star' : reward.source === 'streak' ? 'fire' : reward.source === 'quest' ? 'flag-checkered' : reward.source === 'steps' ? 'shoe-print' : 'dumbbell'}
                    size={16}
                    color="#12D9FF"
                  />
                </View>
                <View style={styles.rewardCopy}>
                  <Text style={styles.rewardTitle}>{reward.title || 'Reward unlocked'}</Text>
                  <Text style={styles.rewardSubtitle}>{reward.subtitle || 'Progress synced to your profile'}</Text>
                </View>
                <View style={styles.rewardMeta}>
                  <Text style={styles.rewardXp}>{reward.xp > 0 ? `+${reward.xp} XP` : 'Milestone'}</Text>
                  <Text style={styles.rewardTime}>{formatRewardTimestamp(reward.createdAt)}</Text>
                </View>
              </View>
            )) : (
              <View style={styles.rewardEmptyState}>
                <Text style={styles.rewardEmptyTitle}>No recent awards yet</Text>
                <Text style={styles.rewardEmptySubtitle}>Complete a workout or quest to populate the progression feed.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.sectionHeaderBlock}>
          <Text style={styles.sectionKicker}>Active Badges</Text>
        </View>
        <View style={[styles.compactBadgeGrid, { gap: compactBadgeGap }]}>
          {badgeConfigs.map((badge) => (
            <Pressable
              key={badge.key}
              onPress={() => showBadgeDetails(badge.key)}
              style={({ pressed }) => [styles.compactBadgePressable, pressed && styles.compactBadgePressed]}
            >
              <CompactCyberBadge
                iconName={badge.iconName}
                label={badge.label}
                level={badge.level}
                rank={badge.rank}
                progress={badge.progress}
                tone={badge.tone}
                size={compactBadgeSize}
                selected={showcasedBadge?.key === badge.key}
              />
            </Pressable>
          ))}
        </View>

        {/* detail hint panel removed per request */}

        <View style={styles.inlineDetailHeader}>
          <View style={styles.inlineDetailHeaderCopy}>
            <Text style={styles.inlineDetailKicker}>Badge Details</Text>
            <Text style={styles.inlineDetailTitle}>{detailBadge.label}</Text>
            <Text style={styles.inlineDetailIndex}>{detailBadgeIndex + 1} / {badgeConfigs.length}</Text>
            <Text style={styles.inlineDetailMeta}>
              {showcasedBadge?.key === detailBadge?.key ? 'Currently showcased across the app' : 'Browsing details only'}
            </Text>
          </View>
        </View>

        <View style={styles.inlineDetailCardWrap}>
          <Pressable onPress={() => cycleBadgeDetails(-1)} style={[styles.detailPreviewArrowButton, styles.detailPreviewArrowLeft]}>
            <Icon name="chevron-left" size={18} color="#D7E6FA" />
          </Pressable>
          <Animated.View
            {...detailPanResponder.panHandlers}
            style={[
              styles.gridItem,
              { width: detailCardWidth },
              {
                opacity: detailAnim,
                transform: [
                  { translateX: detailSwipeX },
                  { translateY: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  { scale: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                ],
              },
            ]}
          >
            <FitnessBadgeCard
              {...detailBadge.detailProps as any}
              containerStyle={styles.badgeCard}
              compact={isCompactMobile}
            />
          </Animated.View>
          <Pressable onPress={() => cycleBadgeDetails(1)} style={[styles.detailPreviewArrowButton, styles.detailPreviewArrowRight]}>
            <Icon name="chevron-right" size={18} color="#D7E6FA" />
          </Pressable>
        </View>

        <View style={styles.showcaseActionWrap}>
          <Pressable
            onPress={applyShowcaseBadge}
            disabled={!detailBadge?.key || detailBadge.key === selectedBadgeKey}
            style={({ pressed }) => [
              styles.showcaseButton,
              detailBadge?.key === selectedBadgeKey && styles.showcaseButtonDisabled,
              pressed && detailBadge?.key !== selectedBadgeKey && styles.showcaseButtonPressed,
            ]}
          >
            <LinearGradient
              colors={detailBadge?.key === selectedBadgeKey ? ['rgba(71,87,120,0.55)', 'rgba(43,57,86,0.55)'] : ['#14D8FF', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.showcaseButtonGradient}
            >
              <Icon name={detailBadge?.key === selectedBadgeKey ? 'check-circle-outline' : 'star-four-points'} size={16} color="#F8FBFF" />
              <Text style={styles.showcaseButtonText}>
                {detailBadge?.key === selectedBadgeKey ? 'This badge is showcased across the app' : 'Showcase this badge across the app'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#070C18',
  },
  container: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 156,
    alignItems: 'center',
  },
  pageChrome: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(132,185,255,0.14)',
    overflow: 'hidden',
  },
  topRow: {
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  profileSection: {
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'center',
  },
  profileName: {
    color: '#12D9FF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  profileSubtitle: {
    color: '#A3B4D1',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionHeaderBlock: {
    marginBottom: 10,
    alignItems: 'center',
  },
  sectionKicker: {
    color: '#D4DCEB',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  compactBadgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  compactBadgeWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  compactBadgeHalo: {
    position: 'absolute',
    top: -10,
    left: -10,
    borderRadius: 999,
    borderWidth: 1,
    opacity: 0.9,
  },
  compactBadgePressable: {
    borderRadius: 16,
  },
  compactBadgePressed: {
    opacity: 0.86,
  },
  compactBadgeShadow: {
    position: 'absolute',
    top: 0,
    borderRadius: 18,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    opacity: 0.55,
  },
  compactBadgeShadowSelected: {
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 18,
    opacity: 1,
  },
  compactBadgeCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  compactBadgeCardSelected: {
    transform: [{ scale: 1.08 }],
    borderWidth: 2.5,
  },
  compactBadgeCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
  },
  compactBadgeCornerTopLeft: {
    top: 3,
    left: 3,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 10,
  },
  compactBadgeCornerBottomRight: {
    right: 3,
    bottom: 3,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: 10,
  },
  compactBadgeRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  compactBadgeInnerRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  compactBadgeCore: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  compactBadgeRank: {
    position: 'absolute',
    top: 5,
    right: 5,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compactBadgeRankText: {
    fontSize: 9,
    fontWeight: '700',
  },
  compactBadgeLevel: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactBadgeProgress: {
    position: 'absolute',
    bottom: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactBadgeProgressText: {
    fontSize: 8,
    fontWeight: '700',
  },
  compactBadgeSelectedChip: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  compactBadgeSelectedChipText: {
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  compactBadgeLabel: {
    color: '#A7B5CD',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  compactBadgeLabelSelected: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressionPanel: {
    gap: 12,
    marginBottom: 18,
  },
  progressionHero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,216,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  progressionHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  progressionEyebrow: {
    color: '#8FDBFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  progressionLevelTitle: {
    color: '#F8FBFF',
    fontSize: 24,
    fontWeight: '800',
  },
  progressionLevelMeta: {
    color: '#A8BAD8',
    fontSize: 12,
    marginTop: 3,
  },
  progressionLevelChip: {
    minWidth: 58,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(7,12,24,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(20,216,255,0.24)',
    alignItems: 'center',
  },
  progressionLevelChipText: {
    color: '#F8FBFF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(83, 105, 146, 0.32)',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  progressionStatPill: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 12,
    backgroundColor: 'rgba(7,12,24,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 210, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  progressionStatLabel: {
    color: '#8FA7C9',
    fontSize: 10,
    marginBottom: 4,
  },
  progressionStatValue: {
    color: '#F8FBFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rewardFeedCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(10,18,33,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(140,170,210,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rewardFeedHeader: {
    marginBottom: 10,
  },
  rewardFeedTitle: {
    color: '#F8FBFF',
    fontSize: 16,
    fontWeight: '700',
  },
  rewardFeedSubtitle: {
    color: '#93A7C9',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(140,170,210,0.1)',
    paddingVertical: 11,
  },
  rewardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,217,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.18)',
  },
  rewardCopy: {
    flex: 1,
  },
  rewardTitle: {
    color: '#F5F8FE',
    fontSize: 13,
    fontWeight: '700',
  },
  rewardSubtitle: {
    color: '#8FA7C9',
    fontSize: 11,
    marginTop: 2,
  },
  rewardMeta: {
    alignItems: 'flex-end',
  },
  rewardXp: {
    color: '#12D9FF',
    fontSize: 12,
    fontWeight: '700',
  },
  rewardTime: {
    color: '#7287A9',
    fontSize: 10,
    marginTop: 3,
  },
  rewardEmptyState: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(140,170,210,0.1)',
    paddingTop: 12,
  },
  rewardEmptyTitle: {
    color: '#F5F8FE',
    fontSize: 13,
    fontWeight: '700',
  },
  rewardEmptySubtitle: {
    color: '#8FA7C9',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  // detail hint styles removed
  inlineDetailHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingVertical: 2,
  },
  inlineDetailHeaderCopy: {
    alignItems: 'center',
  },
  inlineDetailKicker: {
    color: '#13D8FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  inlineDetailTitle: {
    color: '#F5F8FE',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  inlineDetailIndex: {
    color: '#8FA7C9',
    fontSize: 10,
    marginTop: 2,
  },
  inlineDetailMeta: {
    color: '#8EC7F4',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  inlineDetailCardWrap: {
    width: '100%',
    paddingBottom: 72,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
  },
  showcaseActionWrap: {
    alignItems: 'center',
    marginTop: -24,
  },
  showcaseButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20, 216, 255, 0.34)',
    minWidth: 248,
  },
  showcaseButtonDisabled: {
    borderColor: 'rgba(137, 157, 191, 0.22)',
  },
  showcaseButtonPressed: {
    opacity: 0.92,
  },
  showcaseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  showcaseButtonText: {
    color: '#F8FBFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailPreviewArrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 18, 33, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(19, 216, 255, 0.26)',
    zIndex: 3,
  },
  detailPreviewArrowLeft: {
    left: -10,
  },
  detailPreviewArrowRight: {
    right: -10,
  },
  gridItem: {
    paddingVertical: 0,
    alignItems: 'center',
  },
  badgeCard: {
    backgroundColor: 'transparent',
    width: '100%',
  },
});

export default AchievementsScreen;
