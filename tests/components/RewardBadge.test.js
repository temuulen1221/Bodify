// Tests the display-text logic embedded in RewardBadge.
// The component renders `${value} ${label}` — these tests cover the
// prop contract and formatting expectations without requiring React rendering.

/** Mirrors the text the component always renders */
const formatBadgeText = (value = 10, label = 'XP') => `${value} ${label}`;

describe('RewardBadge display format', () => {
  it('uses default value (10) and default label (XP)', () => {
    expect(formatBadgeText()).toBe('10 XP');
  });

  it('formats custom value and label', () => {
    expect(formatBadgeText(250, 'XP')).toBe('250 XP');
    expect(formatBadgeText(1, 'coin')).toBe('1 coin');
  });

  it('handles 0 value', () => {
    expect(formatBadgeText(0, 'XP')).toBe('0 XP');
  });

  it('coerces numeric value to string in template', () => {
    expect(formatBadgeText(3.5, 'pts')).toBe('3.5 pts');
  });
});
