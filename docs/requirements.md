# Bachelor Party Site: Requirements

Nov 16, 2026 · @Jack Morris

## 1. Purpose and scope

A private website and database where Jack and the group compare Boston and NYC for Toby's bachelor party (22-23 May 2027), log every option and decision, and where Toby can later see how the verdict was reached.

**In scope**

- Options and decisions store (hotels, activities, transport, payments), with sources and dates.
- Live per-person cost calculator: Budget, Mid, Premium; 2 and 3 nights; groups of 6, 8, 10 (and 12); GBP and USD; flights separate.
- Boston vs NYC verdict page showing the workings.
- Decision log and open questions, editable by the organiser.

**Out of scope (v1)**

- Taking payments, booking, or live price scraping.
- Flight search. Flights are a manual input.

**Success**

- Jack can answer "why Boston?" in one click, with every number traceable to a source and a date.
- Changing one input (headcount, rate, FX) updates every total.

## 2. Users and access

Three roles; the groom sees nothing until Jack publishes, because his preferences are still being sounded out discreetly.

| Role | Who | Can do |
| --- | --- | --- |
| Organiser | Jack | Everything: edit inputs, options, decisions, publish the groom view |
| Group | Invited guests (10-12, UK and US) | View, comment, vote on options; no edits to inputs |
| Groom | Toby | Read-only "verdict and workings" view, after publish only |

Access method (passcode link, email magic link, or platform login) is an open question in section 10. It must work on a phone and need no UK-specific account.

## 3. Functional requirements

M = must, S = should, C = could.

| ID | Requirement | Pri |
| --- | --- | --- |
| FR-01 | Store options by category (stay, activity, food, transport, payment) per city, each with cost, unit, tier, lead time, status | M |
| FR-02 | Every number links to a source (URL, date checked) or is flagged "unverified"; unverified items show a visible badge | M |
| FR-03 | Cost calculator: inputs are city, tier, nights (2 or 3), group size, local guests needing no bed, groom covered yes/no | M |
| FR-04 | Output per person in GBP and USD with the FX rate and its date shown beside the total; flights excluded and shown separately | M |
| FR-05 | Matrix view: tier x nights x group size (6, 8, 10, 12) for both cities side by side | M |
| FR-06 | Workings view: for any total, show the formula, every input, its source and its verified status | M |
| FR-07 | Decision log: date, decision, reason, who decided, linked options; append-only with edit history | M |
| FR-08 | Open questions list with owner, status, and a link to the decision that closes it | M |
| FR-09 | Verdict page: Boston vs NYC on cost, groom fit, UK logistics, risk; recommendation and the counter-case with a numbers check | M |
| FR-10 | Break-even tool: the hotel rate at which the cities tie, updated live | S |
| FR-11 | Assumptions register: each assumption (tax rates, beds per room, daily spend) editable, with the totals it affects | M |
| FR-12 | Source-conflict flag: where two sources disagree, store both and show the one used and why | S |
| FR-13 | Option voting and comments by group members | S |
| FR-14 | Itinerary builder: drag options into Sat/Sun slots, show per-person cost of the plan | S |
| FR-15 | Payment tracker: who owes what in their own currency, paid yes/no, buffer %, deposit deadlines (records only, no payment processing) | S |
| FR-16 | Groom view: read-only verdict and workings, hidden until Jack publishes | M |
| FR-17 | Export decisions and options to CSV and Markdown, so the Claude Project knowledge file can be refreshed | S |
| FR-18 | Stale-data warning when a verified price is older than a set number of days | C |

## 4. Data model

Ten tables. Every money value is stored in USD cents plus the currency it was quoted in; GBP is derived from the FX table at display time.

| Table | Key fields | Notes |
| --- | --- | --- |
| cities | id, name | Boston, NYC |
| options | id, city\_id, category, name, tier, price\_amount, price\_unit (per person, per room night, flat), currency, lead\_time\_days, status (shortlist, chosen, rejected), groom\_fit\_note, verified (bool) | One row per hotel, activity, transfer, meal plan |
| scenarios | id, name, city\_id, tier, nights, group\_size, local\_guests, groom\_covered | Saved calculator runs |
| assumptions | id, key, value, unit, reason, verified, city\_id (nullable) | Tax %, flat fee, beds per room, daily spend, activity budget |
| fx\_rates | id, from\_ccy, to\_ccy, rate, as\_of, source\_id | Latest row wins; history kept |
| sources | id, title, url, date\_checked, publisher, notes | Pages actually opened |
| source\_links | id, source\_id, entity\_type, entity\_id, quote\_or\_figure | Links any option or assumption to its source |
| conflicts | id, entity\_type, entity\_id, source\_a, source\_b, value\_a, value\_b, used, why | Where sources disagree |
| decisions | id, date, title, decision, reason, decided\_by, linked\_option\_ids | Append-only |
| open\_questions | id, question, owner, status (open, answered), answer, closed\_by\_decision\_id | Replaces the Project's open-questions list |

Supporting tables: guests (name, home\_country, bed\_needed, role: organiser/group/groom, currency), payments (guest\_id, amount, currency, due\_date, paid\_date), votes (option\_id, guest\_id, vote), comments (entity\_type, entity\_id, guest\_id, body, created\_at).

**Cost formula (as used in research phase 1)**

```latex
\text{rooms} = \lceil \text{beds needed} / \text{beds per room} \rceil
\text{stay pp} = \frac{\text{rooms} \times (\text{rate} \times (1 + \text{tax}) + \text{nightly fee}) \times \text{nights}}{\text{paying group size}}
\text{total pp} = \text{stay pp} + \text{daily spend} \times \text{nights} + \text{activities} + \text{NYC to Boston transfer (NYC only)}
```

Beds per room: Budget 4, Mid 2, Premium 2. Local guests need no bed but still pay daily spend and activities. If the group covers the groom, the paying group size includes him and his share is spread across all payers.

## 5. Pages and the workings view

Six pages. The workings view is the one the groom must be able to follow without help.

| Page | Shows | Who |
| --- | --- | --- |
| Verdict | Recommendation, one-screen summary, Boston vs NYC on cost, groom fit, UK logistics, risk; the counter-case | All (groom after publish) |
| Costs | Calculator and tier x nights x group matrix, GBP and USD, FX rate and date | Organiser, group |
| Workings | Step-by-step build-up of any total: inputs, formula, each figure with source, date, verified badge | All (groom after publish) |
| Options | Filterable list and detail per option, votes, comments, source, conflicts | Organiser, group |
| Decisions | Decision log and open questions | Organiser edits; group reads |
| Payments | Who owes what, in their currency, paid status | Organiser only |

**Workings view behaviour**

- Click any total to open its build-up: rooms, rate, tax, fee, nights, daily spend, activities, transfer.
- Each line carries a source link and date, or an "unverified" badge.
- Switch an assumption and see the total and the verdict change; reset returns to the saved values.
- Shows the break-even point (Boston 4-star rate at which the cities tie, about $548 a night for 2 nights Mid, from research phase 1) and which side of it the current inputs sit.
- Shows source conflicts beside the figure they affect.

## 6. Non-functional requirements

- **Privacy:** the site is private by default. No guest contact details beyond name and currency; no card or bank details stored anywhere.
- **Mobile first:** guests will open it on phones; every page usable at 375px wide.
- **Currency:** USD stored; GBP shown using the latest FX row, with its date always visible. Rounding to the nearest whole unit, never mid-calculation.
- **Traceability:** no figure without a source or an "unverified" badge. Unverified is the default for new rows.
- **Audit trail:** edits to inputs, options and decisions keep who, when and the old value.
- **Accessibility:** WCAG 2.2 AA contrast, keyboard navigation, no meaning carried by colour alone.
- **Performance:** calculator updates within 200 ms of an input change; no page needs more than one data load.
- **Portability:** data exportable to CSV and Markdown at any time (FR-17); no lock-in to one host.
- **Tone:** plain English, concise, GBP and USD labelled, dates in UK format on screen.

## 7. Seed data from research so far

Load these on day one. All room, daily-spend and activity inputs are estimates and must load as "unverified". Full detail is in the Project doc `claude/research-phase-1.md` (not yet updated with the latest answers).

**Facts and assumptions**

| Item | Value | Status |
| --- | --- | --- |
| Party dates | Sat 22 - Sun 23 May 2027, 2 nights | Decided 16 Nov 2026 |
| Wedding | Boston, Sun 30 May 2027 | Confirmed by Jack |
| Memorial Day 2027 | Mon 31 May (weekend 29-31 May): the wedding weekend, not the party weekend | Calendar fact |
| Headcount | 10-12 incl. groom; 3-4 Boston-based (no bed needed); groom needs a bed (lives in Minnesota) | Jack, 16 Nov 2026 |
| Group covers groom | Yes | Assumed; confirm with group |
| UK guests' travel | One trip; all on ESTA | Jack, 16 Nov 2026 |
| FX | 1 GBP = 1.32 USD (mid-market 1.3211) | exchangerates.org.uk, 16 Nov 2026 |
| Boston hotel tax | 14.95% | Unverified |
| NYC hotel tax | 14.75% plus $3.50 a night | Sources conflict ($1.50 vs $3.50) |
| NYC to Boston transfer | Bus $35, Regional rail $80, Acela $180 one way | Unverified |
| Flights (excluded from totals) | London to NYC and home from Boston, economy, about 600-700 GBP | Jack's estimate |

**Latest result: Budget tier, 2 nights, 12 people, 4 Boston-based, 8 beds in two four-person rooms (estimates)**

| Person | Boston | NYC |
| --- | --- | --- |
| Visiting guest | $540 (410 GBP) | $558 (423 GBP) |
| Boston-based guest | $310 (235 GBP) | $593 (449 GBP) |
| Group total | $5,019 (3,802 GBP) | $6,273 (4,752 GBP) |

**Decision log (seed)**

- 16 Nov 2026: Two nights.
- 16 Nov 2026: Group covers the groom's share (assumed; confirm with the group).
- 16 Nov 2026: Groom has not done Boda Borg or Level99, so both stay on the Boston shortlist.
- 16 Nov 2026: All UK guests travel on ESTA, so a shooting range session is open to them.

**Known source conflicts to load** NYC hotel flat fee ($1.50 vs $3.50); Royal Palms Shuffleboard price ($40 vs $50-60); Boston commencement hotel rates of $509-699 (rental operator marketing page); Level99 price (2024 Providence data); Boston College 2027 commencement date (inferred); firearm range price of $120 per person (third-party listing).

## 8. Acceptance criteria

- [ ] Seeded Budget, 2 nights, 12 people scenario reproduces the section 7 figures to the nearest dollar (Boston visiting guest $540, NYC $558).
- [ ] Changing group size, tier, nights or FX updates every total and the verdict without a reload.
- [ ] Every total opens a workings view listing each input with a source link and date, or an "unverified" badge.
- [ ] GBP and USD both show, with the FX rate and its date beside each total; flights never appear inside a total.
- [ ] The Costs matrix shows Budget, Mid, Premium x 2 and 3 nights x groups of 6, 8, 10 and 12 for both cities.
- [ ] A new decision cannot be deleted, only superseded; edit history shows who and when.
- [ ] Closing an open question requires linking the decision that answers it.
- [ ] A Group member cannot edit inputs or see the Payments page.
- [ ] The groom view returns nothing until Jack publishes, then shows Verdict and Workings read-only.
- [ ] Two conflicting sources for one figure both display, with the chosen one and the reason.
- [ ] CSV and Markdown export of options, decisions and open questions opens cleanly.
- [ ] All pages usable at 375px wide and pass a keyboard-only run-through.

## 9. Paste-in build prompt for Fable

Attach this doc, the knowledge file and `research-phase-1.md`, then paste:

```text
Build the website and database described in the attached requirements doc for Toby's bachelor party (Boston vs NYC, 22-23 May 2027).

Rules:
1. Treat sections 3 (requirements), 4 (data model), 5 (pages), 6 (non-functional) and 8 (acceptance criteria) as the spec. Anything marked TBC or unverified stays marked in the UI.
2. Use the platform's built-in database if it has one; otherwise propose a hosted Postgres or SQLite option and say why before building.
3. Build in this order and stop for my review after each: (a) schema and seed data from section 7; (b) cost calculator and Costs matrix; (c) Workings view; (d) Options, Decisions and Open questions; (e) roles, groom view and publish switch; (f) export.
4. Store money in USD cents plus quoted currency; derive GBP from the fx_rates table; always show the rate and its date.
5. Show the working for every number. No figure without a source link and date, or an "unverified" badge.
6. Mobile first, 375px wide. Plain English, concise, no filler copy.
7. Do not invent prices, rates or facts. Load estimates as unverified.
8. Before each step, list any assumption you are making. At the end, run through the section 8 checklist and report pass or fail for each line.
```

Build in stages so errors surface early, and check the step (a) schema against section 4 before anything else is built on it.

## 10. Open questions before build

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | Where is it hosted: a Claude artifact with its built-in database, Lovable, or your own host? | Decides auth, database, and whether the group can reach it. Unverified which Fable can deploy to from here. |
| 2 | How do group members get in: passcode link, email link, or login? | Shapes the roles in section 2 |
| 3 | Is Boston now the decision, or is the site built to show both until Toby is sounded out? | Changes whether the Verdict page is final or a draft |
| 4 | Which two nights: Fri-Sat or Sat-Sun? | Changes hotel dates and Memorial Day / commencement exposure |
| 5 | Real hotel rates and deposit terms for the chosen nights | Replaces the estimated room rates, which drive the verdict |
| 6 | Do guests vote, or only comment? | FR-13 scope |
| 7 | Should the Payments page be in v1, given payments run through Wise or PayPal? | FR-15 can be cut to a simple tracker |

**Knowledge file corrections to make before loading seed data (needs your approval):** it says Memorial Day weekend is the party weekend (it is 29-31 May, the wedding weekend) and that the groom lives in Boston (he lives in Minnesota). Neither has been edited.
