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

## Status

In development - Step 7 of 118 (revised plan)
