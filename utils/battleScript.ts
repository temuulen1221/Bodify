export type BattleParticipantInput = {
  id: string;
  name: string;
  power: number; // derived from reps/weight/time
  stamina: number; // durability/endurance
  speed?: number;
  critChance?: number; // 0..1
  dodgeChance?: number; // 0..1
  baseHp?: number;
  baseAtk?: number;
};

export type BattleEntity = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  critChance: number;
  dodgeChance: number;
};

export type BattleEventAction = 'attack' | 'crit' | 'miss';

export type BattleEvent = {
  actor: 'user' | 'opponent';
  action: BattleEventAction;
  damage: number;
  hpAfter: { user: number; opponent: number };
};

export type BattleResult = {
  script: BattleEvent[];
  winner: 'user' | 'opponent' | 'tie';
  entities: { user: BattleEntity; opponent: BattleEntity };
  seed: number;
};

type DeriveConfig = {
  baseHp: number;
  hpPerStamina: number;
  baseAtk: number;
  atkPerPower: number;
  baseSpeed: number;
  critMultiplier: number;
  maxTurns: number;
};

const DEFAULTS: DeriveConfig = {
  baseHp: 60,
  hpPerStamina: 1.2,
  baseAtk: 8,
  atkPerPower: 0.6,
  baseSpeed: 10,
  critMultiplier: 1.5,
  maxTurns: 20,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const createRng = (seed?: number) => {
  // xorshift32, adequate for deterministic replays.
  let x = seed ? seed >>> 0 : Math.floor(Math.random() * 0xffffffff);
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
};

const deriveEntity = (input: BattleParticipantInput, cfg: DeriveConfig): BattleEntity => {
  const hp = (input.baseHp ?? cfg.baseHp) + input.stamina * cfg.hpPerStamina;
  const atk = (input.baseAtk ?? cfg.baseAtk) + input.power * cfg.atkPerPower;
  const speed = (input.speed ?? cfg.baseSpeed) + input.stamina * 0.05 + input.power * 0.03;
  return {
    id: input.id,
    name: input.name,
    hp: Math.round(hp),
    maxHp: Math.round(hp),
    atk: Math.round(atk * 10) / 10,
    speed: Math.round(speed * 10) / 10,
    critChance: clamp01(input.critChance ?? 0.1),
    dodgeChance: clamp01(input.dodgeChance ?? 0.05),
  };
};

export function generateBattleScript(
  userInput: BattleParticipantInput,
  opponentInput: BattleParticipantInput,
  options?: { seed?: number; maxTurns?: number }
): BattleResult {
  const cfg = { ...DEFAULTS, maxTurns: options?.maxTurns ?? DEFAULTS.maxTurns };
  const rng = createRng(options?.seed);
  const user = deriveEntity(userInput, cfg);
  const opponent = deriveEntity(opponentInput, cfg);

  let hpUser = user.hp;
  let hpOpponent = opponent.hp;

  const order: Array<'user' | 'opponent'> = user.speed >= opponent.speed ? ['user', 'opponent'] : ['opponent', 'user'];
  const script: BattleEvent[] = [];

  const calcDamage = (attacker: BattleEntity, defender: BattleEntity) => {
    const variance = 0.9 + rng() * 0.2; // 0.9 - 1.1
    const crit = rng() < attacker.critChance;
    const dodge = rng() < defender.dodgeChance;
    if (dodge) {
      return { dmg: 0, action: 'miss' as BattleEventAction };
    }
    const base = attacker.atk * variance * (crit ? cfg.critMultiplier : 1);
    const dmg = Math.max(1, Math.round(base));
    return { dmg, action: crit ? ('crit' as BattleEventAction) : ('attack' as BattleEventAction) };
  };

  const addEvent = (actor: 'user' | 'opponent', action: BattleEventAction, damage: number) => {
    if (actor === 'user') hpOpponent = Math.max(0, hpOpponent - damage);
    else hpUser = Math.max(0, hpUser - damage);
    script.push({ actor, action, damage, hpAfter: { user: hpUser, opponent: hpOpponent } });
  };

  let turn = 0;
  while (hpUser > 0 && hpOpponent > 0 && turn < cfg.maxTurns) {
    for (const actor of order) {
      const attacker = actor === 'user' ? user : opponent;
      const defender = actor === 'user' ? opponent : user;
      const { dmg, action } = calcDamage(attacker, defender);
      addEvent(actor, action, dmg);
      if (hpUser <= 0 || hpOpponent <= 0) break;
    }
    turn += 1;
  }

  let winner: 'user' | 'opponent' | 'tie' = 'tie';
  if (hpUser > hpOpponent) winner = 'user';
  else if (hpOpponent > hpUser) winner = 'opponent';

  return { script, winner, entities: { user, opponent }, seed: options?.seed ?? 0 };
}

export const buildParticipantFromWorkout = (
  name: string,
  workout: { pushups?: number; squats?: number; plankSec?: number; steps?: number },
  opts?: { id?: string; critChance?: number; dodgeChance?: number }
): BattleParticipantInput => {
  const power = (workout.pushups ?? 0) * 1 + (workout.squats ?? 0) * 0.8;
  const stamina = (workout.plankSec ?? 0) * 0.5 + (workout.steps ?? 0) * 0.001;
  return {
    id: opts?.id ?? name.toLowerCase().replace(/\s+/g, '-'),
    name,
    power,
    stamina,
    critChance: opts?.critChance,
    dodgeChance: opts?.dodgeChance,
  };
};

export const mockBattleExample = () => {
  const user = buildParticipantFromWorkout('Temuulen', { pushups: 30, plankSec: 60 });
  const opponent = buildParticipantFromWorkout('Alex', { pushups: 20, plankSec: 30 });
  return generateBattleScript(user, opponent, { seed: 42 });
};
