// Tests the progress-percentage calculation used by QuestProgress.
// Mirrors: pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)))

const calcProgressPct = (value, max) =>
  Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));

describe('QuestProgress percentage calculation', () => {
  it('returns 0 for zero value', () => {
    expect(calcProgressPct(0, 100)).toBe(0);
  });

  it('returns 100 at or above max', () => {
    expect(calcProgressPct(100, 100)).toBe(100);
    expect(calcProgressPct(150, 100)).toBe(100);
  });

  it('calculates midpoint correctly', () => {
    expect(calcProgressPct(5, 10)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    expect(calcProgressPct(1, 3)).toBe(33);   // 33.33… → 33
    expect(calcProgressPct(2, 3)).toBe(67);   // 66.66… → 67
  });

  it('prevents division by zero when max is 0 (clamps to 100)', () => {
    // max(1, 0) = 1, so value/1 * 100 = value*100, clamped to 100
    expect(calcProgressPct(1, 0)).toBe(100);
    expect(calcProgressPct(0, 0)).toBe(0);
  });

  it('clamps negative values to 0', () => {
    expect(calcProgressPct(-5, 100)).toBe(0);
  });

  it('handles large max without overflow', () => {
    expect(calcProgressPct(1, 1000)).toBe(0); // 0.1 → rounds to 0
    expect(calcProgressPct(500, 1000)).toBe(50);
  });
});
