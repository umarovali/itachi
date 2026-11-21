import type { CSSProperties } from "react";

const EMBER_COUNT = 14;
const embers = Array.from({ length: EMBER_COUNT }, (_, i) => {
  const seed = (i * 37) % 100;
  return {
    left: `${(seed * 1.7) % 100}%`,
    delay: `${(i % 7) * 1.3}s`,
    duration: `${9 + (i % 5) * 2}s`,
    size: 2 + (i % 4),
    drift: `${((i % 3) - 1) * 40}px`,
  };
});

export default function Embers() {
  return (
    <div className="embers" aria-hidden="true">
      {embers.map((e, i) => (
        <span
          key={i}
          className="embers__particle"
          style={
            {
              left: e.left,
              width: e.size,
              height: e.size,
              animationDelay: e.delay,
              animationDuration: e.duration,
              "--drift": e.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
