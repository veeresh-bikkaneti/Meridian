# Educator Gate Rubric — how the gate works without an educator persona

**Status:** PROPOSED. This does not lift the educator gate. Every spec stays
GATED until a **real, named human educator** signs this rubric for that spec.
No AI persona, agent, or council seat can sign it, and the builder of the work
can never sign it (AGENTS.md: no self-certification).

**Why.** No educator persona exists in the packs, so the seat has been vacant and
every spec is blocked on it. A persona would not be a real check anyway. What
makes the gate real is a short, concrete checklist that a qualified person can
complete in about 30–45 minutes per spec, with evidence attached. Agents prepare
the evidence pack; a human makes the call.

## Who can sign

Any one of: a certified K–12 teacher (current or retired) for the band and
subject; a school curriculum coordinator; a university education-faculty
member. Free routes the owner can try: a volunteer teacher, a local school or
district contact, a teacher-education program looking for practicum projects,
or a parent who is a certified teacher. Record the signer's name, role, band and
subject, and date. Nothing about the signer is placed in the app.

## Evidence pack (prepared by agents, cheap to produce)

1. The spec, with the K-12 standard block filled in.
2. The item list: each item's objective, band, standard code (with source link),
   and the in-game evidence ("shown by").
3. For math: the verification-gate output on one complete mode.
4. For science: the cause → effect rule table with sources.
5. For journal and social studies: the script for each clip and its retrieval
   check.
6. A 2–3 minute screen recording or mockup of one round at each band served.
7. The readability report for host lines and on-screen text.

## The rubric (each item: Pass / Fix / Fail, with a one-line note)

**A. Content correctness and fit**
1. Every fact is correct and sourced; nothing taught is wrong or misleading.
2. Each item's content fits the stated band (not too hard, not babyish).
3. Standard codes are the right ones for the item.
4. Sensitive topics (war, conflict, historical injustice) are told truthfully
   and gently for the band, with no graphic detail.

**B. Learning design**
5. Each objective uses an observable verb and the game can actually see it.
6. The child predicts or attempts before being told the answer.
7. Feedback after a miss explains *why*, in band-level words, and is kind.
8. Misses come back later (review deck) and are mixed with other skills.
9. Mastery bar is fair: not luck, not grind.

**C. Child-appropriate engagement**
10. Motivation comes from mastery and curiosity, not pressure (no shaming,
    no streak-loss fear, no countdowns for K–5).
11. Session length suits the band.
12. A child of the band can tell what to do just by looking (mockup check).

**D. Access**
13. Read-aloud and captions cover every prompt; a pre-reader can play K–2 items.
14. Nothing requires fast reflexes or precise dragging to learn the content.
15. Reduced-motion / Flat tier still teaches the same thing.

**E. Safety and privacy**
16. No personal information is asked for or possible to enter.
17. No content a school would object to for the band.
17a. Content screen (standard §7a): nothing on religion, sexuality or gender
     identity, or current or contested politics; history told neutrally
     through events, places and achievements, taking no side.

## Decision rule

- **Approved for build:** no Fail, and every Fix is listed with an owner.
- **Approved after fixes:** Fixes are re-checked by the same signer.
- **Not approved:** any Fail in A or E.

## Sign-off block (copy into the spec)

```
EDUCATOR SIGN-OFF
Spec: [file + commit]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```

A sign-off covers the commit it names. If the build diverges from the signed
spec, it is not signed (existing rule).
