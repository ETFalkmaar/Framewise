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

### e-Boekhouden (step 16)

Second NL accounting connector. Same API-key wizard shape as
Moneybird from the user's perspective; under the hood a two-token
session model that's noticeably different.

- **Two tokens**:
  - **User API Token** — entered by the customer in the wizard.
  - **Source API Token** — Framewise's integrator credential, read
    from `EBOEKHOUDEN_SOURCE_API_TOKEN`. Request via
    `support@e-boekhouden.nl` (free, ~1-2 business days). Without
    it the wizard renders cleanly and submissions fail with a
    friendly `CONFIGURATION_INCOMPLETE` error — no UX damage.
- **Session lifecycle**: `EBoekhoudenClient` exchanges both tokens
  for a short-lived bearer via `POST /session`, caches it for **55
  minutes** (5-min safety margin under the 60-min upstream
  expiry) in a module-level Map keyed by SHA-256 of the User API
  Token. Cache resets on cold start — sessions never outlive the
  process that minted them.
- **Auto-recovery**: any authenticated request that returns 401
  triggers exactly one retry with a freshly-minted session before
  surfacing `InvalidCredentialsError`.
- **Error mapping** (`mapEBoekhoudenError`): 400 →
  `VALIDATION_FAILED` (with body `errors` flattened), 401 →
  `InvalidCredentialsError`, 403 → `INSUFFICIENT_PERMISSIONS`, 404
  → `RESOURCE_NOT_FOUND`, 429 → `RATE_LIMITED` (1000/min, with
  retry-after detail), 5xx → `PROVIDER_ERROR`. Network failures →
  `NETWORK_ERROR` via `networkError(reason)`.
- **`testConnection`** does session-create + `GET /administration`
  - `endSession` cleanup, caching the administration name + VAT
    number on `provider_connections.metadata`.
- **UI**: 5-step `<EBoekhoudenInstructions />` card above the
  wizard. The card includes an amber `sourceTokenWarning` banner
  when `EBOEKHOUDEN_SOURCE_API_TOKEN` is missing, so the customer
  knows the issue is on Framewise's side.

#### Testing e-Boekhouden locally

1. Sign up for an e-Boekhouden trial at e-boekhouden.nl.
2. Beheer → Webkoppelingen → Beheer Webkoppelingen → "Nieuwe API
   koppeling toevoegen". Pick Framewise (once Framewise is
   registered with e-Boekhouden) and copy the User API Token.
3. Set `EBOEKHOUDEN_SOURCE_API_TOKEN` in `.env.local` to the
   integrator token Framewise received from
   `support@e-boekhouden.nl`. Without it, every wizard submission
   returns `CONFIGURATION_INCOMPLETE` — by design.
4. CI runs the connector against a stubbed `fetch`; no real
   tokens are needed in pipelines.

### Mollie (step 17)

First payment connector. iDEAL, Bancontact, credit card, and the
rest of the Mollie method matrix; NL only for now (CW gets Stripe
in a later step).

- **Two key flavours** that look identical to the customer but
  have very different consequences:
  - `test_*` keys live in the Mollie sandbox — no real money ever
    moves. Perfect for demos and CI.
  - `live_*` keys move real money. Require KvK + bank account on
    the Mollie organization.
    The connector parses the prefix and stores `key_type` on
    `provider_connections.metadata`, then the connections card
    badges a test connection in orange and a live one in green so
    you never accidentally take a real card payment during a demo.
- **`testConnection`** runs `GET /organizations/me` AND
  `GET /methods` in **parallel** — proof-of-life + harvest the
  organisation name + the active payment-method list (`['ideal',
'creditcard', ...]`) all in one round-trip pair.
- **Error mapping** (`mapMollieError`): 401 →
  `InvalidCredentialsError`, 403 → `INSUFFICIENT_PERMISSIONS`,
  404 → `RESOURCE_NOT_FOUND`, 422 → `VALIDATION_FAILED` (with
  `body.detail` flattened), 429 → `RATE_LIMITED` (600/5 min,
  retry-after detail), 5xx → `PROVIDER_ERROR`, network failures
  → `NETWORK_ERROR` via `mollieNetworkError`.
- **UI**: 4-step `<MollieInstructions />` card above the wizard
  with a side-by-side test-vs-live legend. The wizard's input
  has a `^(test|live)_[a-zA-Z0-9]{20,40}$` HTML pattern so the
  client rejects malformed keys without a server round-trip.

#### Testing Mollie locally

1. Sign up for a free Mollie test account at mollie.com — no
   KvK or bank required for sandbox keys.
2. Dashboard → Developers → API keys → copy a **Test API key**
   (starts with `test_`).
3. In the dev server, log in as `owner@demo-restaurant.example`
   (NL Pro tenant) and visit `/account/connections/add/mollie`.
   Paste the key.
4. The wizard runs the parallel round-trip and stores the
   organisation name + active methods on the connection. CI
   uses a stubbed `fetch`; no real keys ever land in pipelines.

### Stripe Connect (step 18)

The first **OAuth** connector. Uses Stripe Connect **Standard
accounts** so the customer keeps a full Stripe Dashboard, fees and
payouts stay on their own bank, and Framewise only ever holds a
`read_write` access token plus the `acct_xxx` identifier — pure
BYOA. Available in NL **and** CW (the latter via Stripe Atlas /
EU-entity routes; the wizard surfaces this in the country
overview's `caveats` field, not in the connector itself).

- **OAuth flow**: customer clicks "Connect with Stripe" →
  `/api/connectors/oauth/start` → `connect.stripe.com/oauth/authorize`
  → callback → `connect.stripe.com/oauth/token` exchange →
  `/v1/account` probe → vault-stored credentials + livemode badge.
- **Per-connector hooks** (`getAuthorizeUrl`, `handleOAuthCallback`):
  the framework's generic OAuth orchestrator was widened in step 18
  to delegate to provider-defined methods when present — Stripe
  needs the real `client_id` from env vars and a custom
  form-urlencoded token-exchange POST. Connectors without overrides
  (the framework's mock) keep using the generic builder.
- **Error mapping** (`mapStripeError`): handles both REST envelopes
  (`{ error: { message, type } }`) and OAuth-token envelopes
  (`{ error: "invalid_grant", error_description: "..." }`). 400 →
  `VALIDATION_FAILED`, 401 → `InvalidCredentialsError`, 402 →
  `PAYMENT_REQUIRED`, 403 → `INSUFFICIENT_PERMISSIONS`, 404 →
  `RESOURCE_NOT_FOUND`, 429 → `RATE_LIMITED` (with `retry-after`),
  5xx → `PROVIDER_ERROR`, network → `NETWORK_ERROR` via
  `stripeNetworkError`.
- **Configuration gate**: when `STRIPE_CLIENT_ID` /
  `STRIPE_SECRET_KEY` are blank the wizard still renders but the
  "Connect with Stripe" button is disabled and a `<StripeConfigWarning />`
  banner explains that Framewise needs to register a Connect
  platform first. Graceful — no other connector breaks.
- **Metadata**: `stripe_user_id`, `account_country`,
  `account_currency`, `business_name`, `livemode`,
  `charges_enabled`, `payouts_enabled` — all surfaced on the
  `provider_connections` row by widening `storeCredentials` to
  accept and merge an optional metadata bag.
- **UI**: 5-step `<StripeInstructions />` card above the OAuth
  button with side-by-side BYOA + test/live warnings. The
  connection card reuses Mollie's amber/emerald badge logic but
  keys off `metadata.livemode` instead of `metadata.key_type`.

#### Testing Stripe Connect locally

1. Sign in to dashboard.stripe.com (test mode by default).
2. Settings → Connect settings → click "Get started" → enable Connect.
3. Copy the **Test mode client ID** (`ca_xxx`) → paste into
   `.env.local` as `STRIPE_CLIENT_ID`.
4. Developers → API keys → copy the **Secret key** (`sk_test_xxx`) →
   paste as `STRIPE_SECRET_KEY`.
5. Restart the dev server. `/account/connections/add/stripe` now
   shows an enabled "Connect with Stripe" button. Clicking it
   redirects you to a real test-mode OAuth page — completing the
   handshake stores the connected `acct_xxx` and renders the
   account name + amber `test mode` badge on the connections page.

Without those env vars the wizard renders the config-incomplete
banner instead — perfect for previewing the UI without a Stripe
account. Tests stub all HTTP via `fetchImpl`; no real OAuth ever
fires in CI.

### PayPal Business (step 19)

The second OAuth payment connector and the **primary CW route**:
Stripe isn't officially available for Curaçao-based legal entities
(only via Stripe Atlas / EU detours), but PayPal Business works
directly. Available in NL **and** CW.

- **Two environments**: `sandbox` and `live`. The active one is
  resolved once from `PAYPAL_ENVIRONMENT` (default `sandbox`) and
  threaded through the rest of the connector. Authorize URL,
  token URL, API base URL, and the connection-card badge all flip
  together — no chance of mixing test and live.
- **OAuth flow**: customer clicks "Connect with PayPal" →
  `/api/connectors/oauth/start` → `(www.|sandbox.)paypal.com/connect`
  with scopes `openid` + `profile` + `email` +
  `https://uri.paypal.com/services/paypalattributes` → callback →
  Basic-auth POST to `api-m{.sandbox}.paypal.com/v1/oauth2/token` →
  `/v1/identity/oauth2/userinfo` probe → vault-stored credentials
  - `metadata.environment` badge.
- **Two error envelopes** (`mapPayPalError`): PayPal mixes shapes.
  OAuth endpoints return `{ error, error_description }`; REST API
  endpoints return `{ name, message, details }`. The mapper probes
  both before falling back to the HTTP status text. 400/422 →
  `VALIDATION_FAILED`, 401 → `InvalidCredentialsError`, 403 →
  `INSUFFICIENT_PERMISSIONS`, 404 → `RESOURCE_NOT_FOUND`, 429 →
  `RATE_LIMITED` (with `retry-after`), 5xx → `PROVIDER_ERROR`,
  network → `NETWORK_ERROR` via `paypalNetworkError`.
- **Redirect-URI pinning**: PayPal's token endpoint REQUIRES the
  `redirect_uri` to match exactly what the authorize call used.
  Stripe doesn't care, so step 18 ignored it; step 19 adds a
  per-connector `lastRedirectUri` cache that `getAuthorizeUrl`
  populates and `handleOAuthCallback` echoes back. Within a single
  Lambda invocation this works because the cookie keeps the OAuth
  state. Cold-start fallback reconstructs the canonical URL from
  `NEXT_PUBLIC_BASE_URL` so the framework never breaks.
- **Configuration gate**: when `PAYPAL_CLIENT_ID` /
  `PAYPAL_CLIENT_SECRET` are blank the wizard still renders but
  the "Connect with PayPal" button is disabled and a
  `<PayPalConfigWarning />` banner explains the gap. Same pattern
  as Stripe.
- **Metadata**: `user_id`, `payer_id`, `name`, `email`,
  `email_verified`, `environment`, `account_country` — surfaced
  on the connection card. The amber/emerald badge logic in
  `connection-status-card.tsx` now keys off all three shapes
  (Mollie's `key_type`, Stripe's `livemode`, PayPal's
  `environment`) without per-provider branching.
- **UI**: 5-step `<PayPalInstructions />` card with side-by-side
  BYOA + Business-only warnings, sandbox notice (when active),
  and a CW-specific advantage callout pointing out the
  no-Stripe-Atlas-detour benefit.

#### Testing PayPal Business locally

1. Sign up for a free PayPal Developer account at
   developer.paypal.com (no business required for the sandbox).
2. My Apps & Credentials → Sandbox → Create App → type "Merchant".
3. Copy the **Client ID** (`AY…`) and **Secret** → paste into
   `.env.local` as `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`.
4. Leave `PAYPAL_ENVIRONMENT` blank (default `sandbox`) or set it
   to `live` once your live app is approved.
5. Restart the dev server. `/account/connections/add/paypal-business`
   now shows an enabled "Connect with PayPal" button. Clicking it
   redirects you to a real sandbox OAuth page — completing the
   handshake stores the merchant's display name + amber `sandbox`
   badge on the connections page.

Without those env vars the wizard renders the config-incomplete
banner instead — perfect for previewing the UI without a PayPal
developer account. Tests stub all HTTP via `fetchImpl`; no real
OAuth ever fires in CI.

### HubSpot CRM (step 20)

The first **CRM** connector and the only one we expect every tenant
to want — HubSpot's free tier covers the lead-sync use case the AI
agent will drive in step 21+. Internationally available (NL + CW),
no test/live split, no per-region URL juggling.

- **OAuth flow**: customer clicks "Connect with HubSpot" →
  `/api/connectors/oauth/start` → `app.hubspot.com/oauth/authorize`
  with scopes `oauth` + `crm.objects.contacts.read` +
  `crm.objects.contacts.write` → callback → form-urlencoded POST to
  `api.hubapi.com/oauth/v1/token` → `/account-info/v3/details`
  probe → vault-stored credentials + the Hub identifier on the
  connection card.
- **Refresh tokens**: HubSpot always issues a refresh token on the
  authorization-code grant and the refresh token never expires
  unless revoked. Future steps can quietly mint new access tokens
  (HubSpot's access tokens are short-lived — typically 30 minutes).
  We persist `expires_at` on both `metadata` and `credentials` so
  the refresh-on-401 logic in step 21+ has the data it needs.
- **Two error envelopes** (`mapHubSpotError`): REST endpoints return
  `{ status, message, correlationId, category }` while OAuth-style
  errors use `{ status, error_description }` — the mapper probes
  both. `category` (when present) is folded into the user-facing
  message because it tells operators _why_ (e.g. `MISSING_SCOPES`,
  `RATE_LIMIT`). 400 → `VALIDATION_FAILED`, 401 →
  `InvalidCredentialsError`, 403 → `INSUFFICIENT_PERMISSIONS`,
  404 → `RESOURCE_NOT_FOUND`, 429 → `RATE_LIMITED` (with
  `retry-after`), 5xx → `PROVIDER_ERROR`, network →
  `NETWORK_ERROR` via `hubspotNetworkError`.
- **Redirect-URI pinning**: HubSpot pins the token endpoint's
  `redirect_uri` to the value used during `/authorize`. Same
  instance-cache pattern as PayPal (step 19) — `getAuthorizeUrl`
  stashes the URL and `handleOAuthCallback` echoes it back.
- **No mode badge**: HubSpot accounts are always "live"
  (developer-test accounts use a different `accountType`, not a
  separate environment). The connection card just shows
  `<ui_domain> (Hub <portal_id>)` without any coloured badge. The
  amber/emerald badge chain in
  `connection-status-card.tsx` continues to handle Mollie's
  `key_type`, Stripe's `livemode`, and PayPal's `environment` —
  HubSpot simply never sets any of those keys, so the chain
  short-circuits to "no badge".
- **Configuration gate**: when `HUBSPOT_CLIENT_ID` /
  `HUBSPOT_CLIENT_SECRET` are blank the wizard still renders but
  the "Connect with HubSpot" button is disabled and a
  `<HubSpotConfigWarning />` banner explains the gap. Same pattern
  as Stripe + PayPal.
- **Metadata**: `portal_id` (numeric `portalId` cast to string),
  `account_type`, `company_currency`, `ui_domain`, `time_zone`,
  `expires_at` — surfaced on the connection card.
- **UI**: 5-step `<HubSpotInstructions />` card with side-by-side
  BYOA + Free CRM notices, plus an auto-sync callout describing
  the AI-agent → HubSpot lead flow.

#### Testing HubSpot locally

1. Sign up for a free HubSpot Developer account at
   developers.hubspot.com.
2. My Apps → Create App → fill in basic info, set the redirect URI
   to `http://localhost:3000/api/connectors/oauth/callback?providerId=hubspot`
   (or whichever dev port you use), and pick scopes `oauth`,
   `crm.objects.contacts.read`, `crm.objects.contacts.write`.
3. Copy the **Client ID** and **Client Secret** → paste into
   `.env.local` as `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET`.
4. Restart the dev server. `/account/connections/add/hubspot`
   now shows an enabled "Connect with HubSpot" button. Clicking
   it redirects you to a real OAuth page — completing the
   handshake stores the Hub's UI domain + numeric portal ID on
   the connection.

Without those env vars the wizard renders the config-incomplete
banner instead — perfect for previewing the UI without a HubSpot
developer account. Tests stub all HTTP via `fetchImpl`; no real
OAuth ever fires in CI.

### Pipedrive CRM (step 21)

The second CRM connector. Sales-focused (deal pipelines as the
central abstraction), where HubSpot covers the marketing-CRM angle.
Both live side-by-side under the `crm` category — customers pick
the one that fits their team. Internationally available (NL + CW).

- **Region-aware API**: every Pipedrive company runs on its own
  `<company>.pipedrive.com` host. The OAuth token response carries
  `api_domain` (e.g. `https://demo-restaurant.pipedrive.com`) — we
  cache it on the connection's credentials so subsequent REST
  calls land on the right region without re-deriving. The
  `PipedriveClient` constructor requires `apiDomain` upfront; tests
  assert it's passed through to every fetch.
- **OAuth flow**: customer clicks "Connect with Pipedrive" →
  `/api/connectors/oauth/start` → `oauth.pipedrive.com/oauth/authorize`
  (NO `scope` query param — scopes are configured in the app
  registration, not the URL) → callback → Basic-auth POST to
  `oauth.pipedrive.com/oauth/token` → `/api/v1/users/me` probe on
  the region-specific host → vault-stored credentials with
  `api_domain` baked in.
- **Refresh tokens** always issued; access tokens last 1 hour.
  Both `metadata.expires_at` and `credentials.expires_at` populated
  for the refresh-on-401 logic in step 22+.
- **Three-shape error envelope** (`mapPipedriveError`): REST
  endpoints return `{success:false, error, error_info, errorCode}`
  while OAuth-style errors use `{error, error_description}`. The
  mapper prefers `error_info` (more specific text) but folds
  `error` (the short code-style label) into the user-facing
  message when both are present. 400/422 → `VALIDATION_FAILED`,
  401 → `InvalidCredentialsError`, 403 → `INSUFFICIENT_PERMISSIONS`,
  404 → `RESOURCE_NOT_FOUND`, 429 → `RATE_LIMITED` (with
  `retry-after`), 5xx → `PROVIDER_ERROR`, network →
  `NETWORK_ERROR`.
- **Strict response validation**: `exchangeCodeForToken` validates
  that the response includes both `refresh_token` AND `api_domain`
  — without either we cannot drive the rest of the connector. Same
  rogue-proxy guard as HubSpot, but doubled (PayPal/Stripe only
  guard the access_token).
- **Response-envelope unwrapping**: the client unwraps Pipedrive's
  standard `{success, data, additional_data}` envelope so callers
  see clean domain objects. If `success: false` lands with a 200
  (which Pipedrive does for some validation cases), the client
  routes it through `mapPipedriveError` so the error path is
  uniform.
- **Redirect-URI pinning**: same instance-cache pattern as
  PayPal/HubSpot.
- **No mode badge**: Pipedrive companies are always "live"
  (sandbox companies are a developer feature, not a separate
  environment). The connection card shows `<company_name>` (or
  `<company_domain>` as fallback) without any coloured badge.
- **Configuration gate**: when `PIPEDRIVE_CLIENT_ID` /
  `PIPEDRIVE_CLIENT_SECRET` are blank the wizard still renders
  but the OAuth button is disabled and a `<PipedriveConfigWarning />`
  banner explains the gap.
- **Metadata**: `user_id` (numeric `id` cast to string),
  `user_name`, `company_id` (cast to string), `company_name`,
  `company_domain`, `api_domain`, `locale`, `currency`,
  `expires_at`.
- **UI**: 5-step `<PipedriveInstructions />` with side-by-side
  BYOA + 14-day-trial notices, a sales-focused positioning hint
  (recommends HubSpot for marketing-CRM), and an auto-sync
  callout describing the AI-agent → Pipedrive contact → deal flow.

#### When to pick HubSpot vs Pipedrive

- **HubSpot** — marketing-CRM. Free tier covers everything most
  small businesses need, and the marketing/email automation tools
  are best-in-class. Pick this if your customer is unsure or
  marketing-focused.
- **Pipedrive** — sales-CRM. Visual deal pipeline is the central
  UI, and the integrations / reporting are deal-flow-oriented.
  Pick this if your customer has a sales team that lives in
  pipelines all day.

#### Testing Pipedrive locally

1. Sign up for a free Pipedrive Developer account at
   developers.pipedrive.com.
2. Marketplace Manager → Create App → fill in basic info, set
   the redirect URI to
   `http://localhost:3000/api/connectors/oauth/callback?providerId=pipedrive`
   (or whichever dev port you use), and tick scopes `base`,
   `contacts:read`, `contacts:full`.
3. Copy the **Client ID** and **Client Secret** → paste into
   `.env.local` as `PIPEDRIVE_CLIENT_ID` /
   `PIPEDRIVE_CLIENT_SECRET`.
4. Restart the dev server. `/account/connections/add/pipedrive`
   now shows an enabled "Connect with Pipedrive" button. Clicking
   it redirects you to Pipedrive's OAuth page; after consent the
   handshake stores `<company>.pipedrive.com` + the company name
   on the connection.

Without those env vars the wizard renders the config-incomplete
banner instead — perfect for previewing the UI without a Pipedrive
developer account. Tests stub all HTTP via `fetchImpl`; no real
OAuth ever fires in CI.

### Brevo (step 22)

The first **newsletter / email-marketing** connector — and the
fifth category in the hub UI alongside accounting, payments, CRM,
and the dev-only test connectors. Internationally available
(NL + CW). Brevo's free tier covers 300 emails/day with unlimited
contacts, so every Framewise tenant can use it without a budget
question.

- **API-key flow** (no OAuth, no env vars): customer pastes their
  own `xkeysib-…` key. Pattern reused from
  Mollie / Moneybird / e-Boekhouden.
- **Custom `api-key` header**: Brevo doesn't use
  `Authorization: Bearer …` — the wire shape is just a literal
  `api-key: xkeysib-…` header. Tests assert that
  `Authorization` is `undefined` so a future "helpful" edit
  doesn't accidentally regress to Bearer auth (the most common
  mistake when integrating Brevo for the first time).
- **Test endpoint**: `GET /v3/account` returns the merchant's
  email, address, and a list of plans. We surface a single
  primary plan + summed credits across all entries because Brevo
  can return multiple rows when a free marketing plan and a paid
  SMTP add-on co-exist on the same account.
- **Free-tier badge**: when `metadata.is_free_tier === true`, the
  connection card renders a blue "Free tier" badge alongside the
  account info. Distinct from the test/live mode chain
  (Mollie / Stripe / PayPal) — Brevo accounts are always "live"
  but the free vs paid distinction is still useful at-a-glance.
- **Sendinblue rebrand**: Brevo was Sendinblue until 2023.
  Existing accounts work seamlessly; the wizard surfaces a
  callout for users who remember the old name.
- **GDPR**: hosting in France + Germany. EU data protection, no
  data transfer to the US — the wizard surfaces this for tenants
  who care.
- **Error mapping** (`mapBrevoError`): standard
  `{ code, message }` envelope. 400 → `VALIDATION_FAILED`,
  401 → `InvalidCredentialsError`, 402 → `PAYMENT_REQUIRED`
  (insufficient credits — useful for future "this account is out
  of free emails" UX), 403 → `INSUFFICIENT_PERMISSIONS`,
  404 → `RESOURCE_NOT_FOUND`, 405 → `METHOD_NOT_ALLOWED`,
  406 → `NOT_ACCEPTABLE`, 429 → `RATE_LIMITED` (with
  `retry-after`), 5xx → `PROVIDER_ERROR`, network →
  `NETWORK_ERROR` via `brevoNetworkError`.
- **Metadata**: `email`, `company_name`, `full_name`, `country`,
  `plan_type`, `credits_remaining`, `is_free_tier`.
- **UI**: 4-step `<BrevoInstructions />` card with side-by-side
  Free Tier + BYOA notices, GDPR positioning, and a Sendinblue
  rebrand callout. The `xkeysib-` regex on the input field
  rejects obvious typos client-side before any server round-trip.

#### Testing Brevo locally

1. Sign up for a free Brevo account at brevo.com (no credit card).
2. Top-right account menu → SMTP & API → API Keys.
3. Click **Generate a new API key**, name it "Framewise dev",
   copy the `xkeysib-…` key.
4. In the dev server, log in as `owner@demo-restaurant.example`
   and visit `/account/connections/add/brevo`. Paste the key.
5. The wizard runs `GET /v3/account` and stores the email +
   company name + plan type on the connection. CI uses a stubbed
   `fetch`; no real keys ever land in pipelines.

### Mailchimp (step 23 — phase 6/7 complete)

The **last** connector. Mailchimp brings together patterns from
earlier providers — OAuth flow (Stripe/PayPal/HubSpot/Pipedrive),
region-aware client (Pipedrive's `apiDomain` → Mailchimp's
`apiEndpoint`), and the free-tier badge (Brevo's `is_free_tier`).
Internationally available (NL + CW). Forever Free tier covers
500 contacts and 1,000 emails/month.

Three Mailchimp-specific quirks not seen elsewhere:

- **3-step handshake**: `token → metadata → account`. Mailchimp's
  `/oauth2/metadata` endpoint is the ONLY way to discover the
  account's data-center prefix (`us1`, `us2`, `eu1`, …) which then
  becomes the API host. We persist `api_endpoint` + `dc` on the
  credentials envelope so future REST calls don't need step 2 again.
- **`Authorization: OAuth <token>`** — NOT `Bearer`. Most common
  Mailchimp integration mistake. Tests assert this exact wire shape
  on both `MailchimpClient` and `fetchMetadata` so a future
  "helpful" edit can't regress to Bearer.
- **No refresh tokens**: Mailchimp access tokens are permanent.
  `expires_in` from the token endpoint is always 0, and we don't
  persist `expires_at` on the credentials. Refresh-on-401 logic
  in step 24+ skips Mailchimp entirely.

Reuses earlier patterns:

- **OAuth override pattern** (`getAuthorizeUrl` +
  `handleOAuthCallback` from steps 18–21).
- **Region-aware client** (Pipedrive's per-account `api_domain` →
  Mailchimp's `api_endpoint`).
- **PayPal-style redirect_uri pinning** via instance-cache
  `lastRedirectUri`.
- **Free-tier badge** (Brevo's `is_free_tier` boolean → Mailchimp's
  `pricing_plan_type === 'forever_free'`). The blue "Free tier"
  badge on the connection card now lights up for both providers
  via the existing `freeTierBadge` label prop.

Configuration gate: when `MAILCHIMP_CLIENT_ID` /
`MAILCHIMP_CLIENT_SECRET` are blank the wizard still renders but
the OAuth button is disabled and a `<MailchimpConfigWarning />`
banner explains the gap.

Metadata: `account_id`, `account_name`, `email`, `login_email`,
`full_name`, `dc`, `api_endpoint`, `pricing_plan_type`,
`total_subscribers`, `is_free_tier`, `account_timezone`.

UI: 5-step `<MailchimpInstructions />` card with side-by-side
BYOA + Forever Free notices, a region-aware callout describing
the auto-detected data center, and an auto-sync notice.

#### When to pick Brevo vs Mailchimp

- **Brevo** (formerly Sendinblue) — EU-hosted (France + Germany),
  GDPR-strict, transactional + marketing emails, 300/day free.
  Pick this if your customer cares about EU data residency or
  needs lots of transactional sends.
- **Mailchimp** — US-hosted, marketing automation focus, richer
  template library, 1,000/month free. Pick this if your customer
  wants the polished editor experience and isn't bound by strict
  EU-only data rules.

#### Testing Mailchimp locally

1. Sign up for a free Mailchimp account at mailchimp.com.
2. Top-right account menu → Profile → Extras → Registered apps →
   Register an app.
3. Set the redirect URI to
   `http://localhost:3000/api/connectors/oauth/callback?providerId=mailchimp`
   (or whichever dev port you use).
4. Copy the **Client ID** and **Client Secret** → paste into
   `.env.local` as `MAILCHIMP_CLIENT_ID` /
   `MAILCHIMP_CLIENT_SECRET`.
5. Restart the dev server. `/account/connections/add/mailchimp`
   now shows an enabled "Connect with Mailchimp" button. Clicking
   it fires the 3-step handshake and stores the data-center
   prefix + account name on the connection.

Without those env vars the wizard renders the config-incomplete
banner instead. Tests stub all HTTP via `fetchImpl`; no real
OAuth ever fires in CI.

### Public website renderer (step 24 — fase 9 part 1/6)

The first slice of the public website. Customers' tenants now
render real content blocks at three entry points:

- **Path-prefix** (`/sites/<tenant>` and
  `/sites/<tenant>/<page-slug>`) — the dev-friendly route.
  Resolves the tenant via the path-prefix strategy in
  `src/lib/tenant/resolver.ts`. A small "admin preview" banner
  sits at the top so it's obvious which entry was used.
- **Subdomain / custom-domain** (`<tenant>.framewise.app/<slug>`,
  `villa-bonbini.com/<slug>`) — the canonical public route via
  the catch-all at `[locale]/(public)/[...slug]/page.tsx`. No
  banner; this is what real visitors see.

All three routes use the same `<PublicPageRenderer />`
(`src/components/public-site/`) so the output is byte-for-byte
identical regardless of how the tenant was resolved.

#### Block types shipped (4 of 8)

- **`hero`** — full-bleed section with optional background image,
  dark/light overlay, headline + subheadline + CTA.
- **`text`** — `prose`-class article body with left / center /
  right alignment.
- **`image`** — single image with caption + alt text, optional
  full-bleed, `next/image` with `sizes` matched to the layout.
- **`cta`** — coloured panel (primary / neutral / accent) with
  headline + subheadline + button.

The remaining four block types (`gallery`, `faq`, `pricing`,
`contact`) ship in step 25. The block registry skips unknown
types gracefully, so partially-migrated databases never crash
the renderer.

#### Architecture

- **Block registry** (`src/lib/blocks/registry.tsx`) — static
  `Record<BlockType, React.ComponentType>`. Adding a new block
  type means: declare in `types.ts`, add to `KNOWN_BLOCK_TYPES`,
  register the component. The `renderBlock()` helper returns
  `null` for unknown types so callers can `.map()` without
  worry.
- **Page resolver** (`src/lib/public-site/resolve-page.ts`) —
  takes `{ tenantId, pageSlug, locale }`, returns
  `ResolvedPage | null`. Empty slug maps to `home` (matches the
  seed convention). Filters out `draft` pages so unpublished
  drafts return 404. Defensive parsing on `block.data`: rows
  with missing required fields are dropped, not surfaced.
- **Locale fallback** (`src/lib/public-site/locale-fallback.ts`)
  — `getTranslatedString(map, locale, defaultLocale)` with a
  three-step chain: exact match → tenant default → first
  non-empty value (alphabetical for determinism). Empty strings
  count as missing so a partial translation doesn't render a
  blank.
- **Discriminated union** in `src/lib/blocks/types.ts` — every
  block type has its own `props` shape; the registry's
  `getBlockComponent()` lookup is the single point where the
  type widens to `ContentBlock`. JSX inside components stays
  fully typed.

Adds 27 tests (registry, locale-fallback, resolve-page) — total 741.

### Public website renderer (step 25 — fase 9 part 2/6)

Completes the block library with the 4 remaining types:

- **`gallery`** — multi-image gallery with 3 layouts that share
  the same data shape:
  - `grid` (default): even responsive grid with aspect-square
    cells. Use for matching photo sets.
  - `carousel`: horizontal scroll-snap row, swipeable on touch.
    Use when image count > 6 or images vary in importance.
  - `masonry`: CSS columns layout — natural aspect ratios stacked
    in a Pinterest-style grid.

  Captions render on hover (desktop) or always (touch); alt text
  is always present for screen readers.

- **`faq`** — accordion of Q&A pairs. Server-rendered using
  native `<details>` / `<summary>` elements so toggling works
  without JavaScript. The `<ChevronDown />` icon rotates 180° via
  Tailwind's `group-open:` variant. SEO-friendly and visible to
  the AI agent that scrapes the markup.

- **`pricing`** — comparison cards (up to ~3 per row). One plan
  can be marked `highlight: true` to get a primary-coloured ring,
  a `scale-105` boost, and a "Popular" / "Populair" badge in the
  active locale. Features render as a bullet list with
  `lucide-react` check icons.

- **`contact`** — the only **client** block (`'use client'`)
  because it owns local form state. Field set is configurable via
  `block.props.fields` (any subset of
  `name` / `email` / `phone` / `subject` / `message` in any
  order). A hidden `website` honeypot blocks bots without ever
  showing the field to humans — bots that fill it get a fake
  "success" response so they don't learn the trick. MVP
  behaviour: the payload logs to console + a translated success
  message replaces the form. Real mail submission via Resend
  lands in step 54; the `recipient_email` prop is already plumbed
  through.

#### Architecture additions

- **Resolver extended**: `resolve-page.ts` now has defensive
  parsers for each new block type — `parseGalleryImages`,
  `parseFaqItems`, `parsePricingPlans`, `parseContactFields`.
  Each drops malformed entries instead of crashing the page.
- **`VALID_CONTACT_FORM_FIELDS`** exported alongside the type for
  runtime validation in the resolver — keeps the type and the
  runtime allow-list in lock-step.
- **Seeds extended**: villa `over-ons` now has gallery + FAQ
  appended; new villa `tarieven` page with 3 pricing tiers
  (highlight on High-Season); villa `contact` + restaurant
  `contact` got a contact form; restaurant `menu` got a gallery.

Adds 27 tests (registry expansion, new `types.test.ts`,
resolve-page parsers for all 4 new blocks) — total 768.

### SEO & metadata (step 26 — fase 9 part 3/6)

The public renderer now emits a full SEO head per page: title, description,
OpenGraph, Twitter cards, hreflang alternates, a canonical URL, and two
JSON-LD blocks (`Organization` and `WebPage`). Three new helpers in
`src/lib/seo/`:

- **`og-image.ts`** — `resolveOgImage()` walks a deterministic fallback
  chain (`page.seo_meta.og_image_url` → `tenant.og_image_url` → first
  image found in the page's blocks → Picsum default keyed on the tenant
  slug) so every page gets a 1200x630 social card even before the
  customer has uploaded one.
- **`metadata.ts`** — `buildPageMetadata()` returns Next.js's `Metadata`
  shape. Title falls back through `seo_meta.title_translations` → first
  hero block headline → tenant name. Description follows the same chain
  via `seo_meta.description_translations` → first text block content
  (truncated at 160 chars). `noindex` on `seo_meta.noindex = true`.
- **`jsonld.ts`** — `buildOrganizationLD()` (`@type` derived from
  `tenant.organization_type`: `LodgingBusiness` for villas, `Restaurant`
  for restaurants, `Organization` as default) and `buildWebPageLD()`
  (`inLanguage` per locale, `isPartOf` linking to the tenant homepage).
  Rendered through `<script type="application/ld+json">`.
- **`base-url.ts`** — picks the absolute origin from
  `NEXT_PUBLIC_BASE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` →
  `VERCEL_URL` → `http://localhost:3000`. Override with
  `NEXT_PUBLIC_BASE_URL` to pin the canonical domain in production.

#### Schema additions

- `Tenant`: `og_image_url`, `organization_type` (`'LocalBusiness' |
'Restaurant' | 'LodgingBusiness' | 'Organization'`), `twitter_handle`.
- `Page`: `seo_meta` JSONB (`{ title_translations?,
description_translations?, og_image_url?, canonical_path?, noindex? }`).

All four are nullable and default to "use the fallback" — existing
tenants and pages keep working without a migration.

#### `generateMetadata` wiring

All three public routes export the same shape:

```tsx
export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) return {};
  const resolved = await resolvePage({ tenantId: tenant.id, pageSlug, locale });
  if (!resolved) return {};
  return buildPageMetadata({
    resolved,
    locale,
    baseUrl: resolveBaseUrl(),
    pathname: /* per-route */,
    allLocales: ['nl', 'fr', 'en'],
  });
}
```

The same routes inject two `<script type="application/ld+json">` tags
above `<PublicPageRenderer />` (`Organization` + `WebPage`).

#### hreflang strategy

`alternates.languages` always emits all three locales (nl/fr/en) using
the existing `localePrefix: 'as-needed'` rule from
`src/i18n/routing.ts`: `nl` has no prefix; `fr` and `en` are prefixed.

Adds 56 tests (og-image: 9, metadata: 22, jsonld: 16, base-url: 6,
plus 3 page-schema tests covering `seo_meta`) — total 824.

### Sitemap & robots (step 27 — fase 9 part 4/6)

Step 27 swaps the static `app/sitemap.ts` and `app/robots.ts` stubs for
dynamic, tenant-aware versions. Two new helpers in `src/lib/public-site/`:

- **`sitemap-builder.ts`** — `buildSitemap()` walks
  `pagesRepo.listByTenant()` and emits one `MetadataRoute.Sitemap`
  entry per published page. The homepage gets `priority: 1.0` and
  `changeFrequency: 'daily'`; inner pages get `0.8` and `'weekly'`.
  Drafts, archived rows, and pages flagged `seo_meta.noindex = true`
  are skipped. `alternates.languages` lists every entry in `nl-NL`,
  `fr-FR`, `en-US` so search engines find all locale variants.
- **`robots-builder.ts`** — `buildRobots()` returns a
  `MetadataRoute.Robots` payload allowing `/`, disallowing
  `/account/`, `/api/`, `/debug/`, `/login`, and pointing
  `Sitemap:` at `<baseUrl>/sitemap.xml`.

#### Multi-tenant strategy

The top-level routes pick the tenant in this order:

1. `getCurrentTenant()` — middleware-resolved tenant from the
   subdomain / custom-domain strategies. Pages live at the request
   origin, so `pathPrefix` is empty.
2. Fallback: `tenantsRepo.findBySlug('demo-villa')` and emit pages
   under `/sites/demo-villa`. This is what the Vercel preview host
   serves today; per-tenant sitemaps on the marketing host arrive
   in the domain wizard (fase 10, step 33).

`/sitemap.xml` revalidates every 60 s (`export const revalidate = 60`)
so a fresh page publish surfaces in the sitemap within a minute.
`/robots.txt` is statically rendered at build time and caches the
`Sitemap:` URL for `resolveBaseUrl()` — no per-request work.

Adds 27 tests (sitemap-builder: 18, robots-builder: 9) — total 851.

### Cookie consent (step 28 — fase 9 part 5/6)

Step 28 ships the GDPR-mandated cookie consent banner that every public
tenant page now wears. Three categories — `necessary` (always on),
`analytics`, `marketing` — with default-deny for the latter two until
the visitor opts in. Pre-checked boxes are forbidden under GDPR.

#### Storage layer (`src/lib/consent/`)

- **`types.ts`** — exports `ConsentChoices`, `ConsentRecord`,
  `DEFAULT_DENY`, `ACCEPT_ALL`, plus the storage key
  (`framewise_consent_v1`), version, TTL (365 days), and the
  `framewise:consent-changed` custom event name.
- **`storage.ts`** — `readConsent()` returns the stored record or
  `null` for missing / corrupt / version-mismatched / expired
  payloads (it never throws). `writeConsent()` persists +
  dispatches the change event. `clearConsent()` and
  `hasGivenConsent()` round out the API. All functions are
  SSR-safe (`typeof window` guards).

#### React layer (`src/components/consent/`)

- **`<ConsentProvider />`** — uses
  [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
  so the consent state is read straight from `localStorage` without
  any `setState`-in-effect. Subscribes to the `storage` event (other
  tabs) and the `framewise:consent-changed` event (same tab) so all
  subscribers stay in sync.
- **`<CookieBanner />`** — fixed-bottom banner with three buttons:
  "Customise" (opens modal), "Only necessary" (persists
  `DEFAULT_DENY`), "Accept all" (persists `ACCEPT_ALL`). Hidden once
  a valid consent record exists.
- **`<ConsentModal />`** — granular per-category switches. Mounts
  on demand (not via `display: none`) so `useState` re-initialises
  with the latest saved choices each time the user opens it.
- **`<CookieSettingsLink />`** — footer button that re-opens the
  modal so visitors can change or withdraw their choice. GDPR
  rule: withdrawing consent must be as easy as giving it.

#### Layout integration

A new `<PublicLayout />` wraps every public tenant page
(`(public)/[...slug]`, `sites/[slug]`, `sites/[slug]/[...rest]`).
It mounts the provider, the banner, the modal, and a
`<PublicFooter />` carrying the privacy / terms / cookie-settings
links. New placeholder routes `/<locale>/privacy` and
`/<locale>/terms` exist so the footer links resolve to a 200 page;
the real DPA + privacy template generator ships in step 93.

`useConsent()` exposes `choices`, `hasConsented`, `setChoices`,
`showBanner`, `showModal`, `openModal`, `closeModal` — analytics
loaders in later steps will gate on `choices.analytics === true`.

Adds 20 tests (consent-storage: 20) — total 871.

### Performance & ISR (step 29 — fase 9 part 6/6, FASE 9 COMPLETE)

Step 29 closes the public-renderer phase with the performance pass.
Three small libs and a `next.config.ts` header rule do most of the
work; the block components now opt into priority loading and
blur-up placeholders without changing their props.

#### Helpers (`src/lib/perf/`)

- **`isr-config.ts`** — `ISR_REVALIDATE.PUBLIC_PAGE = 60`,
  `SITEMAP = 60`, `STATIC_CONTENT = 3600`, `ROBOTS = 3600`. All
  windows live in one file so future audits don't have to grep
  three different routes.
- **`image-helpers.ts`** — `IMAGE_SIZES` presets the renderer
  hands to `next/image`'s `sizes` prop; `getBlurDataUrl()` rewrites
  Picsum URLs to `/10/10` for a near-free blur-up placeholder;
  `shouldPrioritizeImage()` flags the LCP candidate (hero block at
  position 0); `galleryGridSizes()` picks the right preset for a
  gallery's column count.

#### Block components

- **Hero** now sets `priority`, `fetchPriority="high"`,
  `sizes={IMAGE_SIZES.HERO_FULL}`, and a `blur` placeholder for
  Picsum sources.
- **Image** sets `loading="lazy"`, `sizes` matched to its
  `full_width` flag, and a blur placeholder.
- **Gallery** marks the first image of each layout `loading="eager"`
  (above-the-fold), the rest `lazy`, picks `sizes` from
  `galleryGridSizes(columns)`, and adds blur placeholders.

#### Routing

All three public routes plus the `/privacy` and `/terms`
placeholders export `revalidate = ISR_REVALIDATE.…` so Next renders
them through ISR rather than on every request.

#### `next.config.ts`

`headers()` now caches static asset extensions for a year
(`max-age=31536000, immutable`) and the `/sites/*` tree for 60 s
shared with a 5-minute SWR window. `experimental.optimizePackageImports`
includes `lucide-react` to keep the icon bundle slim.

#### Web Vitals

`<WebVitalsReporter />` (mounted by `<PublicLayout />`) logs FCP,
LCP, CLS, INP, and TTFB to the dev console. Production analytics
hook arrives in step 88.

Adds 20 tests (image-helpers: 14, isr-config: 6) — total 891.

### Onboarding wizard (step 30 — fase 10 part 1/5)

The first super-admin tool. JIJ logs in as `framewise@example.com`, goes
to `/admin/onboarding/new`, and walks through five steps to spin up a
new customer in one go: company info, country, slug + plan, tax + legal
address, and a review screen. Submitting calls a server action that
runs `createTenant()` — an atomic-ish orchestrator that creates the
tenant, the owner user, the tenant↔user link, the country settings,
and seeds the per-country/per-plan setup checklist. The success card
renders the freshly generated 16-character initial password exactly
once; refresh of the page loses it.

Permission gate: the page redirects to `/account` for any logged-in
user that isn't the seeded super-admin id. The server action repeats
the check so a malicious POST can't bypass the page-level guard.

Files:

- `src/lib/onboarding/types.ts` — `OnboardingFormData`,
  `OnboardingResult`, `ONBOARDING_STEPS`.
- `src/lib/onboarding/validation.ts` — five Zod schemas (one per
  wizard step + a combined one) with country-conditional VAT/CRIB
  refines.
- `src/lib/onboarding/create-tenant.ts` — orchestrator + the
  16-char alphanumeric password generator. Best-effort rollback on
  failure mid-way; real transactions land with the Supabase
  adapter (step 119).
- `src/app/(i18n)/[locale]/(auth-required)/admin/onboarding/new/`
  — server `page.tsx` (super-admin gate), `actions.ts` (server
  action with re-validation), `wizard.tsx` (client form covering
  all five steps).
- Account page now exposes a "→ Nieuwe klant onboarden" shortcut
  for super-admin sessions only.

The first onboarded tenant lands with `status: 'onboarding'` so the
maintenance shell renders until the super-admin manually flips the
status (the site-live gate ships in step 32).

Adds 42 tests (validation: 24, create-tenant: 18) — total 933.

### Setup checklist UI (step 31 — fase 10 part 2/5)

The customer-facing `/account/setup` page now groups the onboarding
checklist by category in addition to the existing required/optional
split. Step 11 already shipped the underlying engine: per-(country, plan)
templates in `src/lib/checklist/templates.ts`, an `ensureChecklistForTenant`
seeder, and `computeChecklistProgress` with auto-detect against
`provider_connections` + `tenants.{vat_number,crib_number,custom_domain}`.
Step 31 adds the UI shell on top of that and a small `ui-helpers`
module so the page doesn't have to recompute the grouping itself.

- `src/lib/checklist/ui-helpers.ts` — `groupChecklistByCategory()`
  (uses a stable `CATEGORY_ORDER`), `allRequiredDone()`,
  `firstPendingRequired()`, plus emoji icons re-exported from the
  barrel as `CATEGORY_ICON`. Categories with zero items are
  omitted — Basic plans get no CRM/newsletter sections.
- `src/components/checklist/checklist-category.tsx` — server
  component that renders one category section: header with
  icon + "X/Y done" counter + "required pending" pill, then a
  1-col grid of the existing `<ChecklistItemCard />`.
- `/account/setup` page extended with a success-state card
  (rendered when `canTenantGoLive`), the new "By category"
  section, and the per-category server-action passthrough so
  manual items keep their toggle buttons.
- Translations: `account.setup.categoryName.*`, `categoryProgress`,
  `pendingRequiredBadge`, `categorySection.{title,subtitle}`,
  `successTitle`, `successBody` in NL / FR / EN.

Auto-detect is unchanged from step 11 (`resolveAutoComplete` in
`progress.ts`): connector → connected, tenant field → non-empty,
manual → never auto-completes. The publish action itself ships in
step 32; the success card only hints "ask Framewise to publish".

Adds 17 tests (ui-helpers: 17) — total 950.

### Site-live gate (step 32 — fase 10 part 3/5)

The "publish" trigger the super-admin pulls when a customer's
checklist is green (step 32). Maintenance render already existed
in the locale layout; this step adds the publish/unpublish
actions, the super-admin preview bypass, and a customer-facing
"Awaiting publication" card.

- `src/lib/site-lifecycle/maintenance-check.ts` — pure mapping
  from `TenantStatus` to a `SiteRenderDecision`
  (`live` → public, `onboarding`/`paused` → maintenance,
  `cancelled` → 404) plus `shouldBypassMaintenance()` for the
  super-admin preview rule.
- `src/lib/site-lifecycle/publish.ts` — `publishSite()` gates on
  `canTenantGoLive` and `canTransitionTo`, flips the tenant to
  `live`, logs a structured audit line. `unpublishSite()` only
  fires when the tenant is currently `live`, flips it to
  `paused`. Both return a discriminated `PublishResult` with a
  stable `errorCode` the UI can localise.
- `src/components/account/setup/publish-button.tsx` — client
  island. Renders the publish CTA when status = maintenance,
  swaps to a "site is live + take into maintenance" card when
  status = live.
- `src/components/account/setup/awaiting-publication.tsx` —
  read-only card for the customer-side view. Tells them whether
  Framewise can publish yet and how to reach support.
- Setup page renders `<PublishButton />` for super-admin,
  `<AwaitingPublication />` for everyone else.
- Locale layout: super-admin bypasses the maintenance shell on
  any tenant page so a half-built customer site stays previewable.
- Translations: `account.setup.publish.*` and `account.setup.awaiting.*`
  in NL / FR / EN.

Adds 16 tests (maintenance-check: 8, publish: 8) — total 966.

### Domain wizard (step 33 — fase 10 part 4/5)

Super-admin tool to attach a customer's own domain (`klant.nl`) to
their tenant. Wizard at `/admin/tenants/[tenantId]/domain/` walks
through: enter the domain → show DNS records → check verification →
success card. State lives client-side so the customer can leave the
page open and come back later.

- `src/lib/domain/vercel-client.ts` — `VercelDomainsClient`
  interface + `MockVercelDomainsClient` that advances
  `pending_dns` → `ssl_pending` → `active` on successive
  `verifyDomain()` calls. Real Vercel API integration ships
  behind `VERCEL_API_TOKEN` in a later step.
- `src/lib/domain/setup.ts` — `startDomainSetup()`,
  `verifyDomainSetup()`, `removeDomainSetup()`. The first call
  validates the hostname, checks no other tenant owns it, asks
  the Vercel client to register it, and writes
  `tenants.custom_domain`. The verify call re-polls Vercel and
  returns the updated status + DNS records.
- `src/app/(i18n)/[locale]/(auth-required)/admin/tenants/[tenantId]/domain/`
  — `page.tsx` (super-admin gate, 404 on unknown tenant) +
  `actions.ts` (server actions with permission re-check) +
  `wizard.tsx` (client form with the three steps inline).
- Custom-domain routing was already wired in step 7's tenant
  resolver — no middleware changes needed.

Adds 21 tests (vercel-client: 9, setup: 12) — total 987.

### Branded maintenance page (step 34 — fase 10 part 5/5, FASE 10 COMPLETE)

Step 34 swaps the bare maintenance shell for a branded one and
gives super-admins a settings form to customise it.

- `Tenant` gains three optional fields:
  `maintenance_message_translations` (per locale),
  `maintenance_logo_url`, `maintenance_contact_email`. All
  nullable so existing tenants keep working — the renderer
  falls back to a Framewise default frame when nothing is set.
- `src/lib/maintenance/` — `resolveMaintenanceMessage()` walks
  the locale fallback chain (`locale` → `tenant.default_locale`
  → any non-empty entry → framework default).
  `hasMaintenanceBranding()` is the bool the UI uses to decide
  whether to render the customer's logo or the initial-letter
  placeholder.
- `src/components/maintenance-page.tsx` — server component:
  gradient background, tenant logo (or initial), localised
  headline + message, optional mailto link to the contact
  email, "Powered by Framewise" footer.
- `/admin/tenants/[tenantId]/maintenance` (super-admin only) —
  settings form with logo URL + contact email + three locale
  text areas. Server action validates via Zod and writes the
  three columns in one update.
- Locale layout passes `locale` into `<MaintenancePage />` so
  the visitor's language wins over the tenant default.

Adds 14 tests (lib/maintenance: 14) — total 1001 🎉

### Super-admin tenant overview (step 35 — fase 11 part 1/4)

JIJ-as-super-admin's starting screen. `/admin/tenants` shows every
customer tenant in one sortable, filterable, paginated table —
the place to navigate from when the day's "what's next?" decision
is "which customer needs attention right now?".

- `src/lib/admin/tenant-list.ts` — `listTenantsForAdmin()`. Pure
  filter → sort → paginate over `tenantsRepo.list()`, then
  `Promise.all` over `calculateTenantStats()` to hydrate each
  surviving row. Filters: `search` (matches name / slug /
  custom_domain, case-insensitive), `status`, `country`, `plan`.
  Sort columns: `name`, `created_at`, `status`, `plan`. Default
  sort: `created_at desc`.
- `src/lib/admin/tenant-stats.ts` — `calculateTenantStats()`.
  Returns checklist totals + required-slice + `canGoLive` +
  active connector count + days old + last activity. Used by
  both the table rows and the per-tenant dashboard.
- `src/components/admin/tenants/` — `<StatusBadge />` (reusable),
  `<TenantStatsCard />` (five top tiles: total, in onboarding,
  ready-to-publish, live, paused), `<TenantFilters />` (client
  island, debounced search, URL-mirrored state), `<TenantTable />`
  (server-rendered, sortable headers, per-row action buttons to
  /domain and /maintenance).
- `/admin/tenants/page.tsx` — super-admin gate, query-param
  parser, full page assembly.
- `/admin/tenants/[tenantId]/page.tsx` — per-tenant dashboard
  placeholder. Three info cards (general, setup progress,
  activity) + shortcut links to the existing tools. Full
  audit log + connection feed lands in step 36.
- Translations: `admin.tenants.*` in NL / FR / EN.

Adds 28 tests (tenant-list: 21, tenant-stats: 7) — total 1029.

### Per-tenant super-admin dashboard (step 36 — fase 11 part 2/4)

The "command centre" for a single customer. `/admin/tenants/[tenantId]`
replaces the step 35 placeholder with the full work surface the
super-admin uses to manage one customer end-to-end. Six composable
sections render side-by-side: a status-aware header, KPI strip,
audit log, per-connector status, inline publish/unpublish, and a
preview link.

- `src/lib/admin/audit-log-view.ts` — `listRecentAuditEvents()`.
  Synthesizes audit events from existing timestamps because the
  generic `audit_log` table doesn't ship until step 88. Sources:
  `tenants.created_at` → `tenant_created`, `tenants.updated_at`
  (when ≠ created) → `site_published` / `tenant_updated`,
  `tenant_users.invited_at` → `member_invited`,
  `provider_connections.connected_at` → `connection_added`.
  Sorted desc by `createdAt`, capped at `limit` (default 20).
  Same shape as step 88's real audit table, so consumers won't
  refactor when the data source flips.
- `src/lib/admin/connection-status.ts` — `getConnectionStatusForTenant()`
  always returns _every_ provider in the registry so the
  dashboard surfaces what's missing as well as what's wired.
  `isConnected` is `true` only for `status === 'connected'`;
  `expired` / `error` surface via `hasError`.
  `groupConnectorsByCategory()` buckets by accounting / payments /
  crm / newsletter / phone and drops empty categories.
- `src/components/admin/tenant-dashboard/` — six sections:
  - `<DashboardHeader />` — server component, name + status +
    country flag + plan badge + days-old; nav strip with open-site,
    setup, domain, maintenance links.
  - `<StatsOverview />` — 4-tile KPI strip: setup %, active
    connectors, days active, can-go-live ✅/❌ (emerald vs amber).
  - `<AuditLogCard />` — server component with action icons,
    "X min/u/d ago" formatter, last-20 events, empty-state copy.
  - `<ConnectionsCard />` — grouped by category, status dot
    (green / red / grey), per-row Configure link.
  - `<InlineActions />` — client island, `useTransition`,
    status-aware: `live` → unpublish with `confirm()`, `cancelled`
    → read-only banner, `onboarding|paused` → publish (disabled
    until checklist requirements met). Reuses step 32's
    `publishSiteAction` / `unpublishSiteAction`.
  - `<PreviewCard />` — link out to `/sites/{slug}` or the custom
    domain; no iframe (Vercel COEP blocks cross-origin frames).
- `/admin/tenants/[tenantId]/page.tsx` — single `Promise.all` for
  stats + audit events + connectors + subscription. 2-column
  grid on lg+ (audit + connections left, actions + preview right),
  collapses to single column on mobile.
- Translations: `admin.tenantDashboard.*` in NL / FR / EN —
  full localisation for headers, stats labels, audit action
  names, connector category labels, action copy, and preview
  banners.

Adds 19 tests (audit-log-view: 10, connection-status: 9) — total 1048.

### Audit-log full viewer + CSV export (step 37 — fase 11 part 3/4)

The dashboard card from step 36 shows the last 20 events.
Step 37 promotes the audit log to a first-class page so the
super-admin can filter, paginate, and export the full history
— critical for compliance + troubleshooting once a customer
has been live for a while.

- `src/lib/admin/audit-log-filters.ts` — `listFilteredAuditEvents()`.
  Re-runs `listRecentAuditEvents()` with a 10 000-event cap,
  then filter-chains by date range / action types (multi) /
  user / case-insensitive search over metadata + user name,
  sorts (asc | desc), paginates (default 50), and derives the
  `uniqueActionTypes` + `uniqueUsers` for the filter dropdowns.
  Filters AND across dimensions; within `actionTypes` it's OR.
- `src/lib/admin/audit-log-export.ts` — `buildAuditLogCsv()`
  with UTF-8 BOM + CRLF line endings (Excel-friendly) + RFC
  4180 quoting. `getCsvFilename()` produces a date-stamped,
  filesystem-safe name (`audit-log-{slug}-{YYYY-MM-DD}.csv`).
- `src/components/admin/audit/` — `<AuditFilters />` (client,
  URL-mirrored, debounced search), `<AuditTable />` (server
  shell), `<AuditRow />` (client island for expand state with
  pretty-printed JSON metadata), `<ExportCsvButton />` (client
  download trigger via `Blob` + anchor `click()`).
- `/admin/tenants/[tenantId]/audit/page.tsx` — super-admin
  gate, query-param parser, full page assembly + pagination.
  `actions.ts` exposes `exportAuditLogCsvAction` which re-runs
  the filter chain server-side without a page cap so the
  download mirrors the visible filter set, not just the
  current page.
- Step 36 dashboard card gets a "View all →" deep-link into
  the new viewer (`audit-log-view-all` testid).
- Translations: `admin.auditLogPage.*` in NL / FR / EN.

Adds 29 tests (audit-log-filters: 18, audit-log-export: 11) — total 1077.

## Status

In development - Step 37 of 96 (revised plan) — FASE 11 deel 3/4 (audit log full viewer)
