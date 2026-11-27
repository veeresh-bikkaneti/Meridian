/**
 * SubjectsHost.tsx — the subjects screen host (game-app-map step 18,
 * TD-06.14).
 *
 * Owns what GameApp used to hold inline for subjects: the React.lazy
 * SubjectPicker and its leave wiring. GameApp keeps only the open
 * state and the render site's Suspense + MapErrorBoundary wrappers
 * (the boundary is a components/root module; the composer owns it
 * until it moves to layer 6 — the TD-06.6 age-profile host split).
 *
 * SubjectPicker stays lazy: it loads only when the why-learn card is
 * tapped, and each subject's case loads only when its picker row is
 * tapped. The screen has no default export in the lazy sense — it
 * default-exports, so the lazy factory adapts its default export
 * (the HomeGlobe idiom).
 *
 * The props are SubjectPicker's own, derived by type query (a type
 * query is not a runtime edge): the shell hands the host the picker
 * props and they pass through untouched — there is no persisted
 * subjects-open flag to clear on leave (unlike GeoDetective's
 * loopOpen), so no leave wrapping is needed here.
 */
import { lazy, type ComponentProps, type JSX } from "react";
import { withChunkTimeout } from "@/lib/chunk-timeout";

const loadSubjectPicker = () => import("./SubjectPicker");
// #209: the load is raced against CHUNK_LOAD_TIMEOUT_MS (inside
// withChunkTimeout) — a HUNG import never settles, so without the
// race the Suspense fallback at the render site would spin forever;
// with it, the race rejection lands in MapErrorBoundary's
// recoverable card instead.
const SubjectPickerScreen = lazy(() =>
  withChunkTimeout(loadSubjectPicker(), "Subject picker screen").then((m) => ({
    default: m.default,
  })),
);

type SubjectsHostProps = ComponentProps<
  (typeof import("./SubjectPicker"))["default"]
>;

export function SubjectsHost(props: SubjectsHostProps): JSX.Element {
  return <SubjectPickerScreen {...props} />;
}
