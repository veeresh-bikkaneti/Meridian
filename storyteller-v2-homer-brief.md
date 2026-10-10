# Homer — Character Behavior & Personality Brief
**Storyteller v2, Phase 1 — DESIGN** · Sr Game Designer · 2026-10-10
Reference art: `public/images/storyteller/storyteller.jpg` (curly gray beard, laurel wreath, scroll in left hand, stylus raised in right, blue Greek-key tunic, sandals).

> Design phase only. No code, no SVG. The artist handles visuals; this brief governs behavior, personality, and ruling conflicts.

---

## 1. Who Homer is

**Homer is the map's mischievous grandfather.** He has been standing on the home banner since before the kid arrived, mid-story, and he is delighted someone finally showed up to hear the rest. His personality is *warm curiosity with a trickster's twinkle*: he tells true tales, he loves a kid who pokes him, and he never, ever makes a player feel wrong — every pin is a discovery, even the silly ones.

**Voice in the room:** A seasoned dramatic narrator — warm, unhurried, slightly theatrical, the voice of someone who knows the punchline and wants you to earn it. He speaks *to* the kid, never *at* them: "Psst — your sound is off, young explorer" is the register, not "Sound must be enabled." Second person, playful, conspiratorial.

**Relationship to the player:** Grandpa-energy tour guide who chose *you* as his apprentice storyteller. He is bigger than you and proud of it, but you are his partner, not his student — he waves you in, he reacts when you touch him, and when the tour takes over he steps back *because it's your turn now*, not because he's done. That handoff — "the spotlight is yours, kiddo" — is the emotional core of the whole character.

**Continuity promise:** This must feel like the same beloved claymation figure, redrawn, not replaced. Keep: the curly gray beard (his crown), the laurel wreath, the scroll, the raised stylus, the blue Greek-key tunic, the twinkle that says he's about to say something funny. Scale up, crisp up, motion-enable — but a kid who loved the old Homer should recognize the new one in half a second.

---

## 2. Pose / expression language — five moments

### (a) Idle — "I'm here, and I'm happy about it"
- **Emotional intent:** Barely-there breathing presence — alive, not demanding. A statue that *breathes* so the banner never feels dead, but never pulls attention from the play button.
- **Layers:** `homer-torso` (subtle 2–4px vertical breathing loop, ~4s cycle), `homer-wreath` (nearly still; a 1px sway at the wreath's edge is enough to feel organic), `homer-eyes` (slow blink every ~5–7s — blink is *the* aliveness signal for kids), `homer-scroll-arm` (micro-shift of the scroll's angle every cycle, like he's re-gripping it).
- **Still:** `homer-head`, `homer-jaw` (jaw shut, mouth relaxed under the beard), `homer-wave-arm`, `homer-legs`.
- **Timing/feel:** Sine-eased, slow, looping; the whole thing should be almost subliminal — if a kid stares and says "he's breathing," it's working; if they notice before staring, it's too much. **CSS-only, `prefers-reduced-motion` disables to a static resting pose.** This is the standing idle directive (ruling #3), not decoration — it stays on through greeting prep and returns after greeting ends.

### (b) Greeting wave — "Ah! You're here!"
- **Emotional intent:** Welcoming surprise — the storyteller spots his audience. Joy, not urgency.
- **Layers:** `homer-wave-arm` (right arm with stylus raises from rest → an open palm-up welcoming sweep, two gentle arcs over 1–2s — *not* a frantic flap; a storyteller's flourish), `homer-head` (tilts ~8° toward the player, dipping slightly at wave peak like a bow), `homer-eyes` (widen + hold on the player through the wave), `homer-wreath` (slight bounce trailing the head tilt — secondary motion sells the physics), `homer-torso` (small lean forward, ~6°).
- **Still:** `homer-jaw` until narration starts (wave first, voice lands on the settle), `homer-scroll-arm`, `homer-legs` (planted — he's rooted, the story comes to you).
- **Timing/feel:** Ease-out on the raise (~600ms), two slow arcs (~700ms each), settle back over ~500ms; total 1–2s, once per greeting — never loops. The wave is the *announcement* of the greeting; the jaw/torso then take over for the talking moment below. Plays regardless of the tour (ruling #1).

### (c) Talking — "Listen closely, now…"
- **Emotional intent:** The tale itself — engagement and warmth. This is his job, and he loves it.
- **Layers:** `homer-jaw` (bob synced to narration audio amplitude — open on vowel energy, close on pauses; the sync should read at a glance but forgive drift — kids forgive timing, not stillness), `homer-head` (micro-nods on story beats — name the place, drop the hook, land the giveaway), `homer-eyes` (alternating between the player and a slight upward-left "recalling the tale" drift on descriptive passages), `homer-scroll-arm` (raises the scroll slightly on the *hook* line — he unrolls it in spirit), `homer-torso` (keeps the breathing cycle from idle, slightly deeper — speaking posture).
- **Still:** `homer-wave-arm` (at rest after the greeting), `homer-legs`, `homer-wreath` (settled).
- **Timing/feel:** Jaw follows the audio envelope; head nods are authored to the script's three beats (hook → story → giveaway), not the waveform — *editorial* motion, not lip-reading. The beard can trail the jaw bob by a hair for comedy. If narration is muted (ruling #4), **no silent talking**: the jaw does *not* move with no audio — instead the hint line covers it (see §4).

### (d) Poke startle — "Hey! Who — oh, it's you!"
- **Emotional intent:** Comedic surprise that lands as delight, never alarm. The whole joke: an ancient storyteller, startled by a tiny finger.
- **Layers:** `homer-eyes` (snap wide — the *first* frame sells it), `homer-head` (quick recoil ~10° back + tilt), `homer-wreath` (jumps and resettles — physical comedy lives in the wreath), `homer-jaw` (drops open for the "hey!"), `homer-torso` (sharp little lean-back), `homer-wave-arm` (jerks up halfway in a "woah!" guard before he recognizes the kid and relaxes it into a chuckle), `homer-scroll-arm` (hugs the scroll tighter for a frame — protecting the tales).
- **Timing/feel:** 150–300ms for the startle *snap* (fast in), then a relaxed 400–600ms recover where the eyes crinkle and the wave-arm drops into a laugh-shake — the recovery *is* the punchline. One-shot; no repeat on rapid double-pokes (debounce so it can't be farmed into a seizure machine — kids will try). **Reduced-motion:** startle collapses to a single blink + head tilt; the snap is the most motion-dense moment, so it gets the strongest fallback.

### (e) Yield / recede — "Your turn, explorer."
- **Emotional intent:** Graceful exit — he steps back *for* you, not *from* you. Pride, not abandonment.
- **Layers:** `homer-torso` (leans back and slightly down — a half-bow), `homer-wave-arm` (sweeps into a "behold!" presenting gesture toward the tour content — he is *introducing* the tour), `homer-head` (dips in a nod of encouragement), `homer-eyes` (warm hold on the player as he recedes — "you've got this"), then the whole figure (scale ~0.85 + drift toward the banner edge + opacity ease — the recede).
- **Timing/feel:** 600–900ms ease-in-out; the presenting gesture *leads* the recede so the motion reads as "after you," not "goodbye." He should never read as dismissed or sad — shoulders stay open, eyes stay on the kid. Idle motion pauses while yielded (reduced-motion safe either way). When the tour ends, he re-enters with a half-second version of the greeting wave — continuity, not a new hello.

---

## 3. Kid-appeal check (ages 5–13)

What makes Homer delightful rather than scary or boring is that he behaves like a *playful adult who is firmly on the kid's side*. For the 5–7s, delight comes from the physical comedy — the wreath bounce, the wide-eye startle, the scroll-hug — all big, readable, and over in under a second, so nothing lingers long enough to confuse them. For the 8–10s, it's the conspiracy: he talks *to* you, he remembers that *you* poked him last time, and the yield moment makes them the protagonist instead of the audience. For the 11–13s, it's the non-condescension — he never talks down, never punishes a wrong pin, and the dramatic-narrator delivery has enough genuine theater to feel like a performance rather than a lecture. Nothing about him is scary because nothing about him is sudden without a warm recovery: the startle *always* resolves into a chuckle, the jaw never moves without a voice (no uncanny silent flapping), and his size is played as cozy bigness — a grandfather's lap, not a giant's shadow. The boring-risk is the idle, and it's handled by the blink: one well-timed blink does more for "he's alive" than any amount of bouncing.

---

## 4. Ruling-conflict check

**No conflicts.** Reviewed against all four standing owner rulings:

1. **Greeting plays regardless of the tour** — preserved. The greeting wave (§2b) is specified as a tour-independent announcement, and the yield (§2e) is explicitly a *separate* motion, never a replacement for or precondition of the greeting. Nothing in the brief gates the greeting on tour state.
2. **Tutorial-invite dismiss counts as the first gesture** — preserved. The brief treats the wave/jaw choreography as greeting-announcement + narration, with no separate gesture consumed by the invite-dismiss flow. The poke startle (§2d) is defined against *post-greeting* player contact, not first-tap bookkeeping; implementation must keep the invite-dismiss counting as the unlocking first gesture, and nothing here redefines it.
3. **Idle engagement: CSS-only, reduced-motion safe** — preserved. Idle (§2a) is specified CSS-only with `prefers-reduced-motion` falling back to a static resting pose. The reduced-motion fallback for the startle (§2d: blink + head tilt) and yield (§2e) are called out explicitly because the startle is the most motion-dense moment and the yield involves whole-figure transform.
4. **Muted first-tap shows the hint, never silent failure** — preserved. The talking moment (§2c) explicitly requires *no silent jaw motion*: if narration is muted, the jaw does not animate and the scripted hint line ("Psst — your sound is off, young explorer. Tap the speaker above to hear my tale.") is the response instead. No design choice here can produce a silent-talking state.

One note for implementation (not a conflict): the startle debounce and the reduced-motion collapse are behaviors the brief *requires* but are easy to skip — the coordinator should carry them as acceptance criteria into the artist/engineering handoff.
