/**
 * Top-level shell. Original-style flow: intro → your creature roster → click a
 * creature for its dossier. The world simulates on the server; this is the
 * window onto your bloodlines.
 */
import { useCallback, useEffect, useState } from "react";
import Builder from "./components/Builder";
import CreatureDetail from "./components/CreatureDetail";
import Intro from "./components/Intro";
import Roster from "./components/Roster";
import { MeInfo, ReleaseResult, api, tokenStore } from "./net/api";

export default function App() {
  const [started, setStarted] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [me, setMe] = useState<MeInfo | null>(null);
  const [selectedCreatureId, setSelectedCreatureId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMe = useCallback(async (tok: string) => {
    try {
      setMe(await api.me(tok));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (token) fetchMe(token);
  }, [token, fetchMe]);

  function enter() {
    setStarted(true);
    setBuilderOpen(!(me && me.lineages.length > 0));
  }

  function onReleased(result: ReleaseResult) {
    setToken(result.token);
    fetchMe(result.token);
    setBuilderOpen(false);
    setSelectedCreatureId(result.creatureId);
  }

  function toggleDigest() {
    if (!token || !me) return;
    api.setPrefs(token, !me.dailyDigest).then(() => fetchMe(token));
  }

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  }

  if (!started) {
    return (
      <div className="app">
        <Intro onEnter={enter} returning={!!(me && me.lineages.length > 0)} />
      </div>
    );
  }

  const hasLineages = !!(me && me.lineages.length > 0);

  return (
    <div className="app">
      <div className="topbar">
        <div className="gap">
          <div className="brand title">
            <span className="re">re</span>
            <span className="rest">TechnoSphere</span>
          </div>
          <span className="sub">digital ecology</span>
        </div>
        <div className="gap">
          <button className="btn small" onClick={share}>
            {copied ? "✓ Link copied" : "🔗 Share world"}
          </button>
        </div>
      </div>

      <div className="screen">
        {selectedCreatureId != null ? (
          <CreatureDetail
            id={selectedCreatureId}
            onOpenCreature={setSelectedCreatureId}
            onBack={() => setSelectedCreatureId(null)}
          />
        ) : (
          <Roster
            token={token}
            me={me}
            onOpenCreature={setSelectedCreatureId}
            onBuild={() => setBuilderOpen(true)}
            onToggleDigest={toggleDigest}
          />
        )}

        {builderOpen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(4,7,12,0.92)" }}>
            <Builder me={me} onReleased={onReleased} onCancel={() => setBuilderOpen(false)} canCancel={hasLineages} />
          </div>
        )}
      </div>
    </div>
  );
}
