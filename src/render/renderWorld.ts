/**
 * Renders the streamed world to a canvas: the cached fractal-savanna terrain
 * (reconstructed locally from the world seed), the plants, and every creature
 * (drawn from its genome). The client supplies extrapolated positions; this
 * module just draws what it's given.
 */
import type { Genome } from "../sim/genome";
import { Biome, Terrain } from "../sim/terrain";
import type { Diet } from "../sim/genome";
import { drawCreature } from "./drawCreature";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Everything the renderer needs about one creature (a superset of the wire shape). */
export interface RenderCreature {
  id: number;
  x: number;
  y: number;
  angle: number;
  diet: Diet;
  hue: number;
  accent: number;
  sizeGene: number;
  parts: { head: string; body: string; locomotion: string; eyes: string; mouth: string };
  radius: number;
  ef: number;
  lineageId: number;
  founder: boolean;
  name: string;
}

export interface RenderModel {
  creatures: readonly RenderCreature[];
  plants: readonly { x: number; y: number; g: number }[];
  /** lineageId -> hue, for bloodline highlight rings. */
  lineageHue: Map<number, number>;
  /** lineage ids belonging to the current visitor. */
  mine: Set<number>;
}

export interface RenderOpts {
  viewW: number;
  viewH: number;
  dpr: number;
  selectedId: number | null;
  showVision: boolean;
  vision?: number; // selected creature's vision radius (from the wire genome if known)
}

const terrainCache = new WeakMap<Terrain, HTMLCanvasElement>();

function biomeColor(biome: Biome, h: number): string {
  switch (biome) {
    case "water":
      return `hsl(205, 45%, ${22 + h * 30}%)`;
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
      if (((c * 31 + r * 17) & 7) === 0 && cell.biome !== "water") {
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(c * cs + (r % 3) * 4, r * cs + (c % 3) * 4, 3, 3);
      }
    }
  }
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

export function screenToWorld(cam: Camera, viewW: number, viewH: number, sx: number, sy: number) {
  return {
    x: (sx - viewW / 2) / cam.zoom + cam.x,
    y: (sy - viewH / 2) / cam.zoom + cam.y,
  };
}

function genomeOf(c: RenderCreature): Genome {
  return { diet: c.diet, parts: c.parts, hue: c.hue, accent: c.accent, sizeGene: c.sizeGene, vigor: 1 };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  model: RenderModel,
  terrain: Terrain,
  cam: Camera,
  opts: RenderOpts,
): void {
  const { viewW, viewH, dpr, selectedId } = opts;
  const z = cam.zoom;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, viewW * dpr, viewH * dpr);
  ctx.setTransform(z * dpr, 0, 0, z * dpr, (viewW / 2 - cam.x * z) * dpr, (viewH / 2 - cam.y * z) * dpr);

  const halfW = viewW / 2 / z;
  const halfH = viewH / 2 / z;
  const minX = cam.x - halfW - 40;
  const maxX = cam.x + halfW + 40;
  const minY = cam.y - halfH - 40;
  const maxY = cam.y + halfH + 40;

  ctx.imageSmoothingEnabled = z < 1;
  ctx.drawImage(getTerrainCanvas(terrain), 0, 0);

  for (const p of model.plants) {
    if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
    const ripe = p.g >= 1;
    const r = 2 + p.g * 3.2;
    ctx.fillStyle = ripe ? "#cfe06a" : "#6f8a3c";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  let selected: RenderCreature | null = null;
  for (const c of model.creatures) {
    if (c.id === selectedId) selected = c;
    if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;

    const hue = model.lineageHue.get(c.lineageId);
    if (hue !== undefined) {
      const mine = model.mine.has(c.lineageId);
      ctx.strokeStyle = mine ? `hsla(${hue},95%,72%,0.95)` : `hsla(${hue},70%,65%,0.7)`;
      ctx.lineWidth = (mine ? 2.5 : 1.5) / z;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawCreature(ctx, genomeOf(c), c.x, c.y, {
      size: c.radius,
      angle: c.angle,
      detail: c.radius * z > 13,
    });
  }

  if (selected) drawSelection(ctx, selected, z, opts.showVision, opts.vision);
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  c: RenderCreature,
  z: number,
  showVision: boolean,
  vision?: number,
): void {
  if (showVision && vision) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    ctx.arc(c.x, c.y, vision, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2 / z;
  ctx.setLineDash([6 / z, 4 / z]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.radius + 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const w = 36;
  const bx = c.x - w / 2;
  const by = c.y - c.radius - 18;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx - 1, by - 1, w + 2, 6);
  ctx.fillStyle = c.ef > 0.5 ? "#7fd66a" : c.ef > 0.25 ? "#e0c04a" : "#e0584a";
  ctx.fillRect(bx, by, w * Math.max(0, Math.min(1, c.ef)), 4);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(9, 11 / z)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(c.name, c.x, by - 4);
  ctx.textAlign = "left";
}

export function pickCreature(creatures: readonly RenderCreature[], wx: number, wy: number, tol = 24) {
  let best: RenderCreature | null = null;
  let bestD = Infinity;
  for (const c of creatures) {
    const dx = c.x - wx;
    const dy = c.y - wy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < c.radius + tol && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
