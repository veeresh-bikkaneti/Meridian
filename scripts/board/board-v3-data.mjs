/**
 * Board curation data — the grouping, player-words titles and † phase
 * lines, so the publisher and the mockup share one curation source.
 *
 * † = DEFAULT — AWAITING OWNER RULING (council spec §9):
 *  - epic grouping below is the coordinator's draft (§9.5); the
 *    GeoDetective features are the owner's pinned names;
 *  - PHASE lines are the UI/UX-style list (§9.2), format lines standing
 *    until each feature's hidden task breakdown derives the real ones
 *    (spec §6 migration rule).
 *
 * Board v4 (owner-approved sample, 2026-11-15): PLAYER_TITLES is the
 * durable player-words mapping from the sample README's 46-row table —
 * EVERY player-visible story carries its title here, so a future
 * refresh through build-curation.mjs can never fall back to a snapshot
 * (dev-language) title for one of these stories. EXCLUDED_SOURCE_IDS
 * are the 9 internal items with no player meaning (the whole Behind
 * the Scenes epic, the subject registry, the site-goes-live fix): they
 * are not in EPICS below and must never be published; publish-status
 * also rejects their slugs outright (EXCLUDED_SLUGS).
 */

export const PLAYER_TITLES = {
  "detective-core/holmes-and-watson-pair-in-the-game": "Meet Holmes & Watson in the game",
  "detective-core/pair-art-sheets-and-endings":
    "New drawings of Holmes & Watson, and how each case ends",
  "detective-core/holmes-follow-and-home-first-landing": "Holmes & Watson greet you on the home page",
  "detective-core/held-finger-jitter-fix-on-the-clue-berth":
    "Clues stay steady while little fingers hold them",
  "detective-core/clue-pacing-and-one-voice-at-a-time":
    "Clues arrive one at a time, one voice at a time",
  "detective-core/clue-4-opening-cards-2-and-3": "The fourth case's opening cards",
  "detective-core/age-groups-7-10-10-18-18-in-code":
    "Capitals games for ages 7–10, 10–18 and grown-ups",
  "detective-core/truce-pennant-port": "The truce flag at the end of a capitals case",
  "why-do-we-learn-this-card/films-v4-dolly-camera":
    "Short films showing where school subjects turn up in real life",
  "why-do-we-learn-this-card/card-on-home-behind-scale-1-button-reads-coming-soon":
    "The card on the home page",
  "why-do-we-learn-this-card/3d-film-source-files-branch": "Making the films in 3D",
  "why-do-we-learn-this-card/button-opens-a-subject-instead-of-coming-soon":
    "Tap the card and go straight into a subject",
  "why-do-we-learn-this-card/card-shown-to-kids-without-scale-1":
    "The card, ready for kids to open themselves",
  "math/number-strand-spec": "Number games — counting, ordering and patterns",
  "math/applied-strand-spec": "Everyday maths games — measuring, money and time",
  "math/math-subject-screen-3-items-per-age-group": "The Maths screen, with games for every age group",
  "math/math-sign-off-and-release-pr": "A final check, then Maths opens to everyone",
  "math/holmes-and-watson-in-math": "Holmes & Watson join the Maths cases",
  "physics-and-chemistry/physics-spec": "Physics games — how things move, fall and roll",
  "physics-and-chemistry/chemistry-spec": "Chemistry games — what things are made of",
  "physics-and-chemistry/science-definitions-and-scene-engine-spec":
    "Science words and animated scenes for every case",
  "physics-and-chemistry/science-expansion-spec": "More science cases",
  "physics-and-chemistry/predict-and-see-scene-engine-code":
    "Predict-and-see scenes — guess first, then watch",
  "physics-and-chemistry/physics-and-chemistry-screens": "The Physics & Chemistry screens",
  "physics-and-chemistry/wave-2-sign-off-and-release": "A final check, then science opens to everyone",
  "social-studies-and-gk/social-studies-economics-civics-spec":
    "Social studies games — people, places and how communities work",
  "social-studies-and-gk/general-knowledge-spec": "General knowledge games",
  "social-studies-and-gk/humanities-definitions-spec": "Words for people and places, in plain language",
  "social-studies-and-gk/social-studies-and-gk-screens": "The people-and-places screens",
  "social-studies-and-gk/wave-3-sign-off-and-release": "A final check, then it opens to everyone",
  "journals/7-journal-specs-people-and-places-technology-ww2-monuments-world-wars-modern-world-great-leaders-freedom-fighters":
    "Seven story collections — people and places, inventions, monuments, great leaders and freedom fighters",
  "journals/religious-journal-movies-hidden": "Some story films kept tucked away, by choice",
  "journals/journal-clips-stage-b-video-files": "Short film clips for the journals",
  "journals/journals-release": "The journals open to everyone",
  "audio-and-clips/shared-voice-channel-one-speaker-at-a-time":
    "One clear voice at a time — voices never talk over each other",
  "audio-and-clips/3-unrendered-clips-beat-me-win-together-truce-watson":
    "Three short voice clips still to record",
  "audio-and-clips/88-place-names-with-no-holmes-voice": "Holmes learns to say 88 place names out loud",
};

/** Player-words line overrides (sample README rows whose line is not
 * the derived one: the pair-art phase, and the tucked-away films whose
 * honest line is "Finished", not "Ready to play"). */
export const LINE_OVERRIDES = {
  "detective-core/pair-art-sheets-and-endings": "Drawing in progress",
  "journals/religious-journal-movies-hidden": "Finished",
};

/** The 9 internal items removed in v4 — never published. */
export const EXCLUDED_SOURCE_IDS = [
  "why-do-we-learn-this-card/cloudflare-deploy-fix",
  "math/subject-registry-shell-split",
  "infra-and-process/lean-test-strategy-in-agents-md",
  "infra-and-process/model-neutral-agent-rules",
  "infra-and-process/scale-play-mockup",
  "infra-and-process/scale-play-v2-plan-inside-the-prod-ui",
  "infra-and-process/windows-scripts-build-pages-npm-test-under-cmd-line-endings-on-globe-data",
  "infra-and-process/turn-the-scaling-streams-ruleset-back-on",
  "infra-and-process/open-issues-344-and-319-real-unbuilt-work",
];

/** Their pre-v4 published slugs — publish-status rejects these outright. */
export const EXCLUDED_SLUGS = [
  "fix-for-how-the-site-goes-live",
  "subject-registry",
  "lean-test-strategy",
  "model-neutral-agent-rules",
  "scale-play-mockup",
  "scale-play-v2-plan",
  "the-same-tools-working-on-windows",
  "turn-the-stream-safety-rules-back-on",
  "open-pieces-of-real-work-not-yet-placed",
];

export const PHASE = {
  "detective-core/pair-art-sheets-and-endings": "Drawing in progress",
  "detective-core/holmes-follow-and-home-first-landing": "Building in progress",
  "detective-core/clue-pacing-and-one-voice-at-a-time": "Testing in progress",
  "why-do-we-learn-this-card/3d-film-source-files-branch": "Animation in progress",
  "physics-and-chemistry/science-expansion-spec": "Polishing in progress",
  "audio-and-clips/shared-voice-channel-one-speaker-at-a-time": "Recording in progress",
};

/** Epics → features → story sourceIds. † grouping: spec §9.5 draft. */
export const EPICS = [
  {
    id: "geodetective",
    name: "GeoDetective",
    color: "#8a6d2f",
    features: [
      {
        id: "holmes",
        name: "Holmes & Watson",
        anim: "magnifier",
        promise: "The detective pair who guide your child through every case.",
        stories: [
          "detective-core/holmes-and-watson-pair-in-the-game",
          "detective-core/pair-art-sheets-and-endings",
          "detective-core/holmes-follow-and-home-first-landing",
        ],
      },
      {
        id: "clues",
        name: "Solving the Clues",
        anim: "compass",
        promise: "Clues that arrive one at a time, at a pace a child can follow.",
        stories: [
          "detective-core/held-finger-jitter-fix-on-the-clue-berth",
          "detective-core/clue-pacing-and-one-voice-at-a-time",
          "detective-core/clue-4-opening-cards-2-and-3",
        ],
      },
      {
        id: "capitals",
        name: "Capitals",
        anim: "pin",
        promise: "Flags and places on the map, for every age group.",
        stories: [
          "detective-core/age-groups-7-10-10-18-18-in-code",
          "detective-core/truce-pennant-port",
        ],
      },
    ],
  },
  {
    id: "subjects",
    name: "School Subjects",
    color: "#33503f",
    features: [
      {
        id: "why",
        name: "Why Do We Learn This?",
        anim: "star",
        promise: "The home card that opens every subject.",
        stories: [
          "why-do-we-learn-this-card/films-v4-dolly-camera",
          "why-do-we-learn-this-card/card-on-home-behind-scale-1-button-reads-coming-soon",
          "why-do-we-learn-this-card/3d-film-source-files-branch",
          "why-do-we-learn-this-card/button-opens-a-subject-instead-of-coming-soon",
          "why-do-we-learn-this-card/card-shown-to-kids-without-scale-1",
        ],
      },
      {
        id: "maths",
        name: "Maths",
        anim: "sum",
        promise: "Cases your child can play at their own level.",
        stories: [
          "math/number-strand-spec",
          "math/applied-strand-spec",
          "math/math-subject-screen-3-items-per-age-group",
          "math/math-sign-off-and-release-pr",
          "math/holmes-and-watson-in-math",
        ],
      },
      {
        id: "science",
        name: "Physics & Chemistry",
        anim: "flask",
        promise: "Predict first — then see what really happens.",
        stories: [
          "physics-and-chemistry/physics-spec",
          "physics-and-chemistry/chemistry-spec",
          "physics-and-chemistry/science-definitions-and-scene-engine-spec",
          "physics-and-chemistry/science-expansion-spec",
          "physics-and-chemistry/predict-and-see-scene-engine-code",
          "physics-and-chemistry/physics-and-chemistry-screens",
          "physics-and-chemistry/wave-2-sign-off-and-release",
        ],
      },
      {
        id: "rivers",
        name: "Rivers, Maps & People",
        anim: "river",
        promise: "Social studies and general knowledge, out in the world.",
        stories: [
          "social-studies-and-gk/social-studies-economics-civics-spec",
          "social-studies-and-gk/general-knowledge-spec",
          "social-studies-and-gk/humanities-definitions-spec",
          "social-studies-and-gk/social-studies-and-gk-screens",
          "social-studies-and-gk/wave-3-sign-off-and-release",
        ],
      },
    ],
  },
  {
    id: "journals",
    name: "Story Journals",
    color: "#8fa382",
    features: [
      {
        id: "journal",
        name: "Story Journals",
        anim: "book",
        promise: "Short stories and films about people and places.",
        stories: [
          "journals/7-journal-specs-people-and-places-technology-ww2-monuments-world-wars-modern-world-great-leaders-freedom-fighters",
          "journals/religious-journal-movies-hidden",
          "journals/journal-clips-stage-b-video-files",
          "journals/journals-release",
        ],
      },
    ],
  },
  {
    id: "voices",
    name: "Voices & Sound",
    color: "#b3543f",
    features: [
      {
        id: "voice",
        name: "Voices & Sound",
        anim: "mic",
        promise: "One clear voice at a time — never talking over.",
        stories: [
          "audio-and-clips/shared-voice-channel-one-speaker-at-a-time",
          "audio-and-clips/3-unrendered-clips-beat-me-win-together-truce-watson",
          "audio-and-clips/88-place-names-with-no-holmes-voice",
        ],
      },
    ],
  },
];

/** The first feature broken down into hidden tasks (spec Phase 1). */
export const FIRST_TASK_FEATURE = "holmes";
