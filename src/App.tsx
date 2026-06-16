/**
 * Top-level shell for the shared world. Handles the intro, the visitor's
 * identity token, the builder overlay, and focusing a newly released creature.
 * The world itself lives on the server; this is just the window onto it.
 */
import { useCallback, useEffect, useState } from "react";
import Builder from "./components/Builder";
import Intro from "./components/Intro";
import WorldView, { FocusRequest } from "./components/WorldView";
import { MeInfo, ReleaseResult, api, tokenStore } from "./net/api";

export default function App() {
  const [started, setStarted] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [me, setMe] = useState<MeInfo | null>(null);
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
    setFocus({ id: result.creatureId, lineageId: result.lineageId, nonce: Date.now() });
  }

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* clipboard blocked; ignore */
      },
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
          <span className="sub">shared digital ecology</span>
        </div>
        <div className="gap">
          <span className="hint">drag to pan · scroll to zoom · click a creature</span>
          <button className="btn small" onClick={share}>
            {copied ? "✓ Link copied" : "🔗 Share world"}
          </button>
        </div>
      </div>

      <div className="screen">
        <WorldView
          me={me}
          token={token}
          focus={focus}
          onBuildAnother={() => setBuilderOpen(true)}
          onPrefsChanged={() => token && fetchMe(token)}
        />

        {builderOpen && (
          <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(4,7,12,0.9)" }}>
            <Builder me={me} onReleased={onReleased} onCancel={() => setBuilderOpen(false)} canCancel={hasLineages} />
          </div>
        )}
      </div>
    </div>
  );
}
