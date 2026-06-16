/**
 * Fractal terrain. The original described its world as a "fractal savanna", so
 * we build a height field from several octaves of value noise. Height maps to a
 * biome (water / sand / savanna / scrub / rock), and biome controls fertility —
 * plants only sprout on fertile ground, which makes herbivores congregate and
 * gives the landscape real consequence.
 */
import { Rng } from "./rng";
import { clamp, lerp } from "./vec";

export type Biome = "water" | "sand" | "savanna" | "scrub" | "rock";

export interface TerrainCell {
  height: number; // 0..1
  biome: Biome;
  fertility: number; // 0..1, chance-weight for plant growth
}

export class Terrain {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  readonly cells: TerrainCell[]; // row-major

  constructor(width: number, height: number, rng: Rng, cellSize = 20) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    this.generate(rng);
  }

  private generate(rng: Rng): void {
    // Build a few octaves of value noise on coarse grids, then bilinearly
    // sample them per cell and sum — cheap, dependency-free fractal noise.
    const octaves = [
      { freq: 4, amp: 1.0 },
      { freq: 8, amp: 0.5 },
      { freq: 16, amp: 0.25 },
      { freq: 32, amp: 0.13 },
    ];
    const grids = octaves.map((o) => makeGrid(o.freq, o.freq, rng));
    const ampSum = octaves.reduce((s, o) => s + o.amp, 0);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const u = c / this.cols;
        const v = r / this.rows;
        let h = 0;
        for (let i = 0; i < octaves.length; i++) {
          h += sampleGrid(grids[i], octaves[i].freq, u, v) * octaves[i].amp;
        }
        h /= ampSum;

        // Radial falloff so the map tends to be land in the middle, water at
        // the edges — gives a contained "island continent" feel.
        const dx = u - 0.5;
        const dy = v - 0.5;
        const edge = Math.sqrt(dx * dx + dy * dy) * 1.35;
        h = clamp(h * 1.15 - edge * 0.45 + 0.18, 0, 1);

        this.cells[r * this.cols + c] = classify(h);
      }
    }
  }

  cellAt(x: number, y: number): TerrainCell {
    const c = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const r = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return this.cells[r * this.cols + c];
  }

  biomeAt(x: number, y: number): Biome {
    return this.cellAt(x, y).biome;
  }

  isWater(x: number, y: number): boolean {
    return this.cellAt(x, y).biome === "water";
  }
}

function classify(h: number): TerrainCell {
  let biome: Biome;
  let fertility: number;
  if (h < 0.3) {
    biome = "water";
    fertility = 0;
  } else if (h < 0.36) {
    biome = "sand";
    fertility = 0.15;
  } else if (h < 0.62) {
    biome = "savanna";
    fertility = 1;
  } else if (h < 0.78) {
    biome = "scrub";
    fertility = 0.5;
  } else {
    biome = "rock";
    fertility = 0.05;
  }
  return { height: h, biome, fertility };
}

// --- value-noise helpers ----------------------------------------------------

function makeGrid(w: number, h: number, rng: Rng): Float32Array {
  const g = new Float32Array((w + 1) * (h + 1));
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  return g;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

function sampleGrid(grid: Float32Array, freq: number, u: number, v: number): number {
  const stride = freq + 1;
  const x = u * freq;
  const y = v * freq;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, freq);
  const y1 = Math.min(y0 + 1, freq);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = grid[y0 * stride + x0];
  const b = grid[y0 * stride + x1];
  const c = grid[y1 * stride + x0];
  const d = grid[y1 * stride + x1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}
