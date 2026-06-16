/**
 * The inbox — TechnoSphere's signature life-event "emails". One tab per
 * bloodline you've founded; each message is something that happened to a member
 * of that line out in the world.
 */
import { useEffect } from "react";
import { formatSimTime } from "../sim/events";
import { World } from "../sim/world";

interface Props {
  world: World;
  activeLineageId: number | null;
  setActiveLineageId: (id: number) => void;
  lastSeenEventId: number;
  onSeen: (maxId: number) => void;
  onClose: () => void;
}

export default function Inbox({
  world,
  activeLineageId,
  setActiveLineageId,
  lastSeenEventId,
  onSeen,
  onClose,
}: Props) {
  const lineages = Array.from(world.lineages.values());
  const events = world.events.filter((e) => e.lineageId === activeLineageId);
  const ordered = [...events].reverse();
  const maxId = world.events.length ? world.events[world.events.length - 1].id : 0;

  // Reading the open inbox marks everything seen.
  useEffect(() => {
    if (maxId > lastSeenEventId) onSeen(maxId);
  }, [maxId, lastSeenEventId, onSeen]);

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

      <div className="tabs">
        {lineages.length === 0 && <span className="hint">no bloodlines yet</span>}
        {lineages.map((l) => {
          const unread = world.events.filter(
            (e) => e.lineageId === l.id && e.id > lastSeenEventId,
          ).length;
          return (
            <div
              key={l.id}
              className={`tab ${l.id === activeLineageId ? "active" : ""} ${l.extinct ? "extinct" : ""}`}
              onClick={() => setActiveLineageId(l.id)}
              title={`${l.founderName} — ${l.diet}`}
            >
              {l.founderName} {l.alive > 0 ? `(${l.alive})` : "✝"}
              {unread > 0 && l.id !== activeLineageId ? (
                <span className="badge" style={{ marginLeft: 5 }}>
                  {unread}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mail-list">
        {ordered.length === 0 && (
          <div className="empty">
            No reports yet. Your creatures are out there — give them time to live, eat,
            and breed.
          </div>
        )}
        {ordered.map((e) => (
          <div
            key={e.id}
            className={`mail k-${e.kind} ${e.id > lastSeenEventId ? "unread" : ""}`}
          >
            <span className="when">t+{formatSimTime(e.time)}</span>
            <div className="subj">{e.headline}</div>
            <div className="body">{e.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
