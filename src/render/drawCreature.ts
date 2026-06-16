/**
 * Draws a creature as a shaded, side-on "portrait" — closer to the original
 * TechnoSphere look: a glossy 3D-ish body assembled from mechanical parts (the
 * signature wheels, plus legs/tracks/hover), a head with eyes and a mouth, on a
 * little shadowed ground. Used for the builder preview, the roster thumbnails and
 * the creature dossier hero. The creature faces left.
 *
 * Drawn centred on (cx, cy); `size` is the body radius in pixels.
 */
import { Genome } from "../sim/genome";

interface PortraitOpts {
  size: number;
  ground?: boolean; // draw the shadow/ground (default true)
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
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
  const sat = carn ? 62 : 46;
  const accent = hsl(hue + 35 + genome.accent * 40, 72, 62);
  const metal = "#39414f";
  const metalDark = "#222831";
  const line = hsl(hue, sat - 12, 22);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const lw = Math.max(1, s * 0.06);

  // --- ground shadow ---
  if (opts.ground !== false) {
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.beginPath();
    ctx.ellipse(0, s * 1.18, s * 1.35, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLocomotion(ctx, genome.parts.locomotion, s, metal, metalDark, accent, lw);
  drawBody(ctx, genome.parts.body, s, hue, sat, line, lw);
  drawHead(ctx, genome, s, hue, sat, line, accent, metal, lw, carn);

  ctx.restore();
}

// --- body --------------------------------------------------------------------

function bodyPath(ctx: CanvasRenderingContext2D, part: string, s: number): { w: number; h: number } {
  ctx.beginPath();
  switch (part) {
    case "body_tank": {
      const w = s * 1.25, h = s * 0.95;
      roundRect(ctx, -w, -h, w * 2, h * 2, s * 0.35);
      return { w, h };
    }
    case "body_sleek": {
      ctx.ellipse(0, 0, s * 1.35, s * 0.62, 0, 0, Math.PI * 2);
      return { w: s * 1.35, h: s * 0.62 };
    }
    case "body_pod": {
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      return { w: s, h: s };
    }
    case "body_balanced":
    default: {
      const w = s * 1.12, h = s * 0.92;
      roundRect(ctx, -w, -h, w * 2, h * 2, s * 0.6);
      return { w, h };
    }
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  hue: number,
  sat: number,
  line: string,
  lw: number,
): void {
  const dims = bodyPath(ctx, part, s); // sets current path
  const g = ctx.createRadialGradient(-s * 0.4, -s * 0.5, s * 0.1, 0, 0, s * 1.5);
  g.addColorStop(0, hsl(hue, sat, 74));
  g.addColorStop(0.55, hsl(hue, sat, 54));
  g.addColorStop(1, hsl(hue, sat - 6, 34));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();

  // glossy highlight
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.35, -s * 0.45, dims.w * 0.42, dims.h * 0.26, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // a couple of riveted panel dots for mechanical flavour
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (const [dx, dy] of [[0.45, 0.1], [0.15, 0.5], [0.6, -0.35]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- locomotion (side view, beneath the body) --------------------------------

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, metal: string, metalDark: string, accent: string): void {
  ctx.fillStyle = metalDark; // tyre
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = metal; // rim
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent; // hub
  ctx.beginPath();
  ctx.arc(x, y, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  // spokes
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58);
    ctx.stroke();
  }
}

function drawLocomotion(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  metal: string,
  metalDark: string,
  accent: string,
  lw: number,
): void {
  const baseY = s * 0.95;
  switch (part) {
    case "loco_bigwheels":
      wheel(ctx, s * 0.55, baseY, s * 0.62, metal, metalDark, accent);
      wheel(ctx, -s * 0.55, baseY, s * 0.62, metal, metalDark, accent);
      break;
    case "loco_mono":
      wheel(ctx, 0, baseY + s * 0.1, s * 0.95, metal, metalDark, accent);
      break;
    case "loco_tracks": {
      ctx.fillStyle = metalDark;
      ctx.beginPath();
      roundRect(ctx, -s * 1.15, baseY - s * 0.32, s * 2.3, s * 0.62, s * 0.3);
      ctx.fill();
      ctx.strokeStyle = "#10141b";
      ctx.lineWidth = lw;
      ctx.stroke();
      // tread marks
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.25, baseY - s * 0.28);
        ctx.lineTo(i * s * 0.25, baseY + s * 0.28);
        ctx.stroke();
      }
      wheel(ctx, -s * 0.8, baseY, s * 0.3, metal, metalDark, accent);
      wheel(ctx, s * 0.8, baseY, s * 0.3, metal, metalDark, accent);
      break;
    }
    case "loco_legs": {
      ctx.strokeStyle = metal;
      ctx.lineWidth = Math.max(2, s * 0.13);
      for (const lx of [-0.7, -0.2, 0.35, 0.85]) {
        const x = lx * s;
        ctx.beginPath();
        ctx.moveTo(x, s * 0.5);
        ctx.lineTo(x + s * 0.18, baseY);
        ctx.lineTo(x - s * 0.1, baseY + s * 0.3);
        ctx.stroke();
      }
      break;
    }
    case "loco_hover": {
      const g = ctx.createLinearGradient(0, baseY - s * 0.2, 0, baseY + s * 0.5);
      g.addColorStop(0, "rgba(150,210,255,0.55)");
      g.addColorStop(1, "rgba(120,200,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, baseY - s * 0.15);
      ctx.lineTo(s * 1.1, baseY - s * 0.15);
      ctx.lineTo(s * 0.7, baseY + s * 0.5);
      ctx.lineTo(-s * 0.7, baseY + s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(180,230,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(0, baseY - s * 0.12, s * 0.95, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

// --- head, eyes, mouth, sensors ---------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  s: number,
  hue: number,
  sat: number,
  line: string,
  accent: string,
  metal: string,
  lw: number,
  carn: boolean,
): void {
  const hx = -s * 1.05; // head sits to the left (facing)
  const hy = -s * 0.15;
  const hr = s * 0.62;

  // neck/connector
  ctx.fillStyle = hsl(hue, sat - 6, 44);
  ctx.beginPath();
  roundRect(ctx, hx, hy - s * 0.35, s * 0.9, s * 0.7, s * 0.2);
  ctx.fill();

  // head ball (shaded)
  const g = ctx.createRadialGradient(hx - hr * 0.4, hy - hr * 0.5, hr * 0.1, hx, hy, hr * 1.4);
  g.addColorStop(0, hsl(hue, sat, 78));
  g.addColorStop(0.6, hsl(hue, sat, 56));
  g.addColorStop(1, hsl(hue, sat - 6, 36));
  ctx.fillStyle = g;
  ctx.beginPath();
  if (genome.parts.head === "head_blunt") {
    roundRect(ctx, hx - hr, hy - hr * 0.95, hr * 2, hr * 1.9, hr * 0.3);
  } else if (genome.parts.head === "head_compact") {
    ctx.ellipse(hx, hy, hr * 0.85, hr * 0.8, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();

  // sensors / antennae on top
  ctx.strokeStyle = metal;
  ctx.lineWidth = Math.max(1, s * 0.07);
  if (genome.parts.head === "head_antenna") {
    for (const a of [-0.5, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(hx + a * hr, hy - hr * 0.8);
      ctx.lineTo(hx + a * hr - s * 0.1, hy - hr * 1.7);
      ctx.stroke();
      dot(ctx, hx + a * hr - s * 0.1, hy - hr * 1.7, s * 0.1, accent);
    }
  } else if (genome.parts.head === "head_sensor") {
    for (const a of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(hx + a * hr * 0.7, hy - hr * 0.7);
      ctx.lineTo(hx + a * hr * 0.9, hy - hr * 1.35);
      ctx.stroke();
      dot(ctx, hx + a * hr * 0.9, hy - hr * 1.35, s * 0.07, accent);
    }
  }

  // eyes (toward the front-left)
  const eyeColor = carn ? "#ff5a44" : "#1b2230";
  const ex = hx - hr * 0.35;
  const ey = hy - hr * 0.15;
  switch (genome.parts.eyes) {
    case "eyes_telescopic":
      ctx.strokeStyle = metal;
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 0.2);
      ctx.lineTo(ex - s * 0.15, ey - hr * 0.5);
      ctx.stroke();
      dot(ctx, ex - s * 0.15, ey - hr * 0.5, hr * 0.26, "#0c1118");
      dot(ctx, ex - s * 0.18, ey - hr * 0.55, hr * 0.12, eyeColor);
      break;
    case "eyes_compound":
      for (const [dx, dy] of [[0, -0.2], [-0.22, 0], [0.05, 0.18], [-0.28, 0.22]]) {
        dot(ctx, ex + dx * hr, ey + dy * hr, hr * 0.13, eyeColor);
      }
      break;
    case "eyes_night":
      dot(ctx, ex, ey, hr * 0.34, "#0c1118");
      dot(ctx, ex - hr * 0.05, ey - hr * 0.05, hr * 0.18, eyeColor);
      dot(ctx, ex - hr * 0.1, ey - hr * 0.1, hr * 0.06, "#fff");
      break;
    case "eyes_basic":
    default:
      dot(ctx, ex, ey - hr * 0.12, hr * 0.2, "#f3f6fb");
      dot(ctx, ex - hr * 0.04, ey - hr * 0.12, hr * 0.1, eyeColor);
      dot(ctx, ex + hr * 0.18, ey + hr * 0.18, hr * 0.16, "#f3f6fb");
      dot(ctx, ex + hr * 0.14, ey + hr * 0.18, hr * 0.08, eyeColor);
      break;
  }

  // mouth at the very front (left edge of head)
  const mx = hx - hr * 0.92;
  const my = hy + hr * 0.42;
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, s * 0.07);
  switch (genome.parts.mouth) {
    case "mouth_shear":
    case "mouth_fangs": {
      ctx.fillStyle = "#eef2f7";
      const n = genome.parts.mouth === "mouth_shear" ? 4 : 3;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ty = my - hr * 0.25 + (i * hr * 0.5) / (n - 1);
        ctx.moveTo(mx + hr * 0.16, ty - hr * 0.07);
        ctx.lineTo(mx - hr * 0.12, ty);
        ctx.lineTo(mx + hr * 0.16, ty + hr * 0.07);
      }
      ctx.fill();
      break;
    }
    case "mouth_beak":
      ctx.fillStyle = "#d9bf6e";
      ctx.beginPath();
      ctx.moveTo(mx - hr * 0.18, my);
      ctx.lineTo(mx + hr * 0.2, my - hr * 0.2);
      ctx.lineTo(mx + hr * 0.2, my + hr * 0.2);
      ctx.closePath();
      ctx.fill();
      break;
    case "mouth_grazer":
    case "mouth_sieve":
    default:
      ctx.beginPath();
      ctx.moveTo(mx + hr * 0.18, my - hr * 0.28);
      ctx.lineTo(mx - hr * 0.05, my);
      ctx.lineTo(mx + hr * 0.18, my + hr * 0.28);
      ctx.stroke();
      break;
  }
}

// --- primitives --------------------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
