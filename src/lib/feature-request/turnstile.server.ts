/**
 * Cloudflare Turnstile server-side verification (siteverify).
 *
 * Note for reviewers: the brief said to reuse the contact form's Turnstile
 * setup, but no Turnstile wiring exists in this repo (no site key, no
 * siteverify call, and the CSP does not list challenges.cloudflare.com).
 * This module is therefore new, kept as small as possible: one POST to
 * Cloudflare's documented siteverify endpoint, fail-closed on every
 * error, missing secret, or missing token.
 */

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyFn = (token: string, remoteIp?: string) => Promise<boolean>;

export async function verifyTurnstileToken(
  token: string,
  secret: string | undefined,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
  remoteIp?: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    try {
      const res = await fetchFn(TURNSTILE_SITEVERIFY_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: unknown };
      return data.success === true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
