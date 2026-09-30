import { geoInterpolate } from "d3-geo";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LonLat, MapStyle, RingId } from "../game/types.ts";
import { counties } from "../map/atlas-data.ts";
import { readColors } from "../map/colors.ts";
import { GestureController, nearPin, TOUCH_LIFT, type GestureEffect, type PointerKind } from "../map/gesture.ts";
import { locateCounty, locateHighlight } from "../map/highlight.ts";
import { smoothstep, spring01 } from "../map/motion.ts";
import { paintBasemap, paintOverlay } from "../map/paint-scene.ts";
import { createPresenter } from "../map/present/create-presenter.ts";
import type { MapPresenter } from "../map/present/types.ts";
import { affineTransform, cloneView, fitView, invertView, panView, projectView, type View } from "../map/view.ts";

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* some browsers throw if vibration is blocked */
  }
}

export function AtlasMap({
  roundId,
  scope,
  mapStyle,
  pending,
  lockedGuess,
  answer,
  revealed,
  reducedMotion,
  interactive,
  onPick,
  onConfirm,
  theme,
}: {
  roundId: string;
  scope: RingId;
  mapStyle: MapStyle;
  pending: LonLat | null;
  lockedGuess: LonLat | null;
  answer: LonLat | null;
  revealed: boolean;
  reducedMotion: boolean;
  interactive: boolean;
  theme: string;
  onPick: (at: LonLat) => void;
  onConfirm: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({
    roundId,
    scope,
    mapStyle,
    pending,
    lockedGuess,
    answer,
    revealed,
    reducedMotion,
    interactive,
    theme,
    onPick,
    onConfirm,
  });
  propsRef.current = {
    roundId,
    scope,
    mapStyle,
    pending,
    lockedGuess,
    answer,
    revealed,
    reducedMotion,
    interactive,
    theme,
    onPick,
    onConfirm,
  };

  const viewRef = useRef<View | null>(null);
  const bakedViewRef = useRef<View | null>(null);
  const fitKey = useRef("");
  const arcRef = useRef(revealed ? 1 : 0);
  const litRef = useRef<string | null>(null);
  const pinStamp = useRef(0);
  const pinKey = useRef("");
  const answerStamp = useRef(0);
  const keyboardRef = useRef(false);
  const motionRef = useRef(false);
  const aimRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const dragPinRef = useRef<LonLat | null>(null);
  const basemapDirty = useRef(false);
  const drawRef = useRef<() => void>(() => {});
  const requestDrawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const wheelTimer = useRef(0);
  const [ready, setReady] = useState(false);
  const [renderer, setRenderer] = useState<"canvas" | "webgpu" | "">("");

  requestDrawRef.current = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let dead = false;
    let presenter: MapPresenter | null = null;

    const draw = () => {
      if (!presenter || !stageRef.current) return;
      const box = stageRef.current;
      const props = propsRef.current;
      const width = box.clientWidth;
      const height = box.clientHeight;
      if (width < 2 || height < 2) return;
      const key = `${props.roundId}:${props.scope}:${Math.round(width)}x${Math.round(height)}`;
      if (!viewRef.current || fitKey.current !== key) {
        viewRef.current = fitView(props.scope, width, height);
        fitKey.current = key;
        arcRef.current = props.revealed ? 1 : 0;
        bakedViewRef.current = null;
      }
      const view = viewRef.current;
      view.width = width;
      view.height = height;
      const colors = readColors();
      const bakeKey = [
        props.scope,
        props.mapStyle,
        props.theme,
        key,
        litRef.current ?? "",
        colors.land,
        colors.water,
        colors.road,
      ].join("|");
      let transform = { k: 1, ox: 0, oy: 0 };
      let motion = false;
      if (motionRef.current && props.scope !== "world" && bakedViewRef.current && !basemapDirty.current) {
        const affine = affineTransform(bakedViewRef.current, view);
        if (
          affine &&
          Math.abs(affine.ox) < width * 0.45 &&
          Math.abs(affine.oy) < height * 0.45 &&
          affine.k < 1.55 &&
          affine.k > 0.66
        ) {
          motion = true;
          transform = affine;
        }
      }
      const pinAnimating = pinStamp.current > 0 && performance.now() - pinStamp.current < 760;
      const decor =
        Boolean(aimRef.current || hoverRef.current || dragPinRef.current) || (pinAnimating && !props.revealed);
      if (!motion && !props.revealed && props.scope !== "world" && bakedViewRef.current && decor && !basemapDirty.current) {
        motion = true;
        transform = { k: 1, ox: 0, oy: 0 };
      }
      if (basemapDirty.current) {
        motion = false;
        basemapDirty.current = false;
      }
      if (!motion) bakedViewRef.current = cloneView(view);

      const pendingKey = props.pending ? `${props.pending[0]},${props.pending[1]}` : "";
      if (pinKey.current !== pendingKey) {
        pinKey.current = pendingKey;
        pinStamp.current = props.pending ? (props.reducedMotion ? performance.now() - 2000 : performance.now()) : 0;
      }
      const guess = dragPinRef.current ?? props.lockedGuess ?? props.pending;
      const pinDrop = dragPinRef.current
        ? 1
        : props.reducedMotion || !pinStamp.current
          ? 1
          : spring01((performance.now() - pinStamp.current) / 1000);
      const answerDrop =
        props.revealed && answerStamp.current
          ? props.reducedMotion
            ? 1
            : spring01((performance.now() - answerStamp.current) / 1000)
          : 0;

      try {
        presenter.present({
          cssWidth: width,
          cssHeight: height,
          ratio: Math.min(window.devicePixelRatio || 1, 2),
          motion,
          transform,
          bakeKey,
          globe:
            presenter.mode === "webgpu" && props.scope === "world"
              ? {
                  view,
                  litId: litRef.current,
                  lit: smoothstep((arcRef.current - 0.42) / 0.45),
                  mapStyle: props.mapStyle,
                  colors,
                }
              : null,
          paintBasemap: (ctx) => paintBasemap(ctx, view, props.scope, props.mapStyle, litRef.current, arcRef.current),
          paintOverlay: (ctx) =>
            paintOverlay(ctx, {
              view,
              guess,
              answer: props.answer,
              revealed: props.revealed,
              arc: arcRef.current,
              pinDrop,
              answerDrop,
              showCrosshair: keyboardRef.current && props.interactive,
              ghost: aimRef.current,
              hover: aimRef.current ? null : hoverRef.current,
            }),
        });
      } catch {
        /* a dropped frame beats a dead map */
      }
    };

    drawRef.current = draw;
    const observer = new ResizeObserver(() => draw());
    observer.observe(stage);
    createPresenter(canvas).then((next) => {
      if (dead) {
        next.destroy();
        return;
      }
      presenter = next;
      setRenderer(next.mode);
      setReady(true);
      draw();
    });
    return () => {
      dead = true;
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      presenter?.destroy();
    };
  }, []);

  useEffect(() => {
    if (ready) requestDrawRef.current();
  }, [ready, roundId, scope, mapStyle, theme, pending, revealed, lockedGuess, answer, interactive]);

  useEffect(() => {
    if (scope !== "nebraska" && scope !== "region") return;
    let alive = true;
    counties().then(() => {
      if (!alive) return;
      basemapDirty.current = true;
      requestDrawRef.current();
    });
    return () => {
      alive = false;
    };
  }, [scope]);

  useEffect(() => {
    if (!pending) return;
    pinStamp.current = reducedMotion ? performance.now() - 2000 : performance.now();
    if (reducedMotion) {
      requestDrawRef.current();
      return;
    }
    let frame = 0;
    const start = pinStamp.current;
    const tick = (now: number) => {
      requestDrawRef.current();
      if (now - start < 700) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pending, reducedMotion]);

  useEffect(() => {
    if (!revealed || !answer) {
      arcRef.current = 0;
      answerStamp.current = 0;
      litRef.current = null;
      requestDrawRef.current();
      return;
    }
    if (scope === "world" || scope === "usa") litRef.current = locateHighlight(scope, answer);
    else if (scope === "nebraska") {
      locateCounty(answer).then((id) => {
        litRef.current = id;
        requestDrawRef.current();
      });
    }
    const view = viewRef.current;
    if (!view || !ready) return;
    const fromCenter = view.center;
    const fromScale = view.scale;
    const boost = scope === "world" ? 4 : scope === "usa" ? 3 : scope === "nebraska" ? 2.5 : scope === "region" ? 2.2 : 2.05;
    const toScale = Math.min(view.maxScale, Math.max(fromScale, view.baseScale * boost));
    const interpolate = geoInterpolate(fromCenter, answer);
    if (reducedMotion) {
      view.center = answer;
      view.scale = toScale;
      arcRef.current = 1;
      answerStamp.current = performance.now() - 2000;
      motionRef.current = false;
      requestDrawRef.current();
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 1650;
    answerStamp.current = 0;
    motionRef.current = false;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const current = viewRef.current;
      if (!current) return;
      const pull = 0.2;
      let along = 0;
      let scale = fromScale;
      if (t < pull) {
        const u = smoothstep(t / pull);
        along = 0.05 * u;
        scale = fromScale * (1 - 0.08 * u);
      } else {
        const u = smoothstep((t - pull) / (1 - pull));
        along = 0.05 + 0.95 * u;
        const dipped = fromScale * 0.92;
        scale = dipped + (toScale - dipped) * u;
      }
      current.center = interpolate(along) as LonLat;
      current.scale = scale;
      arcRef.current = smoothstep((t - 0.06) / 0.8);
      if (t > 0.52 && answerStamp.current === 0) answerStamp.current = now;
      drawRef.current();
      const answering = answerStamp.current > 0 && now - answerStamp.current < 700;
      if (t < 1 || answering) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [answer, ready, reducedMotion, revealed, roundId, scope]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gestures = new GestureController(() => {
      const view = viewRef.current;
      return { width: view?.width ?? canvas.clientWidth, height: view?.height ?? canvas.clientHeight };
    });

    const pointOf = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const kindOf = (type: string): PointerKind => (type === "touch" ? "touch" : type === "pen" ? "pen" : "mouse");

    const hitsPin = (x: number, y: number, kind: PointerKind) => {
      const view = viewRef.current;
      const at = dragPinRef.current ?? propsRef.current.pending;
      if (!view || !at) return false;
      const xy = projectView(view, at);
      if (!xy) return false;
      const lift = kind === "mouse" ? 0 : TOUCH_LIFT;
      return nearPin(x, y, xy[0], xy[1]) || nearPin(x, y - lift, xy[0], xy[1]);
    };

    const settle = () => {
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        motionRef.current = false;
        requestDrawRef.current();
      }, 140);
    };

    const apply = (effects: GestureEffect[]) => {
      const view = viewRef.current;
      const props = propsRef.current;
      if (!view) return;
      for (const effect of effects) {
        if (effect.type === "aim") aimRef.current = { x: effect.x, y: effect.y };
        else if (effect.type === "clear-aim") aimRef.current = null;
        else if (effect.type === "pan") {
          motionRef.current = view.mode !== "globe";
          dragPinRef.current = null;
          panView(view, effect.dx, effect.dy);
        } else if (effect.type === "zoom") {
          motionRef.current = view.mode !== "globe";
          view.scale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * effect.factor));
        } else if (effect.type === "drag-pin") {
          const at = invertView(view, effect.x, effect.y);
          if (at) dragPinRef.current = at;
          aimRef.current = null;
        } else if (effect.type === "place") {
          const at = invertView(view, effect.x, effect.y);
          dragPinRef.current = null;
          aimRef.current = null;
          motionRef.current = false;
          if (at) {
            buzz(12);
            props.onPick(at);
          }
        } else if (effect.type === "confirm") {
          dragPinRef.current = null;
          aimRef.current = null;
          buzz(18);
          props.onConfirm();
        }
      }
      requestDrawRef.current();
    };

    const onDown = (event: PointerEvent) => {
      if (!propsRef.current.interactive) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      const here = pointOf(event);
      hoverRef.current = null;
      const kind = kindOf(event.pointerType);
      apply(gestures.down(event.pointerId, here.x, here.y, kind, hitsPin(here.x, here.y, kind)));
    };
    const onMove = (event: PointerEvent) => {
      const here = pointOf(event);
      if (!propsRef.current.interactive) return;
      if (event.buttons === 0 && event.pointerType === "mouse") {
        hoverRef.current = here;
        requestDrawRef.current();
        return;
      }
      apply(gestures.move(event.pointerId, here.x, here.y));
    };
    const onUp = (event: PointerEvent) => {
      const here = pointOf(event);
      apply(gestures.up(event.pointerId, here.x, here.y));
      motionRef.current = false;
      requestDrawRef.current();
    };
    const onCancel = (event: PointerEvent) => {
      apply(gestures.cancel(event.pointerId));
      motionRef.current = false;
      dragPinRef.current = null;
      requestDrawRef.current();
    };
    const onWheel = (event: WheelEvent) => {
      if (!propsRef.current.interactive || !viewRef.current) return;
      event.preventDefault();
      const view = viewRef.current;
      motionRef.current = view.mode !== "globe";
      view.scale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * Math.exp(-event.deltaY * 0.0011)));
      requestDrawRef.current();
      settle();
    };
    const onLeave = () => {
      hoverRef.current = null;
      requestDrawRef.current();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheelTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!propsRef.current.interactive) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const view = viewRef.current;
      if (!view) return;
      const step = event.shiftKey ? 48 : 28;
      const slide = (dx: number, dy: number) => {
        motionRef.current = view.mode !== "globe";
        panView(view, dx, dy);
        requestDrawRef.current();
        window.clearTimeout(wheelTimer.current);
        wheelTimer.current = window.setTimeout(() => {
          motionRef.current = false;
          requestDrawRef.current();
        }, 140);
      };
      if (event.key === "ArrowLeft") slide(step, 0);
      else if (event.key === "ArrowRight") slide(-step, 0);
      else if (event.key === "ArrowUp") slide(0, -step);
      else if (event.key === "ArrowDown") slide(0, step);
      else if (event.key === "+" || event.key === "=") nudge(1.2);
      else if (event.key === "-" || event.key === "_") nudge(1 / 1.2);
      else if (event.key === "Enter") {
        keyboardRef.current = true;
        if (propsRef.current.pending) propsRef.current.onConfirm();
        else propsRef.current.onPick(view.center);
      } else return;
      keyboardRef.current = true;
      event.preventDefault();
    };
    const nudge = (factor: number) => {
      const view = viewRef.current;
      if (!view) return;
      motionRef.current = view.mode !== "globe";
      view.scale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * factor));
      requestDrawRef.current();
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        motionRef.current = false;
        requestDrawRef.current();
      }, 140);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function nudge(factor: number) {
    const view = viewRef.current;
    if (!view || !interactive) return;
    motionRef.current = view.mode !== "globe";
    view.scale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * factor));
    requestDrawRef.current();
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      motionRef.current = false;
      requestDrawRef.current();
    }, 140);
  }

  function reset() {
    const view = viewRef.current;
    if (!view || !interactive) return;
    const fitted = fitView(scope, view.width, view.height);
    view.center = fitted.center;
    view.scale = fitted.scale;
    motionRef.current = false;
    bakedViewRef.current = null;
    requestDrawRef.current();
  }

  const engine = renderer === "webgpu" ? "WebGPU" : renderer === "canvas" ? "Canvas" : "";

  return (
    <div ref={stageRef} className="relative h-full min-h-0 w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-none"
        role="application"
        aria-label="Label-free map. Press to aim a pin, release to drop it. Drag the pin to adjust, tap it to confirm. Arrow keys move the view, Enter drops a pin at the center, and Enter again confirms."
      />
      <p className="pointer-events-none absolute bottom-3 left-3 max-w-[16rem] text-[10px] leading-snug text-muted">
        Natural Earth · © OpenStreetMap · Place data: GeoNames{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline"
        >
          CC-BY 4.0
        </a>
        {engine ? ` · ${engine}` : ""}
      </p>
      <div className="absolute right-3 bottom-3 flex flex-col gap-2">
        <Button variant="secondary" className="size-11 px-0" aria-label="Zoom in" onClick={() => nudge(1.25)}>
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" className="size-11 px-0" aria-label="Zoom out" onClick={() => nudge(1 / 1.25)}>
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" className="size-11 px-0" aria-label="Reset the map view" onClick={reset}>
          <LocateFixed className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
