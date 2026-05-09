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

## Status

In development - Step 10 of 118 (revised plan)
