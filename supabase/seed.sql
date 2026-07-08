-- =========================================================================
-- Sticker Trade IL - seed data for LOCAL DEVELOPMENT / TESTING ONLY.
--
-- This script inserts directly into auth.users / auth.identities, which is
-- only safe on a local Supabase stack (`supabase start` + `supabase db reset`).
-- NEVER run this file against a hosted/production Supabase project - use
-- supabase.auth.admin.createUser() with the service role key instead.
--
-- Safety guard: aborts immediately if auth.users already contains any real
-- account (i.e. anything other than our own @stickertrade.local demo
-- accounts from a previous run of this same script). This won't stop
-- someone from running it on a *fresh, empty* hosted project, but it does
-- stop the far more likely accident of pasting this into the SQL Editor of
-- a project that already has real signups.
-- =========================================================================
do $$
declare
  v_foreign_users integer;
begin
  select count(*) into v_foreign_users
  from auth.users
  where email not like '%@stickertrade.local';

  if v_foreign_users > 0 then
    raise exception
      'Refusing to run seed.sql: auth.users already contains % non-demo account(s). '
      'This script is for a fresh local dev database only - see the warning at the top of this file.',
      v_foreign_users;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1) Sticker catalog: a small demo album of 60 generic sticker numbers
-- ---------------------------------------------------------------------
insert into public.stickers (number)
select gs from generate_series(1, 60) as gs
on conflict (number) do nothing;

update public.app_settings
set set_name = 'אלבום המדבקות - עונת הטורניר 2026', total_stickers = 60
where id = true;

-- ---------------------------------------------------------------------
-- 2) Demo auth users (password for all demo accounts: "Password123!")
-- ---------------------------------------------------------------------
do $$
declare
  v_password text := crypt('Password123!', gen_salt('bf'));
  v_users jsonb := '[
    {"id":"11111111-1111-1111-1111-111111111101","email":"admin@stickertrade.local","full_name":"מנהל המערכת","city":"תל אביב יפו","neighborhood":"פלורנטין","phone":"0500000001"},
    {"id":"11111111-1111-1111-1111-111111111102","email":"dana@stickertrade.local","full_name":"דנה כהן","city":"תל אביב יפו","neighborhood":"רמת אביב","phone":"0500000002"},
    {"id":"11111111-1111-1111-1111-111111111103","email":"yossi@stickertrade.local","full_name":"יוסי לוי","city":"תל אביב יפו","neighborhood":"נווה צדק","phone":"0500000003"},
    {"id":"11111111-1111-1111-1111-111111111104","email":"noa@stickertrade.local","full_name":"נועה מזרחי","city":"רמת גן","neighborhood":null,"phone":"0500000004"},
    {"id":"11111111-1111-1111-1111-111111111105","email":"amit@stickertrade.local","full_name":"עמית ביטון","city":"חיפה","neighborhood":"הדר","phone":"0500000005"},
    {"id":"11111111-1111-1111-1111-111111111106","email":"tamar@stickertrade.local","full_name":"תמר אברהם","city":"חיפה","neighborhood":null,"phone":"0500000006"},
    {"id":"11111111-1111-1111-1111-111111111107","email":"eli@stickertrade.local","full_name":"אלי דהן","city":"ירושלים","neighborhood":"גילה","phone":"0500000007"},
    {"id":"11111111-1111-1111-1111-111111111108","email":"maya@stickertrade.local","full_name":"מאיה פרץ","city":"באר שבע","neighborhood":null,"phone":"0500000008"},
    {"id":"11111111-1111-1111-1111-111111111109","email":"roi@stickertrade.local","full_name":"רועי שרון","city":"אשדוד","neighborhood":null,"phone":"0500000009"},
    {"id":"11111111-1111-1111-1111-111111111110","email":"gali@stickertrade.local","full_name":"גלי אזולאי","city":"פתח תקווה","neighborhood":null,"phone":"0500000010"}
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
-- 3) Duplicates & missing stickers per demo collector, so matches exist.
-- ---------------------------------------------------------------------

-- דנה (תל אביב): has 1-15 spare, missing 16-30
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111102', id, case when number % 5 = 0 then 'both' else 'trade' end
from public.stickers where number between 1 and 15
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111102', id
from public.stickers where number between 16 and 30
on conflict (user_id, sticker_id) do nothing;

-- יוסי (תל אביב): has 16-30 spare (perfect match with דנה), missing 1-10
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111103', id, case when number % 7 = 0 then 'both' else 'trade' end
from public.stickers where number between 16 and 30
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111103', id
from public.stickers where number between 1 and 10
on conflict (user_id, sticker_id) do nothing;

-- נועה (רמת גן, near תל אביב): has 31-40 spare, missing 1-5 and 20-25
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111104', id, 'trade'
from public.stickers where number between 31 and 40
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111104', id
from public.stickers where number in (1,2,3,4,5,20,21,22,23,24,25)
on conflict (user_id, sticker_id) do nothing;

-- עמית (חיפה): has 41-50 spare, missing 51-60
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111105', id, 'both'
from public.stickers where number between 41 and 50
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111105', id
from public.stickers where number between 51 and 60
on conflict (user_id, sticker_id) do nothing;

-- תמר (חיפה): has 51-60 spare (matches עמית), missing 41-45
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111106', id, 'trade'
from public.stickers where number between 51 and 60
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111106', id
from public.stickers where number between 41 and 45
on conflict (user_id, sticker_id) do nothing;

-- אלי (ירושלים): has 1-5 spare, missing 6-12
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111107', id, 'trade'
from public.stickers where number between 1 and 5
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111107', id
from public.stickers where number between 6 and 12
on conflict (user_id, sticker_id) do nothing;

-- מאיה (באר שבע): has 6-12 spare, missing 1-5
insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111108', id, 'both'
from public.stickers where number between 6 and 12
on conflict (user_id, sticker_id) do nothing;

insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111108', id
from public.stickers where number between 1 and 5
on conflict (user_id, sticker_id) do nothing;

-- רועי (אשדוד) & גלי (פתח תקווה): light data, mostly missing
insert into public.user_missing (user_id, sticker_id)
select '11111111-1111-1111-1111-111111111109', id
from public.stickers where number between 1 and 20
on conflict (user_id, sticker_id) do nothing;

insert into public.user_duplicates (user_id, sticker_id, listing_type)
select '11111111-1111-1111-1111-111111111110', id, 'trade'
from public.stickers where number between 1 and 8
on conflict (user_id, sticker_id) do nothing;

-- Give a couple of "for sale" duplicates a price + note, to demo the marketplace fields.
update public.user_duplicates
set price = 5, note = 'מדבקה נדירה, מצב מצוין'
where user_id = '11111111-1111-1111-1111-111111111105' and listing_type = 'both'
  and sticker_id = (select id from public.stickers where number = 45);

update public.user_duplicates
set price = 3
where user_id = '11111111-1111-1111-1111-111111111108' and listing_type = 'both'
  and sticker_id = (select id from public.stickers where number = 10);

-- ---------------------------------------------------------------------
-- 4) Approximate demo locations, so distance-based matching has data to show.
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
-- 5) A couple of sample trade requests for testing the flow end-to-end
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
  select v_trade_id, id, 'receive', 1 from public.stickers where number in (16, 17, 18);

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'give', 1 from public.stickers where number in (1, 2, 3);

  -- Accepted trade: עמית -> תמר (contact info should now be visible to both)
  insert into public.trade_requests (from_user_id, to_user_id, status, message)
  values (
    '11111111-1111-1111-1111-111111111105',
    '11111111-1111-1111-1111-111111111106',
    'accepted',
    'סגורים על החלפה בבאר שבע? אפשר להיפגש השבוע.'
  )
  returning id into v_trade_id;

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'receive', 1 from public.stickers where number in (51, 52);

  insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
  select v_trade_id, id, 'give', 1 from public.stickers where number in (41, 42);

  -- Sample chat history for the accepted trade, so the chat UI has something to show.
  insert into public.trade_messages (trade_request_id, sender_id, body, created_at) values
    (v_trade_id, '11111111-1111-1111-1111-111111111105', 'היי! שמח שאישרת, מתי נוח לך להיפגש?', now() - interval '2 hours'),
    (v_trade_id, '11111111-1111-1111-1111-111111111106', 'היי עמית, אני יכולה ביום חמישי אחרי הצהריים', now() - interval '1 hour 40 minutes'),
    (v_trade_id, '11111111-1111-1111-1111-111111111105', 'מעולה, נקבע ליד הקניון בחיפה?', now() - interval '1 hour 30 minutes');
end $$;
