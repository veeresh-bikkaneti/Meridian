/**
 * use-age-profile-host.tsx — the age-profile state owner and overlay
 * host (game-app-map step 4, TD-06.6).
 *
 * Everything age-profile that GameApp used to hold inline lives here:
 * the profile state (parent-set band, refreshed via the
 * `ageprofile:changed` event), the ask-first hold and its gate, the
 * settings open/close wiring with focus return, the confirmation
 * toast, and the overlay pieces the composer and Home place — the
 * locked-loop slot, the footer's read-aloud setting, and the
 * first-visit queue's read-aloud entry. GameApp only calls this hook
 * and passes the values and slots on; the widgets' imports stay
 * inside this feature area.
 *
 * The settings screen and the ask gate stay React.lazy: zero
 * initial-bundle cost, exactly as when GameApp hosted them. Their
 * Suspense + MapErrorBoundary wrappers stay at the composer's render
 * sites (the boundary is a components/root module; the composer owns
 * it until it moves to layer 6).
 */

import {
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
// Age-profile system: the parent-set group (7-10 / 10-18 / 18+). Game
// screens use ONLY this facade — the store is never imported directly.
import {
  loadProfile,
  onAgeProfileChanged,
  resolveBand,
  type AgeBandId,
  type AgeProfile,
} from "@/game/age-profile";
import { shouldAskReadAloudPref } from "@/game/age-profile/read-aloud-pref";
import type { FirstVisitPrompt } from "../ui/first-visit-queue";
import "./age-profile.css";
import { LockedLoop } from "./LockedLoop";
import { ReadAloudPrefPrompt, READ_ALOUD_PREF_HEADING_ID } from "./ReadAloudPrefPrompt";
import { ReadAloudPrefSettings } from "./ReadAloudPrefSettings";

const AgeProfileSettings = lazy(() => import("./AgeProfileSettings"));
const AgeAskGate = lazy(() => import("./AgeAskGate"));

export interface AgeProfileHost {
  /** Effective age band ("10-18" when unset). */
  ageBand: AgeBandId;
  /** The held ask-first continuation, or null when no ask is up. */
  ageAsk: { proceed: () => void } | null;
  /** Drop a held ask without running it (cache-restore reset). */
  clearAgeAsk: () => void;
  /** Ask-first: run a case-start continuation now, or hold it behind the picker. */
  askAgeFirst: (proceed: () => void) => void;
  /** The ask gate element (the composer wraps it in Suspense + boundary). */
  ageAskGate: ReactNode;
  ageSettingsOpen: boolean;
  openAgeSettings: (e?: ReactMouseEvent<HTMLElement>) => void;
  /** The settings element for a render site, or null while closed. */
  ageSettings: (runInProgress: boolean) => ReactNode;
  /** The current confirmation toast text, or null. */
  ageToast: string | null;
  /** The toast element, or null. */
  ageToastNode: ReactNode;
  /** The locked GeoDetective tile, as a slot for Home (Home never imports it). */
  lockedLoop: ReactNode;
  /** The footer's read-aloud setting, as a slot for Home's SiteFooter lead. */
  readAloudPrefSettings: ReactNode;
  /** The first-visit queue's read-aloud entry, or null when it does not ask. */
  readAloudPrefEntry: (onAnswered: () => void) => FirstVisitPrompt | null;
}

export function useAgeProfileHost(): AgeProfileHost {
  // Ask-first (owner decision, 2026-11-14): a "Resume your case"
  // attempted with no age band set holds its continuation here
  // while the age picker is answered (see askAgeFirst below). The
  // Why Learn flow asks on the picker page itself since the
  // 2026-11-15 amendment, so the resume paths are the ones still
  // held here. Session-only, like the screens it guards — a cache
  // restore drops it with them, so no case can start off the back
  // of a frozen page.
  const [ageAsk, setAgeAsk] = useState<{ proceed: () => void } | null>(null);
  // Age profile (parent-set band). The profile object lives in state and
  // refreshes via the `ageprofile:changed` event — game screens never
  // touch the store directly. The settings screen (lazy) is the only
  // writer of parent-control mutations.
  const [ageProfile, setAgeProfile] = useState(() => loadProfile());
  useEffect(() => onAgeProfileChanged(() => setAgeProfile(loadProfile())), []);
  const ageBand: AgeBandId = resolveBand(ageProfile);
  const [ageSettingsOpen, setAgeSettingsOpen] = useState(false);
  const [ageToast, setAgeToast] = useState<string | null>(null);
  useEffect(() => {
    if (ageToast === null) return;
    const id = window.setTimeout(() => setAgeToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [ageToast]);
  // Invoking control for the age settings (footer "For grown-ups" link or
  // locked-tile grown-up link) — focus returns here when the settings close.
  const ageTriggerRef = useRef<HTMLElement | null>(null);
  const openAgeSettings = useCallback((e?: ReactMouseEvent<HTMLElement>) => {
    // Remember the invoking control ("For grown-ups" footer link or the
    // locked-tile grown-up link) so focus can return to it on close.
    if (e) ageTriggerRef.current = e.currentTarget;
    setAgeSettingsOpen(true);
  }, []);
  const closeAgeSettings = useCallback(() => {
    const trigger = ageTriggerRef.current;
    ageTriggerRef.current = null;
    setAgeSettingsOpen(false);
    if (trigger && document.contains(trigger)) {
      // The settings unmount on the next paint — return focus after that,
      // without scrolling the home page.
      requestAnimationFrame(() => {
        if (document.contains(trigger)) trigger.focus({ preventScroll: true });
      });
    }
  }, []);
  const clearAgeAsk = useCallback(() => setAgeAsk(null), []);
  // Ask-first (owner decision, 2026-11-14): the case-start paths
  // that bypass the picker page — "Resume your case" in the
  // subjects branch and on Home's GeoDetective card — run their
  // continuation through here. With a band set the continuation
  // runs immediately and the player sees no change; with none set,
  // the continuation is held and the age picker (AgeAskGate,
  // prod's own AgePicker) renders instead. The pick writes the
  // band through the store's unset path, then the held
  // continuation runs — the player lands on the case they were
  // going to, at the band they picked. Backing out clears the
  // hold: no write, no case. The Why Learn entry and the subject
  // cards ask on the picker page itself since the 2026-11-15
  // amendment (AgeBandControl's pills — Radhae's reconciliation
  // design): no case can start from that page with no band set,
  // and the ask stays contained in that workflow.
  const askAgeFirst = useCallback(
    (proceed: () => void): void => {
      if (ageProfile.status !== "unset") {
        proceed();
        return;
      }
      setAgeAsk({ proceed });
    },
    [ageProfile.status],
  );
  const ageAskGate = ageAsk ? (
    <AgeAskGate
      onPicked={() => {
        const proceed = ageAsk.proceed;
        setAgeAsk(null);
        proceed();
      }}
      onCancel={() => setAgeAsk(null)}
    />
  ) : null;
  const ageSettings = (runInProgress: boolean): ReactNode =>
    ageSettingsOpen ? (
      <AgeProfileSettings
        runInProgress={runInProgress}
        onClose={closeAgeSettings}
        onToast={setAgeToast}
      />
    ) : null;
  const ageToastNode = ageToast ? (
    <div className="agep-toast" role="status" data-testid="agep-toast">
      {ageToast}
    </div>
  ) : null;
  // The locked tile for Home's GeoDetective card, built here so Home
  // never imports it; its grown-up link opens the settings above.
  const onGrownUpOpen = openAgeSettings;
  const lockedLoop = <LockedLoop title="GeoDetective" onGrownUpOpen={onGrownUpOpen} />;
  const readAloudPrefSettings = <ReadAloudPrefSettings />;
  const readAloudPrefEntry = (onAnswered: () => void): FirstVisitPrompt | null => {
    if (!shouldAskReadAloudPref()) return null;
    return {
      id: "read-aloud-sheet",
      // Arrival modal (owner direction, 2026-11-20): the sheet holds
      // the page until the kid picks one of the three choices — no
      // backdrop-click or Escape dismiss. Arrival only: the caller
      // builds its queue solely in the Home branch, so the sheet can
      // never surface over a run or a case.
      modal: true,
      labelledBy: READ_ALOUD_PREF_HEADING_ID,
      node: <ReadAloudPrefPrompt onAnswered={onAnswered} />,
    };
  };
  return {
    ageBand,
    ageAsk,
    clearAgeAsk,
    askAgeFirst,
    ageAskGate,
    ageSettingsOpen,
    openAgeSettings,
    ageSettings,
    ageToast,
    ageToastNode,
    lockedLoop,
    readAloudPrefSettings,
    readAloudPrefEntry,
  };
}
