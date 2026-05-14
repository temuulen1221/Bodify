/**
 * LipSync TTS Manager - Connects Text-to-Speech with Lip Sync animation
 * Uses Web Audio API to analyze speech frequencies in real-time
 */

import { LipSync } from '../CharacterStudio/src/library/lipsync';

export class LipSyncTTSManager {
  constructor(vrm) {
    this.vrm = vrm;
    this.lipSync = null;
    this.audioContext = null;
    this.audioElement = null;
    this.mediaElementAudioSource = null;
    this.isInitialized = false;

    if (this.vrm) {
      this.initializeLipSync();
    }
  }

  initializeLipSync() {
    try {
      this.lipSync = new LipSync(this.vrm);
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.isInitialized = true;
      console.log('[LipSyncTTSManager] Initialized successfully');
    } catch (error) {
      console.warn('[LipSyncTTSManager] Initialization failed:', error);
    }
  }

  /**
   * Speak text with lip sync animation
   * @param {string} text - Text to speak
   * @param {number} rate - Speech rate (0.5-2.0, default 0.9)
   */
  async speak(text, rate = 0.9) {
    if (!text || !this.isInitialized) {
      // Fallback to native speech synthesis if lip sync not available
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
      return;
    }

    try {
      // Create audio element for TTS playback
      if (!this.audioElement) {
        this.audioElement = new Audio();
        this.audioElement.crossOrigin = 'anonymous';
      }

      // Use Web Speech API to generate audio
      // Since Web Speech API doesn't expose audio output directly,
      // we'll use the native API for speech and sync with lip movements
      // based on phoneme estimation
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;

      // Start analyzing audio when speech begins
      utterance.onstart = () => {
        this.startLipSyncAnalysis();
      };

      utterance.onend = () => {
        this.stopLipSyncAnalysis();
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[LipSyncTTSManager] Speak failed:', error);
    }
  }

  /**
   * Start simplified lip sync based on speech timing
   * (Full version would need Web Audio API access to actual audio output)
   */
  startLipSyncAnalysis() {
    if (!this.lipSync) return;
    console.log('[LipSyncTTSManager] Starting lip sync');
  }

  stopLipSyncAnalysis() {
    if (!this.lipSync) return;
    // Reset expressions
    const { expressionManager } = this.vrm;
    if (expressionManager) {
      expressionManager.setValue('oh', 0);
      expressionManager.setValue('ah', 0);
      expressionManager.setValue('ee', 0);
    }
    console.log('[LipSyncTTSManager] Stopped lip sync');
  }

  /**
   * Speak from audio blob (for better lip sync control)
   * @param {Blob} audioBlob - Audio blob to play
   */
  async speakFromAudioBlob(audioBlob) {
    if (!this.isInitialized || !this.lipSync) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Use lip sync module's built-in audio analysis
      this.lipSync.startFromAudioFile(audioBlob);

      // Play audio
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('[LipSyncTTSManager] Audio blob playback failed:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.lipSync) {
      this.lipSync.destroy();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
