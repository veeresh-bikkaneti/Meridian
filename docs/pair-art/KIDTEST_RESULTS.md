# Kid test — RESULTS (the go / no-go record)

**Final verdict: NOT RUN YET.**

The full kid test runs at PR D (the flip), following
`scripts/kidtest-protocol.md`. This file is the template the results
land in. Nothing here is a score until a real session with real
children produced it — no number in this file may be filled in from
a guess, a demo, or an adult's opinion.

**How to read this template (panel round 1 cures B2 + B3):**

- **Allocation:** independent observations per cell — 30 children
  per cell, each child in exactly ONE cell, total N = 360. Every
  observation is therefore a first exposure; the find measure is
  naïve in every cell by construction.
- **First exposure:** each cell section records its first-exposure
  count. It must be 30/30. A child flagged not-first-exposure is
  replaced (§1 of the protocol); their rows stay in the raw table,
  marked, and never count toward a bar.
- **Age-band floors:** every slice is reported pooled (/30) AND per
  age band (/10 each: 6–8, 9–10, 11–12). Each band must reach
  **≥9/10** — the cell bar's proportion — or the cell is a FAIL
  regardless of the pooled count. The floors were written into the
  protocol before any run; §10 of the spec forbids amending bars
  after the test runs.
- **Expression** is scored per slice: cell × character (Holmes,
  Watson) × emotion (delighted, surprised, pout), ≥26/30 per slice.

## Per-cell summary

| Cell | Find ≥27/30 (kill ≤25) | Identity ≥27/30 (confusion ≤3) | Expression ≥26/30 per slice (6 slices, § below) | First-exposure 30/30 | Verdict |
| --- | --- | --- | --- | --- | --- |
| 390-map | — | — | — | — | NOT RUN |
| 390-page | — | — | — | — | NOT RUN |
| 390-static-degradation | — | — | — | — | NOT RUN |
| 768-map | — | — | — | — | NOT RUN |
| 768-page | — | — | — | — | NOT RUN |
| 768-static-degradation | — | — | — | — | NOT RUN |
| 1280-map | — | — | — | — | NOT RUN |
| 1280-page | — | — | — | — | NOT RUN |
| 1280-static-degradation | — | — | — | — | NOT RUN |
| 1920-map | — | — | — | — | NOT RUN |
| 1920-page | — | — | — | — | NOT RUN |
| 1920-static-degradation | — | — | — | — | NOT RUN |

Automatic measures (size band, face floor, zero clue-text coverage)
are recorded in `KIDTEST_SMOKE.md` for the smoke run and re-run by
`tests/e2e/pair-art-kidtest.spec.ts` at PR D. The assembly + palm
measurement (spec §7) is reported by the same spec in
`test-results/pair-art-kidtest/assembly-report.json` and embedded
in the trial manifest.

## Per-cell detail — pooled, age bands, first exposure

### 390-map

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 390-page

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 390-static-degradation

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 768-map

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 768-page

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 768-static-degradation

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1280-map

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1280-page

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1280-static-degradation

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1920-map

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1920-page

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

### 1920-static-degradation

First-exposure count: — /30 (must be 30/30; flagged observations are replaced, never counted)

| Slice | Pooled /30 | 6–8 /10 (floor ≥9) | 9–10 /10 (floor ≥9) | 11–12 /10 (floor ≥9) | Band verdict | Slice verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Find Holmes ≥27/30 (kill ≤25) | — | — | — | — | — | NOT RUN |
| Identity ≥27/30 (confusion ≤3) | — | — | — | — | — | NOT RUN |
| Expression · Holmes · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Holmes · pout ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · delighted ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · surprised ≥26/30 | — | — | — | — | — | NOT RUN |
| Expression · Watson · pout ≥26/30 | — | — | — | — | — | NOT RUN |

## Raw scores

One row per trial, copied from the scoring sheets (child codes only,
never names). Fields: child code · age band · cell · first exposure ·
trial · character + emotion (expression only) · time (find only) ·
answer · result · notes.

| Child | Age band | Cell | First exposure? | Trial | Character + emotion | Time (s) | Answer | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — | — | — | — | No sessions run yet |
