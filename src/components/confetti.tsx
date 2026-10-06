import { useEffect, useRef, type JSX } from "react";
import { resolveParticleCap, type ParticleCapEnv } from "./particle-caps";

/**
 * Celebration confetti (spec §7.2–7.3): one canvas, one rAF loop, particle
 * positions kept in closure state (zero setState per frame), DPR-aware
 * resize, simulation paused while the tab is hidden, loop cancelled on
 * unmount. Burst-spawned particles recycle; there is no continuous emitter.
 */

export type ConfettiDensity = "auto" | "full" | "light" | "minimal";

/** Brass / gold / paper — Chart Room palette. */
const CONFETTI_COLORS = ["#e8b64c", "#f2c14e", "#d9a441", "#f0e7d2", "#fffdf8"] as const;

const FORCED_CAPS: Record<Exclude<ConfettiDensity, "auto">, number> = {
  full: 120,
  light: 60,
  minimal: 30,
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  circle: boolean;
  sway: number;
  swaySpeed: number;
  phase: number;
};

function readEnv(): ParticleCapEnv {
  const hasWindow = typeof window !== "undefined";
  const mm =
    hasWindow && typeof window.matchMedia === "function" ? window.matchMedia : null;
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number })
      : null;
  return {
    finePointer: mm ? mm("(pointer: fine)").matches : false,
    narrowViewport: hasWindow ? window.innerWidth < 768 : false,
    // deviceMemory is Chrome-only; unknown memory is assumed adequate.
    lowEnd: nav ? (nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) <= 2 : false,
    reducedMotion: mm ? mm("(prefers-reduced-motion: reduce)").matches : false,
  };
}

export function ConfettiCanvas({
  density = "auto",
}: {
  density?: ConfettiDensity;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const env = readEnv();
    // Reduced motion always wins — even a forced density renders nothing.
    const cap = env.reducedMotion
      ? 0
      : density === "auto"
        ? resolveParticleCap(env)
        : FORCED_CAPS[density];
    if (cap <= 0) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;

    const spawn = (p: Particle, initial: boolean): void => {
      p.x = Math.random() * width;
      // Burst: initial particles stagger through the top half so the
      // celebration reads instantly; recycled ones re-enter above the fold.
      p.y = initial ? -Math.random() * height * 0.6 : -20 - Math.random() * 40;
      p.vx = (Math.random() - 0.5) * 60;
      p.vy = 70 + Math.random() * 110;
      p.w = 5 + Math.random() * 6;
      p.h = 4 + Math.random() * 5;
      p.rot = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 6;
      p.color = CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0];
      p.circle = Math.random() < 0.3;
      p.sway = 20 + Math.random() * 30;
      p.swaySpeed = 1 + Math.random() * 2;
      p.phase = Math.random() * Math.PI * 2;
    };

    const resize = (): void => {
      const dpr =
        typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      if (typeof document !== "undefined" && document.hidden) return; // paused
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.phase += dt * p.swaySpeed;
        p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > height + 24) spawn(p, false);
        if (p.x < -24) p.x = width + 20;
        else if (p.x > width + 24) p.x = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
    };

    const particles: Particle[] = Array.from({ length: cap }, () => {
      const p = {} as Particle;
      spawn(p, true);
      return p;
    });

    resize();
    window.addEventListener("resize", resize);
    last = performance.now();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className="celebration-confetti absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
