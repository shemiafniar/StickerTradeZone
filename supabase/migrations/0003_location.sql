-- Sticker Trade IL - location-based matching
--
-- Privacy design: approximate coordinates (already rounded client-side to
-- ~100m precision before they ever reach the server) live in their own
-- profile_locations table, readable ONLY by the owner/admin - never by other
-- collectors, and never through the public `profiles` table. The only way
-- another user learns anything about someone's location is through the
-- `nearby_distances()` SECURITY DEFINER function below, which returns a
-- rounded distance in km - never raw coordinates.

create table if not exists public.profile_locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

comment on table public.profile_locations is
  'Approximate (client-rounded) collector coordinates. Never exposed directly to other users - only via nearby_distances().';

alter table public.profiles
  add column if not exists location_enabled boolean not null default false;

drop trigger if exists trg_profile_locations_updated_at on public.profile_locations;
create trigger trg_profile_locations_updated_at
  before update on public.profile_locations
  for each row execute function public.set_updated_at();

alter table public.profile_locations enable row level security;

drop policy if exists profile_locations_select_self_admin on public.profile_locations;
create policy profile_locations_select_self_admin
  on public.profile_locations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profile_locations_write_self on public.profile_locations;
create policy profile_locations_write_self
  on public.profile_locations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists profile_locations_update_self on public.profile_locations;
create policy profile_locations_update_self
  on public.profile_locations for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists profile_locations_delete_self on public.profile_locations;
create policy profile_locations_delete_self
  on public.profile_locations for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Haversine great-circle distance in kilometers.
create or replace function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
    )
  );
$$;

-- Returns other active users' distance from the caller, in km, without ever
-- exposing raw coordinates. Requires the caller to have a stored location.
create or replace function public.nearby_distances(max_km double precision default 100)
returns table (user_id uuid, distance_km double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p2.user_id, public.haversine_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude) as distance_km
  from public.profile_locations p1
  join public.profile_locations p2 on p2.user_id <> p1.user_id
  join public.profiles pr on pr.id = p2.user_id and pr.status = 'active'
  where p1.user_id = auth.uid()
    and public.haversine_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude) <= max_km
  order by distance_km asc;
$$;

grant execute on function public.haversine_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.nearby_distances(double precision) to authenticated;

-- Disabling location wipes the stored coordinates entirely (nothing lingers).
create or replace function public.disable_my_location()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_locations where user_id = auth.uid();
  update public.profiles set location_enabled = false where id = auth.uid();
end;
$$;

grant execute on function public.disable_my_location() to authenticated;
