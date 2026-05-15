import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';

const USE_NATIVE_DRIVER = false;
const RECOVERY_COPY = {
  eyebrow: 'STAND BY',
  title: 'Build calm before the next set.',
  subtitle: 'Take deep breaths and let your body recover.',
  inhale: 'Fill the ribs slowly.',
};

const RECOVERY_ACTIONS = [
  { id: 'hydrate', title: 'Hydrate 200ml', detail: 'Slow sips calm your nervous system.' },
  { id: 'stretch', title: 'Loosen shoulders', detail: 'Roll out tension for better posture.' },
  { id: 'breath', title: '3 box breaths', detail: 'In 4s • Hold 2s • Out 4s.' },
  { id: 'log', title: 'Log mood', detail: 'Notice how you feel before lifting again.' },
];

const RECOVERY_MODES = [
  { id: 'downshift', label: '2 min', subtitle: 'Quick downshift', minutes: 2 },
  { id: 'full-reset', label: '5 min', subtitle: 'Full reset', minutes: 5 },
  { id: 'deep-recovery', label: '10 min', subtitle: 'Deep recovery', minutes: 10 },
];

const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export default function Rest() {
  const insets = useSafeAreaInsets();
  const [selectedModeId, setSelectedModeId] = useState('full-reset');
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [actions, setActions] = useState<Array<{ id: string; title: string; detail: string; done?: boolean }>>(RECOVERY_ACTIONS);
  const breathAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<any>(null);

  const selectedMode = useMemo(
    () => RECOVERY_MODES.find((mode) => mode.id === selectedModeId) || RECOVERY_MODES[1],
    [selectedModeId],
  );

  const totalSeconds = selectedMode.minutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - timer);
  const completedActionCount = actions.filter((item) => item.done).length;
  const recoveryScore = completedActionCount * 25;
  const progressRatio = totalSeconds > 0 ? Math.min(1, timer / totalSeconds) : 0;

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }

    intervalRef.current = setInterval(() => {
      setTimer((current) => {
        if (current >= totalSeconds) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          return totalSeconds;
        }
        return current + 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, totalSeconds]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.08, duration: 2800, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(breathAnim, { toValue: 0.92, duration: 2600, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  const toggleAction = (actionId: any) => {
    setActions((current) => current.map((action) => (
      action.id === actionId ? { ...action, done: !action.done } : action
    )));
  };

  const handleSelectMode = (modeId: any) => {
    setSelectedModeId(modeId);
    setTimer(0);
    setIsRunning(false);
  };

  const handleStart = () => setIsRunning(true);
  const handleReset = () => {
    setIsRunning(false);
    setTimer(0);
    setActions(RECOVERY_ACTIONS);
  };

  return (
    <ImageBackground source={require('../assets/images/gym_background.jpg')} style={styles.background} resizeMode="cover">
      <LinearGradient colors={['rgba(8,14,28,0.55)', 'rgba(5,8,20,0.72)', 'rgba(3,7,18,0.85)']} style={styles.overlay} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(22, (insets.top || 0) + 14),
            paddingBottom: Math.max(28, (insets.bottom || 0) + 18),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backButtonWrap}>
          <BackButton />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Recovery Lab</Text>
          <Text style={styles.subtitle}>Reset your nervous system before you push again.</Text>
        </View>

        <View style={styles.sessionCard}>
          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sessionLabel}>Recovery session</Text>
            <Text style={styles.sessionModeLabel}>{selectedMode.subtitle}</Text>
          </View>

          <Text style={styles.eyebrow}>{RECOVERY_COPY.eyebrow}</Text>
          <Text style={styles.sessionTitle}>{RECOVERY_COPY.title}</Text>
          <Text style={styles.sessionSubtitle}>{RECOVERY_COPY.subtitle}</Text>

          <Animated.View style={[styles.breathPromptCard, { transform: [{ scale: breathAnim }] }]}> 
            <Text style={styles.breathPromptLabel}>INHALE</Text>
            <Text style={styles.breathPromptValue}>4s</Text>
          </Animated.View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{recoveryScore}</Text>
              <Text style={styles.metricLabel}>Recovery score</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatTime(remainingSeconds)}</Text>
              <Text style={styles.metricLabel}>Remaining</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{`${completedActionCount}/${actions.length}`}</Text>
              <Text style={styles.metricLabel}>Checklist</Text>
            </View>
          </View>

          <View style={styles.modeRow}>
            {RECOVERY_MODES.map((mode) => {
              const selected = mode.id === selectedModeId;
              return (
                <TouchableOpacity
                  key={mode.id}
                  activeOpacity={0.88}
                  onPress={() => handleSelectMode(mode.id)}
                  style={[styles.modePill, selected && styles.modePillSelected]}
                >
                  <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>{mode.label}</Text>
                  <Text style={[styles.modeSubtitle, selected && styles.modeSubtitleSelected]}>{mode.subtitle}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(8, progressRatio * 100)}%` }]} />
          </View>

          <View style={styles.bottomPanelRow}>
            <View style={styles.timerPanel}>
              <Text style={styles.timerText}>{formatTime(timer)}</Text>
              <Text style={styles.timerTargetText}>{`Target: ${selectedMode.minutes} min recovery block`}</Text>
              <View style={styles.timerButtonRow}>
                <TouchableOpacity activeOpacity={0.88} onPress={handleStart} style={[styles.primaryButton, isRunning && styles.primaryButtonMuted]}>
                  <Text style={styles.primaryButtonText}>{isRunning ? 'Running' : 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.88} onPress={handleReset} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inhalePanel}>
              <Text style={styles.inhaleTitle}>Inhale</Text>
              <Text style={styles.inhaleSubtitle}>{RECOVERY_COPY.inhale}</Text>
            </View>
          </View>
        </View>

        <View style={styles.checklistPanel}>
          <View style={styles.checklistHeaderRow}>
            <Text style={styles.checklistTitle}>Reset checklist</Text>
            <Text style={styles.checklistMeta}>{`${completedActionCount}/${actions.length} done`}</Text>
          </View>
          <View style={styles.checklistGrid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                activeOpacity={0.88}
                onPress={() => toggleAction(action.id)}
                style={[styles.checklistItem, action.done && styles.checklistItemDone]}
              >
                <Text style={styles.checklistItemTitle}>{action.title}</Text>
                <Text style={styles.checklistItemDetail}>{action.detail}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  backButtonWrap: {
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  header: {
    marginTop: 4,
    gap: 8,
  },
  title: {
    color: '#00D6FF',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  sessionCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(10, 18, 34, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.28)',
    overflow: 'hidden',
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sessionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sessionModeLabel: {
    color: '#FF00F5',
    fontSize: 13,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#FF00F5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  sessionTitle: {
    color: '#F8FBFF',
    fontSize: 26,
    lineHeight: 37,
    fontWeight: '900',
    maxWidth: 260,
  },
  sessionSubtitle: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
  },
  breathPromptCard: {
    marginTop: 18,
    width: 112,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 10, 22, 0.7)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  breathPromptLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  breathPromptValue: {
    marginTop: 8,
    color: '#00D6FF',
    fontSize: 22,
    fontWeight: '900',
  },
  metricRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 8, 18, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  metricValue: {
    color: '#00D6FF',
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
  },
  modeRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  modePill: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(5, 8, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modePillSelected: {
    borderColor: 'rgba(0,231,255,0.95)',
    backgroundColor: 'rgba(0,231,255,0.12)',
  },
  modeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  modeLabelSelected: {
    color: '#00E7FF',
  },
  modeSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
    fontWeight: '700',
  },
  modeSubtitleSelected: {
    color: 'rgba(255,255,255,0.86)',
  },
  progressTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#16D9FF',
  },
  bottomPanelRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  timerPanel: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 8, 18, 0.78)',
    padding: 16,
    justifyContent: 'space-between',
  },
  timerText: {
    color: '#FF00F5',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  timerTargetText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
  },
  timerButtonRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A00FF',
  },
  primaryButtonMuted: {
    opacity: 0.78,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106,0,255,0.9)',
    backgroundColor: 'rgba(106,0,255,0.08)',
  },
  secondaryButtonText: {
    color: '#F5F8FE',
    fontSize: 16,
    fontWeight: '800',
  },
  inhalePanel: {
    width: 152,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 8, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,245,0.58)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
  },
  inhaleTitle: {
    color: '#00D6FF',
    fontSize: 22,
    fontWeight: '900',
  },
  inhaleSubtitle: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  checklistPanel: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(10, 18, 34, 0.54)',
    borderWidth: 1,
    borderColor: 'rgba(0,231,255,0.22)',
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  checklistMeta: {
    color: '#00E7FF',
    fontSize: 12,
    fontWeight: '800',
  },
  checklistGrid: {
    gap: 10,
  },
  checklistItem: {
    borderRadius: 18,
    backgroundColor: 'rgba(5, 8, 18, 0.72)',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  checklistItemDone: {
    borderColor: 'rgba(0,231,255,0.58)',
    backgroundColor: 'rgba(0,231,255,0.08)',
  },
  checklistItemTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  checklistItemDetail: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
