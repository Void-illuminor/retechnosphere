/**
 * Top-level shell. Holds the single persistent World, shows the intro, then the
 * live world with the creature builder layered over it on demand. The world keeps
 * running underneath the builder, so every creature you release joins an ecology
 * that is already alive and evolving.
 */
import { useRef, useState } from "react";
import Builder from "./components/Builder";
import Intro from "./components/Intro";
import WorldView, { FocusRequest } from "./components/WorldView";
import { World } from "./sim/world";

export default function App() {
  const worldRef = useRef<World | null>(null);
  const [version, setVersion] = useState(0); // bump to remount the world view on reset
  const [started, setStarted] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const nonce = useRef(0);

  function ensureWorld(): World {
    if (!worldRef.current) worldRef.current = new World();
    return worldRef.current;
  }

  function enter() {
    ensureWorld();
    setStarted(true);
    setBuilderOpen(true); // design the first creature straight away
  }

  function onReleased(id: number) {
    setBuilderOpen(false);
    nonce.current += 1;
    setFocus({ id, nonce: nonce.current });
  }

  function resetWorld() {
    if (!window.confirm("Discard this world and seed a brand-new one?")) return;
    worldRef.current = new World();
    setFocus(null);
    setBuilderOpen(false);
    setVersion((v) => v + 1);
  }

  if (!started) {
    return (
      <div className="app">
        <Intro onEnter={enter} />
      </div>
    );
  }

  const world = ensureWorld();
  const hasLineages = world.lineages.size > 0;

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
          <span className="hint">drag to pan · scroll to zoom · click a creature to inspect</span>
        </div>
      </div>

      <div className="screen">
        <WorldView
          key={version}
          world={world}
          focus={focus}
          onBuildAnother={() => setBuilderOpen(true)}
          onReset={resetWorld}
        />

        {builderOpen && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              background: "rgba(4,7,12,0.88)",
            }}
          >
            <Builder
              world={world}
              onReleased={onReleased}
              onCancel={() => setBuilderOpen(false)}
              canCancel={hasLineages}
            />
          </div>
        )}
      </div>
    </div>
  );
}
