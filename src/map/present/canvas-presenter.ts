import type { Affine } from "../view.ts";
import type { MapFrame, MapPresenter } from "./types.ts";

/**
 * Canvas path used when WebGPU is missing.
 * A still frame is painted directly so it stays crisp. While a finger or the wheel
 * is moving a flat map, that frame slides with drawImage and the vectors wait.
 */
export class CanvasPresenter implements MapPresenter {
  readonly mode = "canvas" as const;
  private readonly basemap: HTMLCanvasElement;
  private readonly basemapCtx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private bakeKey = "";
  private pixelWidth = 0;
  private pixelHeight = 0;

  constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.context = context;
    this.basemap = document.createElement("canvas");
    const ctx = this.basemap.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("basemap canvas unavailable");
    this.basemapCtx = ctx;
  }

  present(frame: MapFrame) {
    const { cssWidth, cssHeight, ratio } = frame;
    const pixelW = Math.max(1, Math.round(cssWidth * ratio));
    const pixelH = Math.max(1, Math.round(cssHeight * ratio));
    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.canvas.width = pixelW;
      this.canvas.height = pixelH;
    }
    const crisp = !frame.motion || this.bakeKey !== frame.bakeKey || this.pixelWidth === 0;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.imageSmoothingEnabled = true;
    if (crisp) {
      frame.paintBasemap(this.context);
      this.snapshot(pixelW, pixelH);
      this.bakeKey = frame.bakeKey;
    } else {
      this.blit(frame.transform, cssWidth, cssHeight, ratio);
    }
    frame.paintOverlay(this.context);
  }

  private snapshot(pixelW: number, pixelH: number) {
    if (this.pixelWidth !== pixelW || this.pixelHeight !== pixelH) {
      this.basemap.width = pixelW;
      this.basemap.height = pixelH;
      this.pixelWidth = pixelW;
      this.pixelHeight = pixelH;
    }
    this.basemapCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.basemapCtx.drawImage(this.canvas, 0, 0);
  }

  private blit(transform: Affine, cssWidth: number, cssHeight: number, ratio: number) {
    const { context } = this;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.save();
    context.translate(cssWidth / 2, cssHeight / 2);
    context.translate(transform.ox, transform.oy);
    context.scale(transform.k, transform.k);
    context.translate(-cssWidth / 2, -cssHeight / 2);
    context.drawImage(this.basemap, 0, 0, cssWidth, cssHeight);
    context.restore();
  }

  destroy() {
    this.bakeKey = "";
  }
}
