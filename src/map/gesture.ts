export const MOUSE_SLOP = 7;
export const TOUCH_SLOP = 14;
/** Touch lands above the fingertip so the pin stays visible. */
export const TOUCH_LIFT = 42;

export type PointerKind = "mouse" | "touch" | "pen";

export type GestureEffect =
  | { type: "aim"; x: number; y: number }
  | { type: "clear-aim" }
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; factor: number }
  | { type: "place"; x: number; y: number }
  | { type: "confirm" }
  | { type: "drag-pin"; x: number; y: number };

type Point = { x: number; y: number; kind: PointerKind };

function aimPoint(point: Point, width: number, height: number) {
  const lift = point.kind === "mouse" ? 0 : TOUCH_LIFT;
  return {
    x: Math.max(0, Math.min(width, point.x)),
    y: Math.max(0, Math.min(height, point.y - lift)),
  };
}

/**
 * Pointer gestures for the map. The class knows screen points only —
 * the caller turns a place/drag into longitude and latitude.
 */
export class GestureController {
  private pointers = new Map<number, Point>();
  private mode: "idle" | "press" | "pan" | "pin" | "pinch" = "idle";
  private origin: Point | null = null;
  private pinch = 0;
  private activeId = 0;
  private readonly size: () => { width: number; height: number };

  constructor(size: () => { width: number; height: number }) {
    this.size = size;
  }

  down(id: number, x: number, y: number, kind: PointerKind, hitsPin: boolean): GestureEffect[] {
    const point = { x, y, kind };
    this.pointers.set(id, point);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.mode = "pinch";
      return [{ type: "clear-aim" }];
    }
    if (this.pointers.size > 2) return [];
    this.mode = hitsPin ? "pin" : "press";
    this.origin = point;
    this.activeId = id;
    const { width, height } = this.size();
    const aim = aimPoint(point, width, height);
    return this.mode === "pin" ? [{ type: "drag-pin", ...aim }] : [{ type: "aim", ...aim }];
  }

  move(id: number, x: number, y: number): GestureEffect[] {
    const previous = this.pointers.get(id);
    if (!previous) return [];
    const next = { x, y, kind: previous.kind };
    this.pointers.set(id, next);
    if (this.mode === "pinch" && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const factor = distance / this.pinch;
      this.pinch = distance;
      return [{ type: "zoom", factor }];
    }
    if (id !== this.activeId || !this.origin) return [];
    const { width, height } = this.size();
    const aim = aimPoint(next, width, height);
    const slop = next.kind === "mouse" ? MOUSE_SLOP : TOUCH_SLOP;
    const travel = Math.hypot(next.x - this.origin.x, next.y - this.origin.y);
    if (this.mode === "press" && travel > slop) this.mode = "pan";
    if (this.mode === "pan") {
      return [
        { type: "pan", dx: next.x - previous.x, dy: next.y - previous.y },
        { type: "clear-aim" },
      ];
    }
    if (this.mode === "pin") return [{ type: "drag-pin", ...aim }];
    return [{ type: "aim", ...aim }];
  }

  up(id: number, x: number, y: number): GestureEffect[] {
    const previous = this.pointers.get(id);
    this.pointers.delete(id);
    if (this.mode === "pinch") {
      if (this.pointers.size < 2) {
        this.mode = "idle";
        this.origin = null;
      }
      return [{ type: "clear-aim" }];
    }
    if (!previous || id !== this.activeId || !this.origin) {
      if (this.pointers.size === 0) this.mode = "idle";
      return [];
    }
    const slop = previous.kind === "mouse" ? MOUSE_SLOP : TOUCH_SLOP;
    const travel = Math.hypot(x - this.origin.x, y - this.origin.y);
    const mode = this.mode;
    this.mode = "idle";
    this.origin = null;
    const { width, height } = this.size();
    const aim = aimPoint({ x, y, kind: previous.kind }, width, height);
    if (mode === "pan" || (mode === "press" && travel > slop)) return [{ type: "clear-aim" }];
    if (mode === "pin") {
      if (travel > slop) return [{ type: "place", ...aim }, { type: "clear-aim" }];
      return [{ type: "confirm" }, { type: "clear-aim" }];
    }
    return [{ type: "place", ...aim }, { type: "clear-aim" }];
  }

  cancel(id: number): GestureEffect[] {
    this.pointers.delete(id);
    if (this.pointers.size === 0) {
      this.mode = "idle";
      this.origin = null;
    }
    return [{ type: "clear-aim" }];
  }
}

export function nearPin(x: number, y: number, pinX: number, pinY: number) {
  const tip = Math.hypot(x - pinX, y - pinY) < 44;
  const head = Math.hypot(x - pinX, y - (pinY - 18)) < 36;
  return tip || head;
}
