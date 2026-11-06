-- ------------------------------------------------------------------ *
-- Account and message security policies
--
-- This migration is idempotent. It closes the messages read policy, protects
-- the two profile columns that could otherwise be rewritten by a signed-in
-- visitor, and keeps the account-state RPCs server-only.
-- ------------------------------------------------------------------ *

-- Messages are written by the contact form and read only with the service
-- role by the desk. No signed-in visitor may select them through PostgREST.
drop policy if exists "messages can be read by their author" on public.messages;
drop policy if exists "messages are the desk's alone" on public.messages;
drop policy if exists "messages can be read by the desk" on public.messages;
create policy "messages can be read by the desk"
  on public.messages for select
  using (false);

-- A visitor may update harmless parts of their own profile, but the desk's
-- fields and the household binding cannot be changed through PostgREST.
-- `household_device` is protected so a second device cannot bypass the
-- household confirmation, and `created_at` cannot be rewritten to hide an
-- account's age.
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
    new.household_device := old.household_device;
    new.note := old.note;
    new.email := old.email;
    new.last_seen_at := old.last_seen_at;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_plan_columns on public.profiles;
create trigger protect_plan_columns
  before update on public.profiles
  for each row execute function public.protect_plan_columns();

-- Account state contains plan, bypass, household and watch-time details.
-- The server authenticates the caller and then reads it with the service
-- role. Browser roles must not be able to invoke it for another user id.
revoke execute on function public.account_state(uuid) from public, anon, authenticated;
grant execute on function public.account_state(uuid) to service_role;

revoke execute on function public.minutes_watched_today(uuid) from public, anon, authenticated;
grant execute on function public.minutes_watched_today(uuid) to service_role;
