import type { MapStyle } from "../../game/types.ts";
import type { Colors } from "@/map/colors";
import type { Affine, View } from "@/map/view";

export type MapFrame = {
  cssWidth: number;
  cssHeight: number;
  ratio: number;
  /** True while a finger or wheel is moving a flat map. The basemap bitmap slides instead of being redrawn. */
  motion: boolean;
  transform: Affine;
  bakeKey: string;
  paintBasemap: (context: CanvasRenderingContext2D) => void;
  paintOverlay: (context: CanvasRenderingContext2D) => void;
  globe: {
    view: View;
    litId: string | null;
    lit: number;
    mapStyle: MapStyle;
    colors: Colors;
  } | null;
};

export interface MapPresenter {
  readonly mode: "webgpu" | "canvas";
  present(frame: MapFrame): void;
  destroy(): void;
}
