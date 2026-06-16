/**
 * The live shared world. Polls the server ~once a second for authoritative
 * state and smoothly dead-reckons creature motion between polls so the world
 * looks alive at 60fps without heavy bandwidth. Camera, selection and follow are
 * purely local; the simulation itself lives on the server.
 */
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  RenderCreature,
  pickCreature,
  renderWorld,
  screenToWorld,
} from "../render/renderWorld";
import { MeInfo, api } from "../net/api";
import { deriveStats } from "../sim/genome";
import { Rng } from "../sim/rng";
import { Terrain } from "../sim/terrain";
import type { ClientLineage, ClientState } from "../sim/wire";
import Hud from "./Hud";
import Inbox from "./Inbox";
import Inspector from "./Inspector";

export interface FocusRequest {
  id: number;
  lineageId: number;
  nonce: number;
}

interface Props {
  me: MeInfo | null;
  token: string | null;
  focus: FocusRequest | null;
  onBuildAnother: () => void;
  onPrefsChanged: () => void;
}

type ModelCreature = RenderCreature & {
  tx: number;
  ty: number;
  tAngle: number;
  tSpeed: number;
  stamp: number;
  // extra inspector fields carried from the wire
  ef: number;
  beh: string;
  gen: number;
  diet: "herbivore" | "carnivore";
  age: number;
  meals: number;
  kills: number;
  offspring: number;
};

export default function WorldView({ me, token, focus, onBuildAnother, onPrefsChanged }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 1300, y: 900, zoom: 0.5 });
  const sizeRef = useRef({ w: 1, h: 1, dpr: 1 });
  const firstFitRef = useRef(false);

  const modelRef = useRef<Map<number, ModelCreature>>(new Map());
  const plantsRef = useRef<{ x: number; y: number; g: number }[]>([]);
  const stateRef = useRef<ClientState | null>(null);
  const terrainRef = useRef<Terrain | null>(null);
  const seedRef = useRef<number | null>(null);
  const lineageHueRef = useRef<Map<number, number>>(new Map());

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [showVision, setShowVision] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(true);
  const [activeLineageId, setActiveLineageId] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0);

  const mineRef = useRef<Set<number>>(new Set());
  mineRef.current = new Set((me?.lineages ?? []).map((l) => l.id));

  // --- polling -----------------------------------------------------------
  useEffect(() => {
    let alive = true;
    const ingest = (s: ClientState) => {
      stateRef.current = s;
      plantsRef.current = s.plants;
      lineageHueRef.current = new Map(s.lineages.map((l: ClientLineage) => [l.id, l.hue]));
      if (seedRef.current !== s.seed) {
        seedRef.current = s.seed;
        terrainRef.current = new Terrain(s.width, s.height, new Rng(s.seed));
      }
      const now = performance.now();
      const model = modelRef.current;
      const seen = new Set<number>();
      for (const c of s.creatures) {
        seen.add(c.id);
        const m = model.get(c.id);
        if (m) {
          m.tx = c.x;
          m.ty = c.y;
          m.tAngle = c.angle;
          m.tSpeed = c.speed;
          m.stamp = now;
          m.ef = c.ef;
          m.beh = c.beh;
          m.radius = c.radius;
          m.gen = c.gen;
          m.age = c.age;
          m.meals = c.meals;
          m.kills = c.kills;
          m.offspring = c.offspring;
        } else {
          model.set(c.id, {
            ...c,
            tx: c.x,
            ty: c.y,
            tAngle: c.angle,
            tSpeed: c.speed,
            stamp: now,
          });
        }
      }
      for (const id of [...model.keys()]) if (!seen.has(id)) model.delete(id);
      setConnected(true);
    };

    const poll = async () => {
      try {
        const s = await api.state();
        if (alive) ingest(s);
      } catch {
        if (alive) setConnected(false);
      }
    };
    poll();
    const iv = setInterval(poll, 1000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  // --- focus a newly released creature -----------------------------------
  useEffect(() => {
    if (!focus) return;
    let tries = 0;
    const tryFocus = () => {
      const m = modelRef.current.get(focus.id);
      if (m) {
        cameraRef.current.x = m.x;
        cameraRef.current.y = m.y;
        cameraRef.current.zoom = Math.max(cameraRef.current.zoom, 1.1);
        setSelectedId(focus.id);
        setActiveLineageId(focus.lineageId);
        setFollowing(true);
        setInboxOpen(true);
      } else if (tries++ < 30) {
        setTimeout(tryFocus, 200);
      }
    };
    tryFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // default the inbox tab to one of my bloodlines once known
  useEffect(() => {
    if (activeLineageId == null && me?.lineages?.length) setActiveLineageId(me.lineages[0].id);
  }, [me, activeLineageId]);

  // --- render loop -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;
    let uiAccum = 0;
    let lastFrame = performance.now();

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      if (!firstFitRef.current && w > 1 && stateRef.current) {
        firstFitRef.current = true;
        const s = stateRef.current;
        cameraRef.current.x = s.width / 2;
        cameraRef.current.y = s.height / 2;
        cameraRef.current.zoom = Math.max(0.22, Math.min(Math.min(w / s.width, h / s.height) * 1.05, 0.9));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    const loop = (now: number) => {
      const dtFrame = (now - lastFrame) / 1000;
      lastFrame = now;
      if (!firstFitRef.current) measure();

      // Extrapolate + ease each creature toward its predicted position.
      const model = modelRef.current;
      for (const m of model.values()) {
        const elapsed = Math.min((now - m.stamp) / 1000, 1.5);
        const predX = m.tx + Math.cos(m.tAngle) * m.tSpeed * elapsed;
        const predY = m.ty + Math.sin(m.tAngle) * m.tSpeed * elapsed;
        m.x += (predX - m.x) * 0.35;
        m.y += (predY - m.y) * 0.35;
        m.angle = m.tAngle;
      }

      const terrain = terrainRef.current;
      if (terrain) {
        if (following && selectedId != null) {
          const m = model.get(selectedId);
          if (m) {
            cameraRef.current.x += (m.x - cameraRef.current.x) * 0.12;
            cameraRef.current.y += (m.y - cameraRef.current.y) * 0.12;
          }
        }
        const sel = selectedId != null ? model.get(selectedId) : undefined;
        const vision = sel
          ? deriveStats({ diet: sel.diet, parts: sel.parts, hue: sel.hue, accent: sel.accent, sizeGene: sel.sizeGene, vigor: 1 }).vision
          : undefined;
        const { w, h, dpr } = sizeRef.current;
        renderWorld(
          ctx,
          {
            creatures: [...model.values()],
            plants: plantsRef.current,
            lineageHue: lineageHueRef.current,
            mine: mineRef.current,
          },
          terrain,
          cameraRef.current,
          { viewW: w, viewH: h, dpr, selectedId, showVision, vision },
        );
      }

      uiAccum += dtFrame;
      if (uiAccum > 0.25) {
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
  }, [following, selectedId, showVision]);

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
    const rect = canvasRef.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const world = screenToWorld(cameraRef.current, w, h, e.clientX - rect.left, e.clientY - rect.top);
    const hit = pickCreature([...modelRef.current.values()], world.x, world.y);
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
    const rect = canvasRef.current!.getBoundingClientRect();
    const before = screenToWorld(cam, w, h, e.clientX - rect.left, e.clientY - rect.top);
    cam.zoom = Math.max(0.18, Math.min(3.2, cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    const after = screenToWorld(cam, w, h, e.clientX - rect.left, e.clientY - rect.top);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }
  function fitView() {
    const s = stateRef.current;
    const { w, h } = sizeRef.current;
    if (!s) return;
    cameraRef.current.x = s.width / 2;
    cameraRef.current.y = s.height / 2;
    cameraRef.current.zoom = Math.max(0.22, Math.min(Math.min(w / s.width, h / s.height) * 1.05, 0.9));
    setFollowing(false);
  }

  const selected = selectedId != null ? modelRef.current.get(selectedId) ?? null : null;
  const state = stateRef.current;

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

      {!connected && (
        <div className="center" style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
          <div className="panel" style={{ padding: "12px 18px" }}>
            <span className="blink">◌</span> connecting to the Sphere…
          </div>
        </div>
      )}

      {state && <Hud state={state} />}

      {inboxOpen ? (
        <Inbox
          lineages={state?.lineages ?? []}
          mine={mineRef.current}
          me={me}
          token={token}
          activeLineageId={activeLineageId}
          setActiveLineageId={setActiveLineageId}
          onClose={() => setInboxOpen(false)}
          onPrefsChanged={onPrefsChanged}
        />
      ) : (
        <button
          className="btn"
          style={{ position: "absolute", top: 10, right: 10, zIndex: 4 }}
          onClick={() => setInboxOpen(true)}
        >
          ✉ Field Reports
        </button>
      )}

      <Inspector
        creature={selected}
        following={following}
        onToggleFollow={() => setFollowing((f) => !f)}
        onClose={() => setSelectedId(null)}
        isMine={selected ? mineRef.current.has(selected.lineageId) : false}
      />

      <div className="controls panel">
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
        <button className="btn small primary" onClick={onBuildAnother} title="Design and release another creature">
          ✚ New Creature
        </button>
      </div>
    </div>
  );
}
