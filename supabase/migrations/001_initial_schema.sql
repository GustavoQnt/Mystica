-- Profiles (extends auth.users)
create table public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  plan                text not null default 'free' check (plan in ('free', 'paid')),
  readings_this_month int not null default 0,
  month_cycle         text not null default '',
  updated_at          timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Readings
create table public.readings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users on delete cascade not null,
  status         text not null check (status in ('drawn', 'completed', 'failed')),
  spread_type    text not null check (spread_type in ('tres-cartas', 'carta-do-dia')),
  question       text,
  card_ids       int[] not null,
  interpretation text,
  metadata       jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.readings enable row level security;

create policy "Users can view own readings"
  on public.readings for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own readings"
  on public.readings for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own readings"
  on public.readings for update
  using ((select auth.uid()) = user_id);

-- Index for history queries
create index readings_user_created on public.readings (user_id, created_at desc);
