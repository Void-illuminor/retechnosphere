/**
 * Field Reports — TechnoSphere's signature life-event "emails", now shared. One
 * tab per bloodline in the world (yours first), backed by the server's durable
 * event log. Also hosts the daily-email toggle for the signed-in visitor.
 */
import { useEffect, useState } from "react";
import { MeInfo, StoredEventDTO, api } from "../net/api";
import { formatSimTime } from "../sim/events";
import type { ClientLineage } from "../sim/wire";

interface Props {
  lineages: ClientLineage[];
  mine: Set<number>;
  me: MeInfo | null;
  token: string | null;
  activeLineageId: number | null;
  setActiveLineageId: (id: number) => void;
  onClose: () => void;
  onPrefsChanged: () => void;
}

export default function Inbox({
  lineages,
  mine,
  me,
  token,
  activeLineageId,
  setActiveLineageId,
  onClose,
  onPrefsChanged,
}: Props) {
  const [events, setEvents] = useState<StoredEventDTO[]>([]);

  // Mine first, then living bloodlines, then the rest.
  const sorted = [...lineages].sort((a, b) => {
    const am = mine.has(a.id) ? 1 : 0;
    const bm = mine.has(b.id) ? 1 : 0;
    if (am !== bm) return bm - am;
    return b.alive - a.alive;
  });

  useEffect(() => {
    if (activeLineageId == null) {
      setEvents([]);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const r = await api.events(activeLineageId);
        if (alive) setEvents(r.events);
      } catch {
        /* ignore transient errors */
      }
    };
    load();
    const iv = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [activeLineageId]);

  async function toggleDigest() {
    if (!token || !me) return;
    await api.setPrefs(token, !me.dailyDigest);
    onPrefsChanged();
  }

  return (
    <div className="inbox panel">
      <div className="titlebar spread">
        <span>
          <span className="dot" /> ✉ Field Reports
        </span>
        <button className="btn small ghost" onClick={onClose}>
          ✕
        </button>
      </div>

      {me ? (
        <div className="spread" style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", fontSize: 11 }}>
          <span className="hint">
            Daily email → <strong style={{ color: "var(--ink)" }}>{me.email}</strong>
          </span>
          <button className={`btn small ${me.dailyDigest ? "toggle-on" : "ghost"}`} onClick={toggleDigest}>
            {me.dailyDigest ? "On" : "Off"}
          </button>
        </div>
      ) : (
        <div className="hint" style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)" }}>
          Release a creature to receive daily email field reports.
        </div>
      )}

      <div className="tabs">
        {sorted.length === 0 && <span className="hint">no bloodlines yet</span>}
        {sorted.map((l) => (
          <div
            key={l.id}
            className={`tab ${l.id === activeLineageId ? "active" : ""} ${l.extinct ? "extinct" : ""}`}
            onClick={() => setActiveLineageId(l.id)}
            title={`${l.founderName}${l.ownerName ? ` — ${l.ownerName}` : ""} (${l.diet})`}
          >
            {mine.has(l.id) ? "★ " : ""}
            {l.founderName} {l.alive > 0 ? `(${l.alive})` : "✝"}
          </div>
        ))}
      </div>

      <div className="mail-list">
        {activeLineageId == null && <div className="empty">Pick a bloodline to read its reports.</div>}
        {activeLineageId != null && events.length === 0 && (
          <div className="empty">No reports yet. Give it time — life, death and breeding take a while.</div>
        )}
        {events.map((e) => (
          <div key={e.id} className={`mail k-${e.kind}`}>
            <span className="when">t+{formatSimTime(e.simTime)}</span>
            <div className="subj">{e.headline}</div>
            <div className="body">{e.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
