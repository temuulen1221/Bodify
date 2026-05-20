/**
 * Cross-platform shadow helpers for React Native + react-native-web.
 *
 * Both React Native 0.76+ and react-native-web 0.19+ support the unified
 * `boxShadow` / `textShadow` CSS string properties.  The legacy per-prop
 * equivalents (shadowColor, shadowOffset, …) are deprecated on web.
 *
 * Usage:
 *   import { makeShadow, makeTextShadow } from '../utils/shadow';
 *
 *   const styles = StyleSheet.create({
 *     card: {
 *       ...makeShadow(COLORS.neonPurple, 0, 12, 24, 0.35),
 *     },
 *   });
 */

/** @param {string} hex  '#RRGGBB' */
function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Returns a `{ boxShadow }` style object compatible with RN ≥ 0.76 and web.
 *
 * @param {string}  color     CSS color string (hex, rgba, named…)
 * @param {number}  offsetX   horizontal offset in dp/px
 * @param {number}  offsetY   vertical offset in dp/px
 * @param {number}  blur      blur radius in dp/px
 * @param {number}  [opacity] opacity multiplier (applied when color is #RRGGBB)
 * @returns {{ boxShadow: string }}
 */
export function makeShadow(color, offsetX, offsetY, blur, opacity = 1) {
  const resolvedColor =
    opacity < 1 && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
      ? hexToRgba(color, opacity)
      : color;
  return { boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${resolvedColor}` };
}

/**
 * Returns a `{ textShadow }` style object compatible with RN ≥ 0.76 and web.
 *
 * @param {string}  color
 * @param {number}  offsetX
 * @param {number}  offsetY
 * @param {number}  blur
 * @returns {{ textShadow: string }}
 */
export function makeTextShadow(color, offsetX, offsetY, blur) {
  return { textShadow: `${offsetX}px ${offsetY}px ${blur}px ${color}` };
}
