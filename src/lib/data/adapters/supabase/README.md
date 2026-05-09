# Supabase adapter — placeholder

This folder is intentionally empty. The real Supabase implementation of the
data-layer repositories lands in **step 119** of the 118-step plan (the
final migration step), at which point this folder will house one file per
repository, mirroring the layout of `../mock/`.

## Why later, not now

By keeping Supabase out of every preceding step we avoid:

- Maintaining a parallel set of mock + real implementations during early
  prototyping (one source of truth per phase).
- Coupling local development to a remote service before the schema and
  business logic have stabilised.
- Leaking Supabase types or auth conventions into application code (the
  repository pattern keeps them on this side of the boundary).

## Expected environment variables (do not add yet)

The Supabase adapter will read these from `process.env`. Keep them
**unset** until step 119 to make sure the mock adapter stays in use.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Migration checklist (step 119)

1. Create the Supabase project, run schema migrations that mirror
   `src/types/database.ts` exactly (snake_case columns, the same enums).
2. Generate the typed Supabase client with `supabase gen types typescript`
   and store it in `src/types/supabase.generated.ts`.
3. Implement each repository under `src/lib/data/adapters/supabase/<name>.ts`,
   exposing the same `*Repository` interface.
4. Replace the wiring in `src/lib/data/index.ts` so it imports from
   `./adapters/supabase` instead of `./adapters/mock`. No call sites change.
5. Smoke-test against a fresh tenant and run the same vitest suite that
   today exercises the mock adapter.
