/**
 * Board v3 curation data — the grouping, plain-title fixes and † phase
 * lines the design mockup used (board-v3-mockup/assemble.py), ported so
 * the publisher and the mockup share one curation source.
 *
 * † = DEFAULT — AWAITING OWNER RULING (council spec §9):
 *  - epic grouping below is the coordinator's draft (§9.5); the
 *    GeoDetective features are the owner's pinned names;
 *  - PHASE lines are the UI/UX-style list (§9.2), format lines standing
 *    until each feature's hidden task breakdown derives the real ones
 *    (spec §6 migration rule).
 */

export const TITLE_FIX = {
  "math/subject-registry-shell-split": "Subject registry",
  "why-do-we-learn-this-card/card-on-home-behind-scale-1-button-reads-coming-soon":
    "The card appears on the home page",
  "why-do-we-learn-this-card/card-shown-to-kids-without-scale-1": "The card appears for kids",
  "why-do-we-learn-this-card/3d-film-source-files-branch": "3D film source files",
  "why-do-we-learn-this-card/cloudflare-deploy-fix": "Fix for how the site goes live",
  "math/math-sign-off-and-release-pr": "Maths sign-off and release",
  "physics-and-chemistry/predict-and-see-scene-engine-code": "Predict-and-see scene engine",
  "infra-and-process/lean-test-strategy-in-agents-md": "Lean test strategy",
  "infra-and-process/scale-play-v2-plan-inside-the-prod-ui": "Scale-play v2 plan",
  "infra-and-process/windows-scripts-build-pages-npm-test-under-cmd-line-endings-on-globe-data":
    "The same tools, working on Windows",
  "infra-and-process/turn-the-scaling-streams-ruleset-back-on": "Turn the stream safety rules back on",
  "infra-and-process/open-issues-344-and-319-real-unbuilt-work":
    "Open pieces of real work, not yet placed",
};

export const PHASE = {
  "detective-core/pair-art-sheets-and-endings": "Drawing in progress",
  "detective-core/holmes-follow-and-home-first-landing": "Building in progress",
  "detective-core/clue-pacing-and-one-voice-at-a-time": "Testing in progress",
  "why-do-we-learn-this-card/3d-film-source-files-branch": "Animation in progress",
  "physics-and-chemistry/science-expansion-spec": "Polishing in progress",
  "audio-and-clips/shared-voice-channel-one-speaker-at-a-time": "Recording in progress",
  "infra-and-process/scale-play-mockup": "Building in progress",
  "infra-and-process/scale-play-v2-plan-inside-the-prod-ui": "Still planning",
};

/** Epics → features → story sourceIds. † grouping: spec §9.5 draft. */
export const EPICS = [
  {
    id: "geodetective",
    name: "GeoDetective",
    color: "#e8b64c",
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
    color: "#3c8496",
    features: [
      {
        id: "why",
        name: "Why Do We Learn This?",
        anim: "star",
        promise: "The home card that opens every subject.",
        stories: [
          "why-do-we-learn-this-card/films-v4-dolly-camera",
          "why-do-we-learn-this-card/card-on-home-behind-scale-1-button-reads-coming-soon",
          "why-do-we-learn-this-card/cloudflare-deploy-fix",
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
          "math/subject-registry-shell-split",
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
    color: "#6e9084",
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
    color: "#e86a5c",
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
  {
    id: "behind",
    name: "Behind the Scenes",
    color: "#9db3ad",
    features: [
      {
        id: "making",
        name: "How Meridian Is Made",
        anim: "gear",
        promise: "The tools and checks that keep the game honest.",
        stories: [
          "infra-and-process/lean-test-strategy-in-agents-md",
          "infra-and-process/model-neutral-agent-rules",
          "infra-and-process/scale-play-mockup",
          "infra-and-process/scale-play-v2-plan-inside-the-prod-ui",
          "infra-and-process/windows-scripts-build-pages-npm-test-under-cmd-line-endings-on-globe-data",
          "infra-and-process/turn-the-scaling-streams-ruleset-back-on",
          "infra-and-process/open-issues-344-and-319-real-unbuilt-work",
        ],
      },
    ],
  },
];

/** The first feature broken down into hidden tasks (spec Phase 1). */
export const FIRST_TASK_FEATURE = "holmes";
