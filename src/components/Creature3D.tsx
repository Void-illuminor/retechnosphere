/** A live, slowly-rotating real-time 3D creature (fills its positioned parent). */
import { useEffect, useRef } from "react";
import { getStudio } from "../render/creature3d";
import { drawCreaturePortrait } from "../render/drawCreature";
import type { Genome } from "../sim/genome";

interface Props {
  genome: Genome;
  floor?: boolean;
  dead?: boolean;
}

export default function Creature3D({ genome, floor = true, dead = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gref = useRef(genome);
  gref.current = genome;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const studio = getStudio();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 1;
    let h = 1;
    let raf = 0;
    let rot = 0.5;
    let last = performance.now();

    const measure = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      rot += dt * 0.5;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      let ok = false;
      if (studio) {
        try {
          const gl = studio.render(gref.current, rot, w, h, floor);
          ctx.drawImage(gl, 0, 0, w, h);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        drawCreaturePortrait(ctx, gref.current, w * 0.54, h * 0.5, {
          size: Math.min(w, h) * 0.2,
          scene: floor,
          viewW: w,
          viewH: h,
          detail: 2,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [floor]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        filter: dead ? "grayscale(0.85) brightness(0.65)" : "none",
      }}
    />
  );
}
