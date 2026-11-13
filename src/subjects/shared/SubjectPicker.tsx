/**
 * Subject picker — the "Why Do We Learn This?" card's screen.
 *
 * Lists the released subjects from the registry (listReleasedSubjects)
 * merged with the plan (picker-rows): ready subjects open their case,
 * everything else shows as a disabled "Coming soon" row, so the kid
 * sees the map of what is coming. Rows reuse the case screens' button
 * styling — no new look. Subject code loads only when a row is tapped:
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
      testId="subject-picker"
      data={{ "data-band": band }}
      eyebrow="Case file · Why it matters"
      title="Why Do We Learn This?"
      titleRef={headingRef}
      sub={`Pick a subject · Ages ${band}`}
    >
      <div className="mode-card mt-6 grid gap-2 p-3 sm:p-4">
        {released === null && !listFailed ? (
          <p className="text-muted">Loading subjects…</p>
        ) : null}
        {listFailed ? (
          <p className="text-muted">
            Subjects could not load just now. Head back to Home and try again in a moment.
          </p>
        ) : null}
        {rows.map((row) =>
          row.state === "ready" && row.module ? (
            <button
              key={row.id}
              type="button"
              className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-left text-fg"
              data-testid={`subject-row-${row.id}`}
              onClick={() => openSubject(row.module!)}
            >
              {row.title}{" "}
              <span className="text-muted">
                · {row.caseCount} {row.caseCount === 1 ? "case" : "cases"}
              </span>
            </button>
          ) : (
            <button
              key={row.id}
              type="button"
              disabled
              className="min-h-[44px] w-full rounded-xl border border-line bg-bg px-4 py-2 text-left text-muted"
              data-testid={`subject-row-${row.id}`}
              aria-disabled="true"
            >
              {row.title} <span>· Coming soon</span>
            </button>
          ),
        )}
        {openFailed ? (
          <p className="text-sm text-muted" role="status">
            {openFailed} could not load just now. Try again in a moment.
          </p>
        ) : null}
      </div>
    </ScreenShell>
  );
}
