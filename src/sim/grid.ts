/**
 * A uniform spatial hash for "what's near me" queries. Rebuilt each simulation
 * step. Keeps sensing roughly O(n) instead of O(n^2) as the population grows.
 */
export interface HasPos {
  x: number;
  y: number;
}

export class SpatialHash {
  private cell: number;
  private cols: number;
  private rows: number;
  private buckets: number[][];

  constructor(width: number, height: number, cell: number) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear(): void {
    for (const b of this.buckets) b.length = 0;
  }

  private index(x: number, y: number): number {
    let cx = Math.floor(x / this.cell);
    let cy = Math.floor(y / this.cell);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** Insert item at the given source-array index. */
  insert(itemIndex: number, x: number, y: number): void {
    this.buckets[this.index(x, y)].push(itemIndex);
  }

  build(items: readonly HasPos[]): void {
    this.clear();
    for (let i = 0; i < items.length; i++) {
      this.insert(i, items[i].x, items[i].y);
    }
  }

  /** Invoke cb with every item index within `radius` cells of (x, y). */
  query(x: number, y: number, radius: number, cb: (itemIndex: number) => void): void {
    const r = Math.ceil(radius / this.cell);
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let gy = cy - r; gy <= cy + r; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - r; gx <= cx + r; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        const bucket = this.buckets[gy * this.cols + gx];
        for (let k = 0; k < bucket.length; k++) cb(bucket[k]);
      }
    }
  }
}
