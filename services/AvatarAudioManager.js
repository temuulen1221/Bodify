// TODO: Migrate from expo-av to expo-audio or expo-video. See Expo SDK 54 migration guide.
// import * as Audio from 'expo-av';

/**
 * AvatarAudioManager - Manages sound effects and TTS for interactive avatar
 */
class AvatarAudioManager {
  constructor() {
    this.soundPlayers = new Map();
    this.ttsSupported = typeof window !== 'undefined' && window.speechSynthesis;
  }

  /**
   * Load and cache a sound file
   */
  async loadSound(soundName, require) {
    if (this.soundPlayers.has(soundName)) {
      return this.soundPlayers.get(soundName);
    }

    try {
      const { sound } = await Audio.Sound.createAsync(require);
      this.soundPlayers.set(soundName, sound);
      return sound;
    } catch (error) {
      console.warn(`[AvatarAudioManager] Failed to load sound ${soundName}:`, error);
      return null;
    }
  }

  /**
   * Play a sound effect
   */
  async playSound(soundName, soundMap) {
    try {
      if (!soundMap[soundName]) {
        console.warn(`[AvatarAudioManager] Sound ${soundName} not found`);
        return;
      }

      const sound = await this.loadSound(soundName, soundMap[soundName]);
      if (sound) {
        await sound.playAsync();
      }
    } catch (error) {
      console.warn(`[AvatarAudioManager] Play sound error:`, error);
    }
  }

  /**
   * Speak text using Text-To-Speech
   */
  speak(text, options = {}) {
    if (!this.ttsSupported) {
      console.warn('[AvatarAudioManager] TTS not supported');
      return;
    }

    const {
      rate = 0.9,
      pitch = 1.0,
      volume = 1.0,
      lang = 'en-US',
      onStart = null,
      onEnd = null,
    } = options;

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      utterance.lang = lang;

      if (onStart) utterance.onstart = onStart;
      if (onEnd) utterance.onend = onEnd;

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('[AvatarAudioManager] TTS error:', error);
    }
  }

  /**
   * Get available voices for TTS
   */
  getAvailableVoices() {
    if (!this.ttsSupported) return [];
    return window.speechSynthesis.getVoices();
  }

  /**
   * Set a specific voice for TTS
   */
  setVoice(voiceIndex = 0) {
    if (!this.ttsSupported) return;
    const voices = this.getAvailableVoices();
    if (voices.length > voiceIndex) {
      this.currentVoice = voices[voiceIndex];
    }
  }

  /**
   * Stop all audio playback
   */
  stopAll() {
    try {
      if (this.ttsSupported) {
        window.speechSynthesis.cancel();
      }
      this.soundPlayers.forEach(sound => {
        sound.pauseAsync?.();
      });
    } catch (error) {
      console.warn('[AvatarAudioManager] Stop all error:', error);
    }
  }

  /**
   * Unload and cleanup all resources
   */
  async cleanup() {
    try {
      this.stopAll();
      for (const [name, sound] of this.soundPlayers) {
        await sound.unloadAsync();
      }
      this.soundPlayers.clear();
    } catch (error) {
      console.warn('[AvatarAudioManager] Cleanup error:', error);
    }
  }
}

// Singleton instance
export const audioManager = new AvatarAudioManager();

export default AvatarAudioManager;
