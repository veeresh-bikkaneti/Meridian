import type { ReactNode } from "react";
import type { SnapshotStory } from "./board-data";
import { characterForStory, type CardCharacterId } from "./card-character-map";

/**
 * The card characters themselves: hand-drawn inline SVGs, one per
 * theme (see card-character-map.ts for how a story gets its
 * character).
 *
 * V2 (owner, 2026-11-13: "Improve the icons or characters"). V1 read
 * as thin line doodles — open outlines, dot eyes, no body or weight.
 * V2 is finished mascot artwork under ONE art direction: a 48-unit
 * grid, the same 2.4-unit ink stroke, FILLED bodies in the board's
 * atlas tokens only (brass / stamp / muted teal / card surfaces, one
 * soft shade tone for depth), real faces (eyes with a highlight dot,
 * a smile, rosy cheek dots — expressions vary a little by character:
 * the wrench is determined, the book sleepy, the mic bright), crisp
 * silhouettes with detail props (mic grille, compass rose, abacus
 * beads, flask liquid, globe continents, camera reels, the wrench's
 * bandage), and a soft ground shadow under every character.
 *
 * Each character keeps exactly ONE small idle motion from V1, fitted
 * to its theme, as a CSS transform/opacity animation on a .cc-anim
 * part (board.css). No JS animation, no image files. All of it stops
 * under prefers-reduced-motion. The SVGs are decorative
 * (aria-hidden): the card's text already carries the meaning.
 */
function Char({
  id,
  children,
}: {
  id: CardCharacterId;
  children: ReactNode;
}) {
  return (
    <svg
      className={`board-card-character board-char-${id}`}
      data-character={id}
      viewBox="0 0 48 48"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** The shared ground shadow: a soft ellipse that grounds the character. */
function Shadow({ cx = 24, cy = 43.2, rx = 11.5, ry = 2.4 }: { cx?: number; cy?: number; rx?: number; ry?: number }) {
  return <ellipse className="cc-shadow" cx={cx} cy={cy} rx={rx} ry={ry} />;
}

/** Two eyes with a highlight dot — the shared face piece. */
function Eyes({ x1, x2, y, r = 1.9 }: { x1: number; x2: number; y: number; r?: number }) {
  return (
    <>
      <circle className="cc-face" cx={x1} cy={y} r={r} />
      <circle className="cc-hl" cx={x1 - r * 0.32} cy={y - r * 0.36} r={r * 0.36} />
      <circle className="cc-face" cx={x2} cy={y} r={r} />
      <circle className="cc-hl" cx={x2 - r * 0.32} cy={y - r * 0.36} r={r * 0.36} />
    </>
  );
}

/** Rosy cheek dots, one under each eye. */
function Cheeks({ x1, x2, y, rx = 2.3 }: { x1: number; x2: number; y: number; rx?: number }) {
  return (
    <>
      <ellipse className="cc-cheek" cx={x1} cy={y} rx={rx} ry={rx * 0.62} />
      <ellipse className="cc-cheek" cx={x2} cy={y} rx={rx} ry={rx * 0.62} />
    </>
  );
}

function MicChar() {
  return (
    <Char id="mic">
      <Shadow cy={44} />
      <path className="cc-line cc-anim cc-arcs" d="M35 16.5a7.5 7.5 0 0 1 0 8" />
      <path className="cc-line cc-anim cc-arcs-late" d="M38.5 13a12 12 0 0 1 0 15" />
      <path className="cc-line" d="M12.5 21a11.5 11.5 0 0 0 23 0" />
      <path className="cc-line" d="M24 32.5v5" />
      <rect className="cc-brass" x="15" y="39" width="18" height="3.2" rx="1.6" />
      <rect className="cc-brass" x="18" y="6" width="12" height="23" rx="6" />
      <path className="cc-line cc-soft" d="M21 10.8h6" />
      <path className="cc-line cc-soft" d="M20.4 13.9h7.2" />
      <Eyes x1={21.5} x2={26.5} y={19.5} r={1.75} />
      <path className="cc-face" d="M21.3 23.4q2.7 3 5.4 0q-2.7 1.6-5.4 0Z" />
      <Cheeks x1={18.9} x2={29.1} y={22.2} rx={1.9} />
    </Char>
  );
}

function CompassChar() {
  return (
    <Char id="compass">
      <Shadow cy={41.8} />
      <circle className="cc-brass" cx="24" cy="23" r="15" />
      <circle className="cc-pale" cx="24" cy="23" r="11.6" />
      <circle className="cc-face" cx="24" cy="9.9" r="0.95" />
      <circle className="cc-face" cx="24" cy="36.1" r="0.95" />
      <circle className="cc-face" cx="10.9" cy="23" r="0.95" />
      <circle className="cc-face" cx="37.1" cy="23" r="0.95" />
      <g className="cc-anim cc-needle">
        <polygon className="cc-stamp" points="18.6,17.2 24,15.4 29.4,17.2 24,19" />
        <polygon className="cc-brass" points="24,12.4 25.8,17.2 24,22 22.2,17.2" />
        <circle className="cc-face" cx="24" cy="17.2" r="1.35" />
        <circle className="cc-hl" cx="23.5" cy="16.7" r="0.5" />
      </g>
      <Eyes x1={19.6} x2={28.4} y={27.6} r={1.6} />
      <path className="cc-line" d="M21.9 30.7q2.1 1.9 4.2 0" />
      <Cheeks x1={16.7} x2={31.3} y={29.2} rx={1.9} />
    </Char>
  );
}

function AbacusChar() {
  return (
    <Char id="abacus">
      <Shadow cy={43.4} />
      <rect className="cc-body" x="7.5" y="8" width="33" height="32" rx="3" />
      <path className="cc-line cc-soft" d="M10.5 16.5h27M10.5 24.5h27M10.5 32.5h27" />
      <circle className="cc-brass-dot" cx="10.6" cy="11.2" r="1.1" />
      <circle className="cc-brass-dot" cx="37.4" cy="11.2" r="1.1" />
      <circle className="cc-brass-dot" cx="10.6" cy="36.8" r="1.1" />
      <circle className="cc-brass-dot" cx="37.4" cy="36.8" r="1.1" />
      <ellipse className="cc-stamp" cx="15" cy="16.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-teal" cx="24" cy="16.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-brass" cx="33" cy="16.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-teal" cx="13.5" cy="24.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-stamp" cx="34.5" cy="24.5" rx="3.3" ry="2.55" />
      <g className="cc-anim cc-bead">
        <circle className="cc-brass" cx="24" cy="24.5" r="4.6" />
        <circle className="cc-face" cx="22.6" cy="23.8" r="0.85" />
        <circle className="cc-face" cx="25.4" cy="23.8" r="0.85" />
        <path className="cc-line cc-smile-sm" d="M22.9 26.1q1.1 1 2.2 0" />
      </g>
      <ellipse className="cc-brass" cx="15" cy="32.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-stamp" cx="24" cy="32.5" rx="3.3" ry="2.55" />
      <ellipse className="cc-teal" cx="33" cy="32.5" rx="3.3" ry="2.55" />
    </Char>
  );
}

function WrenchChar() {
  return (
    <Char id="wrench">
      <Shadow cx={22} cy={45} rx={12.5} />
      <g className="cc-anim cc-wrench">
        <path
          className="cc-teal"
          d="M37.5 4.5a11 11 0 0 0-10.9 15.4L7.2 39.3a4.9 4.9 0 1 0 7 7L33.6 26.9A11 11 0 0 0 43.5 16l-6.9 6.9-5.6-1.5-1.5-5.6z"
        />
        <path className="cc-line cc-shade-line" d="M11.5 36.5 28 20" />
        <g transform="rotate(45 16.5 29.5)">
          <rect className="cc-pale" x="8" y="25" width="17" height="9" rx="4.5" />
          <circle className="cc-brass-dot" cx="10.6" cy="32.6" r="0.8" />
          <circle className="cc-brass-dot" cx="13.4" cy="33.4" r="0.8" />
          <path className="cc-line" d="M11.7 27.1l3.4 1.2" />
          <path className="cc-line" d="M20.1 27.1l-3.4 1.2" />
          <Eyes x1={13.6} x2={18.4} y={29.9} r={1.4} />
          <path className="cc-line cc-smile-sm" d="M14.9 32.2h2.2" />
          <path className="cc-stamp-line" d="M22.6 27.9v3M21.1 29.4h3" />
        </g>
      </g>
    </Char>
  );
}

function EyeChar() {
  return (
    <Char id="eye">
      <Shadow cy={42.6} rx={12.5} />
      <g className="cc-anim cc-blink">
        <path className="cc-line" d="M16 12.8 13.8 8.2M24 10.8V6M32 12.8l2.2-4.6" />
        <path className="cc-pale cc-eye-outline" d="M4.5 24Q24 7.5 43.5 24Q24 40.5 4.5 24Z" />
        <circle className="cc-teal" cx="24" cy="24" r="7.8" />
        <circle className="cc-face" cx="24" cy="24" r="3.3" />
        <circle className="cc-hl" cx="26.8" cy="20.8" r="1.35" />
        <circle className="cc-hl" cx="21.6" cy="27.4" r="0.75" />
        <path className="cc-line cc-soft" d="M12.5 29.8Q24 36.8 35.5 29.8" />
      </g>
    </Char>
  );
}

function CameraChar() {
  return (
    <Char id="camera">
      <Shadow cy={40.8} rx={13} />
      <g className="cc-anim cc-reel">
        <circle className="cc-brass" cx="14.5" cy="11.5" r="6.4" />
        <circle className="cc-face" cx="14.5" cy="8.2" r="1.15" />
        <circle className="cc-face" cx="14.5" cy="14.8" r="1.15" />
        <circle className="cc-face" cx="11.2" cy="11.5" r="1.15" />
        <circle className="cc-face" cx="17.8" cy="11.5" r="1.15" />
        <circle className="cc-face" cx="14.5" cy="11.5" r="1.5" />
      </g>
      <circle className="cc-brass" cx="26.5" cy="9.5" r="4.5" />
      <circle className="cc-face" cx="26.5" cy="9.5" r="1.1" />
      <path className="cc-teal" d="M29 23.2 43 17.6v19.8L29 31.8Z" />
      <ellipse className="cc-face" cx="42.2" cy="27.5" rx="1.7" ry="5.4" />
      <circle className="cc-hl" cx="41.9" cy="24.2" r="0.8" />
      <rect className="cc-body" x="5" y="19" width="24" height="17" rx="3" />
      <rect className="cc-brass" x="8" y="21" width="18" height="2.6" rx="1.3" />
      <circle className="cc-stamp-dot" cx="25.6" cy="27" r="1.45" />
      <Eyes x1={10.8} x2={17.2} y={28} r={1.6} />
      <path className="cc-line" d="M11.7 32q2.3 1.9 4.6 0" />
      <Cheeks x1={8.3} x2={19.7} y={30.2} rx={1.8} />
    </Char>
  );
}

function GearChar() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Char id="gear">
      <Shadow cy={45.8} rx={12} ry={1.9} />
      <g className="cc-anim cc-gear">
        {teeth.map((deg) => (
          <rect
            key={deg}
            className="cc-brass"
            x="21.2"
            y="2.8"
            width="5.6"
            height="10.5"
            rx="1.8"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}
        <circle className="cc-brass" cx="24" cy="24" r="11.6" />
        <path className="cc-shade" d="M16.5 30.2a11 11 0 0 0 15 0a15.5 15.5 0 0 1-15 0Z" />
        <circle className="cc-line cc-soft" cx="24" cy="24" r="8.6" />
        <Eyes x1={20.6} x2={27.4} y={21.6} r={1.7} />
        <path className="cc-line" d="M21.9 25.9q2.1 1.8 4.2 0" />
        <Cheeks x1={17.7} x2={30.3} y={24.1} rx={1.85} />
      </g>
    </Char>
  );
}

function BookChar() {
  return (
    <Char id="book">
      <Shadow cy={44.6} rx={12.5} />
      <path
        className="cc-stamp"
        d="M24 11.9C19.1 7.7 10.4 6.5 3.8 8.4v28.4c6.6-1.9 15.3-.7 20.2 3.5 4.9-4.2 13.6-5.4 20.2-3.5V8.4c-6.6-1.9-15.3-.7-20.2 3.5Z"
      />
      <path
        className="cc-pale"
        d="M24 14.6c-4.3-3.4-11.8-4.3-17-2.8v24.6c5.2-1.5 12.7-.6 17 2.8 4.3-3.4 11.8-4.3 17-2.8V11.8c-5.2-1.5-12.7-.6-17 2.8Z"
      />
      <path className="cc-anim cc-page" d="M33.5 12.4 42 10.5v8.8c-2.6-2.9-5.4-5.2-8.5-6.9Z" />
      <path className="cc-line cc-soft" d="M24 14.6v24.6" />
      <path className="cc-line cc-soft" d="M9.5 18.5h7.5M9.5 22.5h7.5M9.5 26.5h5.5" />
      <path className="cc-line" d="M14.6 28.4q2.2-2.4 4.4 0" />
      <path className="cc-line" d="M29 28.4q2.2-2.4 4.4 0" />
      <path className="cc-line" d="M21.8 33.2q2.2 2.2 4.4 0" />
      <Cheeks x1={12.4} x2={35.6} y={31.2} rx={2} />
      <polygon className="cc-brass" points="11.8,35.8 15.8,35.8 15.8,42.8 13.8,40.6 11.8,42.8" />
    </Char>
  );
}

function FlaskChar() {
  return (
    <Char id="flask">
      <Shadow cy={44.6} />
      <path
        className="cc-pale"
        d="M21 8h6v8.3L35.2 37a3.5 3.5 0 0 1-3.2 4.7H16A3.5 3.5 0 0 1 12.8 37L21 16.3Z"
      />
      <path
        className="cc-stamp"
        d="M16.6 29.4q3.7-2.4 7.4 0q3.7 2.4 7.4 0l3.2 7.4a3.4 3.4 0 0 1-3.1 4.4H16.5a3.4 3.4 0 0 1-3.1-4.4Z"
      />
      <g className="cc-anim cc-bubbles">
        <circle className="cc-bubble" cx="20.5" cy="33" r="1.5" />
        <circle className="cc-bubble" cx="26.8" cy="35.5" r="1.1" />
        <circle className="cc-bubble" cx="23.8" cy="31.6" r="0.9" />
      </g>
      <rect className="cc-brass" x="17.8" y="4.6" width="12.4" height="3.6" rx="1.8" />
      <path className="cc-line cc-soft" d="M22.5 13.8h3" />
      <Eyes x1={20.6} x2={27.4} y={21.5} r={1.7} />
      <path className="cc-line" d="M21.8 25.4q2.2 2 4.4 0" />
      <Cheeks x1={19.4} x2={28.6} y={23.8} rx={1.7} />
    </Char>
  );
}

function GlobeChar() {
  return (
    <Char id="globe">
      <Shadow cy={44.4} rx={12} />
      <rect className="cc-brass" x="22.8" y="33" width="2.4" height="8" />
      <rect className="cc-brass" x="14.5" y="40.5" width="19" height="3" rx="1.5" />
      <path className="cc-line" d="M12.5 25.5a14 14 0 0 0 23 0" />
      <g className="cc-anim cc-globe">
        <circle className="cc-teal" cx="24" cy="20.5" r="13" />
        <path
          className="cc-land"
          d="M16.5 12.3c1.8-.5 3.7.3 4.2 1.8.4 1.4-.6 2.7-2.2 2.9-1.5.2-3.2-.7-3.4-2-.2-1.2.4-2.3 1.4-2.7Z"
        />
        <path
          className="cc-land"
          d="M31.5 11.9c1.6.1 2.9 1.3 2.9 2.7 0 1.3-1.2 2.4-2.7 2.4-1.4 0-2.7-1-2.8-2.3-.1-1.3 1.1-2.6 2.6-2.8Z"
        />
        <path
          className="cc-land"
          d="M15.9 27.2c1.4-.3 2.9.5 3.3 1.7.4 1.1-.4 2.3-1.7 2.6-1.3.3-2.7-.4-3.1-1.5-.4-1.2.3-2.5 1.5-2.8Z"
        />
        <Eyes x1={20.5} x2={27.5} y={20.6} r={1.6} />
        <path className="cc-line" d="M22 24.4q2 1.8 4 0" />
        <Cheeks x1={17.8} x2={30.2} y={23} rx={1.8} />
      </g>
    </Char>
  );
}

function MagnifierChar() {
  return (
    <Char id="magnifier">
      <Shadow cx={22} cy={44.6} rx={12.5} />
      <g className="cc-anim cc-mag">
        <line className="cc-handle" x1="30.5" y1="30.5" x2="40.5" y2="40.5" />
        <path className="cc-brass-line" d="M32.6 36.4 36.4 32.6" />
        <path className="cc-brass-line" d="M36.1 39.9 39.9 36.1" />
        <circle className="cc-brass" cx="21" cy="21" r="13" />
        <circle className="cc-glass" cx="21" cy="21" r="10.2" />
        <path className="cc-line cc-soft" d="M14.2 14.2a9.2 9.2 0 0 1 4.2-3.4" />
        <Eyes x1={17.3} x2={24.7} y={19.8} r={1.75} />
        <path className="cc-line" d="M17.9 25.2q3.1 2.5 6.2 0" />
        <Cheeks x1={14.5} x2={27.5} y={22.7} rx={1.85} />
      </g>
    </Char>
  );
}

const CHARACTERS: Record<CardCharacterId, () => ReactNode> = {
  mic: MicChar,
  compass: CompassChar,
  abacus: AbacusChar,
  wrench: WrenchChar,
  eye: EyeChar,
  camera: CameraChar,
  gear: GearChar,
  book: BookChar,
  flask: FlaskChar,
  globe: GlobeChar,
  magnifier: MagnifierChar,
};

/** The character for one story card, chosen by the story's theme. */
export function CardCharacter({
  story,
}: {
  story: Pick<SnapshotStory, "lane" | "title">;
}) {
  const Character = CHARACTERS[characterForStory(story)];
  return <Character />;
}
