import { MaterialCommunityIcons as Icon, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import CompactCyberBadge, { compactBadgePalette } from '../components/Achievements/CompactCyberBadge';
import BackButton from '../components/BackButton';
import { auth, db } from '../services/firebase';
import { buildBadgeData, getActiveBadgeConfig } from '../utils/badgeSystem';

const SOCIAL_COLLECTION = 'socialPosts';

const formatTime = (value) => {
  if (!value) return 'Just now';
  const timestamp = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(timestamp.getTime())) return 'Just now';
  const diffMs = Date.now() - timestamp.getTime();
  if (diffMs < 60 * 1000) return 'Just now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const mapPost = (snap) => {
  const data = snap.data() || {};
  return {
    id: snap.id,
    author: String(data.author || 'Player'),
    handle: String(data.handle || '@you'),
    content: String(data.content || ''),
    imageUri: String(data.imageUri || ''),
    type: String(data.type || 'Update'),
    badge: String(data.badge || 'Social'),
    likes: Number(data.likes || 0),
    comments: Number(data.comments || 0),
    createdAt: data.createdAt || null,
    authorUid: data.authorUid || null,
    tone: String(data.tone || '#00E7FF'),
  };
};

function SocialPostMini({ post }) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postTopRow}>
        <View style={[styles.avatar, { borderColor: post.tone, backgroundColor: `${post.tone}18` }]}>
          <Text style={styles.avatarText}>{post.author.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.postMeta}>
          <View style={styles.postTitleRow}>
            <Text style={styles.postAuthor}>{post.author}</Text>
            <Text style={styles.postHandle}>{post.handle}</Text>
          </View>
          <Text style={styles.postSubline}>{formatTime(post.createdAt)} • {post.type}</Text>
        </View>
        <View style={[styles.badgePill, { borderColor: post.tone, backgroundColor: `${post.tone}14` }]}>
          <Text style={[styles.badgePillText, { color: post.tone }]}>{post.badge}</Text>
        </View>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {post.imageUri ? (
        <View style={styles.postImageWrap}>
          <Image source={{ uri: post.imageUri }} style={styles.postImage} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.postMetricsRow}>
        <View style={styles.metricChip}>
          <Ionicons name="heart-outline" size={14} color="#FF5A67" />
          <Text style={styles.metricText}>{post.likes}</Text>
        </View>
        <View style={styles.metricChip}>
          <Ionicons name="chatbubble-outline" size={14} color="#00E7FF" />
          <Text style={styles.metricText}>{post.comments}</Text>
        </View>
      </View>
    </View>
  );
}

export default function SocialProfileScreen() {
  const user = useSelector((state) => state.user || {});
  const avatarName = user?.avatarName || 'Player';
  const level = user?.level || 1;
  const photoUri = user?.photoUri || '';
  const activeBadgeKey = user?.selectedBadgeKey || null;
  const stepsByDate = useSelector((state) => state.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((state) => state.workouts?.sessionsByDate || {});
  const [uid, setUid] = useState(null);
  const [allPosts, setAllPosts] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const postsRef = collection(db, SOCIAL_COLLECTION);
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'), limit(60));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setAllPosts(snapshot.docs.map(mapPost));
      },
      (error) => {
        console.warn('[SocialProfile] failed to load posts', error);
        setAllPosts([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const myPosts = useMemo(() => {
    if (!uid) return allPosts.filter((post) => post.author === avatarName).slice(0, 6);
    return allPosts.filter((post) => post.authorUid === uid || post.author === avatarName).slice(0, 6);
  }, [allPosts, avatarName, uid]);

  const followerPosts = useMemo(() => {
    if (!uid) return allPosts.slice(0, 6);
    return allPosts.filter((post) => post.authorUid !== uid).slice(0, 6);
  }, [allPosts, uid]);

  const socialStats = useMemo(() => {
    const postCount = myPosts.length;
    const followerCount = Math.max(12, level * 7 + postCount * 3 + 20);
    const followingCount = Math.max(10, level * 5 + followerPosts.length * 2 + 14);
    return { postCount, followerCount, followingCount };
  }, [followerPosts.length, level, myPosts]);
  const { badgeConfigs } = useMemo(() => buildBadgeData({ user, stepsByDate, sessionsByDate }), [user, stepsByDate, sessionsByDate]);
  const selectedBadge = getActiveBadgeConfig(badgeConfigs, activeBadgeKey) || badgeConfigs[0];
  const selectedBadgeTheme = useMemo(() => {
    const tone = compactBadgePalette[selectedBadge?.tone]?.color || compactBadgePalette.cyan.color;
    return {
      tone,
      pageGlow: `${tone}12`,
      pageAccent: `${tone}18`,
      panelBorder: `${tone}24`,
      panelBackground: `${tone}0B`,
      chipBackground: `${tone}14`,
      chipBorder: `${tone}30`,
      statBackground: `${tone}0D`,
      statBorder: `${tone}20`,
      mutedText: `${tone}B8`,
    };
  }, [selectedBadge]);

  const socialId = uid ? uid.slice(0, 8).toUpperCase() : 'LOCAL';
  const handle = `@${String(avatarName || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'player'}`;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[selectedBadgeTheme.pageGlow, '#0A1020', '#05020B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.page}>
        <View style={styles.topRow}>
          <BackButton />
          <View style={[styles.headerPill, { borderColor: selectedBadgeTheme.chipBorder, backgroundColor: selectedBadgeTheme.panelBackground }]}>
            <Icon name="account-group-outline" size={14} color={selectedBadgeTheme.tone} />
            <Text style={[styles.headerPillText, { color: selectedBadgeTheme.tone }]}>Social profile</Text>
          </View>
        </View>

        <LinearGradient colors={[selectedBadgeTheme.pageAccent, 'rgba(18,25,41,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroCard, { borderColor: selectedBadgeTheme.panelBorder }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.identityBlock}>
              <View style={[styles.avatarShell, { borderColor: selectedBadgeTheme.chipBorder, backgroundColor: selectedBadgeTheme.panelBackground }]}>
                {photoUri ? <Image source={{ uri: photoUri }} style={styles.avatarImage} /> : <Text style={styles.avatarInitial}>{(avatarName || 'P').slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.identityCopy}>
                <Text style={[styles.nameText, { color: selectedBadgeTheme.tone }]} numberOfLines={1}>{avatarName || 'Player'}</Text>
                <Text style={[styles.handleText, { color: selectedBadgeTheme.mutedText }]} numberOfLines={1}>{handle}</Text>
                <Text style={[styles.idText, { color: selectedBadgeTheme.mutedText }]}>ID {socialId}</Text>
              </View>
            </View>
            <View style={styles.levelAndBadgeRow}>
              <View style={styles.badgePressable}>
                <CompactCyberBadge iconName={selectedBadge.iconName} label={selectedBadge.label} level={selectedBadge.level} rank={selectedBadge.rank} progress={selectedBadge.progress} tone={selectedBadge.tone} size={68} />
              </View>
              <View style={[styles.levelChip, { borderColor: selectedBadgeTheme.chipBorder, backgroundColor: selectedBadgeTheme.panelBackground }]}>
                <Text style={[styles.levelChipLabel, { color: selectedBadgeTheme.mutedText }]}>Level</Text>
                <Text style={[styles.levelChipValue, { color: selectedBadgeTheme.tone }]}>{level}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: selectedBadgeTheme.statBackground, borderColor: selectedBadgeTheme.statBorder }]}>
              <Text style={[styles.statValue, { color: selectedBadgeTheme.tone }]}>{socialStats.postCount}</Text>
              <Text style={[styles.statLabel, { color: selectedBadgeTheme.mutedText }]}>Posts</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: selectedBadgeTheme.statBackground, borderColor: selectedBadgeTheme.statBorder }]}>
              <Text style={[styles.statValue, { color: selectedBadgeTheme.tone }]}>{socialStats.followerCount}</Text>
              <Text style={[styles.statLabel, { color: selectedBadgeTheme.mutedText }]}>Followers</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: selectedBadgeTheme.statBackground, borderColor: selectedBadgeTheme.statBorder }]}>
              <Text style={[styles.statValue, { color: selectedBadgeTheme.tone }]}>{socialStats.followingCount}</Text>
              <Text style={[styles.statLabel, { color: selectedBadgeTheme.mutedText }]}>Following</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.sectionCard, { borderColor: selectedBadgeTheme.panelBorder, backgroundColor: `${selectedBadgeTheme.tone}08` }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: selectedBadgeTheme.tone }]}>Your Posts</Text>
            <Text style={[styles.sectionMeta, { color: selectedBadgeTheme.mutedText }]}>{myPosts.length}</Text>
          </View>
          {myPosts.length > 0 ? (
            <View style={styles.sectionList}>
              {myPosts.map((post) => (
                <SocialPostMini key={post.id} post={post} />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Your social posts will appear here once you post from the feed.</Text>
          )}
        </View>

      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#05020B',
  },
  page: {
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 80,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.16)',
  },
  headerPillText: {
    color: '#E8F9FF',
    fontSize: 11,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.16)',
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatarShell: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,231,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.24)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  handleText: {
    color: 'rgba(232,249,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  idText: {
    color: 'rgba(232,249,255,0.58)',
    fontSize: 10,
    marginTop: 2,
  },
  levelChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 62,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,231,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.26)',
  },
  levelChipLabel: {
    color: 'rgba(232,249,255,0.68)',
    fontSize: 10,
    fontWeight: '700',
  },
  levelChipValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  levelAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  badgePressable: {
    alignSelf: 'flex-start',
  },
  badgeCardWrap: {
    alignItems: 'center',
    gap: 4,
    width: 78,
  },
  badgeCardShadow: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    height: 76,
    borderRadius: 18,
    opacity: 0.18,
  },
  badgeCard: {
    width: 76,
    height: 76,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCorner: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderWidth: 2,
  },
  badgeCornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 18,
  },
  badgeCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 18,
  },
  badgeRankPill: {
    position: 'absolute',
    top: 7,
    right: 7,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 5,
  },
  badgeRankText: {
    fontSize: 8,
    fontWeight: '900',
  },
  badgeCore: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  badgeLevelText: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
  },
  badgeProgressPill: {
    position: 'absolute',
    bottom: 6,
    left: 50,
    marginLeft: -20,
    width: 40,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 5,
  },
  badgeProgressText: {
    fontSize: 8,
    fontWeight: '800',
  },
  badgeCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 78,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statCard: {
    width: '31%',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  statLabel: {
    color: 'rgba(232,249,255,0.62)',
    fontSize: 7,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionMeta: {
    color: '#b9c6ff',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionList: {
    gap: 10,
  },
  emptyText: {
    color: '#b9c6ff',
    fontSize: 13,
    lineHeight: 18,
  },
  postCard: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  postMeta: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  postTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  postAuthor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  postHandle: {
    color: 'rgba(232,249,255,0.58)',
    fontSize: 10,
  },
  postSubline: {
    color: 'rgba(232,249,255,0.56)',
    fontSize: 9,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  postContent: {
    color: '#E8F9FF',
    fontSize: 12,
    lineHeight: 17,
  },
  postImageWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  postImage: {
    width: '100%',
    aspectRatio: 1.35,
  },
  postMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  metricText: {
    color: '#E8F9FF',
    fontSize: 11,
    fontWeight: '700',
  },
});
