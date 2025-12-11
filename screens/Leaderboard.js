import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../services/firebase';
import { fallbackFriends, fetchFriendsForLeaderboard } from '../utils/friendsData';

const friendSuggestions = [
  { id: 's1', name: 'Dana', mutual: 3, avatar: 'https://i.pravatar.cc/150?img=15' },
  { id: 's2', name: 'Evan', mutual: 2, avatar: 'https://i.pravatar.cc/150?img=23' },
  { id: 's3', name: 'Farah', mutual: 1, avatar: 'https://i.pravatar.cc/150?img=9' },
  { id: 's4', name: 'Gabe', mutual: 4, avatar: 'https://i.pravatar.cc/150?img=41' },
];

const SELF_ID = 'self-user-row';
const ensureSelfRow = (list) => {
  const hasSelf = list.some((l) => l.id === SELF_ID || l.name.toLowerCase() === 'you');
  if (hasSelf) return list;
  return [...list, { id: SELF_ID, name: 'You', points: 900, avatar: undefined }];
};

export default function Leaderboard() {
  const router = useRouter();
  const [leaders, setLeaders] = useState(() => ensureSelfRow(fallbackFriends.map(f => ({
    id: f.id,
    name: f.name,
    points: f.points || 800,
    avatar: f.avatar,
  }))));
  const [friendName, setFriendName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchResults = friendName.trim()
    ? leaders.filter(f => f.name.toLowerCase().includes(friendName.trim().toLowerCase()))
    : [];

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchFriendsForLeaderboard()
      .then((data) => {
        if (!mounted) return;
        const normalized = data.map((f) => ({
          id: f.id,
          name: f.name,
          points: f.points || 800,
          avatar: f.avatar,
        }));
        setLeaders(ensureSelfRow(normalized).sort((a, b) => b.points - a.points));
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const addFriendToLeaderboard = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLeaders((prev) => {
      const exists = prev.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      const newEntry = {
        id: `local-${Date.now()}`,
        name: trimmed,
        points: 800,
        avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(trimmed.toLowerCase())}`,
      };
      return ensureSelfRow([...prev, newEntry]).sort((a, b) => b.points - a.points);
    });
    try {
      const docRef = await addDoc(collection(db, 'friends'), {
        name: trimmed,
        points: 800,
        avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(trimmed.toLowerCase())}`,
        pushups: 0,
        plankSec: 0,
        tag: 'Friend',
      });
      setLeaders((prev) => {
        const withoutLocal = prev.filter((p) => !p.id.startsWith('local-') || p.name.toLowerCase() !== trimmed.toLowerCase());
        const newEntry = {
          id: docRef.id,
          name: trimmed,
          points: 800,
          avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(trimmed.toLowerCase())}`,
        };
        return ensureSelfRow([...withoutLocal, newEntry]).sort((a, b) => b.points - a.points);
      });
    } catch (err) {
      console.warn('[leaderboard] add friend failed', err);
    }
  };

  const toggleAddModal = () => {
    setShowAdd((v) => {
      const next = !v;
      if (!next) {
        setFriendName('');
      }
      return next;
    });
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setFriendName('');
  };

  const handleSendRequest = async () => {
    const trimmed = friendName.trim();
    if (!trimmed) {
      Alert.alert('Enter a name', 'Type a friend name to send a request.');
      return;
    }
    await addFriendToLeaderboard(trimmed);
    Alert.alert('Request sent', `Friend request sent to ${trimmed}.`);
    setFriendName('');
  };

  const handleBack = () => {
    if (showAdd) {
      closeAddModal();
      return;
    }
    // Fallback to home if there is no navigation history
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity onPress={toggleAddModal} style={styles.plusButton}>
          <Text style={styles.plusText}>＋</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={leaders}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={[styles.row, item.name === 'You' && styles.youRow]}>
            <Text style={styles.rank}>{index + 1}</Text>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.points}>{item.points} pts</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
      {showAdd && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={closeAddModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a friend</Text>
            <View style={styles.addFriendRow}>
              <TextInput
                placeholder="Search by name"
                placeholderTextColor="#8fa3c5"
                value={friendName}
                onChangeText={setFriendName}
                style={styles.input}
                returnKeyType="search"
                onSubmitEditing={handleSendRequest}
                autoFocus
              />
              <TouchableOpacity style={styles.addButton} onPress={handleSendRequest}>
                <Text style={styles.addButtonText}>Search</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Sends a friend request to this user.</Text>
            {searchResults.length > 0 && (
              <View style={styles.resultsBlock}>
                <View style={styles.suggestionHeaderRow}>
                  <Text style={styles.suggestionLabel}>Matches</Text>
                  <Text style={styles.suggestionHint}>{searchResults.length} found</Text>
                </View>
                <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsContent}>
                  {searchResults.map((user) => (
                    <View key={user.id} style={styles.resultRow}>
                      {user.avatar ? (
                        <Image source={{ uri: user.avatar }} style={styles.resultAvatar} />
                      ) : (
                        <View style={[styles.resultAvatar, styles.avatarFallback]}>
                          <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
                        </View>
                      )}
                      <View style={styles.resultTextBlock}>
                        <Text style={styles.resultName}>{user.name}</Text>
                        <Text style={styles.resultMeta}>{user.mutual} mutual</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.resultAdd}
                        onPress={() => {
                          addFriendToLeaderboard(user.name);
                          closeAddModal();
                        }}
                      >
                        <Text style={styles.resultAddText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.suggestionHeaderRow}>
              <Text style={styles.suggestionLabel}>Suggested</Text>
              <Text style={styles.suggestionHint}>Based on recent matches</Text>
            </View>
            <View style={styles.suggestionRow}>
              {friendSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.suggestionCard}
                  onPress={() => setFriendName(s.name)}
                >
                  {s.avatar ? (
                    <Image source={{ uri: s.avatar }} style={styles.suggestionAvatar} />
                  ) : (
                    <View style={[styles.suggestionAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{s.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.suggestionTextBlock}>
                    <Text style={styles.suggestionName}>{s.name}</Text>
                    <Text style={styles.suggestionMeta}>{s.mutual} mutual</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0f1a',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00E7FF',
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3eaf7',
  },
  backIcon: {
    color: '#1b2743',
    fontSize: 18,
    fontWeight: '700',
  },
  addFriendLabel: {
    fontWeight: '700',
    color: '#d4ddff',
    marginBottom: 8,
  },
  addFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f1324',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.25)',
    color: '#e8f1ff',
  },
  addButton: {
    backgroundColor: '#6A00FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00E7FF',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    marginTop: 6,
    color: '#8fa3c5',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13182a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  youRow: {
    backgroundColor: 'rgba(0,231,255,0.08)',
    borderWidth: 1,
    borderColor: '#00E7FF',
  },
  rank: {
    fontSize: 20,
    fontWeight: 'bold',
    width: 32,
    color: '#00E7FF',
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.35)',
  },
  avatarFallback: {
    backgroundColor: '#0f1324',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#d4ddff',
    fontWeight: '800',
  },
  name: {
    flex: 1,
    fontSize: 18,
    color: '#e8f1ff',
    marginLeft: 12,
  },
  points: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a6ff9f',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13182a',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.35)',
  },
  backIcon: {
    color: '#00E7FF',
    fontSize: 18,
    fontWeight: '700',
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13182a',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.35)',
  },
  plusText: {
    color: '#00E7FF',
    fontSize: 20,
    fontWeight: '800',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,20,0.75)',
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0f1324',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#d4ddff',
    marginBottom: 12,
  },
  suggestionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  suggestionLabel: {
    color: '#d4ddff',
    fontWeight: '700',
  },
  suggestionHint: {
    color: '#8fa3c5',
    fontSize: 12,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#11172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  suggestionName: {
    color: '#e8f1ff',
    fontWeight: '700',
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.3)',
  },
  suggestionTextBlock: {
    flexDirection: 'column',
  },
  suggestionMeta: {
    color: '#8fa3c5',
    fontSize: 12,
    marginTop: 2,
  },
  resultsBlock: {
    marginTop: 10,
    marginBottom: 6,
  },
  resultsList: {
    maxHeight: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.2)',
    backgroundColor: '#0d1426',
  },
  resultsContent: {
    padding: 8,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.18)',
    gap: 10,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.3)',
  },
  resultTextBlock: {
    flex: 1,
  },
  resultName: {
    color: '#e8f1ff',
    fontWeight: '700',
  },
  resultMeta: {
    color: '#8fa3c5',
    fontSize: 12,
    marginTop: 2,
  },
  resultAdd: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#6A00FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00E7FF',
  },
  resultAddText: {
    color: '#fff',
    fontWeight: '700',
  },
});
