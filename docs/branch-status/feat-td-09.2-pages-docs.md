# Branch status — feat/td-09.2-pages-docs

**Task:** TD-09.2, the leftover current-tense docs from the Pages retirement. TD-09.1 removed `.github/workflows/pages.yml` (Done, #577) and the URL retarget landed in #581, but four operator-facing docs still said GitHub Pages is a live host. This branch rewrites only those current-tense sentences: the live site is `https://meridian.knowledgetest.workers.dev` only.

**What changed:**

- `README.md` § Deployment — the public site is the Worker; `npm run build:pages` stays as a CI gate (its `/Meridian/`-based static artifact is not published); the old `pages.yml` publish job is described as removed. Stamping prose now describes the live Worker site only.
- `docs/handbook/07-engineering-and-ops.md` — hosting is Workers only; the deploy diagram no longer shows a Pages host node or a browser→Pages edge; `build:pages` stays as the CI gate.
- `docs/handbook/08-how-we-work.md` — land-and-deploy step: deploys auto via Cloudflare Workers Builds on `main`.
- `docs/security-headers.md` — the two present-tense Pages-mirror claims (header delivery, cross-origin contact form) are now past tense about the retired mirror; the static shell wording stays accurate to the `build:pages` artifact.

**Not changed:** `npm run build:pages` (CI gate, kept), `meridian-media` URLs, historical reviews/ADRs/run reports, `docs/reviews/**`, tests that use a Pages URL as input, `.github/workflows/**`, `package.json`, app source, `public/_headers`, `src/build-board/**`.

**Owner step (only one):** please glance at Settings → Pages for `veeresh-bikkaneti/Meridian` and confirm Pages is off (`GET /repos/veeresh-bikkaneti/Meridian/pages` was 404 when this branch was written). Leave `veeresh-bikkaneti/meridian-media` Pages alone — journal clips stay there by owner ruling.

**Gates:** recorded in the pull request body.

**Open questions:** none.

**Ruled out:**

- Any GitHub settings change (Pages, DNS) — this PR is docs-only.
- Rewriting the whole security-header policy prose — only the two present-tense mirror claims were touched.
