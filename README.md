# Bachelor party site

Private site and database for comparing Boston and NYC for Toby's bachelor party (22-23 May 2027).
The spec is `docs/requirements.md`.

## Layout

- `docs/` – requirements, research, project rules, decisions.
- `supabase/migrations/` – database schema (Postgres).
- `supabase/seed.sql` – seed data from requirements section 7. Estimates load as unverified.
- `src/` – the site (React + Vite + TypeScript). `src/lib/cost.ts` is the cost formula.
- `tests/` – tests, run against in-process Postgres (PGlite).

## Run the tests

```bash
npm install
```

```bash
npm test
```

## Run the site

```bash
npm run dev
```

With no `.env` it runs in demo mode: a throwaway database in the browser, with a "View as" picker for each role.

## Build stages

- [x] (a) Schema and seed data
- [x] (b) Cost calculator and Costs matrix
- [x] (c) Workings view and Verdict page
- [x] (d) Options, Decisions, Open questions
- [x] (e) Roles, groom view, publish switch
- [x] (f) CSV and Markdown export

Progress notes and the acceptance checklist: `docs/progress.md`. Going live: `docs/deploy.md`.
