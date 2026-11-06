-- ------------------------------------------------------------------ *
-- Review table privileges and author updates
--
-- Row level security decides which rows a browser role may touch. Table
-- privileges decide which operations it may attempt at all. The review
-- tables therefore get the second lock too: an anonymous visitor can read
-- public reviews, while a signed-in visitor keeps the row operations its
-- own token needs. RLS still confines every write to the visitor's rows.
--
-- This migration is idempotent. The public count function remains
-- available to the browser roles; it is the only way to publish the
-- aggregate reaction counts.
-- ------------------------------------------------------------------ *

-- Anonymous visitors may read the public reviews. They cannot read the
-- private reaction rows and cannot write either table.
revoke all privileges on table public.reviews from anon;
revoke all privileges on table public.review_reactions from anon;

grant select on table public.reviews to anon;

-- A signed-in visitor reads and writes their own review and reaction rows.
-- TRUNCATE is not covered by RLS, and TRIGGER and REFERENCES are never used
-- by the application, so none of those privileges belong to a browser role.
revoke truncate, trigger, references on table public.reviews from authenticated;
revoke truncate, trigger, references on table public.review_reactions from authenticated;

grant select, insert, update, delete on table public.reviews to authenticated;
grant select, insert, update, delete on table public.review_reactions to authenticated;

-- A review is written once, changed by its author, and deleted by its
-- author. The author-scoped update policy makes the visitor's edit path
-- work under their own token while still refusing another account's row.
drop policy if exists "reviews are changed by their author" on public.reviews;
create policy "reviews are changed by their author"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The aggregate counts are public by design. The function is the only
-- path to the reaction rows that crosses their row-level policy.
grant execute on function public.review_reaction_counts(uuid[]) to anon, authenticated;
