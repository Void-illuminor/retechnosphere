/**
 * The roster — the heart of the reverted, original-style UI. Your bloodlines and
 * every creature in them (alive or dead). Click a creature to open its dossier.
 * A side feed shows recent field reports across all your creatures.
 */
import { useEffect, useState } from "react";
import { CreatureSummaryDTO, MeInfo, StoredEventDTO, api } from "../net/api";
import { formatSimTime } from "../sim/events";
import type { ClientState } from "../sim/wire";
import CreaturePortrait from "./CreaturePortrait";

interface Props {
  token: string | null;
  me: MeInfo | null;
  onOpenCreature: (id: number) => void;
  onBuild: () => void;
  onToggleDigest: () => void;
}

function dietLabel(d: string): string {
  return d === "carnivore" ? "Prowler" : "Grazer";
}

export default function Roster({ token, me, onOpenCreature, onBuild, onToggleDigest }: Props) {
  const [creatures, setCreatures] = useState<CreatureSummaryDTO[]>([]);
  const [feed, setFeed] = useState<StoredEventDTO[]>([]);
  const [state, setState] = useState<ClientState | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [st, cr, fd] = await Promise.all([
          api.state(),
          token ? api.creatures(token) : Promise.resolve({ creatures: [] }),
          token ? api.feed(token) : Promise.resolve({ events: [] }),
        ]);
        if (!alive) return;
        setState(st);
        setCreatures(cr.creatures);
        setFeed(fd.events);
      } catch {
        /* transient */
      }
    };
    load();
    const iv = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [token]);

  const lineages = me?.lineages ?? [];
  const s = state?.stats;

  return (
    <div className="roster">
      <div className="roster-head panel">
        <div className="gap" style={{ flexWrap: "wrap" }}>
          <strong style={{ color: "var(--accent)", letterSpacing: 1 }}>◈ THE SPHERE</strong>
          {s && (
            <span className="hint">
              age {formatSimTime(state!.time)} · <span style={{ color: "var(--accent-2)" }}>{s.herbivores} grazers</span> ·{" "}
              <span style={{ color: "var(--accent-3)" }}>{s.carnivores} prowlers</span> · gen {s.generation} · {s.population} alive
            </span>
          )}
        </div>
        <div className="gap">
          {me && (
            <span className="hint">
              digest → {me.email}{" "}
              <button className={`btn small ${me.dailyDigest ? "toggle-on" : "ghost"}`} onClick={onToggleDigest}>
                {me.dailyDigest ? "on" : "off"}
              </button>
            </span>
          )}
          <button className="btn small primary" onClick={onBuild}>
            ✚ New Creature
          </button>
        </div>
      </div>

      <div className="roster-body">
        <div className="roster-main scroll">
          {creatures.length === 0 && (
            <div className="empty" style={{ padding: 40 }}>
              You haven't released any creatures yet.
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={onBuild}>
                  ✚ Build your first creature
                </button>
              </div>
            </div>
          )}

          {lineages.map((line) => {
            const members = creatures.filter((c) => c.lineageId === line.id);
            if (members.length === 0) return null;
            const aliveCount = members.filter((c) => c.alive).length;
            return (
              <div key={line.id} className="bloodline">
                <h3 className="bloodline-head">
                  <span className={line.diet === "carnivore" ? "carn" : "herb"}>
                    {line.founderName}
                  </span>
                  <span className="hint">
                    {dietLabel(line.diet)} bloodline · {aliveCount} alive / {members.length} total · best gen {line.bestGeneration}
                  </span>
                </h3>
                <div className="creature-grid">
                  {members.map((c) => (
                    <button key={c.id} className={`creature-card ${c.alive ? "" : "is-dead"}`} onClick={() => onOpenCreature(c.id)}>
                      <CreaturePortrait portrait={c} size={92} dead={!c.alive} />
                      <div className="cc-name">
                        {c.name}
                        {c.id === c.lineageId ? <span title="founder" style={{ color: "var(--accent)" }}> ★</span> : null}
                      </div>
                      <div className="cc-sub">
                        {dietLabel(c.diet)} · gen {c.generation}
                      </div>
                      {c.alive ? (
                        <>
                          <div className="bar cc-bar">
                            <span
                              style={{
                                width: `${Math.round((c.energyFrac ?? 0) * 100)}%`,
                                background:
                                  (c.energyFrac ?? 0) > 0.5
                                    ? "linear-gradient(90deg,#3fa35a,#7fd66a)"
                                    : (c.energyFrac ?? 0) > 0.25
                                      ? "#e0c04a"
                                      : "#e0584a",
                              }}
                            />
                          </div>
                          <div className="cc-meta">age {formatSimTime(c.age)} · {c.offspringCount} young</div>
                        </>
                      ) : (
                        <div className="cc-meta dead">✝ {c.cause ?? "died"} · lived {formatSimTime(c.age)}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="roster-feed panel">
          <div className="titlebar">
            <span className="dot" /> ✉ Field Reports
          </div>
          <div className="mail-list">
            {feed.length === 0 && <div className="empty">No reports yet. Give your creatures time to live.</div>}
            {feed.map((e) => (
              <button key={e.id} className={`mail mail-btn k-${e.kind}`} onClick={() => onOpenCreature(e.creatureId)}>
                <span className="when">t+{formatSimTime(e.simTime)}</span>
                <div className="subj">{e.headline}</div>
                <div className="body">{e.body}</div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
