import type { ReactNode } from "react";

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const wrap = (children: ReactNode) => (p: { size?: number }) => (
  <svg {...base} width={p.size ?? 22} height={p.size ?? 22}>{children}</svg>
);

export const IconBolt = wrap(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />);
export const IconShield = wrap(<><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></>);
export const IconHeadset = wrap(<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4zM20 14h-3v5h2a1 1 0 0 0 1-1v-4z" /><path d="M20 19c0 1.5-2 2.5-5 2.5" /></>);
export const IconGift = wrap(<><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>);
export const IconSend = wrap(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>);
export const IconArrow = wrap(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconHome = wrap(<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z" />);
export const IconGrid = wrap(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>);

/** Огранённый фиолетовый кристалл (декор) */
export function Gem({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`gem ${className}`} style={style} viewBox="0 0 100 90" aria-hidden="true">
      <polygon points="22,0 78,0 64,28 36,28" fill="#e9ddff" />
      <polygon points="22,0 36,28 0,28" fill="#b79dff" />
      <polygon points="78,0 100,28 64,28" fill="#a07cff" />
      <polygon points="0,28 36,28 50,90" fill="#7c4dff" />
      <polygon points="36,28 64,28 50,90" fill="#9566ff" />
      <polygon points="64,28 100,28 50,90" fill="#5b2fd9" />
    </svg>
  );
}

/** Кластер кристаллов со свечением для баннеров */
export function GemCluster() {
  return (
    <div className="gem-cluster" aria-hidden="true">
      <span className="gem-cluster__glow" />
      <Gem className="gem--1" />
      <Gem className="gem--2" />
      <Gem className="gem--3" />
      <Gem className="gem--4" />
    </div>
  );
}
