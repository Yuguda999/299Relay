-- Students can add a place that isn't in the list yet (a shop, a junction, an
-- off-campus street). Added places are usable at once by everyone on the
-- campus, are never handoff points, and show up for admin review.

alter table public.places
  add column added_by    uuid references public.profiles(id),
  add column reviewed_at timestamptz;

comment on column public.places.added_by is 'Student who added the place; null for places set up by the team.';
comment on column public.places.reviewed_at is 'When an admin checked a student-added place.';

create index places_added_by_idx on public.places (added_by, created_at) where added_by is not null;

-- Audit only admin changes; student-added places are tracked by added_by.
create or replace function private.audit_places() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and public.is_admin() then
    insert into public.admin_audit (admin_id, action, target, detail)
    values (auth.uid(), lower(tg_op) || '_place', new.id::text, to_jsonb(new));
  end if;
  return new;
end $$;

create or replace function public.add_place(p_name text, p_off_campus boolean default false)
returns public.places
language plpgsql security definer set search_path = public, extensions as $$
declare
  me      public.profiles := private.me_verified();
  v_name  text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_place public.places;
  v_slug  text;
  v_n     integer;
begin
  if char_length(v_name) < 3 or char_length(v_name) > 60 or v_name !~ '[[:alpha:]]' then
    perform private.err('invalid_place_name', 'use 3 to 60 characters');
  end if;
  if exists (select 1 from prohibited_keywords k where lower(v_name) ~ ('\m' || k.keyword || '\M')) then
    perform private.err('place_name_not_allowed');
  end if;

  -- Same name (any case) already there: reuse it.
  select * into v_place from places where campus_id = me.campus_id and lower(name) = lower(v_name);
  if found then
    if not v_place.active then
      perform private.err('place_retired', 'this place was removed by the team');
    end if;
    return v_place;
  end if;

  select count(*) into v_n from places where added_by = me.id and created_at > now() - interval '1 day';
  if v_n >= 5 then
    perform private.err('too_many_places', 'you can add up to 5 places a day');
  end if;

  -- Its own zone: trips match it by place, and the suggested fee treats it as a
  -- different zone from everything else.
  v_slug := 'custom_' || trim(both '_' from regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g'));

  insert into places (campus_id, name, kind, zone, is_handoff_point, added_by)
  values (me.campus_id, v_name, case when p_off_campus then 'area' else 'other' end::place_kind, v_slug, false, me.id)
  returning * into v_place;
  return v_place;
end $$;

revoke execute on function public.add_place(text, boolean) from public, anon;
grant execute on function public.add_place(text, boolean) to authenticated;

-- Open apps pick up new places without a reload.
alter publication supabase_realtime add table public.places;
