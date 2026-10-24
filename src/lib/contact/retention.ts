/**
 * Contact-message retention policy. This is the single source for the number
 * shown on /privacy and stamped on every Discord message (review follow-up on
 * #207, 2026-10-21).
 *
 * The `meridian` worker stores nothing. It has no database, no KV, and no
 * log of message text. When delivery is switched on, the ONLY copy of a
 * message is the post in the owner's private Discord channel. Discord is
 * therefore the processor that holds it, and the owner's promise is to delete
 * that post once the question is resolved, and in any case within
 * CONTACT_RETENTION_DAYS. A grown-up can ask for earlier deletion through the
 * same form.
 */
export const CONTACT_RETENTION_DAYS = 90;

/** One-line reminder added to each forwarded message, for whoever reads it. */
export const CONTACT_RETENTION_REMINDER = `Delete this message once it is resolved, and within ${CONTACT_RETENTION_DAYS} days at the latest (privacy notice promise).`;
