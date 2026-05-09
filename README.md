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

## Status

In development - Step 5 of 118
