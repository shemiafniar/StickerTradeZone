-- =========================================================================
-- Shashot - seed data for LOCAL DEVELOPMENT / TESTING ONLY.
--
-- This script inserts directly into auth.users / auth.identities, which is
-- only safe on a local Supabase stack (`supabase start` + `supabase db reset`).
-- NEVER run this file against a hosted/production Supabase project - use
-- supabase.auth.admin.createUser() with the service role key instead.
--
-- Safety guard: aborts immediately if auth.users already contains any real
-- account (i.e. anything other than our own @shashot.local demo accounts
-- from a previous run of this same script). This won't stop someone from
-- running it on a *fresh, empty* hosted project, but it does stop the far
-- more likely accident of pasting this into the SQL Editor of a project
-- that already has real signups.
--
-- The team + sticker catalog itself (teams / stickers tables) is already
-- fully seeded by supabase/migrations/0011_shashot_teams.sql - this script
-- only adds demo users and their user_stickers/trade data.
-- =========================================================================
do $$
declare
  v_foreign_users integer;
begin
  select count(*) into v_foreign_users
  from auth.users
  where email not like '%@shashot.local';

  if v_foreign_users > 0 then
    raise exception
      'Refusing to run seed.sql: auth.users already contains % non-demo account(s). '
      'This script is for a fresh local dev database only - see the warning at the top of this file.',
      v_foreign_users;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) Demo auth users (password for all demo accounts: "Password123!")
-- ---------------------------------------------------------------------
do $$
declare
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_users jsonb := '[
    {"id":"11111111-1111-1111-1111-111111111101","email":"admin@shashot.local","full_name":"מנהל המערכת","city":"תל אביב יפו","neighborhood":"פלורנטין","phone":"0500000001"},
    {"id":"11111111-1111-1111-1111-111111111102","email":"dana@shashot.local","full_name":"דנה כהן","city":"תל אביב יפו","neighborhood":"רמת אביב","phone":"0500000002"},
    {"id":"11111111-1111-1111-1111-111111111103","email":"yossi@shashot.local","full_name":"יוסי לוי","city":"תל אביב יפו","neighborhood":"נווה צדק","phone":"0500000003"},
    {"id":"11111111-1111-1111-1111-111111111104","email":"noa@shashot.local","full_name":"נועה מזרחי","city":"רמת גן","neighborhood":null,"phone":"0500000004"},
    {"id":"11111111-1111-1111-1111-111111111105","email":"amit@shashot.local","full_name":"עמית ביטון","city":"חיפה","neighborhood":"הדר","phone":"0500000005"},
    {"id":"11111111-1111-1111-1111-111111111106","email":"tamar@shashot.local","full_name":"תמר אברהם","city":"חיפה","neighborhood":null,"phone":"0500000006"},
    {"id":"11111111-1111-1111-1111-111111111107","email":"eli@shashot.local","full_name":"אלי דהן","city":"ירושלים","neighborhood":"גילה","phone":"0500000007"},
    {"id":"11111111-1111-1111-1111-111111111108","email":"maya@shashot.local","full_name":"מאיה פרץ","city":"באר שבע","neighborhood":null,"phone":"0500000008"},
    {"id":"11111111-1111-1111-1111-111111111109","email":"roi@shashot.local","full_name":"רועי שרון","city":"אשדוד","neighborhood":null,"phone":"0500000009"},
    {"id":"11111111-1111-1111-1111-111111111110","email":"gali@shashot.local","full_name":"גלי אזולאי","city":"פתח תקווה","neighborhood":null,"phone":"0500000010"}
  ]'::jsonb;
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u ->> 'id')::uuid,
      'authenticated',
      'authenticated',
      u ->> 'email',
      v_password,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', u ->> 'full_name',
        'city', u ->> 'city',
        'neighborhood', u ->> 'neighborhood',
        'phone', u ->> 'phone'
      ),
      now(), now(),
      '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      (u ->> 'id')::uuid,
      'email',
      u ->> 'id',
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email'),
      now(), now(), now()
    )
    on conflict (provider, provider_id) do nothing;
  end loop;
end $$;

-- Promote the first demo account to admin
update public.profiles set role = 'admin'
where id = '11111111-1111-1111-1111-111111111101';

-- ---------------------------------------------------------------------
-- 2) Collections per demo collector (using the seeded team catalog), so
--    matches exist across several teams.
-- ---------------------------------------------------------------------

-- דנה (תל אביב): has GER 1-15 spare, missing GER 16-20 + FRA 1-10
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111102', id, 'duplicate', case when number % 5 = 0 then 'both' else 'trade' end
from public.stickers where team_code = 'GER' and number between 1 and 15
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111102', id, 'missing'
from public.stickers where (team_code = 'GER' and number between 16 and 20) or (team_code = 'FRA' and number between 1 and 10)
on conflict (user_id, sticker_id) do nothing;

-- יוסי (תל אביב): has GER 16-20 + FRA 1-10 spare (perfect match with דנה), missing GER 1-10
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111103', id, 'duplicate', case when number % 7 = 0 then 'both' else 'trade' end
from public.stickers where (team_code = 'GER' and number between 16 and 20) or (team_code = 'FRA' and number between 1 and 10)
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111103', id, 'missing'
from public.stickers where team_code = 'GER' and number between 1 and 10
on conflict (user_id, sticker_id) do nothing;

-- נועה (רמת גן, near תל אביב): has FRA 11-20 spare, missing GER 1-5 and FRA 1-5
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111104', id, 'duplicate', 'trade'
from public.stickers where team_code = 'FRA' and number between 11 and 20
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111104', id, 'missing'
from public.stickers where (team_code = 'GER' and number between 1 and 5) or (team_code = 'FRA' and number between 1 and 5)
on conflict (user_id, sticker_id) do nothing;

-- עמית (חיפה): has POR 1-10 spare, missing POR 11-20
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111105', id, 'duplicate', 'both'
from public.stickers where team_code = 'POR' and number between 1 and 10
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111105', id, 'missing'
from public.stickers where team_code = 'POR' and number between 11 and 20
on conflict (user_id, sticker_id) do nothing;

-- תמר (חיפה): has POR 11-20 spare (matches עמית), missing POR 1-5
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111106', id, 'duplicate', 'trade'
from public.stickers where team_code = 'POR' and number between 11 and 20
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111106', id, 'missing'
from public.stickers where team_code = 'POR' and number between 1 and 5
on conflict (user_id, sticker_id) do nothing;

-- אלי (ירושלים): has ISR 1-5 spare, missing ISR 6-12
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111107', id, 'duplicate', 'trade'
from public.stickers where team_code = 'JPN' and number between 1 and 5
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111107', id, 'missing'
from public.stickers where team_code = 'JPN' and number between 6 and 12
on conflict (user_id, sticker_id) do nothing;

-- מאיה (באר שבע): has ISR 6-12 spare, missing ISR 1-5
insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111108', id, 'duplicate', 'both'
from public.stickers where team_code = 'JPN' and number between 6 and 12
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111108', id, 'missing'
from public.stickers where team_code = 'JPN' and number between 1 and 5
on conflict (user_id, sticker_id) do nothing;

-- רועי (אשדוד) & גלי (פתח תקווה): light data, mostly missing
insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111109', id, 'missing'
from public.stickers where team_code = 'JPN' and number between 1 and 20
on conflict (user_id, sticker_id) do nothing;

insert into public.user_stickers (user_id, sticker_id, status, listing_type)
select '11111111-1111-1111-1111-111111111110', id, 'duplicate', 'trade'
from public.stickers where team_code = 'JPN' and number between 1 and 8
on conflict (user_id, sticker_id) do nothing;

-- A couple of "have" (owned, not-for-trade) stickers, to demo the green state too.
insert into public.user_stickers (user_id, sticker_id, status)
select '11111111-1111-1111-1111-111111111102', id, 'have'
from public.stickers where team_code = 'JPN' and number between 1 and 10
on conflict (user_id, sticker_id) do nothing;

-- Give a couple of "for sale" duplicates a price + note, to demo the marketplace fields.
update public.user_stickers
set price = 5, note = 'מדבקה נדירה, מצב מצוין'
where user_id = '11111111-1111-1111-1111-111111111105' and listing_type = 'both'
  and sticker_id = (select id from public.stickers where team_code = 'POR' and number = 5);

update public.user_stickers
set price = 3
where user_id = '11111111-1111-1111-1111-111111111108' and listing_type = 'both'
  and sticker_id = (select id from public.stickers where team_code = 'JPN' and number = 10);

-- ---------------------------------------------------------------------
-- 3) Approximate demo locations, so distance-based matching has data to show.
-- ---------------------------------------------------------------------
insert into public.profile_locations (user_id, latitude, longitude) values
  ('11111111-1111-1111-1111-111111111102', 32.085, 34.782), -- דנה, תל אביב
  ('11111111-1111-1111-1111-111111111103', 32.072, 34.774), -- יוסי, תל אביב (~2km מדנה)
  ('11111111-1111-1111-1111-111111111104', 32.082, 34.814), -- נועה, רמת גן (~3km מדנה)
  ('11111111-1111-1111-1111-111111111105', 32.794, 34.990), -- עמית, חיפה
  ('11111111-1111-1111-1111-111111111106', 32.800, 35.000)  -- תמר, חיפה (~1.1km מעמית)
on conflict (user_id) do nothing;

update public.profiles set location_enabled = true
where id in (
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104',
  '11111111-1111-1111-1111-111111111105',
  '11111111-1111-1111-1111-111111111106'
);

-- ---------------------------------------------------------------------
-- 4) A couple of sample trade requests for testing the flow end-to-end
-- ---------------------------------------------------------------------
do $$
declare
  v_trade_id uuid;
begin
  -- Pending trade: דנה -> יוסי
  insert into public.trade_requests (from_user_id, to_user_id, status, message)
  values (
    '11111111-1111-1111-1111-111111111102',
    '11111111-1111-1111-1111-111111111103',
    'pending',
    'היי! ראיתי שיש לך את הקלפים שחסרים לי, רוצה להחליף?'
  )
  returning id into v_trade_id;

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'receive', 1 from public.stickers where team_code = 'GER' and number in (16, 17, 18);

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'give', 1 from public.stickers where team_code = 'GER' and number in (1, 2, 3);

  -- Accepted trade: עמית -> תמר (contact info should now be visible to both)
  insert into public.trade_requests (from_user_id, to_user_id, status, message)
  values (
    '11111111-1111-1111-1111-111111111105',
    '11111111-1111-1111-1111-111111111106',
    'accepted',
    'סגורים על החלפה בחיפה? אפשר להיפגש השבוע.'
  )
  returning id into v_trade_id;

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'receive', 1 from public.stickers where team_code = 'POR' and number in (11, 12);

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'give', 1 from public.stickers where team_code = 'POR' and number in (1, 2);

  -- Sample chat history for the accepted trade, so the chat UI has something to show.
  insert into public.trade_messages (trade_request_id, sender_id, body, created_at) values
    (v_trade_id, '11111111-1111-1111-1111-111111111105', 'היי! שמח שאישרת, מתי נוח לך להיפגש?', now() - interval '2 hours'),
    (v_trade_id, '11111111-1111-1111-1111-111111111106', 'היי עמית, אני יכולה ביום חמישי אחרי הצהריים', now() - interval '1 hour 40 minutes'),
    (v_trade_id, '11111111-1111-1111-1111-111111111105', 'מעולה, נקבע ליד הקניון בחיפה?', now() - interval '1 hour 30 minutes');
end $$;
