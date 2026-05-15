import type { BattleParticipantInput } from '../../utils/battleScript';
import {
    buildParticipantFromWorkout,
    generateBattleScript,
    mockBattleExample,
} from '../../utils/battleScript';

// Reusable balanced participants
const makeUser = (overrides: Partial<BattleParticipantInput> = {}): BattleParticipantInput => ({
  id: 'user',
  name: 'User',
  power: 50,
  stamina: 40,
  ...overrides,
});

const makeOpponent = (overrides: Partial<BattleParticipantInput> = {}): BattleParticipantInput => ({
  id: 'opp',
  name: 'Opponent',
  power: 50,
  stamina: 40,
  ...overrides,
});

// ---------------------------------------------------------------------------
// generateBattleScript — structural contracts
// ---------------------------------------------------------------------------
describe('generateBattleScript — output structure', () => {
  const result = generateBattleScript(makeUser(), makeOpponent(), { seed: 42 });

  it('returns a result with script, winner, entities and seed', () => {
    expect(result).toHaveProperty('script');
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('seed');
  });

  it('script is a non-empty array', () => {
    expect(Array.isArray(result.script)).toBe(true);
    expect(result.script.length).toBeGreaterThan(0);
  });

  it('winner is one of "user", "opponent", or "tie"', () => {
    expect(['user', 'opponent', 'tie']).toContain(result.winner);
  });

  it('entities contains user and opponent objects', () => {
    expect(result.entities.user).toBeDefined();
    expect(result.entities.opponent).toBeDefined();
  });

  it('each entity has hp, maxHp, atk, speed, critChance, dodgeChance', () => {
    for (const entity of [result.entities.user, result.entities.opponent]) {
      expect(typeof entity.hp).toBe('number');
      expect(typeof entity.maxHp).toBe('number');
      expect(typeof entity.atk).toBe('number');
      expect(typeof entity.speed).toBe('number');
      expect(typeof entity.critChance).toBe('number');
      expect(typeof entity.dodgeChance).toBe('number');
    }
  });

  it('each script event has actor, action, damage, and hpAfter', () => {
    result.script.forEach((event) => {
      expect(['user', 'opponent']).toContain(event.actor);
      expect(['attack', 'crit', 'miss']).toContain(event.action);
      expect(typeof event.damage).toBe('number');
      expect(typeof event.hpAfter.user).toBe('number');
      expect(typeof event.hpAfter.opponent).toBe('number');
    });
  });

  it('hp values in hpAfter are never negative', () => {
    result.script.forEach((event) => {
      expect(event.hpAfter.user).toBeGreaterThanOrEqual(0);
      expect(event.hpAfter.opponent).toBeGreaterThanOrEqual(0);
    });
  });

  it('miss events deal 0 damage', () => {
    const missEvents = result.script.filter((e) => e.action === 'miss');
    missEvents.forEach((e) => expect(e.damage).toBe(0));
  });
});

// ---------------------------------------------------------------------------
// generateBattleScript — determinism
// ---------------------------------------------------------------------------
describe('generateBattleScript — determinism', () => {
  it('produces identical results for the same seed', () => {
    const a = generateBattleScript(makeUser(), makeOpponent(), { seed: 99 });
    const b = generateBattleScript(makeUser(), makeOpponent(), { seed: 99 });
    expect(a.winner).toBe(b.winner);
    expect(a.script.length).toBe(b.script.length);
    expect(a.script[0]).toEqual(b.script[0]);
  });

  it('produces different results for different seeds', () => {
    const a = generateBattleScript(makeUser(), makeOpponent(), { seed: 1 });
    const b = generateBattleScript(makeUser(), makeOpponent(), { seed: 999999 });
    // Highly unlikely to produce exactly the same script with different seeds
    const sameLength = a.script.length === b.script.length;
    const firstDamageEqual = a.script[0]?.damage === b.script[0]?.damage;
    // At least one of these should differ
    expect(sameLength && firstDamageEqual).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateBattleScript — derived stats
// ---------------------------------------------------------------------------
describe('generateBattleScript — derived entity stats', () => {
  it('a stronger attacker has higher atk', () => {
    const strong = generateBattleScript(makeUser({ power: 100 }), makeOpponent(), { seed: 1 });
    const weak = generateBattleScript(makeUser({ power: 10 }), makeOpponent(), { seed: 1 });
    expect(strong.entities.user.atk).toBeGreaterThan(weak.entities.user.atk);
  });

  it('a higher-stamina participant has more maxHp', () => {
    const tanky = generateBattleScript(makeUser({ stamina: 200 }), makeOpponent(), { seed: 1 });
    const frail = generateBattleScript(makeUser({ stamina: 10 }), makeOpponent(), { seed: 1 });
    expect(tanky.entities.user.maxHp).toBeGreaterThan(frail.entities.user.maxHp);
  });

  it('critChance is clamped to [0, 1]', () => {
    const result = generateBattleScript(makeUser({ critChance: 2.0 }), makeOpponent(), { seed: 1 });
    expect(result.entities.user.critChance).toBeLessThanOrEqual(1);
    expect(result.entities.user.critChance).toBeGreaterThanOrEqual(0);
  });

  it('dodgeChance is clamped to [0, 1]', () => {
    const result = generateBattleScript(makeUser({ dodgeChance: -0.5 }), makeOpponent(), { seed: 1 });
    expect(result.entities.user.dodgeChance).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// generateBattleScript — win conditions
// ---------------------------------------------------------------------------
describe('generateBattleScript — win conditions', () => {
  it('a dominant user wins when power/stamina is overwhelmingly higher', () => {
    const result = generateBattleScript(
      makeUser({ power: 300, stamina: 300 }),
      makeOpponent({ power: 1, stamina: 1 }),
      { seed: 42 },
    );
    expect(result.winner).toBe('user');
  });

  it('a dominant opponent wins when user is very weak', () => {
    const result = generateBattleScript(
      makeUser({ power: 1, stamina: 1 }),
      makeOpponent({ power: 300, stamina: 300 }),
      { seed: 42 },
    );
    expect(result.winner).toBe('opponent');
  });

  it('respects maxTurns option — script length stays within 2 * maxTurns + 1', () => {
    const maxTurns = 3;
    const result = generateBattleScript(makeUser(), makeOpponent(), { seed: 7, maxTurns });
    // Each turn has at most 2 events (one per combatant), so max events = maxTurns * 2
    expect(result.script.length).toBeLessThanOrEqual(maxTurns * 2 + 1);
  });
});

// ---------------------------------------------------------------------------
// buildParticipantFromWorkout
// ---------------------------------------------------------------------------
describe('buildParticipantFromWorkout', () => {
  it('derives id from name by lowercasing and replacing spaces', () => {
    const p = buildParticipantFromWorkout('Alice Smith', {});
    expect(p.id).toBe('alice-smith');
  });

  it('uses opts.id when provided', () => {
    const p = buildParticipantFromWorkout('Alice', {}, { id: 'custom-id' });
    expect(p.id).toBe('custom-id');
  });

  it('calculates power from pushups (1×) and squats (0.8×)', () => {
    const p = buildParticipantFromWorkout('T', { pushups: 10, squats: 10 });
    expect(p.power).toBe(10 * 1 + 10 * 0.8); // 18
  });

  it('calculates stamina from plankSec (0.5×) and steps (0.001×)', () => {
    const p = buildParticipantFromWorkout('T', { plankSec: 60, steps: 2000 });
    expect(p.stamina).toBeCloseTo(60 * 0.5 + 2000 * 0.001); // 32
  });

  it('returns zero power and stamina for empty workout', () => {
    const p = buildParticipantFromWorkout('T', {});
    expect(p.power).toBe(0);
    expect(p.stamina).toBe(0);
  });

  it('propagates critChance and dodgeChance from opts', () => {
    const p = buildParticipantFromWorkout('T', {}, { critChance: 0.3, dodgeChance: 0.15 });
    expect(p.critChance).toBe(0.3);
    expect(p.dodgeChance).toBe(0.15);
  });

  it('sets name correctly', () => {
    expect(buildParticipantFromWorkout('Hero', {}).name).toBe('Hero');
  });
});

// ---------------------------------------------------------------------------
// mockBattleExample — integration smoke test
// ---------------------------------------------------------------------------
describe('mockBattleExample', () => {
  it('runs without throwing', () => {
    expect(() => mockBattleExample()).not.toThrow();
  });

  it('returns a valid BattleResult', () => {
    const result = mockBattleExample();
    expect(['user', 'opponent', 'tie']).toContain(result.winner);
    expect(result.script.length).toBeGreaterThan(0);
  });

  it('is deterministic (seed=42 always produces the same winner)', () => {
    expect(mockBattleExample().winner).toBe(mockBattleExample().winner);
  });
});
