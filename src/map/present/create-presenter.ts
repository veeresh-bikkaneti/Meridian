import { CanvasPresenter } from "./canvas-presenter.ts";
import type { MapPresenter } from "./types.ts";
import { WebGpuPresenter } from "./webgpu-presenter.ts";

export async function createPresenter(canvas: HTMLCanvasElement): Promise<MapPresenter> {
  try {
    const gpu = await WebGpuPresenter.create(canvas);
    if (gpu) return gpu;
  } catch {
    /* WebGPU is optional. The canvas presenter is the supported path. */
  }
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("map canvas unavailable");
  return new CanvasPresenter(canvas, context);
}
