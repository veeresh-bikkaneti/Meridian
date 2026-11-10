# Technology journal — fact ledger (Stage A)

Every fact used in `clips.json`, `transcripts.md` or `captions/` has an id
here. All sources were fetched live on 2026-11-10. Confidence: HIGH = stated
plainly by the source (and agreed by a second source where one is listed);
MEDIUM = stated, but wording or a second source needs care. No source means
UNVERIFIED and the fact is not narrated, shown or asked.

## Sources fetched

| Id | Source | URL |
|---|---|---|
| S1 | Engineering and Technology History Wiki, "Telephones" (IEEE STARS) | https://ethw.org/Telephone |
| S2 | Britannica, "Martin Cooper" | https://www.britannica.com/biography/Martin-Cooper |
| S3 | Wikipedia, "DynaTAC" | https://en.wikipedia.org/wiki/DynaTAC |
| S4 | Britannica, "ENIAC" | https://www.britannica.com/technology/ENIAC |
| S5 | Wikipedia, "ENIAC" | https://en.wikipedia.org/wiki/ENIAC |
| S6 | Wikipedia, "University of Pennsylvania" (lead) | https://en.wikipedia.org/wiki/University_of_Pennsylvania |
| S7 | Wikipedia coordinates for "Boston", "New York City", "ENIAC" (MediaWiki API, `prop=coordinates`) | https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=Boston%7CNew_York_City%7CENIAC&format=json |
| S8 | C3 Framework for Social Studies State Standards (NCSS, rev. 2017), Table 20 "Change, Continuity, and Context" | https://www.socialstudies.org/sites/default/files/2017/Jun/c3-framework-for-social-studies-rev0617.pdf |
| S9 | Common Core State Standards for Mathematics (CCSSO, accessible PDF) | https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf |

The earlier draft also cited scottishinventions.com for the telephone. That
page was not re-fetched in this pass, so it is no longer cited; S1 covers
every telephone fact used.

## technology:first-phone

| Id | Fact | Source | Confidence | Used in |
|---|---|---|---|---|
| T1-1 | Bell's key patent, No. 174,465, was awarded on 7 March 1876. | S1 | HIGH | spec context only |
| T1-2 | The first telephone message was sent on 10 March 1876. | S1 | HIGH | why, narration |
| T1-3 | It was sent in an attic in Boston, Massachusetts. | S1 | HIGH | narration, place |
| T1-4 | Bell's and Watson's notebooks give different versions of the sentence; both begin "Mr. Watson come here". | S1 | HIGH | narration (shared part only) |
| T1-5 | The device turned sound waves into a matching, varying electric current on a wire, and a receiver turned it back into sound. | S1 | HIGH | narration ("down a wire"), picture, retrieval |
| T1-6 | Watson heard Bell's voice on the receiver down the attic's hall. | S1 | HIGH | picture |
| T1-7 | Boston city coordinates 42.36027778, −71.05777778. | S7 | HIGH (city centre, not the attic) | place |

UNVERIFIED or cut:
- **T1-U1** The attic's exact address: not in S1. The pin is city level.
- **T1-U2** How far down the hall Watson was: no number in S1. Not asked.
- **T1-U3** "Bell invented the telephone" as sole credit: S1 records earlier
  work (Reis, 1861) and a credit question with Gray examined by courts and
  historians. CUT: the clip says only what happened on 10 March 1876.

## technology:mobile-phone

| Id | Fact | Source | Confidence | Used in |
|---|---|---|---|---|
| T2-1 | On 3 April 1973, in New York City, Motorola engineer Martin Cooper placed the first public cell phone call. | S2; S3 ("first publicized handheld mobile phone call") | HIGH | why, narration, place |
| T2-2 | He called Joel Engel, head of AT&T's rival project. | S2 | HIGH | not used (kept out to stay on the machine, not the rivalry) |
| T2-3 | The 1973 DynaTAC phone was handheld, 23 cm (9 in) tall and 1.1 kg (2.5 lb). | S2 | HIGH | picture |
| T2-4 | It allowed 35 minutes of talk before its battery ran down. | S2 | HIGH | not narrated (fits 8 s rule) |
| T2-5 | Earlier mobile phones were car phones, powered by car batteries. | S2 | HIGH | retrieval hint |
| T2-6 | The DynaTAC 8000x was the first portable cell phone for consumers; price $3,995. | S2; S3 | HIGH | not narrated |
| T2-7 | New York City coordinates 40.7128, −74.0061. | S7 | HIGH (city level) | place |

UNVERIFIED, conflicting or cut:
- **T2-U1** Year the 8000x went on sale: S2 says Motorola "introduced" it in
  1983; S3 says unveiled 6 March 1983, commercial release 1984. TO CONFIRM.
  Not narrated.
- **T2-U2** The earlier draft gave the 8000X as 9 in tall with 30 minutes of
  talk. S2 gives 9 in and 35 minutes for the 1973 phone; S3 gives 10 in and
  30 minutes for the 8000X. The draft had mixed the two phones; corrected
  here, and neither number is narrated.
- **T2-U3** "On a New York street" (the exact spot): not in S2 or S3. The pin
  is city level.
- **T2-U4** That the 1973 call went through a tower or base station: not in
  the fetched sources. The picture shows waves leaving the phone, no tower.
- **T2-U5** "Costing as much as a car": no source. CUT.

## technology:eniac

| Id | Fact | Source | Confidence | Used in |
|---|---|---|---|---|
| T3-1 | ENIAC was the first programmable general-purpose electronic digital computer. | S4; S5 | HIGH | spec context; narration says only "an early computer" |
| T3-2 | It was built by John Mauchly, J. Presper Eckert Jr. and colleagues at the Moore School of Electrical Engineering, University of Pennsylvania. | S4 | HIGH | place |
| T3-3 | The machine occupied a 50-by-30-foot basement. | S4 | MEDIUM: S5 gives the machine's own footprint as about 300 sq ft, so the panels did not cover the whole floor. The question asks about the room, not the machine. | why, narration, retrieval |
| T3-4 | It contained about 18,000 vacuum tubes. | S4; S5 | HIGH | picture |
| T3-5 | It could do up to 5,000 additions per second. | S4 | HIGH | not used (possible 10-18 stretch, O4) |
| T3-6 | The University of Pennsylvania is in Philadelphia. | S6 | HIGH | narration, place |
| T3-7 | Coordinates 39.9523, −75.1906 (the ENIAC article's coordinates). | S7 | MEDIUM (exact building not confirmed) | place |
| T3-8 | 1946: completed by February 1946 (S4); formally dedicated on 15 February 1946 (S5). | S4; S5 | HIGH for 1946 as the year it was shown | narration |

UNVERIFIED, conflicting or cut:
- **T3-U1** Completion year: S5 says completed in 1945; S4 says by February
  1946. The narration says only "1946" (the dedication year both agree on).
  Educator to confirm the wording.
- **T3-U2** Cost: $400,000 (S4) vs $487,000 (S5). CONFLICT. CUT.
- **T3-U3** "A phone in your pocket is millions of times more powerful": no
  source. CUT (no multiplier, no modern-phone comparison).
- **T3-U4** "Bigger than your classroom": no source. CUT.
- **T3-U5** "Glowing tubes" in the picture: not in the fetched sources. CUT.

Screened out under standard §7a (true, sourced, but not told): S4 says ENIAC
was designed to calculate artillery range tables and that its first task was
calculations for a hydrogen bomb. The clip does not mention or show the
purpose. See the council record in the spec.

## Standard codes (live source, fetched 2026-11-10)

| Code | Framework | Grade band | Text (short paraphrase) | Source | Used for |
|---|---|---|---|---|---|
| D2.His.1.3-5 | C3 History | by end of grade 5 | build and use a time order of related events | S8 Table 20 | first-phone |
| D2.His.2.3-5 | C3 History | by end of grade 5 | compare life in a past period with life today | S8 Table 20 | eniac |
| D2.His.2.6-8 | C3 History | by end of grade 8 | sort events and developments as change or continuity | S8 Table 20 | mobile-phone |
| 4.NBT.B.4 | CCSS Math | grade 4 | add and subtract multi-digit whole numbers fluently | S9 | first-phone opening question |
| 6.EE.B.7 | CCSS Math | grade 6 | write and solve equations of the form x + p = q | S9 | mobile-phone opening question |
| 4.MD.A.3 | CCSS Math | grade 4 | use the rectangle area formula in real problems | S9 | eniac opening question |
| 4.NBT.B.5 | CCSS Math | grade 4 | multiply two two-digit numbers | S9 | eniac opening question |
