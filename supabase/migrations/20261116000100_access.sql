-- Access by passcode link (stage b reads; stage e relies on the role rules).
-- Three passcodes, one per role. Only a hash of each is stored.
-- Tables stay locked by row-level security; the site reads everything through
-- api_bundle(), which checks the passcode and returns only what that role may see.

create table access_codes (
  role       text primary key check (role in ('organiser', 'group', 'groom')),
  code_hash  text not null unique,
  updated_at timestamptz not null default now()
);
alter table access_codes enable row level security;

create function hash_code(p_code text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
$$;

-- Run by the site owner in the SQL editor, never from the website.
create function set_access_code(p_role text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_code, '')) < 16 then
    raise exception 'A passcode needs at least 16 characters';
  end if;
  insert into access_codes (role, code_hash) values (p_role, hash_code(p_code))
  on conflict (role) do update set code_hash = excluded.code_hash, updated_at = now();
end $$;

revoke all on function set_access_code(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function set_access_code(text, text) from anon, authenticated;
  end if;
end $$;

create function api_role(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select role from access_codes where code_hash = hash_code(p_code)
$$;

-- One data load for the whole site.
--   groom, before publish: nothing but his role.
--   groom, after publish:  what the Verdict and Workings pages need.
--   group:                 plus options detail, decisions, questions, votes, comments.
--   organiser:             plus payments and the audit trail.
create function api_bundle(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r   text := api_role(p_code);
  pub boolean;
  b   jsonb;
begin
  if r is null then
    raise exception 'That passcode is not recognised' using errcode = '28000';
  end if;

  select value = 'true' into pub from app_settings where key = 'groom_view_published';
  pub := coalesce(pub, false);

  if r = 'groom' and not pub then
    return jsonb_build_object('role', r, 'published', false);
  end if;

  b := jsonb_build_object(
    'role', r,
    'published', pub,
    'settings',     (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from app_settings),
    'cities',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from cities t),
    'options',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from options t
                      where r <> 'groom' or t.category <> 'payment'),
    'assumptions',  (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from assumptions t),
    'fx_rates',     (select coalesce(jsonb_agg(to_jsonb(t) order by t.as_of desc, t.id desc), '[]'::jsonb) from fx_rates t),
    'sources',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from sources t),
    'source_links', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from source_links t
                      where t.entity_type in ('option', 'assumption', 'fx_rate')),
    'conflicts',    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from conflicts t),
    'scenarios',    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from scenarios t)
  );

  if r in ('organiser', 'group') then
    b := b || jsonb_build_object(
      'decisions',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.date desc, t.id desc), '[]'::jsonb) from decisions t),
      'open_questions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from open_questions t),
      'guests',         (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from guests t),
      'votes',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from votes t),
      'comments',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from comments t),
      'decision_history', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from audit_log t
                            where t.table_name = 'decisions')
    );
  end if;

  if r = 'organiser' then
    b := b || jsonb_build_object(
      'payments',  (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from payments t),
      'audit_log', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc), '[]'::jsonb)
                      from (select * from audit_log where actor <> 'seed' order by id desc limit 300) t)
    );
  end if;

  return b;
end $$;
