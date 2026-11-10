import { expect, type Locator, type Page } from "playwright/test";
import {
  expectPlaying,
  loadHome,
  openEntry,
  shownNoteIds,
} from "./journal-player.helpers";

/**
 * Shared data + assertions for the 5 Historian-blocked journal facts
 * (text head a7191e3e; audio meridian-media fix/journal-facts-5 @ 70b2e95).
 *
 * Window times: each entry's 30-minute window is picked by
 * floor(time / 30 min) mod 106 (see src/components/home-journal.ts);
 * the times below are the first 2026-10-16/17/18 instants landing in
 * each entry's window.
 */
export interface FixedEntry {
  id: string;
  /** UTC instant whose 30-minute window shows this entry. */
  time: Date;
  /** Corrected cue 2 (index 1): window + text. */
  cue: { start: number; end: number; text: string };
}

export const FIXED_ENTRIES: FixedEntry[] = [
  {
    id: "alamo",
    time: new Date(Date.UTC(2026, 9, 17, 20, 0, 0)),
    cue: { start: 2.23, end: 4.53, text: "An old mission, from 1718." },
  },
  {
    id: "cadillac",
    time: new Date(Date.UTC(2026, 9, 17, 22, 0, 0)),
    cue: { start: 2.61, end: 4.61, text: "In winter, it catches the first sunrise!" },
  },
  {
    id: "joslyn",
    time: new Date(Date.UTC(2026, 9, 17, 10, 0, 0)),
    cue: { start: 2.86, end: 5.49, text: "Joslyn's museum stands right in Omaha." },
  },
  {
    id: "niagara",
    time: new Date(Date.UTC(2026, 9, 17, 18, 0, 0)),
    cue: { start: 2.86, end: 5.06, text: "They drop where New York meets Canada!" },
  },
  {
    id: "homestead",
    time: new Date(Date.UTC(2026, 9, 16, 20, 0, 0)),
    cue: { start: 2.89, end: 5.64, text: "One of the first claims, under the 1862 law." },
  },
];

/** The old wrong wordings — must appear NOWHERE (page, transcript, files). */
export const OLD_TEXTS = [
  "from 1836",
  "first sunrise in the country",
  "north of Omaha",
  "cliff in New York",
  "back in 1862",
];

/** Text of the currently active caption cue, or null when none is active. */
export async function activeCueText(video: Locator): Promise<string | null> {
  return video.evaluate((v) => {
    const cues = v.textTracks[0]?.activeCues;
    if (!cues || cues.length === 0) return null;
    return (cues[0] as VTTCue).text;
  });
}

/** Index of the highlighted transcript line for an entry, or -1. */
export async function activeLineIndex(page: Page, id: string): Promise<number> {
  return page.evaluate((entryId) => {
    const lines = Array.from(
      document.querySelectorAll(`[data-testid^="journal-player-transcript-line-${entryId}-"]`),
    );
    return lines.findIndex((el) => el.classList.contains("hv5-journal-transcript-line-active"));
  }, id);
}

/**
 * Full per-entry check: load the entry's set, open it, turn CC on, and
 * assert the CORRECTED cue-2 line is the active caption while the
 * playhead is inside its window; then tap-to-seek the transcript line
 * and assert the same line highlights there. Also asserts the old
 * wrong wordings appear nowhere on the page.
 */
export async function assertFixedEntry(page: Page, entry: FixedEntry): Promise<Locator> {
  const { id, time, cue } = entry;
  await page.clock.install({ time });
  await loadHome(page, time);
  const ids = await shownNoteIds(page);
  expect(ids, `${id}'s set is showing`).toContain(id);

  const video = await openEntry(page, id);
  await expectPlaying(video);

  // CC on: track showing, and the corrected line becomes the active cue
  // while the playhead is inside its window (the 10 s clip loops, so
  // the poll has repeated chances).
  await expect(page.getByTestId(`journal-player-cc-${id}`)).toBeVisible();
  await page.getByTestId(`journal-player-cc-${id}`).click();
  await expect(page.getByTestId(`journal-player-cc-${id}`)).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      async () => {
        const text = await activeCueText(video);
        const t = await video.evaluate((v) => v.currentTime);
        return text === cue.text && t >= cue.start - 0.15 && t <= cue.end + 0.15
          ? "match"
          : `${JSON.stringify(text)}@${t.toFixed(2)}`;
      },
      { timeout: 25_000, intervals: [100, 250] },
    )
    .toBe("match");
  console.log(`facts: ${id} corrected caption active ${JSON.stringify(cue.text)}`);

  // Transcript panel: tap cue-2's line (seek to its start) and assert
  // the same corrected line highlights there.
  await page.getByTestId(`journal-player-transcript-${id}`).click();
  const panel = page.getByTestId(`journal-player-transcript-panel-${id}`);
  await expect(panel).toBeVisible();
  await expect(page.getByTestId(`journal-player-transcript-line-${id}-1`)).toHaveText(cue.text);
  await page.getByTestId(`journal-player-transcript-line-${id}-1`).click();
  await expect
    .poll(() => activeLineIndex(page, id), { timeout: 20_000, intervals: [100, 250] })
    .toBe(1);
  await expect
    .poll(() => activeCueText(video), { timeout: 20_000, intervals: [100, 250] })
    .toBe(cue.text);
  console.log(`facts: ${id} transcript line 1 highlighted ${JSON.stringify(cue.text)}`);

  // Old wrong wordings appear nowhere on the page (captions, transcript,
  // story text, controls).
  const bodyText = await page.locator("body").innerText();
  for (const old of OLD_TEXTS) {
    expect(bodyText, `old wording ${JSON.stringify(old)} absent for ${id}`).not.toContain(old);
  }
  return video;
}
