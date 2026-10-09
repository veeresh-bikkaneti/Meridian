/**
 * GrownUpGate.tsx — the arithmetic parent gate (Phase 2 §1b).
 *
 * A two-digit multiplication question ("What is 14 × 17?") with a numeric
 * keypad. Fully offline, local, no PII, no network. 3 failed attempts → a
 * 60s cooldown (never a hard lockout); "Try another question" regenerates
 * for parents who need a fresh one. Keyboard entry works on desktop.
 *
 * Cooldown persistence (see cooldown.ts): the cooldown deadline is stored
 * as one timestamp in localStorage, so a remount during the cooldown
 * resumes the live countdown instead of resetting it. One timestamp,
 * zero PII — COPPA-safe.
 *
 * Telemetry (local-only): emits `grownup_gate.attempt` style payloads via
 * onAttempt(result, attempts) — the parent callback must never log the
 * answer value.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearCooldown, readCooldown, writeCooldown } from "./cooldown.ts";

const MAX_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 60;

export interface GrownUpGateProps {
  /** Called with true when the parent passes. */
  onPass: () => void;
  /** Called when the parent cancels (returns to the origin surface). */
  onCancel: () => void;
  /** Local-only attempt hook: (result, attempts) — never the answer value. */
  onAttempt?: (result: "pass" | "fail", attempts: number) => void;
}

interface GateQuestion {
  a: number;
  b: number;
}

function newQuestion(): GateQuestion {
  // Two-digit operands: blocks pre-readers/early-grade kids reliably
  // (the COPPA-canon arithmetic barrier).
  const r = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
  return { a: r(11, 19), b: r(12, 29) };
}

export function GrownUpGate({ onPass, onCancel, onAttempt }: GrownUpGateProps) {
  const [question, setQuestion] = useState<GateQuestion>(newQuestion);
  const [digits, setDigits] = useState("");
  const [fails, setFails] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Resume a cooldown started before a remount (persisted deadline), or
  // start un-cooled. readCooldown() self-clears expired/malformed keys.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(() => readCooldown());
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const answer = useMemo(() => question.a * question.b, [question]);
  const cooling = cooldownUntil !== null;

  useEffect(() => {
    // Mount-time focus: when resuming a persisted cooldown the answer input
    // isn't rendered — focus the cancel button instead so focus never lands
    // on <body>.
    if (cooldownUntil !== null) cancelRef.current?.focus();
    else inputRef.current?.focus();
    // Mount-only by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownUntil(null);
        setCooldownLeft(0);
        setFails(0);
        setQuestion(newQuestion());
        setDigits("");
        setError(null);
        // Expiry leaves no key behind — a pass can't resurrect the cooldown.
        clearCooldown();
      } else {
        setCooldownLeft(left);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const pressKey = useCallback(
    (key: string) => {
      if (cooling) return;
      setError(null);
      if (key === "back") {
        setDigits((d) => d.slice(0, -1));
      } else if (key === "clear") {
        setDigits("");
      } else if (/^[0-9]$/.test(key) && digits.length < 4) {
        setDigits((d) => d + key);
      }
    },
    [cooling, digits.length],
  );

  // Physical keyboard entry (desktop accessibility path).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") pressKey(e.key);
      else if (e.key === "Backspace") pressKey("back");
      else if (e.key === "Enter") {
        // A focused button fires its own click on Enter — running check()
        // here as well would double-count (e.g. Enter on "Try another
        // question" would log a spurious fail before regenerating).
        if (e.target instanceof HTMLButtonElement) return;
        checkRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressKey]);

  const check = useCallback(() => {
    if (cooling || digits.length === 0) return;
    const given = Number(digits);
    if (given === answer) {
      onAttempt?.("pass", fails + 1);
      onPass();
      return;
    }
    const nextFails = fails + 1;
    setFails(nextFails);
    onAttempt?.("fail", nextFails);
    if (nextFails >= MAX_ATTEMPTS) {
      // A 4th submit during cooldown is silently ignored: check() already
      // returns early when `cooling` — keep that guard.
      const until = Date.now() + COOLDOWN_SECONDS * 1000;
      writeCooldown(until);
      setCooldownUntil(until);
      setError(`Take a breath — try again in a minute.`);
    } else {
      setError(`Not quite — try again. (${MAX_ATTEMPTS - nextFails} ${nextFails === MAX_ATTEMPTS - 1 ? "try" : "tries"} left)`);
      setDigits("");
    }
  }, [cooling, digits, answer, fails, onAttempt, onPass]);
  const checkRef = useRef(check);
  checkRef.current = check;

  const regenerate = useCallback(() => {
    setQuestion(newQuestion());
    setDigits("");
    setError(null);
  }, []);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grownup-gate-title"
      className="agep-screen"
      data-testid="grownup-gate"
    >
      <button
        type="button"
        ref={cancelRef}
        className="agep-cancel"
        onClick={onCancel}
        aria-label="Cancel and go back"
      >
        ×
      </button>
      <h1 id="grownup-gate-title" className="agep-h1">
        For grown-ups
      </h1>
      <p className="agep-sub">One quick question so little players can&apos;t change this by accident.</p>

      {cooling ? (
        <div className="agep-cooldown" role="status">
          <p>Take a breath — try again in {cooldownLeft} seconds.</p>
          <p className="agep-fine">Three wrong answers start a one-minute pause. There&apos;s no permanent lockout.</p>
        </div>
      ) : (
        <>
          <p className="agep-question" aria-live="polite">
            What is {question.a} × {question.b}?
          </p>
          <input
            ref={inputRef}
            className="agep-answer"
            value={digits}
            readOnly
            inputMode="none"
            aria-label={`Your answer to ${question.a} times ${question.b}`}
            data-testid="gate-answer"
          />
          {error ? (
            <p className="agep-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="agep-keypad" role="group" aria-label="Number keypad">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className="agep-key"
                onClick={() => pressKey(k)}
                aria-label={k === "back" ? "Delete last digit" : k === "clear" ? "Clear answer" : `Digit ${k}`}
              >
                {k === "back" ? "⌫" : k === "clear" ? "C" : k}
              </button>
            ))}
          </div>
          <div className="agep-actions">
            <button
              type="button"
              className="agep-primary"
              onClick={check}
              disabled={digits.length === 0}
              data-testid="gate-check"
            >
              Check answer
            </button>
            <button type="button" className="agep-ghost" onClick={regenerate}>
              Try another question
            </button>
          </div>
        </>
      )}
    </div>
  );
}
