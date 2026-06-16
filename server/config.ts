/** Central server configuration, all overridable via environment variables. */
import path from "node:path";

function num(name: string, def: number): number {
  const v = process.env[name];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  /** Port to listen on (Render sets PORT). */
  port: num("PORT", 8787),

  /** Where the world snapshot, subscribers and events are stored (mount a disk here). */
  dataDir: process.env.DATA_DIR || path.resolve("data"),
  /** Built client to serve in production. */
  distDir: process.env.DIST_DIR || path.resolve("dist"),

  /** Simulation speed multiplier vs real time (1 = real-time evolution). */
  simSpeed: num("SIM_SPEED", 1),
  /** Fixed seed for the shared world; omit for a random one on first boot. */
  worldSeed: process.env.WORLD_SEED ? Number(process.env.WORLD_SEED) : undefined,
  /** How often to write the world snapshot to disk. */
  snapshotIntervalMs: num("SNAPSHOT_INTERVAL_MS", 10_000),
  /** Sim loop cadence. */
  tickMs: num("TICK_MS", 33),
  /** Cap how far the world fast-forwards after downtime (seconds of sim time). */
  catchupCapSeconds: num("CATCHUP_CAP_SECONDS", 3600),

  digest: {
    /** Minimum gap between digests for one subscriber. */
    intervalMs: num("DIGEST_INTERVAL_MS", 24 * 3600 * 1000),
    /** How often the scheduler checks whether any digests are due. */
    checkMs: num("DIGEST_CHECK_MS", 15 * 60 * 1000),
  },

  email: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "reTechnoSphere <onboarding@resend.dev>",
    get enabled() {
      return !!process.env.RESEND_API_KEY;
    },
  },

  /** Public base URL, used to build links inside emails (e.g. unsubscribe). */
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  /** Shared secret to allow an external scheduler to hit /api/cron. */
  cronSecret: process.env.CRON_SECRET || "",
  /** Shared secret for admin actions (reset world, etc.). */
  adminSecret: process.env.ADMIN_SECRET || "",
};

export type Config = typeof config;
