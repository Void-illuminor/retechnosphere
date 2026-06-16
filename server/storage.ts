/**
 * Tiny file-based persistence. For a single shared world and a family-sized
 * subscriber list, JSON files on a persistent disk are simpler and more robust
 * than a database engine (no native modules to compile). Writes are atomic
 * (write to a temp file, then rename) so a crash mid-write can't corrupt data.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

let ready = false;

export function ensureDataDir(): void {
  if (ready) return;
  fs.mkdirSync(config.dataDir, { recursive: true });
  ready = true;
}

function filePath(name: string): string {
  return path.join(config.dataDir, name);
}

export function readJSON<T>(name: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(name: string, data: unknown): void {
  ensureDataDir();
  const target = filePath(name);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, target);
}

export const FILES = {
  world: "world.json",
  subscribers: "subscribers.json",
  events: "events.json",
} as const;
