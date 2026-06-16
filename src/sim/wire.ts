/**
 * Shared wire formats used by both the server (authoritative world) and the
 * browser client. Two shapes:
 *   - WorldSnapshot: full fidelity, for persisting/restoring the world to disk.
 *   - ClientState:   compact, for streaming the world to browsers to render.
 * Terrain is never sent — it is regenerated deterministically from the seed on
 * both sides, so it costs nothing to transmit.
 */
import type { Behaviour, Creature } from "./creature";
import type { LifeEvent } from "./events";
import type { Diet, DerivedStats } from "./genome";
import type { CreatureRecord, Lineage, Plant, PopSample, WorldStats } from "./world";

/** Portrait + identity bits shared by summaries (enough to draw a creature). */
export interface PortraitDTO {
  diet: Diet;
  hue: number;
  accent: number;
  sizeGene: number;
  parts: { head: string; body: string; locomotion: string; eyes: string; mouth: string };
}

/** A creature as shown in the roster list (alive or dead). */
export interface CreatureSummaryDTO extends PortraitDTO {
  id: number;
  name: string;
  generation: number;
  lineageId: number;
  alive: boolean;
  cause: string | null;
  bornTime: number;
  diedTime: number | null;
  /** Current age if alive, else age at death (sim seconds). */
  age: number;
  /** 0..1 if alive, else null. */
  energyFrac: number | null;
  meals: number;
  kills: number;
  offspringCount: number;
  /** True for a creature with no dossier record (a wild ancestor). */
  wild?: boolean;
}

export interface CreatureDetailDTO {
  creature: CreatureSummaryDTO;
  stats: DerivedStats;
  parents: CreatureSummaryDTO[];
  offspring: CreatureSummaryDTO[];
}

export const SNAPSHOT_VERSION = 1;

/** A creature minus its derived stats (re-derived from the genome on load). */
export type CreatureDTO = Omit<Creature, "stats">;

export interface WorldSnapshot {
  version: number;
  seed: number;
  time: number;
  births: number;
  deaths: number;
  maxGeneration: number;
  rngState: number;
  nextCreatureId: number;
  nextEventId: number;
  foodCredit: number;
  sampleTimer: number;
  immigrationTimer: number;
  creatures: CreatureDTO[];
  plants: Plant[];
  events: LifeEvent[];
  lineages: Lineage[];
  popHistory: PopSample[];
  /** Per-creature dossier records for player bloodlines. */
  dossier: CreatureRecord[];
  /** Wall-clock ms when this snapshot was written (used to fast-forward). */
  savedAtMs: number;
}

/** One creature as the browser needs it to render + dead-reckon. */
export interface ClientCreature {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  diet: Diet;
  hue: number;
  accent: number;
  sizeGene: number;
  parts: { head: string; body: string; locomotion: string; eyes: string; mouth: string };
  radius: number;
  ef: number; // energy fraction 0..1
  beh: Behaviour;
  lineageId: number;
  gen: number;
  founder: boolean;
  name: string;
  age: number;
  meals: number;
  kills: number;
  offspring: number;
}

/** A bloodline as shown to clients — note: no owner email (kept private). */
export interface ClientLineage {
  id: number;
  founderName: string;
  ownerName?: string;
  diet: Diet;
  hue: number;
  alive: number;
  born: number;
  deaths: number;
  bestGeneration: number;
  extinct: boolean;
}

export interface ClientState {
  time: number;
  seed: number;
  width: number;
  height: number;
  stats: WorldStats;
  popHistory: PopSample[];
  lineages: ClientLineage[];
  creatures: ClientCreature[];
  plants: { x: number; y: number; g: number }[];
  /** Server wall clock (ms) at send time, for client-side extrapolation. */
  serverNow: number;
}
