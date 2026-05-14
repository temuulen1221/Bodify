import { MaterialCommunityIcons as Icon, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes, uploadString } from 'firebase/storage';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import CompactCyberBadge, { compactBadgePalette } from '../components/Achievements/CompactCyberBadge';
import { auth, db, storage } from '../services/firebase';
import { buildBadgeData, getActiveBadgeConfig } from '../utils/badgeSystem';

const QUICK_POSTS = [
  'Finished my session and hit a new best today.',
  'Anyone doing a 20-minute walk challenge this week?',
  'Small wins still count. I kept my streak alive.',
];

const FILTERS = ['For you', 'Friends', 'Challenges'];

const seedPosts = [
  {
    id: 'p1',
    author: 'Maya',
    handle: '@maya.moves',
    time: '5m ago',
    type: 'Workout',
    content: 'Just finished a leg day circuit and pushed through the last round. The streak pressure is real, but it works.',
    likes: 42,
    comments: 7,
    replies: ['Love the consistency.', 'That last round is always the hardest.'],
    badge: 'Streak 12',
    tone: '#14E7A8',
    isSeed: true,
  },
  {
    id: 'p2',
    author: 'Jordan',
    handle: '@jordansrun',
    time: '18m ago',
    type: 'Challenge',
    content: 'Opened a 5K weekly challenge for anyone who wants a simple running target. No speed requirements, just show up.',
    likes: 28,
    comments: 3,
    replies: ['I am in.', 'Good challenge format.'],
    badge: '5K Challenge',
    tone: '#00E7FF',
    isSeed: true,
  },
  {
    id: 'p3',
    author: 'Nina',
    handle: '@ninafuel',
    time: '1h ago',
    type: 'Nutrition',
    content: 'Meal prep day saved me from skipping lunch after training. Chicken, rice, greens, done for two days.',
    likes: 19,
    comments: 4,
    replies: ['Meal prep is the real cheat code.'],
    badge: '2 day prep',
    tone: '#FF9A1F',
    isSeed: true,
  },
];

const SOCIAL_COLLECTION = 'socialPosts';

const getRelativeTimeLabel = (value) => {
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

const normalizeFeedPost = (post) => ({
  ...post,
  replies: Array.isArray(post.replies) ? post.replies : [],
  imageUri: post.imageUri || '',
  likes: Number(post.likes || 0),
  comments: Number(post.comments || 0),
  isSeed: Boolean(post.isSeed),
});

const normalizeSocialPost = (docSnap) => {
  const data = docSnap.data() || {};
  return normalizeFeedPost({
    id: docSnap.id,
    author: String(data.author || 'Player'),
    handle: String(data.handle || '@you'),
    time: getRelativeTimeLabel(data.createdAt),
    type: String(data.type || 'Progress'),
    content: String(data.content || ''),
    imageUri: String(data.imageUri || ''),
    likes: Number(data.likes || 0),
    comments: Number(data.comments || 0),
    replies: Array.isArray(data.replies) ? data.replies.filter(Boolean).slice(0, 3) : [],
    badge: String(data.badge || 'Update'),
    tone: String(data.tone || '#00E7FF'),
    createdAt: data.createdAt || null,
    isSeed: false,
  });
};

function SocialComposer({ value, imageUri, onChangeText, onQuickPick, onAttachPhoto, onClearPhoto, onPost }) {
  return (
    <LinearGradient colors={['rgba(10,18,34,0.96)', 'rgba(20,26,44,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.composerCard}>
      <View style={styles.composerHeader}>
        <View>
          <Text style={styles.sectionLabel}>Share progress</Text>
          <Text style={styles.composerTitle}>Post a quick update</Text>
        </View>
        <View style={styles.composerBadge}>
          <Ionicons name="sparkles" size={14} color="#00E7FF" />
          <Text style={styles.composerBadgeText}>Now</Text>
        </View>
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Tell the community what you trained, learned, or need help with..."
        placeholderTextColor="rgba(232,249,255,0.45)"
        multiline
        style={styles.composerInput}
      />

      <View style={styles.quickRow}>
        {QUICK_POSTS.map((post) => (
          <TouchableOpacity key={post} activeOpacity={0.85} onPress={() => onQuickPick(post)} style={styles.quickChip}>
            <Text style={styles.quickChipText}>{post}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.attachmentRow}>
        <TouchableOpacity activeOpacity={0.85} onPress={onAttachPhoto} style={styles.attachmentButton}>
          <Icon name="image-plus" size={16} color="#00E7FF" />
          <Text style={styles.attachmentButtonText}>Add photo</Text>
        </TouchableOpacity>
        {imageUri ? (
          <TouchableOpacity activeOpacity={0.85} onPress={onClearPhoto} style={styles.attachmentRemoveButton}>
            <Ionicons name="close-circle-outline" size={16} color="#FF5A67" />
            <Text style={styles.attachmentRemoveText}>Remove</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {imageUri ? (
        <View style={styles.composerPreviewWrap}>
          <Image source={{ uri: imageUri }} style={styles.composerPreviewImage} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.composerFooter}>
        <View style={styles.composerHint}>
          <Icon name="shield-check-outline" size={14} color="#14E7A8" />
          <Text style={styles.composerHintText}>Keep it short, useful, and encouraging.</Text>
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={onPost} style={styles.postButtonWrap}>
          <LinearGradient colors={['#5421FF', '#6A00FF', '#00E7FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.postButton}>
            <Text style={styles.postButtonText}>Post</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function SocialPost({ post, onLike, onComment }) {
  return (
    <LinearGradient colors={['rgba(12,16,28,0.94)', 'rgba(18,25,41,0.98)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.postCard}>
      <View style={styles.postTopRow}>
        <View style={[styles.avatar, { borderColor: post.tone, backgroundColor: `${post.tone}18` }]}>
          <Text style={styles.avatarText}>{post.author.slice(0, 1)}</Text>
        </View>
        <View style={styles.postMeta}>
          <View style={styles.postTitleRow}>
            <Text style={styles.postAuthor}>{post.author}</Text>
            <Text style={styles.postHandle}>{post.handle}</Text>
          </View>
          <Text style={styles.postSubline}>{post.time} • {post.type}</Text>
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

      <View style={styles.postTagsRow}>
        <View style={styles.tagPill}><Text style={styles.tagPillText}>#progress</Text></View>
        <View style={styles.tagPill}><Text style={styles.tagPillText}>#community</Text></View>
        <View style={styles.tagPill}><Text style={styles.tagPillText}>#accountability</Text></View>
      </View>

      <View style={styles.reactionRow}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onLike(post.id)} style={styles.reactionButton}>
          <Ionicons name="heart" size={16} color="#FF5A67" />
          <Text style={styles.reactionText}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onComment(post.id)} style={styles.reactionButton}>
          <Ionicons name="chatbubble-outline" size={16} color="#00E7FF" />
          <Text style={styles.reactionText}>{post.comments}</Text>
        </TouchableOpacity>
        <View style={styles.reactionButton}>
          <Ionicons name="bookmark-outline" size={16} color="#B86CFF" />
          <Text style={styles.reactionText}>Save</Text>
        </View>
      </View>

      <View style={styles.replyStrip}>
        {post.replies.slice(0, 2).map((reply) => (
          <View key={reply} style={styles.replyBubble}>
            <Text style={styles.replyBubbleText}>{reply}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const user = useSelector((state) => state.user || {});
  const activeBadgeKey = useSelector((state) => state.user?.selectedBadgeKey || null);
  const avatarName = user?.avatarName || 'Player';
  const level = user?.level || 1;
  const stepsByDate = useSelector((state) => state.steps?.stepsByDate || {});
  const sessionsByDate = useSelector((state) => state.workouts?.sessionsByDate || {});
  const [selectedFilter, setSelectedFilter] = useState('For you');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerValue, setComposerValue] = useState('Finished my workout and feel good about the consistency this week.');
  const [composerImageUri, setComposerImageUri] = useState('');
  const [remotePosts, setRemotePosts] = useState([]);
  const [feedReady, setFeedReady] = useState(true);

  useEffect(() => {
    const postsRef = collection(db, SOCIAL_COLLECTION);
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'), limit(24));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setRemotePosts(snapshot.docs.map(normalizeSocialPost));
        setFeedReady(true);
      },
      (error) => {
        console.warn('[Social] feed subscription failed', error);
        setFeedReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const posts = useMemo(() => {
    if (remotePosts.length > 0) {
      return remotePosts.map(normalizeFeedPost);
    }
    return seedPosts.map(normalizeFeedPost);
  }, [remotePosts]);

  const { badgeConfigs } = useMemo(() => buildBadgeData({ user, stepsByDate, sessionsByDate }), [user, stepsByDate, sessionsByDate]);
  const previewBadge = getActiveBadgeConfig(badgeConfigs, activeBadgeKey) || badgeConfigs[0];
  const previewBadgeTheme = {
    tone: compactBadgePalette[previewBadge.tone]?.color || compactBadgePalette.cyan.color,
    border: `${(compactBadgePalette[previewBadge.tone] || compactBadgePalette.cyan).color}26`,
    panel: `${(compactBadgePalette[previewBadge.tone] || compactBadgePalette.cyan).color}10`,
    soft: `${(compactBadgePalette[previewBadge.tone] || compactBadgePalette.cyan).color}18`,
    text: `${(compactBadgePalette[previewBadge.tone] || compactBadgePalette.cyan).color}F0`,
  };

  const openPhotoPicker = async () => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          setComposerImageUri(String(reader.result || ''));
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setComposerImageUri(result.assets[0].uri);
    }
  };

  const uploadComposerImage = async (uri) => {
    if (!uri) return '';
    const imageRef = storageRef(storage, `socialPosts/${auth.currentUser?.uid || 'guest'}/${Date.now()}.jpg`);

    if (Platform.OS === 'web' && uri.startsWith('data:')) {
      const result = await uploadString(imageRef, uri, 'data_url');
      return getDownloadURL(result.ref);
    }

    const response = await fetch(uri);
    const blob = await response.blob();
    const result = await uploadBytes(imageRef, blob);
    return getDownloadURL(result.ref);
  };

  const sortedPosts = useMemo(() => {
    if (selectedFilter === 'Friends') {
      return posts.filter((post) => post.type !== 'Challenge');
    }
    if (selectedFilter === 'Challenges') {
      return posts.filter((post) => post.type === 'Challenge');
    }
    return posts;
  }, [posts, selectedFilter]);

  const visiblePosts = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return sortedPosts;
    return sortedPosts.filter((post) => {
      const haystack = `${post.author} ${post.handle} ${post.content} ${post.type} ${post.badge}`.toLowerCase();
      return haystack.includes(queryText);
    });
  }, [searchQuery, sortedPosts]);

  const handlePost = () => {
    const text = composerValue.trim();
    if (!text) return;

    (async () => {
      try {
        const imageUri = await uploadComposerImage(composerImageUri);
        await addDoc(collection(db, SOCIAL_COLLECTION), {
          author: avatarName || 'You',
          authorUid: auth.currentUser?.uid || null,
          handle: '@you',
          content: text,
          imageUri,
          likes: 0,
          comments: 0,
          replies: ['Your community can comment here.'],
          badge: `Lv ${level}`,
          tone: '#00E7FF',
          type: 'Progress',
          createdAt: serverTimestamp(),
        });
        setComposerValue('');
        setComposerImageUri('');
      } catch (error) {
        console.warn('[Social] failed to post', error);
      }
    })();
  };

  const handleLike = (postId) => {
    const target = remotePosts.find((post) => post.id === postId);
    if (!target || target.isSeed) return;
    updateDoc(doc(db, SOCIAL_COLLECTION, postId), { likes: Number(target.likes || 0) + 1 })
      .catch((error) => console.warn('[Social] like update failed', error));
  };

  const handleComment = (postId) => {
    const target = remotePosts.find((post) => post.id === postId);
    if (!target || target.isSeed) return;
    updateDoc(doc(db, SOCIAL_COLLECTION, postId), {
      comments: Number(target.comments || 0) + 1,
      replies: ['Nice work. Keep it moving.', ...(target.replies || [])].slice(0, 3),
    }).catch((error) => console.warn('[Social] comment update failed', error));
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#0E1428', '#0A1020', '#05020B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.page}>
        <View style={styles.topHeaderRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/SocialProfile')} style={[styles.profileShortcut, { borderColor: previewBadgeTheme.border, backgroundColor: previewBadgeTheme.panel }]}>
            <View style={[styles.profileShortcutAvatar, { borderColor: previewBadgeTheme.border, backgroundColor: previewBadgeTheme.soft }]}>
              <Text style={[styles.profileShortcutAvatarText, { color: previewBadgeTheme.text }]}>{String(avatarName || 'P').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.profileShortcutCopy}>
              <Text style={[styles.profileShortcutLabel, { color: previewBadgeTheme.text }]}>Check profile</Text>
              <Text style={styles.profileShortcutName} numberOfLines={1}>{avatarName || 'Player'}</Text>
            </View>
            <CompactCyberBadge iconName={previewBadge.iconName} label={previewBadge.label} level={previewBadge.level} rank={previewBadge.rank} progress={previewBadge.progress} tone={previewBadge.tone} size={60} />
          </TouchableOpacity>

          <View style={styles.topHeaderActions}>
            <TouchableOpacity activeOpacity={0.85} style={styles.headerIconButton}>
              <Ionicons name="notifications-outline" size={18} color="#E8F9FF" />
              <View style={styles.headerBadgeDot} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="rgba(232,249,255,0.72)" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search people, tags, posts"
              placeholderTextColor="rgba(232,249,255,0.48)"
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const selected = filter === selectedFilter;
            return (
              <TouchableOpacity key={filter} activeOpacity={0.85} onPress={() => setSelectedFilter(filter)} style={[styles.filterChip, selected && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SocialComposer
          value={composerValue}
          imageUri={composerImageUri}
          onChangeText={setComposerValue}
          onQuickPick={setComposerValue}
          onAttachPhoto={openPhotoPicker}
          onClearPhoto={() => setComposerImageUri('')}
          onPost={handlePost}
        />

        <View style={styles.feedHeader}>
          <Text style={styles.feedHeaderTitle}>Posts</Text>
          <Text style={styles.feedHeaderMeta}>{feedReady ? `${visiblePosts.length} visible` : 'Loading...'}</Text>
        </View>

        <View style={styles.feedList}>
          {visiblePosts.map((post) => (
            <SocialPost key={post.id} post={post} onLike={handleLike} onComment={handleComment} />
          ))}
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
    paddingBottom: 72,
    gap: 8,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileShortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.16)',
  },
  profileShortcutAvatar: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,231,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.28)',
  },
  profileShortcutAvatarText: {
    color: '#E8F9FF',
    fontSize: 11,
    fontWeight: '900',
  },
  profileShortcutCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileShortcutLabel: {
    color: 'rgba(232,249,255,0.62)',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  profileShortcutName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.16)',
  },
  searchInput: {
    flex: 1,
    color: '#E8F9FF',
    fontSize: 12,
    paddingVertical: 0,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  profileStatPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileStatValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  profileStatLabel: {
    color: 'rgba(232,249,255,0.62)',
    fontSize: 9,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(0,231,255,0.12)',
    borderColor: 'rgba(0,231,255,0.3)',
  },
  filterChipText: {
    color: 'rgba(232,249,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#E8F9FF',
  },
  composerCard: {
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.16)',
    gap: 8,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionLabel: {
    color: '#00E7FF',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  composerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  composerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,231,255,0.11)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.32)',
  },
  composerBadgeText: {
    color: '#E8F9FF',
    fontSize: 10,
    fontWeight: '700',
  },
  composerInput: {
    minHeight: 72,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8F9FF',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    textAlignVertical: 'top',
    fontSize: 12,
    lineHeight: 16,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickChipText: {
    color: '#E8F9FF',
    fontSize: 10,
    lineHeight: 14,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,231,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,231,255,0.22)',
  },
  attachmentButtonText: {
    color: '#E8F9FF',
    fontSize: 10,
    fontWeight: '700',
  },
  attachmentRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,90,103,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,90,103,0.24)',
  },
  attachmentRemoveText: {
    color: '#FFD7DB',
    fontSize: 10,
    fontWeight: '700',
  },
  composerPreviewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  composerPreviewImage: {
    width: '100%',
    aspectRatio: 1.4,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  composerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  composerHintText: {
    color: 'rgba(232,249,255,0.72)',
    fontSize: 10,
  },
  postButtonWrap: {
    alignSelf: 'flex-end',
  },
  postButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 10px 18px rgba(0,231,255,0.18)',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  feedHeaderTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  feedHeaderMeta: {
    color: 'rgba(232,249,255,0.64)',
    fontSize: 10,
  },
  feedList: {
    gap: 8,
  },
  postCard: {
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0px 12px 22px rgba(0,0,0,0.28)',
    elevation: 4,
    gap: 8,
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  postMeta: {
    flex: 1,
    gap: 1,
  },
  postTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  postAuthor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  postHandle: {
    color: 'rgba(232,249,255,0.56)',
    fontSize: 10,
  },
  postSubline: {
    color: 'rgba(232,249,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 180,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1.3,
  },
  postTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tagPillText: {
    color: 'rgba(232,249,255,0.72)',
    fontSize: 9,
    fontWeight: '700',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reactionText: {
    color: '#E8F9FF',
    fontSize: 10,
    fontWeight: '700',
  },
  replyStrip: {
    gap: 5,
  },
  replyBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  replyBubbleText: {
    color: 'rgba(232,249,255,0.76)',
    fontSize: 9,
    lineHeight: 13,
  },
});
