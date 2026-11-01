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
 */
export const VERDICT_GRANDPA_VIDEO_URL: string = videoUrl;
export const VERDICT_GRANDPA_POSTER_URL: string = posterUrl;
