/**
 * Procedurally draws a creature from its genome onto a 2D canvas. The same
 * routine is used for the builder preview (large, facing up) and for every
 * creature in the world (small, facing its heading), so what you design is
 * exactly what you see roaming the savanna.
 *
 * Drawn centred on (x, y); angle 0 faces +x (to the right).
 */
import { Genome } from "../sim/genome";

export interface DrawOpts {
  size: number; // body radius in px
  angle?: number; // facing direction in radians
  detail?: boolean; // draw fine features (eyes, sensors); off for tiny world sprites
  alpha?: number;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  x: number,
  y: number,
  opts: DrawOpts,
): void {
  const { size } = opts;
  const angle = opts.angle ?? 0;
  const detail = opts.detail ?? size > 11;
  const carn = genome.diet === "carnivore";

  const body = hsl(genome.hue, carn ? 58 : 52, 54);
  const shade = hsl(genome.hue, carn ? 52 : 46, 36);
  const accent = hsl(genome.hue + 30 + genome.accent * 50, 70, 64);
  const metal = "#3a3f4b";

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.lineJoin = "round";

  drawLocomotion(ctx, genome.parts.locomotion, size, metal, accent);
  drawBody(ctx, genome.parts.body, size, body, shade);
  drawHead(ctx, genome.parts.head, size, body, shade, detail);
  if (detail) {
    drawEyes(ctx, genome.parts.eyes, size, carn);
    drawMouth(ctx, genome.parts.mouth, size, shade);
  }

  ctx.restore();
}

// --- body / chassis ---------------------------------------------------------

function drawBody(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  fill: string,
  stroke: string,
): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.beginPath();
  switch (part) {
    case "body_tank": // boxy, broad
      roundRect(ctx, -s * 1.0, -s * 0.85, s * 2.0, s * 1.7, s * 0.3);
      break;
    case "body_sleek": // long, narrow
      ctx.ellipse(0, 0, s * 1.25, s * 0.62, 0, 0, Math.PI * 2);
      break;
    case "body_pod": // round
      ctx.arc(0, 0, s * 0.92, 0, Math.PI * 2);
      break;
    case "body_balanced": // hexagon
    default:
      polygon(ctx, 6, s, Math.PI / 6);
      break;
  }
  ctx.fill();
  ctx.stroke();

  // A little top highlight strip for a hint of dimensionality.
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.1, -s * 0.32, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- locomotion -------------------------------------------------------------

function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLocomotion(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  metal: string,
  accent: string,
): void {
  ctx.fillStyle = metal;
  ctx.strokeStyle = "#10131a";
  const wheelR = s * 0.5;
  switch (part) {
    case "loco_bigwheels": {
      for (const sy of [-1, 1]) {
        ctx.fillStyle = metal;
        wheel(ctx, s * 0.15, sy * s * 0.95, wheelR * 1.15);
        ctx.fillStyle = accent;
        wheel(ctx, s * 0.15, sy * s * 0.95, wheelR * 0.45);
      }
      break;
    }
    case "loco_mono": {
      ctx.fillStyle = metal;
      wheel(ctx, 0, 0, s * 1.15);
      ctx.fillStyle = accent;
      wheel(ctx, 0, 0, s * 0.4);
      break;
    }
    case "loco_tracks": {
      for (const sy of [-1, 1]) {
        ctx.fillStyle = metal;
        ctx.beginPath();
        roundRect(ctx, -s * 1.05, sy * s * 0.62 - s * 0.28, s * 2.1, s * 0.56, s * 0.18);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "loco_legs": {
      ctx.strokeStyle = metal;
      ctx.lineWidth = Math.max(1.5, s * 0.13);
      for (const sy of [-1, 1]) {
        for (const lx of [-0.6, 0, 0.6]) {
          line(ctx, lx * s, sy * s * 0.5, lx * s, sy * s * 1.15);
          line(ctx, lx * s, sy * s * 1.0, lx * s - s * 0.25, sy * s * 1.35);
        }
      }
      break;
    }
    case "loco_hover": {
      ctx.fillStyle = "rgba(120,200,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.25, s * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(180,230,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.5, s * 0.9, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

// --- head -------------------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  fill: string,
  stroke: string,
  detail: boolean,
): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  const hx = s * 0.95; // head sits forward
  switch (part) {
    case "head_blunt":
      ctx.beginPath();
      roundRect(ctx, hx - s * 0.1, -s * 0.5, s * 0.7, s * 1.0, s * 0.15);
      ctx.fill();
      ctx.stroke();
      break;
    case "head_compact":
      ctx.beginPath();
      ctx.moveTo(hx + s * 0.55, 0);
      ctx.lineTo(hx - s * 0.1, -s * 0.4);
      ctx.lineTo(hx - s * 0.1, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "head_antenna":
      ctx.beginPath();
      ctx.arc(hx, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (detail) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1, s * 0.08);
        line(ctx, hx, -s * 0.2, hx + s * 0.5, -s * 0.7);
        line(ctx, hx, s * 0.2, hx + s * 0.5, s * 0.7);
        dot(ctx, hx + s * 0.5, -s * 0.7, s * 0.1, stroke);
        dot(ctx, hx + s * 0.5, s * 0.7, s * 0.1, stroke);
      }
      break;
    case "head_sensor":
    default:
      ctx.beginPath();
      ctx.arc(hx, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (detail && part === "head_sensor") {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(1, s * 0.07);
        for (const a of [-0.6, 0, 0.6]) {
          line(ctx, hx, 0, hx + Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7);
        }
      }
      break;
  }
}

// --- eyes -------------------------------------------------------------------

function drawEyes(ctx: CanvasRenderingContext2D, part: string, s: number, carn: boolean): void {
  const eyeColor = carn ? "#ff5544" : "#1c2230";
  const hx = s * 1.05;
  switch (part) {
    case "eyes_telescopic":
      dot(ctx, hx + s * 0.2, 0, s * 0.22, "#0b0e14");
      dot(ctx, hx + s * 0.25, 0, s * 0.12, eyeColor);
      break;
    case "eyes_compound":
      for (const sy of [-0.45, -0.15, 0.15, 0.45]) {
        dot(ctx, hx, sy * s, s * 0.1, eyeColor);
      }
      break;
    case "eyes_night":
      dot(ctx, hx, -s * 0.28, s * 0.2, "#0b0e14");
      dot(ctx, hx, s * 0.28, s * 0.2, "#0b0e14");
      dot(ctx, hx + s * 0.04, -s * 0.28, s * 0.1, eyeColor);
      dot(ctx, hx + s * 0.04, s * 0.28, s * 0.1, eyeColor);
      break;
    case "eyes_basic":
    default:
      dot(ctx, hx, -s * 0.25, s * 0.13, eyeColor);
      dot(ctx, hx, s * 0.25, s * 0.13, eyeColor);
      break;
  }
}

// --- mouth ------------------------------------------------------------------

function drawMouth(ctx: CanvasRenderingContext2D, part: string, s: number, stroke: string): void {
  const mx = s * 1.4;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = "#e9eef5";
  ctx.lineWidth = Math.max(1, s * 0.08);
  switch (part) {
    case "mouth_shear":
    case "mouth_fangs": {
      // a row of little teeth
      ctx.beginPath();
      const n = part === "mouth_shear" ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const ty = -s * 0.3 + (i * s * 0.6) / (n - 1);
        ctx.moveTo(mx - s * 0.15, ty - s * 0.07);
        ctx.lineTo(mx + s * 0.18, ty);
        ctx.lineTo(mx - s * 0.15, ty + s * 0.07);
      }
      ctx.fill();
      break;
    }
    case "mouth_beak":
      ctx.beginPath();
      ctx.moveTo(mx + s * 0.2, 0);
      ctx.lineTo(mx - s * 0.15, -s * 0.18);
      ctx.lineTo(mx - s * 0.15, s * 0.18);
      ctx.closePath();
      ctx.fillStyle = "#d9c27a";
      ctx.fill();
      break;
    case "mouth_grazer":
    case "mouth_sieve":
    default:
      line(ctx, mx - s * 0.2, -s * 0.22, mx - s * 0.2, s * 0.22);
      break;
  }
}

// --- primitives -------------------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function polygon(ctx: CanvasRenderingContext2D, sides: number, r: number, rot: number): void {
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
