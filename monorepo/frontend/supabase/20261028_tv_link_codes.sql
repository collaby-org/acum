-- ACUM — the television link.
--
-- A television cannot type a password. It shows a code, a phone signs in
-- and hands its session to that code, and the television takes it. This
-- table is where that hand-off waits: one row per code, holding the
-- session once the phone has given it.
--
-- The code is short-lived by construction — every row carries an expiry
-- the code is checked against, not a cron that has to run — and spent
-- when the television takes the session, so a second television with the
-- same code finds nothing. The phone's token is only ever in this row:
-- it is what the television exchanges the code for, and nothing else.
--
-- Row level security is on with no policies at all: only the service
-- role, which is what the bridge runs as, can read or write here. The
-- browser is never pointed at this table directly, and the policies would
-- only let it read a session it should not have.

create table if not exists public.tv_link_codes (
  code text primary key,
  -- Which television asked. Echoed back on confirmation, nothing more:
  -- the code is the proof, not the device id.
  tv_id text,
  -- pending -> confirmed, or expired (written when the row is read past
  -- its expiry).
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired')),
  -- The phone's own Supabase session token. Null until the phone confirms.
  access_token text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- The only read the television does is "is my code confirmed yet", so
-- the code itself would be enough — but the poll is hot, and an index on
-- the status keeps it from scanning every expired row.
create index if not exists tv_link_codes_status_idx
  on public.tv_link_codes (status)
  where status = 'pending';

alter table public.tv_link_codes enable row level security;
