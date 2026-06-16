/**
 * Daily "field report" digests. For each subscriber, once per interval, gather
 * everything that happened to their bloodlines since the last report and email a
 * single summary. Nothing happened? No email — digests should never be noise.
 */
import { config } from "./config";
import { OutgoingEmail, sendEmail } from "./email";
import { Subscriber, allSubscribers, markDigestSent } from "./subscribers";
import { StoredEvent, worldManager } from "./worldManager";

interface LineageReport {
  name: string;
  diet: string;
  alive: number;
  bestGeneration: number;
  extinct: boolean;
  counts: Record<string, number>;
  events: StoredEvent[];
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function gatherReports(sub: Subscriber, sinceMs: number): LineageReport[] {
  const world = worldManager.getWorld();
  const mine = [...world.lineages.values()].filter((l) => l.ownerEmail === sub.email);
  if (mine.length === 0) return [];
  const ids = new Set(mine.map((l) => l.id));
  const events = worldManager.eventsForLineagesSince(ids, sinceMs);

  return mine.map((l) => {
    const evs = events.filter((e) => e.lineageId === l.id).sort((a, b) => a.id - b.id);
    const counts: Record<string, number> = {};
    for (const e of evs) counts[e.kind] = (counts[e.kind] || 0) + 1;
    return {
      name: l.founderName,
      diet: l.diet,
      alive: l.alive,
      bestGeneration: l.bestGeneration,
      extinct: l.extinct,
      counts,
      events: evs,
    };
  });
}

function countLine(counts: Record<string, number>): string {
  const parts: string[] = [];
  const add = (k: string, label: string) => {
    if (counts[k]) parts.push(`${counts[k]} ${label}${counts[k] > 1 ? "s" : ""}`);
  };
  add("offspring", "birth");
  add("killed", "kill");
  add("eaten", "loss to predators");
  add("starved", "starvation");
  add("oldage", "death from old age");
  return parts.join(" · ") || "a quiet day";
}

function buildDigest(sub: Subscriber, reports: LineageReport[], totalEvents: number): OutgoingEmail {
  const world = worldManager.getWorld();
  const stats = world.stats();
  const link = config.publicUrl || ""; // frontend (Render) — "visit" link
  const unsubBase = config.apiPublicUrl || link; // backend (Railway) — serves /unsubscribe
  const unsub = unsubBase ? `${unsubBase}/unsubscribe?token=${sub.token}` : "";

  const lineHtml = reports
    .map((r) => {
      const status = r.extinct
        ? `<span style="color:#ff5a4d">extinct</span>`
        : `${r.alive} alive · gen ${r.bestGeneration}`;
      const highlights = r.events
        .filter((e) => e.notable)
        .slice(-8)
        .map((e) => `<li style="margin:2px 0"><strong>${esc(e.headline)}</strong><br><span style="color:#8294ab">${esc(e.body)}</span></li>`)
        .join("");
      return `
        <div style="border:1px solid #2a3a52;border-radius:6px;padding:12px;margin:10px 0;background:#10192a">
          <div style="font-size:15px;font-weight:bold;color:#eaf2ff">${esc(r.name)}
            <span style="font-size:11px;color:#46e2c8;text-transform:uppercase"> ${r.diet}</span></div>
          <div style="color:#8294ab;font-size:12px;margin:2px 0 6px">${status} — ${countLine(r.counts)}</div>
          ${highlights ? `<ul style="padding-left:18px;margin:6px 0;font-size:13px">${highlights}</ul>` : ""}
        </div>`;
    })
    .join("");

  const html = `
  <div style="font-family:Tahoma,Verdana,sans-serif;background:#0b0e14;color:#c9d6e5;padding:20px;max-width:640px;margin:0 auto">
    <h1 style="color:#46e2c8;font-size:22px;margin:0 0 4px">reTechnoSphere — field report</h1>
    <div style="color:#8294ab;font-size:12px;margin-bottom:14px">
      Hello ${esc(sub.displayName)}. Here's what happened to your bloodlines (${totalEvents} events).
    </div>
    <div style="font-size:12px;color:#8294ab;margin-bottom:6px">
      World: ${stats.population} creatures (${stats.herbivores} grazers, ${stats.carnivores} prowlers) ·
      generation ${stats.generation} · ${Math.round(world.time / 60)} min of life elapsed
    </div>
    ${lineHtml}
    ${link ? `<div style="margin-top:16px"><a href="${link}" style="color:#46e2c8">Visit the Sphere →</a></div>` : ""}
    ${unsub ? `<div style="margin-top:18px;font-size:11px;color:#5a6b82">You get these because you released a creature. <a href="${unsub}" style="color:#5a6b82">Unsubscribe</a>.</div>` : ""}
  </div>`;

  const text =
    `reTechnoSphere field report for ${sub.displayName}\n\n` +
    reports
      .map((r) => `${r.name} (${r.diet}): ${r.extinct ? "extinct" : `${r.alive} alive, gen ${r.bestGeneration}`} — ${countLine(r.counts)}`)
      .join("\n") +
    (link ? `\n\nVisit: ${link}` : "") +
    (unsub ? `\nUnsubscribe: ${unsub}` : "");

  return {
    to: sub.email,
    subject: `Your reTechnoSphere field report — ${totalEvents} event${totalEvents === 1 ? "" : "s"}`,
    html,
    text,
  };
}

/** Send any digests that are due. Returns how many were sent. */
export async function maybeSendDigests(force = false): Promise<number> {
  const now = Date.now();
  let sent = 0;
  for (const sub of allSubscribers()) {
    if (!sub.dailyDigest) continue;
    if (!force && now - sub.lastDigestAtMs < config.digest.intervalMs) continue;

    const reports = gatherReports(sub, sub.lastDigestAtMs);
    const totalEvents = reports.reduce((n, r) => n + r.events.length, 0);
    if (totalEvents === 0 && !force) continue; // nothing to report — stay quiet

    const result = await sendEmail(buildDigest(sub, reports, totalEvents));
    if (result.ok) {
      markDigestSent(sub.email, now);
      sent++;
      console.log(`[digest] sent to ${sub.email}${result.dryRun ? " (dry-run)" : ""} — ${totalEvents} events`);
    } else {
      console.error(`[digest] FAILED for ${sub.email}: ${result.error}`);
    }
  }
  return sent;
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startDigestScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    maybeSendDigests().catch((e) => console.error("[digest] scheduler error", e));
  }, config.digest.checkMs);
}

export function stopDigestScheduler(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
