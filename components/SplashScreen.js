import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, GRADIENTS } from '../utils/constants';

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    // Auto-advance after 3 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <LinearGradient
      colors={GRADIENTS?.futuristic || ['#0F0F23', '#1A1A2E', '#16213E']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Bodify</Text>
        <Text style={styles.subtitle}>Your Fitness Journey Starts Here</Text>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={onFinish}
        activeOpacity={0.85}
      >
        <Text style={styles.skipText}>Get Started</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS?.neonCyan || '#00E7FF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: COLORS?.neonPurple || '#6A00FF',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  skipButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: COLORS?.neonPurple || '#6A00FF',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: COLORS?.neonCyan || '#00E7FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
