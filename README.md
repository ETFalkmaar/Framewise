# Framewise

Multi-tenant website builder with built-in AI agent.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) + TypeScript strict
- [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- [Inter](https://rsms.me/inter/) + [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via `next/font`
- [Supabase](https://supabase.com/) (planned, step 119 — currently mocked)
- [next-intl](https://next-intl.dev/) for NL / FR / EN
- Deployed on [Vercel](https://vercel.com/)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The `/design-system` route shows all design tokens and components.

## Code quality

| Command                | Purpose                      |
| ---------------------- | ---------------------------- |
| `npm run lint`         | Run ESLint over the codebase |
| `npm run lint:fix`     | Auto-fix ESLint findings     |
| `npm run format`       | Run Prettier `--write`       |
| `npm run format:check` | Run Prettier `--check`       |
| `npm run type-check`   | TypeScript `--noEmit`        |
| `npm test`             | Run Vitest test suite        |
| `npm run build`        | Production build             |

### Pre-commit hooks

Husky 9 + lint-staged run automatically on every commit:

- Staged `.ts|.tsx|.js|.jsx|.mjs` files: ESLint `--fix` then Prettier `--write`
- Staged `.json|.md|.css` files: Prettier `--write`
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, ...) — enforced by
  commitlint.

### Continuous integration

Every pull request runs five parallel jobs in GitHub Actions: `lint`,
`format-check`, `type-check`, `test`, `build`. All must pass before a PR
can auto-merge to `main`.

## Data layer

Repositories are exposed from `@/lib/data` and follow a small adapter
pattern:

- **Public API**: `src/lib/data/repositories/<entity>.ts` defines a typed
  `*Repository` interface plus a setter-bound singleton (`tenantsRepo`,
  `pagesRepo`, `bookingsRepo`, …).
- **Mock adapter** (today): `src/lib/data/adapters/mock/` keeps an in-memory
  store seeded from JSON files in `seeds/`. No persistence between
  sessions — perfect for development and PR previews.
- **Supabase adapter** (step 119): `src/lib/data/adapters/supabase/` is
  intentionally empty; the README there describes the migration plan.

Application code never imports from `adapters/*` directly — only from
`@/lib/data`. Swapping adapters is a one-file change in `src/lib/data/index.ts`.

To inspect the current store contents during development, visit
[`/debug/data`](http://localhost:3000/debug/data) — this route is
hidden in production (returns 404) and never indexed.

## Validation

Every write into the data layer goes through Zod schemas defined under
`src/lib/validation/`. Three layers:

- **Helpers** (`helpers/`): shared building blocks for slugs, locales,
  countries, dates, UUIDs.
- **Entity schemas** (`schemas/<entity>.ts`): per-entity insert/update
  shapes with field-level constraints (slug regex, email, refines like
  "default_locale must be in enabled_locales", booking start ≤ end, …).
- **Cross-entity rules** (`rules/`): business logic that needs more
  than one entity — `checkBookingAvailability`, `assertFeature`,
  `assertTransition` for tenant status moves.

Failures throw `ValidationError` with a stable `code`
(`INVALID_INPUT`, `SLUG_NOT_UNIQUE`, `BOOKING_CONFLICT`, …) plus a
list of zod issues. The mock adapter calls `parseOrThrow()` on every
`create()`/`update()`, so invalid data never lands in the store.

The same schemas will be reused for API route validation, automatic
form generation in the admin, and AI agent tool calls.

## Multi-tenant

Every request hits the resolver in `src/lib/tenant/resolver.ts` before
i18n routing kicks in. Four strategies are tried in priority order:

| Order | Strategy        | Example                                                 |
| ----- | --------------- | ------------------------------------------------------- |
| 1     | `custom-domain` | `villa-bonbini.com/`                                    |
| 2     | `subdomain`     | `demo-villa.framewise.app/` (also `*.localhost` in dev) |
| 3     | `path-prefix`   | `framewise-pi.vercel.app/sites/demo-villa/about`        |
| 4     | `none`          | `framewise-pi.vercel.app/` (Framewise marketing site)   |

The middleware writes the resolved tenant id into the
`x-framewise-tenant-id` request header. Server components read it
via `getCurrentTenant()` / `getCurrentTenantWithSubscription()`;
client components consume it through `<TenantProvider>` plus the
`useTenant()` / `useOptionalTenant()` / `usePlan()` hooks.

When a tenant exists but is `onboarding` or `paused`, the locale
layout renders `<MaintenancePage>` instead of the normal page.

The `/debug/data` route includes a "Tenant resolution playground"
that calls the resolver against the four canonical input shapes so
you can verify behaviour at a glance.

## Authentication

Mock auth lives under `src/lib/auth/` and is wired up exactly the way
the future Supabase implementation will be — call sites use
`getCurrentUser()`, `requireCurrentUser()`, `getCurrentUserWithTenants()`,
`canEditPages()`, etc. without knowing the implementation details.

- **Sessions**: signed `framewise_session` cookies via
  [iron-session](https://github.com/vvo/iron-session) v8. `SESSION_PASSWORD`
  must be set in production (32+ characters).
- **Credentials**: passwords are stored as plain text in
  `seeds/users.json` for the mock. Step 119 swaps this for
  Supabase-managed bcrypt/argon2 hashes; the `password_hash` column name
  stays.
- **Permissions**: role-based via the `tenant_users` junction +
  `roles.name` (`owner` / `editor` / `viewer` / `support`). The
  `framewise@example.com` super-admin bypasses every tenant check.
- **API routes**: `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me` — login is rate-limited (5/15 min per IP) by an
  in-memory bucket.

### Test credentials (development only)

| Role             | Email                           | Password          |
| ---------------- | ------------------------------- | ----------------- |
| Super-admin      | `framewise@example.com`         | `Framewise2025!`  |
| Villa owner      | `owner@demo-villa.example`      | `Villa2025!`      |
| Restaurant owner | `owner@demo-restaurant.example` | `Restaurant2025!` |

Visit `/login`, `/account`, or the auth playground at `/debug/data`.

## Countries & providers

Country and third-party-provider configuration lives under
`src/lib/countries/` and is exposed through `@/lib/countries`.

- **Country configs** (`nl.ts`, `cw.ts`): identity (flag, locale,
  currency, timezone), tax-identifier metadata (BTW for NL, CRIB
  for CW with a serialisable regex), curated provider ids per
  category, and launch-required legal requirements with localised
  copy in NL/FR/EN.
- **Provider entries** (`providers/<id>.ts`): one file per
  third-party — Moneybird, e-Boekhouden, Exact Online, Twinfield,
  Xero, QuickBooks, BDO Online, Stripe, Mollie, PayPal Business,
  Twilio, Telnyx, HubSpot, Pipedrive, Brevo, Mailchimp. Each entry
  declares auth method (`oauth` / `api_key`), pricing notes,
  setup complexity, the countries it is `availableIn`, and which
  countries `recommendedFor`.
- **Registry helpers** (`registry.ts`): `getCountryConfig(code)`,
  `getProviderById(id)`, `getAllProviders()`,
  `getProvidersByCategory(cat)`, `getProvidersForCountry(code, cat?)`,
  `isProviderAvailableForCountry(id, code)`.
- **Validation rule** (`@/lib/validation`): `isProviderAvailable`
  and `assertProviderAvailable` throw a `ValidationError`
  (`PROVIDER_NOT_AVAILABLE_IN_COUNTRY`) when a tenant tries to
  connect a provider not configured for its country. Step 10
  (`provider_connections`) wires this into the connections
  repository.

The `/debug/data` route renders both country configs side-by-side
with their curated provider lists, every provider in the registry
as a card, and three live calls to `assertProviderAvailable` so
you can verify behaviour at a glance.

## Provider connections

Each tenant brings its own third-party accounts ("BYOA"): we never
hold credit cards or platform-wide credentials. The data layer
keeps those links in `provider_connections`, scoped per tenant and
per category (accounting, payments, phone, CRM, newsletter).

- **Repository** (`@/lib/data` → `connectionsRepo`): typical CRUD
  plus `findByCategory`, `findByProvider`, `findActive`,
  `markExpired`, `markError`, `revoke`. Status transitions are
  validated (`connected ↔ disconnected/error/expired` only — no
  jumping straight from `disconnected` to `error`).
- **Cross-entity rule** (`assertProviderAvailable`): every create
  call checks the country registry from step 9, so a Curaçao
  tenant cannot accidentally configure Mollie (NL-only).
- **Launch readiness** (`canTenantGoLive`,
  `getRequiredConnectionsForTenant`): aggregates the country's
  `requiredAtLaunch` legal requirements against the tenant's
  active connections. Step 11 will fold checklist progress into
  the same call.
- **Per-tenant country settings** (`tenantCountrySettingsRepo`):
  one row per tenant with currency, IANA timezone, default locale,
  legal entity name, and postal address. `upsert()` validates
  that the locale and currency are supported by the country.

The user-facing read-only surface is
`/<locale>/account/connections`. It groups connections by
category, renders a status dot per provider (green = connected,
red = error/expired, grey = disconnected/none), and shows the
BYOA disclaimer per card. Connect/disconnect actions are added in
step 14+.

## Setup checklist

Each tenant gets a country + plan-aware onboarding checklist that
must be (mostly) green before status `onboarding → live` is allowed.

- **Templates** (`src/lib/checklist/templates.ts`): code-defined, one
  entry per (country, plan, item) combo. `required` items gate
  go-live; `optional` ones don't. Each template declares an
  `autoCompleteSource`:
  - `tenant_field` (e.g. `custom_domain` set on the tenant row),
  - `connection` (e.g. a `connected` provider in some category), or
  - `manual` (the user clicks "mark done" / "skip").
- **Generator + progress** (`src/lib/checklist`): `ensureChecklist
ForTenant()` idempotently inserts `pending` rows for newly
  applicable templates. `computeChecklistProgress()` resolves the
  auto-complete sources live and returns a `{ total, completed,
pendingRequired, pendingOptional, percentageComplete, items }`
  snapshot.
- **Launch gate** (`canTenantGoLive`): updated to combine the
  required-connections check from step 10 with required-checklist
  items. Reasons are now structured (`{ key, defaultMessage }`) so
  the UI can translate them.
- **UI**: `/<locale>/account/setup` renders a progress bar, status
  banner (green = ready, amber = pending), and one card per item
  grouped by required/optional. Manual items have ✓/↺/– actions
  wired through three server actions; auto-complete items show a
  hint instead.
- **Account overview**: `/account` now shows the same progress bar
  - a "Manage setup" link.

`/debug/data` includes a Checklist playground mirroring the live
state for the seeded tenants.

## Token vault

Provider tokens are encrypted at rest and every read / write is
audited. The implementation lives under `src/lib/vault/` and is
exposed through `@/lib/vault`.

- **Algorithm**: AES-256-GCM with a fresh 12-byte IV per call.
  Wire format `v1:<iv>:<authTag>:<ciphertext>` (all hex). The
  `v1` prefix lets us migrate to a wrapped-key design later
  without breaking old rows.
- **Key**: `TOKEN_ENCRYPTION_KEY` env var, exactly 64 hex chars
  (32 bytes). `.env.example` and the `crypto.ts` error message
  document the `node -e "console.log(require('crypto').
randomBytes(32).toString('hex'))"` recipe. Production refuses
  to operate without a valid key.
- **Public API**: `encrypt(plaintext)`, `decrypt(ciphertext)`,
  `storeToken`, `getToken`, `rotateToken`, `revokeToken` (all
  taking a `VaultActor` so tenant ownership can be checked
  before any decrypt). Errors: `EncryptionError`,
  `TokenNotFoundError`, `AccessDeniedError`.
- **Audit log**: every `storeToken` / `getToken` / `rotateToken`
  / `revokeToken` call writes an immutable row to
  `token_access_log` (tenant id, connection id, action, success,
  user id, ip, timestamp). Defensive: a failure to write the
  audit row never aborts the caller's operation.
- **UI**: `/<locale>/account/connections/audit` renders the log
  newest-first as a table. `/account/connections` links to it.
  `/debug/data` shows a Vault playground with a live encrypt /
  decrypt round-trip and the five most recent audit rows.

Step 119 swaps this for [Supabase Vault](https://supabase.com/docs/guides/database/vault)
plus a Postgres trigger-based audit log. The public API
(`storeToken` / `getToken` / `rotateToken` / `revokeToken`) stays
the same so call sites don't change.

## Storage

Tenant media (images, PDFs) lives behind a small adapter layer in
`src/lib/storage/`. Application code calls `uploadMedia()` /
`deleteMedia()` and never touches the underlying provider.

- **Provider selection** (`getActiveProvider()`):
  1. Test override (`__setStorageProviderOverride`).
  2. **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (production).
  3. **Mock** — always works. Returns deterministic Picsum / placeholder
     URLs so the media library renders the same thumbnails across
     reloads. Acts as a graceful production fallback when the Blob
     store hasn't been provisioned yet.
- **Bucket layout**: `tenants/<tenantId>/<yyyy>/<mm>/<filename>` —
  tenant id is the only identifier in the path so two tenants can
  never collide. Built by `buildTenantPath()`; spaces become
  underscores, the tenant id is UUID-validated.
- **Upload validation** (`assertValidUpload`): allow-list MIME types
  (jpeg/png/webp/avif/gif/svg/pdf), max **50 MB**, safe filename
  charset (`A-Za-z0-9._\- ()` only).
- **UI**: `/<locale>/account/media` renders a tenant-scoped grid of
  thumbnails (alt text per locale, file name, MIME, size,
  dimensions, uploader). Upload button is wired in step 14+.
  `/debug/data` Storage playground does a live `uploadMedia()` round
  trip and lists the active provider.

Step 119 swaps the Vercel Blob adapter for [Supabase Storage](https://supabase.com/docs/guides/storage)
behind the same `StorageProvider` interface — call sites stay the same.

## Connector framework

Every third-party integration plugs into a uniform framework under
`src/lib/connectors/` and is exposed through `@/lib/connectors`.

- **Definition** — a connector is a plain `ConnectorDefinition` literal
  (or `BaseConnector` subclass) with `id`, `category`, `authMethod`,
  optional `oauth { authorizeUrl, tokenUrl, scopes, pkce, ... }` /
  `apiKey { instructions, fields, helpUrl }` blocks and an optional
  `testConnection`. `developmentOnly: true` hides the card in
  production but keeps it usable in dev / playground / tests.
- **Registry** — `registerConnector(c)` at module load. Step 14 ships
  two mock connectors (`mock-oauth`, `mock-api-key`) so the flows can
  be exercised end-to-end without any real provider; steps 15–23
  fill in Moneybird / Stripe / Mollie / Twilio / HubSpot / Brevo.
- **OAuth flow** — `initiateOAuthFlow()` builds the provider's
  `authorize_url`, generates a CSRF state + optional PKCE pair, and
  returns the value to set as the signed `framewise_oauth_flow`
  cookie. `handleOAuthCallback()` validates the state, exchanges the
  code (mocked in step 14, real in 15+), runs `testConnection`, and
  persists the encrypted token via the vault.
- **API-key flow** — `submitApiKeyCredentials()` validates the form
  fields against `connector.apiKey.fields`, runs `testConnection`,
  and persists.
- **Persistence** — both flows go through `storeCredentials()`, which
  is a thin wrapper around `connectionsRepo` + `vault.storeToken()`.
  Re-using a previously-disconnected row is automatic, so the user
  doesn't accumulate ghost rows when they reconnect.
- **Routes** — `POST /api/connectors/oauth/start`,
  `GET /api/connectors/oauth/callback`,
  `POST /api/connectors/api-key/connect`,
  `POST /api/connectors/revoke`. All four require an active session,
  call `assertCanManageTenant`, and verify the connection belongs to
  the active tenant before any vault access.
- **UI** — `/<locale>/account/connections/add` is the hub: one card
  per registered connector, grouped by category, with a "Test"
  section for `developmentOnly` connectors in dev.
  `/<locale>/account/connections/add/[providerId]` runs the
  connector-specific flow (OAuth button or API-key wizard). The
  existing connections page gains "Add connector" + per-card
  "Disconnect" buttons.

### Adding a new connector

1. Drop a new `ConnectorDefinition` literal into
   `src/lib/connectors/providers/<id>.ts` (or extend `BaseConnector`).
2. Call `registerConnector(...)` at the bottom of that file.
3. Make sure the file is imported from somewhere that runs at
   module load (e.g. `src/lib/connectors/index.ts` or a barrel).
   Steps 15–23 will add an `init.ts` that imports all connector
   modules in deterministic order.

The hub, OAuth callback, API-key wizard, audit log and disconnect
flow then work for the new connector with no further changes.

### Moneybird (step 15)

First real connector. Dutch accounting (zzp + MKB) via personal
access token — no OAuth dance, no client secret to provision.

- **Auth**: user pastes a token from Moneybird → Settings →
  Developers → API tokens. Optional `administration_id` pin if the
  token sees multiple administrations; otherwise the first one
  becomes the primary.
- **`testConnection`**: a single `GET /administrations.json` proves
  the token works AND returns the metadata we cache on
  `provider_connections.metadata` so the connections card can show
  "Connected to Mijn Bedrijf BV" without ever decrypting the token
  on render.
- **HTTP client**: `MoneybirdClient` (in
  `src/lib/connectors/providers/moneybird/client.ts`) wraps `fetch`
  with a 10s default timeout (5s for `testConnection`),
  `Authorization: Bearer …`, `User-Agent: Framewise/1.0`, and an
  `AbortController` so we never hang the request.
- **Error mapping**: `mapMoneybirdError(response, body)` translates
  401 → `InvalidCredentialsError`, 403 →
  `INSUFFICIENT_PERMISSIONS`, 404 → `RESOURCE_NOT_FOUND`, 422 →
  `VALIDATION_FAILED` (with body `errors` flattened), 429 →
  `RATE_LIMITED` (with retry-after detail), 5xx →
  `PROVIDER_ERROR`, default → `UNKNOWN_ERROR`. Network failures →
  `NETWORK_ERROR` via `networkError(reason)`.
- **UI**: `/<locale>/account/connections/add/moneybird` renders a
  4-step `<MoneybirdInstructions />` card above the generic
  API-key wizard. Tests run against a stubbed `fetch` (no real HTTP
  in CI).

#### Testing Moneybird locally

1. Sign up for a free Moneybird trial account at moneybird.com.
2. Create at least one administration (the wizard offers "test
   bedrijf" defaults).
3. Settings → Developers → API tokens → "Create new access token".
   Pick a sensible name like `Framewise local`.
4. In the dev server, log in as `owner@demo-restaurant.example`
   (NL Pro tenant) and visit
   `/account/connections/add/moneybird`. Paste the token.
5. The wizard shows "Connected" on success and persists encrypted
   credentials via the vault. CI runs the same connector against a
   mocked `fetch` — no real token is ever needed in pipelines.

## Status

In development - Step 15 of 118 (revised plan)
