import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ErrorBoundary from '../components/ErrorBoundary';
import InteractiveAvatar from '../components/InteractiveAvatar';
import { IDLE_LOOP_ANIMATION_OPTIONS, RECOMMENDED_FBX_ANIMATION_OPTIONS } from '../utils/avatarAnimationConfig';

type AvatarWebComponent = typeof import('../components/AvatarWeb').default;
type InteractionEntry = {
  type: string;
  text: string;
  time: string;
};
type AvatarInteractionData = {
  type?: string;
  text?: string;
};
type WebAvatarProps = {
  gender?: string;
  animationType?: string;
  sizeMultiplier?: number;
  alignFootToBottom?: boolean;
  bottomPadding?: number;
  headMargin?: number;
  focus?: string;
  fitMode?: string;
  targetFill?: number;
  modelUrl?: string;
  onVrmLoad?: () => void;
  onManagersReady?: () => void;
  expressionName?: string | null;
  expressionValue?: number;
  preserveTPose?: boolean;
};
type InteractiveAvatarProps = {
  gender?: string;
  height?: string;
  weight?: string;
  sizeMultiplier?: number;
  yOffset?: number;
  alignFootToBottom?: boolean;
  bottomPadding?: number;
  headMargin?: number;
  focus?: string;
  fitMode?: string;
  targetFill?: number;
  restingAnimation?: string;
  enableVoice?: boolean;
  enableTTS?: boolean;
  onInteraction?: (data: AvatarInteractionData) => void;
};

const InteractiveAvatarComponent = InteractiveAvatar as unknown as React.ComponentType<InteractiveAvatarProps>;

let WebAvatar: AvatarWebComponent | null = null;
if (Platform.OS === 'web') {
  // Lazy require so native bundles never evaluate the web-only component.
  WebAvatar = require('../components/AvatarWeb').default;
}
const WebAvatarComponent = WebAvatar as unknown as React.ComponentType<WebAvatarProps>;

const DEFAULT_PROFILE = {
  height: '172',
  weight: '68',
  gender: 'male',
};

const IDLE_OPTIONS = [
  { key: 'idle', label: 'Default Idle' },
  ...RECOMMENDED_FBX_ANIMATION_OPTIONS
    .filter((animation) => animation.category === 'idle-fbx')
    .map((animation) => ({ key: animation.key, label: animation.label })),
];

const RANDOM_IDLE_POOL = [
  { key: 'idle', label: 'Default Idle' },
  ...IDLE_LOOP_ANIMATION_OPTIONS,
].filter((option, index, array) => array.findIndex((entry) => entry.key === option.key) === index);

const pickRandomIdleOption = (currentKey: string, preferredKey: string) => {
  const candidates = RANDOM_IDLE_POOL.filter((option) => option.key !== currentKey);
  if (candidates.length === 0) {
    return RANDOM_IDLE_POOL.find((option) => option.key === preferredKey)
      || RANDOM_IDLE_POOL[0]
      || { key: preferredKey || 'idle', label: 'Default Idle' };
  }

  const preferredCandidate = candidates.find((option) => option.key === preferredKey);
  const pool = preferredCandidate ? [preferredCandidate, ...candidates.filter((option) => option.key !== preferredKey)] : candidates;
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
};

const WebOnlyMessage = () => (
  <View style={styles.fallbackContainer}>
    <Text style={styles.heading}>Open on Web</Text>
    <Text style={styles.body}>
      The VRM/GLB viewer runs inside a WebGL canvas. Start Expo with
      {' `expo start --web` '}and visit the{' '}
      <Text style={styles.bold}>/avatar-web</Text> route in a desktop browser.
    </Text>
  </View>
);

export default function AvatarWebScreen() {
  // Call hooks BEFORE any conditional statements
  const [showInteractive, setShowInteractive] = useState(false);
  const [interactions, setInteractions] = useState<InteractionEntry[]>([]);
  const [selectedIdleAnimation, setSelectedIdleAnimation] = useState('idle');
  const [activeIdleAnimation, setActiveIdleAnimation] = useState('idle');
  const [randomIdleMode, setRandomIdleMode] = useState(true);

  const activeIdleLabel = useMemo(
    () => IDLE_OPTIONS.find((option) => option.key === activeIdleAnimation)?.label
      || RANDOM_IDLE_POOL.find((option) => option.key === activeIdleAnimation)?.label
      || 'Default Idle',
    [activeIdleAnimation]
  );

  const selectedIdleLabel = useMemo(
    () => IDLE_OPTIONS.find((option) => option.key === selectedIdleAnimation)?.label || 'Default Idle',
    [selectedIdleAnimation]
  );

  useEffect(() => {
    if (!randomIdleMode) {
      setActiveIdleAnimation(selectedIdleAnimation);
      return;
    }

    const timeoutId = setTimeout(() => {
      setActiveIdleAnimation((current) => pickRandomIdleOption(current, selectedIdleAnimation).key);
    }, 9000 + Math.round(Math.random() * 5000));

    return () => clearTimeout(timeoutId);
  }, [randomIdleMode, selectedIdleAnimation, activeIdleAnimation]);

  const avatarProps = useMemo(
    () => ({
      ...DEFAULT_PROFILE,
      animationType: activeIdleAnimation,
      rotationSpeed: 0.15,
      sizeMultiplier: 1.05,
      alignFootToBottom: true,
      bottomPadding: 0.03,
      headMargin: 0.14,
      focus: 'full',
      fitMode: 'shrink',
      targetFill: 0.86,
      preserveTPose: true,
      modelUrl: undefined,
      onVrmLoad: () => {},
      onManagersReady: () => {},
      expressionName: null,
      expressionValue: 1,
    }),
    [activeIdleAnimation]
  );

  const handleAvatarInteraction = (data: AvatarInteractionData) => {
    setInteractions(prev => [
      {
        type: data.type || 'interaction',
        text: data.text || '',
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9),
    ]);
  };

  if (Platform.OS !== 'web' || !WebAvatar) {
    return <WebOnlyMessage />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Web VRM Avatar Preview</Text>
      <Text style={[styles.body, styles.bodyIntro]}>
        Uses Three.js + @react-three/fiber. Replace the model props below to test custom VRM or GLB
        files bundled under `assets/models/`.
      </Text>
      <View style={styles.idlePanel}>
        <Text style={styles.panelTitle}>Idle Presets</Text>
        <Text style={styles.panelBody}>
          Choose the baseline loop the avatar should hold between gestures and speech.
        </Text>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, randomIdleMode && styles.modeButtonActive]}
            onPress={() => {
              setRandomIdleMode((value) => {
                const nextValue = !value;
                setActiveIdleAnimation(nextValue
                  ? pickRandomIdleOption(activeIdleAnimation, selectedIdleAnimation).key
                  : selectedIdleAnimation);
                return nextValue;
              });
            }}
          >
            <Text style={[styles.modeButtonText, randomIdleMode && styles.modeButtonTextActive]}>
              {randomIdleMode ? 'Random Idle Cycle On' : 'Random Idle Cycle Off'}
            </Text>
          </Pressable>
          <Text style={styles.modeHint}>
            {randomIdleMode ? `Seed idle: ${selectedIdleLabel}` : `Fixed idle: ${selectedIdleLabel}`}
          </Text>
        </View>
        <View style={styles.chipRow}>
          {IDLE_OPTIONS.map((option) => {
            const isActive = option.key === selectedIdleAnimation;
            return (
              <Pressable
                key={option.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => {
                  setSelectedIdleAnimation(option.key);
                  setActiveIdleAnimation(randomIdleMode
                    ? pickRandomIdleOption(activeIdleAnimation, option.key).key
                    : option.key);
                }}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.canvasShell}>
        <WebAvatarComponent {...avatarProps} />
      </View>
      <Text style={styles.footerNote}>
        Active idle: {activeIdleLabel}. {randomIdleMode ? 'Idle loops rotate automatically with smoother crossfades.' : 'Idle changes stay fixed until you pick another preset.'}
      </Text>

      {/* Interactive Avatar Demo Section */}
      <View style={styles.divider} />
      <Text style={styles.heading}>Interactive Avatar</Text>
      <Text style={[styles.body, styles.bodyIntro]}>
        Fully interactive avatar with gesture recognition, voice input, and animations. Try:
      </Text>
      <View style={styles.instructionsList}>
        <Text style={styles.instruction}>👆 Tap the avatar to make it happy</Text>
        <Text style={styles.instruction}>👆👆 Double-tap to make it laugh</Text>
        <Text style={styles.instruction}>👈 Swipe left to wave goodbye</Text>
        <Text style={styles.instruction}>👉 Swipe right to dance</Text>
        <Text style={styles.instruction}>🎤 Speak to the avatar and it responds</Text>
      </View>

      {/* Toggle Interactive Mode */}
      <Pressable 
        style={[styles.button, showInteractive && styles.buttonActive]}
        onPress={() => setShowInteractive(!showInteractive)}
      >
        <Text style={styles.buttonText}>
          {showInteractive ? '✓ Interactive Mode ON' : 'Enable Interactive Mode'}
        </Text>
      </Pressable>

      {showInteractive && (
        <>
          <Text style={styles.subtleLabel}>Interactive avatar resting state: {activeIdleLabel}</Text>
          <View style={styles.interactiveContainer}>
            <ErrorBoundary fallbackMessage="Avatar failed to load. Tap to retry.">
            <InteractiveAvatarComponent
              gender={DEFAULT_PROFILE.gender}
              height={DEFAULT_PROFILE.height}
              weight={DEFAULT_PROFILE.weight}
              sizeMultiplier={0.98}
              yOffset={-0.04}
              alignFootToBottom={true}
              bottomPadding={0.02}
              headMargin={0.16}
              focus="full"
              fitMode="shrink"
              targetFill={0.84}
              restingAnimation={activeIdleAnimation}
              enableVoice={true}
              enableTTS={true}
              onInteraction={handleAvatarInteraction}
            />
            </ErrorBoundary>
          </View>

          {/* Interaction Log */}
          <View style={styles.logContainer}>
            <Text style={styles.logTitle}>Interaction Log</Text>
            {interactions.length === 0 ? (
              <Text style={styles.logEmpty}>Start interacting with the avatar...</Text>
            ) : (
              interactions.map((interaction, idx) => (
                <View key={idx} style={styles.logEntry}>
                  <Text style={styles.logTime}>{interaction.time}</Text>
                  <Text style={styles.logType}>{interaction.type}</Text>
                  <Text style={styles.logText}>{interaction.text}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 960,
    marginHorizontal: 'auto',
    padding: 24,
  },
  canvasShell: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020409',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
    marginTop: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#222',
  },
  bodyIntro: {
    marginBottom: 4,
  },
  idlePanel: {
    backgroundColor: '#f5f7fb',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  panelBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
    marginTop: 4,
  },
  modeRow: {
    marginTop: 14,
  },
  modeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  modeButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  modeHint: {
    fontSize: 13,
    color: '#475467',
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  footerNote: {
    fontSize: 14,
    color: '#444',
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 24,
  },
  instructionsList: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#333',
    marginVertical: 4,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 12,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: '#2E5CB8',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  subtleLabel: {
    fontSize: 13,
    color: '#475467',
    marginTop: 4,
  },
  interactiveContainer: {
    width: '100%',
    height: 500,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020409',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 12,
  },
  logContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    maxHeight: 300,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  logEmpty: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 8,
  },
  logEntry: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'white',
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4F8EF7',
  },
  logTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  logType: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    marginTop: 2,
  },
  logText: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
    fontStyle: 'italic',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  bold: {
    fontWeight: '600',
  },
});
