/**
 * A creature's heritable design. The genome is the part choices plus a handful
 * of continuous genes (colour, size, vigour). Breeding crosses two genomes and
 * mutates the result, which is what lets the population evolve over generations.
 */
import { LIFE } from "./constants";
import {
  PART_CATEGORIES,
  PARTS_BY_ID,
  PartCategory,
  PartStats,
  partsIn,
} from "./parts";
import { Rng } from "./rng";
import { clamp } from "./vec";

export type Diet = "herbivore" | "carnivore";

export interface Genome {
  diet: Diet;
  /** Chosen part id per category. */
  parts: Record<PartCategory, string>;
  /** Base hue 0..360 for the creature's colouring. */
  hue: number;
  /** Secondary accent variation 0..1. */
  accent: number;
  /** Overall size multiplier (~0.8..1.3). */
  sizeGene: number;
  /** Constitution multiplier affecting energy & metabolism (~0.85..1.15). */
  vigor: number;
}

/** Final, playable statistics derived from a genome. */
export interface DerivedStats {
  maxEnergy: number;
  metabolism: number;
  maxSpeed: number;
  agility: number;
  vision: number;
  attack: number;
  armor: number;
  feeding: number;
  radius: number;
  maxAge: number;
}

const HERBIVORE_TINTS = [95, 110, 130, 75, 150]; // greens / olives
const CARNIVORE_TINTS = [0, 18, 350, 35, 300]; // reds / oranges / magentas

export function randomGenome(rng: Rng, diet: Diet): Genome {
  const parts = {} as Record<PartCategory, string>;
  for (const cat of PART_CATEGORIES) {
    parts[cat] = rng.pick(partsIn(cat)).id;
  }
  const tints = diet === "herbivore" ? HERBIVORE_TINTS : CARNIVORE_TINTS;
  return {
    diet,
    parts,
    hue: (rng.pick(tints) + rng.int(-15, 15) + 360) % 360,
    accent: rng.next(),
    sizeGene: clamp(1 + rng.jitter() * 0.2, 0.8, 1.3),
    vigor: clamp(1 + rng.jitter() * 0.12, 0.85, 1.15),
  };
}

/** Sum the contributions of every chosen part. */
function summedParts(genome: Genome): PartStats {
  const total: PartStats = {
    energy: 0,
    metabolism: 0,
    speed: 0,
    agility: 0,
    vision: 0,
    attack: 0,
    armor: 0,
    feeding: 0,
    bulk: 0,
  };
  for (const cat of PART_CATEGORIES) {
    const def = PARTS_BY_ID[genome.parts[cat]];
    if (!def) continue;
    const s = def.stats;
    total.energy += s.energy;
    total.metabolism += s.metabolism;
    total.speed += s.speed;
    total.agility += s.agility;
    total.vision += s.vision;
    total.attack += s.attack;
    total.armor += s.armor;
    total.feeding += s.feeding;
    total.bulk += s.bulk;
  }
  return total;
}

export function deriveStats(genome: Genome): DerivedStats {
  const p = summedParts(genome);
  const carn = genome.diet === "carnivore";

  // Diet baselines: carnivores are faster, see further and hit harder, and
  // carry large reserves (a kill must last a while); herbivores feed more
  // efficiently on plants. Metabolism is deliberately low so the pace is calm
  // and prowlers don't starve between kills.
  const baseEnergy = carn ? 210 : 160;
  const baseMetabolism = carn ? 2.3 : 1.8;
  const baseSpeed = carn ? 64 : 52;
  const baseAgility = carn ? 2.0 : 1.8;
  const baseVision = carn ? 165 : 130;
  const baseAttack = carn ? 9 : 0;
  const baseFeeding = carn ? 0.9 : 1.0;

  const maxEnergy = Math.max(60, (baseEnergy + p.energy) * genome.vigor);
  const radius = clamp((10 + p.bulk + p.armor * 0.4) * genome.sizeGene, 7, 26);

  return {
    maxEnergy,
    // Cap the per-part metabolism contribution so no combo is a death sentence.
    metabolism: Math.max(0.5, (baseMetabolism + Math.min(p.metabolism, 1.4)) * genome.vigor),
    maxSpeed: clamp(baseSpeed + p.speed, 18, 130) / genome.sizeGene ** 0.5,
    agility: clamp(baseAgility + p.agility, 0.6, 4.5),
    vision: clamp(baseVision + p.vision, 60, 360),
    attack: Math.max(0, baseAttack + p.attack),
    armor: Math.max(0, p.armor),
    feeding: Math.max(0.3, baseFeeding + p.feeding),
    radius,
    // Long lives slow the generational turnover; bigger/tougher live longest.
    maxAge: clamp((220 + p.energy * 0.4 + p.armor * 3) * (carn ? 1.0 : 1.1), 160, 460),
  };
}

export function crossover(a: Genome, b: Genome, rng: Rng): Genome {
  const parts = {} as Record<PartCategory, string>;
  for (const cat of PART_CATEGORIES) {
    parts[cat] = rng.chance(0.5) ? a.parts[cat] : b.parts[cat];
  }
  // Hue interpolates around the colour wheel via the shorter arc.
  let dh = b.hue - a.hue;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const hue = (a.hue + dh * rng.next() + 360) % 360;

  return {
    diet: a.diet, // diet is fixed within a species line
    parts,
    hue,
    accent: (a.accent + b.accent) / 2,
    sizeGene: (a.sizeGene + b.sizeGene) / 2,
    vigor: (a.vigor + b.vigor) / 2,
  };
}

export function mutate(genome: Genome, rng: Rng): Genome {
  const parts = { ...genome.parts };
  for (const cat of PART_CATEGORIES) {
    if (rng.chance(LIFE.mutationRate)) {
      parts[cat] = rng.pick(partsIn(cat)).id;
    }
  }
  return {
    ...genome,
    parts,
    hue: (genome.hue + rng.jitter() * 24 + 360) % 360,
    accent: clamp(genome.accent + rng.jitter() * 0.15, 0, 1),
    sizeGene: clamp(genome.sizeGene + rng.jitter() * 0.08, 0.75, 1.35),
    vigor: clamp(genome.vigor + rng.jitter() * 0.05, 0.82, 1.2),
  };
}

export function breed(a: Genome, b: Genome, rng: Rng): Genome {
  return mutate(crossover(a, b, rng), rng);
}

// --- Procedural naming, for that "your creature, Zebithorn, has mated" feel ---
const NAME_START = ["Ax", "Bru", "Cy", "Dra", "El", "Fen", "Gro", "Hex", "Iri", "Jor", "Kry", "Lox", "My", "Nyx", "Or", "Pyx", "Qua", "Rho", "Syl", "Tre", "Umb", "Vor", "Wex", "Xan", "Yri", "Zeb"];
const NAME_MID = ["a", "e", "i", "o", "u", "ae", "io", "yr", "an", "or"];
const NAME_END = ["thorn", "dax", "mire", "lux", "ven", "gor", "nyx", "pod", "rax", "wing", "fang", "hide", "claw", "spore", "drift"];

export function generateName(rng: Rng): string {
  return rng.pick(NAME_START) + rng.pick(NAME_MID) + rng.pick(NAME_END);
}
