/**
 * Creature portrait renderer.
 *
 * Direction: TechnoSphere's modular, rendered-on-a-grid form + Spore's organic
 * skin detail, given an original Aztec/Mayan "carved living idol" identity:
 *   - palette of jade/turquoise + gold + obsidian (grazers) and
 *     terracotta/blood-red + gold + obsidian (prowlers);
 *   - carved relief skin (scale bumps), a stepped-fret (greca) belt, a carved
 *     sun-glyph medallion, and a feathered-serpent crest;
 *   - gold-ringed obsidian eyes with a glowing core.
 * Heavy, layered shading (ambient occlusion, terminator core shadow, bounce
 * light, broad + hot speculars, fresnel rim) gives real volume rather than a
 * flat toy look.
 *
 * Built on a fixed skeleton so any part combination places correctly. Faces
 * left, lit from upper-left. Drawn centred on (cx, cy); `size` is the base unit.
 * All surface detail is seeded from the genome (stable across frames).
 */
import { Genome } from "../sim/genome";
import { Rng } from "../sim/rng";

interface PortraitOpts {
  size: number;
  scene?: boolean;
  viewW?: number;
  viewH?: number;
  /** 0 = silhouette+shading only, 1 = + ornament, 2 = + scales/medallion. */
  detail?: number;
}

const TAU = Math.PI * 2;
const LX = -0.42;
const LY = -0.5;

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${clamp(s, 0, 100)}%, ${clamp(l, 0, 100)}%)`;
}
function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${((h % 360) + 360) % 360}, ${clamp(s, 0, 100)}%, ${clamp(l, 0, 100)}%, ${a})`;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function seedFromGenome(g: Genome): number {
  const str =
    g.diet + g.parts.head + g.parts.body + g.parts.locomotion + g.parts.eyes + g.parts.mouth +
    Math.round(g.hue) + "_" + Math.round(g.accent * 100) + "_" + Math.round(g.sizeGene * 100);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --- palette (Aztec/Mayan carved idol) --------------------------------------

interface Pal {
  baseHue: number;
  baseSat: number;
  hi: string;
  lit: string;
  mid: string;
  core: string;
  shadow: string;
  bounce: string;
  gold: string;
  goldDark: string;
  obsidian: string;
  rimHue: number;
  glow: string;
}

function palette(g: Genome): Pal {
  const carn = g.diet === "carnivore";
  const v = ((((g.hue % 50) + 50) % 50) - 25) * (carn ? 0.5 : 0.6);
  const baseHue = carn ? 14 + v : 152 + v; // terracotta vs jade
  const baseSat = carn ? 52 : 44;
  return {
    baseHue,
    baseSat,
    hi: hsl(baseHue + 14, baseSat - 8, 75),
    lit: hsl(baseHue + 6, baseSat - 2, 55),
    mid: hsl(baseHue, baseSat, 37),
    core: hsl(baseHue - 8, baseSat, 19),
    shadow: hsl(baseHue - 14, baseSat - 6, 10),
    bounce: hsla(carn ? 32 : 188, 45, 48, 0.3),
    gold: hsl(45, 72, 60),
    goldDark: hsl(40, 64, 33),
    obsidian: "#0a0c11",
    rimHue: carn ? 28 : 176,
    glow: carn ? "hsl(10, 100%, 58%)" : "hsl(150, 90%, 54%)",
  };
}

// --- skeleton ----------------------------------------------------------------

interface BodyDims {
  kind: "ovoid" | "box";
  rx: number;
  ry: number;
}

function bodyDims(part: string, s: number): BodyDims {
  switch (part) {
    case "body_tank":
      return { kind: "box", rx: s * 1.0, ry: s * 0.72 };
    case "body_sleek":
      return { kind: "ovoid", rx: s * 1.32, ry: s * 0.5 };
    case "body_pod":
      return { kind: "ovoid", rx: s * 0.82, ry: s * 0.82 };
    default:
      return { kind: "ovoid", rx: s * 1.02, ry: s * 0.74 };
  }
}

function headRadius(part: string, s: number): number {
  if (part === "head_compact") return s * 0.34;
  return s * 0.4;
}

function groundOffset(part: string, s: number, b: BodyDims): number {
  const wr = Math.min(s * 0.42, b.ry * 0.85);
  switch (part) {
    case "loco_mono":
      return b.ry * 0.52 + s * 0.18 + Math.min(s * 0.62, b.rx * 0.7);
    case "loco_tracks":
      return b.ry * 0.52 + s * 0.42;
    case "loco_legs":
      return b.ry * 0.7 + s * 0.78;
    case "loco_hover":
      return b.ry * 0.7 + s * 0.5;
    default:
      return b.ry * 0.52 + wr;
  }
}

export function drawCreaturePortrait(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  cx: number,
  cy: number,
  opts: PortraitOpts,
): void {
  const s = opts.size;
  const carn = genome.diet === "carnivore";
  const detail = opts.detail ?? 2;
  const pal = palette(genome);
  const rng = new Rng(seedFromGenome(genome));

  const b = bodyDims(genome.parts.body, s);
  const hr = headRadius(genome.parts.head, s);
  const headCx = -(b.rx + hr * 0.5);
  const headCy = -(b.ry * 0.45 + hr * 0.15);
  const neckX = -b.rx * 0.7;
  const neckY = -b.ry * 0.32;

  const groundY = cy + groundOffset(genome.parts.locomotion, s, b);

  if (opts.scene) drawScene(ctx, cx, groundY, opts.viewW ?? s * 3.4, opts.viewH ?? s * 3.4, pal);

  // cast shadow
  ctx.save();
  ctx.translate(cx + s * 0.15, groundY + s * 0.04);
  ctx.scale(1, 0.3);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx * 1.5);
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, b.rx * 1.5, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);

  drawLocomotion(ctx, genome.parts.locomotion, s, b, pal, "behind");
  featheredCrest(ctx, b, pal, rng, carn ? 7 : 4);
  drawNeck(ctx, neckX, neckY, headCx, headCy, hr, pal);
  drawBody(ctx, b, pal, rng, detail);
  // contact shadow the head casts on the body
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(neckX - hr * 0.1, neckY + hr * 0.1, hr * 0.7, hr * 0.5, -0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  drawHead(ctx, genome, headCx, headCy, hr, pal, carn, rng, detail);
  drawLocomotion(ctx, genome.parts.locomotion, s, b, pal, "front");

  ctx.restore();
}

// --- carved hide (the realistic, ornamented surface) -------------------------

function paintHide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pal: Pal,
  rng: Rng,
  detail: number,
  medallion: boolean,
): void {
  const mn = Math.min(rx, ry);
  ctx.save();
  ctx.translate(cx, cy);

  // 1) base form gradient (5 tonal zones)
  ctx.save();
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(LX * 0.62, LY * 0.7, 0.05, -0.05, 0.02, 1.36);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.26, pal.lit);
  g.addColorStop(0.56, pal.mid);
  g.addColorStop(0.82, pal.core);
  g.addColorStop(1, pal.shadow);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  // surface detail clipped to the form
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();

  // 2) cool reflected/bounce light along the bottom
  const bounce = ctx.createLinearGradient(0, ry * 0.15, 0, ry);
  bounce.addColorStop(0, "rgba(0,0,0,0)");
  bounce.addColorStop(1, pal.bounce);
  ctx.fillStyle = bounce;
  ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

  // 3) veining / mottle
  const blobs = Math.round(6 + mn * 0.08);
  for (let i = 0; i < blobs; i++) {
    const a = rng.next() * TAU;
    const rad = Math.sqrt(rng.next());
    const px = Math.cos(a) * rad * rx;
    const py = Math.sin(a) * rad * ry;
    const br = (0.2 + rng.next() * 0.3) * mn;
    const col = rng.chance(0.6)
      ? hsla(pal.baseHue - 6, pal.baseSat, 16, 0.35)
      : hsla(pal.baseHue + 18, pal.baseSat - 6, 58, 0.22);
    const bg = ctx.createRadialGradient(px, py, 0, px, py, br);
    bg.addColorStop(0, col);
    bg.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(px, py, br, 0, TAU);
    ctx.fill();
  }

  // 4) scale relief (Spore-like skin)
  if (detail >= 2) scales(ctx, rx, ry, pal, rng);

  // 5) Aztec ornament
  if (detail >= 1) grecaBand(ctx, rx, ry, pal);
  if (detail >= 2 && medallion) glyphMedallion(ctx, rx * 0.38, -ry * 0.05, mn * 0.4, pal);

  // 6) terminator / core shadow (lower-right)
  const cs = ctx.createRadialGradient(rx * 0.35, ry * 0.4, mn * 0.15, rx * 0.35, ry * 0.4, mn * 1.7);
  cs.addColorStop(0, "rgba(0,0,0,0)");
  cs.addColorStop(1, hsla(pal.baseHue - 12, pal.baseSat, 6, 0.5));
  ctx.fillStyle = cs;
  ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

  // 7) ambient occlusion across the top (under head/neck)
  const ao = ctx.createLinearGradient(0, -ry, 0, -ry * 0.15);
  ao.addColorStop(0, "rgba(0,0,0,0.4)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(-rx, -ry, rx * 2, ry);

  ctx.restore(); // unclip

  // 8) silhouette occlusion ring (soft edge instead of a toy outline)
  ctx.save();
  ctx.scale(rx, ry);
  const edge = ctx.createRadialGradient(0, 0, 0.82, 0, 0, 1.0);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(0.8, "rgba(0,0,0,0)");
  edge.addColorStop(1, hsla(pal.baseHue - 12, pal.baseSat, 5, 0.6));
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 9) fresnel rim: cool/teal on shadow side, gold on lit top
  ctx.save();
  ctx.lineWidth = Math.max(1, mn * 0.045);
  ctx.shadowBlur = mn * 0.3;
  ctx.strokeStyle = hsla(pal.rimHue, 70, 68, 0.5);
  ctx.shadowColor = hsla(pal.rimHue, 80, 60, 0.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.98, ry * 0.98, 0, Math.PI * 0.18, Math.PI * 0.95);
  ctx.stroke();
  ctx.strokeStyle = hsla(46, 85, 74, 0.45);
  ctx.shadowColor = hsla(46, 85, 60, 0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.98, ry * 0.98, 0, Math.PI * 1.05, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();

  // 10) speculars (broad soft + tight hot)
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(LX * rx * 0.7, LY * ry * 0.75, rx * 0.38, ry * 0.26, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(LX * rx * 0.86, LY * ry * 0.86, rx * 0.1, ry * 0.075, -0.5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function scales(ctx: CanvasRenderingContext2D, rx: number, ry: number, pal: Pal, rng: Rng): void {
  const d = Math.min(rx, ry) * 0.28;
  let row = 0;
  for (let y = -ry + d * 0.4; y < ry; y += d * 0.78, row++) {
    const off = (row % 2) * d * 0.5;
    for (let x = -rx + d * 0.4 + off; x < rx; x += d) {
      const jx = x + rng.jitter() * d * 0.14;
      const jy = y + rng.jitter() * d * 0.1;
      const sr = d * 0.52 * (0.85 + rng.next() * 0.3);
      const sg = ctx.createLinearGradient(jx, jy - sr, jx, jy + sr);
      sg.addColorStop(0, hsla(pal.baseHue + 12, pal.baseSat, 64, 0.45));
      sg.addColorStop(0.5, "rgba(0,0,0,0)");
      sg.addColorStop(1, hsla(pal.baseHue - 10, pal.baseSat, 8, 0.4));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(jx - sr, jy + sr * 0.45);
      ctx.quadraticCurveTo(jx, jy - sr * 0.95, jx + sr, jy + sr * 0.45);
      ctx.quadraticCurveTo(jx, jy + sr * 0.25, jx - sr, jy + sr * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function grecaBand(ctx: CanvasRenderingContext2D, rx: number, ry: number, pal: Pal): void {
  const yc = ry * 0.2;
  const h = Math.min(ry * 0.46, rx * 0.34);
  // recessed strip
  ctx.fillStyle = hsla(pal.baseHue - 10, pal.baseSat, 11, 0.5);
  ctx.fillRect(-rx, yc - h / 2, rx * 2, h);
  ctx.fillStyle = hsla(0, 0, 0, 0.18);
  ctx.fillRect(-rx, yc + h / 2 - h * 0.12, rx * 2, h * 0.12);
  // gold rails
  ctx.strokeStyle = pal.goldDark;
  ctx.lineWidth = Math.max(1.5, h * 0.16);
  ctx.beginPath();
  ctx.moveTo(-rx, yc);
  ctx.lineTo(rx, yc);
  ctx.stroke();
  ctx.strokeStyle = pal.gold;
  ctx.lineWidth = Math.max(1, h * 0.1);
  ctx.beginPath();
  ctx.moveTo(-rx, yc - h * 0.04);
  ctx.lineTo(rx, yc - h * 0.04);
  ctx.stroke();
  // stepped teeth (greca)
  const u = h * 0.7;
  for (let x = -rx, i = 0; x < rx; x += u, i++) {
    const up = i % 2 === 0;
    const ty = up ? yc - h * 0.46 : yc + h * 0.04;
    ctx.fillStyle = pal.gold;
    ctx.fillRect(x, ty, u * 0.58, h * 0.42);
    ctx.fillStyle = pal.goldDark;
    ctx.fillRect(x, ty + h * 0.32, u * 0.58, h * 0.1);
    ctx.fillStyle = hsla(46, 80, 80, 0.5);
    ctx.fillRect(x, ty, u * 0.58, h * 0.06);
  }
}

function glyphMedallion(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pal: Pal): void {
  // recessed disc
  ctx.fillStyle = hsla(pal.baseHue - 10, pal.baseSat, 12, 0.6);
  disc(ctx, x, y, r * 1.12);
  // gold outer ring
  ring(ctx, x, y, r * 0.96, r * 0.16, pal.gold, pal.goldDark);
  // sun rays
  ctx.fillStyle = pal.gold;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rxp = x + Math.cos(a) * r * 0.78;
    const ryp = y + Math.sin(a) * r * 0.78;
    ctx.save();
    ctx.translate(rxp, ryp);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, 0);
    ctx.lineTo(r * 0.16, -r * 0.09);
    ctx.lineTo(r * 0.16, r * 0.09);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // obsidian centre with gold pupil-ring + a small step glyph
  ctx.fillStyle = pal.obsidian;
  disc(ctx, x, y, r * 0.42);
  ring(ctx, x, y, r * 0.42, r * 0.07, pal.gold, pal.goldDark);
  ctx.fillStyle = pal.gold;
  ctx.fillRect(x - r * 0.12, y - r * 0.04, r * 0.24, r * 0.08);
  ctx.fillRect(x - r * 0.04, y - r * 0.16, r * 0.08, r * 0.32);
}

function featheredCrest(ctx: CanvasRenderingContext2D, b: BodyDims, pal: Pal, rng: Rng, count: number): void {
  for (let i = 0; i < count; i++) {
    const t = 0.12 + (i / Math.max(1, count - 1)) * 0.62;
    const a = -Math.PI / 2 + t * Math.PI * 0.9;
    const bx = Math.cos(a) * b.rx * 0.9;
    const by = Math.sin(a) * b.ry * 0.9;
    const len = (0.5 + rng.next() * 0.35) * b.ry + b.ry * 0.3;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const tipx = bx + nx * len;
    const tipy = by + ny * len - len * 0.15;
    const perp = a + Math.PI / 2;
    const w = b.ry * 0.16;
    // plume gradient base(dark) -> tip(accent)
    const tipHue = i % 2 === 0 ? pal.baseHue + 20 : 46;
    const g = ctx.createLinearGradient(bx, by, tipx, tipy);
    g.addColorStop(0, hsl(pal.baseHue - 8, pal.baseSat, 18));
    g.addColorStop(0.6, hsl(pal.baseHue + 6, pal.baseSat, 40));
    g.addColorStop(1, hsl(tipHue, 70, 60));
    ctx.fillStyle = g;
    ctx.strokeStyle = hsl(pal.baseHue - 12, pal.baseSat, 10);
    ctx.lineWidth = Math.max(1, b.ry * 0.015);
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(perp) * w, by + Math.sin(perp) * w);
    ctx.quadraticCurveTo(
      bx + nx * len * 0.5 + Math.cos(perp) * w * 1.3,
      by + ny * len * 0.5 + Math.sin(perp) * w * 1.3,
      tipx,
      tipy,
    );
    ctx.quadraticCurveTo(
      bx + nx * len * 0.5 - Math.cos(perp) * w * 1.3,
      by + ny * len * 0.5 - Math.sin(perp) * w * 1.3,
      bx - Math.cos(perp) * w,
      by - Math.sin(perp) * w,
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // central vane
    ctx.strokeStyle = hsla(46, 80, 70, 0.5);
    ctx.lineWidth = Math.max(1, b.ry * 0.02);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tipx, tipy);
    ctx.stroke();
  }
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, w: number, light: string, dark: string): void {
  ctx.strokeStyle = dark;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = light;
  ctx.lineWidth = w * 0.55;
  ctx.beginPath();
  ctx.arc(x, y, r - w * 0.18, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

// --- body --------------------------------------------------------------------

function drawBody(ctx: CanvasRenderingContext2D, b: BodyDims, pal: Pal, rng: Rng, detail: number): void {
  if (b.kind === "box") {
    drawBox(ctx, 0, -b.ry * 0.05, b.rx, b.ry * 0.95, Math.min(b.rx, b.ry) * 0.7, pal, rng, detail);
  } else {
    paintHide(ctx, 0, 0, b.rx, b.ry, pal, rng, detail, true);
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  pal: Pal,
  rng: Rng,
  detail: number,
): void {
  const dx = depth * 0.7;
  const dy = -depth * 0.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.shadow;
  ctx.lineWidth = Math.max(1, rx * 0.03);

  // side face
  ctx.fillStyle = pal.core;
  ctx.beginPath();
  ctx.moveTo(cx + rx, cy - ry);
  ctx.lineTo(cx + rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx + dx, cy + ry + dy);
  ctx.lineTo(cx + rx, cy + ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // top face
  ctx.fillStyle = pal.lit;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - ry);
  ctx.lineTo(cx - rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx, cy - ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // front face
  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, pal.lit);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.core);
  ctx.fillStyle = g;
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.16);
  ctx.fill();
  // detail clipped to the front face
  ctx.save();
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.16);
  ctx.clip();
  ctx.translate(cx, cy);
  if (detail >= 2) scales(ctx, rx, ry, pal, rng);
  if (detail >= 1) grecaBand(ctx, rx, ry, pal);
  if (detail >= 2) glyphMedallion(ctx, rx * 0.4, -ry * 0.05, Math.min(rx, ry) * 0.4, pal);
  // AO top
  const ao = ctx.createLinearGradient(0, -ry, 0, 0);
  ao.addColorStop(0, "rgba(0,0,0,0.4)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(-rx, -ry, rx * 2, ry);
  ctx.restore();
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.16);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.4, cy - ry * 0.5, rx * 0.4, ry * 0.22, -0.3, 0, TAU);
  ctx.fill();
}

// --- neck --------------------------------------------------------------------

function drawNeck(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, hr: number, pal: Pal): void {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  const w0 = hr * 0.72;
  const w1 = hr * 0.5;
  const g = ctx.createLinearGradient(x0, y0 - w0, x0, y0 + w0);
  g.addColorStop(0, pal.lit);
  g.addColorStop(1, pal.core);
  ctx.fillStyle = g;
  ctx.strokeStyle = pal.shadow;
  ctx.lineWidth = Math.max(1, hr * 0.07);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // gold collar rings
  ctx.strokeStyle = pal.gold;
  ctx.lineWidth = Math.max(1, hr * 0.07);
  for (const f of [0.45, 0.75]) {
    const mx = x0 + (x1 - x0) * f;
    const my = y0 + (y1 - y0) * f;
    const w = w0 + (w1 - w0) * f;
    ctx.beginPath();
    ctx.moveTo(mx + nx * w, my + ny * w);
    ctx.lineTo(mx - nx * w, my - ny * w);
    ctx.stroke();
  }
}

// --- locomotion --------------------------------------------------------------

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pal: Pal, dim = 1): void {
  const dx = r * 0.26;
  const dy = -r * 0.12;
  ctx.fillStyle = "#0d1014";
  ctx.beginPath();
  ctx.ellipse(x + dx, y + dy, r, r, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#15181d";
  ctx.lineWidth = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.5);
  ctx.lineTo(x + dx, y + dy + r * 0.5);
  ctx.stroke();
  // obsidian tyre
  metalSphere(ctx, x, y, r, shade("#3a4250", dim), shade("#181c24", dim), 0.3);
  // carved stone rim
  metalSphere(ctx, x, y, r * 0.6, shade("#9a8f74", dim), shade("#4a4334", dim), 0.4);
  // gold hub
  ctx.fillStyle = pal.gold;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.goldDark;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.1, 0, TAU);
  ctx.fill();
  // spokes as carved notches
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.24, y + Math.sin(a) * r * 0.24);
    ctx.lineTo(x + Math.cos(a) * r * 0.54, y + Math.sin(a) * r * 0.54);
    ctx.stroke();
  }
}

function metalSphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, light: string, dark: string, spec: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r, r);
  const g = ctx.createRadialGradient(LX * 0.6, LY * 0.6, 0.05, 0, 0, 1.2);
  g.addColorStop(0, light);
  g.addColorStop(0.6, dark);
  g.addColorStop(1, "#0a0d11");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (spec > 0) {
    ctx.fillStyle = `rgba(255,255,255,${spec})`;
    ctx.beginPath();
    ctx.ellipse(cx + LX * r * 0.7, cy + LY * r * 0.7, r * 0.2, r * 0.15, -0.5, 0, TAU);
    ctx.fill();
  }
}

function shade(hexish: string, dim: number): string {
  if (dim >= 1) return hexish;
  const m = hexish.match(/^#(..)(..)(..)$/);
  if (!m) return hexish;
  const f = (h: string) => Math.round(parseInt(h, 16) * dim).toString(16).padStart(2, "0");
  return `#${f(m[1])}${f(m[2])}${f(m[3])}`;
}

function drawLocomotion(ctx: CanvasRenderingContext2D, part: string, s: number, b: BodyDims, pal: Pal, layer: "behind" | "front"): void {
  const wr = Math.min(s * 0.42, b.ry * 0.85);
  const axleY = b.ry * 0.52;
  const frontX = -b.rx * 0.45;
  const backX = b.rx * 0.5;
  switch (part) {
    case "loco_bigwheels":
      if (layer === "behind") wheel(ctx, backX, axleY, wr, pal, 0.7);
      else wheel(ctx, frontX, axleY, wr, pal);
      break;
    case "loco_mono":
      if (layer === "front") wheel(ctx, -b.rx * 0.05, axleY + s * 0.18, Math.min(s * 0.62, b.rx * 0.7), pal);
      break;
    case "loco_tracks":
      if (layer === "front") {
        const ty = axleY + s * 0.12;
        ctx.fillStyle = "#15181e";
        roundRectPath(ctx, -b.rx * 1.02, ty - s * 0.3, b.rx * 2.04, s * 0.6, s * 0.3);
        ctx.fill();
        ctx.strokeStyle = pal.goldDark;
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.24, ty - s * 0.26);
          ctx.lineTo(i * s * 0.24, ty + s * 0.26);
          ctx.stroke();
        }
        wheel(ctx, -b.rx * 0.62, ty, s * 0.26, pal);
        wheel(ctx, b.rx * 0.62, ty, s * 0.26, pal);
      }
      break;
    case "loco_legs": {
      const feetY = b.ry * 0.7 + s * 0.78;
      const legs: [number, boolean][] = [[-0.55, true], [0.05, true], [-0.3, false], [0.4, false]];
      for (const [lx, front] of legs) {
        if ((layer === "front") !== front) continue;
        drawLeg(ctx, lx * b.rx, b.ry * 0.5, lx * b.rx + s * 0.16, feetY, s, front, pal);
      }
      break;
    }
    case "loco_hover":
      if (layer === "front") {
        const hy = b.ry * 0.7;
        const g = ctx.createLinearGradient(0, hy, 0, hy + s * 0.7);
        g.addColorStop(0, hsla(pal.rimHue, 80, 65, 0.6));
        g.addColorStop(1, hsla(pal.rimHue, 80, 65, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-b.rx * 0.95, hy);
        ctx.lineTo(b.rx * 0.95, hy);
        ctx.lineTo(b.rx * 0.55, hy + s * 0.7);
        ctx.lineTo(-b.rx * 0.55, hy + s * 0.7);
        ctx.closePath();
        ctx.fill();
        metalSphere(ctx, 0, hy, b.rx * 0.9, "#cfeeff", "#3f8fd0", 0.4);
      }
      break;
  }
}

function drawLeg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, kneeX: number, footX: number, s: number, front: boolean, pal: Pal): void {
  const kneeY = hipY + s * 0.78 * 0.5;
  const footY = hipY + s * 0.92;
  const col = front ? pal.mid : pal.core;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, s * (front ? 0.14 : 0.1));
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  ctx.fillStyle = pal.gold;
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, s * (front ? 0.07 : 0.05), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(footX, footY);
  ctx.lineTo(footX - s * 0.12, footY + s * 0.06);
  ctx.moveTo(footX, footY);
  ctx.lineTo(footX + s * 0.06, footY + s * 0.08);
  ctx.stroke();
}

// --- head --------------------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  hx: number,
  hy: number,
  hr: number,
  pal: Pal,
  carn: boolean,
  rng: Rng,
  detail: number,
): void {
  // antennae / sensors
  ctx.strokeStyle = pal.goldDark;
  ctx.lineWidth = Math.max(1, hr * 0.12);
  ctx.lineCap = "round";
  if (genome.parts.head === "head_antenna") {
    for (const a of [-0.45, 0.2]) {
      const tx = hx + a * hr;
      const ty = hy - hr * 1.55;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr, hy - hr * 0.75);
      ctx.quadraticCurveTo(tx - hr * 0.2, hy - hr * 1.1, tx, ty);
      ctx.stroke();
      glowOrb(ctx, tx, ty, hr * 0.2, pal.glow);
    }
  } else if (genome.parts.head === "head_sensor") {
    for (const a of [-0.5, 0, 0.5]) {
      const tx = hx + a * hr * 0.8;
      const ty = hy - hr * 1.32;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr * 0.65, hy - hr * 0.7);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      glowOrb(ctx, tx, ty, hr * 0.13, pal.glow);
    }
  }

  if (genome.parts.head === "head_blunt") {
    drawBox(ctx, hx, hy, hr * 0.95, hr * 0.88, hr * 0.55, pal, rng, Math.min(detail, 1));
  } else {
    paintHide(ctx, hx, hy, hr, hr * (genome.parts.head === "head_compact" ? 0.9 : 1), pal, rng, Math.min(detail, 1), false);
    // brow ridge (gold) for a mask-like face
    ctx.strokeStyle = hsla(46, 70, 55, 0.7);
    ctx.lineWidth = Math.max(1, hr * 0.09);
    ctx.beginPath();
    ctx.arc(hx - hr * 0.2, hy - hr * 0.05, hr * 0.6, Math.PI * 0.85, Math.PI * 1.5);
    ctx.stroke();
  }

  drawMouth(ctx, genome.parts.mouth, hx, hy, hr, carn);
  drawEyes(ctx, genome.parts.eyes, hx, hy, hr, pal);
}

/** Gold-ringed obsidian eye with a glowing core. */
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pal: Pal): void {
  // gold bezel
  ctx.fillStyle = pal.gold;
  disc(ctx, x, y, r * 1.32);
  ctx.fillStyle = pal.goldDark;
  disc(ctx, x, y, r * 1.16);
  // obsidian
  metalSphere(ctx, x, y, r * 1.05, "#3b4350", "#0b0d12", 0.0);
  // glowing core
  const core = ctx.createRadialGradient(x, y, 0, x, y, r * 0.8);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.35, pal.glow);
  core.addColorStop(1, pal.glow.replace("hsl", "hsla").replace(")", ", 0)"));
  ctx.fillStyle = core;
  disc(ctx, x, y, r * 0.8);
  // hot spec
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  disc(ctx, x - r * 0.3, y - r * 0.32, r * 0.16);
}

function glowOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  halo.addColorStop(0, color.replace("hsl", "hsla").replace(")", ", 0.5)"));
  halo.addColorStop(1, color.replace("hsl", "hsla").replace(")", ", 0)"));
  ctx.fillStyle = halo;
  disc(ctx, x, y, r * 2.6);
  ctx.fillStyle = "#0a0d12";
  disc(ctx, x, y, r * 1.1);
  const core = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.4, color);
  core.addColorStop(1, color.replace("hsl", "hsla").replace(")", ", 0.5)"));
  ctx.fillStyle = core;
  disc(ctx, x, y, r);
}

function drawEyes(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number, pal: Pal): void {
  const ex = hx - hr * 0.3;
  const ey = hy - hr * 0.12;
  switch (part) {
    case "eyes_telescopic":
      ctx.strokeStyle = pal.goldDark;
      ctx.lineWidth = Math.max(1, hr * 0.14);
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.1, hy - hr * 0.3);
      ctx.lineTo(ex - hr * 0.15, ey - hr * 0.6);
      ctx.stroke();
      eye(ctx, ex - hr * 0.15, ey - hr * 0.6, hr * 0.24, pal);
      break;
    case "eyes_compound":
      for (const [dx, dy] of [[0, -0.16], [-0.26, 0.0], [0.16, 0.06], [-0.12, 0.26], [0.3, -0.12]]) {
        eye(ctx, ex + dx * hr, ey + dy * hr, hr * 0.13, pal);
      }
      break;
    case "eyes_night":
      eye(ctx, ex, ey, hr * 0.36, pal);
      break;
    case "eyes_basic":
    default:
      eye(ctx, ex, ey, hr * 0.22, pal);
      eye(ctx, ex + hr * 0.42, ey + hr * 0.08, hr * 0.17, pal);
      break;
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number, carn: boolean): void {
  const mx = hx - hr * 0.82;
  const my = hy + hr * 0.45;
  switch (part) {
    case "mouth_shear":
    case "mouth_fangs": {
      ctx.fillStyle = "#120a0a";
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.04, my, hr * 0.3, hr * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#cdd4dd";
      ctx.strokeStyle = "#5a626d";
      ctx.lineWidth = Math.max(1, hr * 0.04);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(mx + hr * 0.16, my + dir * hr * 0.28);
        ctx.quadraticCurveTo(mx - hr * 0.34, my + dir * hr * 0.34, mx - hr * 0.44, my + dir * hr * 0.05);
        ctx.quadraticCurveTo(mx - hr * 0.2, my + dir * hr * 0.12, mx + hr * 0.16, my + dir * hr * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#eef2f7";
      const n = part === "mouth_shear" ? 4 : 3;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ty = my - hr * 0.16 + (i * hr * 0.32) / (n - 1);
        ctx.moveTo(mx + hr * 0.14, ty - hr * 0.05);
        ctx.lineTo(mx - hr * 0.1, ty);
        ctx.lineTo(mx + hr * 0.14, ty + hr * 0.05);
      }
      ctx.fill();
      break;
    }
    case "mouth_beak":
      ctx.fillStyle = "#d8c062";
      ctx.strokeStyle = "#7a6320";
      ctx.lineWidth = Math.max(1, hr * 0.05);
      ctx.beginPath();
      ctx.moveTo(mx - hr * 0.28, my - hr * 0.04);
      ctx.lineTo(mx + hr * 0.22, my - hr * 0.22);
      ctx.lineTo(mx + hr * 0.22, my + hr * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    default:
      ctx.fillStyle = "#15100f";
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.05, my, hr * 0.26, hr * 0.15, -0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = carn ? "rgba(255,120,90,0.4)" : "rgba(120,220,160,0.35)";
      ctx.lineWidth = Math.max(1, hr * 0.06);
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.05, my, hr * 0.26, hr * 0.15, -0.2, 0, TAU);
      ctx.stroke();
      break;
  }
}

// --- scene -------------------------------------------------------------------

function drawScene(ctx: CanvasRenderingContext2D, cx: number, horizonY: number, w: number, h: number, pal: Pal): void {
  const bg = ctx.createLinearGradient(0, horizonY - h, 0, horizonY);
  bg.addColorStop(0, "#0b1019");
  bg.addColorStop(1, "#14202f");
  ctx.fillStyle = bg;
  ctx.fillRect(cx - w, horizonY - h, w * 2, h);

  const rows = 9;
  const cols = 10;
  const maxHalf = w * 0.95;
  const floorH = h * 0.9;
  const pt = (i: number, j: number) => {
    const depth = Math.pow(i / rows, 2);
    const y = horizonY + depth * floorH;
    const half = maxHalf * depth;
    const x = cx + ((j - cols / 2) / (cols / 2)) * half;
    return [x, y] as const;
  };
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const [x0, y0] = pt(i, j);
      const [x1] = pt(i, j + 1);
      const [x2, y2] = pt(i + 1, j + 1);
      const [x3] = pt(i + 1, j);
      // sandstone vs shadow checker, faint gold seams
      ctx.fillStyle = (i + j) % 2 === 0 ? "#26303a" : "#1a232e";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y2);
      ctx.closePath();
      ctx.fill();
    }
  }
  const glow = ctx.createLinearGradient(0, horizonY - h * 0.12, 0, horizonY + h * 0.1);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(1, hsl(pal.baseHue, 25, 11));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w, horizonY - h * 0.12, w * 2, h * 0.22);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}
