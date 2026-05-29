"use client";

import { useEffect, useRef } from "react";

// Tiny canvas confetti — no dependencies. Fires once on mount; cleans up
// when particles settle. Brand-tinted palette so it doesn't look like a
// generic library.
type Props = {
  active: boolean;
  durationMs?: number;
  particleCount?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  size: number;
  color: string;
  shape: "rect" | "circle";
};

const COLORS = [
  "#AFA9EC", // brand-200
  "#7F77DD", // brand-400
  "#CECBF6", // brand-100
  "#1D9E75", // label-2 teal
  "#EF9F27", // label-4 amber
  "#FFFFFF",
];

export default function Confetti({
  active,
  durationMs = 2400,
  particleCount = 140,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let start = performance.now();
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    resize();
    window.addEventListener("resize", resize);

    const cx = canvas.width / 2;
    const cy = canvas.height * 0.25;
    const particles: Particle[] = Array.from({ length: particleCount }, () => {
      const angle = (Math.random() - 0.5) * Math.PI * 1.4 - Math.PI / 2;
      const speed = (12 + Math.random() * 18) * devicePixelRatio;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.3,
        size: (5 + Math.random() * 7) * devicePixelRatio,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.5 ? "rect" : "circle",
      };
    });

    function tick(now: number) {
      if (!ctx || !canvas) return;
      const elapsed = now - start;
      const gravity = 0.45 * devicePixelRatio;
      const drag = 0.985;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const fadeStart = durationMs * 0.7;
        ctx.globalAlpha =
          elapsed < fadeStart
            ? 1
            : Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart));
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, durationMs, particleCount]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
