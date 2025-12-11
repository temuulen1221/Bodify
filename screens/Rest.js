import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import RewardBadge from '../components/RewardBadge';
import { COLORS, GRADIENTS } from '../utils/constants';

const REST_TIPS = [
  'Rest is just as important as training.',
  'Take deep breaths and let your body recover.',
  'Hydrate and stretch during your rest.',
  'A short nap can boost your energy.',
  'Mindful rest improves your next workout.'
];

const RECOVERY_ACTIONS = [
  { id: 'hydrate', title: 'Hydrate 200ml', detail: 'Slow sips calm your nervous system.' },
  { id: 'stretch', title: 'Loosen shoulders', detail: 'Roll out tension for better posture.' },
  { id: 'breath', title: '3 box breaths', detail: 'In 4s • Hold 2s • Out 4s.' },
  { id: 'log', title: 'Log mood', detail: 'Notice how you feel before lifting again.' },
];

const FALLBACK_TRACKS = [
  {
    id: 'calm-waves',
    title: 'Calm Waves',
    length: '3:20',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_64bdeafdd2.mp3?filename=deep-relaxation-11062.mp3',
  },
  {
    id: 'slow-breath',
    title: 'Slow Breath',
    length: '2:40',
    url: 'https://cdn.pixabay.com/download/audio/2022/08/11/audio_c566e6f2a5.mp3?filename=meditation-ambient-112191.mp3',
  },
  {
    id: 'focus-chimes',
    title: 'Focus Chimes',
    length: '1:55',
    url: 'https://cdn.pixabay.com/download/audio/2022/02/15/audio_197b422ed2.mp3?filename=meditation-ambient-110066.mp3',
  },
];

const MEDITATION_API = 'https://raw.githubusercontent.com/github/covid19-dashboard/master/data/summary/dummy-meditation.json';

export default function Rest() {
  const insets = useSafeAreaInsets();
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * REST_TIPS.length));
  const [actions, setActions] = useState(RECOVERY_ACTIONS);
  const [tracks, setTracks] = useState(FALLBACK_TRACKS);
  const [currentTrackId, setCurrentTrackId] = useState(FALLBACK_TRACKS[0].id);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const intervalRef = useRef(null);
  const soundRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation();

  React.useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [isRunning]);

  React.useEffect(() => {
    if (timer > 0 && timer % 60 === 0) {
      setShowBadge(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [timer]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.08, duration: 2800, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0.92, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTracks = async () => {
      try {
        setIsAudioLoading(true);
        const response = await fetch(MEDITATION_API);
        if (!response.ok) throw new Error('Failed track fetch');
        const payload = await response.json();
        const normalized = (payload.tracks || payload || [])
          .map((item, idx) => ({
            id: item.id || item.slug || `api-track-${idx}`,
            title: item.title || item.name || 'Meditation',
            length: item.length || item.duration || '—',
            url: item.url || item.audio || item.streamUrl,
          }))
          .filter((item) => item.url);
        if (!cancelled && normalized.length) {
          setTracks(normalized);
          setCurrentTrackId(normalized[0].id);
          setAudioError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAudioError('Using fallback audio');
          setTracks(FALLBACK_TRACKS);
          setCurrentTrackId(FALLBACK_TRACKS[0].id);
        }
      } finally {
        if (!cancelled) setIsAudioLoading(false);
      }
    };

    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        });
      } catch (err) {
        // Ignore configuration errors; playback will still attempt
      }
    };

    configureAudio();
    loadTracks();

    return () => {
      cancelled = true;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setTimer(0);
    setShowBadge(false);
    fadeAnim.setValue(0);
    setTipIdx(Math.floor(Math.random() * REST_TIPS.length));
    setActions(RECOVERY_ACTIONS);
  };

  const currentTrack = tracks.find((track) => track.id === currentTrackId) || tracks[0];

  const playTrack = async (trackId) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;
    setIsAudioLoading(true);
    setCurrentTrackId(trackId);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: target.url }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          playNext();
        }
      });
      soundRef.current = sound;
      setIsAudioPlaying(true);
      setAudioError(null);
    } catch (err) {
      setAudioError('Audio failed to load');
      setIsAudioPlaying(false);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!currentTrack) return;
    if (!soundRef.current) {
      await playTrack(currentTrack.id);
      return;
    }
    const status = await soundRef.current.getStatusAsync();
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsAudioPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsAudioPlaying(true);
    }
  };

  const playNext = () => {
    if (!tracks.length) return;
    const currentIdx = tracks.findIndex((t) => t.id === currentTrackId);
    const nextIdx = (currentIdx + 1) % tracks.length;
    playTrack(tracks[nextIdx].id);
  };

  React.useEffect(() => {
    if (autoStarted) return;
    if (isAudioLoading) return;
    if (!tracks.length) return;
    if (soundRef.current) return;

    (async () => {
      await playTrack(currentTrackId);
      setAutoStarted(true);
    })();
  }, [autoStarted, isAudioLoading, tracks, currentTrackId]);

  const toggleAction = (id) => {
    setActions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  const shuffleTip = () => {
    setTipIdx((prev) => {
      let next = Math.floor(Math.random() * REST_TIPS.length);
      if (REST_TIPS.length > 1) {
        while (next === prev) {
          next = Math.floor(Math.random() * REST_TIPS.length);
        }
      }
      return next;
    });
  };

  // Format timer as mm:ss
  const formatTime = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

  const contentPadding = {
    paddingTop: 56 + (insets.top || 0),
    paddingBottom: 28 + (insets.bottom || 12),
    paddingHorizontal: 20,
  };

  return (
    <ImageBackground source={require('../assets/images/gym_background.jpg')} style={styles.bg} resizeMode="cover">
      <LinearGradient colors={GRADIENTS.futuristic} style={styles.overlay} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentPadding]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'absolute', top: (insets.top || 12), left: (insets.left || 12), zIndex: 2 }}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>Recovery Lab</Text>
          <Text style={styles.subtitle}>Reset your nervous system before you push again.</Text>
        </View>

        <View style={styles.grid}>
          <View style={[styles.card, styles.gridItem, styles.timerCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Rest timer</Text>
              <TouchableOpacity style={styles.chip} onPress={shuffleTip}>
                <Text style={styles.chipText}>New tip</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.timer}>{formatTime(timer)}</Text>
            <Text style={styles.tip}>{REST_TIPS[tipIdx]}</Text>
            <View style={styles.timerBtns}>
              {!isRunning ? (
                <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleStart}>
                  <Text style={styles.btnText}>Start</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handlePause}>
                  <Text style={styles.btnText}>Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.btn, styles.ghostBtn]} onPress={handleReset}>
                <Text style={styles.btnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, styles.gridItem, styles.breatheCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Breathing cadence</Text>
              <Text style={styles.meta}>Box breathing</Text>
            </View>
            <Animated.View style={[styles.breathCircle, { transform: [{ scale: breathAnim }] }]}
              accessible
              accessibilityLabel="Breathing circle"
            >
              <Text style={styles.breathText}>In 4s • Hold 2s • Out 4s</Text>
            </Animated.View>
            <Text style={styles.helper}>Match your inhale to the pulse; longer exhales lower heart rate.</Text>
          </View>
        </View>

        <View style={[styles.card, styles.actionsCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Reset checklist</Text>
            <Text style={styles.meta}>{actions.filter((a) => a.done).length}/{actions.length} done</Text>
          </View>
          <View style={styles.actionGrid}>
            {actions.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleAction(item.id)}
                style={[styles.actionPill, item.done && styles.actionPillDone]}
              >
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionDetail}>{item.detail}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.audioCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Meditation audio</Text>
            <Text style={styles.meta}>{audioError ? 'Fallback' : 'API + fallback'}</Text>
          </View>
          <View style={styles.trackList}>
            {tracks.map((track) => {
              const active = track.id === currentTrackId;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.trackChip, active && styles.trackChipActive]}
                  onPress={() => playTrack(track.id)}
                >
                  <Text style={styles.trackTitle}>{track.title}</Text>
                  <Text style={styles.trackMeta}>{track.length}</Text>
                </TouchableOpacity>
              );
            })}
            {isAudioLoading && (
              <View style={styles.loaderRow}>
                <ActivityIndicator color={COLORS.neonCyan} />
                <Text style={styles.helper}>Loading track...</Text>
              </View>
            )}
          </View>
          {currentTrack && (
            <View style={styles.audioRow}>
              <View>
                <Text style={styles.trackNow}>{currentTrack.title}</Text>
                <Text style={styles.trackMetaSmall}>Guided calm</Text>
              </View>
              <View style={styles.audioBtns}>
                <TouchableOpacity style={[styles.btn, styles.ghostBtn]} onPress={playNext}>
                  <Text style={styles.btnText}>Next</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={togglePlayPause}>
                  <Text style={styles.btnText}>{isAudioPlaying ? 'Pause' : 'Play'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {audioError && <Text style={styles.audioError}>{audioError}</Text>}
        </View>

        {showBadge && (
          <Animated.View style={[styles.badgeWrap, { opacity: fadeAnim }]}> 
            <RewardBadge label="Rest XP" value={10} />
            <Text style={styles.badgeText}>Great job resting!</Text>
          </Animated.View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 14,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.neonCyan,
    textShadowColor: COLORS.neonPurple,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.white,
    opacity: 0.85,
  },
  grid: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: COLORS.glassDark,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.glassDarker,
  },
  gridItem: {
    flex: 1,
    minWidth: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 14,
  },
  chip: {
    backgroundColor: COLORS.neonPurple,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  timerCard: {
    flex: 1.2,
  },
  timer: {
    fontSize: 44,
    fontWeight: 'bold',
    color: COLORS.neonMagenta,
    marginBottom: 12,
    letterSpacing: 2,
  },
  tip: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 16,
    textAlign: 'left',
    fontStyle: 'italic',
    backgroundColor: COLORS.glassDarker,
    padding: 10,
    borderRadius: 12,
  },
  timerBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    flex: 1,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: COLORS.neonPurple,
  },
  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.neonPurple,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  breatheCard: {
    flex: 1,
  },
  breathCircle: {
    width: '100%',
    aspectRatio: 1.2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.neonMagenta,
    backgroundColor: COLORS.glassDarker,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  breathText: {
    color: COLORS.neonCyan,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  helper: {
    color: COLORS.white,
    opacity: 0.9,
    fontSize: 13,
  },
  meta: {
    color: COLORS.neonMagenta,
    fontSize: 12,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  actionsCard: {
    width: '100%',
  },
  audioCard: {
    width: '100%',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionPill: {
    flexBasis: '48%',
    backgroundColor: COLORS.glassDarker,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.neonPurple,
  },
  actionPillDone: {
    backgroundColor: 'rgba(0, 255, 170, 0.1)',
    borderColor: COLORS.neonCyan,
  },
  actionTitle: {
    color: COLORS.white,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionDetail: {
    color: COLORS.white,
    opacity: 0.85,
    fontSize: 12,
  },
  trackList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  trackChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.glassDarker,
    borderWidth: 1,
    borderColor: COLORS.glassDarker,
    minWidth: '45%',
  },
  trackChipActive: {
    borderColor: COLORS.neonCyan,
    backgroundColor: 'rgba(0, 255, 170, 0.08)',
  },
  trackTitle: {
    color: COLORS.white,
    fontWeight: '700',
  },
  trackMeta: {
    color: COLORS.white,
    opacity: 0.8,
    fontSize: 12,
    marginTop: 2,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  audioBtns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  trackNow: {
    color: COLORS.neonCyan,
    fontWeight: '800',
    fontSize: 16,
  },
  trackMetaSmall: {
    color: COLORS.white,
    opacity: 0.8,
    fontSize: 12,
  },
  audioError: {
    color: COLORS.neonMagenta,
    marginTop: 8,
    fontSize: 12,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: COLORS.glassDarker,
    borderRadius: 16,
    padding: 10,
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  badgeText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});
