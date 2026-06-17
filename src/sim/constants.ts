/**
 * Tunable parameters for the digital ecology. Collected in one place so the
 * predator/prey balance and the overall pace can be adjusted without hunting
 * through the engine.
 */
export const WORLD = {
  width: 2600,
  height: 1800,
  /** Logical simulation step in seconds; the loop runs fixed steps. */
  fixedStep: 1 / 30,
  /** Hard cap on living creatures to keep the canvas renderer smooth. */
  maxCreatures: 240,
} as const;

export const FOOD = {
  /** Target number of plants alive in fertile terrain. */
  target: 340,
  /** Plants (re)grown per simulation second toward the target. */
  growthPerSecond: 18,
  /** Energy a fully grown plant yields. */
  energy: 55,
  /** Seconds for a plant to grow from sprout to ripe. */
  ripenTime: 9,
  radius: 7,
} as const;

export const LIFE = {
  /** Initial wild population when a world is seeded. */
  startHerbivores: 40,
  startCarnivores: 12,

  /**
   * Immigration keeps the ecology diverse and well populated. Wild "migrants"
   * trickle in toward these targets — the original world stayed alive on a
   * constant stream of user-created creatures, and this stands in for that.
   */
  immigrationInterval: 4,
  /** Keep at least this many grazers / prowlers via immigration. */
  herbivoreFloor: 46,
  carnivoreFloor: 5,
  /** Keep topping the world up toward this population for diversity. */
  wildPopTarget: 110,

  // --- reproduction (sexual only; budding removed) ---
  /** Fraction of max energy needed before a creature will mate. */
  mateEnergyFrac: 0.72,
  /** Energy each parent spends to produce one offspring. */
  mateCost: 0.42,
  /** Seconds between matings for one creature. */
  mateCooldown: 55,
  /** Seconds before a creature is mature enough to reproduce. */
  maturity: 25,
  /** Probability per gene of mutation when breeding. */
  mutationRate: 0.12,
} as const;
