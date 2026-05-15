import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import InteractiveAvatar from '../components/InteractiveAvatar';
import { AVATAR_PERSONALITIES, useAIAvatar } from '../components/useAIAvatar';
import { resolveAvatarModelSelection } from '../utils/avatarModels';

/**
 * AIAvatarDemo - Full demonstration of AI-powered interactive avatar
 * Shows conversation, emotion detection, and dynamic animations
 */
export default function AIAvatarDemo() {
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
    currentAnimation,
    conversationHistory,
    error,
    chat,
    getWorkoutAdvice,
    analyzeMetrics,
    getEncouragement,
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
  const scrollViewRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);

  useEffect(() => {
    if (!(latestAiOutcome as any)?.workoutDemo) return;
    avatarRef.current?.triggerWorkoutDemo?.((latestAiOutcome as any).workoutDemo);
  }, [latestAiOutcome]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    await chat(userInput);
    setUserInput('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleQuickAction = async (action: any) => {
    switch (action) {
      case 'workout':
        await getWorkoutAdvice('pushups');
        break;
      case 'metrics':
        await analyzeMetrics({ steps: 8000, pushups: 25, waterIntake: 1.5 });
        break;
      case 'encouragement':
        await getEncouragement('tired');
        break;
      case 'reset':
        resetConversation();
        break;
    }
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handlePersonalityChange = (personality: any) => {
    setSelectedPersonality(personality);
    setPersonality(personality);
  };

  return (
    <View style={styles.container}>
      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <InteractiveAvatar
          {...{ ref: avatarRef } as any}
          model={selectedModel}
          gender={selectedGender}
          height={selectedHeight}
          weight={selectedWeight}
          photoUri={selectedPhotoUri}
          sizeMultiplier={0.87}
          yOffset={0}
          alignFootToBottom={true}
          bottomPadding={0.02}
          headMargin={0.24}
          focus="full"
          fitMode="shrink"
          targetFill={0.78}
          enableVoice={false}
          enableTTS={false}
        />
        {/* Emotion Indicator */}
        <View style={styles.emotionBadge}>
          <Text style={styles.emotionText}>
            {currentEmotion.toUpperCase()}
          </Text>
        </View>
        {isThinking && (
          <View style={styles.thinkingIndicator}>
            <ActivityIndicator size="small" color="#4F8EF7" />
            <Text style={styles.thinkingText}>Avatar is thinking...</Text>
          </View>
        )}
      </View>

      {/* Personality Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personalityScroll}>
        {Object.entries(AVATAR_PERSONALITIES).map(([key, value]) => (
          <Pressable
            key={value}
            style={[
              styles.personalityBtn,
              selectedPersonality === value && styles.personalityBtnActive,
            ]}
            onPress={() => handlePersonalityChange(value)}
          >
            <Text style={styles.personalityBtnText}>
              {value.replace(/_/g, ' ').toUpperCase().slice(0, 15)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={() => handleQuickAction('workout')}>
          <Text style={styles.quickBtnText}>💪 Workout</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => handleQuickAction('metrics')}>
          <Text style={styles.quickBtnText}>📊 Metrics</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => handleQuickAction('encouragement')}>
          <Text style={styles.quickBtnText}>🙌 Encourage</Text>
        </Pressable>
        <Pressable style={[styles.quickBtn, styles.resetBtn]} onPress={() => handleQuickAction('reset')}>
          <Text style={styles.quickBtnText}>🔄 Reset</Text>
        </Pressable>
      </View>

      {/* Conversation Display */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.conversationBox}
        contentContainerStyle={styles.conversationContent}
      >
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}

        {(conversationHistory as any[]).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>👋 Start a conversation!</Text>
            <Text style={styles.emptyStateSubtext}>Tap a quick action or type a message</Text>
          </View>
        ) : (
          (conversationHistory as any[]).map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.messageBox,
                item.role === 'user' ? styles.userMessage : styles.aiMessage,
              ]}
            >
              <Text style={styles.messageText}>{item.message}</Text>
              {item.role === 'ai' && item.emotion && (
                <Text style={styles.emotionTag}>
                  {item.emotion}
                </Text>
              )}
            </View>
          ))
        )}

        {aiResponse && !(conversationHistory as any[]).some((m: any) => m.message === aiResponse) && (
          <View style={styles.aiMessage}>
            <Text style={styles.messageText}>{aiResponse}</Text>
            <Text style={styles.emotionTag}>{currentEmotion}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          placeholder="Ask the avatar anything..."
          placeholderTextColor="#999"
          value={userInput}
          onChangeText={setUserInput}
          onSubmitEditing={handleSendMessage}
          editable={!isThinking}
        />
        <Pressable
          style={[styles.sendBtn, isThinking && styles.sendBtnDisabled]}
          onPress={handleSendMessage}
          disabled={isThinking || !userInput.trim()}
        >
          <Text style={styles.sendBtnText}>
            {isThinking ? '⏳' : '➤'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  avatarSection: {
    height: 300,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  emotionBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#4F8EF7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emotionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  thinkingIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  thinkingText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  personalityScroll: {
    height: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 8,
  },
  personalityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
  },
  personalityBtnActive: {
    backgroundColor: '#4F8EF7',
  },
  personalityBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#e8f0ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtn: {
    backgroundColor: '#ffe8e8',
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  conversationBox: {
    flex: 1,
    backgroundColor: 'white',
  },
  conversationContent: {
    padding: 12,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  messageBox: {
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F8EF7',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emotionTag: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorBox: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#ffe8e8',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
  },
  inputSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    fontSize: 14,
    color: '#333',
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
});
