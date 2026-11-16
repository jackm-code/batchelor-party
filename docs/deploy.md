# Going live

The site has only run in demo mode so far (a copy of the database inside the browser). These steps
put it on a real database and a public address. They have not been run yet.

## 1. Database (Supabase): done 16 Nov 2026

Project `bkqbwgjksyehobsmvzca` (eu-west-2). Applied through the Supabase connector:

- the four migrations in `supabase/migrations/` (schema, access, writes, harden);
- `supabase/seed.sql`. Every table's contents were checked against the tested local copy.

Checked on the live database, acting as the public (`anon`) role with temporary passcodes that
were rolled back afterwards: the organiser gets all 50 options and payments, a guest gets decisions
but no payments, the groom gets nothing before publish, and the organiser can edit and publish.

To rebuild from scratch on an empty project, run `supabase/setup.sql` in the SQL editor.
Never run `supabase/dev_seed.sql` there: it holds the demo passcodes.

### Still to do: set the three passcodes

In the Supabase SQL editor (16 characters or more each, hard to guess):

```sql
select set_access_code('organiser', 'replace-with-a-long-random-string');
select set_access_code('group',     'replace-with-another-long-string');
select set_access_code('groom',     'replace-with-a-third-long-string');
```

Only a hash of each passcode is stored. Run the same line again to change one. Until these are
set, nobody can get in.

## 2. Site settings: done

`.env.production` holds the project URL and the publishable key, so `npm run build` produces a
site that talks to the live database. Both values are public by design. `npm run dev` still runs
in demo mode.

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
