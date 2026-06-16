/** A live, gently-animated preview of the genome currently being designed. */
import { useEffect, useRef } from "react";
import { Genome } from "../sim/genome";
import { drawCreature } from "../render/drawCreature";

interface Props {
  genome: Genome;
}

export default function CreaturePreview({ genome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep the latest genome in a ref so the animation loop always draws current.
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
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + Math.sin(t * 1.4) * 6 * dpr; // gentle bob
      const size = Math.min(w, h) * 0.22;

      // Pedestal shadow.
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, h / 2 + size * 1.4, size * 1.1, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face "up" the screen, with a slow sway so the build feels alive.
      const angle = -Math.PI / 2 + Math.sin(t * 0.8) * 0.18;
      drawCreature(ctx, genomeRef.current, cx, cy, { size, angle, detail: true });

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
