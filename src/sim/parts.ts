/**
 * The body-part catalogue. In TechnoSphere you first chose herbivore or
 * carnivore, then assembled a creature from a head, body, locomotion, eyes and
 * mouth. Each part here contributes to the creature's final stats; the builder
 * shows these trade-offs so players can design a survivor.
 */

export type PartCategory = "body" | "head" | "locomotion" | "eyes" | "mouth";

export const PART_CATEGORIES: PartCategory[] = [
  "body",
  "head",
  "locomotion",
  "eyes",
  "mouth",
];

export const CATEGORY_LABEL: Record<PartCategory, string> = {
  body: "Body / Chassis",
  head: "Head",
  locomotion: "Locomotion",
  eyes: "Eyes",
  mouth: "Mouth",
};

/**
 * Raw stat contributions. Bodies/heads etc. add these up into the creature's
 * derived stats (see genome.ts). Values are tuned to roughly cancel so that
 * every part is a trade-off rather than a strict upgrade.
 */
export interface PartStats {
  /** Energy storage capacity. */
  energy: number;
  /** Baseline energy burned per second. */
  metabolism: number;
  /** Top movement speed (world units / second). */
  speed: number;
  /** Turning agility (radians / second). */
  agility: number;
  /** How far the creature can sense food, prey and threats. */
  vision: number;
  /** Damage dealt when a carnivore strikes prey. */
  attack: number;
  /** Reduces incoming damage; also adds visual bulk. */
  armor: number;
  /** Multiplier on energy gained from feeding. */
  feeding: number;
  /** Visual + collision radius contribution. */
  bulk: number;
}

export interface PartDef {
  id: string;
  category: PartCategory;
  name: string;
  blurb: string;
  stats: PartStats;
}

const z: PartStats = {
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

function part(
  id: string,
  category: PartCategory,
  name: string,
  blurb: string,
  stats: Partial<PartStats>,
): PartDef {
  return { id, category, name, blurb, stats: { ...z, ...stats } };
}

export const PARTS: PartDef[] = [
  // ---- Bodies / chassis -------------------------------------------------
  part("body_tank", "body", "Tank Chassis", "Heavy frame. Huge reserves and armour, but sluggish.", {
    energy: 90,
    metabolism: 1.4,
    armor: 7,
    speed: -10,
    agility: -0.6,
    bulk: 5,
  }),
  part("body_balanced", "body", "Balanced Frame", "An all-rounder with no glaring weakness.", {
    energy: 55,
    metabolism: 0.9,
    armor: 3,
    bulk: 2,
  }),
  part("body_sleek", "body", "Sleek Hull", "Lightweight racing body. Fast, fragile, hungry.", {
    energy: 30,
    metabolism: 1.1,
    speed: 14,
    agility: 0.8,
    armor: -1,
    bulk: -1,
  }),
  part("body_pod", "body", "Pod Body", "Efficient little pod that sips energy.", {
    energy: 40,
    metabolism: 0.5,
    speed: 4,
    agility: 0.4,
    bulk: 0,
  }),

  // ---- Heads ------------------------------------------------------------
  part("head_sensor", "head", "Sensor Dome", "Bristling sensors greatly extend perception.", {
    vision: 70,
    metabolism: 0.3,
    energy: 6,
  }),
  part("head_blunt", "head", "Blunt Skull", "A thick, armoured head built for ramming.", {
    armor: 4,
    attack: 4,
    vision: -10,
  }),
  part("head_antenna", "head", "Antenna Array", "Twitchy antennae improve awareness and steering.", {
    vision: 40,
    agility: 0.7,
  }),
  part("head_compact", "head", "Compact Head", "Aerodynamic and cheap, but a little short-sighted.", {
    vision: -8,
    speed: 6,
    metabolism: -0.2,
  }),

  // ---- Locomotion -------------------------------------------------------
  part("loco_bigwheels", "locomotion", "Big Wheels", "TechnoSphere's signature wheels. Quick, poor at turning.", {
    speed: 24,
    agility: -0.7,
    metabolism: 0.6,
  }),
  part("loco_tracks", "locomotion", "Tracks", "Caterpillar treads. Slow, steady, tough and frugal.", {
    speed: -6,
    agility: 0.3,
    armor: 3,
    metabolism: -0.3,
  }),
  part("loco_legs", "locomotion", "Spider Legs", "Many legs grant superb agility over speed.", {
    speed: 6,
    agility: 1.6,
    metabolism: 0.4,
  }),
  part("loco_mono", "locomotion", "Mono-Wheel", "A single gyro wheel. Blistering speed, awful cornering.", {
    speed: 34,
    agility: -1.2,
    metabolism: 0.9,
  }),
  part("loco_hover", "locomotion", "Hover Pads", "Frictionless drifting. Fast and nimble but power-hungry.", {
    speed: 18,
    agility: 1.0,
    metabolism: 1.3,
  }),

  // ---- Eyes -------------------------------------------------------------
  part("eyes_compound", "eyes", "Compound Eyes", "Wide field of view; spots danger from any angle.", {
    vision: 55,
    agility: 0.3,
  }),
  part("eyes_telescopic", "eyes", "Telescopic Eye", "One long-range eye. Sees far ahead, narrow focus.", {
    vision: 90,
    metabolism: 0.2,
  }),
  part("eyes_basic", "eyes", "Basic Optics", "Simple, cheap, dependable eyes.", {
    vision: 28,
    metabolism: -0.1,
  }),
  part("eyes_night", "eyes", "Night Eyes", "Light-hungry eyes that also feed a touch more.", {
    vision: 44,
    feeding: 0.08,
  }),

  // ---- Mouths -----------------------------------------------------------
  part("mouth_grazer", "mouth", "Grazing Maw", "Broad maw that strips vegetation efficiently.", {
    feeding: 0.35,
    energy: 6,
  }),
  part("mouth_sieve", "mouth", "Sieve Mouth", "Filters the most energy from every meal, slowly.", {
    feeding: 0.5,
    speed: -4,
  }),
  part("mouth_shear", "mouth", "Shearing Jaws", "Powerful cutting jaws — a carnivore's best weapon.", {
    attack: 14,
    feeding: 0.12,
  }),
  part("mouth_fangs", "mouth", "Venom Fangs", "Quick, vicious fangs that wound prey badly.", {
    attack: 10,
    agility: 0.4,
  }),
  part("mouth_beak", "mouth", "Hooked Beak", "A versatile beak — modest at biting and feeding alike.", {
    attack: 6,
    feeding: 0.18,
  }),
];

export const PARTS_BY_ID: Record<string, PartDef> = Object.fromEntries(
  PARTS.map((p) => [p.id, p]),
);

export function partsIn(category: PartCategory): PartDef[] {
  return PARTS.filter((p) => p.category === category);
}
