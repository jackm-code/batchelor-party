-- Writes (stages d and e). Every change goes through one of these functions,
-- which check the passcode's role first. Tables stay locked to direct access.
--   organiser: edit inputs, options, decisions, questions, guests, payments, settings
--   group:     vote and comment
--   groom:     nothing

-- Checks the passcode, sets who is acting (for the audit trail), returns the role.
create function require_role(p_code text, variadic p_roles text[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  r text := api_role(p_code);
begin
  if r is null then
    raise exception 'That passcode is not recognised' using errcode = '28000';
  end if;
  if not (r = any (p_roles)) then
    raise exception 'You do not have permission to do that' using errcode = '42501';
  end if;
  if r = 'organiser' then
    perform set_config('app.actor', coalesce((select name from guests where role = 'organiser' order by id limit 1), 'Organiser'), true);
  end if;
  return r;
end $$;

-- Add (no id) or change (with id) one row. Organiser only.
create function api_upsert(p_code text, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id   bigint := nullif(p_row ->> 'id', '')::bigint;
  v_row  jsonb := p_row;
  cols   text;
  vals   text;
  result jsonb;
begin
  perform require_role(p_code, 'organiser');

  if not (p_table = any (array['options', 'assumptions', 'fx_rates', 'scenarios', 'decisions', 'open_questions', 'guests', 'payments', 'conflicts'])) then
    raise exception 'That cannot be edited here';
  end if;
  if p_table = 'fx_rates' and v_id is not null then
    raise exception 'Exchange rates are kept as history. Add a new rate instead.';
  end if;
  if p_table = 'options' and v_id is null and not (v_row ? 'slug') then
    v_row := v_row || jsonb_build_object('slug', 'opt-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  end if;

  -- No figure is "verified" without a source.
  if p_table in ('options', 'assumptions') and coalesce((v_row ->> 'verified')::boolean, false) then
    if v_id is null or not exists (
      select 1 from source_links l
      where l.entity_id = v_id and l.entity_type = case p_table when 'options' then 'option' else 'assumption' end
    ) then
      raise exception 'Add a source before marking this verified';
    end if;
  end if;

  select string_agg(quote_ident(c.column_name), ', '), string_agg('r.' || quote_ident(c.column_name), ', ')
    into cols, vals
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table
    and v_row ? c.column_name and c.column_name not in ('id', 'created_at');
  if cols is null then
    raise exception 'Nothing to save';
  end if;

  if v_id is null then
    execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1) r returning to_jsonb(%I.*)',
                   p_table, cols, vals, p_table, p_table)
      using v_row into result;
  else
    execute format('update %I t set (%s) = row(%s) from jsonb_populate_record(null::%I, $1) r where t.id = $2 returning to_jsonb(t.*)',
                   p_table, cols, vals, p_table)
      using v_row, v_id into result;
    if result is null then
      raise exception 'That row no longer exists';
    end if;
  end if;
  return result;
end $$;

-- Remove a row. Never decisions, options, assumptions or exchange rates.
create function api_delete(p_code text, p_table text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_code, 'organiser');
  if not (p_table = any (array['scenarios', 'payments', 'source_links', 'conflicts'])) then
    raise exception 'That cannot be deleted';
  end if;
  execute format('delete from %I where id = $1', p_table) using p_id;
  return jsonb_build_object('deleted', p_id);
end $$;

-- Replace a decision: the old one stays in the log, marked as superseded.
create function api_supersede_decision(p_code text, p_old_id bigint, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  new_row jsonb;
begin
  perform require_role(p_code, 'organiser');
  if not exists (select 1 from decisions where id = p_old_id and superseded_by is null) then
    raise exception 'That decision has already been superseded, or does not exist';
  end if;
  new_row := api_upsert(p_code, 'decisions', p_row - 'id' - 'superseded_by');
  update decisions set superseded_by = (new_row ->> 'id')::bigint where id = p_old_id;
  return new_row;
end $$;

-- Attach a source (a page actually opened, with the date) to an option or assumption.
create function api_add_source(
  p_code text, p_entity_type text, p_entity_id bigint,
  p_title text, p_url text, p_date_checked date, p_publisher text, p_quote text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sid bigint;
begin
  perform require_role(p_code, 'organiser');
  if p_entity_type not in ('option', 'assumption') then
    raise exception 'Sources attach to options and assumptions';
  end if;
  if coalesce(trim(p_title), '') = '' or p_date_checked is null then
    raise exception 'A source needs a title and the date it was checked';
  end if;
  if p_url is not null and p_url !~* '^https?://' then
    raise exception 'The link must start with http:// or https://';
  end if;
  insert into sources (slug, title, url, date_checked, publisher)
  values ('src-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10), trim(p_title), nullif(trim(p_url), ''), p_date_checked, nullif(trim(p_publisher), ''))
  returning id into sid;
  insert into source_links (source_id, entity_type, entity_id, quote_or_figure)
  values (sid, p_entity_type, p_entity_id, nullif(trim(p_quote), ''));
  return jsonb_build_object('source_id', sid);
end $$;

-- Site switches: publish the groom view, mark the verdict final, stale-data age.
create function api_set_setting(p_code text, p_key text, p_value text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_code, 'organiser');
  if not (p_key = any (array['groom_view_published', 'verdict_status', 'stale_after_days', 'payment_buffer_pct'])) then
    raise exception 'Unknown setting';
  end if;
  if p_key = 'groom_view_published' and p_value not in ('true', 'false') then raise exception 'Use true or false'; end if;
  if p_key = 'verdict_status' and p_value not in ('provisional', 'final') then raise exception 'Use provisional or final'; end if;
  insert into app_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('key', p_key, 'value', p_value);
end $$;

-- Guests act under the name they picked. The groom never votes or comments.
create function acting_guest(p_guest_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  n text;
begin
  select name into n from guests where id = p_guest_id and role <> 'groom';
  if n is null then
    raise exception 'Choose your name first';
  end if;
  perform set_config('app.actor', n, true);
  return n;
end $$;

-- p_vote: 1 for, -1 against, 0 to take the vote back.
create function api_vote(p_code text, p_guest_id bigint, p_option_id bigint, p_vote integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform require_role(p_code, 'organiser', 'group');
  perform acting_guest(p_guest_id);
  if p_vote = 0 then
    delete from votes where option_id = p_option_id and guest_id = p_guest_id;
  elsif p_vote in (1, -1) then
    insert into votes (option_id, guest_id, vote) values (p_option_id, p_guest_id, p_vote)
    on conflict (option_id, guest_id) do update set vote = excluded.vote;
  else
    raise exception 'A vote is for, against, or none';
  end if;
  return jsonb_build_object('option_id', p_option_id, 'vote', p_vote);
end $$;

create function api_comment(p_code text, p_guest_id bigint, p_entity_type text, p_entity_id bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid bigint;
begin
  perform require_role(p_code, 'organiser', 'group');
  perform acting_guest(p_guest_id);
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a comment first'; end if;
  if length(p_body) > 2000 then raise exception 'Keep comments under 2,000 characters'; end if;
  insert into comments (entity_type, entity_id, guest_id, body)
  values (p_entity_type, p_entity_id, p_guest_id, trim(p_body)) returning id into cid;
  return jsonb_build_object('id', cid);
end $$;
