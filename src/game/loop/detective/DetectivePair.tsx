/**
 * DetectivePair — Holmes & Watson as production SVG rigs (U4).
 *
 * Purely visual and data-free BY ARCHITECTURE: these components receive
 * only pose / facing / speaking. They never receive game state, a clue,
 * a target, or any evaluation — the pair is answer-blind by construction
 * (BUILD-SCOPE §2.3), and this layer is where that starts.
 *
 * Art of record: the owner-approved loop mockup rig
 * (prototype/loop-overlay.js) and evidence sheet loop-sheet.png — same
 * characters, colours and proportions: Holmes tall/thin in a brick-red
 * plaid coat (#a52a21 base, #bc3a2c bands) with a rust-orange deerstalker
 * (#b45a1b) and burgundy tie; Watson ≈75% of his height and wider, in a
 * royal-blue plaid (#27408b base, #33539f bands) with a navy bowler
 * (#1d2f57), gold tie (#c9a227), cream vest and a ginger moustache.
 * Identity props: deerstalker, bowler, magnifying glass, Watson's
 * notebook / clue card. There is NO pipe — in any pose, ever.
 *
 * Makeover (PR A, staging council Q1): each rig CAN paint its own
 * separation — a cream halo + near-black keyline baked into the
 * SVG under the figure (data-part="halo"), never a live CSS
 * filter. The halo group renders only when the caller passes the
 * `halo` prop (hosts pass isEnabled("hostsStaging")); the default
 * is the pre-A rig, so hostsStaging:false restores the rigs
 * exactly as PR #355–#358 shipped them (cure C5).
 * The bench scene's coffee cups live in the host's bench
 * markup (detective.css), not in these rigs: the cups stay on the
 * bench and never enter play.
 *
 * Expressions are part of every pose (brow + eye + mouth variants), so
 * each pose reads solo at game scale. Watson's moustache stays shrunk
 * with a visible mouth beneath it — he speaks.
 *
 * `speaking` only flaps the mouth: a generic oscillation, NOT lip-sync.
 *
 * Glass hand-off (endings): in the celebrate / high-five / clap poses
 * Holmes no longer holds the magnifying glass — Watson holds it,
 * because the celebration starts with Holmes handing it over (U8
 * choreographs the hand-off itself).
 *
 * High-five contact anchors (viewBox units, unflipped rig space) are
 * exported as HIGH_FIVE_CONTACT so U8 can align the two raised hands
 * palm-to-palm: place the rigs so the two points coincide (accounting
 * for each rig's facing flip and scale).
 */
import type { CSSProperties, ReactElement } from "react";

export const HOLMES_POSES = [
  "dock",
  "walk",
  "search",
  "berth-think",
  "ack",
  "announce",
  "gaze-up",
  "card-look",
  "celebrate-jump",
  "high-five",
  "clap",
  "pout",
] as const;
export type HolmesPose = (typeof HOLMES_POSES)[number];

export const WATSON_POSES = [
  "walk",
  "read",
  "think",
  "station-idle",
  "notebook-mark",
  "gasp",
  "celebrate-jump",
  "high-five",
  "clap",
  "pout",
] as const;
export type WatsonPose = (typeof WATSON_POSES)[number];

export type DetectiveFacing = "left" | "right";

export interface HolmesRigProps {
  pose: HolmesPose;
  facing?: DetectiveFacing;
  speaking?: boolean;
  /** Makeover halo/keyline (PR A): painted ONLY when the caller
   * passes it — hosts pass isEnabled("hostsStaging"). Default false
   * renders the pre-A rig exactly as PR #355–#358 shipped it, so the
   * hostsStaging kill-switch restores the rigs exactly as shipped,
   * including on the summary celebration (cure C5). */
  halo?: boolean;
}

export interface WatsonRigProps {
  pose: WatsonPose;
  facing?: DetectiveFacing;
  speaking?: boolean;
  /** See HolmesRigProps.halo — same gating, same default. */
  halo?: boolean;
}

/** Raised-hand contact points for the high-five, in each rig's viewBox units. */
export const HIGH_FIVE_CONTACT = {
  holmes: { x: 99, y: 25 },
  watson: { x: 15, y: 21 },
} as const;

/** The host's rendered rig height (detective.css pins the figure SVGs
 * to this height); both viewBoxes scale from it. */
export const DETECTIVE_RIG_HEIGHT_PX = 104;

/**
 * Celebrate layout (U8): where Watson's figure must sit, relative to
 * Holmes's figure at the origin, so the two HIGH_FIVE_CONTACT anchors
 * COINCIDE in the high-five pose — palm really meets palm.
 *
 * Facing math: in the celebrate cluster Holmes faces "right" (his art
 * unflipped: contact at viewBox x=99) and Watson faces "left" (his art
 * also unflipped — it profiles left natively: contact at x=15, beside
 * Holmes when Watson stands to his right). Each contact is scaled by
 * its own rig's rendered scale (height ÷ viewBox height), and Watson's
 * offset is exactly the difference of the two rendered contacts.
 */
const holmesScale = DETECTIVE_RIG_HEIGHT_PX / 178; // viewBox 120×178
const watsonScale = DETECTIVE_RIG_HEIGHT_PX / 140; // viewBox 134×140
export const CELEBRATE_LAYOUT = {
  rigHeightPx: DETECTIVE_RIG_HEIGHT_PX,
  /** Holmes's contact point in rendered px, from his figure's origin. */
  holmesContactPx: {
    x: HIGH_FIVE_CONTACT.holmes.x * holmesScale,
    y: HIGH_FIVE_CONTACT.holmes.y * holmesScale,
  },
  /** Watson's contact point in rendered px, from his figure's origin. */
  watsonContactPx: {
    x: HIGH_FIVE_CONTACT.watson.x * watsonScale,
    y: HIGH_FIVE_CONTACT.watson.y * watsonScale,
  },
  /** Watson's figure offset from Holmes's origin for coincident anchors. */
  watsonOffsetPx: {
    x: HIGH_FIVE_CONTACT.holmes.x * holmesScale - HIGH_FIVE_CONTACT.watson.x * watsonScale,
    y: HIGH_FIVE_CONTACT.holmes.y * holmesScale - HIGH_FIVE_CONTACT.watson.y * watsonScale,
  },
} as const;

/* ------------------------------------------------------------------ */
/* Faces — one expression set per pose, rendered alone (never stacked) */
/* ------------------------------------------------------------------ */

type FaceKind =
  | "neutral"
  | "focused"
  | "thinking"
  | "attentive"
  | "hushed"
  | "wonder"
  | "reading"
  | "marking"
  | "delighted"
  | "surprised"
  | "pout";

function HolmesFace({ kind }: { kind: FaceKind }): ReactElement {
  const brow = "#8a6a44";
  switch (kind) {
    case "focused":
      return (
        <g>
          <path d="M61,23 L75,26" stroke={brow} strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="68" cy="28.5" r="2.1" fill="#2c2318" />
          <path className="detective-mouth" d="M65,51 L75,51" stroke="#b57e52" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <path d="M61,22 Q68,19 75,22" fill="none" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="29.5" r="2.1" fill="#2c2318" />
          <path className="detective-mouth" d="M67,51 L74,51" stroke="#b57e52" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "attentive":
      return (
        <g>
          <path d="M61,22 L75,22" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="28" r="2.5" fill="#2c2318" />
          <path className="detective-mouth" d="M65,49.5 Q70,53 75,49.5" fill="none" stroke="#b57e52" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "hushed":
      return (
        <g>
          <path d="M61,22 L75,22" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="28" r="2.3" fill="#2c2318" />
          <ellipse className="detective-mouth" cx="70" cy="51" rx="2.2" ry="3" fill="#7a4632" />
        </g>
      );
    case "wonder":
      return (
        <g>
          <path d="M61,20.5 L75,20.5" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="25.5" r="2.4" fill="#2c2318" />
          <ellipse className="detective-mouth" cx="70" cy="51" rx="2.4" ry="3.2" fill="#7a4632" />
        </g>
      );
    case "reading":
      return (
        <g>
          <path d="M61,24.5 L75,24.5" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="30" r="2.2" fill="#2c2318" />
          <path className="detective-mouth" d="M65,50 Q70,52.5 75,50.5" fill="none" stroke="#b57e52" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "delighted":
      return (
        <g>
          <path d="M61,22 L75,22" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M64.5,28.5 Q68,25 71.5,28.5" fill="none" stroke="#2c2318" strokeWidth="1.9" strokeLinecap="round" />
          <path className="detective-mouth" d="M63,48.5 Q70.5,56.5 78,48.5 Q70.5,53 63,48.5 Z" fill="#7a4632" />
        </g>
      );
    case "surprised":
      return (
        <g>
          <path d="M61,20 L75,21.5" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="28" r="3.3" fill="#2c2318" />
          <ellipse className="detective-mouth" cx="70" cy="51.5" rx="2.8" ry="3.8" fill="#7a4632" />
        </g>
      );
    case "pout":
      return (
        <g>
          <path d="M61,21.5 L74,26" stroke={brow} strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="68" cy="29.5" r="2.1" fill="#2c2318" />
          <path className="detective-mouth" d="M65,53 Q70,49.5 75,53" fill="none" stroke="#b57e52" strokeWidth="1.9" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M61,24.5 L75,24.5" stroke={brow} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="68" cy="28" r="2.3" fill="#2c2318" />
          <path className="detective-mouth" d="M65,50 Q70,52.5 75,50.5" fill="none" stroke="#b57e52" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
  }
}

function WatsonFace({ kind }: { kind: FaceKind }): ReactElement {
  const brow = "#6e5136";
  switch (kind) {
    case "reading":
      // Eyes ON the clue card: gaze dropped and shifted toward the card.
      return (
        <g>
          <path d="M41,22 L54,24" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="29.5" r="2.2" fill="#2c2318" />
          <path className="detective-mouth" d="M47,49.5 Q54,52.5 61,49.5" fill="none" stroke="#a06a42" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <path d="M41,20 Q48,17.5 54,20.5" fill="none" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="25.5" r="2.2" fill="#2c2318" />
          <path className="detective-mouth" d="M48,50.5 L60,50.5" stroke="#a06a42" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
    case "marking":
      return (
        <g>
          <path d="M41,21 L54,25" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="30" r="2.1" fill="#2c2318" />
          <path className="detective-mouth" d="M48,51 L60,51" stroke="#a06a42" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
    case "delighted":
      return (
        <g>
          <path d="M41,19 L54,21.5" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <path d="M44.5,27.5 Q48,24.2 51.5,27.5" fill="none" stroke="#2c2318" strokeWidth="1.9" strokeLinecap="round" />
          <path className="detective-mouth" d="M45,47.5 Q54,56 63,47.5 Q54,52 45,47.5 Z" fill="#7a4632" />
        </g>
      );
    case "surprised":
      return (
        <g>
          <path d="M41,17.5 L54,20" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="27" r="3.3" fill="#2c2318" />
          <ellipse className="detective-mouth" cx="54" cy="50.5" rx="3" ry="3.8" fill="#7a4632" />
        </g>
      );
    case "pout":
      return (
        <g>
          <path d="M41,20 L54,24.5" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="28.5" r="2.1" fill="#2c2318" />
          <path className="detective-mouth" d="M47,52.5 Q54,48.5 61,52.5" fill="none" stroke="#a06a42" strokeWidth="1.9" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M41,21 L54,23.5" stroke={brow} strokeWidth="2" strokeLinecap="round" />
          <circle cx="48" cy="27" r="2.3" fill="#2c2318" />
          <path className="detective-mouth" d="M47,49.5 Q54,52.5 61,49.5" fill="none" stroke="#a06a42" strokeWidth="1.7" strokeLinecap="round" />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Holmes — viewBox 0 0 120 178 (tall, thin; geometry from the mockup) */
/* ------------------------------------------------------------------ */

interface HolmesPoseSpec {
  face: FaceKind;
  head: string;
  torso: string;
  /** rotation of the front (glass) arm, degrees, around 78,58 */
  frontArm: number;
  /** rotation of the swing arm, degrees, around 44,58 */
  swingArm: number;
  /** magnifying-glass group rotation; null = glass handed to Watson */
  glass: number | null;
  card: boolean;
}

const HOLMES_POSE_SPECS: Record<HolmesPose, HolmesPoseSpec> = {
  dock: { face: "neutral", head: "", torso: "", frontArm: 0, swingArm: 0, glass: 152, card: false },
  walk: { face: "focused", head: "", torso: "", frontArm: 0, swingArm: 0, glass: 152, card: false },
  search: { face: "focused", head: "rotate(7deg) translateY(2px)", torso: "rotate(5deg)", frontArm: -24, swingArm: 0, glass: 152, card: false },
  "berth-think": { face: "thinking", head: "rotate(3.5deg) translateY(1.5px)", torso: "", frontArm: -112, swingArm: 0, glass: -93, card: false },
  ack: { face: "attentive", head: "rotate(-6deg)", torso: "", frontArm: -30, swingArm: 0, glass: 152, card: false },
  announce: { face: "hushed", head: "rotate(6deg) translate(2px, 1px)", torso: "rotate(10deg)", frontArm: -10, swingArm: 4, glass: 152, card: false },
  "gaze-up": { face: "wonder", head: "rotate(-6deg)", torso: "rotate(-2deg)", frontArm: 0, swingArm: 0, glass: 152, card: false },
  "card-look": { face: "reading", head: "rotate(4deg) translateY(1.5px)", torso: "rotate(2deg)", frontArm: 0, swingArm: -14, glass: 152, card: true },
  "celebrate-jump": { face: "delighted", head: "", torso: "", frontArm: -32, swingArm: 140, glass: null, card: false },
  "high-five": { face: "delighted", head: "rotate(-2deg)", torso: "", frontArm: 0, swingArm: 6, glass: null, card: false },
  clap: { face: "delighted", head: "", torso: "", frontArm: 38, swingArm: -38, glass: null, card: false },
  pout: { face: "pout", head: "rotate(9deg) translateY(3.5px)", torso: "rotate(2.5deg) translateY(2px)", frontArm: 6, swingArm: -4, glass: 152, card: false },
};

const part = (transform: string, origin: string): CSSProperties =>
  transform ? { transform, transformOrigin: origin } : { transformOrigin: origin };

export function HolmesRig({ pose, facing = "right", speaking = false, halo = false }: HolmesRigProps): ReactElement {
  const spec = HOLMES_POSE_SPECS[pose];
  const flip = facing === "left" ? "translate(120 0) scale(-1 1)" : undefined;
  const hi = pose === "high-five";
  return (
    <svg
      viewBox="0 0 120 178"
      aria-hidden="true"
      className={`detective-rig detective-holmes detective-pose-${pose}${speaking ? " detective-speaking" : ""}`}
      data-pose={pose}
      data-facing={facing}
    >
      <defs>
        <pattern id="detective-plaid-holmes" width="15" height="15" patternUnits="userSpaceOnUse">
          <rect width="15" height="15" fill="#a52a21" />
          <rect width="15" height="5" y="5" fill="#bc3a2c" />
          <rect width="5" height="15" x="5" fill="#bc3a2c" />
          <path d="M0,12.5 L15,12.5 M12.5,0 L12.5,15" stroke="#e8d9a0" strokeWidth="1" opacity=".55" />
        </pattern>
        <pattern id="detective-plaid-deerstalker" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#b45a1b" />
          <rect width="12" height="4" y="4" fill="#c06c26" />
          <rect width="4" height="12" x="4" fill="#c06c26" />
          <path d="M0,10 L12,10 M10,0 L10,12" stroke="#6e4520" strokeWidth=".9" opacity=".55" />
        </pattern>
      </defs>
      <g transform={flip}>
        {/* MAKEOVER (PR A): separation BAKED into the art — a cream halo
            with a near-black keyline painted UNDER the figure, inside
            the SVG itself. Two stroke layers over the figure's own
            silhouette paths: the wide dark layer leaves ~1.5 px of
            keyline outside the narrower cream layer's ~3.5 px halo
            (at the 104 px render scale). No CSS filter / drop-shadow
            is ever applied to a moving figure (perf veto). */}
        {halo ? (
        <g data-part="halo" aria-hidden="true">
          <ellipse cx="60" cy="173" rx="36" ry="5.5" fill="#fff6dd" stroke="#171310" strokeWidth="2.6" />
          <g fill="#fff6dd" stroke="#171310" strokeWidth="17" strokeLinejoin="round">
            <path d="M46,14 Q62,5 76,14 L79,38 Q78,56 63,59 Q48,57 45,40 Z" />
            <path d="M40,52 C33,80 32,104 35,132 L86,132 C89,104 88,80 81,52 C68,45 53,45 40,52 Z" />
            <path d="M42,16 Q61,-4 80,16 L80,20 L42,20 Z" />
          </g>
          <g fill="#fff6dd" stroke="#fff6dd" strokeWidth="11.5" strokeLinejoin="round">
            <path d="M46,14 Q62,5 76,14 L79,38 Q78,56 63,59 Q48,57 45,40 Z" />
            <path d="M40,52 C33,80 32,104 35,132 L86,132 C89,104 88,80 81,52 C68,45 53,45 40,52 Z" />
            <path d="M42,16 Q61,-4 80,16 L80,20 L42,20 Z" />
          </g>
          <path d="M64,118 L64,162" stroke="#171310" strokeWidth="27" strokeLinecap="round" />
          <path d="M52,118 L52,162" stroke="#171310" strokeWidth="27" strokeLinecap="round" />
          <path d="M64,118 L64,162" stroke="#fff6dd" strokeWidth="21.5" strokeLinecap="round" />
          <path d="M52,118 L52,162" stroke="#fff6dd" strokeWidth="21.5" strokeLinecap="round" />
        </g>
        ) : null}
        <g data-part="leg-b" style={{ transformOrigin: "64px 118px" }}>
          <path d="M64,118 L64,162" stroke="#3d4950" strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="68" cy="167" rx="9" ry="4.2" fill="#241d16" />
        </g>
        <g data-part="leg-a" style={{ transformOrigin: "52px 118px" }}>
          <path d="M52,118 L52,162" stroke="#46525c" strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="56" cy="167" rx="9" ry="4.2" fill="#2b2119" />
        </g>
        <g data-part="bob">
          <g data-part="arm-swing" style={part(spec.swingArm ? `rotate(${spec.swingArm}deg)` : "", "44px 58px")}>
            <path d="M44,58 L37,95" stroke="#93261c" strokeWidth="10" strokeLinecap="round" />
            <circle cx="37" cy="98" r="4.6" fill="#f2c49b" />
            {spec.card ? (
              <g data-part="clue-card" transform="rotate(-8 30 96)">
                <rect x="19" y="84" width="21" height="27" rx="2.5" fill="#fffdf6" stroke="#c9a83f" strokeWidth="1.8" />
                <path d="M23.5,92 L35.5,92 M23.5,98 L35.5,98 M23.5,104 L32,104" stroke="#a07d2c" strokeWidth="1.7" />
              </g>
            ) : null}
          </g>
          <g data-part="torso" style={part(spec.torso, "60px 132px")}>
            <path d="M40,52 C33,80 32,104 35,132 L86,132 C89,104 88,80 81,52 C68,45 53,45 40,52 Z" fill="url(#detective-plaid-holmes)" />
            <path d="M52,50 L72,50 L74,132 L50,132 Z" fill="#8c231b" />
            <path d="M54,48 L70,48 L62,66 Z" fill="#f0e6d2" />
            {/* burgundy tie */}
            <path d="M60,55 L64,55 L63,74 L61,74 Z" fill="#7a2e3a" />
            <circle cx="62" cy="88" r="1.9" fill="#5f130d" />
            <circle cx="62" cy="103" r="1.9" fill="#5f130d" />
          </g>
          {hi ? (
            // Arm fully up — the raised hand IS the contact point
            // (HIGH_FIVE_CONTACT.holmes), drawn explicitly so the
            // anchor never drifts with a rotation guess.
            <g data-part="arm-front">
              <path d="M78,58 L97,27" stroke="#8c231b" strokeWidth="10" strokeLinecap="round" />
              <circle cx={HIGH_FIVE_CONTACT.holmes.x} cy={HIGH_FIVE_CONTACT.holmes.y} r="4.6" fill="#f2c49b" />
            </g>
          ) : (
            <g data-part="arm-front" style={part(spec.frontArm ? `rotate(${spec.frontArm}deg)` : "", "78px 58px")}>
              <path d="M78,58 L86,80" stroke="#8c231b" strokeWidth="10" strokeLinecap="round" />
              <circle cx="87" cy="83" r="4.6" fill="#f2c49b" />
              {spec.glass !== null ? (
                <g
                  data-part="glass"
                  style={{ transform: `rotate(${spec.glass}deg)`, transformOrigin: "87px 83px" }}
                >
                  <path d="M89,79 L98,66" stroke="#6e5636" strokeWidth="3.6" strokeLinecap="round" />
                  <circle cx="104" cy="59" r="12.5" fill="#cfe8ef" fillOpacity=".5" stroke="#6e5636" strokeWidth="3.2" />
                  <circle cx="100" cy="55" r="3.4" fill="#ffffff" opacity=".55" />
                </g>
              ) : null}
            </g>
          )}
          <g data-part="head" style={part(spec.head, "62px 54px")}>
            <path d="M46,14 Q62,5 76,14 L79,38 Q78,56 63,59 Q48,57 45,40 Z" fill="#f2c49b" />
            <path d="M77,30 L93,37 L77,44 Z" fill="#f2c49b" />
            <circle cx="43" cy="31" r="4" fill="#6e5136" />
            <circle cx="42" cy="39" r="4" fill="#6e5136" />
            <HolmesFace kind={spec.face} />
            <g data-part="hat">
              <path d="M42,16 Q61,-4 80,16 L80,20 L42,20 Z" fill="url(#detective-plaid-deerstalker)" />
              <ellipse cx="90" cy="19" rx="14" ry="3.6" fill="url(#detective-plaid-deerstalker)" />
              <ellipse cx="32" cy="19" rx="11" ry="3.4" fill="#8a5a17" />
              <rect x="43" y="15" width="8" height="18" rx="3.5" fill="#8a5a17" />
              <path d="M52,4 L60,0 L60,7 Z" fill="#8a5a17" />
              <path d="M70,4 L62,0 L62,7 Z" fill="#8a5a17" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Watson — viewBox 0 0 134 140 (shorter, wider; geometry from mockup) */
/* ------------------------------------------------------------------ */

interface WatsonPoseSpec {
  face: FaceKind;
  head: string;
  torso: string;
  /** rotation of the front arm, degrees, around 36,54 */
  frontArm: number;
  /** rotation of the notebook arm, degrees, around 82,54 */
  noteArm: number;
  notebook: boolean;
  /** clue card held up in the notebook hand (read / think) */
  card: boolean;
  pencil: boolean;
  /** Watson holds Holmes's glass (celebration hand-off) */
  glass: boolean;
}

const WATSON_POSE_SPECS: Record<WatsonPose, WatsonPoseSpec> = {
  // PR B: the gutter walk — notebook in hand, neutral face; the leg
  // and bob swing comes from detective.css's shared walk keyframes
  // (they address leg-a / leg-b / bob, which this rig has).
  walk: { face: "neutral", head: "", torso: "", frontArm: 0, noteArm: 0, notebook: true, card: false, pencil: true, glass: false },
  read: { face: "reading", head: "rotate(4deg) translateY(1.5px)", torso: "", frontArm: 0, noteArm: -52, notebook: false, card: true, pencil: false, glass: false },
  think: { face: "thinking", head: "rotate(-4deg)", torso: "", frontArm: 0, noteArm: -52, notebook: false, card: true, pencil: false, glass: false },
  "station-idle": { face: "neutral", head: "", torso: "", frontArm: 0, noteArm: 0, notebook: true, card: false, pencil: true, glass: false },
  "notebook-mark": { face: "marking", head: "rotate(3deg) translateY(1.5px)", torso: "rotate(2deg)", frontArm: 0, noteArm: -20, notebook: true, card: false, pencil: true, glass: false },
  gasp: { face: "surprised", head: "rotate(-8deg)", torso: "rotate(-5deg)", frontArm: -36, noteArm: 16, notebook: true, card: false, pencil: false, glass: false },
  "celebrate-jump": { face: "delighted", head: "", torso: "", frontArm: -14, noteArm: -80, notebook: false, card: false, pencil: false, glass: true },
  "high-five": { face: "delighted", head: "rotate(2deg)", torso: "", frontArm: 0, noteArm: 0, notebook: true, card: false, pencil: false, glass: false },
  clap: { face: "delighted", head: "", torso: "", frontArm: -52, noteArm: 40, notebook: false, card: false, pencil: false, glass: false },
  pout: { face: "pout", head: "rotate(9deg) translateY(3.5px)", torso: "rotate(2.5deg) translateY(2px)", frontArm: -4, noteArm: 4, notebook: true, card: false, pencil: false, glass: false },
};

export function WatsonRig({ pose, facing = "right", speaking = false, halo = false }: WatsonRigProps): ReactElement {
  const spec = WATSON_POSE_SPECS[pose];
  // Watson's base art profiles LEFT (nose at the left of the head), so
  // the default "right" facing is the flip — one art, mirrored.
  const flip = facing === "right" ? "translate(134 0) scale(-1 1)" : undefined;
  const hi = pose === "high-five";
  return (
    <svg
      viewBox="0 0 134 140"
      aria-hidden="true"
      className={`detective-rig detective-watson detective-pose-${pose}${speaking ? " detective-speaking" : ""}`}
      data-pose={pose}
      data-facing={facing}
    >
      <defs>
        <pattern id="detective-plaid-watson" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#27408b" />
          <rect width="14" height="4.5" y="4.5" fill="#33539f" />
          <rect width="4.5" height="14" x="4.5" fill="#33539f" />
          <path d="M0,11.5 L14,11.5 M11.5,0 L11.5,14" stroke="#d7e3ff" strokeWidth=".9" opacity=".35" />
        </pattern>
      </defs>
      <g transform={flip}>
        {/* MAKEOVER (PR A): baked cream halo + near-black keyline,
            same construction as Holmes's — see the note there.
            Watson's render scale (104/140) differs, so the stroke
            widths differ; the rendered halo/keyline match. */}
        {halo ? (
        <g data-part="halo" aria-hidden="true">
          <ellipse cx="60" cy="136" rx="38" ry="5.5" fill="#fff6dd" stroke="#171310" strokeWidth="2.6" />
          <g fill="#fff6dd" stroke="#171310" strokeWidth="13.5" strokeLinejoin="round">
            <path d="M36,16 Q60,6 84,16 L86,34 Q84,52 60,54 Q36,52 34,34 Z" />
            <path d="M28,46 C21,68 23,90 27,110 L93,110 C97,90 99,68 92,46 C74,37 46,37 28,46 Z" />
            <path d="M33,15 Q60,-6 87,15 L87,18 L33,18 Z" />
          </g>
          <g fill="#fff6dd" stroke="#fff6dd" strokeWidth="9" strokeLinejoin="round">
            <path d="M36,16 Q60,6 84,16 L86,34 Q84,52 60,54 Q36,52 34,34 Z" />
            <path d="M28,46 C21,68 23,90 27,110 L93,110 C97,90 99,68 92,46 C74,37 46,37 28,46 Z" />
            <path d="M33,15 Q60,-6 87,15 L87,18 L33,18 Z" />
          </g>
          <path d="M66,92 L66,128" stroke="#171310" strokeWidth="24" strokeLinecap="round" />
          <path d="M52,92 L52,128" stroke="#171310" strokeWidth="24" strokeLinecap="round" />
          <path d="M66,92 L66,128" stroke="#fff6dd" strokeWidth="19.5" strokeLinecap="round" />
          <path d="M52,92 L52,128" stroke="#fff6dd" strokeWidth="19.5" strokeLinecap="round" />
        </g>
        ) : null}
        <g data-part="leg-b" style={{ transformOrigin: "66px 92px" }}>
          <path d="M66,92 L66,128" stroke="#2e3a52" strokeWidth="10.5" strokeLinecap="round" />
          <ellipse cx="62" cy="133" rx="9" ry="4.2" fill="#2b2119" />
        </g>
        <g data-part="leg-a" style={{ transformOrigin: "52px 92px" }}>
          <path d="M52,92 L52,128" stroke="#35435f" strokeWidth="10.5" strokeLinecap="round" />
          <ellipse cx="48" cy="133" rx="9" ry="4.2" fill="#33261a" />
        </g>
        <g data-part="bob">
          <g data-part="arm-note" style={part(spec.noteArm ? `rotate(${spec.noteArm}deg)` : "", "82px 54px")}>
            <path d="M82,54 L90,84" stroke="#21376e" strokeWidth="10" strokeLinecap="round" />
            <circle cx="90" cy="86" r="4.4" fill="#eebd93" />
            {spec.notebook ? (
              <g data-part="notebook" transform="rotate(8 90 98)">
                <rect x="78" y="84" width="24" height="30" rx="2.5" fill="#f3e9cf" stroke="#c9b98f" strokeWidth="1.6" />
                <path d="M83,92 L97,92 M83,99 L97,99 M83,106 L93,106" stroke="#b7a678" strokeWidth="1.6" />
              </g>
            ) : null}
            {spec.card ? (
              <g data-part="clue-card" transform="rotate(8 90 98)">
                <rect x="76" y="82" width="28" height="34" rx="2.5" fill="#fffdf6" stroke="#c9a83f" strokeWidth="1.8" />
                <path d="M81,91 L99,91 M81,98 L99,98 M81,105 L94,105" stroke="#a07d2c" strokeWidth="1.7" />
              </g>
            ) : null}
            {spec.pencil ? (
              <path data-part="pencil" d="M90,86 L99,76" stroke="#c9a227" strokeWidth="3" strokeLinecap="round" />
            ) : null}
            {spec.glass ? (
              <g data-part="glass">
                <path d="M92,82 L101,69" stroke="#6e5636" strokeWidth="3.6" strokeLinecap="round" />
                <circle cx="107" cy="62" r="12.5" fill="#cfe8ef" fillOpacity=".5" stroke="#6e5636" strokeWidth="3.2" />
                <circle cx="103" cy="58" r="3.4" fill="#ffffff" opacity=".55" />
              </g>
            ) : null}
          </g>
          <g data-part="torso" style={part(spec.torso, "60px 110px")}>
            <path d="M28,46 C21,68 23,90 27,110 L93,110 C97,90 99,68 92,46 C74,37 46,37 28,46 Z" fill="url(#detective-plaid-watson)" />
            {/* cream vest */}
            <path d="M52,44 L68,44 L70,110 L50,110 Z" fill="#f0e6d2" />
            {/* gold tie */}
            <path d="M58,47 L62,47 L61.5,66 L58.5,66 Z" fill="#c9a227" />
            <circle cx="43" cy="70" r="1.8" fill="#101f3d" />
            <circle cx="43" cy="89" r="1.8" fill="#101f3d" />
            <circle cx="77" cy="70" r="1.8" fill="#101f3d" />
            <circle cx="77" cy="89" r="1.8" fill="#101f3d" />
          </g>
          {hi ? (
            // Arm fully up — the raised hand IS the contact point
            // (HIGH_FIVE_CONTACT.watson), drawn explicitly.
            <g data-part="arm-front">
              <path d="M36,54 L17,23" stroke="#21376e" strokeWidth="10" strokeLinecap="round" />
              <circle cx={HIGH_FIVE_CONTACT.watson.x} cy={HIGH_FIVE_CONTACT.watson.y} r="4.6" fill="#eebd93" />
            </g>
          ) : (
            <g data-part="arm-front" style={part(spec.frontArm ? `rotate(${spec.frontArm}deg)` : "", "36px 54px")}>
              <path d="M36,54 L27,86" stroke="#21376e" strokeWidth="10" strokeLinecap="round" />
              <circle cx="26" cy="89" r="4.6" fill="#eebd93" />
            </g>
          )}
          <g data-part="head" style={part(spec.head, "60px 50px")}>
            <path d="M36,16 Q60,6 84,16 L86,34 Q84,52 60,54 Q36,52 34,34 Z" fill="#eebd93" />
            <path d="M35,29 L27,34 L35,38 Z" fill="#eebd93" />
            <circle cx="40" cy="35" r="4.5" fill="#e89b7a" opacity=".55" />
            <circle cx="81" cy="33" r="3.6" fill="#e0aa7e" />
            {/* ginger moustache — shrunk, mouth visible beneath it */}
            <rect x="43" y="38" width="29" height="8" rx="4" fill="#c07a3a" />
            <path d="M50,39.5 L50,45 M57.5,39.5 L57.5,45 M65,39.5 L65,45" stroke="#a5662c" strokeWidth="1.4" />
            <WatsonFace kind={spec.face} />
            <g data-part="hat">
              <path d="M33,15 Q60,-6 87,15 L87,18 L33,18 Z" fill="#1d2f57" />
              <ellipse cx="60" cy="18" rx="33" ry="5.2" fill="#1d2f57" />
              <rect x="33" y="10" width="54" height="5" fill="#12203c" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
