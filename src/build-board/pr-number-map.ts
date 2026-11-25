/**
 * PR number backfill (TD-08.5). Part A derives a card's key from
 * the PR title, then `head.ref`, then the branch name — but the
 * older PRs predate those numbers, so they landed in the
 * Unnumbered group even though the work has a planning number.
 * This checked-in map pins those PRs to the id (or ids) their
 * work actually carries. It is reviewable on purpose: one row
 * per PR, with the evidence for the number.
 *
 * Resolution order for a pull:
 *  1. A row here wins over title, `head.ref` and branch. This
 *     is also how clashes are fixed: #614's branch and commits
 *     say `td-10.1` (#595's id) while its title says TD-10.5,
 *     so the map pins it to TD-10.5.
 *  2. Else the derived key (`extractItemKey` on title, then
 *     `head.ref`, then the branch name).
 *  3. Else the card is Unnumbered.
 *
 * A row with an empty `ids` list is a deliberate exclusion: the
 * PR must stay Unnumbered even when its title or branch carries
 * a number (#612 is titled TD-06.3, but #610 shipped that id).
 *
 * Rules kept when editing this file:
 *  - Map only when the id is determinable from evidence: the
 *    ledger (`kanban.json`) listing the PR with role `closes`,
 *    the story index, or the PR's own title/branch/body.
 *  - Never steal an id when the ledger lists the PR only as
 *    `ref`, or when a closed-unmerged PR was superseded (for
 *    example #545, replaced by #548, stays Unnumbered).
 *  - One PR may carry several ids (#605); it then appears as a
 *    chip on each of those cards.
 */

export interface PrNumberMapping {
  pr: number;
  /** Planning ids this PR belongs to; empty = deliberately Unnumbered. */
  ids: readonly string[];
  /** Short evidence for the row, named so a reviewer can check it. */
  evidence: string;
}

export const PR_NUMBER_MAP: readonly PrNumberMapping[] = [
  { pr: 543, ids: ["TD-01.1"], evidence: "kanban.json closes TD-01.1" },
  { pr: 544, ids: ["TD-01.2"], evidence: "kanban.json closes TD-01.2" },
  { pr: 548, ids: ["TD-01.2"], evidence: "kanban.json closes TD-01.2" },
  { pr: 549, ids: ["TD-01.2"], evidence: "kanban.json closes TD-01.2" },
  {
    pr: 552,
    ids: ["TD-01.2"],
    evidence: "kanban.json closes TD-01.2; it is only a ref for TD-12.1, which #596 owns",
  },
  { pr: 559, ids: ["TD-02.1"], evidence: "kanban.json closes TD-02.1" },
  {
    pr: 563,
    ids: ["TD-02.2"],
    evidence: "kanban.json closes TD-02.2; it is only a ref for TD-16.1, which #603 owns",
  },
  {
    pr: 565,
    ids: ["TD-02.3"],
    evidence: "kanban.json closes TD-02.3; it is only a ref for TD-10.3, which #579 owns",
  },
  { pr: 569, ids: ["TD-02.4"], evidence: "kanban.json closes TD-02.4" },
  {
    pr: 571,
    ids: ["TD-02.5"],
    evidence: "kanban.json closes TD-02.5; game-app onto the storage port",
  },
  { pr: 555, ids: ["TD-03.1"], evidence: "kanban.json closes TD-03.1" },
  { pr: 562, ids: ["TD-03.1"], evidence: "kanban.json closes TD-03.1" },
  { pr: 566, ids: ["TD-03.1"], evidence: "kanban.json closes TD-03.1" },
  { pr: 568, ids: ["TD-03.1"], evidence: "kanban.json closes TD-03.1" },
  { pr: 572, ids: ["TD-03.1"], evidence: "kanban.json closes TD-03.1" },
  { pr: 573, ids: ["TD-04.1"], evidence: "kanban.json closes TD-04.1" },
  { pr: 600, ids: ["TD-04.2", "TD-04.3"], evidence: "open rulings PR (Slice G)" },
  { pr: 561, ids: ["TD-05.1"], evidence: "kanban.json closes TD-05.1" },
  { pr: 564, ids: ["TD-05.1"], evidence: "kanban.json closes TD-05.1" },
  { pr: 607, ids: ["TD-05.2"], evidence: "Slice J, shared page shell" },
  { pr: 570, ids: ["TD-06.1"], evidence: "kanban.json closes TD-06.1" },
  { pr: 550, ids: ["TD-07.1"], evidence: "kanban.json closes TD-07.1" },
  { pr: 558, ids: ["TD-07.1"], evidence: "kanban.json closes TD-07.1" },
  { pr: 554, ids: ["TD-07.1"], evidence: "kanban.json closes TD-07.1" },
  {
    pr: 560,
    ids: ["TD-07.1"],
    evidence: "kanban.json closes TD-07.1; it is only a ref for TD-16.2, still an owner redeploy",
  },
  { pr: 574, ids: ["TD-08.1"], evidence: "story index: finishes #574; the first live board" },
  { pr: 581, ids: ["TD-09.2"], evidence: "branch chore/drop-github-io-links; chips with #608" },
  { pr: 606, ids: ["TD-10.4"], evidence: "Slice K, test-seam remainder after #586" },
  {
    pr: 614,
    ids: ["TD-10.5"],
    evidence:
      "PR title TD-10.5; its branch, commits and a docs file still say td-10.1, which is #595's id — the map pins TD-10.5",
  },
  {
    pr: 605,
    ids: ["TD-11.1", "TD-11.2"],
    evidence: "contact and board forms through the transport port",
  },
  { pr: 602, ids: ["TD-14.1"], evidence: "Slice C, detective CI flake" },
  {
    pr: 612,
    ids: [],
    evidence:
      "titled TD-06.3, but #610 already shipped that id, and it is not TD-06.5 either; stays Unnumbered until it is closed",
  },
];

const BY_PR: ReadonlyMap<number, readonly string[]> = new Map(
  PR_NUMBER_MAP.map((row) => [row.pr, row.ids]),
);

/**
 * The mapped ids for one PR number, or undefined when the PR
 * has no row. An empty list is a deliberate exclusion: the PR
 * stays Unnumbered even if its title or branch carries a
 * number that belongs to another PR.
 */
export function mappedIdsFor(pr: number): readonly string[] | undefined {
  return BY_PR.get(pr);
}
