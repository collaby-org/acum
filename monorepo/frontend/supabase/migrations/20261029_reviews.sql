-- ------------------------------------------------------------------ *
-- Reviews and reactions

-- Run this once against the project, in the SQL editor, before the
-- feature goes live. Until it lands, `GET /api/reviews` answers with an
-- empty, configured:false shape and every write answers 503 — a deploy
-- that lands before this file is harmless, not broken.

-- Two tables, and the split is what keeps the counts honest:

--   reviews            one row per review, readable by everybody
--   review_reactions   one row per (review, account), readable by its
--                      author and nobody else

-- The counts are therefore never a column a browser can write. They are
-- aggregated by a `security definer` function, which is the only thing
-- that reads the whole table, and it hands back integers.
-- ------------------------------------------------------------------ *

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The catalogue id the review is about. 
  channel_id text not null,
  -- The channel's name as it was when the review was written. 
  channel_name text not null,
  -- What was on air, so the review survives the schedule rolling over. 
  programme_title text,
  programme_starts_at timestamptz,
  programme_ends_at timestamptz,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  --
   * The author in the words the account goes by, copied at write time.
   * The profile row is nobody else's business, so the label travels with
   * the review instead of being joined back. It is a label, not an
   * identity, and it is never invented.
   */
  author_label text not null default 'Vizionator',
  created_at timestamptz not null default now()
);

comment on table public.reviews is
  'A review of one show on one channel. Written by a signed-in account, readable by everybody.';

-- One review per account per slot. A rerun of the same show is a
-- different slot, so it may be reviewed again; the same slot twice is not.
create unique index if not exists reviews_one_per_slot
  on public.reviews (user_id, channel_id, programme_starts_at)
  where programme_starts_at is not null;

-- A review with no programme in the guide is a review of the channel as
-- a whole, and one per account.
create unique index if not exists reviews_one_per_channel
  on public.reviews (user_id, channel_id)
  where programme_starts_at is null;

create index if not exists reviews_channel_idx
  on public.reviews (channel_id, created_at desc);
create index if not exists reviews_recent_idx
  on public.reviews (created_at desc);

create table if not exists public.review_reactions (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  --
   * `like`, `love` or `clap`. The weights differ, so the three are three
   * kinds and not one counter with a bigger number in it.
   */
  kind text not null check (kind in ('like', 'love', 'clap')),
  created_at timestamptz not null default now(),
  -- One reaction per visitor per review. The row is replaced, not added to. 
  primary key (review_id, user_id)
);

comment on table public.review_reactions is
  'One reaction per account per review. Changeable, and never a free-for-all counter.';

create index if not exists review_reactions_review_idx
  on public.review_reactions (review_id);

alter table public.reviews enable row level security;
alter table public.review_reactions enable row level security;

-- Reading is open: the reviews and their counts are for everybody, the
-- same way the guide is.
drop policy if exists "reviews are readable by everybody" on public.reviews;
create policy "reviews are readable by everybody"
  on public.reviews for select
  using (true);

-- Writing is a signed-in act, and only ever on one's own row. There is no
-- update policy: a review is written once, and deleted by its author.
drop policy if exists "reviews are written by their author" on public.reviews;
create policy "reviews are written by their author"
  on public.reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "reviews are deleted by their author" on public.reviews;
create policy "reviews are deleted by their author"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- A visitor reads their own reaction and nobody else's. Who reacted to
-- what is not public information; how many people reacted is, and that
-- comes from the function below.
drop policy if exists "reactions are their own" on public.review_reactions;
create policy "reactions are their own"
  on public.review_reactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Counts, for everybody, in integers.

-- `security definer` is what makes this work: the table itself is closed
-- to everybody but its author, so the only way to publish a count is a
-- function that reads the whole table and hands back three numbers. The
-- search_path is pinned, and the function is `stable` — it reads, it
-- never writes, and it can never be talked into more than that.
create or replace function public.review_reaction_counts(p_ids uuid[])
returns table (
  review_id uuid,
  like_count integer,
  love_count integer,
  clap_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.review_id,
         count(*) filter (where r.kind = 'like')::integer as like_count,
         count(*) filter (where r.kind = 'love')::integer as love_count,
         count(*) filter (where r.kind = 'clap')::integer as clap_count
  from public.review_reactions r
  where r.review_id = any (p_ids)
  group by r.review_id;
$$;

comment on function public.review_reaction_counts(uuid[]) is
  'The like/love/clap counts of a set of reviews. The table they come from is nobody else''s to read.';

grant execute on function public.review_reaction_counts(uuid[]) to anon, authenticated;
