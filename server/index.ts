/**
 * The reTechnoSphere server: runs the shared world, serves the built client,
 * exposes the API the browser talks to, and drives the daily email digests.
 */
import compression from "compression";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { maybeSendDigests, startDigestScheduler, stopDigestScheduler } from "./digest";
import * as subs from "./subscribers";
import { validateRelease } from "./validate";
import { worldManager } from "./worldManager";

const app = express();
app.use(compression());

// CORS — needed when the frontend is hosted separately (Render) from this API
// (Railway). No cookies are used (identity is a bearer token), so "*" is safe;
// set CORS_ORIGIN to lock it to your frontend URL.
const corsOrigins = config.corsOrigin.split(",").map((s) => s.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "64kb" }));

// --- API -------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: worldManager.getWorld().time });
});

app.get("/api/state", (_req, res) => {
  res.json(worldManager.getState());
});

app.get("/api/events", (req, res) => {
  const lineage = Number(req.query.lineage);
  if (!Number.isFinite(lineage)) return res.status(400).json({ error: "lineage required" });
  const since = Number(req.query.since) || 0;
  res.json({ events: worldManager.eventsForLineage(lineage, since) });
});

app.post("/api/release", (req, res) => {
  const v = validateRelease(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const result = worldManager.release(v.value);
  res.json(result);
});

app.get("/api/me", (req, res) => {
  const sub = subs.getByToken(String(req.query.token || ""));
  if (!sub) return res.status(404).json({ error: "unknown token" });
  const world = worldManager.getWorld();
  const lineages = [...world.lineages.values()]
    .filter((l) => l.ownerEmail === sub.email)
    .map((l) => ({
      id: l.id,
      founderName: l.founderName,
      diet: l.diet,
      alive: l.alive,
      bestGeneration: l.bestGeneration,
      extinct: l.extinct,
    }));
  res.json({
    email: sub.email,
    displayName: sub.displayName,
    dailyDigest: sub.dailyDigest,
    lineages,
  });
});

app.post("/api/prefs", (req, res) => {
  const { token, dailyDigest } = req.body ?? {};
  const sub = subs.setDailyDigest(String(token || ""), !!dailyDigest);
  if (!sub) return res.status(404).json({ error: "unknown token" });
  res.json({ ok: true, dailyDigest: sub.dailyDigest });
});

app.get("/unsubscribe", (req, res) => {
  const sub = subs.setDailyDigest(String(req.query.token || ""), false);
  res
    .status(sub ? 200 : 404)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#0b0e14;color:#c9d6e5;display:grid;place-items:center;height:100vh;margin:0">
       <div style="text-align:center"><h2 style="color:#46e2c8">reTechnoSphere</h2>
       <p>${sub ? "You've been unsubscribed from daily field reports." : "That link is no longer valid."}</p>
       ${config.publicUrl ? `<a href="${config.publicUrl}" style="color:#46e2c8">Back to the Sphere</a>` : ""}</div></body>`,
    );
});

// External scheduler hook (e.g. a Render Cron Job or cron-job.org).
app.post("/api/cron", async (req, res) => {
  if (!config.cronSecret || req.query.key !== config.cronSecret) return res.status(403).json({ error: "forbidden" });
  worldManager.snapshot();
  const sent = await maybeSendDigests();
  res.json({ ok: true, digestsSent: sent });
});

// Admin actions.
function admin(req: express.Request): boolean {
  return !!config.adminSecret && req.query.key === config.adminSecret;
}
app.post("/api/admin/reset", (req, res) => {
  if (!admin(req)) return res.status(403).json({ error: "forbidden" });
  worldManager.reset();
  res.json({ ok: true });
});
app.post("/api/admin/digest", async (req, res) => {
  if (!admin(req)) return res.status(403).json({ error: "forbidden" });
  const sent = await maybeSendDigests(true);
  res.json({ ok: true, digestsSent: sent });
});

// --- static client (production) --------------------------------------------

if (fs.existsSync(config.distDir)) {
  app.use(express.static(config.distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(config.distDir, "index.html"));
  });
}

// --- lifecycle -------------------------------------------------------------

worldManager.start();
startDigestScheduler();

const server = app.listen(config.port, () => {
  console.log(`[server] listening on :${config.port}  (email ${config.email.enabled ? "via Resend" : "DRY-RUN"}, simSpeed ${config.simSpeed}x)`);
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} — saving world and shutting down`);
  stopDigestScheduler();
  worldManager.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
