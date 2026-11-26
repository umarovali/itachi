import type { Lang } from "../lib/i18n";

/** Флаги в SVG (эмодзи-флаги не отображаются на Windows) */
export default function Flag({ lang, size = 20 }: { lang: Lang; size?: number }) {
  return (
    <svg className="flag" viewBox="0 0 24 16" width={size} height={(size * 16) / 24} aria-hidden="true" focusable="false">
      {lang === "ru" && (
        <>
          <rect width="24" height="16" fill="#fff" />
          <rect y="5.33" width="24" height="5.34" fill="#0039a6" />
          <rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
        </>
      )}
      {lang === "ky" && (
        <>
          <rect width="24" height="16" fill="#e8112d" />
          <circle cx="12" cy="8" r="4.6" fill="#ffef00" />
          <circle cx="12" cy="8" r="2.7" fill="#e8112d" />
          <path d="M9.6 6.6c1.6.4 3.2.4 4.8 0M9.6 9.4c1.6-.4 3.2-.4 4.8 0" stroke="#ffef00" strokeWidth=".7" fill="none" />
        </>
      )}
      {lang === "uz" && (
        <>
          <rect width="24" height="5.33" fill="#0099b5" />
          <rect y="5.33" width="24" height="5.34" fill="#fff" />
          <rect y="10.67" width="24" height="5.33" fill="#1eb53a" />
          <rect y="5" width="24" height=".6" fill="#ce1126" />
          <rect y="10.4" width="24" height=".6" fill="#ce1126" />
          <circle cx="5" cy="2.7" r="1.9" fill="#fff" />
          <circle cx="5.8" cy="2.7" r="1.7" fill="#0099b5" />
          <g fill="#fff">
            <circle cx="9" cy="1.3" r=".5" /><circle cx="11" cy="1.3" r=".5" /><circle cx="13" cy="1.3" r=".5" />
            <circle cx="10" cy="2.9" r=".5" /><circle cx="12" cy="2.9" r=".5" />
            <circle cx="11" cy="4.3" r=".5" />
          </g>
        </>
      )}
      {lang === "en" && (
        <g transform="scale(0.4 0.5333)">
          <rect width="60" height="30" fill="#012169" />
          <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="6" />
          <path d="M0 0 60 30M60 0 0 30" stroke="#c8102e" strokeWidth="2" />
          <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
          <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
        </g>
      )}
    </svg>
  );
}
