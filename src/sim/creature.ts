/**
 * The creature: a mutable entity living in the world. Kept as a plain object
 * (not a class with methods) so the world can iterate large populations cheaply;
 * all behaviour lives in world.ts.
 */
import { DerivedStats, Diet, Genome, deriveStats } from "./genome";

export type Behaviour = "wander" | "forage" | "hunt" | "flee" | "court";

export interface Creature {
  id: number;
  name: string;
  genome: Genome;
  stats: DerivedStats;

  // --- spatial state ---
  x: number;
  y: number;
  angle: number;
  speed: number; // current speed, for render/move cost
  wanderAngle: number;

  // --- vital state ---
  energy: number;
  age: number;
  alive: boolean;
  generation: number;
  mateCooldown: number;
  behaviour: Behaviour;
  cause: string; // set on death

  // --- lineage / ownership ---
  /** True for a creature the player designed and released themselves. */
  founder: boolean;
  /** Bloodline id (a founder's creature id), or -1 for wild stock. */
  lineageId: number;

  // --- life stats (for the inbox / tooltips) ---
  birthTime: number;
  offspring: number;
  meals: number;
  kills: number;
  mealsSinceLog: number;
  peakEnergy: number;
}

let nextCreatureId = 1;

export function resetCreatureIds(): void {
  nextCreatureId = 1;
}

export interface SpawnOpts {
  x: number;
  y: number;
  angle: number;
  energy?: number;
  generation?: number;
  founder?: boolean;
  lineageId?: number;
  name: string;
  birthTime: number;
}

export function makeCreature(genome: Genome, opts: SpawnOpts): Creature {
  const stats = deriveStats(genome);
  const energy = opts.energy ?? stats.maxEnergy * 0.7;
  return {
    id: nextCreatureId++,
    name: opts.name,
    genome,
    stats,
    x: opts.x,
    y: opts.y,
    angle: opts.angle,
    speed: 0,
    wanderAngle: opts.angle,
    energy,
    age: 0,
    alive: true,
    generation: opts.generation ?? 0,
    mateCooldown: 0,
    behaviour: "wander",
    cause: "",
    founder: opts.founder ?? false,
    lineageId: opts.lineageId ?? -1,
    birthTime: opts.birthTime,
    offspring: 0,
    meals: 0,
    kills: 0,
    mealsSinceLog: 0,
    peakEnergy: energy,
  };
}

export function dietOf(c: Creature): Diet {
  return c.genome.diet;
}

export function energyFrac(c: Creature): number {
  return c.stats.maxEnergy > 0 ? c.energy / c.stats.maxEnergy : 0;
}
