# Great leaders journal — fact ledger (Stage A)

Every fact used in `clips.json`, `transcripts.md` or `captions/` has an id
here. All sources were fetched live on 2026-11-10. Confidence: HIGH = stated
plainly by the source (and agreed by a second source where one is listed);
MEDIUM = stated by one source only, or wording needs care. No source means
UNVERIFIED, and the fact is not narrated, shown or asked.

## Sources fetched

| Id | Source | URL |
|---|---|---|
| S1 | National Park Service, "Lincoln Memorial Building Statistics" | https://www.nps.gov/linc/learn/historyculture/lincoln-memorial-building-statistics.htm |
| S2 | National Park Service, Lincoln Memorial "Frequently Asked Questions" | https://www.nps.gov/linc/faqs.htm |
| S3 | Wikipedia, "Lincoln Memorial" | https://en.wikipedia.org/wiki/Lincoln_Memorial |
| S4 | GW Today (George Washington University), "Memorial to Civil Rights Leader Opens on National Mall", 24 Aug 2011 | https://gwtoday.gwu.edu/memorial-civil-rights-leader-opens-national-mall |
| S5 | Wikipedia, "Martin Luther King Jr. Memorial" | https://en.wikipedia.org/wiki/Martin_Luther_King_Jr._Memorial |
| S6 | Wikipedia coordinates for "Lincoln Memorial" and "Martin Luther King Jr. Memorial" (MediaWiki API, `prop=coordinates`) | https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=Lincoln_Memorial%7CMartin_Luther_King_Jr._Memorial&format=json |
| S7 | C3 Framework for Social Studies State Standards (NCSS, rev. 2017), Table 20 "Change, Continuity, and Context" | https://www.socialstudies.org/sites/default/files/2017/Jun/c3-framework-for-social-studies-rev0617.pdf |
| S8 | Common Core State Standards for Mathematics (CCSSO, accessible PDF) | https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf |

The earlier draft cited `https://en.wikipedia.org/wiki/Memorials_to_Martin_Luther_King_Jr.`
for the "1964" address. That title is now a redirect to a list page; the fact
is re-sourced to S5 below. The earlier draft also relied on a local candidates
file (`~/workspace/journal-p8-candidates.md`) that is not in the repo and was
not found on this machine, so no fact rests on it any more.

## great-leaders:lincoln-memorial (KEPT, reframed as a place)

| Id | Fact | Source | Confidence | Used in |
|---|---|---|---|---|
| L-1 | The memorial honours Abraham Lincoln, the 16th president of the United States. | S3 | HIGH | transcript picture note, player card |
| L-2 | Groundbreaking ceremony: 12 February 1914. | S1; S3 | HIGH | why |
| L-3 | Dedication ceremony: 30 May 1922. S3 also says it has been a major attraction "since its opening". | S1; S3 | HIGH for 1922. "Opened" for the dedication is MEDIUM wording; educator to confirm. | why, narration |
| L-4 | 36 Doric columns surround the outside, plus 2 at the entrance. | S1 ("36 plus 2 at entrance"); S3 | HIGH | narration, picture |
| L-5 | The 36 columns stand for the 36 states at the time of Lincoln's death. | S3 | HIGH | not used (the death is not told; see screen) |
| L-6 | The statue is 19 feet high. | S1; S3 | HIGH | picture note only |
| L-7 | The statue is carved from Georgia white marble; the outside of the memorial is Colorado white marble. | S2; S3 (S1 prints "George white marble", a typo) | HIGH | narration ("carved from marble") |
| L-8 | Lincoln is shown sitting, a solitary figure in the central hall; his right hand curls around the end of the chair's armrest. | S3; S2 | HIGH | narration, retrieval |
| L-9 | If shown standing, the figure would be 28 feet tall. | S3 | MEDIUM (one source) | not used (possible 10-18 stretch, O6) |
| L-10 | The statue was shipped in 28 pieces. | S1; S3 | HIGH | not used |
| L-11 | 58 steps from the chamber to the plaza; 87 to the reflecting pool. | S2 | HIGH | not used (possible extra question, O6) |
| L-12 | The memorial is at the western end of the National Mall in Washington, D.C. | S3 | HIGH | place, narration ("Washington, D.C.") |
| L-13 | Coordinates 38.88927778, −77.05013889. | S6 | HIGH | place |
| L-14 | The outside (Doric) columns are 44 feet tall, and the statue is 19 feet tall. | S1; S3 | HIGH | stretch (10-18) |

Conflicts (none narrated):
- **L-C1** Drums per column: 11 including the capital (S1) vs 12 (S3).
- **L-C2** Statue weight: 120 tons, 175 tons with pedestal (S1) vs a "175 short ton statue" (S3).
- **L-C3** Column diameter: 7 ft 5 in (S1) vs 7.5 ft (S3).
- **L-C4** Footprint: S3 gives 189.7 × 118.5 ft for the structure; S1 gives 188 ft 4 in × 118 ft 6 in for the colonnade and 201 ft 10 in at the widest point.

UNVERIFIED or cut:
- **L-U1** Lincoln's presidency dates (1861–1865, earlier draft): not stated in
  the sources fetched in this pass. Not narrated or asked.
- **L-U2** "A giant seated Abraham Lincoln" (earlier hook): "giant" is not a
  source word. The narration says only that he sits, carved from marble; the
  19 ft height (L-6) sits in the picture note.

Screened out under standard §7a (true and sourced, but not told or shown):
- **L-X1** Martin Luther King Jr.'s "I Have a Dream" speech on the steps,
  28 August 1963, at the March on Washington (S3; S4). The earlier draft used
  it as the kid hook. A political rally is a political act, and the brief is
  "achievements and places, never politics", so it is cut from this clip.
- **L-X2** The memorial's use as "a symbolic center focused on race relations
  and civil rights" (S3 lead). Not told.
- **L-X3** The two Lincoln speeches inscribed inside (S3). Their content was
  not screened in this pass and the house recipe keeps text off the frame, so
  they are neither shown nor read. When in doubt, leave it out.
- **L-X4** Lincoln's death and its cause (S3). Not told; the column count is
  given without the reason (L-5).
- **L-X5** The 1910s argument over the design and site (S3). Not told.

## great-leaders:mlk-memorial (CUT)

Facts checked before the cut, kept here so the owner can see the evidence:

| Id | Fact | Source | Confidence |
|---|---|---|---|
| M-1 | Opened to the public on 22 August 2011. | S4; S5 | HIGH |
| M-2 | The first memorial on the National Mall to honour an African American, or someone who did not serve as U.S. president. | S4 | HIGH |
| M-3 | The centrepiece, "Stone of Hope", is a 30-foot likeness of King. | S4; S5 | HIGH |
| M-4 | A 450-foot crescent granite wall carries excerpts of his sermons and speeches. | S4; S5 | HIGH |
| M-5 | The address, 1964 Independence Avenue SW, was chosen to refer to the 1964 Civil Rights Act. | S5 | HIGH |
| M-6 | Coordinates 38.88611111, −77.04416667. | S6 | HIGH |

Why it is cut (standard §7a; council record in the spec):
1. **Religion.** The wall quotes his sermons (S4; S5), and S5 notes some
   quoted words draw on the Bible. The picture would show that wall.
2. **Politics.** His documented achievement is leading a civil-rights
   movement and its campaign for laws (M-5, S4). The standard keeps a figure
   only when the story is the achievement "not their politics", and leaves out
   "a figure whose story cannot be told without a contested political view".
3. **A contested memorial.** S5's "Reception" section records public disputes
   over the memorial itself: the sculptor and stone chosen, the stern pose, and
   a paraphrased quotation that the Secretary of the Interior ordered corrected in 2012 and that was then removed.
4. **A place-only reframe would mislead.** A clip about "a 30-foot stone
   figure" with no word on why it stands there fails rubric item A1 ("nothing
   taught is wrong or misleading").

## Standard codes (live source, fetched 2026-11-10)

| Code | Framework | Grade band | Text (short paraphrase) | Source | Used for |
|---|---|---|---|---|---|
| D2.His.1.3-5 | C3 History | by end of grade 5 | build and use a time order of related events | S7 Table 20 | lincoln-memorial |
| 4.NBT.B.4 | CCSS Math | grade 4 | add and subtract multi-digit whole numbers with the standard algorithm | S8 | lincoln-memorial opening question (1922 − 1914) |
| 6.EE.B.7 | CCSS Math | grade 6 | write and solve equations of the form x + p = q | S8 | lincoln-memorial stretch (10-18 only) |
