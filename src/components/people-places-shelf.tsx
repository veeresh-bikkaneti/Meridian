import type { AgeBandId } from "@/game/age-profile";
import { CardFilm } from "./card-film";
import {
  filmsForBand,
  peoplePlacesMedia,
  peoplePlacesNarrationUrl,
} from "./people-places-films.ts";

export function PeoplePlacesShelf({ band }: { band: AgeBandId }) {
  const films = filmsForBand(band);
  return (
    <section
      className="hv5-card hv5-page"
      aria-labelledby="people-places-title"
      data-testid="people-places-shelf"
    >
      <span className="hv5-label">Journal</span>
      <h2 id="people-places-title">People and places</h2>
      <p>Each picture keeps the same words underneath. Less motion keeps the still picture.</p>
      {films.map((film) => {
        const media = peoplePlacesMedia(film.clip);
        const narrationUrl = peoplePlacesNarrationUrl(film.clip);
        const headingId = `people-places-heading-${film.clip}`;
        return (
          <article
            key={film.id}
            className="hv5-entry"
            aria-labelledby={headingId}
            data-testid={`people-places-clip-${film.clip}`}
          >
            <CardFilm
              className="hv5-people-places"
              media={media}
              testId={`people-places-film-${film.clip}`}
              band={band}
            />
            <h3 id={headingId}>{film.placeName}</h3>
            <p data-testid={`people-places-caption-${film.clip}`}>{film.caption}</p>
            {narrationUrl ? (
              <audio controls preload="none" src={narrationUrl}>
                {film.caption}
              </audio>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
