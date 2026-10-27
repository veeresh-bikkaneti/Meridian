import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/grownups/info-page";
import { IMAGERY_ATTRIBUTION } from "@/map/imagery";
import { BUNDLED_CREDITS } from "@/lib/credits";

/**
 * /credits — where Meridian's place data, story text, and map pictures
 * come from, and the open-source software it is built with (WI-15).
 *
 * The Esri attribution is rendered from IMAGERY_ATTRIBUTION, the same
 * constant the map itself shows, so this page cannot drift from the
 * on-map string. The bundled-library list is data in src/lib/credits.ts,
 * guarded by src/lib/credits.test.ts against package.json.
 *
 * This page is factual only: it loads no third-party resources, carries
 * no form and no email address, and makes no certification claim.
 */
export const Route = createFileRoute("/credits")({
  head: () => ({ meta: [{ title: "Credits — Meridian" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  return (
    <InfoPage title="Credits">
      <p className="text-sm text-muted">For parents, carers, and teachers</p>

      <p>
        Meridian is a free geography game built on open data and open-source software. This page
        credits the sources it uses and the licences they are shared under.
      </p>

      <h2>Place data — GeoNames</h2>
      <p>
        The game&rsquo;s place names and locations come from{" "}
        <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">
          GeoNames
        </a>
        , shared under the CC BY 4.0 licence.
      </p>

      <h2>Story text — Wikipedia</h2>
      <p>
        Reviewed text from{" "}
        <a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">
          Wikipedia
        </a>{" "}
        is the source of the history hooks and story text for places, passed through the
        game&rsquo;s reviewed content pipeline, and individual cards name their source. Wikipedia
        text is shared under the CC BY-SA licence.
      </p>

      <h2>Map imagery — Esri</h2>
      <p>{IMAGERY_ATTRIBUTION}</p>
      <p>The satellite pictures in the game come from Esri&rsquo;s World Imagery service.</p>

      <h2>Open-source software</h2>
      <p>Meridian is built with these open-source libraries:</p>
      <ul>
        {BUNDLED_CREDITS.map((credit) => (
          <li key={credit.packageName}>
            {credit.name} — {credit.license} licence
          </li>
        ))}
      </ul>
    </InfoPage>
  );
}
