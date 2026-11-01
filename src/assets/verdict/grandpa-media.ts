import videoUrl from "./grandpa-was-already-there.mp4";
import posterUrl from "./grandpa-was-already-there.webp";

/**
 * THE swap point for the verdict screen's Grandpa clip.
 *
 * The challenge verdict screen (ChallengeVerdict in game-app.tsx)
 * imports the clip and its still from here and nowhere else, so a
 * re-animated take ships by replacing the .mp4 file beside this
 * module — no component code changes. Keep it that way: if the clip
 * is ever re-cut, replace the file, not the imports.
 *
 * Provenance: "Grandpa Was Already There" — the council's Concept #2,
 * picked by the owner 2026-10-29 and AI-animated from the
 * owner-approved keyframe (the .webp still is that keyframe, and
 * doubles as the video poster and the reduced-motion still). The
 * shipped take is finger-gun v2: Grandpa's lazy raised finger-gun
 * stays up for the whole clip.
 *
 * ── Re-deriving the assets (read this before replacing anything) ──
 *
 * Where the sources live (outside the repo, in the workspace):
 *   - Approved keyframe: ~/workspace/meridian-challenge-winner/
 *     keyframes/keyframe-2-grandpa-was-already-there.webp
 *   - Animation takes:   ~/workspace/meridian-challenge-winner/
 *     verdict-video/ — the shipped take's source is
 *     grandpa-verdict-v2.mp4 (1152×768).
 *
 * The .mp4 — shrink the take to web size, in this shape:
 *   ffmpeg -i <take>.mp4 -vf scale=960:640 -c:v libx264 -crf 28 \
 *     -an -movflags +faststart grandpa-was-already-there.mp4
 * That is: 960×640 (3:2, the size the verdict screen renders),
 * H.264 at CRF 28, audio stripped (-an), and faststart so the clip
 * can start before it has fully downloaded. The shipped file came
 * out at 329,051 bytes; a replacement must stay in that league —
 * ≤ ~400 KB, H.264 in an .mp4, 3:2 (960×640).
 *
 * The .webp — the poster and the reduced-motion still are the
 * approved keyframe itself, resized to the same 960×640 box:
 *   ffmpeg -i keyframe-2-grandpa-was-already-there.webp \
 *     -vf scale=960:640 grandpa-was-already-there.webp
 * (shipped: 65,336 bytes). A new keyframe means replacing the .webp
 * too — never ship a poster/still from a different picture than the
 * clip's first frame.
 *
 * One hard rule: replacement takes must be silent. The audio track
 * is stripped on purpose — the verdict screen is a reading surface,
 * the clip is decoration, and it plays muted in the browser anyway.
 * A take whose sound actually matters is a different feature, not a
 * file swap; it needs its own design pass, not this recipe.
 */
export const VERDICT_GRANDPA_VIDEO_URL: string = videoUrl;
export const VERDICT_GRANDPA_POSTER_URL: string = posterUrl;
