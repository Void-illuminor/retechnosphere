/**
 * Life events. In TechnoSphere the magic was the email: you'd get word that your
 * creature had eaten, mated, borne offspring, or been killed out in a world you
 * couldn't see. We reproduce that as an in-game inbox. Events are only recorded
 * for the player's own bloodline (their released creatures and descendants).
 */

export type LifeEventKind =
  | "born"
  | "released"
  | "fed"
  | "grew"
  | "mated"
  | "offspring"
  | "fled"
  | "killed" // this creature killed prey (carnivore)
  | "starved"
  | "oldage"
  | "eaten"; // this creature was killed by a predator

export interface LifeEvent {
  id: number;
  kind: LifeEventKind;
  /** Sim time in seconds when it happened. */
  time: number;
  /** Name of the creature the event is about. */
  subject: string;
  /** Id of the creature the event is about (for per-creature dossiers). */
  creatureId: number;
  /** Display headline. */
  headline: string;
  /** Body copy, written in the chatty TechnoSphere update voice. */
  body: string;
  /** Lineage id this event belongs to (groups an inbox per founder). */
  lineageId: number;
  /** True for milestones worth surfacing prominently (births, deaths). */
  notable: boolean;
}

let nextEventId = 1;

/** Next event id — for serialization. */
export function getNextEventId(): number {
  return nextEventId;
}

/** Restore the event id counter when loading a saved world. */
export function setNextEventId(n: number): void {
  nextEventId = Math.max(1, n | 0);
}

export function makeEvent(
  kind: LifeEventKind,
  time: number,
  subject: string,
  creatureId: number,
  lineageId: number,
  headline: string,
  body: string,
  notable = false,
): LifeEvent {
  return { id: nextEventId++, kind, time, subject, creatureId, headline, body, lineageId, notable };
}

export function formatSimTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
