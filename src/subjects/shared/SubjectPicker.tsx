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
import { Atom, BookOpen, Calculator, FlaskConical, Globe2, Users, type LucideIcon } from "lucide-react";

/** Decorative card icons by subject id (aria-hidden; the name is the text). */
const SUBJECT_ICONS: Record<string, LucideIcon> = {
  math: Calculator,
  physics: Atom,
  chemistry: FlaskConical,
  "general-knowledge": Globe2,
  "social-studies": Users,
  journals: BookOpen,
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
    if (el && typeof el.focus === "function") el.focus();
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
      className="lg:max-w-6xl"
      testId="subject-picker"
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
      {/* Subject cards (nav-home council): one button per card, its text is
          its name (no heading inside the button, no arrow glyph). Columns:
          1 on phones, 2 at 681–1080px, 3 from 1081px; with six subjects
          every row is full. No background art yet: the owner is still
          choosing the Why Learn art. */}
      <ul className="mt-6 grid gap-3 min-[681px]:grid-cols-2 min-[1081px]:grid-cols-3" data-testid="subject-cards">
        {rows.map((row) => {
          const Icon = SUBJECT_ICONS[row.id] ?? BookOpen;
          const ready = row.state === "ready" && row.module;
          return (
            <li key={row.id} className="flex">
              <button
                type="button"
                className={`mode-card flex min-h-[88px] w-full items-center gap-3 px-4 py-3 text-left ${
                  ready ? "text-fg hover:brightness-105" : "cursor-default border-dashed text-fg"
                }`}
                data-testid={`subject-row-${row.id}`}
                disabled={!ready}
                aria-disabled={ready ? undefined : "true"}
                onClick={ready ? () => openSubject(row.module!) : undefined}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="mode-title text-lg leading-tight">{row.title}</span>
                  <span className="text-sm text-fg">
                    {ready ? `${row.caseCount} ${row.caseCount === 1 ? "case" : "cases"}` : "Coming soon"}
                  </span>
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
