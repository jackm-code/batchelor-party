# Build progress

Read this first when picking the build back up. Spec: `docs/requirements.md`.
Branch: `claude/compassionate-einstein-9g5ws3`.

| Stage | What | Status |
| --- | --- | --- |
| a | Schema and seed data | Done |
| b | Cost calculator and Costs matrix | Done |
| c | Workings view (and Verdict page) | Done |
| d | Options, Decisions, Open questions | Done |
| e | Roles, groom view, publish switch | Done |
| f | CSV and Markdown export | Done |

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

## Stage (c): Workings view and Verdict page

- `src/pages/Workings.tsx`: pick a city and a guest type, then read the total built up in numbered
  steps (beds, rooms, one room-night, all rooms, daily spend, activities, transfer, own costs, the
  groom's share, total, conversion to GBP). Each input shows its value, source link and date, and a
  Verified or Unverified badge. Source conflicts appear beside the figure they affect.
- What-if: every input has "Try a different value". It changes Costs, Verdict and the break-even at
  once, is never saved, and "Reset" returns to the stored value.
- Assumptions register (FR-11) at the foot of the page: every assumption, what it affects, its source.
- Any total on Costs, the matrix or Verdict links to its workings (`#/workings?city=..&who=..`).
- `src/pages/Verdict.tsx`: Boston, marked Provisional (from `app_settings.verdict_status`). Cost is
  live; fit, logistics and risk come from research phase 1; "The case for NYC" has a live numbers
  check against the break-even rate.
- The research point "the groom lives in Boston" was left out: Jack confirmed he lives in Minnesota.

## Stage (d): Options, Decisions, Open questions

- `supabase/migrations/20261116000200_writes.sql`: every change goes through a passcode-checked
  database function. `api_upsert` and `api_delete` (organiser), `api_supersede_decision`,
  `api_add_source`, `api_set_setting`, `api_vote` and `api_comment` (organiser and group).
- Rules: a figure cannot be marked verified without a source; exchange rates are add-only;
  decisions, options and assumptions cannot be deleted; the groom cannot vote or comment.
- `src/pages/Options.tsx`: filter by city, type and status. Each option shows price in both
  currencies, source and badge, conflicts, lead time, fit note, votes and comments. Organiser can
  add and edit options and attach a source.
- `src/pages/Decisions.tsx`: decision log with history (who, when, old value), edit, and "replace
  with a new decision". Open questions: add, and close only by choosing the decision that answers it.
- Workings: the organiser can save a what-if value as the stored value.
- `src/components/forms.tsx`: shared form helpers and the "your name" picker for votes and comments.
- `tests/api.test.ts`: 15 tests of the rules above.

Guests must be on the guest list to vote or comment; only the organiser can add them (stage e adds
the screen for that).

## Stage (e): roles, groom view, publish switch

| Role | Pages | Data sent by the database |
| --- | --- | --- |
| Organiser | All seven | Everything, including payments and the change log |
| Group | Verdict, Costs, Workings, Options, Decisions | No payments, no change log |
| Groom, before publish | "Nothing to see yet" | Only `{role, published: false}` |
| Groom, after publish | Verdict, Workings (read-only) | No decisions, questions, guests, votes, comments, payments or payment tools |

- `src/App.tsx`: page list per role, the groom's holding screen, and a "View as" picker in demo mode.
- `src/pages/Settings.tsx` (organiser): publish switch, provisional or final verdict, add an exchange
  rate (history kept), stale-source age, links to share, change log.
- `src/pages/Payments.tsx` (organiser): guest list (name, country, currency, bed needed), suggested
  share from the calculator with a buffer %, records of what is owed in the guest's own currency,
  due date, mark paid. Records only.
- Guests and payments are audited as well as inputs, options and decisions.
- `tests/roles.test.ts`: 7 tests, including that a private comment never reaches the groom.

Passcode links: `https://<site>/?k=<passcode>`. The passcode is saved on the device and removed from
the address bar. Demo passcodes are in `supabase/dev_seed.sql`; never run that file on the real database.

## Stage (f): CSV and Markdown export

- `src/lib/export.ts`: options, decisions and open questions as CSV; everything as one Markdown file
  laid out to replace the Claude Project knowledge file. Each figure carries Verified or Unverified
  and its sources. CSV cells that look like formulas are neutralised.
- `src/components/ExportPanel.tsx`: four download buttons on the Settings page (organiser only).
- `tests/export.test.ts`: 8 tests, including a strict CSV re-parse.

## Section 8 acceptance checklist (run 16 Nov 2026, demo database)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Seeded Budget, 2 nights, 12 people reproduces section 7 | Pass | Boston $540 / $310 / $5,019; NYC $558 / $593 / $6,273 (`tests/cost.test.ts`, and on screen) |
| 2 | Group size, tier, nights or FX updates every total and the verdict, no reload | Pass | Browser run: all totals and the Verdict changed; one page load in the whole run; update took 5 ms |
| 3 | Every total opens a workings view with source and date, or an unverified badge | Pass | All totals and all 48 matrix cells link to Workings; every input line carries a badge |
| 4 | GBP and USD both show with the FX rate and date; flights never in a total | Pass | Rate and date under each result card and each matrix table; flights are flagged and not calculator inputs (tested) |
| 5 | Matrix: 3 tiers x 2 and 3 nights x 6, 8, 10, 12, both cities | Pass | 6 tables, 4 group rows, 48 cells, USD and GBP in each |
| 6 | A decision cannot be deleted, only superseded; history shows who and when | Pass | Database trigger and `api_delete` both refuse (tested); History on each decision |
| 7 | Closing a question requires the decision that answers it | Pass | Database constraint (tested); the form asks for it |
| 8 | A Group member cannot edit inputs or see Payments | Pass | Write functions refuse the group passcode (tested); payments are never sent to that role; no page or controls |
| 9 | Groom view returns nothing until publish, then Verdict and Workings read-only | Pass | `tests/roles.test.ts`; browser run as the groom before and after |
| 10 | Two conflicting sources both display, with the one used and why | Pass with a gap | Both values, the one used and the reason show beside the figure. For three of the six seeded conflicts the research did not record which page gave which value, so no links |
| 11 | CSV and Markdown export opens cleanly | Pass | Strict CSV re-parse and table-width checks (tested); four files downloaded in the browser. Not opened in Excel itself |
| 12 | All pages usable at 375px and pass a keyboard-only run | Pass | No sideways scroll on any of the 7 pages; every control reachable by Tab; controls at least 44px; text contrast at least 4.5:1 in light and dark. Not tested with a screen reader |

73 automated tests pass (`npm test`).

## Not done yet

- **Go live:** the database is live on Supabase (16 Nov 2026) and the build points at it. Still to do: set the three passcodes and choose a static host. The site has not yet been loaded in a browser against the live database. See `docs/deploy.md`.
- **FR-14 itinerary builder** (a "should") is not built.
- **Saved scenarios:** the table and seed exist, but there is no "save this scenario" button yet.
- **Assumption text edits:** the organiser can change an assumption's number (Workings > "Try a
  different value" > "Save as the stored value") but cannot yet edit its reason or text facts in the UI.
- **Knowledge file:** `docs/bachelor-party-knowledge.md` still has the two errors (Memorial Day, groom
  lives in Boston). The site uses the corrected facts; the file itself is unedited.
