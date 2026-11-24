/**
 * Feature-request form — client-side model (pure, node-testable), mirroring
 * src/lib/contact/contact-form.ts. The server handler is the authority and
 * re-checks everything; these mirrors give instant feedback and keep the
 * page from sending a payload the server would refuse.
 *
 * Privacy shape: the payload is exactly
 * { idea, ageGroup, subject, turnstileToken, website } — no name, email,
 * school, or location, ever. `website` is the honeypot (as in contact).
 */

export const FEATURE_IDEA_MAX = 500;

export const FEATURE_AGE_GROUPS = [
  { value: "7-10", label: "7–10" },
  { value: "10-18", label: "10–18" },
  { value: "18+", label: "18+ (grown-up)" },
] as const;
export type FeatureAgeGroup = (typeof FEATURE_AGE_GROUPS)[number]["value"];

export const FEATURE_SUBJECTS = [
  "Geography",
  "Math",
  "Physics",
  "Chemistry",
  "Social studies",
  "General knowledge",
  "Journals",
  "Audio and stories",
  "Something else",
] as const;
export type FeatureSubject = (typeof FEATURE_SUBJECTS)[number];

export interface FeatureRequestDraft {
  idea: string;
  ageGroup: FeatureAgeGroup | "";
  subject: FeatureSubject | "";
  website: string;
}

export interface FeatureRequestPayload {
  idea: string;
  ageGroup: FeatureAgeGroup;
  subject: FeatureSubject;
  turnstileToken: string;
  website: string;
}

export function buildFeatureRequestPayload(
  draft: FeatureRequestDraft,
  turnstileToken: string,
): { ok: true; payload: FeatureRequestPayload } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const idea = draft.idea.trim();
  if (!idea) problems.push("Write your idea first.");
  else if (idea.length > FEATURE_IDEA_MAX) problems.push(`Keep the idea under ${FEATURE_IDEA_MAX} characters.`);
  const ageGroup = FEATURE_AGE_GROUPS.find((g) => g.value === draft.ageGroup)?.value;
  if (!ageGroup) problems.push("Pick an age group.");
  const subject = FEATURE_SUBJECTS.find((s) => s === draft.subject);
  if (!subject) problems.push("Pick a subject.");
  if (problems.length > 0 || !ageGroup || !subject) return { ok: false, problems };
  return {
    ok: true,
    payload: { idea, ageGroup, subject, turnstileToken, website: draft.website },
  };
}

export type FeatureSendResult =
  | { status: "sent" }
  | { status: "not-open" }
  | { status: "rate-limited" }
  | { status: "error" };

/** The slice of the shared transport port this form posts through.
 * Structural on purpose: this module is domain code and must not
 * import the platform layer. The board page passes postText from the
 * browser transport; tests pass a fake transport's postText. */
export type FeaturePost = (
  url: string,
  body: string,
  opts?: {
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    referrerPolicy?: ReferrerPolicy;
    retries?: number;
  },
) => Promise<{ status: number; text: string }>;

/** POST the payload through `post`. Never throws. 503 maps to the
 * honest "not open yet". No cookies and no referrer leave with the
 * request. A null endpoint fails closed (not-open) and does not call
 * the transport. */
export async function sendFeatureRequest(
  endpoint: string | null,
  payload: FeatureRequestPayload,
  post: FeaturePost,
): Promise<FeatureSendResult> {
  if (!endpoint) return { status: "not-open" };
  try {
    const res = await post(endpoint, JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      retries: 0,
    });
    if (res.status >= 200 && res.status < 300) return { status: "sent" };
    if (res.status === 503) return { status: "not-open" };
    if (res.status === 429) return { status: "rate-limited" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}
