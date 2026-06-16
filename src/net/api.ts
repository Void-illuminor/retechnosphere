/** Browser-side client for the reTechnoSphere server API. */
import type { Genome } from "../sim/genome";
import type { ClientState } from "../sim/wire";

export interface StoredEventDTO {
  id: number;
  simTime: number;
  wallMs: number;
  kind: string;
  headline: string;
  body: string;
  lineageId: number;
  notable: boolean;
}

export interface MyLineage {
  id: number;
  founderName: string;
  diet: "herbivore" | "carnivore";
  alive: number;
  bestGeneration: number;
  extinct: boolean;
}

export interface MeInfo {
  email: string;
  displayName: string;
  dailyDigest: boolean;
  lineages: MyLineage[];
}

export interface ReleaseResult {
  creatureId: number;
  lineageId: number;
  token: string;
  displayName: string;
}

export interface ReleasePayload extends Genome {
  name: string;
  displayName: string;
  email: string;
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function jpost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `${res.status}`);
  return data as T;
}

export const api = {
  state: () => jget<ClientState>("/api/state"),
  events: (lineage: number, since = 0) =>
    jget<{ events: StoredEventDTO[] }>(`/api/events?lineage=${lineage}&since=${since}`),
  release: (payload: ReleasePayload) => jpost<ReleaseResult>("/api/release", payload),
  me: (token: string) => jget<MeInfo>(`/api/me?token=${encodeURIComponent(token)}`),
  setPrefs: (token: string, dailyDigest: boolean) =>
    jpost<{ ok: boolean; dailyDigest: boolean }>("/api/prefs", { token, dailyDigest }),
};

// --- small localStorage helpers for the visitor's identity token ----------
const TOKEN_KEY = "rts_token";
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
  },
};
