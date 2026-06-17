/**
 * Draws a creature as a pre-rendered, late-90s-style 3D portrait with an
 * organic, biomechanical-alien surface: iridescent mottled flesh, carapace
 * segmentation, chitinous spines, glowing eyes and a fresnel rim light, on a
 * checkerboard "studio" floor.
 *
 * Built on a consistent skeleton (body mass, head on a neck, axle for the
 * locomotion) so every part combination places correctly. Faces left, lit from
 * the upper-left. Drawn centred on (cx, cy); `size` is the base unit.
 *
 * Surface texture is seeded from the genome, so a given creature always looks
 * the same (no shimmer between frames in the animated preview).
 */
import { Genome } from "../sim/genome";
import { Rng } from "../sim/rng";

interface PortraitOpts {
  size: number;
  scene?: boolean;
  viewW?: number;
  viewH?: number;
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
  const hue = genome.hue;
  const sat = carn ? 60 : 48;
  const accent = hsl(hue + 35 + genome.accent * 40, 70, 60);
  const rng = new Rng(seedFromGenome(genome));

  const b = bodyDims(genome.parts.body, s);
  const hr = headRadius(genome.parts.head, s);
  const headCx = -(b.rx + hr * 0.5);
  const headCy = -(b.ry * 0.45 + hr * 0.15);
  const neckX = -b.rx * 0.7;
  const neckY = -b.ry * 0.32;

  const groundY = cy + groundOffset(genome.parts.locomotion, s, b);

  if (opts.scene) drawScene(ctx, cx, groundY, opts.viewW ?? s * 3.4, opts.viewH ?? s * 3.4, hue);

  // cast shadow
  ctx.save();
  ctx.translate(cx + s * 0.15, groundY + s * 0.04);
  ctx.scale(1, 0.3);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx * 1.5);
  sh.addColorStop(0, "rgba(0,0,0,0.5)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, b.rx * 1.5, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);

  drawLocomotion(ctx, genome.parts.locomotion, s, b, accent, "behind");
  drawNeck(ctx, neckX, neckY, headCx, headCy, hr, hue, sat);
  drawBody(ctx, b, hue, sat, rng, carn);
  drawHead(ctx, genome, headCx, headCy, hr, hue, sat, carn, rng);
  drawLocomotion(ctx, genome.parts.locomotion, s, b, accent, "front");

  ctx.restore();
}

// --- organic flesh -----------------------------------------------------------

/**
 * Paints a shaded, mottled, iridescent ellipsoid "flesh" volume with a fresnel
 * rim and specular — the core of the alien look. Texture uses the supplied rng.
 */
function paintFlesh(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  hue: number,
  sat: number,
  rng: Rng,
  segments: number,
): void {
  const mn = Math.min(rx, ry);
  ctx.save();
  ctx.translate(cx, cy);

  // base iridescent gradient
  ctx.save();
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(LX * 0.7, LY * 0.7, 0.05, -0.1, -0.05, 1.3);
  g.addColorStop(0, hsl(hue + 18, sat - 4, 80));
  g.addColorStop(0.45, hsl(hue, sat, 47));
  g.addColorStop(0.85, hsl(hue - 10, sat - 6, 27));
  g.addColorStop(1, hsl(hue - 16, sat - 12, 18));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();

  // texture, clipped to the ellipse
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();

  // soft mottled blotches
  const blobs = Math.round(10 + mn * 0.18);
  for (let i = 0; i < blobs; i++) {
    const a = rng.next() * TAU;
    const rad = Math.sqrt(rng.next());
    const px = Math.cos(a) * rad * rx;
    const py = Math.sin(a) * rad * ry;
    const br = (0.16 + rng.next() * 0.3) * mn;
    const darker = rng.chance(0.55);
    const col = darker
      ? hsla(hue + rng.jitter() * 18, sat, 26 + rng.next() * 10, 0.4)
      : hsla(hue + 22 + rng.jitter() * 24, sat - 8, 60 + rng.next() * 12, 0.32);
    const fade = col.replace(/[\d.]+\)$/, "0)");
    const bg = ctx.createRadialGradient(px, py, 0, px, py, br);
    bg.addColorStop(0, col);
    bg.addColorStop(1, fade);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(px, py, br, 0, TAU);
    ctx.fill();
  }

  // carapace segmentation grooves (across the short axis)
  for (let k = 1; k <= segments; k++) {
    const sx = (-0.55 + (k / (segments + 1)) * 1.5) * rx;
    ctx.lineWidth = Math.max(1, mn * 0.05);
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(sx, -ry * 0.92);
    ctx.quadraticCurveTo(sx + rx * 0.08, 0, sx, ry * 0.92);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, mn * 0.03);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(sx - mn * 0.06, -ry * 0.9);
    ctx.quadraticCurveTo(sx + rx * 0.08 - mn * 0.06, 0, sx - mn * 0.06, ry * 0.9);
    ctx.stroke();
  }
  ctx.restore();

  // fresnel rim light on the shadow edge (cool, emissive)
  ctx.save();
  ctx.shadowColor = hsla(hue + 150, 70, 62, 0.8);
  ctx.shadowBlur = mn * 0.35;
  ctx.strokeStyle = hsla(hue + 150, 75, 64, 0.55);
  ctx.lineWidth = Math.max(1, mn * 0.05);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.97, ry * 0.97, 0, Math.PI * 0.12, Math.PI * 0.98);
  ctx.stroke();
  ctx.restore();

  // outline + specular
  ctx.lineWidth = Math.max(1, mn * 0.045);
  ctx.strokeStyle = hsl(hue - 14, sat - 12, 14);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(LX * rx * 0.8, LY * ry * 0.8, rx * 0.16, ry * 0.12, -0.5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

/** Chitinous spines along the upper-back of the body. */
function drawSpines(ctx: CanvasRenderingContext2D, b: BodyDims, count: number, hue: number, sat: number, rng: Rng): void {
  for (let i = 0; i < count; i++) {
    const t = 0.15 + (i / Math.max(1, count - 1)) * 0.6; // along the top-right curve
    const a = -Math.PI / 2 + t * Math.PI * 0.85;
    const bx = Math.cos(a) * b.rx * 0.92;
    const by = Math.sin(a) * b.ry * 0.92;
    const len = (0.18 + rng.next() * 0.16) * b.ry + b.ry * 0.2;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const tipx = bx + nx * len;
    const tipy = by + ny * len;
    const perp = a + Math.PI / 2;
    const w = b.ry * 0.12;
    ctx.fillStyle = hsl(hue - 10, sat - 6, 30);
    ctx.strokeStyle = hsl(hue - 16, sat - 14, 14);
    ctx.lineWidth = Math.max(1, b.ry * 0.02);
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(perp) * w, by + Math.sin(perp) * w);
    ctx.lineTo(tipx, tipy);
    ctx.lineTo(bx - Math.cos(perp) * w, by - Math.sin(perp) * w);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// --- body --------------------------------------------------------------------

function drawBody(ctx: CanvasRenderingContext2D, b: BodyDims, hue: number, sat: number, rng: Rng, carn: boolean): void {
  if (b.kind === "box") {
    drawBox(ctx, 0, -b.ry * 0.05, b.rx, b.ry * 0.95, Math.min(b.rx, b.ry) * 0.7, hue, sat, rng);
  } else {
    // spines behind the body mass
    drawSpines(ctx, b, carn ? 6 : 3, hue, sat, rng);
    paintFlesh(ctx, 0, 0, b.rx, b.ry, hue, sat, rng, 2);
  }
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depth: number,
  hue: number,
  sat: number,
  rng: Rng,
): void {
  const dx = depth * 0.7;
  const dy = -depth * 0.5;
  const outline = hsl(hue, sat - 10, 14);
  ctx.lineWidth = Math.max(1, rx * 0.04);
  ctx.strokeStyle = outline;
  ctx.lineJoin = "round";

  ctx.fillStyle = hsl(hue, sat - 6, 30);
  ctx.beginPath();
  ctx.moveTo(cx + rx, cy - ry);
  ctx.lineTo(cx + rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx + dx, cy + ry + dy);
  ctx.lineTo(cx + rx, cy + ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hsl(hue + 10, sat, 74);
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - ry);
  ctx.lineTo(cx - rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx + dx, cy - ry + dy);
  ctx.lineTo(cx + rx, cy - ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  g.addColorStop(0, hsl(hue + 8, sat, 60));
  g.addColorStop(1, hsl(hue - 6, sat - 4, 34));
  ctx.fillStyle = g;
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.18);
  ctx.fill();
  // mottle on the front face
  ctx.save();
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.18);
  ctx.clip();
  const blobs = 10;
  for (let i = 0; i < blobs; i++) {
    const px = cx + (rng.next() * 2 - 1) * rx;
    const py = cy + (rng.next() * 2 - 1) * ry;
    const br = (0.15 + rng.next() * 0.25) * Math.min(rx, ry);
    const col = hsla(hue + rng.jitter() * 20, sat, rng.chance(0.5) ? 30 : 58, 0.28);
    const bg = ctx.createRadialGradient(px, py, 0, px, py, br);
    bg.addColorStop(0, col);
    bg.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(px, py, br, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  roundRectPath(ctx, cx - rx, cy - ry, rx * 2, ry * 2, Math.min(rx, ry) * 0.18);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.5, ry * 0.28, -0.3, 0, TAU);
  ctx.fill();
}

// --- neck --------------------------------------------------------------------

function drawNeck(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hr: number,
  hue: number,
  sat: number,
): void {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  const w0 = hr * 0.7;
  const w1 = hr * 0.52;
  const g = ctx.createLinearGradient(x0, y0 - w0, x0, y0 + w0);
  g.addColorStop(0, hsl(hue + 8, sat, 58));
  g.addColorStop(1, hsl(hue - 8, sat - 6, 30));
  ctx.fillStyle = g;
  ctx.strokeStyle = hsl(hue - 12, sat - 12, 14);
  ctx.lineWidth = Math.max(1, hr * 0.09);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // segment rings on the neck
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = Math.max(1, hr * 0.05);
  for (const f of [0.4, 0.7]) {
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

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string, dim = 1): void {
  const dx = r * 0.26;
  const dy = -r * 0.12;
  ctx.fillStyle = "#13171d";
  ctx.beginPath();
  ctx.ellipse(x + dx, y + dy, r, r, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#1b2027";
  ctx.lineWidth = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.5);
  ctx.lineTo(x + dx, y + dy + r * 0.5);
  ctx.stroke();
  metalSphere(ctx, x, y, r, shade("#5b6470", dim), shade("#363d47", dim), 0.3);
  metalSphere(ctx, x, y, r * 0.58, shade("#c8cfda", dim), shade("#7c8693", dim), 0.5);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52);
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
  g.addColorStop(1, "#10141a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (spec > 0) {
    ctx.fillStyle = `rgba(255,255,255,${spec})`;
    ctx.beginPath();
    ctx.ellipse(cx + LX * r * 0.7, cy + LY * r * 0.7, r * 0.22, r * 0.16, -0.5, 0, TAU);
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

function drawLocomotion(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  b: BodyDims,
  accent: string,
  layer: "behind" | "front",
): void {
  const wr = Math.min(s * 0.42, b.ry * 0.85);
  const axleY = b.ry * 0.52;
  const frontX = -b.rx * 0.45;
  const backX = b.rx * 0.5;

  switch (part) {
    case "loco_bigwheels":
      if (layer === "behind") wheel(ctx, backX, axleY, wr, accent, 0.75);
      else wheel(ctx, frontX, axleY, wr, accent);
      break;
    case "loco_mono":
      if (layer === "front") wheel(ctx, -b.rx * 0.05, axleY + s * 0.18, Math.min(s * 0.62, b.rx * 0.7), accent);
      break;
    case "loco_tracks":
      if (layer === "front") {
        const ty = axleY + s * 0.12;
        ctx.fillStyle = "#1d222a";
        roundRectPath(ctx, -b.rx * 1.02, ty - s * 0.3, b.rx * 2.04, s * 0.6, s * 0.3);
        ctx.fill();
        ctx.strokeStyle = "#0b0e13";
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.24, ty - s * 0.26);
          ctx.lineTo(i * s * 0.24, ty + s * 0.26);
          ctx.stroke();
        }
        wheel(ctx, -b.rx * 0.62, ty, s * 0.26, accent);
        wheel(ctx, b.rx * 0.62, ty, s * 0.26, accent);
      }
      break;
    case "loco_legs": {
      const feetY = b.ry * 0.7 + s * 0.78;
      const legs: [number, boolean][] = [
        [-0.55, true],
        [0.05, true],
        [-0.3, false],
        [0.4, false],
      ];
      for (const [lx, front] of legs) {
        if ((layer === "front") !== front) continue;
        drawLeg(ctx, lx * b.rx, b.ry * 0.5, lx * b.rx + s * 0.16, feetY, s, front);
      }
      break;
    }
    case "loco_hover":
      if (layer === "front") {
        const hy = b.ry * 0.7;
        const g = ctx.createLinearGradient(0, hy, 0, hy + s * 0.7);
        g.addColorStop(0, "rgba(150,210,255,0.6)");
        g.addColorStop(1, "rgba(120,200,255,0)");
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

/** A chitinous, jointed alien leg (thigh + shin + foot). */
function drawLeg(ctx: CanvasRenderingContext2D, hipX: number, hipY: number, kneeX: number, footX: number, s: number, front: boolean): void {
  const kneeY = hipY + (s * 0.78) * 0.5;
  const footY = hipY + s * 0.92;
  const col = front ? "#5a6472" : "#3c4450";
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, s * (front ? 0.13 : 0.1));
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  // joint + clawed foot
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, s * (front ? 0.08 : 0.06), 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(footX, footY);
  ctx.lineTo(footX - s * 0.12, footY + s * 0.06);
  ctx.moveTo(footX, footY);
  ctx.lineTo(footX + s * 0.06, footY + s * 0.08);
  ctx.stroke();
}

// --- head, eyes, mouth -------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  hx: number,
  hy: number,
  hr: number,
  hue: number,
  sat: number,
  carn: boolean,
  rng: Rng,
): void {
  // antennae / sensors behind the head
  ctx.strokeStyle = hsl(hue - 12, sat - 8, 24);
  ctx.lineWidth = Math.max(1, hr * 0.13);
  ctx.lineCap = "round";
  if (genome.parts.head === "head_antenna") {
    for (const a of [-0.45, 0.2]) {
      const tx = hx + a * hr;
      const ty = hy - hr * 1.55;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr, hy - hr * 0.75);
      ctx.quadraticCurveTo(tx - hr * 0.2, hy - hr * 1.1, tx, ty);
      ctx.stroke();
      glowOrb(ctx, tx, ty, hr * 0.2, hsl(hue + 60, 90, 60));
    }
  } else if (genome.parts.head === "head_sensor") {
    for (const a of [-0.5, 0, 0.5]) {
      const tx = hx + a * hr * 0.8;
      const ty = hy - hr * 1.32;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr * 0.65, hy - hr * 0.7);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      glowOrb(ctx, tx, ty, hr * 0.14, hsl(hue + 150, 90, 62));
    }
  }

  if (genome.parts.head === "head_blunt") {
    drawBox(ctx, hx, hy, hr * 0.95, hr * 0.88, hr * 0.55, hue, sat, rng);
  } else {
    paintFlesh(ctx, hx, hy, hr, hr * (genome.parts.head === "head_compact" ? 0.9 : 1), hue, sat, rng, 0);
  }

  drawMouth(ctx, genome.parts.mouth, hx, hy, hr, carn);
  drawEyes(ctx, genome.parts.eyes, hx, hy, hr, carn);
}

/** A glowing emissive orb (alien eye / sensor tip) with bloom. */
function glowOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  halo.addColorStop(0, color.replace("hsl", "hsla").replace(")", ", 0.55)"));
  halo.addColorStop(1, color.replace("hsl", "hsla").replace(")", ", 0)"));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, TAU);
  ctx.fill();
  // dark socket
  ctx.fillStyle = "#0a0d12";
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, 0, TAU);
  ctx.fill();
  // glowing core
  const core = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  core.addColorStop(0, "#ffffff");
  core.addColorStop(0.4, color);
  core.addColorStop(1, color.replace("hsl", "hsla").replace(")", ", 0.5)"));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawEyes(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number, carn: boolean): void {
  const glow = carn ? "hsl(8, 100%, 56%)" : "hsl(140, 90%, 52%)";
  const ex = hx - hr * 0.32;
  const ey = hy - hr * 0.16;
  switch (part) {
    case "eyes_telescopic": {
      ctx.strokeStyle = "#2b313b";
      ctx.lineWidth = Math.max(1, hr * 0.14);
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.1, hy - hr * 0.3);
      ctx.lineTo(ex - hr * 0.15, ey - hr * 0.6);
      ctx.stroke();
      glowOrb(ctx, ex - hr * 0.15, ey - hr * 0.6, hr * 0.26, glow);
      break;
    }
    case "eyes_compound":
      for (const [dx, dy] of [[0, -0.16], [-0.26, 0.0], [0.16, 0.06], [-0.12, 0.26], [0.3, -0.12]]) {
        glowOrb(ctx, ex + dx * hr, ey + dy * hr, hr * 0.15, glow);
      }
      break;
    case "eyes_night":
      glowOrb(ctx, ex, ey, hr * 0.4, glow);
      break;
    case "eyes_basic":
    default:
      glowOrb(ctx, ex, ey, hr * 0.24, glow);
      glowOrb(ctx, ex + hr * 0.42, ey + hr * 0.08, hr * 0.18, glow);
      break;
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number, carn: boolean): void {
  const mx = hx - hr * 0.82;
  const my = hy + hr * 0.45;
  switch (part) {
    case "mouth_shear":
    case "mouth_fangs": {
      // dark maw
      ctx.fillStyle = "#120a0a";
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.04, my, hr * 0.3, hr * 0.34, 0, 0, TAU);
      ctx.fill();
      // mandibles (chitin pincers)
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
      // teeth
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
    default: {
      // soft alien maw — a dark slit with a faint inner glow
      ctx.fillStyle = "#15100f";
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.05, my, hr * 0.26, hr * 0.16, -0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = carn ? "rgba(255,120,90,0.4)" : "rgba(120,220,160,0.35)";
      ctx.lineWidth = Math.max(1, hr * 0.06);
      ctx.beginPath();
      ctx.ellipse(mx + hr * 0.05, my, hr * 0.26, hr * 0.16, -0.2, 0, TAU);
      ctx.stroke();
      break;
    }
  }
}

// --- scene -------------------------------------------------------------------

function drawScene(ctx: CanvasRenderingContext2D, cx: number, horizonY: number, w: number, h: number, hue: number): void {
  const bg = ctx.createLinearGradient(0, horizonY - h, 0, horizonY);
  bg.addColorStop(0, "#0c1422");
  bg.addColorStop(1, "#16243a");
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
      ctx.fillStyle = (i + j) % 2 === 0 ? "#243140" : "#1a2430";
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
  glow.addColorStop(1, hsl(hue, 30, 13));
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
