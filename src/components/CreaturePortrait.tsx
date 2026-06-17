/** Static creature thumbnail — a single 3D render (falls back to 2D if no WebGL). */
import { useEffect, useRef } from "react";
import { getStudio } from "../render/creature3d";
import { drawCreaturePortrait } from "../render/drawCreature";
import type { PortraitDTO } from "../sim/wire";

interface Props {
  portrait: PortraitDTO;
  size: number;
  dead?: boolean;
  scene?: boolean;
}

export default function CreaturePortrait({ portrait, size, dead, scene }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    const genome = {
      diet: portrait.diet,
      parts: portrait.parts,
      hue: portrait.hue,
      accent: portrait.accent,
      sizeGene: portrait.sizeGene,
      vigor: 1,
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    if (dead) ctx.filter = "grayscale(0.85) opacity(0.6)";
    let ok = false;
    const studio = getStudio();
    if (studio) {
      try {
        const gl = studio.render(genome, 0.5, px, px, !!scene);
        ctx.drawImage(gl, 0, 0, px, px);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      drawCreaturePortrait(ctx, genome, px * 0.54, px * 0.47, {
        size: px * 0.2,
        scene,
        viewW: px,
        viewH: px,
        detail: scene ? 2 : size >= 84 ? 1 : 0,
      });
    }
    ctx.filter = "none";
  }, [portrait, size, dead, scene]);

  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}
