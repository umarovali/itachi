import { useEffect, useRef } from "react";

interface Flake {
  x: number; y: number; r: number; speed: number; drift: number; phase: number; kind: "dot" | "star"; alpha: number;
}

/** Медленно падающий снег (canvas, не мешает кликам). */
export default function Snowfall() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, raf = 0, flakes: Flake[] = [], last = performance.now();

    const make = (fromTop: boolean): Flake => {
      const star = Math.random() < 0.18;
      return {
        x: Math.random() * w,
        y: fromTop ? -20 : Math.random() * h,
        r: star ? 5 + Math.random() * 6 : 1.4 + Math.random() * 2.6,
        speed: 14 + Math.random() * 26,          // px/сек — медленно
        drift: 8 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        kind: star ? "star" : "dot",
        alpha: 0.55 + Math.random() * 0.45,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, Math.max(28, (w * h) / 16000)));
      flakes = Array.from({ length: count }, () => make(false));
    };

    const drawStar = (f: Flake) => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(f.x - Math.cos(a) * f.r, f.y - Math.sin(a) * f.r);
        ctx.lineTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r);
      }
      ctx.stroke();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.shadowColor = "rgba(124, 77, 255, .55)";
      ctx.shadowBlur = 4;
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speed * dt;
        f.phase += dt * 0.8;
        f.x += Math.sin(f.phase) * f.drift * dt;
        if (f.y > h + 20 || f.x < -30 || f.x > w + 30) flakes[i] = make(true);
        ctx.globalAlpha = f.alpha;
        if (f.kind === "dot") {
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
          drawStar(f);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); };
    const sync = () => (reduce.matches ? stop() : start());

    resize(); sync();
    window.addEventListener("resize", resize);
    reduce.addEventListener("change", sync);
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : sync());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="snowfall" aria-hidden="true" />;
}
