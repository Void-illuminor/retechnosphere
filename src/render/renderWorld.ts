/**
 * Renders the world to a canvas: the cached fractal-savanna terrain, the plants,
 * and every creature (drawn from its genome). Supports a pan/zoom camera and
 * highlighting of the player's bloodlines and the selected creature.
 */
import { Creature } from "../sim/creature";
import { Biome, Terrain } from "../sim/terrain";
import { World } from "../sim/world";
import { drawCreature } from "./drawCreature";

export interface Camera {
  x: number; // world coords at viewport centre
  y: number;
  zoom: number;
}

export interface RenderOpts {
  viewW: number; // CSS pixels
  viewH: number;
  dpr: number;
  selectedId: number | null;
  showVision: boolean;
}

// Cache the static terrain bitmap per Terrain instance.
const terrainCache = new WeakMap<Terrain, HTMLCanvasElement>();

function biomeColor(biome: Biome, h: number): string {
  // Shade each biome by height for a sense of relief.
  switch (biome) {
    case "water": {
      const l = 22 + h * 30;
      return `hsl(205, 45%, ${l}%)`;
    }
    case "sand":
      return `hsl(45, 38%, ${64 + h * 6}%)`;
    case "savanna":
      return `hsl(${70 + h * 14}, 38%, ${42 + h * 16}%)`;
    case "scrub":
      return `hsl(${78 + h * 8}, 30%, ${36 + h * 12}%)`;
    case "rock":
      return `hsl(40, 10%, ${50 + h * 22}%)`;
  }
}

function buildTerrainCanvas(terrain: Terrain): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = terrain.width;
  cv.height = terrain.height;
  const ctx = cv.getContext("2d")!;
  const cs = terrain.cellSize;
  for (let r = 0; r < terrain.rows; r++) {
    for (let c = 0; c < terrain.cols; c++) {
      const cell = terrain.cells[r * terrain.cols + c];
      ctx.fillStyle = biomeColor(cell.biome, cell.height);
      ctx.fillRect(c * cs, r * cs, cs + 1, cs + 1);
      // Cheap dither speckle keyed off position for a retro, textured look.
      if (((c * 31 + r * 17) & 7) === 0 && cell.biome !== "water") {
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(c * cs + (r % 3) * 4, r * cs + (c % 3) * 4, 3, 3);
      }
    }
  }
  // Soft shoreline glow where land meets water.
  ctx.strokeStyle = "rgba(230,240,255,0.05)";
  return cv;
}

function getTerrainCanvas(terrain: Terrain): HTMLCanvasElement {
  let cv = terrainCache.get(terrain);
  if (!cv) {
    cv = buildTerrainCanvas(terrain);
    terrainCache.set(terrain, cv);
  }
  return cv;
}

export function screenToWorld(cam: Camera, viewW: number, viewH: number, sx: number, sy: number): {
  x: number;
  y: number;
} {
  return {
    x: (sx - viewW / 2) / cam.zoom + cam.x,
    y: (sy - viewH / 2) / cam.zoom + cam.y,
  };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  opts: RenderOpts,
): void {
  const { viewW, viewH, dpr, selectedId } = opts;
  const z = cam.zoom;

  // Reset, clear, then set a transform that bakes in DPR + camera so the rest of
  // the drawing happens in world coordinates.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewW * dpr, viewH * dpr);
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, viewW * dpr, viewH * dpr);
  ctx.setTransform(z * dpr, 0, 0, z * dpr, (viewW / 2 - cam.x * z) * dpr, (viewH / 2 - cam.y * z) * dpr);

  // Visible world rectangle (for culling), with a margin.
  const halfW = viewW / 2 / z;
  const halfH = viewH / 2 / z;
  const minX = cam.x - halfW - 40;
  const maxX = cam.x + halfW + 40;
  const minY = cam.y - halfH - 40;
  const maxY = cam.y + halfH + 40;

  // Terrain.
  ctx.imageSmoothingEnabled = z < 1;
  ctx.drawImage(getTerrainCanvas(world.terrain), 0, 0);

  // Plants.
  for (const p of world.plants) {
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    const ripe = p.growth >= 1;
    const r = 2 + p.growth * 3.2;
    ctx.fillStyle = ripe ? "#cfe06a" : "#6f8a3c";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (ripe && z > 0.7) {
      ctx.fillStyle = "#9fbf4a";
      ctx.fillRect(p.x - 0.6, p.y - r - 1.5, 1.2, 2);
    }
  }

  // Creatures.
  const playerLineages = world.lineages;
  let selected: Creature | null = null;
  for (const c of world.creatures) {
    if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
    if (c.id === selectedId) selected = c;

    // Highlight ring for player bloodlines.
    if (c.lineageId >= 0) {
      const line = playerLineages.get(c.lineageId);
      if (line) {
        ctx.strokeStyle = `hsla(${line.hue}, 90%, 70%, 0.9)`;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.stats.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawCreature(ctx, c.genome, c.x, c.y, {
      size: c.stats.radius,
      angle: c.angle,
      detail: c.stats.radius * z > 13,
    });
  }

  // Selection overlay drawn last, on top.
  if (selected) {
    drawSelection(ctx, selected, z, opts.showVision);
  }
}

function drawSelection(ctx: CanvasRenderingContext2D, c: Creature, z: number, showVision: boolean): void {
  if (showVision) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.stats.vision, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Dashed selection ring.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2 / z;
  ctx.setLineDash([6 / z, 4 / z]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.stats.radius + 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Energy bar + name above the creature.
  const w = 36;
  const bx = c.x - w / 2;
  const by = c.y - c.stats.radius - 18;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx - 1, by - 1, w + 2, 6);
  const frac = Math.max(0, Math.min(1, c.energy / c.stats.maxEnergy));
  ctx.fillStyle = frac > 0.5 ? "#7fd66a" : frac > 0.25 ? "#e0c04a" : "#e0584a";
  ctx.fillRect(bx, by, w * frac, 4);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(9, 11 / z)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(c.name, c.x, by - 4);
  ctx.textAlign = "left";
}

/** Pick the living creature nearest to a world point, within a tolerance. */
export function pickCreature(world: World, wx: number, wy: number, tol = 24): Creature | null {
  let best: Creature | null = null;
  let bestD = Infinity;
  for (const c of world.creatures) {
    const dx = c.x - wx;
    const dy = c.y - wy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const reach = c.stats.radius + tol;
    if (d < reach && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
