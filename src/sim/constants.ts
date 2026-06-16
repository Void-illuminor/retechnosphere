/**
 * Tunable parameters for the digital ecology. Collected in one place so the
 * predator/prey balance can be adjusted without hunting through the engine.
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
  growthPerSecond: 22,
  /** Energy a fully grown plant yields. */
  energy: 48,
  /** Seconds for a plant to grow from sprout to ripe. */
  ripenTime: 6,
  radius: 7,
} as const;

export const LIFE = {
  /** Initial wild population when a world is seeded. */
  startHerbivores: 44,
  startCarnivores: 9,
  /** Below this herbivore count, the world spontaneously seeds new wildlife. */
  reseedThreshold: 8,
  /**
   * Predators struggle to find mates when sparse, so — as the original relied on
   * a steady stream of user-created creatures — wild "immigrants" trickle in to
   * keep both populations from quietly going extinct.
   */
  carnivoreFloor: 3,
  immigrationInterval: 5,
  /** Fraction of max energy needed before a creature will mate. */
  mateEnergyFrac: 0.55,
  /** Energy each parent spends to produce one offspring. */
  mateCost: 0.28,
  /** Seconds between matings for one creature. */
  mateCooldown: 14,
  /** Seconds before a creature is mature enough to reproduce. */
  maturity: 9,
  /** Probability per gene of mutation when breeding. */
  mutationRate: 0.12,
  /**
   * Budding fallback: a creature thriving alone (no mate in sight) can still
   * reproduce by division once extremely well fed. This lets sparse predators
   * grow their numbers so predator/prey cycles actually occur, while dense
   * populations still reproduce mainly by mating.
   */
  budEnergyFrac: 0.9,
  budCost: 0.42,
  budChancePerSecond: 0.14,
} as const;
