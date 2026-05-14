/**
 * Avatar Sound Effects Library
 * Place actual .mp3 or .wav files in this directory
 * 
 * Required sounds for interactive avatar:
 * - tap.mp3          (tap/click response)
 * - laugh.mp3        (happy/laugh response)
 * - wave.mp3         (goodbye/wave gesture)
 * - dance.mp3        (dance/excited animation)
 * - surprised.mp3    (surprised expression)
 * - talk.mp3         (generic talking sound)
 * - listen.mp3       (listening acknowledgment)
 * 
 * Optional sounds for extended interactions:
 * - error.mp3        (error/confused response)
 * - success.mp3      (success acknowledgment)
 * - think.mp3        (thinking sound)
 * - sleep.mp3        (sleeping/tired sound)
 * - wake.mp3         (wake up sound)
 * - cheer.mp3        (celebration/cheer)
 * 
 * You can download free sound effects from:
 * - Freesound.org
 * - Pixabay.com/sounds
 * - Zapsplat.com
 */

// Placeholder sound mappings
export const SOUND_MAP = {
  'tap.mp3': require('./tap.mp3'),        // TODO: Add actual sound
  'laugh.mp3': require('./laugh.mp3'),    // TODO: Add actual sound
  'wave.mp3': require('./wave.mp3'),      // TODO: Add actual sound
  'dance.mp3': require('./dance.mp3'),    // TODO: Add actual sound
  'surprised.mp3': require('./surprised.mp3'), // TODO: Add actual sound
  'talk.mp3': require('./talk.mp3'),      // TODO: Add actual sound
  'listen.mp3': require('./listen.mp3'),  // TODO: Add actual sound
};

export default SOUND_MAP;
