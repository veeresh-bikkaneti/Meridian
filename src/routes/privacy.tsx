import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/grownups/info-page";
import { CONTACT_RETENTION_DAYS } from "@/lib/contact/retention";

/**
 * /privacy — the plain-language privacy notice for grown-ups.
 *
 * Source of truth for what Meridian does with data. If you change what the
 * app or its workers collect, change this page in the same PR (see
 * docs/reviews/2026-10-21-p0-p2-remediation.md). Key decisions recorded
 * here and in that doc:
 * - The site is directed to children, so EVERY visitor is treated as a
 *   child (COPPA). Nothing asks for or stores personal information.
 * - Google Analytics and Microsoft Clarity were removed (2026-10-21).
 *   The only analytics is optional, cookieless Cloudflare Web Analytics.
 * - No contact email is published (team rationale: a published address
 *   on a kids' site invites spam and mail from children; grown-ups reach
 *   us through the gated /contact form instead).
 * - Contact delivery was parked (path B, adopted by the owner
 *   2026-10-21 — his words are quoted in that doc, decision 4) and is
 *   wired by issue #220: Discord is the processor
 *   that holds the messages — including an optional reply-to address,
 *   which travels to Discord with the message — the server keeps no
 *   copy, and retention is CONTACT_RETENTION_DAYS
 *   (src/lib/contact/retention.ts), deleted manually once resolved.
 *   The page below describes that wired state. The grown-up gate is
 *   described honestly as a check that keeps kids out of the form, NOT
 *   as verified parental consent.
 */
export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — Meridian" }] }),
  component: PrivacyPage,
});

const UPDATED = "October 21, 2026";

function PrivacyPage() {
  return (
    <InfoPage title="Privacy">
      <p className="text-sm text-muted">For parents, carers, and teachers · Last updated {UPDATED}</p>

      <p>
        Meridian is a free geography game made for children. Because the site is directed to
        children, we treat <strong>every visitor as a child</strong> and design everything around
        collecting as little as possible.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>No accounts, no sign-up, no log-in.</li>
        <li>We never ask a player for a name, email, age, location, photo, or any other personal information.</li>
        <li>There is no chat, no sharing of player-made content, and no ads.</li>
        <li>No cookies or persistent identifiers are used for analytics or tracking.</li>
      </ul>

      <h2>What stays on this device</h2>
      <p>
        Game progress (scores, places seen, settings such as difficulty, sound, read-aloud, and the
        grown-up age setting) is saved in this browser&rsquo;s own storage so the game can pick up where
        you left off. It is never sent to us. Clearing this site&rsquo;s data in your browser deletes it.
      </p>

      <h2>Services that see your connection</h2>
      <ul>
        <li>
          <strong>Hosting — Cloudflare</strong> (and GitHub Pages for the mirror copy) serves the game.
          Like any website host, they receive your IP address and basic request details in order to
          deliver the pages.
        </li>
        <li>
          <strong>Map pictures — Esri</strong> (ArcGIS World Imagery). The satellite map tiles load
          directly from Esri&rsquo;s servers, so Esri sees your IP address and which map squares were
          requested.
        </li>
        <li>
          <strong>Site statistics — Cloudflare Web Analytics</strong> (only if switched on for a
          build). It is cookieless: no cookies, no local storage, no fingerprinting, and it reports
          only aggregate counts such as page views. We do not use Google Analytics, Microsoft Clarity,
          or any advertising or session-recording tools.
        </li>
      </ul>

      <h2>Crash reports</h2>
      <p>
        If the game crashes or fails to load, the app may send a small report to our own crash
        receiver (a Cloudflare Worker we run) so we can fix it. A report contains: the app version,
        which game screen and map was open, a random ID that lasts only for that browser session (it
        is not tied to a person and resets when the tab closes), a short error description, and coarse
        device facts — operating-system family (for example &ldquo;iOS&rdquo;), phone or desktop, a
        rough screen-size group, and pixel density. It never includes the full browser identifier,
        guesses, locations, or anything a player typed. Crash alerts are relayed to a private
        developer channel and are not used for anything else.
      </p>

      <h2>Contact form (grown-ups only)</h2>
      <p>
        The <Link to="/contact">Contact us</Link> page sits behind a short grown-up question (a math
        problem). That question is only a simple check to keep young children from reaching a
        free-text form by accident. It does <strong>not</strong> verify who you are or that you are a
        parent, and it is not a parental-consent mechanism. Children should not use the form.
      </p>
      <p>
        The form sends only the topic you pick, your message (up to 1,000 characters), and, only if
        you choose to give it, a reply-to email address for a grown-up. We never store or forward
        your IP address with the message.
      </p>
      <h3>Where messages go and how long they are kept</h3>
      <ul>
        <li>
          <strong>Our server keeps nothing.</strong> A message passes through the Meridian
          site&rsquo;s server, which checks it and hands it on. The server has no database, keeps no
          copy, and never writes your message or email address to its logs.
        </li>
        <li>
          <strong>Discord receives the message — including a reply-to address, if you give
          one.</strong> Each message is posted to a private channel in <strong>Discord</strong>{" "}
          (Discord Inc.) that only the Meridian developer can read. Discord is the service that
          holds the message, under{" "}
          <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer">
            Discord&rsquo;s privacy policy
          </a>
          . The reply-to address travels to Discord with the message so we can answer you. Messages
          are never shared or used for anything except answering you.
        </li>
        <li>
          <strong>Deleted once resolved, within {CONTACT_RETENTION_DAYS} days.</strong> We delete
          the Discord message once your question or request is resolved, and in any case within{" "}
          {CONTACT_RETENTION_DAYS} days of receiving it. You can ask us to delete it sooner through
          the same form.
        </li>
      </ul>

      <h2>Leaving Meridian</h2>
      <p>
        A few links (story sources such as Wikipedia, and the optional &ldquo;buy Grandpa a
        coffee&rdquo; Ko-fi link, which asks for a grown-up first) open other websites with their own
        privacy policies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete game progress at any time by clearing this site&rsquo;s data in your browser.</li>
        <li>
          Because we hold no account or personal information about players, there is normally nothing
          for us to delete — but you can ask us any privacy question, or ask us to delete a contact
          message you sent, through the <Link to="/contact">Contact us</Link> page.
        </li>
      </ul>
    </InfoPage>
  );
}
