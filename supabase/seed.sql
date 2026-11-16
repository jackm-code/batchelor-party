-- Seed data (stage a). Sources: docs/requirements.md section 7,
-- docs/research-phase-1.md and docs/decisions-and-open-questions.md, all 16 Nov 2026.
-- Every price, rate and estimate loads as unverified (verified = false).
-- Only first-party facts (confirmed by Jack, or calendar facts) load as verified.
-- Money is USD cents. GBP quotes keep the quoted pence and are converted at 1.32.

select set_config('app.actor', 'seed', false);

insert into cities (id, name) values ('boston', 'Boston'), ('nyc', 'New York City');

-- ---------------------------------------------------------------------------
-- Sources (research phase 1, section 8). Figures came from search-result
-- extracts of these pages, so nothing linked to them counts as verified.
-- ---------------------------------------------------------------------------
insert into sources (slug, title, url, date_checked, publisher, notes) values
  ('jack', 'Jack (organiser), in conversation', null, '2026-11-16', 'Jack', 'First-party facts and estimates given by the organiser.'),
  ('memorial-day', 'Memorial Day dates', 'https://publicholidays.com/memorial-day/', '2026-11-16', 'publicholidays.com', null),
  ('mit-commencement', 'MIT commencement', 'https://commencement-origin.mit.edu/node/30', '2026-11-16', 'MIT', null),
  ('harvard-commencement', 'Harvard commencement and convocation schedule', 'https://hsph.harvard.edu/graduation/convocation-commencement/commencement-convocation-events-schedule/', '2026-11-16', 'Harvard', null),
  ('bc-senior-week', 'Boston College Senior Week', 'https://www.bc.edu/bc-web/offices/studentaffairs/sites/student-involvement/programs-and-services/senior-week.html', '2026-11-16', 'Boston College', 'Commencement date inferred from this page; not yet on the main commencement page.'),
  ('fx-exchangerates', 'Pounds to Dollars conversion', 'https://www.exchangerates.org.uk/Pounds-to-Dollars-currency-conversion-page.html', '2026-11-16', 'exchangerates.org.uk', null),
  ('virgin-lhr-bos', 'Virgin Atlantic flights to Boston', 'https://flights.virginatlantic.com/en/flights-to-boston', '2026-11-16', 'Virgin Atlantic', null),
  ('aerlingus-lon-bos', 'Aer Lingus flights from London to Boston', 'https://www.aerlingus.com/en-gb/flights-from-london-to-boston', '2026-11-16', 'Aer Lingus', null),
  ('kayak-lon-nyc-may', 'Kayak: UK to New York flights in May', 'https://www.kayak.co.uk/flight-routes/United-Kingdom-GB0/New-York-NYC.May.M05.ksp', '2026-11-16', 'Kayak', null),
  ('icelandair-lon-nyc', 'Icelandair flights from London to New York', 'https://www.icelandair.com/en-gb/flights/flights-from-london-to-new-york', '2026-11-16', 'Icelandair', null),
  ('shopback-nyc-bos', 'NYC to Boston: cheapest way (2026)', 'https://www.shopback.com/blog/travel/nyc-to-boston-cheapest-way-2026', '2026-11-16', 'ShopBack', null),
  ('peterpan-nyc-bos', 'Peter Pan bus: New York to Boston', 'https://peterpanbus.com/routes/new-york-ny-to-boston-ma-bus/', '2026-11-16', 'Peter Pan Bus Lines', null),
  ('rosales-nyc-bos', 'NYC to Boston transit', 'https://davidwilliamrosales.com/2026/04/02/nyc-to-boston-transit/', '2026-11-16', 'davidwilliamrosales.com', null),
  ('planetizen-138018', 'Planetizen article (node 138018)', 'https://www.planetizen.com/node/138018', '2026-11-16', 'Planetizen', null),
  ('engine-boston', 'Hotel prices: Boston', 'https://engine.com/data/hotel-prices/boston-ma', '2026-11-16', 'Engine', '2024-26 data.'),
  ('engine-nyc', 'Hotel prices: New York', 'https://engine.com/data/hotel-prices/new-york-ny', '2026-11-16', 'Engine', '2024-26 data.'),
  ('booking-boston', 'Booking.com: Boston', 'https://www.booking.com/city/us/boston.html', '2026-11-16', 'Booking.com', null),
  ('sparekeys-graduation', 'Boston graduation weekend rentals', 'https://sparekeysstay.com/boston-graduation-weekend-rentals/', '2026-11-16', 'Spare Keys Stay', 'A rental operator''s marketing page: treat with caution.'),
  ('roommaster-boston', 'Hotel tax: Boston', 'https://www.roommaster.com/hotel-tax/boston', '2026-11-16', 'roommaster', null),
  ('roommaster-nyc', 'Hotel tax: New York City', 'https://www.roommaster.com/hotel-tax/new-york-city', '2026-11-16', 'roommaster', null),
  ('taxo-nyc-hotel-tax', 'Hotel tax New York 2026', 'https://taxo-com.pages.dev/hotel-tax-new-york-2026', '2026-11-16', 'taxo', null),
  ('nowbam-107391', 'nowbam.com article (post 107391)', 'https://nowbam.com/?p=107391', '2026-11-16', 'nowbam.com', null),
  ('bnbcalc-boston-str', 'Boston short-term rental regulation guide', 'https://www.bnbcalc.com/es/blog/short-term-rental-regulation/boston-massachusetts-guide', '2026-11-16', 'BNBCalc', null),
  ('hiusa-boston-groups', 'HI Boston group travel', 'https://www.hiusa.org/group-travel/massachusetts/boston-19-stuart-street', '2026-11-16', 'HI USA', null),
  ('tourismattractions-mbta', 'Getting around Boston: MBTA guide', 'https://tourismattractions.net/usa/getting-around-boston-mbta-guide', '2026-11-16', 'tourismattractions.net', null),
  ('ridewise-bos', 'Cheapest Uber and Lyft from BOS', 'https://getridewise.com/blog/cheapest-uber-lyft-bos', '2026-11-16', 'RideWise', null),
  ('airporttransferportal-jfk', 'JFK airport guide', 'https://www.airporttransferportal.com/ar/airport-guides/jfk', '2026-11-16', 'Airport Transfer Portal', null),
  ('bettervacation-175544', 'thebettervacation.com article (post 175544)', 'https://thebettervacation.com/?p=175544', '2026-11-16', 'The Better Vacation', null),
  ('americancraftbeer-128821', 'americancraftbeer.com article (post 128821)', 'https://www.americancraftbeer.com/?p=128821', '2026-11-16', 'American Craft Beer', null),
  ('pulse-nyc-pint', 'NYC is the first major city to cross the $9 threshold for a pint of beer', 'https://www.pulse.bot/food-and-beverage/blogs/new-report-nyc-is-the-first-major-city-to-cross-9-threshold-for-a-pint-of-beer-cb9263c1-7108-476f-a4c0-a2bca9739c7f', '2026-11-16', 'Pulse', null),
  ('citiesinsider-boston-bars', 'Boston bars and pubs', 'https://citiesinsider.com/country/united-states/boston/bars-and-pubs/en', '2026-11-16', 'Cities Insider', null),
  ('bodaborg-prices', 'Boda Borg Boston: hours and prices', 'https://www.bodaborg.com/boston/hours-prices/', '2026-11-16', 'Boda Borg', null),
  ('escapetheroom-boston', 'Escape the Room Boston', 'https://escapetheroom.com/boston/', '2026-11-16', 'Escape the Room', null),
  ('bostoncalendar-experiential-bars', 'The 12 best experiential bars around Boston', 'https://thebostoncalendar.com/events/the-12-best-experiential-bars-around-boston', '2026-11-16', 'The Boston Calendar', null),
  ('improvasylum-faq', 'Improv Asylum FAQ', 'https://improvasylum.com/about/faq', '2026-11-16', 'Improv Asylum', null),
  ('mitmuseum-prices', 'MIT Museum admission prices', 'https://mitmuseum.mit.edu/admission-desk/prices', '2026-11-16', 'MIT Museum', null),
  ('stirmgroup-23655', 'stirmgroup.com article (post 23655)', 'https://stirmgroup.com/?p=23655', '2026-11-16', 'stirmgroup.com', null),
  ('prnewswire-tavern-of-tales', 'Now open: Tavern of Tales brings interactive gameplay to Mission Hill', 'https://www.prnewswire.com/news-releases/now-open-tavern-of-tales-brings-interactive-gameplay-to-mission-hill-300969969.html', '2026-11-16', 'PR Newswire', null),
  ('roomescapeartist-level99', 'Level99 Providence review', 'https://roomescapeartist.com/2025/02/13/level99-providence-review/', '2026-11-16', 'Room Escape Artist', 'Reviews the Providence venue, not Natick.'),
  ('noproscenium-beat-the-bomb', 'NYC: Beat The Bomb', 'https://www.noproscenium.com/nyc-beat-the-bomb/', '2026-11-16', 'No Proscenium', null),
  ('comedycellar-lineup', 'Comedy Cellar New York line-up', 'https://www.comedycellar.com/new-york-line-up/', '2026-11-16', 'Comedy Cellar', null),
  ('nomadotravel-comedy-cellar', 'Comedy Cellar', 'https://www.nomadotravel.app/en/attractions/comedy-cellar', '2026-11-16', 'Nomado Travel', null),
  ('timeout-hex', 'Hex & Co Union Square', 'https://timeout.com/newyork/things-to-do/hex-co-union-square', '2026-11-16', 'Time Out', null),
  ('whichmuseum-spyscape', 'SPYSCAPE New York tickets and prices', 'https://whichmuseum.co.uk/museum/spyscape-new-york-40080/tickets-prices', '2026-11-16', 'WhichMuseum', null),
  ('spygames-tickets', 'SPYGAMES tickets: New York', 'https://www.spygames.com/tickets-new-york', '2026-11-16', 'SPYGAMES', null),
  ('cityguide-bars-with-games', 'Bars with games in New York City', 'https://cityguidemagazine.com/article/Bars-with-Games-in-New-York-City', '2026-11-16', 'City Guide', null);

-- ---------------------------------------------------------------------------
-- FX. Rate used is 1.32 (mid-market 1.3211).
-- ---------------------------------------------------------------------------
insert into fx_rates (from_ccy, to_ccy, rate, as_of, source_id, note)
select 'GBP', 'USD', 1.32, '2026-11-16', id, 'Mid-market 1.3211, rounded to 1.32 in research phase 1.'
from sources where slug = 'fx-exchangerates';

-- ---------------------------------------------------------------------------
-- Options: stays. Modelled room rates are unverified assumptions, pre-tax,
-- for Fri 21 - Mon 24 May 2027. No live quote exists yet.
-- ---------------------------------------------------------------------------
insert into options (slug, city_id, category, name, tier, price_amount, price_unit, price_note, model_input, notes) values
  ('stay-boston-budget',  'boston', 'stay', '3-star hotel, 4 sharing a two-queen room', 'budget',  40000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified.'),
  ('stay-boston-mid',     'boston', 'stay', '4-star hotel, 2 sharing',                  'mid',     55000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified.'),
  ('stay-boston-premium', 'boston', 'stay', '5-star hotel, 2 sharing',                  'premium', 85000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified.'),
  ('stay-nyc-budget',     'nyc',    'stay', '3-star hotel, 4 sharing a two-queen room', 'budget',  33000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified. Hotels only: Local Law 18 rules out a group rental.'),
  ('stay-nyc-mid',        'nyc',    'stay', '4-star hotel, 2 sharing',                  'mid',     42000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified.'),
  ('stay-nyc-premium',    'nyc',    'stay', '5-star hotel, 2 sharing',                  'premium', 80000, 'per_room_night', 'Modelled rate before tax. Not a quote.', true, 'Deposit and cancellation terms not verified.');

insert into options (slug, city_id, category, name, tier, price_amount, price_unit, price_note, notes) values
  ('hi-boston-hostel', 'boston', 'stay', 'HI Boston hostel (group booking)', 'budget', null, 'per_person', 'Rates and deposit terms not published: ask.', 'Bookings of 8+ go through group sales; online bookings cap at 9 guests.'),
  ('boston-group-rental', 'boston', 'stay', 'Whole apartment sleeping 10', null, null, 'flat', 'Price unverified; advertised for graduation weekends.', 'Legal but restricted to registered, owner-occupied units; supply is thin.');

-- ---------------------------------------------------------------------------
-- Options: NYC to Boston transfer, one way. The three model rows are the
-- fares the calculator uses (Budget bus, Mid Regional, Premium Acela).
-- ---------------------------------------------------------------------------
insert into options (slug, city_id, category, name, tier, price_amount, price_unit, price_note, model_input, notes) values
  ('transfer-bus',      'nyc', 'transport', 'NYC to Boston by bus (Peter Pan, FlixBus, OurBus)', 'budget',  3500,  'per_person', 'One way. Typical $25-50, from $14.', true, '4h15 to 5h.'),
  ('transfer-regional', 'nyc', 'transport', 'NYC to Boston by Amtrak Northeast Regional',        'mid',     8000,  'per_person', 'One way. Range $50-130; saver $45-75 booked 4-8 weeks out.', true, 'About 4h.'),
  ('transfer-acela',    'nyc', 'transport', 'NYC to Boston by Amtrak Acela',                     'premium', 18000, 'per_person', 'One way. Range $130-330.', true, 'About 3h40.');

insert into options (slug, city_id, category, name, price_amount, price_amount_high, price_unit, price_note, notes) values
  ('transfer-night-owl', 'nyc', 'transport', 'NYC to Boston by Amtrak Night Owl', 2000, null, 'per_person', 'One way, on 6pm-8am trains.', 'About 4h.'),
  ('transfer-flight',    'nyc', 'transport', 'NYC to Boston by air (LGA or JFK)', 8000, 32000, 'per_person', 'One way.', '4-5h door to door.'),
  ('airport-boston-silver-line', 'boston', 'transport', 'Logan airport to hotel: Silver Line SL1', 0, null, 'per_person', 'Free inbound.', null),
  ('airport-boston-subway',      'boston', 'transport', 'Boston subway fare', 240, null, 'per_person', 'Per ride.', null),
  ('airport-boston-rideshare',   'boston', 'transport', 'Logan airport to hotel: Uber or Lyft', 1800, 3000, 'flat', 'Per car.', null),
  ('airport-nyc-airtrain',       'nyc',    'transport', 'JFK to hotel: AirTrain plus subway', 1175, null, 'per_person', 'AirTrain $8.75 plus subway $3.00.', null),
  ('airport-nyc-taxi',           'nyc',    'transport', 'JFK to hotel: taxi', 7000, null, 'flat', 'Flat fare, per car. About $90-115 with tolls, surcharges and tip.', null);

-- ---------------------------------------------------------------------------
-- Options: flights. Shown separately; never inside a total.
-- Quoted in GBP; USD cents derived at 1.32.
-- ---------------------------------------------------------------------------
insert into options (slug, city_id, category, name, price_amount, price_amount_high, price_unit, currency, quoted_amount, quoted_amount_high, price_note, excluded_from_totals) values
  ('flight-lhr-bos-virgin',   'boston', 'transport', 'Flight: London Heathrow to Boston return, Virgin (direct), 21-30 May 2027', 67452, null, 'per_person', 'GBP', 51100, null, 'From. Fare seen on the route page.', true),
  ('flight-lon-bos-aerlingus','boston', 'transport', 'Flight: London to Boston, Aer Lingus via Ireland, late May',                34003, null, 'per_person', 'GBP', 25760, null, 'From, each way.', true),
  ('flight-lon-nyc-kayak',    'nyc',    'transport', 'Flight: London to NYC return, May 2027 average',                            81048, null, 'per_person', 'GBP', 61400, null, 'Average. Best deals from £370.', true),
  ('flight-lon-nyc-icelandair','nyc',   'transport', 'Flight: London to NYC return, Icelandair (1 stop)',                         57552, null, 'per_person', 'GBP', 43600, null, 'From.', true),
  ('flight-open-jaw-estimate','nyc',    'transport', 'Flight: London to NYC, home from Boston, economy',                          79200, 92400, 'per_person', 'GBP', 60000, 70000, 'Jack''s estimate. Not priced.', true);

-- ---------------------------------------------------------------------------
-- Options: activities. Lead times are estimates; the long end is stored.
-- ---------------------------------------------------------------------------
insert into options (slug, city_id, category, name, price_amount, price_amount_high, price_unit, price_note, lead_time_days, lead_time_note, groom_fit_note, notes) values
  ('boda-borg',              'boston', 'activity', 'Boda Borg, Malden (quest rooms)',            3200, 4500, 'per_person', '$32 for 2h, $45 for 4h.', 28, '3-4 weeks (estimate)', 'The only one of its kind in the US; suits a nerdy, social group. The groom has not done it.', 'Teams of 3-5, so split into 2-3 teams.'),
  ('level99',                'boston', 'activity', 'Level99, Natick (challenge rooms)',          3500, null, 'per_person', 'About $35 for 2h. From a 2024 review of the Providence venue.', 21, '2-3 weeks (estimate)', 'The groom has not done it.', '30-40 minute drive.'),
  ('escape-the-room-boston', 'boston', 'activity', 'Escape the Room Boston',                     3700, null, 'per_person', 'From.', 28, '3-4 weeks (estimate)', null, 'Two rooms, up to 20 at once, race mode.'),
  ('trapology',              'boston', 'activity', 'Trapology escape rooms',                     3800, 4500, 'per_person', 'About. From older sources.', 28, '3-4 weeks (estimate)', null, 'Private rooms.'),
  ('tavern-of-tales',        'boston', 'activity', 'Tavern of Tales (game-master board games)',  null, null, 'per_person', 'Price not published.', 28, '4+ weeks (estimate)', null, 'Private rooms seat 5; email for groups.'),
  ('versus-arcade',          'boston', 'activity', 'Versus arcade bar',                          500,  null, 'per_person', 'Cover; unlimited games.', 0, 'None: walk-in', null, null),
  ('improv-asylum',          'boston', 'activity', 'Improv Asylum',                              2900, 3500, 'per_person', 'About.', 28, '3-4 weeks (estimate)', null, 'Group seating tier. The late Saturday show is R-rated.'),
  ('mit-museum',             'boston', 'activity', 'MIT Museum',                                 2000, null, 'per_person', null, 7, '1 week (estimate)', null, 'Walk-in.'),
  ('museum-of-science',      'boston', 'activity', 'Museum of Science',                          3300, null, 'per_person', null, 7, '1 week (estimate)', null, 'Walk-in.'),
  ('f1-arcade',              'boston', 'activity', 'F1 Arcade, Seaport (sim racing bar)',        2000, 2500, 'per_person', 'For 3 races.', 21, '2-3 weeks (estimate)', 'The most sport-adjacent option.', 'Team racing for 4-12.'),
  ('boston-brewery',         'boston', 'activity', 'Harpoon or Trillium brewery',                null, null, 'per_person', 'Price not found.', null, null, null, null),
  ('beat-the-bomb',          'nyc',    'activity', 'Beat The Bomb, Brooklyn',                    4000, 4500, 'per_person', 'About.', 28, '3-4 weeks (estimate)', null, 'Teams of 4-6.'),
  ('comedy-cellar',          'nyc',    'activity', 'Comedy Cellar',                              2500, null, 'per_person', 'Fri/Sat cover, plus a two-item minimum.', 21, 'Book exactly when slots open, 2-3 weeks ahead', null, 'Reservations sell out fast.'),
  ('hex-and-co',             'nyc',    'activity', 'Hex & Co or The Uncommons (board game cafes)', 1000, 1500, 'per_person', '$10 walk-in, $15 reserved (3h).', 14, '1-2 weeks (estimate)', null, 'Reserve for a big table.'),
  ('spyscape',               'nyc',    'activity', 'SPYSCAPE',                                   4200, null, 'per_person', 'About.', 7, '1 week (estimate)', null, 'The private party rate needs 16 people.'),
  ('escape-game-nyc',        'nyc',    'activity', 'The Escape Game NYC',                        4500, 5100, 'per_person', 'About.', 28, '3-4 weeks (estimate)', null, 'Multiple rooms.'),
  ('barcade',                'nyc',    'activity', 'Barcade (arcade bar)',                       null, null, 'per_person', 'Pay per game.', 0, 'None: walk-in', null, null),
  ('royal-palms',            'nyc',    'activity', 'Royal Palms Shuffleboard, Brooklyn',         4000, 6000, 'flat', 'Per court-hour. Sources conflict.', 28, '3-4 weeks (estimate)', null, 'Reservations for parties of 10+.'),
  ('nyc-museum',             'nyc',    'activity', 'Museum of the Moving Image or Intrepid',     null, null, 'per_person', 'Not researched.', 7, '1 week (estimate)', null, 'Walk-in.'),
  ('shooting-range',         null,     'activity', 'Shooting range session (city TBC)',          12000, null, 'per_person', 'About 90 GBP a head. From a third-party listing.', null, null, null, 'Open to UK guests because all travel on ESTA. In or out is an open question.');

-- ---------------------------------------------------------------------------
-- Options: payment tools (knowledge file section 6; re-verify before committing).
-- ---------------------------------------------------------------------------
insert into options (slug, city_id, category, name, price_amount, price_unit, price_note, status, notes) values
  ('pay-wise',            null, 'payment', 'Wise',                             null, 'flat', 'Fee about 0.5-1.5%, from third-party figures.', 'chosen',    'Jack holds USD in Wise; guests pay by ordinary bank transfer.'),
  ('pay-paypal-pool',     null, 'payment', 'PayPal Pools',                     null, 'flat', 'Fees are higher. Pool fees and limits to verify.', 'shortlist', 'Fallback. Works for non-PayPal users; only the organiser needs an account.'),
  ('pay-card-link',       null, 'payment', 'Card payment link (e.g. SignUpGenius)', null, 'flat', 'Fees to verify.', 'shortlist', 'Payers need no account.'),
  ('pay-revolut-monzo',   null, 'payment', 'Revolut Group Bills or Monzo Split', null, 'flat', null, 'shortlist', 'Suits UK guests only.'),
  ('pay-splitwise',       null, 'payment', 'Splitwise',                        null, 'flat', null, 'shortlist', 'Tracks who owes what; settlement is separate.'),
  ('pay-venmo',           null, 'payment', 'Venmo',                            null, 'flat', null, 'rejected',  'A poor fit for UK guests.'),
  ('pay-forward-contract',null, 'payment', 'Forward contract (true rate lock)', null, 'flat', null, 'rejected',  'A business product; overkill here.');

-- ---------------------------------------------------------------------------
-- Assumptions register
-- ---------------------------------------------------------------------------

-- Cost model inputs. All unverified.
insert into assumptions (key, city_id, value, unit, currency, reason, status_note) values
  ('hotel_tax_pct',        'boston', 14.95, 'percent',   null,  'Hotel tax added to the room rate.', 'Unverified'),
  ('hotel_tax_pct',        'nyc',    14.75, 'percent',   null,  'Hotel tax added to the room rate.', 'Unverified'),
  ('hotel_nightly_fee',    'boston', 0,     'usd_cents', 'USD', 'No flat nightly fee in the Boston model.', 'Unverified'),
  ('hotel_nightly_fee',    'nyc',    350,   'usd_cents', 'USD', 'Flat fee per room per night, on top of hotel tax.', 'Sources conflict ($1.50 vs $3.50)'),
  ('beds_per_room_budget',  null,    4,     'beds',      null,  'Budget: four share a two-queen room.', 'Model set-up'),
  ('beds_per_room_mid',     null,    2,     'beds',      null,  'Mid: two share a room.', 'Model set-up'),
  ('beds_per_room_premium', null,    2,     'beds',      null,  'Premium: two share a room.', 'Model set-up'),
  ('daily_spend_budget',   'boston', 9500,  'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day.', 'Estimate'),
  ('daily_spend_mid',      'boston', 17000, 'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day.', 'Estimate'),
  ('daily_spend_premium',  'boston', 30000, 'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day.', 'Estimate'),
  ('daily_spend_budget',   'nyc',    10500, 'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day. NYC modelled about 10-12% above Boston.', 'Estimate'),
  ('daily_spend_mid',      'nyc',    19000, 'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day. NYC modelled about 10-12% above Boston.', 'Estimate'),
  ('daily_spend_premium',  'nyc',    34000, 'usd_cents', 'USD', 'Food, drink, local transport, tax and tip, per person per day. NYC modelled about 10-12% above Boston.', 'Estimate'),
  ('activity_budget_budget',  'boston', 7500,  'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('activity_budget_mid',     'boston', 15000, 'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('activity_budget_premium', 'boston', 27500, 'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('activity_budget_budget',  'nyc',    7500,  'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('activity_budget_mid',     'nyc',    17500, 'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('activity_budget_premium', 'nyc',    32500, 'usd_cents', 'USD', 'Activities for the whole trip, per person.', 'Estimate'),
  ('local_guests_need_bed',  'boston', 0, 'flag', null, 'Boston-based guests sleep at home in Boston.', 'Jack, 16 Nov 2026'),
  ('local_guests_need_bed',  'nyc',    1, 'flag', null, 'Boston-based guests need a bed in NYC.', 'Model set-up'),
  ('transfer_legs_visitor',  'boston', 0, 'legs', null, 'No transfer: the wedding is in Boston.', 'Model set-up'),
  ('transfer_legs_visitor',  'nyc',    1, 'legs', null, 'Visiting guests and the groom travel NYC to Boston once, for the wedding.', 'Model set-up'),
  ('transfer_legs_local',    'boston', 0, 'legs', null, 'No transfer: Boston-based guests are already home.', 'Model set-up'),
  ('transfer_legs_local',    'nyc',    2, 'legs', null, 'Boston-based guests travel to NYC and back.', 'Model set-up');

-- Reference figures (not read by the calculator). All unverified.
insert into assumptions (key, city_id, value, value_text, unit, currency, reason, status_note) values
  ('avg_may_hotel_rate',        'boston', 39000, null, 'usd_cents', 'USD', 'Average May hotel rate, 2024-26 data.', 'Unverified'),
  ('avg_may_hotel_rate',        'nyc',    37200, null, 'usd_cents', 'USD', 'Average May hotel rate, 2024-26 data.', 'Unverified'),
  ('weekend_avg_rate_3_star',   'boston', 29000, null, 'usd_cents', 'USD', 'Booking.com weekend average.', 'Unverified'),
  ('weekend_avg_rate_4_star',   'boston', 39000, null, 'usd_cents', 'USD', 'Booking.com weekend average.', 'Unverified'),
  ('weekend_avg_rate_5_star',   'boston', 80500, null, 'usd_cents', 'USD', 'Booking.com weekend average.', 'Unverified'),
  ('commencement_weekend_rate', 'boston', null, '$509-699 reported, with sell-outs', 'text', null, 'Hotel rates on Boston commencement weekends.', 'Weak source: a rental operator''s marketing page'),
  ('meal_tax_pct',              'boston', 7,     null, 'percent',   null,  'Tax on restaurant meals.', 'From memory, unverified'),
  ('meal_tax_pct',              'nyc',    8.875, null, 'percent',   null,  'Tax on restaurant meals.', 'From memory, unverified'),
  ('restaurant_tip_pct',        null,     18,    '18-20% at restaurants and bars, both cities', 'percent', null, 'Expected tip.', 'Unverified'),
  ('median_beer_price',         'boston', 869,   null, 'usd_cents', 'USD', 'Median beer, Toast, March 2026.', 'Unverified'),
  ('median_beer_price',         'nyc',    916,   null, 'usd_cents', 'USD', 'Median beer, Toast, March 2026.', 'Unverified'),
  ('cocktail_price',            'boston', 1800,  null, 'usd_cents', 'USD', 'Typical cocktail, about.', 'Unverified'),
  ('cocktail_price',            'nyc',    2200,  null, 'usd_cents', 'USD', 'Typical cocktail in Manhattan, about.', 'Unverified'),
  ('bc_commencement_date',      'boston', null, 'Mon 24 May 2027', 'text', null, 'Commencement season squeezes Boston hotels on the party weekend.', 'Inferred from the Senior Week page'),
  ('harvard_commencement_date', 'boston', null, 'Thu 27 May 2027', 'text', null, 'Commencement season squeezes Boston hotels.', 'Unverified'),
  ('mit_commencement_dates',    'boston', null, '26-28 May 2027',  'text', null, 'Commencement season squeezes Boston hotels.', 'Unverified');

-- Facts. Verified where confirmed first-hand by Jack, or a calendar fact.
insert into assumptions (key, city_id, value_text, unit, reason, status_note, verified) values
  ('party_dates',         null, 'Sat 22 - Sun 23 May 2027, 2 nights', 'text', 'Two nights keeps cost down for UK guests.', 'Decided 16 Nov 2026. Which two nights is still an open question.', true),
  ('wedding_date',        null, 'Sun 30 May 2027, Boston', 'text', 'The party is the weekend before the wedding.', 'Confirmed by Jack', true),
  ('memorial_day',        null, 'Mon 31 May 2027 (weekend 29-31 May)', 'text', 'Holiday pricing hits the wedding weekend, not the party weekend.', 'Calendar fact', true),
  ('headcount',           null, '10-12 including the groom; 3-4 Boston-based (no bed needed); the groom needs a bed (lives in Minnesota)', 'text', 'Drives rooms and per-person shares.', 'Jack, 16 Nov 2026. Final guest list TBC.', true),
  ('uk_guest_travel',     null, 'One trip; all on ESTA', 'text', 'UK guests stay in the US between the party and the wedding.', 'Jack, 16 Nov 2026', true),
  ('uk_guest_trip_budget',null, 'About 2,000-3,000 GBP in total for the whole trip', 'text', 'Cost matters to UK guests.', 'Jack, 16 Nov 2026', true),
  ('group_covers_groom',  null, 'Yes', 'text', 'The groom''s share is spread across everyone else.', 'Assumed; confirm with the group', false);

-- ---------------------------------------------------------------------------
-- Source links. Only where the page clearly matches the figure; everything
-- else stays unlinked and shows as unverified with no source.
-- ---------------------------------------------------------------------------
insert into source_links (source_id, entity_type, entity_id, quote_or_figure)
select s.id, 'option', o.id, v.q
from (values
  ('bodaborg-prices',            'boda-borg',                 '$32 for 2h, $45 for 4h'),
  ('roomescapeartist-level99',   'level99',                   'About $35 for 2h (2024, Providence)'),
  ('escapetheroom-boston',       'escape-the-room-boston',    'From $37'),
  ('prnewswire-tavern-of-tales', 'tavern-of-tales',           'Private rooms seat 5'),
  ('improvasylum-faq',           'improv-asylum',             'About $29-35'),
  ('mitmuseum-prices',           'mit-museum',                '$20'),
  ('noproscenium-beat-the-bomb', 'beat-the-bomb',             'About $40-45'),
  ('comedycellar-lineup',        'comedy-cellar',             '$25 cover Fri/Sat plus two-item minimum'),
  ('nomadotravel-comedy-cellar', 'comedy-cellar',             '$25 cover Fri/Sat plus two-item minimum'),
  ('timeout-hex',                'hex-and-co',                '$10 walk-in, $15 reserved (3h)'),
  ('whichmuseum-spyscape',       'spyscape',                  'About $42'),
  ('spygames-tickets',           'spyscape',                  'About $42'),
  ('hiusa-boston-groups',        'hi-boston-hostel',          'Bookings of 8+ through group sales'),
  ('virgin-lhr-bos',             'flight-lhr-bos-virgin',     'From £511 return'),
  ('aerlingus-lon-bos',          'flight-lon-bos-aerlingus',  'From £257.60 each way'),
  ('kayak-lon-nyc-may',          'flight-lon-nyc-kayak',      'Average £614, best deals from £370'),
  ('icelandair-lon-nyc',         'flight-lon-nyc-icelandair', 'From £436'),
  ('jack',                       'flight-open-jaw-estimate',  'About 600-700 GBP'),
  ('tourismattractions-mbta',    'airport-boston-silver-line','SL1 free inbound'),
  ('tourismattractions-mbta',    'airport-boston-subway',     'Subway $2.40'),
  ('ridewise-bos',               'airport-boston-rideshare',  '$18-30'),
  ('airporttransferportal-jfk',  'airport-nyc-airtrain',      'AirTrain $8.75 + subway $3.00'),
  ('airporttransferportal-jfk',  'airport-nyc-taxi',          '$70 flat plus tolls, surcharges and tip')
) as v (src, ent, q)
join sources s on s.slug = v.src
join options o on o.slug = v.ent;

insert into source_links (source_id, entity_type, entity_id, quote_or_figure)
select s.id, 'assumption', a.id, v.q
from (values
  ('roommaster-boston',       'hotel_tax_pct',             'boston', '14.95%'),
  ('roommaster-nyc',          'hotel_tax_pct',             'nyc',    '14.75% plus a flat nightly fee'),
  ('engine-boston',           'avg_may_hotel_rate',        'boston', '$390'),
  ('engine-nyc',              'avg_may_hotel_rate',        'nyc',    '$372'),
  ('booking-boston',          'weekend_avg_rate_3_star',   'boston', '$290'),
  ('booking-boston',          'weekend_avg_rate_4_star',   'boston', '$390'),
  ('booking-boston',          'weekend_avg_rate_5_star',   'boston', '$805'),
  ('sparekeys-graduation',    'commencement_weekend_rate', 'boston', '$509-699, with sell-outs'),
  ('pulse-nyc-pint',          'median_beer_price',         'nyc',    '$9.16'),
  ('bc-senior-week',          'bc_commencement_date',      'boston', 'Mon 24 May (inferred)'),
  ('harvard-commencement',    'harvard_commencement_date', 'boston', 'Thu 27 May'),
  ('mit-commencement',        'mit_commencement_dates',    'boston', '26-28 May'),
  ('memorial-day',            'memorial_day',              '',       'Mon 31 May 2027'),
  ('jack',                    'party_dates',               '',       null),
  ('jack',                    'wedding_date',              '',       null),
  ('jack',                    'headcount',                 '',       null),
  ('jack',                    'uk_guest_travel',           '',       null),
  ('jack',                    'uk_guest_trip_budget',      '',       null),
  ('jack',                    'local_guests_need_bed',     'boston', null)
) as v (src, akey, city, q)
join sources s on s.slug = v.src
join assumptions a on a.key = v.akey and coalesce(a.city_id, '') = v.city;

insert into source_links (source_id, entity_type, entity_id, quote_or_figure)
select f.source_id, 'fx_rate', f.id, '1 GBP = 1.3211 USD (mid-market)' from fx_rates f;

-- ---------------------------------------------------------------------------
-- Known source conflicts (requirements section 7). Where research did not
-- record which page gave which figure, the source columns stay empty.
-- ---------------------------------------------------------------------------
insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'assumption', a.id, 'NYC hotel flat nightly fee', null, null,
       '$1.50 a night', 'About $3.50 a night', '$3.50',
       'Research phase 1 modelled $3.50; it did not record the reason, or which page gave which figure.'
from assumptions a where a.key = 'hotel_nightly_fee' and a.city_id = 'nyc';

insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'option', o.id, 'Royal Palms Shuffleboard price', null, null,
       '$40 per court-hour', '$50-60 per court-hour', '$40-60 (range shown)',
       'Not resolved. The price is not in the cost model, so the full range is shown.'
from options o where o.slug = 'royal-palms';

insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'assumption', a.id, 'Boston commencement weekend hotel rates',
       (select id from sources where slug = 'sparekeys-graduation'),
       (select id from sources where slug = 'engine-boston'),
       '$509-699, with sell-outs', '$390 average May rate', 'Neither: the model uses its own unverified rates ($400 / $550 / $850)',
       'The higher figure is from a rental operator''s marketing page, so it is treated with caution. A real quote is needed.'
from assumptions a where a.key = 'commencement_weekend_rate';

insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'option', o.id, 'Level99 price',
       (select id from sources where slug = 'roomescapeartist-level99'), null,
       'About $35 for 2h (2024, Providence venue)', null, '$35',
       'The only figure found. It is for a different venue and an earlier year, so the Natick price is unverified.'
from options o where o.slug = 'level99';

insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'assumption', a.id, 'Boston College 2027 commencement date',
       (select id from sources where slug = 'bc-senior-week'), null,
       'Mon 24 May 2027 (inferred from the Senior Week page)', 'Not yet on the main commencement page', 'Mon 24 May 2027',
       'Inferred, not announced. Check the main commencement page before relying on it.'
from assumptions a where a.key = 'bc_commencement_date';

insert into conflicts (entity_type, entity_id, title, source_a, source_b, value_a, value_b, used, why)
select 'option', o.id, 'Shooting range price', null, null,
       '$120 per person (third-party listing)', null, '$120',
       'The only figure found, from a third-party listing rather than the range itself. The page was not recorded.'
from options o where o.slug = 'shooting-range';

-- ---------------------------------------------------------------------------
-- Decision log
-- ---------------------------------------------------------------------------
insert into decisions (date, title, decision, reason, decided_by, linked_option_ids) values
  ('2026-11-16', 'Two nights', 'The party is two nights.', 'Jack''s call; keeps cost down for UK guests.', 'Jack', '{}'),
  ('2026-11-16', 'Group covers the groom', 'The group covers the groom''s share.', 'Assumed agreed; confirm with the group.', 'Jack', '{}'),
  ('2026-11-16', 'Boda Borg and Level99 stay on the shortlist', 'The groom has not done Boda Borg or Level99, so both stay on the Boston shortlist.', 'Jack, 16 Nov 2026.', 'Jack',
     array(select id from options where slug in ('boda-borg', 'level99') order by id)),
  ('2026-11-16', 'Shooting range is open to UK guests', 'All UK guests travel on ESTA, so a shooting range session is open to them.', 'Jack, 16 Nov 2026.', 'Jack',
     array(select id from options where slug = 'shooting-range')),
  ('2026-11-16', 'Payments by Wise', 'Wise for Jack, ordinary bank transfers from guests; PayPal Pools as fallback.', 'Recommendation; Wise fee figures are third-party and unverified.', 'Jack',
     array(select id from options where slug in ('pay-wise', 'pay-paypal-pool') order by id)),
  ('2026-11-16', 'Website stack and access', 'React site on a static host with a Supabase (Postgres) database. Guests get in by passcode link: one each for organiser, group and groom.', 'Guests need no Claude, Supabase or UK-specific account, and no guest emails are stored.', 'Jack', '{}');

-- ---------------------------------------------------------------------------
-- Open questions
-- ---------------------------------------------------------------------------
insert into open_questions (question, owner) values
  ('Which two nights: Fri 21 - Sun 23 May or Sat 22 - Mon 24 May?', 'Jack'),
  ('Is Boston now the decision, or do we sound out the groom first?', 'Jack'),
  ('What are the real hotel rates and deposit terms for the chosen nights? (Boston first, 8 beds.)', 'Jack'),
  ('Does Jack have a Wise account?', 'Jack'),
  ('Shooting range: in or out, at about 90 GBP a head (price unverified)?', 'Jack'),
  ('What is the final guest list and exact headcount?', 'Jack'),
  ('Does the group agree to cover the groom''s share?', 'Jack'),
  ('Do guests vote on options, or only comment?', 'Jack'),
  ('Should the Payments page be in version 1, given payments run through Wise or PayPal?', 'Jack');

insert into open_questions (question, owner, status, answer, closed_by_decision_id)
select 'Where is the website hosted, and how do guests get in?', 'Jack', 'answered',
       'Supabase database, static host (which one is still to pick), passcode links.', d.id
from decisions d where d.title = 'Website stack and access';

-- ---------------------------------------------------------------------------
-- Saved scenarios, guests and settings
-- ---------------------------------------------------------------------------
insert into scenarios (name, city_id, tier, nights, group_size, local_guests, groom_covered) values
  ('Budget, 2 nights, 12 people, 4 Boston-based', 'boston', 'budget', 2, 12, 4, true),
  ('Budget, 2 nights, 12 people, 4 Boston-based', 'nyc',    'budget', 2, 12, 4, true);

-- The guest list is TBC: only the two named people are loaded.
insert into guests (name, home_country, bed_needed, role, currency) values
  ('Jack', 'UK', true, 'organiser', 'GBP'),
  ('Toby', 'US', true, 'groom',     'USD');

insert into app_settings (key, value) values
  ('groom_view_published', 'false'),
  ('verdict_status', 'provisional');
