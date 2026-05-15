// Tests pure helper functions from components/avatar.js.
// These functions are not exported so we inline their implementations here;
// they are pure and have no native-module dependencies.

// --- resolveActionStartTime ---
const resolveActionStartTime = (clip, loop, previousAction) => {
  const clipDuration = Number(clip?.duration) || 0;
  if (!previousAction || clipDuration <= 0) return 0;
  if (loop) return Math.min(0.08, clipDuration * 0.08);
  return Math.min(0.05, clipDuration * 0.06);
};

// --- base64ToUint8Array ---
const base64ToUint8Array = (base64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const output = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < base64.length; i++) {
    const c = base64.charAt(i);
    if (c === '=') break;
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
};

describe('resolveActionStartTime', () => {
  it('returns 0 when no previous action exists', () => {
    expect(resolveActionStartTime({ duration: 2 }, false, null)).toBe(0);
    expect(resolveActionStartTime({ duration: 2 }, true, undefined)).toBe(0);
  });

  it('returns 0 when clip duration is zero or missing', () => {
    expect(resolveActionStartTime({ duration: 0 }, true, {})).toBe(0);
    expect(resolveActionStartTime({}, true, {})).toBe(0);
  });

  it('caps looping start time at 0.08 seconds', () => {
    expect(resolveActionStartTime({ duration: 2 }, true, {})).toBeCloseTo(0.08);
    expect(resolveActionStartTime({ duration: 100 }, true, {})).toBeCloseTo(0.08);
  });

  it('scales looping start time for short clips', () => {
    // duration=0.5: 0.5*0.08=0.04, which is < 0.08
    expect(resolveActionStartTime({ duration: 0.5 }, true, {})).toBeCloseTo(0.04);
  });

  it('caps non-looping start time at 0.05 seconds', () => {
    expect(resolveActionStartTime({ duration: 2 }, false, {})).toBeCloseTo(0.05);
    expect(resolveActionStartTime({ duration: 100 }, false, {})).toBeCloseTo(0.05);
  });

  it('scales non-looping start time for short clips', () => {
    // duration=0.5: 0.5*0.06=0.03, which is < 0.05
    expect(resolveActionStartTime({ duration: 0.5 }, false, {})).toBeCloseTo(0.03);
  });
});

describe('base64ToUint8Array', () => {
  it('decodes "hello" correctly', () => {
    // 'hello' → base64 → 'aGVsbG8='
    const result = base64ToUint8Array('aGVsbG8=');
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it('returns a Uint8Array instance', () => {
    expect(base64ToUint8Array('aGVsbG8=') instanceof Uint8Array).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(base64ToUint8Array('').length).toBe(0);
  });

  it('stops at padding character', () => {
    // Single byte 'A' (65) encodes to 'QQ=='
    const result = base64ToUint8Array('QQ==');
    expect(Array.from(result)).toEqual([65]);
  });

  it('skips characters not in the base64 alphabet', () => {
    // Invalid char ' ' (space) gets ignored; valid output unchanged
    const clean = base64ToUint8Array('aGVsbG8=');
    const dirty = base64ToUint8Array('aGVs bG8=');
    expect(Array.from(clean)).toEqual(Array.from(dirty));
  });
});
