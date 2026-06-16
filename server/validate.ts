/**
 * Validate and sanitise a genome submitted by a browser before it is allowed
 * into the shared world. Never trust the client: every part id must exist in the
 * catalogue and belong to the right category, and numeric genes are clamped.
 */
import { Diet, Genome } from "../src/sim/genome";
import { PARTS_BY_ID, PART_CATEGORIES, PartCategory, partsIn } from "../src/sim/parts";

function clamp(n: unknown, lo: number, hi: number, def: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : def;
  return Math.max(lo, Math.min(hi, v));
}

export interface ReleaseInput {
  genome: Genome;
  name: string;
  displayName: string;
  email: string;
}

export type ValidationResult =
  | { ok: true; value: ReleaseInput }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRelease(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing body." };
  const b = body as Record<string, unknown>;

  const diet = b.diet as Diet;
  if (diet !== "herbivore" && diet !== "carnivore") {
    return { ok: false, error: "diet must be herbivore or carnivore." };
  }

  const partsIn_ = (b.parts ?? {}) as Record<string, unknown>;
  const parts = {} as Record<PartCategory, string>;
  for (const cat of PART_CATEGORIES) {
    const id = partsIn_[cat];
    if (typeof id !== "string" || !PARTS_BY_ID[id] || PARTS_BY_ID[id].category !== cat) {
      // Fall back to the first valid part for that category rather than rejecting.
      parts[cat] = partsIn(cat)[0].id;
    } else {
      parts[cat] = id;
    }
  }

  const name = String(b.name ?? "").trim().slice(0, 24) || "Unnamed";
  const displayName = String(b.displayName ?? "").trim().slice(0, 24);
  const email = String(b.email ?? "").trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required." };
  if (!displayName) return { ok: false, error: "A display name is required." };

  const genome: Genome = {
    diet,
    parts,
    hue: clamp(b.hue, 0, 360, 110),
    accent: clamp(b.accent, 0, 1, 0.5),
    sizeGene: clamp(b.sizeGene, 0.8, 1.3, 1),
    vigor: clamp(b.vigor, 0.85, 1.15, 1),
  };

  return { ok: true, value: { genome, name, displayName, email } };
}
