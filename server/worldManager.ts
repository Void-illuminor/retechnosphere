/**
 * Owns the single shared World. Advances it in real time, persists snapshots,
 * fast-forwards after downtime so the world genuinely "kept living" while no one
 * was watching, and drains life-events into a durable store for the inbox and
 * the daily digests.
 */
import { Genome } from "../src/sim/genome";
import { World } from "../src/sim/world";
import { ClientState, WorldSnapshot } from "../src/sim/wire";
import { config } from "./config";
import { FILES, ensureDataDir, readJSON, writeJSON } from "./storage";
import * as subs from "./subscribers";

export interface StoredEvent {
  id: number;
  simTime: number;
  wallMs: number;
  kind: string;
  headline: string;
  body: string;
  lineageId: number;
  notable: boolean;
}

const EVENT_RETENTION_MS = 30 * 24 * 3600 * 1000;
const EVENT_CAP = 8000;

class WorldManager {
  private world!: World;
  private events: StoredEvent[] = [];
  private lastDrainedEventId = 0;
  private tickTimer?: ReturnType<typeof setInterval>;
  private snapTimer?: ReturnType<typeof setInterval>;
  private lastTickMs = 0;

  start(): void {
    ensureDataDir();
    subs.loadSubscribers();
    this.events = readJSON<StoredEvent[]>(FILES.events, []);
    this.lastDrainedEventId = this.events.reduce((m, e) => Math.max(m, e.id), 0);

    const snap = readJSON<WorldSnapshot | null>(FILES.world, null);
    if (snap && Array.isArray(snap.creatures)) {
      this.world = World.fromSnapshot(snap);
      this.catchUp(snap.savedAtMs);
      console.log(
        `[world] restored — pop=${this.world.creatures.length}, time=${Math.round(this.world.time)}s, gen=${this.world.maxGeneration}, lineages=${this.world.lineages.size}`,
      );
    } else {
      this.world = World.createFresh(config.worldSeed);
      console.log(`[world] fresh world seeded — seed=${this.world.seed}, pop=${this.world.creatures.length}`);
      this.snapshot();
    }

    this.lastTickMs = Date.now();
    this.tickTimer = setInterval(() => this.tick(), config.tickMs);
    this.snapTimer = setInterval(() => this.snapshot(), config.snapshotIntervalMs);
  }

  /** Advance the world to account for time elapsed while the server was down. */
  private catchUp(savedAtMs: number): void {
    const elapsedS = Math.max(0, (Date.now() - savedAtMs) / 1000) * config.simSpeed;
    const simS = Math.min(elapsedS, config.catchupCapSeconds);
    if (simS < 1) return;
    const step = 1 / 30;
    const t0 = Date.now();
    for (let t = 0; t < simS; t += step) this.world.update(step, 1);
    this.drainEvents();
    console.log(`[world] fast-forwarded ${Math.round(simS)}s of sim time in ${Date.now() - t0}ms`);
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastTickMs) / 1000;
    this.lastTickMs = now;
    this.world.update(dt, config.simSpeed);
    this.drainEvents();
  }

  /** Copy any new life-events out of the (capped) world log into the durable store. */
  private drainEvents(): void {
    const now = Date.now();
    let maxId = this.lastDrainedEventId;
    for (const e of this.world.events) {
      if (e.id > this.lastDrainedEventId) {
        this.events.push({
          id: e.id,
          simTime: e.time,
          wallMs: now,
          kind: e.kind,
          headline: e.headline,
          body: e.body,
          lineageId: e.lineageId,
          notable: e.notable,
        });
        if (e.id > maxId) maxId = e.id;
      }
    }
    this.lastDrainedEventId = maxId;
    if (this.events.length > EVENT_CAP) this.events.splice(0, this.events.length - EVENT_CAP);
  }

  snapshot(): void {
    if (!this.world) return;
    writeJSON(FILES.world, this.world.toSnapshot());
    const cutoff = Date.now() - EVENT_RETENTION_MS;
    this.events = this.events.filter((e) => e.wallMs >= cutoff);
    writeJSON(FILES.events, this.events);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapTimer) clearInterval(this.snapTimer);
    this.snapshot();
  }

  getState(): ClientState {
    return this.world.toClientState();
  }

  getWorld(): World {
    return this.world;
  }

  eventsForLineage(lineageId: number, sinceId = 0, limit = 120): StoredEvent[] {
    const out = this.events.filter((e) => e.lineageId === lineageId && e.id > sinceId);
    return out.slice(-limit).reverse();
  }

  eventsForLineagesSince(lineageIds: Set<number>, sinceMs: number): StoredEvent[] {
    return this.events.filter((e) => lineageIds.has(e.lineageId) && e.wallMs >= sinceMs);
  }

  release(input: { genome: Genome; name: string; displayName: string; email: string }): {
    creatureId: number;
    lineageId: number;
    token: string;
    displayName: string;
  } {
    const sub = subs.upsert(input.email, input.displayName);
    const c = this.world.addFounder(input.genome, input.name, {
      email: sub.email,
      displayName: sub.displayName,
    });
    this.drainEvents();
    this.snapshot();
    return { creatureId: c.id, lineageId: c.lineageId, token: sub.token, displayName: sub.displayName };
  }

  /** Drop a random wild creature in (a shared, low-stakes action). */
  spawnWild(): void {
    this.world.spawnWild(Math.random() < 0.72 ? "herbivore" : "carnivore");
  }

  reset(): void {
    this.world = World.createFresh(config.worldSeed);
    this.events = [];
    this.lastDrainedEventId = 0;
    this.snapshot();
  }
}

export const worldManager = new WorldManager();
