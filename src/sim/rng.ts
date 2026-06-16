/**
 * Small, fast, seedable PRNG (mulberry32) so the world is reproducible.
 * The original TechnoSphere ran a single shared deterministic-ish world;
 * a seeded RNG lets us recreate that feel and debug emergent behaviour.
 */
export class Rng {
  private state: number;

  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Current internal state, for serialization. */
  getState(): number {
    return this.state >>> 0;
  }

  /** Restore a previously captured state. */
  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns true with the given probability. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a uniformly random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Gaussian-ish jitter centred on 0 (sum of uniforms, range ~[-1,1]). */
  jitter(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
}
