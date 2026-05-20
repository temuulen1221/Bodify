import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import ErrorBoundary from '../components/ErrorBoundary';
import InteractiveAvatar from '../components/InteractiveAvatar';
import ScreenFrame from '../components/ScreenFrame';
import { AVATAR_PERSONALITIES, useAIAvatar } from '../components/useAIAvatar';
import GeminiLiveService from '../services/GeminiLiveService';
import { AVATAR_ANIMATIONS, RECOMMENDED_FBX_ANIMATION_OPTIONS } from '../utils/avatarAnimationConfig';
import { resolveAvatarModelSelection } from '../utils/avatarModels';

const ANIMATION_TEST_ACTIONS = [
  { label: 'Idle', kind: 'state', value: 'idle' },
  { label: 'Think', kind: 'state', value: 'thinking' },
  { label: 'Talk', kind: 'state', value: 'speaking' },
  { label: 'Wave', kind: 'animation', value: AVATAR_ANIMATIONS.WAVE },
  { label: 'Happy', kind: 'animation', value: AVATAR_ANIMATIONS.HAPPY },
  { label: 'Sad', kind: 'animation', value: AVATAR_ANIMATIONS.SAD },
];

const FBX_TEST_ACTIONS = RECOMMENDED_FBX_ANIMATION_OPTIONS.map((animation) => ({
  label: animation.label,
  kind: 'animation',
  value: animation.key,
  category: animation.category,
}));

/**
 * AIAvatarDemo - Replika-style AI Avatar screen
 * Large centered avatar with minimal UI
 */
export default function AIAvatarDemo() {
  const router = useRouter();
  const user = useSelector((state: any) => state.user || {});
  const selectedGender = String(user.gender || 'male');
  const selectedHeight = String(user.height || '175');
  const selectedWeight = String(user.weight || '70');
  const selectedPhotoUri = user.photoUri || '';
  const selectedModel = resolveAvatarModelSelection(user.avatarModel, selectedGender);

  const {
    aiResponse,
    isThinking,
    currentEmotion,
    conversationHistory,
    error,
    chat,
    latestAiOutcome,
    resetConversation,
    setPersonality,
  } = useAIAvatar({
    personality: 'friendly_coach',
    userName: user.avatarName || 'User',
    gender: selectedGender,
  });

  const [userInput, setUserInput] = useState('');
  const [selectedPersonality, setSelectedPersonality] = useState('friendly_coach');
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnimationPanel, setShowAnimationPanel] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveThinking, setLiveThinking] = useState(false);
  const [liveResponse, setLiveResponse] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveConversationHistory, setLiveConversationHistory] = useState<any[]>([]);
  const [avatarConversationState, setAvatarConversationState] = useState('idle');
  const [animationTestLabel, setAnimationTestLabel] = useState('idle');
  const scrollViewRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const liveServiceRef = useRef<any>(null);
  const liveTurnTimeoutRef = useRef<any>(null);

  const syncAvatarState = useCallback((nextState: any) => {
    const normalized = String(nextState || 'idle').toLowerCase();
    setAvatarConversationState(normalized);
    avatarRef.current?.setConversationState?.(normalized);
  }, []);

  const speakWithAvatar = useCallback((text: any, options: any = {}) => {
    const payload = String(text || '').trim();
    if (!payload) return;
    avatarRef.current?.speak?.(payload, {
      onStart: () => syncAvatarState('speaking'),
      onEnd: () => {
        syncAvatarState('idle');
        options.onEnd?.();
      },
      preserveAnimation: options.preserveAnimation,
    });
  }, [syncAvatarState]);

  const handleVoiceStart = () => {
    setIsRecording(true);
    syncAvatarState('listening');
    avatarRef.current?.startMicLipSync?.();
  };

  const handleVoiceEnd = async () => {
    setIsRecording(false);
    avatarRef.current?.stopMicLipSync?.();
    syncAvatarState('thinking');
    const simulatedVoiceTexts = [
      'What should I do today?',
      'Give me a workout',
      'How can I stay motivated?',
      'Tell me about nutrition',
      'What exercises are good for me?',
    ];
    const randomText = simulatedVoiceTexts[Math.floor(Math.random() * simulatedVoiceTexts.length)];
    setVoiceText(randomText);
    setUserInput(randomText);
  };

  const handleSendMessage = async () => {
    const message = liveMode ? (userInput || voiceText) : userInput;
    if (!message.trim()) return;

    if (liveMode && liveConnected && liveServiceRef.current) {
      setLiveError(null);
      setLiveThinking(true);
      setLiveResponse('');
      setLiveConversationHistory(prev => [...prev, { role: 'user', message }].slice(-16));
      try {
        liveServiceRef.current.sendText(message);
        if (liveTurnTimeoutRef.current) {
          clearTimeout(liveTurnTimeoutRef.current);
        }
        // Safety: some streams miss explicit turnComplete; don't leave UI blocked.
        liveTurnTimeoutRef.current = setTimeout(() => {
          setLiveThinking(false);
        }, 9000);
      } catch (error: unknown) {
        setLiveThinking(false);
        setLiveError((error as Error).message || 'Failed to send live message');
      }
    } else {
      await chat(message);
    }

    setUserInput('');
    setVoiceText('');
    setShowChat(false);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handlePersonalityChange = (personality: any) => {
    setSelectedPersonality(personality);
    setPersonality(personality);
  };

  const handleResetChat = () => {
    resetConversation();
    setShowSettings(false);
  };

  const openPoseTool = () => {
    setShowSettings(false);
    setShowChat(false);
    router.push('/Pose');
  };

  const handleAnimationTest = useCallback((action: any) => {
    if (!action || !avatarRef.current) return;

    setAnimationTestLabel(String(action.label || action.value || 'idle').toLowerCase());

    if (action.kind === 'state') {
      syncAvatarState(action.value);
      return;
    }

    avatarRef.current?.triggerAnimation?.(action.value);
  }, [syncAvatarState]);

  // Trigger avatar speech when AI responds
  useEffect(() => {
    if (aiResponse && avatarRef.current) {
      // Add a small delay for more natural conversation flow
      const timer = setTimeout(() => {
        speakWithAvatar(aiResponse, {
          onEnd: () => {
            if ((latestAiOutcome as any)?.workoutDemo) {
              avatarRef.current?.triggerWorkoutDemo?.((latestAiOutcome as any).workoutDemo);
            }
          },
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [aiResponse, latestAiOutcome, speakWithAvatar]);

  useEffect(() => {
    if (!liveMode || typeof window === 'undefined') {
      if (liveServiceRef.current) {
        liveServiceRef.current.disconnect();
        liveServiceRef.current = null;
      }
      setLiveConnected(false);
      return;
    }

    const service = new GeminiLiveService({
      onOpen: () => {
        setLiveConnected(true);
        setLiveError(null);
      },
      onClose: () => {
        setLiveConnected(false);
      },
      onError: (error: any) => {
        setLiveThinking(false);
        setLiveError(error?.message || 'Gemini Live connection error');
      },
      onText: (text: any) => {
        setLiveResponse(text);
        // First streamed token means model is responsive; keep input/send usable.
        setLiveThinking(false);
      },
      onTurnComplete: (text: any) => {
        setLiveThinking(false);
        if (liveTurnTimeoutRef.current) {
          clearTimeout(liveTurnTimeoutRef.current);
          liveTurnTimeoutRef.current = null;
        }
        if (text?.trim()) {
          speakWithAvatar(text);
          setLiveConversationHistory(prev => [...prev, { role: 'ai', message: text }].slice(-16));
        }
      },
    });

    liveServiceRef.current = service;
    service.connect().catch((error: unknown) => {
      setLiveError((error as Error).message || 'Unable to connect to Gemini Live');
      setLiveConnected(false);
    });

    return () => {
      service.disconnect();
      if (liveTurnTimeoutRef.current) {
        clearTimeout(liveTurnTimeoutRef.current);
        liveTurnTimeoutRef.current = null;
      }
      if (liveServiceRef.current === service) {
        liveServiceRef.current = null;
      }
      setLiveConnected(false);
    };
  }, [liveMode]);

  const displayedHistory = liveMode ? liveConversationHistory : conversationHistory;
  const displayedResponse = liveMode ? liveResponse : aiResponse;
  const displayedError = liveMode ? liveError : error;
  const displayedThinking = liveMode ? liveThinking : isThinking;

  useEffect(() => {
    if (isRecording && liveMode) {
      syncAvatarState('listening');
      return;
    }

    if (displayedThinking) {
      syncAvatarState('thinking');
      return;
    }

    if (!displayedResponse && avatarConversationState !== 'speaking') {
      syncAvatarState('idle');
    }
  }, [avatarConversationState, displayedResponse, displayedThinking, isRecording, liveMode, syncAvatarState]);

  return (
    <ScreenFrame backgroundColor="#f8f9fa">
      <View style={styles.container}>
      {/* Immersive Avatar Background */}
      <View style={styles.avatarBackground}>
        {/* Top Bar - Minimal */}
        <View style={styles.topBar}>
          <Pressable style={styles.historyBtn} onPress={() => setShowHistory(!showHistory)}>
            <Text style={styles.historyBtnText}>💬</Text>
          </Pressable>
          <Text style={styles.moodIndicator}>{currentEmotion.toUpperCase()}</Text>
          <Pressable style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </Pressable>
        </View>

        {/* Large Avatar */}
        <View style={styles.largeAvatarSection}>
          <ErrorBoundary fallbackMessage="Avatar failed to load. Tap to retry.">
          <InteractiveAvatar
            {...{ ref: avatarRef } as any}
            model={selectedModel}
            gender={selectedGender}
            height={selectedHeight}
            weight={selectedWeight}
            photoUri={selectedPhotoUri}
            sizeMultiplier={0.85}
            xOffset={0}
            yOffset={-0.01}
            alignFootToBottom={true}
            bottomPadding={0.02}
            headMargin={0.26}
            focus="full"
            fitMode="shrink"
            targetFill={0.76}
            enableVoice={liveMode}
            enableTTS={true}
          />
          </ErrorBoundary>
          {displayedThinking && (
            <View style={styles.thinkingBubble}>
              <ActivityIndicator size="small" color="#4F8EF7" />
              <Text style={styles.thinkingText}>{liveMode ? 'Live thinking...' : 'Thinking...'}</Text>
            </View>
          )}
          {isRecording && liveMode && (
            <View style={styles.recordingBubble}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Listening...</Text>
            </View>
          )}
        </View>

        {/* Current Response Bubble */}
        {displayedResponse && (
          <View style={styles.responseBubble}>
            <Text style={styles.responseBubbleText}>{displayedResponse}</Text>
          </View>
        )}

        {liveMode && (
          <View style={styles.liveStatusChip}>
            <Text style={styles.liveStatusText}>{liveConnected ? 'LIVE CONNECTED' : 'LIVE DISCONNECTED'}</Text>
          </View>
        )}

        {showAnimationPanel && (
          <View style={styles.animationPanel}>
            <Text style={styles.animationPanelTitle}>Animation Check</Text>
            <Text style={styles.animationPanelSubtitle}>Manual state: {animationTestLabel}</Text>
            <ScrollView style={styles.animationPanelScroll} contentContainerStyle={styles.animationPanelScrollContent}>
              <Text style={styles.animationSectionLabel}>Built-in</Text>
              <View style={styles.animationButtonGrid}>
                {ANIMATION_TEST_ACTIONS.map((action) => (
                  <Pressable
                    key={action.label}
                    style={styles.animationTestBtn}
                    onPress={() => handleAnimationTest(action)}
                  >
                    <Text style={styles.animationTestBtnText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.animationSectionLabel}>Recommended FBX</Text>
              <View style={styles.animationButtonGrid}>
                {FBX_TEST_ACTIONS.map((action) => (
                  <Pressable
                    key={action.value}
                    style={[styles.animationTestBtn, styles.animationTestBtnWide]}
                    onPress={() => handleAnimationTest(action)}
                  >
                    <Text style={styles.animationTestBtnText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Floating Action Buttons */}
        <View style={styles.floatingActions}>
          <Pressable
            style={[styles.actionBtn, styles.testActionBtn, showAnimationPanel && styles.testActionBtnActive]}
            onPress={() => setShowAnimationPanel((current) => !current)}
          >
            <Text style={styles.actionBtnText}>🎬</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.poseActionBtn]} onPress={openPoseTool}>
            <Text style={styles.actionBtnText}>🧍</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => setShowChat(true)}>
            <Text style={styles.actionBtnText}>💬</Text>
          </Pressable>
          {liveMode ? (
            <Pressable
              style={[styles.actionBtn, styles.voiceActionBtn, isRecording && styles.voiceBtnActive]}
              onPressIn={handleVoiceStart}
              onPressOut={handleVoiceEnd}
            >
              <Text style={styles.actionBtnText}>{isRecording ? '🎙️' : '🎤'}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionBtn, liveMode && styles.liveActionBtn]}
            onPress={() => setLiveMode(!liveMode)}
          >
            <Text style={styles.actionBtnText}>{liveMode ? '🔴' : '⭕'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Chat Modal - Bottom Sheet */}
      <Modal
        visible={showChat}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChat(false)}
      >
        <View style={styles.chatModalContainer}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatMessages}
            contentContainerStyle={styles.chatMessagesContent}
          >
            {displayedError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>❌ {displayedError}</Text>
              </View>
            )}

            {displayedHistory.length === 0 ? (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Start a conversation...</Text>
              </View>
            ) : (
              displayedHistory.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.messageBubble,
                    item.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  <Text style={styles.bubbleText}>{item.message}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Chat Input */}
          <View style={styles.chatInputArea}>
            <TextInput
              style={styles.chatInput}
              placeholder={liveMode ? 'Type or hold mic and speak...' : 'Say something...'}
              placeholderTextColor="#999"
              value={userInput}
              onChangeText={setUserInput}
              onSubmitEditing={handleSendMessage}
              editable={!isThinking}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, !((liveMode ? (userInput || voiceText) : userInput).trim()) && styles.sendBtnDisabled]}
              onPress={handleSendMessage}
              disabled={!((liveMode ? (userInput || voiceText) : userInput).trim())}
            >
              <Text style={styles.sendBtnText}>➤</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHistory(false)}
      >
        <Pressable style={styles.historyOverlay} onPress={() => setShowHistory(false)}>
          <View style={styles.historyModal}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Chat History</Text>
              <Pressable onPress={() => setShowHistory(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.historyContent}>
              {displayedHistory.length === 0 ? (
                <Text style={styles.noHistoryText}>No messages yet</Text>
              ) : (
                displayedHistory.map((item, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <Text style={styles.historyItemRole}>
                      {item.role === 'user' ? 'You' : 'Bodify'}
                    </Text>
                    <Text style={styles.historyItemText}>{item.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <Pressable onPress={() => setShowSettings(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.settingsContent}>
              {/* Personality */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Avatar Personality</Text>
                <View style={styles.personalityGrid}>
                  {Object.entries(AVATAR_PERSONALITIES).map(([key, value]) => (
                    <Pressable
                      key={value}
                      style={[
                        styles.personalityOption,
                        selectedPersonality === value && styles.personalityOptionActive,
                      ]}
                      onPress={() => handlePersonalityChange(value)}
                    >
                      <Text style={styles.personalityText}>
                        {value.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Mood */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Current Mood</Text>
                <View style={styles.moodBadge}>
                  <Text style={styles.moodText}>{currentEmotion.toUpperCase()}</Text>
                </View>
              </View>

              {/* Tools */}
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Tools</Text>
                <Pressable style={styles.toolBtn} onPress={openPoseTool}>
                  <Text style={styles.toolBtnText}>🧍 Pose Detection</Text>
                </Pressable>
              </View>

              {/* Reset */}
              <View style={styles.settingSection}>
                <Pressable style={styles.resetBtn} onPress={handleResetChat}>
                  <Text style={styles.resetBtnText}>🔄 New Conversation</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  avatarBackground: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBtnText: {
    fontSize: 20,
  },
  moodIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsBtnText: {
    fontSize: 20,
  },
  largeAvatarSection: {
    width: '100%',
    height: '68%',
    paddingTop: 96,
    paddingBottom: 112,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  thinkingBubble: {
    position: 'absolute',
    top: 20,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e8f0ff',
    borderRadius: 20,
    alignItems: 'center',
  },
  thinkingText: {
    fontSize: 12,
    color: '#4F8EF7',
    fontWeight: '500',
  },
  recordingBubble: {
    position: 'absolute',
    top: 20,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ff4444',
    borderRadius: 20,
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  recordingText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  responseBubble: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  responseBubbleText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  liveStatusChip: {
    position: 'absolute',
    bottom: 98,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 18, 34, 0.72)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(79, 142, 247, 0.55)',
  },
  liveStatusText: {
    color: '#cfe0ff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  animationPanel: {
    position: 'absolute',
    right: 20,
    bottom: 104,
    width: 236,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 18, 34, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(79, 142, 247, 0.42)',
  },
  animationPanelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  animationPanelScroll: {
    maxHeight: 260,
  },
  animationPanelScrollContent: {
    paddingBottom: 4,
  },
  animationPanelSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  animationSectionLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
  },
  animationButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  animationTestBtn: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  animationTestBtnWide: {
    width: '100%',
    borderRadius: 14,
    alignItems: 'flex-start',
  },
  animationTestBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingActions: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F8EF7',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 0px 8px rgba(0,0,0,0.2)',
    elevation: 5,
  },
  actionBtnText: {
    fontSize: 24,
  },
  testActionBtn: {
    backgroundColor: '#1f2937',
  },
  testActionBtnActive: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(79, 142, 247, 0.5)',
  },
  voiceActionBtn: {
    backgroundColor: '#4F8EF7',
  },
  poseActionBtn: {
    backgroundColor: '#18a957',
  },
  voiceBtnActive: {
    backgroundColor: '#ff4444',
    transform: [{ scale: 1.1 }],
  },
  liveActionBtn: {
    backgroundColor: '#ff4444',
  },

  // Chat Modal
  chatModalContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 50,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#999',
  },
  messageBubble: {
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F8EF7',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  bubbleText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  chatInputArea: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
  },
  voiceInputContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#4F8EF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
  sendBtnText: {
    fontSize: 18,
    color: 'white',
  },
  errorBox: {
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#ffe8e8',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#d32f2f',
  },

  // History Modal
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyModal: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    fontSize: 24,
    color: '#666',
  },
  historyContent: {
    padding: 12,
    maxHeight: 400,
  },
  noHistoryText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  historyItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyItemRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F8EF7',
    marginBottom: 4,
  },
  historyItemText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },

  // Settings Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  settingsContent: {
    padding: 16,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  personalityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personalityOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  personalityOptionActive: {
    backgroundColor: '#e8f0ff',
    borderColor: '#4F8EF7',
  },
  personalityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  moodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  moodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F8EF7',
  },
  toolBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e8f8ee',
    borderRadius: 8,
    alignItems: 'center',
  },
  toolBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#187a45',
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffe8e8',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d32f2f',
  },
});
