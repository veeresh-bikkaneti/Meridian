/**
 * Grown-ups contact form — client-side model (pure, node-testable).
 *
 * The server (contact-handler.server.ts, mounted at /api/contact on the
 * main worker) is the authority and re-checks everything; these mirrors
 * exist so the page can give instant, friendly feedback and never sends a
 * payload the server would refuse. The handler imports the topic list and
 * limits from this file, so the two cannot drift.
 *
 * Privacy shape: the payload is exactly { topic, message, replyTo?,
 * website } — no ids, no device facts, no game state. `website` is the
 * honeypot (hidden from people, filled by bots).
 */

export const CONTACT_TOPICS = [
  { value: "privacy", label: "Privacy question" },
  { value: "delete-data", label: "Delete my data" },
  { value: "bug", label: "Something is broken (bug)" },
  { value: "other", label: "Something else" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export const CONTACT_MESSAGE_MAX = 1000;
export const CONTACT_REPLY_TO_MAX = 254;

export interface ContactDraft {
  topic: ContactTopic | "";
  message: string;
  replyTo: string;
  /** Honeypot: never shown to people. */
  website: string;
}

export type ContactPayload = {
  topic: ContactTopic;
  message: string;
  replyTo?: string;
  website: string;
};

const EMAIL_SHAPE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Validate a draft; returns the payload or a list of grown-up-readable problems. */
export function buildContactPayload(
  draft: ContactDraft,
): { ok: true; payload: ContactPayload } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const topic = CONTACT_TOPICS.find((t) => t.value === draft.topic)?.value;
  if (!topic) problems.push("Pick a topic.");
  const message = draft.message.trim();
  if (!message) problems.push("Write a short message.");
  else if (message.length > CONTACT_MESSAGE_MAX) problems.push(`Keep the message under ${CONTACT_MESSAGE_MAX} characters.`);
  const replyTo = draft.replyTo.trim();
  if (replyTo && (replyTo.length > CONTACT_REPLY_TO_MAX || !EMAIL_SHAPE.test(replyTo))) {
    problems.push("The reply-to address doesn't look like an email address.");
  }
  if (problems.length > 0 || !topic) return { ok: false, problems };
  return {
    ok: true,
    payload: { topic, message, ...(replyTo ? { replyTo } : {}), website: draft.website },
  };
}

export type SendResult =
  /**
   * stored:false = the worker accepted it but no inbox is connected yet
   * (NoopSink, owner decision 2026-10-21) — the page must say so.
   */
  | { status: "sent"; stored: boolean }
  | { status: "not-configured" }
  | { status: "rate-limited" }
  | { status: "error" };

/** POST the payload. Never throws; maps server answers to page states. */
export async function sendContact(
  endpoint: string | null,
  payload: ContactPayload,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = (u, i) => fetch(u, i),
): Promise<SendResult> {
  if (!endpoint) return { status: "not-configured" };
  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // No cookies or credentials ever ride along.
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (res.ok) {
      let stored = false;
      try {
        stored = ((await res.json()) as { stored?: unknown }).stored === true;
      } catch {
        stored = false;
      }
      return { status: "sent", stored };
    }
    if (res.status === 503 || res.status === 404) return { status: "not-configured" };
    if (res.status === 429) return { status: "rate-limited" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}
