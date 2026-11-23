import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CardFilmMedia } from "./card-film-media.ts";
import type { CardFilmMedia as CardFilmMediaViaCardFilm } from "../components/card-film.tsx";

describe("card-film-media (extracted to lib)", () => {
  it("card-film's re-export is the same type", () => {
    const media: CardFilmMedia = { videoUrl: "v", posterUrl: "p", stillUrl: "s" };
    const viaOther: CardFilmMediaViaCardFilm = media;
    const back: CardFilmMedia = viaOther;
    assert.equal(back.videoUrl, "v");
  });
});
