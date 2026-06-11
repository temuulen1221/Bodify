/**
 * Tests for fitnessALU.js
 *
 * Verifies each ALU operation, flag outputs, and the high-level
 * fitness helpers (calcCalories, calcXPFromReps, checkGoal).
 */

// fitnessALU uses ES module exports; jest is configured with babel transform.
const {
  ALU_OP,
  MET_FACTORS,
  aluExecute,
  calcCalories,
  calcXPFromReps,
  checkGoal,
  combineFlags,
} = require('../../utils/fitnessALU');

// ─── Core ALU operations ───────────────────────────────────────────────────────

describe('aluExecute — ADD', () => {
  test('adds two 8-bit values', () => {
    const { result, flags } = aluExecute(ALU_OP.ADD, 10, 5);
    expect(result).toBe(15);
    expect(flags.Z).toBe(0);
    expect(flags.C).toBe(0);
  });

  test('carry flag set on 8-bit overflow', () => {
    const { result, flags } = aluExecute(ALU_OP.ADD, 200, 100);
    expect(result).toBe(44); // 300 & 0xFF
    expect(flags.C).toBe(1);
  });

  test('zero flag set when result is 0', () => {
    const { flags } = aluExecute(ALU_OP.ADD, 0, 0);
    expect(flags.Z).toBe(1);
  });
});

describe('aluExecute — SUB', () => {
  test('subtracts B from A', () => {
    const { result, flags } = aluExecute(ALU_OP.SUB, 20, 8);
    expect(result).toBe(12);
    expect(flags.C).toBe(0); // no borrow
  });

  test('borrow flag set when A < B', () => {
    const { flags } = aluExecute(ALU_OP.SUB, 5, 10);
    expect(flags.C).toBe(1);
  });
});

describe('aluExecute — MUL', () => {
  test('multiplies and scales down by >> 4', () => {
    const { result } = aluExecute(ALU_OP.MUL, 12, 50);
    // 12 * 50 = 600, >> 4 = 37
    expect(result).toBe(37);
  });

  test('clamps to 255 on large product', () => {
    const { result } = aluExecute(ALU_OP.MUL, 255, 255);
    expect(result).toBe(255);
  });
});

describe('aluExecute — CMP', () => {
  test('goal-met flag set when A >= B', () => {
    const { flags } = aluExecute(ALU_OP.CMP, 15, 10);
    expect(flags.G).toBe(1);
  });

  test('goal-met flag clear when A < B', () => {
    const { flags } = aluExecute(ALU_OP.CMP, 8, 12);
    expect(flags.G).toBe(0);
  });

  test('result is always 0 for CMP', () => {
    const { result } = aluExecute(ALU_OP.CMP, 100, 50);
    expect(result).toBe(0);
  });
});

describe('aluExecute — SHR', () => {
  test('shifts right by 1 (divides by 2)', () => {
    const { result } = aluExecute(ALU_OP.SHR, 20, 0);
    expect(result).toBe(10);
  });

  test('carry gets the shifted-out LSB', () => {
    const { flags } = aluExecute(ALU_OP.SHR, 7, 0); // 0b00000111 >> 1 = 3, carry = 1
    expect(flags.C).toBe(1);
  });
});

describe('aluExecute — AND', () => {
  test('bitwise AND of two values', () => {
    const { result } = aluExecute(ALU_OP.AND, 0b10101010, 0b11001100);
    expect(result).toBe(0b10001000);
  });
});

describe('aluExecute — OR', () => {
  test('bitwise OR of two values', () => {
    const { result } = aluExecute(ALU_OP.OR, 0b10101010, 0b01010101);
    expect(result).toBe(0b11111111);
  });
});

describe('aluExecute — NOT', () => {
  test('bitwise NOT (8-bit)', () => {
    const { result } = aluExecute(ALU_OP.NOT, 0b11110000, 0);
    expect(result).toBe(0b00001111);
  });

  test('NOT of 0 is 255', () => {
    const { result } = aluExecute(ALU_OP.NOT, 0, 0);
    expect(result).toBe(255);
  });
});

// ─── Flag correctness ──────────────────────────────────────────────────────────

describe('aluExecute — N (negative) flag', () => {
  test('negative flag set when MSB of result is 1', () => {
    // SUB 5 - 10 in two's complement: result = 251 (0b11111011), MSB = 1
    const { flags } = aluExecute(ALU_OP.SUB, 5, 10);
    expect(flags.N).toBe(1);
  });

  test('negative flag clear for normal positive result', () => {
    const { flags } = aluExecute(ALU_OP.ADD, 10, 5);
    expect(flags.N).toBe(0);
  });
});

// ─── Input clamping ────────────────────────────────────────────────────────────

describe('aluExecute — input clamping', () => {
  test('inputs above 255 are masked to 8 bits', () => {
    const { result } = aluExecute(ALU_OP.ADD, 256, 1); // 256 & 0xFF = 0; 0 + 1 = 1
    expect(result).toBe(1);
  });
});

// ─── High-level fitness helpers ────────────────────────────────────────────────

describe('calcCalories', () => {
  test('returns a positive kcal value for a squat set', () => {
    const { kcal } = calcCalories(15, 'squat', 70);
    expect(kcal).toBeGreaterThan(0);
    expect(kcal).toBeLessThanOrEqual(255);
  });

  test('burpees yield more calories than squats for same reps/weight', () => {
    const squat = calcCalories(15, 'squat', 70).kcal;
    const burpee = calcCalories(15, 'burpee', 70).kcal;
    expect(burpee).toBeGreaterThanOrEqual(squat);
  });

  test('steps array has 3 entries (MUL, MUL, SHR)', () => {
    const { steps } = calcCalories(10, 'pushup', 65);
    expect(steps).toHaveLength(3);
    expect(steps[0].op).toBe('MUL');
    expect(steps[2].op).toBe('SHR');
  });

  test('falls back to default MET for unknown exercise', () => {
    const { kcal } = calcCalories(10, 'unknown_exercise', 70);
    expect(kcal).toBeGreaterThanOrEqual(0);
  });
});

describe('calcXPFromReps', () => {
  test('returns at least 1 XP per rep', () => {
    const { xp } = calcXPFromReps(10, 100);
    expect(xp).toBeGreaterThanOrEqual(10);
  });

  test('form bonus applied when formScore >= 200', () => {
    const withGoodForm = calcXPFromReps(10, 220);
    const withBadForm  = calcXPFromReps(10, 100);
    expect(withGoodForm.xp).toBeGreaterThan(withBadForm.xp);
    expect(withGoodForm.breakdown.goodForm).toBe(true);
    expect(withBadForm.breakdown.goodForm).toBe(false);
  });

  test('0 reps yields 0 XP', () => {
    const { xp } = calcXPFromReps(0, 255);
    expect(xp).toBe(0);
  });
});

describe('checkGoal', () => {
  test('met is true when done >= goal', () => {
    expect(checkGoal(12, 10).met).toBe(true);
    expect(checkGoal(10, 10).met).toBe(true);
  });

  test('met is false when done < goal', () => {
    expect(checkGoal(5, 10).met).toBe(false);
  });

  test('remaining is 0 when goal is met', () => {
    expect(checkGoal(15, 10).remaining).toBe(0);
  });

  test('remaining equals goal - done when not met', () => {
    expect(checkGoal(3, 10).remaining).toBe(7);
  });
});

describe('combineFlags', () => {
  test('AND combines flags with bitwise AND', () => {
    expect(combineFlags('AND', 0b1010, 0b1100)).toBe(0b1000);
  });

  test('OR combines flags with bitwise OR', () => {
    expect(combineFlags('OR', 0b1010, 0b0101)).toBe(0b1111);
  });
});

describe('MET_FACTORS', () => {
  test('all MET factors are positive integers', () => {
    Object.values(MET_FACTORS).forEach((met) => {
      expect(met).toBeGreaterThan(0);
      expect(Number.isInteger(met)).toBe(true);
    });
  });

  test('burpee MET is higher than plank MET', () => {
    expect(MET_FACTORS.burpee).toBeGreaterThan(MET_FACTORS.plank);
  });
});
