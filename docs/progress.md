# Build progress

Read this first when picking the build back up. Spec: `docs/requirements.md`.
Branch: `claude/compassionate-einstein-9g5ws3`.

| Stage | What | Status |
| --- | --- | --- |
| a | Schema and seed data | Done |
| b | Cost calculator and Costs matrix | Done |
| c | Workings view | Next |
| d | Options, Decisions, Open questions | To do |
| e | Roles, groom view, publish switch | To do |
| f | CSV and Markdown export | To do |

## How to run

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

With no `.env`, the site runs in **demo mode**: a throwaway copy of the database inside the browser
(same schema, same seed), signed in as the organiser. Nothing is saved between reloads.

## Decisions that shape the build

- **Stack:** React + Vite + TypeScript, plain CSS. Supabase (Postgres) database. Static host (not yet chosen).
- **Access:** three passcode links (organiser, group, groom). Only a hash of each passcode is stored.
- **One data load:** tables are locked by row-level security. The site reads everything through the
  database function `api_bundle(passcode)`, which returns only what that role may see.
- **Design:** the `apple-ui-design` skill. Tokens are in `src/styles.css`. Secondary text is darker
  than the skill's grey so it passes WCAG AA.

## Stage (a): schema and seed

- `supabase/migrations/20261116000000_schema.sql`: ten core tables and four supporting tables from
  requirements section 4, plus `audit_log` and `app_settings`.
- Rules in the database: decisions cannot be deleted; a question cannot be closed without a decision;
  every edit to inputs, options and decisions is logged with who, when and the old value.
- `supabase/seed.sql`: requirements section 7 and research phase 1. Every price and estimate is unverified.
- `tests/schema.test.ts`.

Additions to section 4: `price_amount_high`, `quoted_amount(_high)`, `price_note`, `lead_time_note`,
`model_input`, `excluded_from_totals` on options; `value_text`, `status_note`, `currency` on
assumptions; `superseded_by` on decisions; `title` on conflicts; `slug` on options and sources.

## Stage (b): cost calculator and Costs matrix

- `src/lib/cost.ts`: the formula. Pure, unrounded, in USD cents.
- `src/lib/model.ts`: reads calculator inputs from the stored options and assumptions and keeps each
  figure's source, verified flag and conflicts. Also the break-even rate.
- `src/lib/format.ts`: the only place money is rounded (whole units, half up).
- `src/pages/Costs.tsx`: calculator, per-person results, break-even, the tier x nights x group matrix
  (6, 8, 10, 12; both cities; USD and GBP), and flights listed separately.
- `supabase/migrations/20261116000100_access.sql`: passcodes and `api_bundle`.
- `src/data/`: `api.ts` (Supabase or demo database), `store.tsx` (app state), `pgliteRpc.ts`.
- `tests/cost.test.ts`: 22 tests.

### The formula as built

```text
beds needed  = group size, minus Boston-based guests where they need no bed (Boston)
rooms        = beds needed / people per room, rounded up
stay total   = rooms x (rate x (1 + tax) + nightly fee) x nights
stay per bed = stay total / beds needed
own cost     = stay per bed (if they need a bed) + daily spend x nights + activities + transfer legs x fare
groom share  = groom's own cost / (group size - 1), if the group covers him
each pays    = own cost + groom share
```

This differs from the formula written in requirements section 4 (which divides the stay by the paying
group size). It is the only reading that reproduces the section 7 figures:
Boston $540 / $310 / $5,019 and NYC $558 / $593 / $6,273. In NYC, Boston-based guests need a bed
(three rooms for 12) and pay the transfer both ways. These rules are editable assumptions.

### Known differences from the docs

- Section 7 shows £410 and £423 for the visiting guest. The site shows £409 and £422, because it
  converts the unrounded total (section 6 forbids rounding mid-calculation).
- Research phase 1 shows NYC Premium, 2 nights as $2,106. The exact figure is $2,106.50, shown as $2,107.

## Not done yet (after stage f)

- Create the Supabase project, run the migrations and seed, set real passcodes with
  `select set_access_code('organiser', '...')`, and put the project URL and anon key in `.env`.
- Choose the static host and deploy.
- FR-14 itinerary builder (a "should") is not in this build.
