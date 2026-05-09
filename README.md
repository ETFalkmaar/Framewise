# Framewise

Multi-tenant website builder with built-in AI agent.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) + TypeScript strict
- [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) (Base UI)
- [Inter](https://rsms.me/inter/) + [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via `next/font`
- [Supabase](https://supabase.com/) (planned)
- [next-intl](https://next-intl.dev/) for NL / FR / EN (planned)
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
| `npm run build`        | Production build             |

### Pre-commit hooks

Husky 9 + lint-staged run automatically on every commit:

- Staged `.ts|.tsx|.js|.jsx|.mjs` files: ESLint `--fix` then Prettier `--write`
- Staged `.json|.md|.css` files: Prettier `--write`
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, ...) — enforced by
  commitlint.

### Continuous integration

Every pull request runs four parallel jobs in GitHub Actions: `lint`,
`format-check`, `type-check`, `build`. All four must pass before a PR can
auto-merge to `main`.

## Status

In development - Step 3 of 118
