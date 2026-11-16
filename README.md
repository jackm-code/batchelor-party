# Bachelor party site

Private site and database for comparing Boston and NYC for Toby's bachelor party (22-23 May 2027).
The spec is `docs/requirements.md`.

## Layout

- `docs/` – requirements, research, project rules, decisions.
- `supabase/migrations/` – database schema (Postgres).
- `supabase/seed.sql` – seed data from requirements section 7. Estimates load as unverified.
- `tests/` – tests, run against in-process Postgres (PGlite).

## Run the tests

```bash
npm install
```

```bash
npm test
```

## Build stages

- [x] (a) Schema and seed data
- [ ] (b) Cost calculator and Costs matrix
- [ ] (c) Workings view
- [ ] (d) Options, Decisions, Open questions
- [ ] (e) Roles, groom view, publish switch
- [ ] (f) CSV and Markdown export
