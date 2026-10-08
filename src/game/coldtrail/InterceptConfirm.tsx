import { useEffect, type JSX } from "react";
import { Button } from "@/components/ui/button";

/**
 * The interception commit sheet: the player tapped the map; this confirms
 * the one-shot guess before the score is computed. Mirrors the loop
 * edition's PlaceSheet dialog idiom (Escape cancels, backdrop cancels).
 */
export function InterceptConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm interception"
      data-testid="intercept-confirm"
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Cancel — keep studying the rings"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        className="relative flex w-full max-w-md flex-col rounded-t-3xl border border-line bg-surface"
        style={{ maxHeight: "min(45dvh, 20rem)", overscrollBehavior: "contain" }}
      >
        <div className="shrink-0 px-6 pt-3">
          <div className="sheet-handle" aria-hidden="true" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <div className="px-6 pt-2">
            <p className="text-[11px] tracking-wider text-muted uppercase">Interception</p>
            <h2 className="mt-1 text-xl font-semibold text-fg">Send the team here?</h2>
            <p className="mt-1 text-sm text-muted">
              One shot — the smuggler moves on after this. Score is your distance
              from the true hideout.
            </p>
          </div>
          <div
            className="shrink-0 border-t border-line px-6 pt-4"
            style={{
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
              background: "var(--game-chrome-solid)",
            }}
          >
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                data-testid="intercept-confirm-btn"
                onClick={onConfirm}
                className="min-h-[48px] w-full text-base"
              >
                🚨 Intercept here
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="min-h-[48px] w-full"
              >
                Not yet
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
