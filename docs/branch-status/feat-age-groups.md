# feat/age-groups

**Task:** Council manifest for moving `src/game/age-profile/bands.ts` from
`5-7` / `8-10` / `11-13` to `7-10` / `10-18` / `18+`, with a profile
migration that keeps stored progress, and contract I3 `getAgeGroup()`
exported from `src/game/age-profile/`.

**Scope:** `src/game/age-profile/**`, `docs/scaling/age-groups-manifest.md`,
this file. Nothing else.

**Status:** Manifest written. Code not started. Waiting on the owner's go.

**Done:**

- Read the scaling plan, agent instructions, standard (cited, not copied),
  subject map, educator rubric, and contracts.
- Manifest: `docs/scaling/age-groups-manifest.md`.
- Legacy map recorded: `5-7` and `8-10` → `7-10`, `11-13` → `10-18`.
  Unset stays unset and resolves to `10-18`, not `18+`.
- Labels and parent-facing lines are `TODO(owner)` placeholders.
- Integrator file list is in the manifest, §3.

**Open:**

- Owner go before any code.
- Owner words for the three labels, descriptions, and what-changes lines.
- Owner confirmation of the `7-10` loop list, rung ceiling, hint policy,
  numeric difficulty, and the `18+` difficulty row. Counts are TO CONFIRM.
- Integrator edits for the 23 files that pin the old ids, plus
  `AgePicker.tsx` and `AgeProfileSettings.tsx` so `18+` does not print a
  fake top age.
- No code gates ran. Docs only. No screen recording.

**Next:** Stop. Do not edit `src/game/age-profile/` until the owner says go.
