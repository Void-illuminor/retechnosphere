/** Renders a static creature portrait to a canvas from its genome bits. */
import { useEffect, useRef } from "react";
import { drawCreaturePortrait } from "../render/drawCreature";
import type { PortraitDTO } from "../sim/wire";

interface Props {
  portrait: PortraitDTO;
  size: number;
  dead?: boolean;
  /** Draw the checkerboard studio floor (for large hero portraits). */
  scene?: boolean;
}

export default function CreaturePortrait({ portrait, size, dead, scene }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (dead) ctx.filter = "grayscale(0.8) opacity(0.5)";
    drawCreaturePortrait(
      ctx,
      {
        diet: portrait.diet,
        parts: portrait.parts,
        hue: portrait.hue,
        accent: portrait.accent,
        sizeGene: portrait.sizeGene,
        vigor: 1,
      },
      size * 0.56,
      size * 0.47,
      { size: size * 0.2, scene, viewW: size, viewH: size },
    );
    ctx.filter = "none";
  }, [portrait, size, dead, scene]);

  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}
