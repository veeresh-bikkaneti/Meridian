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
   * stored:false = the worker accepted it but no inbox is connected
   * (the CONTACT_DISCORD_WEBHOOK_URL secret is not set on the worker, so
   * the NoopSink fallback took it) — the page says so honestly and keeps
   * the visitor's draft. See sendOutcome().
   */
  | { status: "sent"; stored: boolean }
  | { status: "not-configured" }
  | { status: "rate-limited" }
  | { status: "error" };

/** What the page does with a SendResult — one decision, one place. */
export type SendOutcome = "delivered" | "not-delivered" | "not-configured" | "rate-limited" | "error";

/**
 * Map a SendResult to the page's outcome. This is the single source of
 * truth for the honesty contract (issue #220): "delivered" — and only
 * "delivered" — may show the thank-you and clear the draft. A "sent"
 * result with stored:false is "not-delivered": the visitor is told the
 * message could not be delivered and keeps every word they typed.
 */
export function sendOutcome(result: SendResult | null): SendOutcome | null {
  if (!result) return null;
  if (result.status === "sent") return result.stored ? "delivered" : "not-delivered";
  return result.status;
}

/** The slice of the shared transport port this form posts through.
 * Structural on purpose: this module is domain code and must not
 * import the platform layer. The page passes postText from the
 * browser transport; tests pass a fake transport's postText. */
export type ContactPost = (
  url: string,
  body: string,
  opts?: {
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    referrerPolicy?: ReferrerPolicy;
    retries?: number;
  },
) => Promise<{ status: number; text: string }>;

/** POST the payload through `post`. Never throws; maps server answers
 * to page states. No cookies and no referrer leave with the request.
 * A null endpoint fails closed (not-configured) and does not call
 * the transport. */
export async function sendContact(
  endpoint: string | null,
  payload: ContactPayload,
  post: ContactPost,
): Promise<SendResult> {
  if (!endpoint) return { status: "not-configured" };
  try {
    const res = await post(endpoint, JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      retries: 0,
    });
    if (res.status >= 200 && res.status < 300) {
      let stored = false;
      try {
        stored = (JSON.parse(res.text) as { stored?: unknown }).stored === true;
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
