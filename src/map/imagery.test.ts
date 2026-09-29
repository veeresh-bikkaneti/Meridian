import assert from "node:assert/strict";
import test from "node:test";
import { IMAGERY_ATTRIBUTION, IMAGERY_NOTICE, IMAGERY_TILES, imageryView } from "./imagery.ts";

test("imagery is the live Esri satellite endpoint", () => {
  assert.equal(
    IMAGERY_TILES,
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  );
  assert.equal(
    IMAGERY_ATTRIBUTION,
    "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  );
  assert.match(IMAGERY_NOTICE, /imagery host sees the area on screen/i);
  assert.equal(imageryView("flat").projection, "mercator");
  assert.equal(imageryView("globe").projection, "globe");
  assert.equal(imageryView("globe").tiles, IMAGERY_TILES);
});
