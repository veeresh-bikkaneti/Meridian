import { CardFilm } from "@/components/card-film";
import clipRows from "../../docs/scaling/journals/freedom-fighters/clips.json" with { type: "json" };
import {
  ROBBEN_ISLAND_CAPTION,
  ROBBEN_ISLAND_CLIP_ID,
  ROBBEN_ISLAND_FILM,
  ROBBEN_ISLAND_NARRATION_URL,
  clipLeavesComingSoon,
} from "./robben-island-clip.ts";
import "./journal-clip-card.css";

export function JournalClipCard({ id }: { id: string }) {
  if (!clipLeavesComingSoon(id)) {
    return (
      <div className="journal-clip-soon" data-testid="coming-soon-stamp">
        <p>Coming soon</p>
      </div>
    );
  }

  const row = clipRows.find((item) => item.id === ROBBEN_ISLAND_CLIP_ID);
  if (!row) {
    return (
      <div className="journal-clip-soon" data-testid="coming-soon-stamp">
        <p>Coming soon</p>
      </div>
    );
  }

  return (
    <article className="journal-clip-card" data-testid={`journal-clip-${id}`}>
      <p className="journal-clip-place">{row.place.name}</p>
      <h1>{row.why}</h1>
      <CardFilm
        className="journal-clip-film"
        media={ROBBEN_ISLAND_FILM}
        testId={`journal-clip-film-${id}`}
      />
      <p className="journal-clip-caption" data-testid="journal-clip-caption">
        {ROBBEN_ISLAND_CAPTION}
      </p>
      <audio
        controls
        preload="none"
        src={ROBBEN_ISLAND_NARRATION_URL}
        data-testid="journal-clip-narration"
      >
        <track
          kind="captions"
          srcLang="en"
          label="English captions"
          src="/videos/journals/freedom-fighters/robben-island.vtt"
        />
      </audio>
    </article>
  );
}
