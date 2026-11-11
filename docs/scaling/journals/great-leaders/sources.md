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
is re-sourced to S5 below. The earlier draft also relied on a working file
outside the repo; it could not be checked, so no fact rests on it any more.

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

## Owner-added leaders (2026-11-10): Jhansi Fort and Netaji Bhawan

The owner added these two leaders on 2026-11-10 and approved the clip wording
the same day (t330u; spec, "Owner decisions"). Both rows are now in
`clips.json`, and each row's status (PROPOSED or UNVERIFIED) and reason are in
`row-status.json`. Owner rule: if any source disagrees with a narrated or
carded fact, the row stays UNVERIFIED. Nothing marked UNVERIFIED, conflicting
or screened below is added to the wording. All sources were fetched on
2026-11-10.

| Id | Source | URL |
|---|---|---|
| S9 | Britannica, "Lakshmi Bai" | https://www.britannica.com/biography/Lakshmi-Bai |
| S10 | Wikipedia, "Lakshmibai, Rani of Jhansi" | https://en.wikipedia.org/wiki/Lakshmibai,_Rani_of_Jhansi |
| S11 | Wikipedia, "Jhansi Fort" | https://en.wikipedia.org/wiki/Jhansi_Fort |
| S12 | Wikipedia coordinates for "Jhansi Fort" and "Netaji Bhawan" (MediaWiki API) | https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=Jhansi_Fort%7CNetaji_Bhawan&format=json |
| S13 | Wikipedia, "Subhas Chandra Bose" | https://en.wikipedia.org/wiki/Subhas_Chandra_Bose |
| S14 | Wikipedia, "Indian National Army" | https://en.wikipedia.org/wiki/Indian_National_Army |
| S15 | Britannica, "Indian National Army" (topic page; its only text is an automatically generated summary that the page itself says may contain mistakes) | https://www.britannica.com/topic/Indian-National-Army |
| S16 | Wikipedia, "Rani of Jhansi Regiment" | https://en.wikipedia.org/wiki/Rani_of_Jhansi_Regiment |
| S17 | Wikipedia, "Jai Hind" | https://en.wikipedia.org/wiki/Jai_Hind |
| S18 | Wikipedia, "Netaji Bhawan" | https://en.wikipedia.org/wiki/Netaji_Bhawan |
| S19 | Incredible India (Government of India tourism), "Netaji Bhawan" | https://www.incredibleindia.gov.in/en/west-bengal/kolkata/netaji-bhawan |
| S20 | Asia InCH, "Netaji Bhawan, Kolkata" | https://asiainch.org/museum/netaji-bhawan/ |
| S21 | National Geographic, "Lakshmi Bai, India's warrior queen who fought the British" | https://www.nationalgeographic.com/history/history-magazine/article/india-warrior-queen-lakshmi-bai-fought-british-rule |
| S22 | The Times of India, "160 years on, walls that made a queen immortal stand strong" | https://timesofindia.indiatimes.com/city/kanpur/160-years-on-walls-that-made-a-queen-immortal-stand-strong/articleshow/65087134.cms |
| S23 | Wikipedia, "Damodar Rao of Jhansi" | https://en.wikipedia.org/wiki/Damodar_Rao_of_Jhansi |
| S24 | The Indian Express, "Explained: The history of popular slogans raised during the Indian independence movement" | https://indianexpress.com/article/explained/explained-history-of-popular-slogans-raised-during-indian-independence-8082629/ |
| S25 | The Times of India (TimesTravel), "Netaji Bhawan, Kolkata" | https://timesofindia.indiatimes.com/travel/destinations/netaji-bhawan/articleshow/52946894.cms |
| S26 | Britannica, "Subhas Chandra Bose" | https://www.britannica.com/biography/Subhas-Chandra-Bose |

### Rani Lakshmibai, Jhansi Fort (owner frame: mother, queen and leader)

| Id | Fact | Source | Confidence | Owner frame it supports |
|---|---|---|---|---|
| R-1 | She was the rani (queen) of Jhansi. | S9; S10 | HIGH | queen |
| R-2 | Her husband adopted a five-year-old relative, renamed Damodar Rao, as heir in 1853; she was his mother by adoption. | S9; S10 | HIGH | mother |
| R-3 | In 1857 she took over the rule of Jhansi, ruling on behalf of her young son. | S9 ("proclaimed the regent… ruled on behalf of her minor son"); S10 ("took over the rulership of Jhansi") | HIGH for 1857 | ruled Jhansi |
| R-4 | She organised her troops (S9), recruited an army (S10) and rallied her defenders during the siege (S21). | S9; S10; S21 | HIGH | narration "led Jhansi's army" |
| R-5 | She took charge of the forces in the wider region, and fighters from nearby areas came to Jhansi to support her. | S9 | MEDIUM (one source) for "rallied" | rallied them |
| R-6 | During the siege of Jhansi's fort she did not surrender, even after her forces were overwhelmed. | S9 | HIGH (one source, plainly stated) | stood her ground |
| R-7 | The siege of the fort was in March and April 1858. | S9 ("turned toward Jhansi in March" 1858); S10 ("March and April 1858"); S21 (siege from March 1858) | HIGH | card "She led her forces in 1858" |
| R-8 | She left the fort with Damodar tied to her **back**. | Back: S9 ("is believed to"), S21 ("it is said"), S22, S23 ("according to tradition"). **Waist: S10** (citing two published histories). | **DISAGREE (R-C4).** No longer narrated (owner, 2026-11-10). | not used |
| R-11 | In 1858 she rode out of the besieged Jhansi fort with her son Damodar. | S9 (fled the fort on horseback "with her son, Damodar"; escaped "with a small force of palace guards"); S10 ("escaped the siege on horseback… with her adopted son Damodar Rao", reaching Kalpi on 5 April 1858); S21 (escaped "accompanied by her guards and, it is said, her son"); S22 (rode out on horseback with her son, April 1858); S23 (by tradition on horseback with Damodar; "more probably she escaped in the night with her son, surrounded by guards") | HIGH that she left the fort with her son in 1858; HIGH that she rode (S9, S10, S22, S23; S21 doesn't mention a horse and doesn't contradict it). How she got out (a leap or not) is disputed (R-C5) and isn't narrated. | narration "rode out with her young son" |
| R-9 | Jhansi Fort stands on a hilltop called Bangira, in the middle of Jhansi city, Uttar Pradesh. | S11 | MEDIUM (one source) | place |
| R-10 | Coordinates 25.45809, 78.57544. | S12 | HIGH | place |

Year check (integrator item): **confirmed.** She took charge of Jhansi in
1857 (R-3); the siege and her ride out of the fort were in 1858 (R-7). A clip
must not put the ride in 1857.

Conflicts for the owner (none may be narrated until settled):
- **R-C1** Birth year: about 1828, disputed (S9); "1827–30, or 1835" (S10). Not needed.
- **R-C2** Marriage year: 1842 or 1852 (S9); S10 gives her as queen consort 1843–1853. Not needed.
- **R-C3** Training: S9 says she was trained as a girl in sword fighting and
  riding; S10 calls these childhood stories "uncorroborated popular legend",
  and says she trained an all-female regiment "if it existed". So **"trained
  her own forces" is UNVERIFIED**; "organised and led her forces" (R-4) is the
  sourced line.
- **R-C4 Back vs waist (logged; no longer narrated).** The owner's earlier
  narration said "her little son on her back"; on 2026-11-10 the owner changed
  it to "rode out with her young son", which avoids this dispute. Four sources say back: S9
  ("is believed to"), S21 ("it is said"), S22 (plain statement) and S23
  ("according to tradition"; it adds that "more probably she escaped in the
  night with her son, surrounded by guards"). S10 says "tied to her waist",
  citing two published histories. Every "back" source except S22 hedges it
  as belief or tradition. Resolved by rewording, not by choosing a source.
- **R-N1 "Young" son (a note, not a conflict):** S9 and S10 say Damodar was
  five when adopted in November 1853, which makes him about nine or ten in
  April 1858. S23 gives his birth date as 15 November 1849, which makes him
  eight in April 1858 (and four, not five, at the adoption). The sources differ
  by a year or two on his exact age, but every reading gives a boy of about
  8 to 10, so "young" fits all of them. No age is narrated.
- **R-C5** The ride out: S9 tells the leap from the walls on horseback as a
  belief; S10 says "there are multiple accounts" (a leap, being lowered onto
  a horse, or a gap left in the lines). A clip can say she rode out of the
  fort; it must not assert the leap as fact.
- **R-C6** Ride to Kalpi: a legend of one night (S10) vs arrival at midnight
  on 5 April after a longer ride (S10, "more reliable sources"). Not needed.

UNVERIFIED: "trained her own forces" (R-C3); any number of soldiers with her
(S10 gives "around three hundred" from one history; not used).

§7a risk notes for the owner (facts are true and sourced; they are logged,
not told):
- Her story is set in the 1857–58 uprising, a war. The frame avoids battle
  detail, deaths, blood and "enemy" wording, as directed. The sources use
  "enemy" (S10), "rebels" and "invading forces" (S9); none of these words may
  be used, and `check-clips.mjs` fails on "enemy".
- S10 says her part in the June 1857 killings of British residents at Jhansi
  "was and remains contested" (S9 says rebels carried them out). Not told.
- S10 records a present-day dispute over her legacy in caste politics, and
  folk traditions that link her with Hindu deities. Neither is told.
- Her death in battle in June 1858 (S9; S10) is not told.

### Subhas Chandra Bose, Netaji Bhawan, Kolkata

| Id | Fact | Source | Confidence | Owner frame it supports |
|---|---|---|---|---|
| B-1 | He is known as "Netaji". | S13; S18; S19; S26 ("Popularly known as Netaji") | HIGH | narration "Netaji" |
| B-2 | "Netaji" means "Respected Leader". | S13 (Hindustani); S26 (Hindi) | HIGH for the meaning (the two name the language differently) | card detail only |
| B-3 | Bose made "Jai Hind" popular: it reached new popularity when, under him, it became the INA's official slogan (S17); he "popularised 'Jai Hind' as a salutation" for INA soldiers (S24). | S17; S24 | HIGH for "made famous" | narration "made 'Jai Hind' famous" |
| B-4 | The INA had a women's regiment, the Rani of Jhansi Regiment, led by Captain Lakshmi Swaminathan (Lakshmi Sahgal) and raised in July 1943. | S13; S14; S16; S9 | HIGH | women's regiment |
| B-5 | The regiment was named after Rani Lakshmibai of Jhansi. | S9; S13; S16 | HIGH | links the two clips |
| B-6 | On 4 July 1943 Bose took over leadership of the (second) INA in Singapore (S14); on 4 July 1943 he took over leadership of the independence movement in East Asia and organised the INA (S26). | S14; S26 | HIGH for 1943 | card "took command of the army in 1943" |
| B-7 | The INA was "an armed unit distinct from the official British Indian Army" (S26) and surrendered in August 1945 (S14), so it is not today's Indian Army. | S26; S14 | HIGH | never "founder of the army" |
| B-8 | Netaji Bhawan, his family home, was built by his father, Janakinath Bose, in 1909. | S18; S19 | HIGH | place |
| B-9 | It has been a museum since 1961, run by the Netaji Research Bureau. | S19; S20 | HIGH | place |
| B-10 | Address: 38/2 Lala Lajpat Rai Sarani (formerly Elgin Road), Kolkata. | S20; S19 (Elgin Road); S18 | HIGH | place |
| B-11 | Coordinates 22.53758333, 88.35125. | S12 | HIGH | place |
| B-12 | He lived in this house: it was "his own home" (S19); he "spent the formative years of his life here and also lived here" (S25); it is his ancestral house (S20); he escaped from this house in 1941 (S13, the Elgin Road house; S26, "his residence in Calcutta"). | S19; S25; S20; S13; S26 | HIGH | narration "lived here" |
| B-13 | He led an armed force, the Indian National Army. | S26 ("he led an armed force… The Indian National Army"); S14 ("led by… Subhas Chandra Bose") | HIGH | narration "He led an army" |

Conflicts for the owner:
- **B-C1 "Founded the INA in 1943": flagged; the sources disagree.** S14:
  an earlier INA was founded in 1942 by Mohan Singh and Iwaichi Fujiwara and
  then disbanded; Bose took over leadership of the second INA on 4 July 1943
  and "refounded" it. S16: the INA was "formed… in 1942". S15 (an automatic
  summary) says "formed in 1943 by Subhas Chandra Bose". **Recommended line:
  "led the Indian National Army from 1943" (B-6).** Never "founded" and never
  "founder of the Indian Army".
- **B-C2 "Jai Hind": who coined it is disputed, but the narration doesn't
  depend on it.** S17 says Chempakaraman Pillai coined it in 1907. S24
  reports a 2014 book saying Abid Hasan coined it, and S17 itself differs on
  who suggested it to the INA ("Abid Hasan" vs "Bose and Abid Hasan"). No
  source says Bose coined it. Two sources (S17, S24) agree he popularised it,
  so "made 'Jai Hind' famous" is supported. Never say he coined or invented it.
- **B-N1 Dates for the house (a note, not a conflict):** built 1909 (S18;
  S19); museum since 1961 (S19; S20). A 1947 dedication to the nation appears
  only in a search snippet of the Netaji Research Bureau's site, which could
  not be fetched as readable text, so it is UNVERIFIED and not used.

UNVERIFIED: anything from the Netaji Research Bureau's own site (it returned
no readable text to a direct fetch), including the 1947 dedication (B-N1).
B-2 and B-3 now have second sources (S26; S24).

Screened from S26 (true, sourced, not used): his wartime alliances, a famous
quotation about blood, and the continuing debate over his death.

§7a risk notes for the owner (true and sourced; logged, not told):
- The INA was an armed force in the Second World War, allied to and supported
  by Japan (S14; S15), and S17 calls "Jai Hind" a "battle cry". As directed, the
  wartime alliances are left out. That leaves little of the INA itself that
  can be shown, so a clip should centre on the house, the name "Netaji", the
  greeting and the women's regiment, with no fighting shown.
- His death in 1945 and the myths around it (S13; S15) are left out, as
  directed.
- His 1941 escape from house arrest at this house (S13; S18) is a famous
  exhibit (the car), but it is a political act against the government of the
  day. Left out unless the owner says otherwise.

## Standard codes (live source, fetched 2026-11-10)

| Code | Framework | Grade band | Text (short paraphrase) | Source | Used for |
|---|---|---|---|---|---|
| D2.His.1.3-5 | C3 History | by end of grade 5 | build and use a time order of related events | S7 Table 20 | lincoln-memorial |
| 4.NBT.B.4 | CCSS Math | grade 4 | add and subtract multi-digit whole numbers with the standard algorithm | S8 | lincoln-memorial opening question (1922 − 1914) |
| 6.EE.B.7 | CCSS Math | grade 6 | write and solve equations of the form x + p = q | S8 | lincoln-memorial stretch (10-18 only) |
| D2.His.3.6-8 | C3 History | by end of grade 8 | use questions about individuals and groups to analyse why they, and what they shaped, are seen as historically significant | S7 Table 20 | jhansi-fort, netaji-bhawan |
| 4.NBT.B.4 | CCSS Math | grade 4 | (as above) | S8 | jhansi-fort and netaji-bhawan cards (current year − 1858, current year − 1943); the math is grade 4 in rows the owner placed in 10-18 |
