import type { JSX } from "react";

/**
 * The Chart Room Crew (spec §5) — Meridian-original characters, drawn as
 * pure SVG primitives (circles, rounded rects, ellipses, polygons).
 * No external assets; palette matches the Chart Room theme
 * (sea-chart ink #f0e7d2 + brass #e8b64c on deep sea #10222a).
 */

export type CharacterName = "nova" | "blip" | "rusty" | "comet";

const INK = "#0c181d";
const BRASS = "#e8b64c";
const PAPER = "#f0e7d2";

/** Captain Nova — human expedition leader. Mustard flight suit, round glass helmet, brass star badge, orbit-bun hair. */
function NovaSvg(): JSX.Element {
  return (
    <svg viewBox="0 0 120 120">
      {/* orbit ring behind the helmet */}
      <ellipse
        cx="60" cy="36" rx="36" ry="11" fill="none"
        stroke={BRASS} strokeWidth="2.5" opacity="0.9"
        transform="rotate(-18 60 36)"
      />
      {/* orbit bun */}
      <circle cx="60" cy="16" r="9" fill="#6b4423" stroke={INK} strokeWidth="2.5" />
      {/* arms (behind body) */}
      <rect x="25" y="74" width="13" height="28" rx="6.5" fill="#d9a441"
        stroke={INK} strokeWidth="3" transform="rotate(14 31 88)" />
      <rect x="82" y="74" width="13" height="28" rx="6.5" fill="#d9a441"
        stroke={INK} strokeWidth="3" transform="rotate(-14 89 88)" />
      {/* mustard-yellow flight suit */}
      <rect x="38" y="68" width="44" height="40" rx="14" fill="#d9a441" />
      <rect x="38" y="68" width="44" height="40" rx="14" fill="none" stroke={INK} strokeWidth="3" />
      {/* collar */}
      <path d="M50 68 L60 76 L70 68" fill="none" stroke={INK} strokeWidth="2.5" />
      {/* brass star badge */}
      <polygon
        points="60,80 62.4,85.6 68.4,86.2 63.8,90.2 65.2,96 60,93 54.8,96 56.2,90.2 51.6,86.2 57.6,85.6"
        fill={BRASS} stroke={INK} strokeWidth="1.5"
      />
      {/* belt with tiny telescope */}
      <rect x="38" y="94" width="44" height="7" fill={INK} opacity="0.85" />
      <rect x="64" y="90" width="12" height="6" rx="3" fill="#8a6d3b" stroke={INK} strokeWidth="1.5" />
      <circle cx="79" cy="93" r="3.5" fill="#dceef2" stroke={INK} strokeWidth="1.5" />
      {/* round glass helmet */}
      <circle cx="60" cy="46" r="27" fill="#dceef2" opacity="0.92" />
      <circle cx="60" cy="46" r="27" fill="none" stroke={INK} strokeWidth="3" />
      {/* face */}
      <circle cx="60" cy="48" r="15" fill="#f0c193" />
      <circle cx="54" cy="46" r="2.2" fill={INK} />
      <circle cx="66" cy="46" r="2.2" fill={INK} />
      <path d="M53 54 Q60 60 67 54" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* helmet shine */}
      <path d="M42 36 Q46 30 53 28" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/** Blip — small alien navigator. Mint gumdrop body, three stalk-eyes, springy antennae, tiny brass compass. */
function BlipSvg(): JSX.Element {
  return (
    <svg viewBox="0 0 120 120">
      {/* springy antennae with glowing tips */}
      <path d="M46 46 Q40 30 30 28" stroke="#5fb98d" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M74 46 Q80 30 90 28" stroke="#5fb98d" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="28" r="7" fill={BRASS} opacity="0.35" />
      <circle cx="30" cy="28" r="3.5" fill="#ffe9a8" />
      <circle cx="90" cy="28" r="7" fill={BRASS} opacity="0.35" />
      <circle cx="90" cy="28" r="3.5" fill="#ffe9a8" />
      {/* eye stalks */}
      <rect x="43.5" y="34" width="5" height="14" rx="2.5" fill="#5fb98d" />
      <rect x="71.5" y="34" width="5" height="14" rx="2.5" fill="#5fb98d" />
      <rect x="57.5" y="28" width="5" height="16" rx="2.5" fill="#5fb98d" />
      {/* three stalk-eyes: one big, two small */}
      <circle cx="60" cy="36" r="11" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
      <circle cx="60" cy="37" r="4.5" fill={INK} />
      <circle cx="62" cy="35" r="1.5" fill="#ffffff" />
      <circle cx="46" cy="42" r="7" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
      <circle cx="46" cy="43" r="3" fill={INK} />
      <circle cx="74" cy="42" r="7" fill="#ffffff" stroke={INK} strokeWidth="2.5" />
      <circle cx="74" cy="43" r="3" fill={INK} />
      {/* mint-green gumdrop body */}
      <path d="M30 108 Q30 54 60 54 Q90 54 90 108 Z" fill="#8fd8b2" />
      <path d="M30 108 Q30 54 60 54 Q90 54 90 108 Z" fill="none" stroke={INK} strokeWidth="3" />
      {/* cheeks + smile */}
      <circle cx="44" cy="84" r="5" fill="#e86a5c" opacity="0.45" />
      <circle cx="76" cy="84" r="5" fill="#e86a5c" opacity="0.45" />
      <path d="M52 90 Q60 96 68 90" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* tiny brass compass on a ribbon */}
      <path d="M60 98 L60 104" stroke="#c9962f" strokeWidth="2.5" />
      <circle cx="60" cy="102" r="7.5" fill={BRASS} stroke={INK} strokeWidth="2" />
      <polygon points="60,96.5 62.2,102 60,107.5 57.8,102" fill={INK} />
    </svg>
  );
}

/** Rusty — round robot historian. Copper barrel body with rivets, warm-lit visor eye, wheel-feet, scroll notebook. */
function RustySvg(): JSX.Element {
  return (
    <svg viewBox="0 0 120 120">
      {/* scroll-shaped notebook on the back */}
      <rect x="18" y="58" width="11" height="36" rx="5.5" fill={PAPER}
        stroke={INK} strokeWidth="2.5" transform="rotate(8 23 76)" />
      <line x1="21" y1="66" x2="27" y2="66" stroke={INK} strokeWidth="1.5" transform="rotate(8 23 76)" />
      <line x1="21" y1="72" x2="27" y2="72" stroke={INK} strokeWidth="1.5" transform="rotate(8 23 76)" />
      {/* retractable wheel-feet */}
      <circle cx="44" cy="104" r="9" fill="#2b3430" stroke={INK} strokeWidth="2.5" />
      <circle cx="44" cy="104" r="3" fill="#8a938e" />
      <circle cx="76" cy="104" r="9" fill="#2b3430" stroke={INK} strokeWidth="2.5" />
      <circle cx="76" cy="104" r="3" fill="#8a938e" />
      {/* copper barrel body */}
      <rect x="32" y="42" width="56" height="58" rx="18" fill="#b26e35" />
      <rect x="32" y="42" width="56" height="58" rx="18" fill="none" stroke={INK} strokeWidth="3" />
      {/* barrel bands */}
      <rect x="33" y="58" width="54" height="6" fill="#7e4a22" opacity="0.8" />
      <rect x="33" y="86" width="54" height="6" fill="#7e4a22" opacity="0.8" />
      {/* rivet dots */}
      <circle cx="40" cy="50" r="2.2" fill={BRASS} />
      <circle cx="52" cy="50" r="2.2" fill={BRASS} />
      <circle cx="68" cy="50" r="2.2" fill={BRASS} />
      <circle cx="80" cy="50" r="2.2" fill={BRASS} />
      <circle cx="46" cy="94" r="2.2" fill={BRASS} />
      <circle cx="74" cy="94" r="2.2" fill={BRASS} />
      {/* one big warm-lit visor eye */}
      <rect x="42" y="64" width="36" height="18" rx="9" fill="#20303a" stroke={INK} strokeWidth="2.5" />
      <circle cx="60" cy="73" r="9" fill="#ffc46b" opacity="0.3" />
      <circle cx="60" cy="73" r="5.5" fill="#ffc46b" />
      <circle cx="58" cy="71" r="1.8" fill="#fffdf8" />
      {/* gentle smile plate */}
      <path d="M52 94 Q60 98 68 94" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Comet — star-dragon pup. Chubby midnight-blue body, sparkling tail with star trail, stubby wings, round snout. */
function CometSvg(): JSX.Element {
  return (
    <svg viewBox="0 0 120 120">
      {/* dotted star trail */}
      <circle cx="12" cy="94" r="1.8" fill={BRASS} />
      <circle cx="20" cy="100" r="1.4" fill={PAPER} />
      <circle cx="6" cy="103" r="1.4" fill={PAPER} />
      {/* sparkling tail */}
      <path d="M86 92 Q102 90 106 74 Q98 82 86 82 Z" fill="#31456f" stroke={INK} strokeWidth="2.5" />
      <polygon
        points="100,62 101.6,66.4 106,68 101.6,69.6 100,74 98.4,69.6 94,68 98.4,66.4"
        fill="#ffe9a8" stroke={INK} strokeWidth="1"
      />
      <circle cx="110" cy="60" r="1.6" fill={BRASS} />
      {/* stubby wings */}
      <ellipse cx="30" cy="64" rx="10" ry="16" fill="#4a5f92" stroke={INK} strokeWidth="2.5"
        transform="rotate(24 30 64)" />
      <ellipse cx="90" cy="64" rx="10" ry="16" fill="#4a5f92" stroke={INK} strokeWidth="2.5"
        transform="rotate(-24 90 64)" />
      {/* chubby midnight-blue body */}
      <ellipse cx="60" cy="80" rx="30" ry="28" fill="#31456f" />
      <ellipse cx="60" cy="80" rx="30" ry="28" fill="none" stroke={INK} strokeWidth="3" />
      <ellipse cx="60" cy="90" rx="17" ry="14" fill="#4a5f92" opacity="0.9" />
      {/* head */}
      <circle cx="60" cy="46" r="19" fill="#31456f" stroke={INK} strokeWidth="3" />
      {/* brass head spikes */}
      <polygon points="46,31 50,22 54,31" fill={BRASS} stroke={INK} strokeWidth="1.5" />
      <polygon points="66,31 70,22 74,31" fill={BRASS} stroke={INK} strokeWidth="1.5" />
      {/* happy closed eyes */}
      <path d="M45 42 Q48 39 51 42" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M69 42 Q72 39 75 42" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* round snout */}
      <ellipse cx="60" cy="52" rx="11" ry="8.5" fill="#4a5f92" />
      <circle cx="56" cy="51" r="1.8" fill={INK} />
      <circle cx="64" cy="51" r="1.8" fill={INK} />
      <path d="M55 57 Q60 60 65 57" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const SVGS: Record<CharacterName, () => JSX.Element> = {
  nova: NovaSvg,
  blip: BlipSvg,
  rusty: RustySvg,
  comet: CometSvg,
};

/**
 * Renders one of the Chart Room Crew as an inline SVG.
 * Decorative by default (`aria-hidden`); pass `labelledBy` context via the
 * parent instead — the overlay card already names the moment.
 */
export function Character({
  name,
  size = 96,
  className,
}: {
  name: CharacterName;
  size?: number;
  className?: string;
}): JSX.Element {
  const Svg = SVGS[name];
  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size }}
      aria-hidden="true"
    >
      <Svg />
    </span>
  );
}
