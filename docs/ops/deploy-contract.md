# Deploy contract

One row per secret or binding. No values belong in this file, in logs, or in tests.

A secret has one source. The contact webhook is a runtime Worker secret, read only by `src/lib/contact/runtime-config.server.ts`. It is not baked into the bundle.

Facts below were checked on this branch against `main` `7bc4d8f2`. A row marked [tested] names the command. A row marked from a file cites that file.

## Secrets and bindings

| Name | Kind | Where it is set | Who reads it | Check |
| :--- | :--- | :--- | :--- | :--- |
| `CONTACT_DISCORD_WEBHOOK_URL` | Worker secret, required | Name in `wrangler.jsonc` `secrets.required`. The value is an encrypted runtime secret on the `meridian` worker, not in git. Not a Vite `define`. | `readContactWebhookSecret` / `readContactWebhookSecretRuntime` in `src/lib/contact/runtime-config.server.ts`. Order: Worker binding, then `globalThis.__env__`, then `process.env`. The contact handler calls those functions. | [tested] `node --experimental-strip-types --test src/lib/contact/runtime-config.server.test.ts` (fails if `vite.config.ts` still names the secret). [tested] `node --experimental-strip-types --test src/lib/contact/contact-handler.server.test.ts`. Form post: `npx playwright test --workers=1 tests/e2e/grownups-privacy-contact.desktop.spec.ts`. |
| `CONTACT_ALLOWED_ORIGINS` | Allowlist string, not a secret | Worker env or `process.env`. The SSR bundle may also bake it via `ssrContactEnvPlugin` in `vite.config.ts` when the build variable is set. Client and Pages builds get an empty string. | `readContactEnv` / `readContactRuntimeEnv` in `src/lib/contact/contact-handler.server.ts`. Order: Worker binding, Nitro env, SSR bake, `process.env`. | [tested] the contact-handler test named above (Nitro env beats `process.env`). |
| `CONTACT_RATE_LIMITER` | Rate-limit binding | `wrangler.jsonc` `ratelimits`, namespace `72071`, 3 per 60s. | `CLIENT_LIMITER_BINDING` in `src/lib/contact/rate-limiter.server.ts`. Missing binding: in-memory limiter only. | [tested] `node --experimental-strip-types --test src/lib/contact/rate-limiter.server.test.ts`. |
| `CONTACT_GLOBAL_RATE_LIMITER` | Rate-limit binding | `wrangler.jsonc` `ratelimits`, namespace `72072`, 10 per 60s. | `GLOBAL_LIMITER_BINDING` in the same file. | Same test. |
| `FEATURE_DISCORD_WEBHOOK_URL` | Runtime secret, optional | Not in `wrangler.jsonc` `secrets.required` [tested, `grep -n FEATURE_DISCORD wrangler.jsonc` returns nothing]. Read from the Worker env, Nitro env, or `process.env`. No Vite bake. | `readFeatureRequestRuntimeEnv` in `src/lib/feature-request/feature-request-handler.server.ts`. | [tested] `node --experimental-strip-types --test src/lib/feature-request/feature-request-handler.server.test.ts`. |
| `FEATURE_TURNSTILE_SECRET_KEY` | Runtime secret, optional | Same gap: not declared in `wrangler.jsonc`. Runtime env only. | Same reader. Unset: the feature route does not deliver. | Same test. |
| `FEATURE_RATE_LIMITER`, `FEATURE_GLOBAL_RATE_LIMITER` | Optional rate-limit bindings | Not in `wrangler.jsonc`. If absent, the handler reuses the contact bindings. | `readFeatureRequestRuntimeEnv`. | Same test. |
| `DISCORD_WEBHOOK_URL` | Crash-worker secret | Not in `workers/crash-report/wrangler.toml` (that file says secrets ride on the version upload). Different channel from the contact secret. | `env.DISCORD_WEBHOOK_URL` in `workers/crash-report/src/index.ts`. The worker receives `env` from the platform. It does not import the contact config module. | [tested] `npm run test:worker`. |
| `TELEMETRY_COUNTS` | KV binding | Recorded in `workers/crash-report/wrangler.toml` (`id` `34884ed9aa46437f871278a517882e72`). The upload metadata is what takes effect; the toml says the upload path does not read the file. | Crash worker `env.TELEMETRY_COUNTS`. Missing binding: counting stays off. | `bindings_present` in the worker suite (`npm run test:worker`). |
| `CRASH_RATE_LIMITER` | Rate-limit binding | `workers/crash-report/wrangler.toml`, namespace `72073`, 10 per 60s. Same upload-metadata caveat. | Crash worker env. Missing binding: in-memory limiter. | Same suite. |
| `VITE_CF_BEACON_TOKEN` | Build-time client value | GitHub Actions secret, injected in `.github/workflows/pages.yml`. One source. Not a Worker secret. | `import.meta.env.VITE_CF_BEACON_TOKEN` in `src/routes/__root.tsx` via `src/lib/web-analytics.ts`. Unset: no beacon. | Pages workflow file. No runtime secret read. |
| `VITE_KOFI_URL` | Build-time client value | GitHub Actions secret, same workflow. One source. Not a Worker secret. `wrangler.jsonc` has no `vars` block. | `import.meta.env.VITE_KOFI_URL` in `src/components/grandpa-coffee-run.tsx`. Unset: the coffee link renders nothing. | Same workflow. |
| `DATABASE_URL` | Server env secret, optional | Not in `wrangler.jsonc` and not in the Pages workflow [tested, `grep -n DATABASE_URL wrangler.jsonc .github/workflows/pages.yml` returns nothing]. Set in the host environment when a Neon database is used. | `process.env.DATABASE_URL` in `src/lib/db.ts` (empty counts as unset; PGLite is the fallback) and `scripts/migrate.mjs`. Not a Vite `define`. | No secret-specific test. Reader is `src/lib/db.ts`. |

## What this PR changed

`vite.config.ts` used to copy `CONTACT_DISCORD_WEBHOOK_URL` into the SSR bundle at build time, and the handler also read the Worker secret. That was two sources. The bake is gone. The allowlist bake stays: it is not a secret, and `wrangler.jsonc` declares no vars, so a build variable is still the fallback for the Pages mirror.

## Not in this table

Script paths (`MERIDIAN_GEONAMES_DUMP` and the like) are machine paths, not deploy secrets. They are out of this contract.

## Response headers

Not a secret. Players keep today's header values. `src/lib/security-headers.ts` is the one module `src/server.ts` and `src/start.ts` call. `public/_headers` is the static-asset copy of the same policy. Rendered HTML cache stays the plain value, with no `s-maxage`. That split is the 2026-10-22 ruling (WI-18). This section does not collapse it.

| What | Where | Check |
| :--- | :--- | :--- |
| Security headers on worker responses and on static `/*` | `SECURITY_HEADERS` via `withSecurityHeaders` in `src/server.ts` and `src/start.ts`; the same pairs in the `public/_headers` `/*` block | [tested] `node --experimental-strip-types --test src/lib/security-headers.test.ts` |
| Static path headers, including cache rules | `STATIC_HEADER_RULES` and `headersForStaticPath` in the same module, compared to `public/_headers` for the same paths | Same test. It fails when a path's headers differ. |
| Rendered HTML `Cache-Control` | `HTML_CACHE_CONTROL` = `public, max-age=0, must-revalidate`, set only from `src/start.ts`. Not the asset `/` rule (`s-maxage=60`). | Same test. |

## Migrations

One runner applies pending SQL. `applyPendingMigrations` lives in `scripts/migration-runner.mjs`. The caller opens the database and runs `MIGRATIONS_LEDGER_SQL`. The runner does not open a connection.

| Caller | When | Check |
| :--- | :--- | :--- |
| Build | `package.json` `build` is `vite build && npm run db:migrate`. `scripts/migrate.mjs` calls the runner only when `DATABASE_URL` is set and `migrations/` has a top-level `.sql` file. An empty URL exits 0 and does not connect. `migrations/auth/` is not applied. | [tested] `node --test scripts/migration-schema.test.mjs` |
| PGLite | `src/lib/db.ts` calls the same runner when the embedded database opens (`DATABASE_URL` unset). | Same test. The build adapter (BEGIN, file, INSERT, COMMIT) and the PGLite transaction adapter leave the same columns and the same `_migrations` names. A bad file rolls back on both. |
| Worker | `wrangler.jsonc` `main` is `src/server.ts`. That entry does not import `src/lib/db.ts` and does not apply SQL. `workers/` has no migrator. `DATABASE_URL` is not a Worker binding. There is no third runner. | [tested] `grep` of `applyPendingMigrations` and `lib/db` in `src/server.ts` returns nothing. `grep` of `migrate`, `DATABASE_URL`, and `applyPending` in `workers/` returns nothing. `grep` of `DATABASE_URL` in `wrangler.jsonc` returns nothing. |

