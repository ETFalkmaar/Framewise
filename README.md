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

## Status

In development - Step 19 of 118 (revised plan)
