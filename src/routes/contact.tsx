import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { InfoPage } from "@/components/grownups/info-page";
import { BootSplash } from "@/components/boot-splash";
import { getContactEndpoint, loadFlags } from "@/lib/flags";
import {
  buildContactPayload,
  CONTACT_MESSAGE_MAX,
  CONTACT_REPLY_TO_MAX,
  CONTACT_TOPICS,
  sendContact,
  type ContactDraft,
  type SendResult,
} from "@/lib/contact/contact-form";
import "@/components/age-profile/age-profile.css";

/**
 * /contact — "Contact us" for grown-ups, behind the existing math gate.
 *
 * WHY gated: owner decision 2026-10-21 — no email address is published;
 * grown-ups use this form instead, and the arithmetic gate (the same one
 * that guards the age setting, with its 3-strike cooldown) keeps children
 * from landing on a free-text box by accident. It is a speed bump, NOT a
 * verified parental-consent mechanism, and /privacy says so. The gate is
 * not stored as "passed": every visit asks again.
 *
 * ssr: false — the gate reads its cooldown from localStorage, so this page
 * is client-only (same reasoning as the "/" route).
 */
export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact us — Meridian" }] }),
  ssr: false,
  pendingComponent: BootSplash,
  component: ContactPage,
});

const GrownUpGate = lazy(() =>
  import("@/components/age-profile/GrownUpGate.tsx").then((m) => ({ default: m.GrownUpGate })),
);

function ContactPage() {
  const navigate = useNavigate();
  const [passed, setPassed] = useState(false);
  if (!passed) {
    return (
      <Suspense fallback={null}>
        <GrownUpGate onPass={() => setPassed(true)} onCancel={() => void navigate({ to: "/" })} />
      </Suspense>
    );
  }
  return <ContactForm />;
}

const EMPTY: ContactDraft = { topic: "", message: "", replyTo: "", website: "" };

function ContactForm() {
  const [draft, setDraft] = useState<ContactDraft>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const built = buildContactPayload(draft);
    if (!built.ok) {
      setProblems(built.problems);
      return;
    }
    setProblems([]);
    setSending(true);
    // The endpoint comes from flags.json (contactEndpoint) — null until the
    // owner switches /api/contact on, in which case we say so honestly.
    await loadFlags();
    const r = await sendContact(getContactEndpoint(), built.payload);
    setSending(false);
    setResult(r);
    if (r.status === "sent") setDraft(EMPTY);
  };

  return (
    <InfoPage title="Contact us">
      <p>
        For parents, carers, and teachers. Questions about privacy, a request about your data, or a
        bug report — we read every message. See our <Link to="/privacy">privacy notice</Link> for
        what this form sends, where messages go (a private Discord channel), and how long they are kept.
      </p>
      <p
        className="rounded-lg border border-line bg-surface p-4 text-base font-medium"
        role="note"
        data-testid="contact-kid-note"
      >
        🛑 Kids: please don&rsquo;t type your name, address, school, phone number, or any other
        personal details here. Ask a grown-up to help.
      </p>

      {result?.status === "sent" ? (
        <p role="status" data-testid="contact-sent">
          {result.stored
            ? "Thanks — your message was sent."
            : // NoopSink (no inbox connected yet): be honest rather than
              // let a grown-up wait for a reply that cannot come.
              "Thanks — we received it, but our contact inbox isn't connected yet, so nobody can read or answer it right now. Please check back soon."}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate data-testid="contact-form">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Topic</span>
          <select
            className="rounded-md border border-line bg-surface p-2"
            value={draft.topic}
            onChange={(e) => setDraft({ ...draft, topic: e.target.value as ContactDraft["topic"] })}
            required
          >
            <option value="">Choose a topic…</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Message</span>
          <textarea
            className="min-h-40 rounded-md border border-line bg-surface p-2"
            value={draft.message}
            maxLength={CONTACT_MESSAGE_MAX}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            required
          />
          <span className="text-sm text-muted">
            {draft.message.length}/{CONTACT_MESSAGE_MAX}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Reply-to email — for grown-ups only (optional)</span>
          <input
            type="email"
            className="rounded-md border border-line bg-surface p-2"
            value={draft.replyTo}
            maxLength={CONTACT_REPLY_TO_MAX}
            autoComplete="email"
            onChange={(e) => setDraft({ ...draft, replyTo: e.target.value })}
          />
          <span className="text-sm text-muted">
            Only if you&rsquo;d like an answer. Leave blank to send without it.
          </span>
        </label>

        {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
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
          <ul role="alert" className="text-red-700">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        {result && result.status !== "sent" ? (
          <p role="alert" data-testid="contact-error">
            {result.status === "not-configured"
              ? "The contact form isn't switched on yet. Please check back soon."
              : result.status === "rate-limited"
                ? "That's a lot of messages in a short time — please try again in a few minutes."
                : "We couldn't send that just now. Please try again later."}
          </p>
        ) : null}

        <button
          type="submit"
          className="self-start rounded-full bg-fg px-6 py-2 font-medium text-bg disabled:opacity-60"
          disabled={sending}
        >
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </InfoPage>
  );
}
