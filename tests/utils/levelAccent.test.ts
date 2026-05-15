import { getLevelAccent } from '../../utils/levelAccent';

// Each accent object must have these five shape properties
const REQUIRED_KEYS = ['cardColors', 'borderColor', 'glowColor', 'accentText', 'pillColor'];

const assertShape = (accent: ReturnType<typeof getLevelAccent>) => {
  REQUIRED_KEYS.forEach((key) => expect(accent).toHaveProperty(key));
  expect(Array.isArray(accent.cardColors)).toBe(true);
  expect(accent.cardColors.length).toBeGreaterThanOrEqual(2);
};

// ---------------------------------------------------------------------------
// Shape contract — all levels return a valid accent object
// ---------------------------------------------------------------------------
describe('getLevelAccent — return shape', () => {
  it.each([1, 4, 5, 9, 10, 14, 15, 19, 20, 25, 50])(
    'level %i returns an object with the required keys',
    (level) => assertShape(getLevelAccent(level)),
  );
});

// ---------------------------------------------------------------------------
// Theme thresholds
// ---------------------------------------------------------------------------
describe('getLevelAccent — theme thresholds', () => {
  // Levels 1-4 → default teal theme
  it('level 1 returns the default (teal) theme', () => {
    const accent = getLevelAccent(1);
    expect(accent.accentText).toBe('#99F6E4');
  });

  it('level 4 still returns the default (teal) theme', () => {
    const accent = getLevelAccent(4);
    expect(accent.accentText).toBe('#99F6E4');
  });

  // Levels 5-9 → cyan theme
  it('level 5 returns the cyan theme', () => {
    const accent = getLevelAccent(5);
    expect(accent.accentText).toBe('#A5F3FC');
  });

  it('level 9 returns the cyan theme', () => {
    const accent = getLevelAccent(9);
    expect(accent.accentText).toBe('#A5F3FC');
  });

  // Levels 10-14 → blue theme
  it('level 10 returns the blue theme', () => {
    const accent = getLevelAccent(10);
    expect(accent.accentText).toBe('#BFDBFE');
  });

  it('level 14 returns the blue theme', () => {
    const accent = getLevelAccent(14);
    expect(accent.accentText).toBe('#BFDBFE');
  });

  // Levels 15-19 → orange theme
  it('level 15 returns the orange theme', () => {
    const accent = getLevelAccent(15);
    expect(accent.accentText).toBe('#FED7AA');
  });

  it('level 19 returns the orange theme', () => {
    const accent = getLevelAccent(19);
    expect(accent.accentText).toBe('#FED7AA');
  });

  // Levels 20+ → purple theme
  it('level 20 returns the purple theme', () => {
    const accent = getLevelAccent(20);
    expect(accent.accentText).toBe('#F5D0FE');
  });

  it('level 50 returns the purple theme', () => {
    const accent = getLevelAccent(50);
    expect(accent.accentText).toBe('#F5D0FE');
  });
});

// ---------------------------------------------------------------------------
// cardColors progression — each tier has a distinct palette
// ---------------------------------------------------------------------------
describe('getLevelAccent — cardColors are distinct across tiers', () => {
  const tiers = [1, 5, 10, 15, 20].map((l) => getLevelAccent(l).cardColors.join());
  it('each of the 5 tiers has a unique cardColors palette', () => {
    const unique = new Set(tiers);
    expect(unique.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Boundary consistency — adjacent levels at every threshold
// ---------------------------------------------------------------------------
describe('getLevelAccent — boundary consistency', () => {
  it('level 4 and level 5 return different themes', () => {
    expect(getLevelAccent(4).accentText).not.toBe(getLevelAccent(5).accentText);
  });

  it('level 9 and level 10 return different themes', () => {
    expect(getLevelAccent(9).accentText).not.toBe(getLevelAccent(10).accentText);
  });

  it('level 14 and level 15 return different themes', () => {
    expect(getLevelAccent(14).accentText).not.toBe(getLevelAccent(15).accentText);
  });

  it('level 19 and level 20 return different themes', () => {
    expect(getLevelAccent(19).accentText).not.toBe(getLevelAccent(20).accentText);
  });

  it('level 5 and level 6 return the same theme', () => {
    expect(getLevelAccent(5).accentText).toBe(getLevelAccent(6).accentText);
  });
});
