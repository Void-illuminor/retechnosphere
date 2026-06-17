/**
 * Draws a creature as a pre-rendered, late-90s-style 3D portrait — the look of
 * the original TechnoSphere: glossy, volumetrically-shaded parts (spheres, a
 * boxy chassis, metallic wheels) lit from the upper-left with speculars, rim
 * light, contact shadows and a cast shadow, optionally standing on a perspective
 * checkerboard "studio" floor.
 *
 * Drawn centred on (cx, cy); `size` is the body radius in px. The creature faces
 * left, viewed slightly from above-right (3/4) so its volume reads clearly.
 */
import { Genome } from "../sim/genome";

interface PortraitOpts {
  size: number;
  /** Draw the checkerboard floor + backdrop (for builder preview / hero). */
  scene?: boolean;
  /** Canvas CSS size, needed to lay out the scene floor. */
  viewW?: number;
  viewH?: number;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

// Light comes from the upper-left.
const LX = -0.4;
const LY = -0.5;

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
  const sat = carn ? 60 : 46;
  const accent = hsl(hue + 35 + genome.accent * 40, 70, 60);

  const groundY = cy + s * 1.02;

  if (opts.scene) {
    drawScene(ctx, cx, groundY, opts.viewW ?? s * 3.3, opts.viewH ?? s * 3.3, hue);
  }

  // Soft cast shadow on the ground (offset away from the light).
  ctx.save();
  ctx.translate(cx + s * 0.18, groundY + s * 0.06);
  ctx.scale(1, 0.32);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
  sh.addColorStop(0, "rgba(0,0,0,0.45)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Parts are laid out relative to the origin, so move the origin to (cx, cy).
  // Far locomotion (behind the body) then body then near locomotion (in front).
  ctx.save();
  ctx.translate(cx, cy);
  drawLocomotion(ctx, genome.parts.locomotion, s, accent, "far");
  drawBody(ctx, genome.parts.body, s, hue, sat);
  drawHead(ctx, genome, s, hue, sat, accent, carn);
  drawLocomotion(ctx, genome.parts.locomotion, s, accent, "near");
  ctx.restore();
}

// --- volumetric primitives ---------------------------------------------------

/** Paint a shaded sphere/ovoid (radius rx,ry) lit from upper-left, with spec. */
function sphere(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  light: string,
  base: string,
  dark: string,
  outline: string,
  spec = 0.5,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.save();
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(LX * 0.7, LY * 0.7, 0.05, -0.1, -0.05, 1.25);
  g.addColorStop(0, light);
  g.addColorStop(0.5, base);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  // rim / back light along the shadow edge for that CG sheen
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, 0.98, Math.PI * 0.05, Math.PI * 0.75);
  ctx.stroke();
  ctx.restore();

  // outline for definition
  ctx.lineWidth = Math.max(1, Math.min(rx, ry) * 0.05);
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // specular highlight
  if (spec > 0) {
    ctx.fillStyle = `rgba(255,255,255,${spec})`;
    ctx.beginPath();
    ctx.ellipse(LX * rx * 0.8, LY * ry * 0.8, rx * 0.22, ry * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- body --------------------------------------------------------------------

function drawBody(ctx: CanvasRenderingContext2D, part: string, s: number, hue: number, sat: number): void {
  const light = hsl(hue, sat, 84);
  const base = hsl(hue, sat, 54);
  const dark = hsl(hue, sat - 8, 26);
  const outline = hsl(hue, sat - 10, 18);

  if (part === "body_tank") {
    drawBox(ctx, 0, -s * 0.1, s * 1.15, s * 0.85, s * 0.55, hue, sat);
  } else if (part === "body_sleek") {
    sphere(ctx, 0, 0, s * 1.4, s * 0.62, light, base, dark, outline);
  } else if (part === "body_pod") {
    sphere(ctx, 0, 0, s, s, light, base, dark, outline);
  } else {
    // balanced — fat ovoid
    sphere(ctx, 0, 0, s * 1.12, s * 0.92, light, base, dark, outline);
  }

  // riveted panel dots, shaded
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  for (const [dx, dy] of [[0.4, 0.05], [0.12, 0.45], [0.62, -0.3]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A shaded 3D box (three visible faces) for the tank chassis. */
function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  depth: number,
  hue: number,
  sat: number,
): void {
  const dx = depth * 0.7;
  const dy = -depth * 0.5;
  const outline = hsl(hue, sat - 10, 16);
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.strokeStyle = outline;

  // right side face (darkest)
  ctx.fillStyle = hsl(hue, sat - 6, 34);
  ctx.beginPath();
  ctx.moveTo(cx + w, cy - h);
  ctx.lineTo(cx + w + dx, cy - h + dy);
  ctx.lineTo(cx + w + dx, cy + h + dy);
  ctx.lineTo(cx + w, cy + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // top face (lightest)
  ctx.fillStyle = hsl(hue, sat, 78);
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h);
  ctx.lineTo(cx - w + dx, cy - h + dy);
  ctx.lineTo(cx + w + dx, cy - h + dy);
  ctx.lineTo(cx + w, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // front face (mid) with a vertical gradient
  const g = ctx.createLinearGradient(cx, cy - h, cx, cy + h);
  g.addColorStop(0, hsl(hue, sat, 64));
  g.addColorStop(1, hsl(hue, sat - 4, 40));
  ctx.fillStyle = g;
  roundRectPath(ctx, cx - w, cy - h, w * 2, h * 2, w * 0.12);
  ctx.fill();
  ctx.stroke();
  // sheen on the front
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.35, cy - h * 0.45, w * 0.5, h * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

// --- locomotion --------------------------------------------------------------

/** A metallic 3D wheel with tyre depth, rim, hub and a specular sweep. */
function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, accent: string): void {
  const dx = r * 0.28;
  const dy = -r * 0.12;
  // back of the tyre (depth)
  ctx.fillStyle = "#15191f";
  ctx.beginPath();
  ctx.ellipse(x + dx, y + dy, r, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // tread band connecting front & back
  ctx.strokeStyle = "#1c2128";
  ctx.lineWidth = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.55);
  ctx.lineTo(x + dx, y + dy + r * 0.55);
  ctx.stroke();
  // front tyre (shaded sphere look)
  sphere(ctx, x, y, r, r, "#5b6470", "#363d47", "#181c22", "#0c0f13", 0.35);
  // rim
  sphere(ctx, x, y, r * 0.6, r * 0.6, "#c8cfda", "#7c8693", "#363d47", "#181c22", 0.5);
  // hub
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // spokes
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    ctx.stroke();
  }
}

function drawLocomotion(
  ctx: CanvasRenderingContext2D,
  part: string,
  s: number,
  accent: string,
  layer: "far" | "near",
): void {
  const baseY = s * 0.92;
  switch (part) {
    case "loco_bigwheels":
      if (layer === "far") wheel(ctx, s * 0.62, baseY - s * 0.12, s * 0.5, accent);
      else wheel(ctx, -s * 0.5, baseY, s * 0.66, accent);
      break;
    case "loco_mono":
      if (layer === "near") wheel(ctx, 0, baseY + s * 0.05, s * 0.95, accent);
      break;
    case "loco_tracks":
      if (layer === "far") wheel(ctx, s * 0.85, baseY - s * 0.06, s * 0.32, accent);
      else {
        // tread body
        ctx.fillStyle = "#20252d";
        roundRectPath(ctx, -s * 1.2, baseY - s * 0.34, s * 2.4, s * 0.66, s * 0.32);
        ctx.fill();
        ctx.strokeStyle = "#0c0f13";
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.26, baseY - s * 0.3);
          ctx.lineTo(i * s * 0.26, baseY + s * 0.3);
          ctx.stroke();
        }
        wheel(ctx, -s * 0.85, baseY, s * 0.34, accent);
        wheel(ctx, s * 0.0, baseY, s * 0.34, accent);
      }
      break;
    case "loco_legs":
      if (layer === "near") {
        ctx.lineCap = "round";
        for (const lx of [-0.75, -0.25, 0.3, 0.8]) {
          const x = lx * s;
          const far = lx > 0.1;
          ctx.strokeStyle = far ? "#3a424e" : "#525c6a";
          ctx.lineWidth = Math.max(2, s * (far ? 0.1 : 0.14));
          ctx.beginPath();
          ctx.moveTo(x, s * 0.45);
          ctx.lineTo(x + s * 0.16, baseY);
          ctx.lineTo(x - s * 0.12, baseY + s * 0.32);
          ctx.stroke();
        }
      }
      break;
    case "loco_hover":
      if (layer === "near") {
        const g = ctx.createLinearGradient(0, baseY - s * 0.2, 0, baseY + s * 0.55);
        g.addColorStop(0, "rgba(150,210,255,0.6)");
        g.addColorStop(1, "rgba(120,200,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-s * 1.05, baseY - s * 0.1);
        ctx.lineTo(s * 1.05, baseY - s * 0.1);
        ctx.lineTo(s * 0.65, baseY + s * 0.55);
        ctx.lineTo(-s * 0.65, baseY + s * 0.55);
        ctx.closePath();
        ctx.fill();
        sphere(ctx, 0, baseY - s * 0.1, s * 0.95, s * 0.26, "#cfeeff", "#7fc8ff", "#2f7fc0", "#1f5f95", 0.4);
      }
      break;
  }
}

// --- head, eyes, mouth -------------------------------------------------------

function drawHead(
  ctx: CanvasRenderingContext2D,
  genome: Genome,
  s: number,
  hue: number,
  sat: number,
  accent: string,
  carn: boolean,
): void {
  const hx = -s * 1.0;
  const hy = -s * 0.25;
  const hr = s * 0.6;
  const light = hsl(hue, sat, 86);
  const base = hsl(hue, sat, 56);
  const dark = hsl(hue, sat - 8, 28);
  const outline = hsl(hue, sat - 10, 16);

  // neck (shaded short cylinder linking head to body)
  sphere(ctx, hx + hr * 0.7, hy + hr * 0.3, hr * 0.7, hr * 0.5, base, hsl(hue, sat - 4, 42), dark, outline, 0.2);

  // contact shadow where head meets body
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.9, hy + hr * 0.2, hr * 0.5, hr * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (genome.parts.head === "head_blunt") {
    drawBox(ctx, hx, hy, hr * 0.9, hr * 0.85, hr * 0.6, hue, sat);
  } else {
    sphere(ctx, hx, hy, hr, hr * (genome.parts.head === "head_compact" ? 0.82 : 0.95), light, base, dark, outline);
  }

  // sensors / antennae (shaded little balls on stalks)
  ctx.strokeStyle = "#3a414c";
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.lineCap = "round";
  if (genome.parts.head === "head_antenna") {
    for (const a of [-0.5, 0.15]) {
      const tx = hx + a * hr;
      const ty = hy - hr * 1.5;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr, hy - hr * 0.7);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      sphere(ctx, tx, ty, s * 0.12, s * 0.12, "#ffe6a0", accent, "#6a4a10", "#3a2a08", 0.6);
    }
  } else if (genome.parts.head === "head_sensor") {
    for (const a of [-0.5, 0, 0.5]) {
      const tx = hx + a * hr * 0.85;
      const ty = hy - hr * 1.25;
      ctx.beginPath();
      ctx.moveTo(hx + a * hr * 0.7, hy - hr * 0.65);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      sphere(ctx, tx, ty, s * 0.09, s * 0.09, "#cfeeff", accent, "#1f5f95", "#123a5e", 0.6);
    }
  }

  drawEyes(ctx, genome.parts.eyes, hx, hy, hr, carn);
  drawMouth(ctx, genome.parts.mouth, hx, hy, hr);
}

function eyeBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, iris: string): void {
  sphere(ctx, x, y, r, r, "#ffffff", "#e8edf4", "#9aa6b5", "#5d6675", 0.7);
  sphere(ctx, x - r * 0.12, y + r * 0.05, r * 0.55, r * 0.55, iris, iris, "#0a0d12", "#05070a", 0.0);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.25, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyes(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number, carn: boolean): void {
  const iris = carn ? "#d83a2a" : "#243042";
  const ex = hx - hr * 0.3;
  const ey = hy - hr * 0.12;
  switch (part) {
    case "eyes_telescopic":
      ctx.strokeStyle = "#3a414c";
      ctx.lineWidth = Math.max(1, hr * 0.12);
      ctx.beginPath();
      ctx.moveTo(hx, hy - hr * 0.2);
      ctx.lineTo(ex - hr * 0.2, ey - hr * 0.6);
      ctx.stroke();
      eyeBall(ctx, ex - hr * 0.2, ey - hr * 0.6, hr * 0.3, iris);
      break;
    case "eyes_compound":
      for (const [dx, dy] of [[0, -0.18], [-0.26, 0.02], [0.04, 0.2], [-0.3, 0.26]]) {
        eyeBall(ctx, ex + dx * hr, ey + dy * hr, hr * 0.16, iris);
      }
      break;
    case "eyes_night":
      eyeBall(ctx, ex, ey, hr * 0.34, iris);
      break;
    case "eyes_basic":
    default:
      eyeBall(ctx, ex, ey - hr * 0.05, hr * 0.22, iris);
      eyeBall(ctx, ex + hr * 0.32, ey + hr * 0.16, hr * 0.18, iris);
      break;
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, part: string, hx: number, hy: number, hr: number): void {
  const mx = hx - hr * 0.78;
  const my = hy + hr * 0.5;
  switch (part) {
    case "mouth_shear":
    case "mouth_fangs": {
      ctx.fillStyle = "#1a1d22";
      roundRectPath(ctx, mx - hr * 0.2, my - hr * 0.22, hr * 0.5, hr * 0.5, hr * 0.08);
      ctx.fill();
      ctx.fillStyle = "#eef2f7";
      const n = part === "mouth_shear" ? 4 : 3;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ty = my - hr * 0.16 + (i * hr * 0.34) / (n - 1);
        ctx.moveTo(mx + hr * 0.22, ty - hr * 0.06);
        ctx.lineTo(mx - hr * 0.12, ty);
        ctx.lineTo(mx + hr * 0.22, ty + hr * 0.06);
      }
      ctx.fill();
      break;
    }
    case "mouth_beak": {
      ctx.fillStyle = "#e3c869";
      ctx.strokeStyle = "#7a6320";
      ctx.lineWidth = Math.max(1, hr * 0.05);
      ctx.beginPath();
      ctx.moveTo(mx - hr * 0.28, my - hr * 0.02);
      ctx.lineTo(mx + hr * 0.24, my - hr * 0.22);
      ctx.lineTo(mx + hr * 0.24, my + hr * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    default:
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = Math.max(1, hr * 0.1);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mx + hr * 0.2, my - hr * 0.22);
      ctx.quadraticCurveTo(mx - hr * 0.18, my, mx + hr * 0.2, my + hr * 0.22);
      ctx.stroke();
      break;
  }
}

// --- scene (checkerboard studio floor) --------------------------------------

function drawScene(ctx: CanvasRenderingContext2D, cx: number, horizonY: number, w: number, h: number, hue: number): void {
  // backdrop: a soft studio gradient
  const bg = ctx.createLinearGradient(0, horizonY - h, 0, horizonY);
  bg.addColorStop(0, "#0c1422");
  bg.addColorStop(1, "#16243a");
  ctx.fillStyle = bg;
  ctx.fillRect(cx - w, horizonY - h, w * 2, h);

  // perspective checkerboard floor below the horizon
  const rows = 9;
  const cols = 10;
  const maxHalf = w * 0.95;
  const floorH = h * 0.9;
  const pt = (i: number, j: number) => {
    const depth = Math.pow(i / rows, 2); // 0 at horizon → 1 near
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
  // faint horizon glow tinted by the creature
  const glow = ctx.createLinearGradient(0, horizonY - h * 0.15, 0, horizonY + h * 0.1);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(1, hsl(hue, 30, 14));
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w, horizonY - h * 0.15, w * 2, h * 0.25);
}

// --- primitives --------------------------------------------------------------

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}
