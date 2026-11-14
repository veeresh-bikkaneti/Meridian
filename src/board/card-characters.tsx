import type { ReactNode } from "react";
import type { SnapshotStory } from "./board-data";
import { characterForStory, type CardCharacterId } from "./card-character-map";

/**
 * The card characters themselves: hand-drawn inline SVGs, one per
 * theme (see card-character-map.ts for how a story gets its
 * character). One consistent hand: a 48-unit grid, the same 2.4-unit
 * ink stroke, round caps, faces made of two dot eyes and a smile,
 * colours only from the board's atlas tokens (ink / brass / stamp /
 * card surfaces — wired up in board.css as .cc-* classes).
 *
 * Each character has exactly ONE small idle motion, fitted to its
 * theme, and every motion is a CSS transform/opacity animation on a
 * .cc-anim part (board.css). No JS animation, no image files. All of
 * it stops under prefers-reduced-motion. The SVGs are decorative
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

/** Two dot eyes, the shared face piece. */
function Eyes({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <>
      <circle className="cc-face" cx={x1} cy={y} r="1.6" />
      <circle className="cc-face" cx={x2} cy={y} r="1.6" />
    </>
  );
}

function MicChar() {
  return (
    <Char id="mic">
      <path className="cc-line cc-anim cc-arcs" d="M35 16.5a7.5 7.5 0 0 1 0 8" />
      <path className="cc-line cc-anim cc-arcs-late" d="M38.5 13a12 12 0 0 1 0 15" />
      <rect className="cc-body" x="18" y="6" width="12" height="22" rx="6" />
      <path className="cc-line cc-soft" d="M21.5 11h5" />
      <Eyes x1={21.6} y={17.5} x2={26.4} />
      <path className="cc-line" d="M21.8 22.2q2.2 2.3 4.4 0" />
      <path className="cc-line" d="M12.5 21a11.5 11.5 0 0 0 23 0" />
      <path className="cc-line" d="M24 32.5v5" />
      <path className="cc-line" d="M16.5 40.5h15" />
    </Char>
  );
}

function CompassChar() {
  return (
    <Char id="compass">
      <circle className="cc-body" cx="24" cy="24" r="15" />
      <path className="cc-line cc-soft" d="M24 11.5v3M24 33.5v3M11.5 24h3M33.5 24h3" />
      <Eyes x1={16.8} y={20.5} x2={31.2} />
      <path className="cc-line" d="M20.8 31q3.2 2.6 6.4 0" />
      <g className="cc-anim cc-needle">
        <polygon className="cc-pale" points="24,12.5 27,24 24,35.5 21,24" />
        <polygon className="cc-brass" points="24,12.5 27,24 21,24" />
      </g>
      <circle className="cc-face" cx="24" cy="24" r="1.9" />
    </Char>
  );
}

function AbacusChar() {
  return (
    <Char id="abacus">
      <rect className="cc-body" x="8" y="9" width="32" height="30" rx="3" />
      <path className="cc-line cc-soft" d="M11 17h26M11 24.5h26M11 32h26" />
      <circle className="cc-brass" cx="16" cy="17" r="2.7" />
      <circle className="cc-brass" cx="24" cy="17" r="2.7" />
      <circle className="cc-anim cc-bead" cx="14.5" cy="24.5" r="2.7" />
      <circle className="cc-brass" cx="31" cy="24.5" r="2.7" />
      <circle className="cc-brass" cx="13.5" cy="32" r="2.7" />
      <circle className="cc-brass" cx="34" cy="32" r="2.7" />
      <Eyes x1={21} y={36.2} x2={27} />
    </Char>
  );
}

function WrenchChar() {
  return (
    <Char id="wrench">
      <g className="cc-anim cc-wrench">
        <path
          className="cc-body"
          d="M37.5 4.5a11 11 0 0 0-10.9 15.4L7.2 39.3a4.9 4.9 0 1 0 7 7L33.6 26.9A11 11 0 0 0 43.5 16l-6.9 6.9-5.6-1.5-1.5-5.6z"
        />
        <g transform="rotate(45 16.5 29.5)">
          <rect className="cc-brass" x="9" y="25.8" width="15" height="7.4" rx="3.7" />
          <circle className="cc-face" cx="13.5" cy="29.5" r="1" />
          <circle className="cc-face" cx="19.5" cy="29.5" r="1" />
        </g>
      </g>
    </Char>
  );
}

function EyeChar() {
  return (
    <Char id="eye">
      <g className="cc-anim cc-blink">
        <path className="cc-line" d="M16 12.8 13.8 8.2M24 10.8V6M32 12.8l2.2-4.6" />
        <path className="cc-body" d="M4.5 24Q24 7.5 43.5 24Q24 40.5 4.5 24Z" />
        <circle className="cc-brass" cx="24" cy="24" r="7.6" />
        <circle className="cc-face" cx="24" cy="24" r="3.1" />
        <circle className="cc-pale-dot" cx="25.6" cy="22.4" r="1.1" />
      </g>
    </Char>
  );
}

function CameraChar() {
  return (
    <Char id="camera">
      <g className="cc-anim cc-reel">
        <circle className="cc-body" cx="14.5" cy="11.5" r="6.2" />
        <path className="cc-line cc-soft" d="M14.5 5.8v11.4M8.8 11.5h11.4" />
      </g>
      <circle className="cc-body" cx="26.5" cy="9.5" r="4.4" />
      <rect className="cc-body" x="5" y="19" width="24" height="17" rx="3" />
      <path className="cc-body" d="M29 23.2 43 17.6v19.8L29 31.8Z" />
      <Eyes x1={12.4} y={26} x2={19.6} />
      <path className="cc-line" d="M13.4 31q2.6 2.2 5.2 0" />
    </Char>
  );
}

function GearChar() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Char id="gear">
      <g className="cc-anim cc-gear">
        {teeth.map((deg) => (
          <rect
            key={deg}
            className="cc-body"
            x="21.9"
            y="3.6"
            width="4.2"
            height="9"
            rx="1.6"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}
        <circle className="cc-body" cx="24" cy="24" r="11.6" />
        <Eyes x1={21.3} y={21.8} x2={26.7} />
        <circle className="cc-face" cx="24" cy="24.2" r="1.5" />
        <path className="cc-line" d="M21.9 27.6q2.1 1.9 4.2 0" />
      </g>
    </Char>
  );
}

function BookChar() {
  return (
    <Char id="book">
      <path
        className="cc-body"
        d="M24 13.5C19.5 9.8 11.5 8.8 6 10.5v27c5.5-1.7 13.5-.7 18 3 4.5-3.7 12.5-4.7 18-3v-27c-5.5-1.7-13.5-.7-18 3Z"
      />
      <path className="cc-line cc-soft" d="M10 18.5h8M10 23.5h8M30 23.5h8" />
      <path className="cc-anim cc-page" d="M33.5 12.4 42 10.5v8.8c-2.6-2.9-5.4-5.2-8.5-6.9Z" />
      <path className="cc-line" d="M24 13.5v27" />
      <Eyes x1={16.6} y={29.5} x2={31.4} />
      <path className="cc-line" d="M21.6 34q2.4 2.2 4.8 0" />
    </Char>
  );
}

function FlaskChar() {
  return (
    <Char id="flask">
      <path className="cc-line" d="M18.5 5h11" />
      <path
        className="cc-body"
        d="M21 5h6v11.3L35.2 37a3.5 3.5 0 0 1-3.2 4.7H16A3.5 3.5 0 0 1 12.8 37L21 16.3Z"
      />
      <path className="cc-brass" d="M16.9 34h14.2l2.5 5.6a1.9 1.9 0 0 1-1.7 2.7H16.1a1.9 1.9 0 0 1-1.7-2.7Z" />
      <g className="cc-anim cc-bubbles">
        <circle className="cc-line cc-soft" cx="21" cy="30" r="1.6" />
        <circle className="cc-line cc-soft" cx="27" cy="26.5" r="1.2" />
      </g>
      <Eyes x1={20.6} y={21.5} x2={27.4} />
      <path className="cc-line" d="M21.6 25.8q2.4 2.2 4.8 0" />
    </Char>
  );
}

function GlobeChar() {
  return (
    <Char id="globe">
      <g className="cc-anim cc-globe">
        <circle className="cc-body" cx="24" cy="21" r="13" />
        <ellipse className="cc-line cc-soft" cx="24" cy="21" rx="6" ry="13" />
        <path className="cc-line cc-soft" d="M11.9 16h24.2M11.9 26h24.2" />
        <Eyes x1={20.2} y={19.6} x2={27.8} />
        <path className="cc-line" d="M22 23.4q2 1.8 4 0" />
      </g>
      <path className="cc-line" d="M24 34v3.5" />
      <path className="cc-line" d="M15.5 41.5h17" />
    </Char>
  );
}

function MagnifierChar() {
  return (
    <Char id="magnifier">
      <g className="cc-anim cc-mag">
        <line className="cc-handle" x1="30.5" y1="30.5" x2="40.5" y2="40.5" />
        <circle className="cc-body" cx="21" cy="21" r="12.5" />
        <path className="cc-line cc-soft" d="M13.8 14.8a9 9 0 0 1 3.8-3.4" />
        <Eyes x1={17.2} y={19.6} x2={24.8} />
        <path className="cc-line" d="M17.8 25q3.2 2.6 6.4 0" />
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
