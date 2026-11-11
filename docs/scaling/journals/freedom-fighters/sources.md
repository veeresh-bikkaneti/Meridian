# Freedom fighters journal — fact ledger (Stage A)

Every fact used in `clips.json`, `transcripts.md` or `captions/` has an id
here. All sources were fetched live on 2026-11-10. Confidence: HIGH = stated
plainly by the source; MEDIUM = stated, but by a general reference or only in
one language, so it needs care. No source means UNVERIFIED and the fact is not
narrated, shown or asked. Facts that were sourced but fail the content screen
(standard §7a) are listed as SCREENED: they are true, but they stay out.

## Sources fetched

| Id | Source | URL |
|---|---|---|
| S1 | Nelson Mandela Foundation, "Trials and prisons chronology" | https://www.nelsonmandela.org/trials-and-prison-chronology |
| S2 | UNESCO World Heritage Centre, "Robben Island" (list entry 916; description, Outstanding Universal Value, date of inscription) | https://whc.unesco.org/en/list/916/ |
| S3 | Robben Island Museum, "About us" | https://www.robben-island.org.za/about-us/ |
| S4 | Robben Island Museum, "Frequently asked questions" | https://www.robben-island.org.za/frequently-asked-questions/ |
| S5 | Wikipedia, "Robben Island" (lead, via the MediaWiki API) | https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=Robben_Island&format=json |
| S6 | Wikipedia coordinates for "Robben Island", "Jhansi Fort", "Cape Town" (MediaWiki API, `prop=coordinates`) | https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=Robben_Island%7CJhansi_Fort%7CCape_Town&format=json |
| S7 | National Geographic, "India's warrior queen didn't back down from the British" (A. Pagano, 6 Oct 2020) | https://www.nationalgeographic.com/history/history-magazine/article/india-warrior-queen-lakshmi-bai-fought-british-rule |
| S8 | C3 Framework for Social Studies State Standards (NCSS, rev. 2017), Table 20 "Change, Continuity, and Context" | https://www.socialstudies.org/sites/default/files/2017/Jun/c3-framework-for-social-studies-rev0617.pdf |
| S9 | Common Core State Standards for Mathematics (CCSSO, accessible PDF) | https://learning.ccsso.org/wp-content/uploads/2022/11/ADA-Compliant-Math-Standards.pdf |

The earlier draft also cited a Guinness World Records page for "18 of 27
years". That page returned no readable record text when fetched on
2026-11-10, so it is no longer cited (see F1-U5).

## freedom-fighters:robben-island (KEPT, reframed as a place of remembrance)

| Id | Fact | Source | Confidence | Used in |
|---|---|---|---|---|
| F1-1 | On 12 June 1964 Mandela was sent to Robben Island to serve his sentence, as prisoner 466/64. | S1 | HIGH | why, objective, narration ("held here") |
| F1-2 | On 31 March 1982 he was transferred from Robben Island to Pollsmoor Prison. | S1 | HIGH | why, objective |
| F1-3 | 1982 − 1964 = 18. The question asks how many years apart the two dates are. The real stay was a little under 18 years (June 1964 to March 1982), so the clip never says "18 years" aloud. | from F1-1, F1-2 | HIGH (arithmetic) | why (answer x = 18) |
| F1-4 | He spent over 27 years in prison in all, and was released on 11 February 1990. | S1 | HIGH | spec context only |
| F1-5 | Robben Island was inscribed as a UNESCO World Heritage Site in 1999. | S2 | HIGH | transcript note, place label context |
| F1-6 | Robben Island Museum, set up in 1997, manages and presents the island as a national estate and World Heritage Site; it runs the Nelson Mandela Gateway at the V&A Waterfront and the ferries to the island. | S3 | HIGH | narration ("today it is a museum"), retrieval, picture (ferry) |
| F1-7 | The last political prisoners left in 1991, the prison closed in 1996, and it has been a museum since. | S2 (Dutch-language description only) | MEDIUM | transcript note (supports F1-6) |
| F1-8 | The island lies in Table Bay, 6.9 km west of Bloubergstrand, north of Cape Town; it is roughly oval, about 3.3 km long and 1.9 km wide, area 5.08 sq km. | S5 | MEDIUM (general reference) | place label, 18+ stretch |
| F1-9 | The standard tour includes two ferry trips of 30–60 minutes, depending on the boat. | S4 | HIGH | picture (ferry crossing) |
| F1-10 | The island's buildings include the maximum security prison of the apartheid period, begun in the 1960s, and a small lighthouse. | S2 | HIGH | picture (outside of the prison buildings, lighthouse) |
| F1-11 | Robben Island coordinates −33.805, 18.37. | S6 | HIGH (island centre) | place |

Stretch answer check (F1-8): an ellipse 3.3 km by 1.9 km has semi-axes 1.65 and
0.95 km, so area = π × 1.65 × 0.95 ≈ 4.92 sq km, "about 4.9". The listed area
is 5.08 sq km, so the 18+ follow-up can say the oval guess is close.

UNVERIFIED, SCREENED or cut:
- **F1-U1** "Slept on the floor on a thin mat" (earlier draft's kid hook):
  not in any fetched source. CUT. The cell interior is not shown.
- **F1-U2** Size of Mandela's cell: no fetched source. Not shown or asked.
- **F1-U3 SCREENED** Why he was imprisoned: S1 records a conviction for
  sabotage and his work for an armed wing. Weapons, violence and a political
  conviction fail §7a for this audience. Never told or shown.
- **F1-U4 SCREENED** UNESCO's value wording, "the triumph of democracy and
  freedom over oppression and racism" (S2): sourced, but it judges a
  government and an ideology. §7a says tell it without praising or blaming,
  so it is not narrated. The museum's own wording (S3) is screened for the same reason.
- **F1-U5** "18 of his 27 years" as a record (Guinness): page not readable on
  2026-11-10. UNVERIFIED; also a head-of-state framing (politics). CUT.
- **F1-U6 SCREENED** The island's other past uses (S2): a hospital and leper
  colony (illness, biology) and a military base (military). Not told or shown.
- **F1-U7 SCREENED** Escapes from the island (S4, 1659 and 1690): not about
  this story, and one involves a stolen boat. Not used.
- **F1-U8 SCREENED** Mandela's later public offices: politics. Not told.
- **F1-U9** The label "freedom fighter" for any person: no fetched source
  defines it, and it is a judgement, not a fact. The clip applies no label.

## freedom-fighters:jhansi-fort (CUT, §7a)

Screening evidence only. Nothing below is used in any clip.

| Id | Fact | Source | Confidence | Screen result |
|---|---|---|---|---|
| F2-1 | Lakshmi Bai led troops in the rebellion that broke out in 1857, "now known by many historians as India's First War of Independence". | S7 | HIGH on the outline | SCREENED: two names for one event, one of them a national claim (contested framing). |
| F2-2 | Company troops besieged the fort in March 1858 under bombardment; after two weeks they broke through. | S7 | HIGH on the outline | SCREENED: siege and bombardment (violence, weapons). |
| F2-3 | She died in battle near Gwalior in June 1858; a report describes how she was killed. | S7 | HIGH on the outline | SCREENED: death and weapons. |
| F2-4 | "Competing narratives": she is "a hero to the Indians and was a villain to the British", tied to a June 1857 massacre in Jhansi. | S7 | HIGH | SCREENED: contested, praise and blame of nations, massacre. |
| F2-5 | The revolt was stoked by grievances including religion. | S7 | HIGH | SCREENED: religion. |
| F2-6 | "History and myth are inseparable in her story." | S7 | HIGH | The source itself warns the details are unreliable. |
| F2-7 | Jhansi Fort coordinates 25.45809, 78.57544. | S6 | HIGH | Not used (clip cut). |

UNVERIFIED or cut:
- **F2-U1** "Her son on her back and a sword in each hand" (earlier draft's
  kid hook): S7 gives both only as "reportedly" and "it is said". UNVERIFIED,
  and weapons. CUT.
- **F2-U2** Any fort-only facts (builder, year built, height): none fetched.
  A place-only reframe would need new sources and would belong to a places or
  monuments journal, not this one (see the reframe log in the spec).

## Standards (both live, S8 and S9)

| Code | Text (short) | Source | Used by |
|---|---|---|---|
| D2.His.2.6-8 | Classify series of historical events and developments as examples of change and/or continuity. | S8, Table 20 | robben-island (prison then, museum now: a change) |
| 6.EE.B.7 | Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q. | S9 | robben-island opening question (algebra, so 10-18, never 7-10) |
