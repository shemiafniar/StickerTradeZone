-- Shashot - map-based matches view
--
-- Adds nearby_locations(), a SECURITY DEFINER RPC returning a
-- privacy-preserving, jittered approximate coordinate for each nearby
-- collector who has opted into location sharing - used only to place
-- markers on the new matches map. This is purely additive: the existing
-- nearby_distances() function (bare distance, no coordinates at all) is
-- left completely untouched for anything else that might rely on it.
--
-- Privacy layers (on top of what already existed):
--   1. Coordinates in profile_locations are already rounded to ~100m by
--      the browser before they're ever sent to the server (see
--      roundCoordinate() in src/lib/distance.ts), and the server rounds
--      again defensively - unchanged by this migration.
--   2. This function adds a further ~2km server-side jitter, deterministic
--      per *target* user (via a stable hash of their user_id) so a given
--      collector's marker doesn't visibly jump around between page loads,
--      but the jitter offset itself is never exposed or documented per
--      user - only the final jittered coordinate is returned.
--   3. The true (un-jittered) distance is still computed and returned
--      alongside the jittered coordinates, so distance-based sorting and
--      the "500 מ׳ / 2.3 ק״מ" badges stay exactly as accurate as before -
--      only the map *marker position* is approximate, not the distance
--      shown in text.
--   4. Raw profile_locations rows remain readable only by their owner or
--      an admin - RLS on that table is completely unaffected.
create or replace function public.nearby_locations(max_km double precision default 300)
returns table (
  user_id uuid,
  distance_km double precision,
  approx_lat double precision,
  approx_lng double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p2.user_id,
    public.haversine_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude) as distance_km,
    p2.latitude + ((hashtext(p2.user_id::text || ':lat') % 2000) / 100000.0) as approx_lat,
    p2.longitude + ((hashtext(p2.user_id::text || ':lng') % 2000) / 100000.0) as approx_lng
  from public.profile_locations p1
  join public.profile_locations p2 on p2.user_id <> p1.user_id
  join public.profiles pr on pr.id = p2.user_id and pr.status = 'active'
  where p1.user_id = auth.uid()
    and public.haversine_km(p1.latitude, p1.longitude, p2.latitude, p2.longitude) <= max_km
  order by distance_km asc;
$$;

grant execute on function public.nearby_locations(double precision) to authenticated;
