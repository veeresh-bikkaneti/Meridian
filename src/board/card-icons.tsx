import type { ReactNode } from "react";
import type { SnapshotStory } from "./board-data";
import { characterForStory, type CardCharacterId } from "./card-character-map";

/**
 * The flat icon siblings of the card characters (card-characters.tsx).
 *
 * Owner, 2026-11-13: "Combine both styles — the icon and details on
 * card." Every card now carries BOTH representations of its theme:
 * the detailed v2 mascot in the header row, and one of these clean
 * flat icons — the same object drawn icon-style in the same 48-unit
 * grid language: bold single-weight (3.2-unit) strokes or a filled
 * silhouette, NO face, NO shadow — on a small brass chip beside the
 * card's status stamp/pill. The icon is a simplified sibling of its
 * mascot, so the pair reads as one family in two styles.
 *
 * The chip is STATIC (no animation — the mascot is the card's one
 * moving element) and decorative reinforcement: the glyph is
 * aria-hidden, the chip carries the theme name as a title plus a
 * visually-hidden label, and the card's text carries the meaning.
 * Same mapping as the mascots (characterForStory) — never forked.
 */
function Icon({
  id,
  children,
}: {
  id: CardCharacterId;
  children: ReactNode;
}) {
  return (
    <svg
      className={`board-card-theme-icon board-icon-${id}`}
      data-theme-icon={id}
      viewBox="0 0 48 48"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function MicIcon() {
  return (
    <Icon id="mic">
      <rect className="ci-line" x="18" y="5" width="12" height="23" rx="6" />
      <path className="ci-line" d="M12.5 20.5a11.5 11.5 0 0 0 23 0" />
      <path className="ci-line" d="M24 32v7M17 42.5h14" />
    </Icon>
  );
}

function CompassIcon() {
  return (
    <Icon id="compass">
      <circle className="ci-line" cx="24" cy="24" r="15" />
      <polygon
        className="ci-fill"
        points="24,12.5 27.2,20.8 35.5,24 27.2,27.2 24,35.5 20.8,27.2 12.5,24 20.8,20.8"
      />
    </Icon>
  );
}

function AbacusIcon() {
  return (
    <Icon id="abacus">
      <rect className="ci-line" x="8" y="8" width="32" height="32" rx="3" />
      <path className="ci-line" d="M11 19.5h26M11 30.5h26" />
      <circle className="ci-fill" cx="15.5" cy="19.5" r="3.6" />
      <circle className="ci-fill" cx="31" cy="19.5" r="3.6" />
      <circle className="ci-fill" cx="23" cy="30.5" r="3.6" />
    </Icon>
  );
}

function WrenchIcon() {
  return (
    <Icon id="wrench">
      <path
        className="ci-fill"
        d="M37.5 4.5a11 11 0 0 0-10.9 15.4L7.2 39.3a4.9 4.9 0 1 0 7 7L33.6 26.9A11 11 0 0 0 43.5 16l-6.9 6.9-5.6-1.5-1.5-5.6z"
      />
    </Icon>
  );
}

function EyeIcon() {
  return (
    <Icon id="eye">
      <path className="ci-line" d="M4.5 24Q24 7.5 43.5 24Q24 40.5 4.5 24Z" />
      <circle className="ci-fill" cx="24" cy="24" r="5" />
    </Icon>
  );
}

function CameraIcon() {
  return (
    <Icon id="camera">
      <circle className="ci-line" cx="14" cy="12.5" r="6" />
      <circle className="ci-line" cx="25.5" cy="10.5" r="3.9" />
      <rect className="ci-line" x="5" y="19.5" width="22" height="16.5" rx="3" />
      <path className="ci-line" d="M27 24.5 42.5 18.8v17.9L27 31Z" />
    </Icon>
  );
}

function GearIcon() {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Icon id="gear">
      {teeth.map((deg) => (
        <line
          key={deg}
          className="ci-line"
          x1="24"
          y1="5"
          x2="24"
          y2="13.5"
          transform={`rotate(${deg} 24 24)`}
        />
      ))}
      <circle className="ci-line" cx="24" cy="24" r="10" />
      <circle className="ci-fill" cx="24" cy="24" r="2.6" />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon id="book">
      <path
        className="ci-line"
        d="M24 13.5C19.5 9.8 11.5 8.6 5.5 10.2v27.3c6-1.6 14-.4 18.5 3.3 4.5-3.7 12.5-4.9 18.5-3.3V10.2c-6-1.6-14-.4-18.5 3.3Z"
      />
      <path className="ci-line" d="M24 13.5v27.3" />
    </Icon>
  );
}

function FlaskIcon() {
  return (
    <Icon id="flask">
      <path className="ci-line" d="M18.5 6h11" />
      <path
        className="ci-line"
        d="M21 6v10.5L12.6 37.2A3.4 3.4 0 0 0 15.8 42h16.4a3.4 3.4 0 0 0 3.2-4.8L27 16.5V6"
      />
      <path className="ci-line" d="M16.8 31h14.4" />
      <circle className="ci-fill" cx="24" cy="36.5" r="1.7" />
    </Icon>
  );
}

function GlobeIcon() {
  return (
    <Icon id="globe">
      <circle className="ci-line" cx="24" cy="22" r="14.5" />
      <ellipse className="ci-line" cx="24" cy="22" rx="6.8" ry="14.5" />
      <path className="ci-line" d="M9.5 22h29M24 36.8V43M16 44.5h16" />
    </Icon>
  );
}

function MagnifierIcon() {
  return (
    <Icon id="magnifier">
      <circle className="ci-line" cx="21" cy="21" r="10.5" />
      <line className="ci-bold" x1="29" y1="29" x2="40.5" y2="40.5" />
    </Icon>
  );
}

export const CARD_ICONS: Record<CardCharacterId, () => ReactNode> = {
  mic: MicIcon,
  compass: CompassIcon,
  abacus: AbacusIcon,
  wrench: WrenchIcon,
  eye: EyeIcon,
  camera: CameraIcon,
  gear: GearIcon,
  book: BookIcon,
  flask: FlaskIcon,
  globe: GlobeIcon,
  magnifier: MagnifierIcon,
};

/** Plain-word theme names for the chip's accessible label. */
export const THEME_LABELS: Record<CardCharacterId, string> = {
  mic: "Voice and narration",
  compass: "Maps, places and clues",
  abacus: "Math and numbers",
  wrench: "Fixes",
  eye: "Accessibility",
  camera: "Film and video",
  gear: "Infrastructure and process",
  book: "Stories and journals",
  flask: "Physics and chemistry",
  globe: "Social studies and general knowledge",
  magnifier: "Detective work and games",
};

/**
 * The brass theme chip for one story card: the flat icon for the
 * story's mapped theme (the same characterForStory result the
 * mascot uses), beside the card's status stamp/pill.
 */
export function CardThemeChip({
  story,
}: {
  story: Pick<SnapshotStory, "lane" | "title">;
}) {
  const id = characterForStory(story);
  const IconGlyph = CARD_ICONS[id];
  return (
    <span
      className="board-theme-chip"
      data-theme-chip={id}
      title={`Theme: ${THEME_LABELS[id]}`}
    >
      <IconGlyph />
      <span className="sr-only">Theme: {THEME_LABELS[id]}</span>
    </span>
  );
}
