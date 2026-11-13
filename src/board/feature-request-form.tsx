import { useEffect, useRef, useState, type FormEvent } from "react";
import { getFeatureRequestEndpoint, getFeatureTurnstileSiteKey, loadFlags } from "@/lib/flags";
import {
  buildFeatureRequestPayload,
  FEATURE_AGE_GROUPS,
  FEATURE_IDEA_MAX,
  FEATURE_SUBJECTS,
  sendFeatureRequest,
  type FeatureRequestDraft,
  type FeatureSendResult,
} from "@/lib/feature-request/feature-request-form";

/**
 * "For parents and teachers: suggest a feature" — the grown-ups-only
 * feature-request form. It lives only on /board, never in the game.
 *
 * Turnstile: when the owner has configured a site key in flags.json,
 * the Cloudflare Turnstile widget is loaded and its token is sent with
 * the request; the server verifies it. No name, email, school, or
 * location fields exist on this form, by design.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void },
      ) => string;
    };
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  turnstileScriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

const EMPTY: FeatureRequestDraft = { idea: "", ageGroup: "", subject: "", website: "" };

export function FeatureRequestForm() {
  const [draft, setDraft] = useState<FeatureRequestDraft>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<FeatureSendResult | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const tokenRef = useRef("");
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    loadFlags().then(() => {
      if (active) setSiteKey(getFeatureTurnstileSiteKey());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;
    let active = true;
    loadTurnstileScript()
      .then(() => {
        if (!active || !widgetRef.current || !window.turnstile) return;
        window.turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            tokenRef.current = token;
          },
        });
      })
      .catch(() => {
        // Widget unavailable (offline, or the CSP has not been widened
        // for challenges.cloudflare.com yet): the form still renders,
        // and the server stays fail-closed.
      });
    return () => {
      active = false;
    };
  }, [siteKey]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const built = buildFeatureRequestPayload(draft, tokenRef.current);
    if (!built.ok) {
      setProblems(built.problems);
      return;
    }
    setProblems([]);
    setResult(null);
    setSending(true);
    await loadFlags();
    const r = await sendFeatureRequest(getFeatureRequestEndpoint(), built.payload);
    setSending(false);
    setResult(r);
    if (r.status === "sent") setDraft(EMPTY);
  };

  return (
    <section className="board-section" aria-labelledby="board-feature-heading">
      <h2 id="board-feature-heading">For parents and teachers: suggest a feature</h2>
      <p className="board-muted">
        Ideas from grown-ups go to the project owner. Nothing you send here is shown on this board.
      </p>

      <div role="status" className="empty:-mt-2">
        {result?.status === "sent" ? (
          <p className="board-notice" data-testid="feature-request-sent">
            Thanks — your idea was sent.
          </p>
        ) : null}
      </div>

      <form className="board-form" onSubmit={onSubmit} noValidate data-testid="feature-request-form">
        <label className="board-field">
          <span>Your idea</span>
          <textarea
            value={draft.idea}
            maxLength={FEATURE_IDEA_MAX}
            onChange={(e) => setDraft({ ...draft, idea: e.target.value })}
            required
            rows={4}
          />
          <span className="board-muted">
            {draft.idea.length}/{FEATURE_IDEA_MAX}
          </span>
        </label>
        <p className="board-notice">
          Please don&rsquo;t include names, school, email or where you live.
        </p>

        <label className="board-field">
          <span>Age group this is for</span>
          <select
            value={draft.ageGroup}
            onChange={(e) => setDraft({ ...draft, ageGroup: e.target.value as FeatureRequestDraft["ageGroup"] })}
            required
          >
            <option value="">Choose an age group…</option>
            {FEATURE_AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label className="board-field">
          <span>Subject</span>
          <select
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value as FeatureRequestDraft["subject"] })}
            required
          >
            <option value="">Choose a subject…</option>
            {FEATURE_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {siteKey ? <div ref={widgetRef} data-testid="turnstile-widget" /> : null}

        {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
        >
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
          </label>
        </div>

        {problems.length > 0 ? (
          <div role="alert">
            <ul className="board-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div role="alert" className="empty:-mt-2">
          {result && result.status !== "sent" ? (
            <p data-testid="feature-request-error">
              {result.status === "not-open"
                ? "Feature requests are not open yet."
                : result.status === "rate-limited"
                  ? "That's a lot of requests in a short time — please try again in a few minutes."
                  : "We couldn't send that just now. Please try again later."}
            </p>
          ) : null}
        </div>

        <button type="submit" className="board-submit" disabled={sending}>
          {sending ? "Sending…" : "Send idea"}
        </button>
      </form>
    </section>
  );
}
