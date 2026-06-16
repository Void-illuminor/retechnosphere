/**
 * The live world. Owns the canvas and the single requestAnimationFrame loop that
 * both advances the simulation and renders it, plus a pan/zoom camera and all the
 * overlay panels (monitor, inbox, inspector, controls).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, pickCreature, renderWorld, screenToWorld } from "../render/renderWorld";
import { WORLD } from "../sim/constants";
import { Diet } from "../sim/genome";
import { World } from "../sim/world";
import Hud from "./Hud";
import Inbox from "./Inbox";
import Inspector from "./Inspector";

export interface FocusRequest {
  id: number;
  nonce: number;
}

interface Props {
  world: World;
  focus: FocusRequest | null;
  onBuildAnother: () => void;
  onReset: () => void;
}

const SPEEDS = [1, 2, 4, 8];

export default function WorldView({ world, focus, onBuildAnother, onReset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: WORLD.width / 2, y: WORLD.height / 2, zoom: 0.5 });
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const firstFitRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [showVision, setShowVision] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [activeLineageId, setActiveLineageId] = useState<number | null>(null);
  const [lastSeenEventId, setLastSeenEventId] = useState(0);
  const [, setTick] = useState(0);

  // Mirror dynamic state into refs so the animation loop reads the latest values
  // without being torn down and recreated.
  const dyn = useRef({ paused, speed, selectedId, following, showVision });
  dyn.current = { paused, speed, selectedId, following, showVision };

  // --- focus a newly released / chosen creature --------------------------
  useEffect(() => {
    if (!focus) return;
    const c = world.getCreature(focus.id);
    if (c) {
      cameraRef.current.x = c.x;
      cameraRef.current.y = c.y;
      cameraRef.current.zoom = Math.max(cameraRef.current.zoom, 1.1);
      setSelectedId(c.id);
      setActiveLineageId(c.lineageId);
      setFollowing(true);
      setInboxOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // --- the loop ----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;
    let last = 0;
    let uiAccum = 0;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      if (!firstFitRef.current && w > 1) {
        firstFitRef.current = true;
        cameraRef.current.zoom = Math.min(Math.min(w / WORLD.width, h / WORLD.height) * 1.05, 0.9);
        cameraRef.current.zoom = Math.max(cameraRef.current.zoom, 0.22);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    const loop = (now: number) => {
      if (!last) last = now;
      const dt = (now - last) / 1000;
      last = now;

      const d = dyn.current;
      if (!d.paused) world.update(dt, d.speed);

      // Follow the selected creature if asked.
      if (d.following && d.selectedId != null) {
        const c = world.getCreature(d.selectedId);
        if (c) {
          cameraRef.current.x += (c.x - cameraRef.current.x) * 0.12;
          cameraRef.current.y += (c.y - cameraRef.current.y) * 0.12;
        }
      }
      clampCamera(cameraRef.current);

      const { w, h, dpr } = sizeRef.current;
      renderWorld(ctx, world, cameraRef.current, {
        viewW: w,
        viewH: h,
        dpr,
        selectedId: d.selectedId,
        showVision: d.showVision,
      });

      // Refresh the React panels a few times a second.
      uiAccum += dt;
      if (uiAccum > 0.2) {
        uiAccum = 0;
        setTick((t) => (t + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  // --- pointer interaction ----------------------------------------------
  const drag = useRef({ active: false, moved: 0, lastX: 0, lastY: 0 });

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { active: true, moved: 0, lastX: e.clientX, lastY: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.current.moved > 4) {
      const cam = cameraRef.current;
      cam.x -= dx / cam.zoom;
      cam.y -= dy / cam.zoom;
      if (following) setFollowing(false);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const wasClick = drag.current.moved < 5;
    drag.current.active = false;
    if (!wasClick) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const world_ = screenToWorld(cameraRef.current, w, h, e.clientX - rect.left, e.clientY - rect.top);
    const hit = pickCreature(world, world_.x, world_.y);
    if (hit) {
      setSelectedId(hit.id);
      if (hit.lineageId >= 0) setActiveLineageId(hit.lineageId);
    } else {
      setSelectedId(null);
    }
  }
  function onWheel(e: React.WheelEvent) {
    const cam = cameraRef.current;
    const { w, h } = sizeRef.current;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const before = screenToWorld(cam, w, h, e.clientX - rect.left, e.clientY - rect.top);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    cam.zoom = Math.max(0.18, Math.min(3.2, cam.zoom * factor));
    const after = screenToWorld(cam, w, h, e.clientX - rect.left, e.clientY - rect.top);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }

  function fitView() {
    const { w, h } = sizeRef.current;
    cameraRef.current.x = WORLD.width / 2;
    cameraRef.current.y = WORLD.height / 2;
    cameraRef.current.zoom = Math.max(0.22, Math.min(Math.min(w / WORLD.width, h / WORLD.height) * 1.05, 0.9));
    setFollowing(false);
  }

  function spawnWild() {
    const diet: Diet = Math.random() < 0.7 ? "herbivore" : "carnivore";
    world.spawnWild(diet);
  }

  const selected = selectedId != null ? world.getCreature(selectedId) ?? null : null;
  const unread = world.events.filter((e) => e.id > lastSeenEventId).length;
  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);

  return (
    <div className="world">
      <canvas
        ref={canvasRef}
        className="field"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />

      <Hud world={world} />

      {inboxOpen ? (
        <Inbox
          world={world}
          activeLineageId={activeLineageId}
          setActiveLineageId={setActiveLineageId}
          lastSeenEventId={lastSeenEventId}
          onSeen={setLastSeenEventId}
          onClose={() => setInboxOpen(false)}
        />
      ) : (
        <button
          className="btn"
          style={{ position: "absolute", top: 10, right: 10, zIndex: 4 }}
          onClick={() => setInboxOpen(true)}
        >
          ✉ Field Reports {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      )}

      <Inspector
        creature={selected}
        selectedId={selectedId}
        following={following}
        onToggleFollow={() => setFollowing((f) => !f)}
        onClose={() => setSelectedId(null)}
      />

      <div className="controls panel">
        <button className="btn small" onClick={() => setPaused((p) => !p)} title="Pause / resume">
          {paused ? "▶" : "⏸"}
        </button>
        <button className="btn small" onClick={cycleSpeed} title="Simulation speed">
          ⏩
        </button>
        <span className="speed-readout">{paused ? "—" : `${speed}×`}</span>
        <span className="sep" />
        <button className="btn small" onClick={fitView} title="Fit whole world">
          ✥ Fit
        </button>
        <button
          className={`btn small ${showVision ? "toggle-on" : ""}`}
          onClick={() => setShowVision((v) => !v)}
          title="Show selected creature's vision range"
        >
          👁 Vision
        </button>
        <span className="sep" />
        <button className="btn small" onClick={spawnWild} title="Drop a random wild creature in">
          🜺 Wild
        </button>
        <button className="btn small primary" onClick={onBuildAnother} title="Design and release another creature">
          ✚ New Creature
        </button>
        <button className="btn small ghost" onClick={onReset} title="Start a fresh world">
          ⟲ Reset
        </button>
      </div>
    </div>
  );
}

function clampCamera(cam: Camera): void {
  cam.x = Math.max(0, Math.min(WORLD.width, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.height, cam.y));
}
