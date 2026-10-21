# Security headers and caching (Cloudflare build)

Source: `public/_headers`. Vite copies it into `dist/client/`. Cloudflare
Workers static assets apply it to every asset response. GitHub Pages
cannot set headers, so there the file is inert (it is served as a plain
text file, which is harmless).

Locked by `scripts/security-headers.test.mjs`.

## Headers on every path (`/*`)

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | see below | limits scripts/connections to what the game needs |
| `X-Frame-Options` | `DENY` | no framing (legacy twin of `frame-ancestors 'none'`) |
| `X-Content-Type-Options` | `nosniff` | no MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | outbound links (Wikipedia, Ko-fi) get only the origin |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb, interest-cohort, browsing-topics all `()` | a kids' game needs none of them |
| `Cross-Origin-Opener-Policy` | `same-origin` | isolates the browsing context |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS only. No `preload`: `workers.dev` is Cloudflare's domain, and preload should be decided per custom domain |

### CSP

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://server.arcgisonline.com;
font-src 'self' data:; media-src 'self' data: blob:;
connect-src 'self' https://server.arcgisonline.com
            https://meridian-crash-report.knowledgetest.workers.dev
            https://cloudflareinsights.com;
worker-src 'self' blob:; child-src 'self' blob:; manifest-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests
```

- `'unsafe-inline'` scripts: TanStack Start's hydration payload, the inline
  crash watchdog, and the `?nosw=1` hatch are inline and change every
  build. Moving to hashes or nonces is a **P3 follow-up**.
- Analytics: Cloudflare Web Analytics only (`static.cloudflareinsights.com`
  script + `cloudflareinsights.com` beacon). Google and Clarity hosts are
  intentionally absent, and the test fails if one comes back.
- The contact form posts to `/api/contact` on the same `meridian` worker,
  so `'self'` already covers it and no extra host is needed. The GitHub
  Pages mirror posts cross-origin, which that handler's CORS allow-list
  governs, not this CSP: Pages serves no `_headers`.
- If `observabilityEndpoint` or `contactEndpoint` in `flags.json` ever
  points at a different host, add that host to `connect-src` in the same PR.
- `frame-ancestors 'none'` also blocks embedding the *production* site in
  preview tools. Dev previews run on the Vite server and are unaffected.

## Caching

| Path | Cache-Control | Why |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | content-hashed file names |
| `/assets/maplibre-gl-worker.mjs`, `/assets/maplibre-gl-shared.mjs`, `/assets/storyteller/storyteller-assets.json` | `! Cache-Control` only, so the platform default `public, max-age=0, must-revalidate` + ETag applies | fixed names with mutable content. Cloudflare comma-joins duplicate headers from overlapping rules, so the detach line stands alone (same blocks as PR #203) |
| `/sw.js`, `/flags.json`, `/build-meta.json`, `/manifest.webmanifest` | `no-cache` | update detection and remote kill switches must see changes immediately |
| `/`, `/index.html` | `public, max-age=0, s-maxage=60, must-revalidate` | browsers revalidate. The edge may hold HTML for up to 60 s |

## Verify after deploy

```sh
curl -sI https://meridian.knowledgetest.workers.dev/ | grep -iE 'content-security|x-frame|strict-transport|permissions|cache-control'
curl -sI https://meridian.knowledgetest.workers.dev/assets/<any-hashed-file>.js | grep -i cache-control
```

If the headers are missing, the Workers Builds project is not serving
`dist/client` as static assets (for example, an SSR worker answers first).
The fallback is to set the same headers in that worker's response path.
The game worker's source is not in this repo; it deploys through
Cloudflare Workers Builds.
