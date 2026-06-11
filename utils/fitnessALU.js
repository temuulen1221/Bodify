/**
 * Fitness ALU (Arithmetic Logic Unit)
 * =====================================
 * A software implementation of an 8-bit ALU designed for fitness metric
 * calculations. Each operation mirrors a real digital hardware circuit:
 *
 *   - 8-bit operands A and B (unsigned, 0–255)
 *   - 3-bit opcode selects the operation (8 operations total)
 *   - 8-bit result output
 *   - 4 status flags: Z (zero), C (carry/borrow), N (negative), G (goal met)
 *
 * Circuit diagram: https://circuitverse.org  (see project submission)
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │              FITNESS ALU (8-bit)                │
 *  │                                                 │
 *  │  A[7:0] ──┐                                     │
 *  │           ├──► Operation Unit ──► Result[7:0]   │
 *  │  B[7:0] ──┘         ▲                           │
 *  │                     │                           │
 *  │  OP[2:0] ───────────┘           Flags[3:0]      │
 *  │                             Z C N G             │
 *  └─────────────────────────────────────────────────┘
 *
 * Opcode table:
 *   000  ADD   A + B          (accumulate reps / XP)
 *   001  SUB   A - B          (remaining reps = goal - done)
 *   010  MUL   A × B >> 4     (calories: reps × MET factor, scaled)
 *   011  CMP   flags only      (goal check: done ≥ target?)
 *   100  SHR   A >> 1          (halve / scale down intensity)
 *   101  AND   A & B           (combine boolean workout flags)
 *   110  OR    A | B           (merge activity category flags)
 *   111  NOT   ~A & 0xFF       (invert flags)
 */

// ─── Opcode constants ──────────────────────────────────────────────────────────

export const ALU_OP = Object.freeze({
  ADD: 0b000,
  SUB: 0b001,
  MUL: 0b010,
  CMP: 0b011,
  SHR: 0b100,
  AND: 0b101,
  OR:  0b110,
  NOT: 0b111,
});

// MET (Metabolic Equivalent of Task) factors scaled to 8-bit (×10, clamped 1–255)
// Real MET × 10 so we can use integer arithmetic: squat MET ≈ 5.0 → 50
export const MET_FACTORS = Object.freeze({
  squat:          50,   // MET 5.0
  pushup:         38,   // MET 3.8
  lunge:          45,   // MET 4.5
  plank:          30,   // MET 3.0 (hold)
  situp:          38,   // MET 3.8
  crunch:         35,   // MET 3.5
  burpee:         80,   // MET 8.0
  jumping_jacks:  70,   // MET 7.0
  bicycle_crunch: 40,   // MET 4.0
  circle_crunch:  38,   // MET 3.8
  warmup:         25,   // MET 2.5
  tree_pose:      20,   // MET 2.0 (balance hold)
  pike_walk:      45,   // MET 4.5
  crouch_hold:    30,   // MET 3.0
});

// ─── Core ALU execute function ─────────────────────────────────────────────────

/**
 * Execute one ALU operation.
 *
 * @param {number} op   - 3-bit opcode (use ALU_OP constants)
 * @param {number} a    - 8-bit operand A (0–255)
 * @param {number} b    - 8-bit operand B (0–255)
 * @returns {{ result: number, flags: { Z: number, C: number, N: number, G: number } }}
 */
export function aluExecute(op, a, b) {
  // Clamp inputs to 8-bit unsigned integers
  a = (a & 0xFF) >>> 0;
  b = (b & 0xFF) >>> 0;

  let result = 0;
  let carry = 0;

  switch (op & 0b111) {
    case ALU_OP.ADD: {
      const sum = a + b;
      carry = sum > 0xFF ? 1 : 0;
      result = sum & 0xFF;
      break;
    }
    case ALU_OP.SUB: {
      // Two's complement subtraction
      const diff = a - b;
      carry = diff < 0 ? 1 : 0;   // borrow flag
      result = (diff + 256) & 0xFF;
      break;
    }
    case ALU_OP.MUL: {
      // Shift-and-add multiply, result scaled down by >> 4 to stay in 8 bits.
      // Hardware equivalent: 4-bit partial product adder tree.
      // Fitness use: reps(A) × metFactor(B) / 16 ≈ calorie contribution per set
      const product = a * b;
      carry = product > 0xFF ? 1 : 0;
      result = Math.min(0xFF, product >> 4);
      break;
    }
    case ALU_OP.CMP: {
      // Comparison — result is 0, only flags carry meaning
      result = 0;
      carry = 0;
      break;
    }
    case ALU_OP.SHR: {
      // Logical right shift by 1 bit (divide by 2)
      carry = a & 1;
      result = (a >>> 1) & 0xFF;
      break;
    }
    case ALU_OP.AND: {
      result = (a & b) & 0xFF;
      carry = 0;
      break;
    }
    case ALU_OP.OR: {
      result = (a | b) & 0xFF;
      carry = 0;
      break;
    }
    case ALU_OP.NOT: {
      result = (~a) & 0xFF;
      carry = 0;
      break;
    }
    default:
      result = 0;
      carry = 0;
  }

  return {
    result,
    flags: {
      Z: result === 0 ? 1 : 0,   // Zero: result is zero
      C: carry,                   // Carry / borrow
      N: (result >> 7) & 1,      // Negative: MSB set
      G: a >= b ? 1 : 0,         // Goal Met: A ≥ B
    },
  };
}

// ─── High-level fitness helpers (built on top of aluExecute) ──────────────────

/**
 * Estimate calories burned for one exercise set.
 *
 * Formula (MET-based, simplified for 8-bit fixed-point):
 *   kcal ≈ (reps × metFactor × weightKg) / 200
 *
 * Circuit path: MUL(reps, metFactor) → MUL(result, weightKg) → SHR chain
 *
 * @param {number} reps        - Rep count (0–255)
 * @param {string} exerciseKey - Exercise name (key of MET_FACTORS)
 * @param {number} weightKg    - User body weight in kg (0–255)
 * @returns {{ kcal: number, steps: { op: string, a: number, b: number, result: number }[] }}
 */
export function calcCalories(reps, exerciseKey, weightKg) {
  const metFactor = MET_FACTORS[exerciseKey] || 40; // default MET 4.0

  // Step 1: reps × metFactor (scaled by >> 4 inside MUL)
  const step1 = aluExecute(ALU_OP.MUL, reps & 0xFF, metFactor & 0xFF);

  // Step 2: result × weightKg (scaled by >> 4 inside MUL)
  const step2 = aluExecute(ALU_OP.MUL, step1.result, weightKg & 0xFF);

  // Step 3: right-shift once more to bring into kcal range
  const step3 = aluExecute(ALU_OP.SHR, step2.result, 0);

  return {
    kcal: step3.result,
    steps: [
      { op: 'MUL', a: reps, b: metFactor, result: step1.result },
      { op: 'MUL', a: step1.result, b: weightKg, result: step2.result },
      { op: 'SHR', a: step2.result, b: 0, result: step3.result },
    ],
  };
}

/**
 * Calculate XP earned from a completed set.
 *
 * Base: 1 XP per rep.
 * Form bonus: +50% (SHR of reps added) when formScore ≥ 200 (out of 255).
 *
 * Circuit path: base=ADD(reps,0) → CMP(formScore,200) → conditional ADD
 *
 * @param {number} reps       - Reps completed (0–255)
 * @param {number} formScore  - Form quality 0–255 (255 = perfect)
 * @returns {{ xp: number, flags: object }}
 */
export function calcXPFromReps(reps, formScore) {
  const base = aluExecute(ALU_OP.ADD, reps & 0xFF, 0);
  const formCheck = aluExecute(ALU_OP.CMP, formScore & 0xFF, 200);

  // If form is good (G flag set), add a 50% rep bonus via SHR
  const bonus = formCheck.flags.G
    ? aluExecute(ALU_OP.SHR, reps & 0xFF, 0).result
    : 0;

  const total = aluExecute(ALU_OP.ADD, base.result, bonus);

  return {
    xp: total.result,
    flags: total.flags,
    breakdown: { baseXP: base.result, bonusXP: bonus, goodForm: formCheck.flags.G === 1 },
  };
}

/**
 * Check whether a rep goal has been met and how many reps remain.
 *
 * Circuit path: CMP(done, goal) for flags; SUB(goal, done) for remainder.
 *
 * @param {number} done - Reps completed so far (0–255)
 * @param {number} goal - Target rep count (0–255)
 * @returns {{ met: boolean, remaining: number, flags: object }}
 */
export function checkGoal(done, goal) {
  const cmp = aluExecute(ALU_OP.CMP, done & 0xFF, goal & 0xFF);
  const sub = aluExecute(ALU_OP.SUB, goal & 0xFF, done & 0xFF);

  return {
    met: cmp.flags.G === 1,
    remaining: cmp.flags.G ? 0 : sub.result,
    flags: cmp.flags,
  };
}

/**
 * Combine two binary workout flag bytes using AND/OR logic.
 * Useful for merging activity category flags in store.js.
 *
 * @param {'AND'|'OR'} logicOp
 * @param {number} flagsA
 * @param {number} flagsB
 * @returns {number} combined 8-bit flags
 */
export function combineFlags(logicOp, flagsA, flagsB) {
  const op = logicOp === 'AND' ? ALU_OP.AND : ALU_OP.OR;
  return aluExecute(op, flagsA & 0xFF, flagsB & 0xFF).result;
}
