/** A live, gently-bobbing portrait of the genome being designed in the builder. */
import { useEffect, useRef } from "react";
import { Genome } from "../sim/genome";
import { drawCreaturePortrait } from "../render/drawCreature";

interface Props {
  genome: Genome;
}

export default function CreaturePreview({ genome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const genomeRef = useRef(genome);
  genomeRef.current = genome;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const size = Math.min(w, h) * 0.42;
      const cx = w / 2;
      const cy = h / 2 + Math.sin(t * 1.4) * 5;
      drawCreaturePortrait(ctx, genomeRef.current, cx, cy, { size });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} />;
}
