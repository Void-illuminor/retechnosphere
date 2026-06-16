/**
 * A creature's dossier — the original-style "look up your creature" page: a big
 * portrait, its stats and tallies, its family (parents + offspring, clickable to
 * navigate the tree), and its full life story of encounters.
 */
import { useEffect, useState } from "react";
import { CreatureDetail as Detail, CreatureSummaryDTO, api } from "../net/api";
import { formatSimTime } from "../sim/events";
import CreaturePortrait from "./CreaturePortrait";
import StatBars from "./StatBars";

interface Props {
  id: number;
  onOpenCreature: (id: number) => void;
  onBack: () => void;
}

function dietLabel(d: string): string {
  return d === "carnivore" ? "Prowler" : "Grazer";
}

function Chip({ c, onOpen }: { c: CreatureSummaryDTO; onOpen: (id: number) => void }) {
  const clickable = !c.wild;
  return (
    <button
      className={`chip ${clickable ? "" : "chip-wild"}`}
      onClick={() => clickable && onOpen(c.id)}
      disabled={!clickable}
      title={c.wild ? "a wild ancestor" : c.name}
    >
      <CreaturePortrait portrait={c} size={52} dead={!c.alive && !c.wild} />
      <div className="chip-name">
        {c.name}
        {c.wild ? <span className="hint"> (wild)</span> : null}
      </div>
      <div className="chip-sub">gen {c.generation}</div>
    </button>
  );
}

export default function CreatureDetail({ id, onOpenCreature, onBack }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError("");
    const load = async () => {
      try {
        const d = await api.creature(id);
        if (alive) setDetail(d);
      } catch {
        if (alive) setError("This creature could not be found.");
      }
    };
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  if (error) {
    return (
      <div className="detail">
        <button className="btn small ghost" onClick={onBack}>← Back to roster</button>
        <div className="empty" style={{ padding: 40 }}>{error}</div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="detail">
        <button className="btn small ghost" onClick={onBack}>← Back to roster</button>
        <div className="empty" style={{ padding: 40 }}>
          <span className="blink">◌</span> loading dossier…
        </div>
      </div>
    );
  }

  const c = detail.creature;
  const carn = c.diet === "carnivore";
  const founder = c.id === c.lineageId;
  const story = [...detail.events].reverse(); // chronological

  return (
    <div className="detail scroll">
      <button className="btn small ghost" onClick={onBack}>← Back to roster</button>

      <div className="detail-top">
        <div className="panel detail-hero">
          <CreaturePortrait portrait={c} size={200} dead={!c.alive} />
          <div className="detail-id">
            <div className="detail-name">{c.name}</div>
            <div className={`ctype ${carn ? "carn" : "herb"}`}>
              {dietLabel(c.diet)} · generation {c.generation}
              {founder ? " · founder ★" : ""}
            </div>
            {c.alive ? (
              <>
                <div className="bar" style={{ marginTop: 10, width: 200 }}>
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
                <div className="hint" style={{ marginTop: 4 }}>
                  alive · age {formatSimTime(c.age)} · {Math.round((c.energyFrac ?? 0) * 100)}% energy
                </div>
              </>
            ) : (
              <div className="dead" style={{ marginTop: 10 }}>
                ✝ {c.cause ?? "died"} · lived {formatSimTime(c.age)}
              </div>
            )}
          </div>
        </div>

        <div className="panel detail-stats">
          <div className="titlebar"><span className="dot" /> Specimen</div>
          <div style={{ padding: 10 }}>
            <StatBars stats={detail.stats} diet={c.diet} />
            <div className="tallies">
              <span>🍽 {c.meals} meals</span>
              {carn ? <span>🦷 {c.kills} kills</span> : null}
              <span>🥚 {c.offspringCount} offspring</span>
              <span>born t+{formatSimTime(c.bornTime)}</span>
              {c.diedTime != null ? <span>died t+{formatSimTime(c.diedTime)}</span> : null}
            </div>
          </div>
        </div>
      </div>

      {(detail.parents.length > 0 || detail.offspring.length > 0) && (
        <div className="panel detail-family">
          <div className="titlebar"><span className="dot" /> Lineage</div>
          <div style={{ padding: 10 }}>
            {detail.parents.length > 0 && (
              <>
                <div className="fam-label">Parents</div>
                <div className="chip-row">
                  {detail.parents.map((p) => <Chip key={p.id} c={p} onOpen={onOpenCreature} />)}
                </div>
              </>
            )}
            {detail.offspring.length > 0 && (
              <>
                <div className="fam-label">Offspring ({detail.offspring.length})</div>
                <div className="chip-row">
                  {detail.offspring.map((o) => <Chip key={o.id} c={o} onOpen={onOpenCreature} />)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="panel detail-story">
        <div className="titlebar"><span className="dot" /> Life story</div>
        <div className="mail-list" style={{ maxHeight: "none" }}>
          {story.length === 0 && <div className="empty">No encounters recorded yet.</div>}
          {story.map((e) => (
            <div key={e.id} className={`mail k-${e.kind}`}>
              <span className="when">t+{formatSimTime(e.simTime)}</span>
              <div className="subj">{e.headline}</div>
              <div className="body">{e.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
