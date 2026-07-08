-- Sticker Trade IL - core schema
-- This is an independent community platform and is not affiliated with
-- Panini, FIFA, or any official sticker brand.

create extension if not exists "pgcrypto";

-- =========================================================================
-- PROFILES
-- Public-safe collector profile. Never store phone/whatsapp here.
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  city text not null default '',
  neighborhood text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-safe collector profile data (no contact details).';

-- =========================================================================
-- PROFILE CONTACTS
-- Sensitive contact info, only revealed to self / admin / accepted trade partner.
-- =========================================================================
create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_contacts is 'Sensitive contact details, revealed only after trade approval.';

-- =========================================================================
-- STICKERS (catalog)
-- =========================================================================
create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  name text,
  team text,
  created_at timestamptz not null default now()
);

comment on table public.stickers is 'Sticker catalog. MVP allows generic numbers without player/team names.';

-- =========================================================================
-- APP SETTINGS (singleton row: sticker set config)
-- =========================================================================
create table if not exists public.app_settings (
  id boolean primary key default true,
  set_name text not null default 'אלבום המדבקות',
  total_stickers integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id, set_name, total_stickers)
values (true, 'אלבום המדבקות', 0)
on conflict (id) do nothing;

-- =========================================================================
-- USER DUPLICATES (stickers I have spare / for trade / for sale)
-- =========================================================================
create table if not exists public.user_duplicates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sticker_id uuid not null references public.stickers (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  for_sale boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, sticker_id)
);

-- =========================================================================
-- USER MISSING (stickers I need)
-- =========================================================================
create table if not exists public.user_missing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sticker_id uuid not null references public.stickers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, sticker_id)
);

-- =========================================================================
-- TRADE REQUESTS
-- =========================================================================
create table if not exists public.trade_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_requests_not_self check (from_user_id <> to_user_id)
);

-- =========================================================================
-- TRADE REQUEST ITEMS
-- direction 'give'    = from_user gives this sticker to to_user
-- direction 'receive' = from_user receives this sticker from to_user
-- =========================================================================
create table if not exists public.trade_request_items (
  id uuid primary key default gen_random_uuid(),
  trade_request_id uuid not null references public.trade_requests (id) on delete cascade,
  sticker_id uuid not null references public.stickers (id) on delete cascade,
  direction text not null check (direction in ('give', 'receive')),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- ADMIN LOGS
-- =========================================================================
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- INDEXES
-- =========================================================================
create index if not exists idx_profiles_city on public.profiles (city);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_user_duplicates_user on public.user_duplicates (user_id);
create index if not exists idx_user_duplicates_sticker on public.user_duplicates (sticker_id);
create index if not exists idx_user_missing_user on public.user_missing (user_id);
create index if not exists idx_user_missing_sticker on public.user_missing (sticker_id);
create index if not exists idx_trade_requests_from on public.trade_requests (from_user_id);
create index if not exists idx_trade_requests_to on public.trade_requests (to_user_id);
create index if not exists idx_trade_requests_status on public.trade_requests (status);
create index if not exists idx_trade_request_items_trade on public.trade_request_items (trade_request_id);
create index if not exists idx_admin_logs_admin on public.admin_logs (admin_id);

-- =========================================================================
-- HELPER FUNCTIONS
-- =========================================================================

-- is_admin: security definer so it can read profiles regardless of RLS,
-- avoiding recursive-policy issues.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and status = 'active'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;

-- updated_at bookkeeping trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profile_contacts_updated_at on public.profile_contacts;
create trigger trg_profile_contacts_updated_at
  before update on public.profile_contacts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_trade_requests_updated_at on public.trade_requests;
create trigger trg_trade_requests_updated_at
  before update on public.trade_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Prevent a non-admin from self-promoting role or unlocking their own status.
-- auth.uid() is null for trusted server-side contexts (service_role key,
-- direct SQL migrations/seeds, the Supabase SQL editor) - only requests made
-- under an authenticated end-user session are restricted here.
create or replace function public.prevent_role_status_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and auth.uid() is not null
     and not public.is_admin(auth.uid()) then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_escalation on public.profiles;
create trigger trg_profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_status_escalation();

-- Validate trade request status transitions & who may perform them
create or replace function public.validate_trade_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if new.status = old.status then
    return new;
  end if;

  if public.is_admin(caller) then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    if caller <> old.to_user_id then
      raise exception 'only the recipient can accept or decline this trade request';
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'cancelled' then
    if caller <> old.from_user_id then
      raise exception 'only the sender can cancel a pending trade request';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status in ('completed', 'cancelled') then
    if caller <> old.from_user_id and caller <> old.to_user_id then
      raise exception 'only a trade participant can update this trade request';
    end if;
    return new;
  end if;

  raise exception 'invalid trade status transition from % to %', old.status, new.status;
end;
$$;

drop trigger if exists trg_trade_requests_validate_transition on public.trade_requests;
create trigger trg_trade_requests_validate_transition
  before update on public.trade_requests
  for each row execute function public.validate_trade_status_transition();

-- Auto-create a profile (+ empty contact row) whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, city, neighborhood)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'neighborhood', '')
  )
  on conflict (id) do nothing;

  insert into public.profile_contacts (user_id, phone, whatsapp)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Regenerate catalog stickers 1..N (used when admin sets total_stickers)
create or replace function public.generate_sticker_range(p_total integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'only admins may generate the sticker catalog';
  end if;

  insert into public.stickers (number)
  select gs
  from generate_series(1, greatest(p_total, 0)) as gs
  on conflict (number) do nothing;

  update public.app_settings
  set total_stickers = greatest(p_total, 0)
  where id = true;
end;
$$;

grant execute on function public.generate_sticker_range(integer) to authenticated;
