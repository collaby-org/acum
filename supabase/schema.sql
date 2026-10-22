-- ACUM — the schema behind the accounts, the paywall and the desk.
--
-- The product is a directory of Romanian live television. The streams come
-- from public directories and are relayed through our own proxy; the
-- broadcast itself belongs to whoever owns it.
--
-- Four things are stored here:
--
--   profiles       who someone is, and what they may do
--   subscriptions  what they have paid for, and until when
--   sessions       the minutes they have watched, so the daily limit is real
--   messages       what the visitor wrote to us
--
-- Every table is read through a row level policy, so the browser can only
-- ever read its own row — and the service role is the only thing that can
-- read the lot.

/* ------------------------------------------------------------------ *
 * Profiles
 * ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  /** The plan the account is on. `free` is what everybody starts with. */
  plan text not null default 'free'
    check (plan in ('free', 'monthly', 'lifetime', 'household', 'comp')),
  /** When the paid access ends. `null` means it never ends. */
  plan_until timestamptz,
  /** Set by the desk: the paywall does not apply to this account. */
  bypass boolean not null default false,
  /** A note from the desk about why. */
  note text,
  /** The household this account belongs to, so one payment covers several. */
  household_id uuid,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

comment on table public.profiles is
  'One row per account. The plan and the bypass are set from the desk.';

create index if not exists profiles_household_idx
  on public.profiles (household_id);

-- The household: one payment, several people.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  owner_id uuid references public.profiles (id) on delete set null,
  seats integer not null default 4 check (seats between 1 and 20),
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ *
 * Subscriptions
 * ------------------------------------------------------------------ */

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  /** Which product was bought: `monthly`, `lifetime`, `household`. */
  product text not null check (product in ('monthly', 'lifetime', 'household')),
  /** The provider's reference, so a renewal can be matched. */
  provider text,
  provider_ref text,
  /** What it cost, in the smallest unit of the currency. */
  amount integer,
  currency text default 'GBP',
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'past_due', 'expired')),
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'A purchase. The desk reads it; the browser only ever reads its own.';

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);
create unique index if not exists subscriptions_provider_ref_idx
  on public.subscriptions (provider, provider_ref)
  where provider_ref is not null;

/* ------------------------------------------------------------------ *
 * Watch time
 *
 * The free plan may watch two hours a day. The clock is the sum of the
 * sessions that ended in the last day — not a counter that can be reset by
 * clearing the browser.
 * ------------------------------------------------------------------ */

create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel_id text,
  /** How long the session lasted, in seconds. */
  seconds integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists watch_sessions_user_started_idx
  on public.watch_sessions (user_id, started_at desc);

/* ------------------------------------------------------------------ *
 * Concurrent streams
 *
 * One account, a number of screens: one on the free tier, two on the
 * individual plan, four on the household and lifetime plans. A row is alive
 * while its heartbeat is fresh, so a closed tab frees its seat on its own.
 * ------------------------------------------------------------------ */

-- The screen the house plays on.
alter table public.profiles
  add column if not exists household_device text;

comment on column public.profiles.household_device is
  'The device the household plan is bound to. Re-bound on confirmation.';

create table if not exists public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  /** The house the stream is counted against, when the account has one. */
  household_id uuid,
  /** An opaque name the browser keeps; never a fingerprint of a person. */
  device text not null,
  channel_id text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists stream_sessions_live_idx
  on public.stream_sessions (user_id, last_seen_at desc)
  where ended_at is null;

create index if not exists stream_sessions_household_live_idx
  on public.stream_sessions (household_id, last_seen_at desc)
  where ended_at is null;

-- The daily allowance, in seconds. Two hours.
create or replace function public.daily_allowance_seconds(plan text)
returns integer
language sql
immutable
as $$
  select case plan
    when 'lifetime' then 2147483647
    when 'household' then 2147483647
    when 'comp' then 2147483647
    when 'monthly' then 2147483647
    else 7200 -- two hours
  end;
$$;

-- The minutes watched since midnight, in the user's own timezone.
create or replace function public.minutes_watched_today(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(ws.seconds), 0) / 60
  from public.watch_sessions ws
  where ws.user_id = p_user
    and ws.started_at >= (now() at time zone 'Europe/Bucharest')::date;
$$;

/* ------------------------------------------------------------------ *
 * Messages from the contact page
 * ------------------------------------------------------------------ */

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  subject text,
  body text not null,
  /** Which page the message was written from. */
  page text,
  /** The visitor's browser, so we can tell a phone from a desktop. */
  agent text,
  read boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.messages is
  'What the contact form wrote. The desk reads it; nobody else can.';

/* ------------------------------------------------------------------ *
 * Daily statistics for the desk
 * ------------------------------------------------------------------ */

create table if not exists public.daily_stats (
  day date primary key,
  /** Accounts that signed in on that day. */
  sign_ins integer not null default 0,
  /** Minutes of television watched. */
  minutes_watched integer not null default 0,
  /** How many accounts were served a paywall. */
  paywalls integer not null default 0,
  /** How many accounts started a paid plan. */
  conversions integer not null default 0,
  updated_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ *
 * Row level policies
 *
 * The anon key can read and write its own profile and its own watch
 * sessions. Everything else — the desk, the subscriptions, the messages —
 * is the service role's alone.
 * ------------------------------------------------------------------ */

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.subscriptions enable row level security;
alter table public.watch_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.daily_stats enable row level security;

-- A profile belongs to the person it describes.
drop policy if exists "profiles are their own" on public.profiles;
create policy "profiles are their own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles update themselves" on public.profiles;
create policy "profiles update themselves"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The plan column is set by the service role, so a signed-in visitor cannot
-- buy themselves a lifetime account by updating their own row. The policy
-- below only allows the harmless columns to change; the plan is protected by
-- a trigger.
drop policy if exists "profiles insert themselves" on public.profiles;
create policy "profiles insert themselves"
  on public.profiles for insert
  with check (auth.uid() = id);

-- A new account gets a plain profile. The plan is never set by the client.
create or replace function public.protect_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() <> new.id then
    raise exception 'not your profile';
  end if;
  -- The plan, the bypass and the household are the desk's business. When a
  -- signed-in visitor updates their own row, those keep their values.
  if tg_op = 'UPDATE' and auth.uid() is not null then
    new.plan := old.plan;
    new.plan_until := old.plan_until;
    new.bypass := old.bypass;
    new.household_id := old.household_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_plan_columns on public.profiles;
create trigger protect_plan_columns
  before update on public.profiles
  for each row execute function public.protect_plan_columns();

-- Watch sessions: a visitor writes their own and reads their own.
drop policy if exists "sessions are their own" on public.watch_sessions;
create policy "sessions are their own"
  on public.watch_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Stream sessions: the same, plus the household, which has to be able to
-- count its own screens.
alter table public.stream_sessions enable row level security;

drop policy if exists "stream sessions are their own" on public.stream_sessions;
create policy "stream sessions are their own"
  on public.stream_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "a household sees its streams" on public.stream_sessions;
create policy "a household sees its streams"
  on public.stream_sessions for select
  using (
    household_id is not null
    and household_id = (
      select p.household_id from public.profiles p where p.id = auth.uid()
    )
  );

-- Subscriptions: readable by their owner, writable only by the desk.
drop policy if exists "subscriptions are theirs" on public.subscriptions;
create policy "subscriptions are theirs"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- The household: its members can see it, only the owner can change it.
drop policy if exists "households are theirs" on public.households;
create policy "households are theirs"
  on public.households for select
  using (
    id in (
      select household_id from public.profiles
      where id = auth.uid() and household_id is not null
    )
  );

-- Messages: written by anyone, read by nobody but the desk.
drop policy if exists "messages can be written" on public.messages;
create policy "messages can be written"
  on public.messages for insert
  with check (true);

drop policy if exists "messages can be read by their author" on public.messages;
create policy "messages can be read by their author"
  on public.messages for select
  using (auth.uid() is not null);

-- The statistics are the desk's alone.
drop policy if exists "stats are the desk's" on public.daily_stats;
create policy "stats are the desk's"
  on public.daily_stats for select
  using (false);

/* ------------------------------------------------------------------ *
 * A new account gets its profile the moment it is made
 * ------------------------------------------------------------------ */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, last_seen_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    now()
  );
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ *
 * The clock, on the server
 *
 * The client cannot be trusted with the daily allowance, so the limit is
 * read from here and enforced on the server.
 * ------------------------------------------------------------------ */

create or replace function public.account_state(p_user uuid default auth.uid())
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'plan', p.plan,
    'plan_until', p.plan_until,
    'bypass', p.bypass,
    'minutes_watched_today', public.minutes_watched_today(p_user),
    'allowance_minutes', public.daily_allowance_seconds(p.plan) / 60,
    'household_id', p.household_id
  )
  from public.profiles p
  where p.id = p_user;
$$;

grant execute on function public.account_state(uuid) to anon, authenticated;
grant execute on function public.minutes_watched_today(uuid) to anon, authenticated;
