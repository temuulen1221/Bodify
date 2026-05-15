import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { AVATAR_ANIMATIONS } from '../utils/avatarAnimationConfig';

const RESPONSES = [
  { gesture: 'tap', animation: AVATAR_ANIMATIONS.HAPPY, sound: 'tap.mp3', text: 'Hey there!' },
  { gesture: 'doubleTap', animation: AVATAR_ANIMATIONS.LAUGH, sound: 'laugh.mp3', text: 'That tickles!' },
  { gesture: 'swipeLeft', animation: AVATAR_ANIMATIONS.WAVE, sound: 'wave.mp3', text: 'See you later!' },
  { gesture: 'swipeRight', animation: AVATAR_ANIMATIONS.DANCE, sound: 'dance.mp3', text: 'Let\'s dance!' },
  { gesture: 'longPress', animation: AVATAR_ANIMATIONS.SURPRISED, sound: 'surprised.mp3', text: 'Oh!' },
  { gesture: 'pinch', animation: AVATAR_ANIMATIONS.TALK, sound: 'talk.mp3', text: 'Whoa, that\'s tight!' },
];

/**
 * Provides tap, double-tap, swipe, and long-press gesture handlers for the avatar.
 * @param {object} callbacks
 * @param {function} callbacks.playSound
 * @param {function} callbacks.speak
 * @param {function} callbacks.triggerAnimation
 * @param {function} [callbacks.onInteraction]
 */
export function useAvatarGestures({ playSound, speak, triggerAnimation, onInteraction }) {
  const handleTap = useCallback(() => {
    const response = RESPONSES.find(r => r.gesture === 'tap');
    if (response) {
      playSound(response.sound);
      speak(response.text);
      triggerAnimation(response.animation);
      onInteraction?.({ type: 'tap', animation: response.animation, text: response.text });
    }
  }, [playSound, speak, triggerAnimation, onInteraction]);

  const handleDoubleTap = useCallback(() => {
    const response = RESPONSES.find(r => r.gesture === 'doubleTap');
    if (response) {
      playSound(response.sound);
      speak(response.text);
      triggerAnimation(response.animation);
      onInteraction?.({ type: 'doubleTap', animation: response.animation, text: response.text });
    }
  }, [playSound, speak, triggerAnimation, onInteraction]);

  const handleSwipeLeft = useCallback(() => {
    const response = RESPONSES.find(r => r.gesture === 'swipeLeft');
    if (response) {
      playSound(response.sound);
      speak(response.text);
      triggerAnimation(response.animation);
      onInteraction?.({ type: 'swipeLeft', animation: response.animation, text: response.text });
    }
  }, [playSound, speak, triggerAnimation, onInteraction]);

  const handleSwipeRight = useCallback(() => {
    const response = RESPONSES.find(r => r.gesture === 'swipeRight');
    if (response) {
      playSound(response.sound);
      speak(response.text);
      triggerAnimation(response.animation);
      onInteraction?.({ type: 'swipeRight', animation: response.animation, text: response.text });
    }
  }, [playSound, speak, triggerAnimation, onInteraction]);

  const handleLongPress = useCallback(() => {
    const response = RESPONSES.find(r => r.gesture === 'longPress');
    if (response) {
      playSound(response.sound);
      speak(response.text);
      triggerAnimation(response.animation);
      onInteraction?.({ type: 'longPress', animation: response.animation, text: response.text });
    }
  }, [playSound, speak, triggerAnimation, onInteraction]);

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(handleTap);
  const doubleTapGesture = Gesture.Tap().numberOfTaps(2).runOnJS(true).onStart(handleDoubleTap);
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -50) {
        handleSwipeLeft();
      } else if (e.translationX > 50) {
        handleSwipeRight();
      }
    });
  const longPressGesture = Gesture.LongPress().minDuration(500).runOnJS(true).onStart(handleLongPress);

  const gestures = Gesture.Simultaneous(
    doubleTapGesture,
    tapGesture,
    panGesture,
    longPressGesture,
  );

  return { gestures };
}
