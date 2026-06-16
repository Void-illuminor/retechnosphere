/** Central server configuration, all overridable via environment variables. */
import path from "node:path";

function num(name: string, def: number): number {
  const v = process.env[name];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
}

// Gmail shortcut + generic SMTP, resolved once at startup.
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || "";
const SMTP_HOST = process.env.SMTP_HOST || (GMAIL_USER ? "smtp.gmail.com" : "");
const SMTP_PORT = num("SMTP_PORT", GMAIL_USER ? 465 : 587);
const SMTP_USER = process.env.SMTP_USER || GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || GMAIL_PASS;

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

  /**
   * SMTP transport (e.g. Gmail). This is the way to email a whole family WITHOUT
   * owning a domain: create a Gmail App Password and set GMAIL_USER +
   * GMAIL_APP_PASSWORD (or generic SMTP_* vars). SMTP takes priority over Resend.
   */
  smtp: {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : SMTP_PORT === 465,
    user: SMTP_USER,
    pass: SMTP_PASS,
  },

  email: {
    apiKey: process.env.RESEND_API_KEY || "",
    from:
      process.env.EMAIL_FROM ||
      (GMAIL_USER ? `reTechnoSphere <${GMAIL_USER}>` : "reTechnoSphere <onboarding@resend.dev>"),
    get enabled() {
      return !!process.env.RESEND_API_KEY;
    },
  },

  /** Which email transport is active. SMTP (e.g. Gmail) wins, then Resend. */
  get emailMode(): "smtp" | "resend" | "dry-run" {
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) return "smtp";
    if (process.env.RESEND_API_KEY) return "resend";
    return "dry-run";
  },

  /** Player-facing app URL (the frontend), used for "visit" links in emails. */
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  /** This backend's own public URL, used for the unsubscribe link in emails.
   * Falls back to PUBLIC_URL for combined (single-host) deployments. */
  apiPublicUrl: (process.env.API_PUBLIC_URL || process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  /** Allowed CORS origin(s), comma-separated. "*" allows any (no cookies used). */
  corsOrigin: process.env.CORS_ORIGIN || "*",
  /** Shared secret to allow an external scheduler to hit /api/cron. */
  cronSecret: process.env.CRON_SECRET || "",
  /** Shared secret for admin actions (reset world, etc.). */
  adminSecret: process.env.ADMIN_SECRET || "",
};

export type Config = typeof config;
