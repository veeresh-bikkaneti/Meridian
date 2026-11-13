/**
 * Subject picker — the "Why Do We Learn This?" card's screen.
 *
 * Lists the released subjects from the registry (listReleasedSubjects)
 * merged with the plan (picker-rows): ready subjects open their case,
 * everything else shows as a disabled "Coming soon" row, so the kid
 * sees the map of what is coming. Rows are subject cards on the shared
 * ScreenShell page style. Subject code loads only when a row is tapped:
 * the registry never calls load() for the list, and the tap races the
 * load against withChunkTimeout like every other lazy screen (#209).
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { SubjectModule, SubjectProps } from "../registry";
import { listReleasedSubjects } from "../registry";
import { getAgeGroup } from "@/game/age-profile";
import { withChunkTimeout } from "@/lib/chunk-timeout";
import type { CelebrationSpec } from "@/components/celebration-copy";
import { pickerRows } from "./picker-rows";
import { ScreenShell } from "@/components/ui/screen-shell";
import { ArrowRight, Atom, BookOpen, Calculator, FlaskConical, Globe2, Users, type LucideIcon } from "lucide-react";
import { WHY_LEARN_HERO_ALT, WHY_LEARN_HERO_URL } from "@/assets/why-learn/why-learn-art";

/** Decorative card icons by subject id (aria-hidden; the name is the text). */
const SUBJECT_ICONS: Record<string, LucideIcon> = {
  math: Calculator,
  physics: Atom,
  chemistry: FlaskConical,
  "general-knowledge": Globe2,
  "social-studies": Users,
  journals: BookOpen,
};

/** One line per subject card. EDITABLE PLACEHOLDERS (written for the A+B
 *  blend, 2026-11-13): short, neutral, factual; the owner may reword. */
const SUBJECT_ONE_LINERS: Record<string, string> = {
  math: "Why triangles hold up bridges",
  physics: "Why a ball always comes back down",
  chemistry: "Why bread rises and iron rusts",
  "general-knowledge": "Why places are where they are",
  "social-studies": "Why towns grew beside rivers",
  journals: "New journals are on the way.",
};

type CaseComponent = ComponentType<
  SubjectProps & { onCelebrate?: (spec: CelebrationSpec) => void }
>;

export default function SubjectPicker({
  group,
  onExit,
  onCelebrate,
}: SubjectProps & {
  /** GameApp's celebration trigger, passed through to the opened case. */
  onCelebrate?: (spec: CelebrationSpec) => void;
}) {
  const band = group ?? getAgeGroup();
  const [released, setReleased] = useState<SubjectModule[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [opened, setOpened] = useState<{ title: string; Case: CaseComponent } | null>(null);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let live = true;
    listReleasedSubjects()
      .then((mods) => {
        if (live) setReleased(mods);
      })
      .catch(() => {
        if (live) setListFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Arrival focus, the LoopScreen pattern: land focus on the heading so
  // it is never stranded on the Home card that opened the picker.
  useEffect(() => {
    if (opened) return;
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, [opened]);

  if (opened) {
    const Case = opened.Case;
    return <Case group={band} tier="full" onExit={onExit} onCelebrate={onCelebrate} />;
  }

  const openSubject = (mod: SubjectModule) => {
    setOpenFailed(null);
    withChunkTimeout(mod.load(), `${mod.title} case screen`)
      .then((loaded) => {
        setOpened({ title: mod.title, Case: loaded.default as CaseComponent });
      })
      .catch(() => {
        setOpenFailed(mod.title);
      });
  };

  const rows = released ? pickerRows(released, band) : [];

  return (
    <ScreenShell
      onHome={onExit}
      className="why-learn-screen lg:max-w-6xl"
      testId="subject-picker"
      hero={
        <img
          className="why-learn-hero"
          src={WHY_LEARN_HERO_URL}
          alt={WHY_LEARN_HERO_ALT}
          width={1280}
          height={720}
          loading="eager"
          decoding="async"
        />
      }
      sound={
        <span className="why-learn-wordmark">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="21.5" fill="none" stroke="#8A6D2F" strokeWidth="1.6" /><path d="M24 6 L27.2 20.8 L42 24 L27.2 27.2 L24 42 L20.8 27.2 L6 24 L20.8 20.8 Z" fill="#8A6D2F" /><circle cx="24" cy="24" r="3.4" fill="#F6F1E3" stroke="#8A6D2F" strokeWidth="1.2" /></svg>
          MERIDIAN
        </span>
      }
      data={{ "data-band": band }}
      eyebrow="Case file · Why it matters"
      title="Why Do We Learn This?"
      titleRef={headingRef}
      sub={`Pick a subject · Ages ${band}`}
    >
      {released === null && !listFailed ? (
        <p className="mt-6 text-fg">Loading subjects…</p>
      ) : null}
      {listFailed ? (
        <p className="mt-6 text-fg">
          Subjects could not load just now. Head back to Home and try again in a moment.
        </p>
      ) : null}
      {/* Subject cards (nav-home council + the owner's A+B blend): one
          button per card; its text is its name (no heading inside the
          button). Icon and arrow are aria-hidden SVG, never glyphs.
          Columns: 1 on phones, 2 at 681–1080px, 3 from 1081px; with six
          subjects every row is full. */}
      <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 min-[681px]:grid-cols-2 min-[1081px]:grid-cols-3 min-[681px]:gap-4" data-testid="subject-cards">
        {rows.map((row) => {
          const Icon = SUBJECT_ICONS[row.id] ?? BookOpen;
          const ready = row.state === "ready" && row.module;
          return (
            <li key={row.id} className="flex">
              <button
                type="button"
                className={`why-learn-card flex w-full items-start gap-3.5 p-4 text-left text-fg${ready ? "" : " is-soon"}`}
                data-testid={`subject-row-${row.id}`}
                disabled={!ready}
                aria-disabled={ready ? undefined : "true"}
                onClick={ready ? () => openSubject(row.module!) : undefined}
              >
                <span className="why-learn-badge" aria-hidden="true">
                  <Icon className="size-6" />
                </span>
                <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
                  <span className="mode-title text-xl leading-tight">{row.title}</span>
                  <span className="mt-1 text-sm text-muted">{SUBJECT_ONE_LINERS[row.id] ?? ""}</span>
                  <span className="why-learn-chip mt-2.5 self-start">
                    {ready ? `${row.caseCount} ${row.caseCount === 1 ? "case" : "cases"}` : "Coming soon"}
                  </span>
                  {ready ? (
                    <span className="why-learn-go mt-2.5">
                      Open case
                      <ArrowRight className="size-3.5" aria-hidden="true" focusable="false" />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {openFailed ? (
        <p className="mt-3 text-sm text-fg" role="status">
          {openFailed} could not load just now. Try again in a moment.
        </p>
      ) : null}
    </ScreenShell>
  );
}
