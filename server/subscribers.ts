/**
 * Subscriber registry. Identity is just an email address (no passwords — this is
 * a trusted family/friends world). Each subscriber gets an opaque token, stored
 * in the browser, used to view "my creatures" and manage email preferences.
 */
import { randomUUID } from "node:crypto";
import { FILES, readJSON, writeJSON } from "./storage";

export interface Subscriber {
  email: string; // lower-cased, the primary key
  displayName: string;
  token: string;
  dailyDigest: boolean;
  createdAtMs: number;
  lastDigestAtMs: number;
}

let subscribers: Map<string, Subscriber> = new Map();

export function loadSubscribers(): void {
  const list = readJSON<Subscriber[]>(FILES.subscribers, []);
  subscribers = new Map(list.map((s) => [s.email, s]));
}

function persist(): void {
  writeJSON(FILES.subscribers, [...subscribers.values()]);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getByEmail(email: string): Subscriber | undefined {
  return subscribers.get(normalizeEmail(email));
}

export function getByToken(token: string): Subscriber | undefined {
  for (const s of subscribers.values()) if (s.token === token) return s;
  return undefined;
}

/** Create the subscriber if new, otherwise refresh their display name. */
export function upsert(email: string, displayName: string): Subscriber {
  const key = normalizeEmail(email);
  let sub = subscribers.get(key);
  const now = Date.now();
  if (!sub) {
    sub = {
      email: key,
      displayName: displayName.trim() || key.split("@")[0],
      token: randomUUID(),
      dailyDigest: true,
      createdAtMs: now,
      // Start the digest clock now so the first digest arrives ~one interval later.
      lastDigestAtMs: now,
    };
    subscribers.set(key, sub);
  } else if (displayName.trim()) {
    sub.displayName = displayName.trim();
  }
  persist();
  return sub;
}

export function setDailyDigest(token: string, on: boolean): Subscriber | undefined {
  const sub = getByToken(token);
  if (!sub) return undefined;
  sub.dailyDigest = on;
  persist();
  return sub;
}

export function markDigestSent(email: string, atMs: number): void {
  const sub = subscribers.get(normalizeEmail(email));
  if (sub) {
    sub.lastDigestAtMs = atMs;
    persist();
  }
}

export function allSubscribers(): Subscriber[] {
  return [...subscribers.values()];
}
