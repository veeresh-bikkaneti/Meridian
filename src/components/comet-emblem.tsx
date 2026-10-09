// Comet emblem — the storyteller home handoff (H1) retires Comet as a host.
// Comet remains only as a silent, decorative emblem in the home eyebrow row:
// ~30px, static, aria-hidden, never speaks, never interactive.
//
// Simplified static render of the star-dragon pup (same palette as
// comet-mascot.tsx: INK/BRASS/PAPER/BODY/BODY_LIGHT) with the brass
// armillary ring. No tracking, no blink, no boop, no greeting.
import "./comet-mascot.css";

const INK = "#0c181d";
const BRASS = "#e8b64c";
const PAPER = "#f0e7d2";
const BODY = "#31456f";
const BODY_LIGHT = "#4a5f92";

export function CometEmblem() {
  return (
    <span
      className="comet-emblem-static"
      data-testid="comet-emblem"
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" focusable="false" aria-hidden="true">
        {/* brass armillary ring */}
        <circle cx="60" cy="60" r="55" fill="none" stroke={BRASS} strokeWidth="3" />
        <ellipse
          cx="60"
          cy="60"
          rx="55"
          ry="21"
          fill="none"
          stroke={BRASS}
          strokeWidth="2"
        />
        {/* chubby midnight-blue body */}
        <ellipse cx="60" cy="82" rx="28" ry="26" fill={BODY} />
        <ellipse
          cx="60"
          cy="82"
          rx="28"
          ry="26"
          fill="none"
          stroke={INK}
          strokeWidth="3"
        />
        <ellipse cx="60" cy="92" rx="15" ry="12" fill={BODY_LIGHT} opacity="0.9" />
        {/* head */}
        <circle cx="60" cy="50" r="18" fill={BODY} stroke={INK} strokeWidth="3" />
        {/* brass head spikes */}
        <polygon points="47,36 51,27 55,36" fill={BRASS} stroke={INK} strokeWidth="1.5" />
        <polygon points="65,36 69,27 73,36" fill={BRASS} stroke={INK} strokeWidth="1.5" />
        {/* calm open eyes */}
        <ellipse cx="52" cy="47" rx="5" ry="6" fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <ellipse cx="68" cy="47" rx="5" ry="6" fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <circle cx="52" cy="47" r="2.2" fill={INK} />
        <circle cx="68" cy="47" r="2.2" fill={INK} />
        {/* round snout */}
        <ellipse cx="60" cy="56" rx="10" ry="8" fill={BODY_LIGHT} />
        <path
          d="M55 61 Q60 64 65 61"
          stroke={INK}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
