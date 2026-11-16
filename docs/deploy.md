# Going live

The site has only run in demo mode so far (a copy of the database inside the browser). These steps
put it on a real database and a public address. They have not been run yet.

## 1. Database (Supabase)

1. Project created: ref `bkqbwgjksyehobsmvzca`, so the site URL setting is
   `https://bkqbwgjksyehobsmvzca.supabase.co`.
2. Open the SQL editor, paste the whole of `supabase/setup.sql`, and run it once. It is the three
   migrations and the seed in one transaction (rebuild it with `npm run build:sql`).
3. Do **not** run `supabase/dev_seed.sql`. It holds the demo passcodes.
4. Set three passcodes of your own (16 characters or more, hard to guess):

```sql
select set_access_code('organiser', 'replace-with-a-long-random-string');
select set_access_code('group',     'replace-with-another-long-string');
select set_access_code('groom',     'replace-with-a-third-long-string');
```

Only a hash of each passcode is stored. Run the same line again to change one.

## 2. Site settings

Copy `.env.example` to `.env` and fill in the project URL and the anon (public) key from
Supabase > Project settings > API. The anon key is safe to publish: every table is locked, and the
only way in is a database function that checks a passcode.

```bash
npm run build
```

## 3. Hosting

Upload the `dist` folder to any static host (Vercel, Netlify, Cloudflare Pages), or connect the host
to this repository with build command `npm run build`, output folder `dist`, and the two `VITE_`
variables set in the host's settings.

## 4. Links to send

- You: `https://<site>/?k=<organiser passcode>`
- Guests: `https://<site>/?k=<group passcode>`
- Toby, once you publish: `https://<site>/?k=<groom passcode>`

Then add each guest's first name on the Payments page so they can vote and comment.

## Things to know

- Supabase pauses free projects after about a week with no activity (from memory, not checked). The
  data is kept; un-pause it from the Supabase dashboard.
- Anyone holding a link has that role. If a link leaks, set a new passcode and re-send.
- First check after going live: open each of the three links and confirm the groom link shows
  "Nothing to see yet".
