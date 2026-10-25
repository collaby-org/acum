-- ------------------------------------------------------------------ *
-- Concurrent streams and the household device
--
-- Run this once against the project, in the SQL editor, before the feature
-- starts counting. The application tolerates its absence: until the table
-- exists, every playback is allowed and nothing is counted, so a deploy that
-- lands before this file is harmless.
-- ------------------------------------------------------------------ *

-- The screen the house plays on. Bound on the first playback of a household
-- or lifetime plan, and re-bound deliberately, the way the streaming
-- services ask when somebody moves or travels.
alter table public.profiles
  add column if not exists household_device text;

comment on column public.profiles.household_device is
  'The device the household plan is bound to. Re-bound on confirmation.';

-- One row per playing device. A row is alive while `ended_at` is null and
-- the heartbeat is fresh; the timeout is the backstop for a closed tab.
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

comment on table public.stream_sessions is
  'Who is playing right now, on which screen. Counted by the player endpoint.';

create index if not exists stream_sessions_live_idx
  on public.stream_sessions (user_id, last_seen_at desc)
  where ended_at is null;

create index if not exists stream_sessions_household_live_idx
  on public.stream_sessions (household_id, last_seen_at desc)
  where ended_at is null;

alter table public.stream_sessions enable row level security;

-- A device writes and updates its own row.
drop policy if exists "stream sessions are their own" on public.stream_sessions;
create policy "stream sessions are their own"
  on public.stream_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A household counts its members' screens, so it may read them. The
-- subquery reads the caller's own profile, which the profile policy allows.
drop policy if exists "a household sees its streams" on public.stream_sessions;
create policy "a household sees its streams"
  on public.stream_sessions for select
  using (
    household_id is not null
    and household_id = (
      select p.household_id from public.profiles p where p.id = auth.uid()
    )
  );
