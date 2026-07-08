-- Sticker Trade IL - richer marketplace listing options per duplicate sticker

alter table public.user_duplicates
  add column if not exists listing_type text not null default 'trade'
    check (listing_type in ('trade', 'sale', 'both'));

alter table public.user_duplicates
  add column if not exists price numeric(10, 2) check (price is null or price >= 0);

-- Backfill from the old boolean flag, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_duplicates' and column_name = 'for_sale'
  ) then
    update public.user_duplicates set listing_type = 'both' where for_sale is true;
    alter table public.user_duplicates drop column for_sale;
  end if;
end $$;

create index if not exists idx_user_duplicates_listing_type on public.user_duplicates (listing_type);
