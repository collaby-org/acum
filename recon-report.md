# ACUM household / concurrent-stream recon (read-only)

Restarted: 2026-10-22. Read-only — no mutations.

---

## 1) Plans table / stream limits (current vs brief)

- `supabase/schema.sql:22-38` profiles table: `plan` check = ('free','monthly','lifetime','household','comp'); `household_id uuid`; no `stream_limit` column yet.
- `supabase/schema.sql:110-122` `daily_allowance_seconds()` — gives paid plans 2147483647 (infinite minutes), free gets 7200s (2h). No concurrent limit.
- `src/lib/supabase/plans.ts:22-27` SEATS: free=1, monthly=1, lifetime=1, household=4. This is *people sharing*, not concurrent streams.
- `src/lib/site.ts` plan catalogue (prices/features) — no concurrent stream field.
- **Gap / brief target:** need per-plan concurrent limits (free=1, monthly=2, household=4, lifetime=2, comp=bypass) separate from seats/allowance.

---

## 2) account_state RPC (enforcement source of truth)

- `supabase/schema.sql:320-337` `public.account_state(p_user uuid)` returns JSON: `plan`, `plan_until`, `bypass`, `minutes_watched_today`, `allowance_minutes`, `household_id`. No `stream_limit`, no concurrent session count.
- `src/lib/account-gate.ts:68-88` gate() calls RPC, reads `bypass`, `plan`, `minutes_watched_today`, `allowance_minutes`; computes `spent` (watch ≥ allowance) then `allowed = bypass || !spent`. **Fail-closed:** DB error → `allowed=false, reason="unknown"` (line 89-92).
- **Gap:** account_state does not expose concurrent streams; gate() only checks daily allowance, not household/stream count.

---

## 3) watch_sessions schema (used for allowance, could extend to session tracking)

- `supabase/schema.sql:96-107` `watch_sessions` (user_id, channel_id, seconds, started_at, ended_at). Index on (user_id, started_at DESC). Used by `minutes_watched_today()` (line 125-136).
- **Gap:** no session/device fingerprint column; no concurrent count derived from this table (only daily sum).

---

## 4) Stream token / POST /api/player (gate point + manifest minting)

- `src/app/api/player/route.ts:103-209` POST endpoint. Line 112: `const verdict = await gate(request);`. If !allowed → 403 `{error:"paywall", reason}` (line 113-118).
- Token minting: line 188 `signStreamToken(candidate, channelId ?? undefined)` — uses `src/lib/stream.ts:334-345`. Token payload = `{expires}:{channelId}:{url}` signed with HMAC. Token carries no user/session identity; proxy reads it in `/api/stream`.
- **Evidence:** gate is the correct enforcement point for manifest (fail-closed already present); mid-playback needs separate mechanism (segment proxy can detect disconnect / new device via viewer id).

---

## 5) Live-audience counter storage (process memory, not shared)

- `src/lib/audience.ts:24-92` in-memory `Map` per process (`viewers` channel → viewerId → timestamp), 90s window (`WINDOW_MS=90000`). `touchAudience()` called from proxy.
- `src/app/api/stream/route.ts:63` `if (channelId && viewer) touchAudience(channelId, viewer);`
- `src/lib/stream.ts:278-312` `rewritePlaylist()` propagates `v=` viewer and `c=` channel to every segment URL so proxy sees all.
- **Gap:** audience is per-channel, not per-user/household concurrent limit. Could reuse viewer map for concurrent session tracking by user (needs device fingerprint key instead of random viewer id).

---

## 6) Existing householdId usage

- `supabase/schema.sql:35-36` profiles.household_id; line 48-54 households table (id, name, owner_id, seats default 4).
- `supabase/schema.sql:254-263` RLS: household visible to members (select household_id from profiles where id=auth.uid()).
- `src/app/api/account/route.ts:53-54` account_state-like response includes `householdId`. Lines 245, 261-262, 278-279 read `household_id`. Stripe webhook (`src/app/api/webhook/stripe/route.ts:147-212`) creates/updates household on purchase.
- `src/lib/account-gate.ts`: **does NOT read household_id from RPC** — only uses individual profile's plan/bypass/allowance. Household members' concurrent usage is not aggregated.

---

## 7) Design brief confirmation

Brief: per-plan stream limits (free=1, monthly=2, household=4, lifetime=2, comp=bypass), household binding via first-play device + re-verify prompt for new devices, fail-closed enforcement at gate() + mid-playback report.

- **Free=1 / monthly=2 / household=4 / lifetime=2 / comp=bypass** — not present; must add to plan definition / account_state / gate logic.
- **Household binding** — `household_id` exists; needs "first-play device fingerprint" storage + new-device prompt (re-verify). Could extend profiles or new `devices` table; re-verify could block gate() until acknowledged.
- **Fail-closed at gate()** — already done (`account_state` error → deny). Need to extend to check concurrent count.
- **Mid-playback report** — `/api/stream` receives segment requests every ~few sec; server can infer session alive. Need client→server heartbeat or server-side timeout + disconnect event. Could use `watch_sessions` insert/update or new `stream_sessions` table with `started_at` and `last_seen_at` updated by proxy.

---

## Minimal MVP plan (read-only → design only)

**Phase 1 (data):**
- Add `stream_limit integer` / `stream_limit` to `profiles` or compute from plan in `account_state`; or add `stream_limit` to `plans` definition.
- Add `device_fingerprint text` / `device_verified bool` to profiles (or new `household_devices` table linked to household_id).
- Extend `watch_sessions` or create `stream_sessions` (user_id/household_id, device_fingerprint, started_at, last_seen_at, channel_id) for concurrent count.

**Phase 2 (gate enforcement — fail-closed):**
- In `gate()` (`src/lib/account-gate.ts:40-97`): after account_state, compute `current_streams = count(stream_sessions where household_id = ? and last_seen_at > now()-window)`; compare to plan limit; if exceeded → `allowed=false, reason="limit"`.
- Add household aggregation: if profile has `household_id`, count across all members of that household (use `household_id` from account_state, not just individual).

**Phase 3 (household binding / device):**
- On first successful `gate()`: if no `device_fingerprint` for this session, record fingerprint (from request header / payload); bind to profile/household.
- New device (different fingerprint): gate returns `allowed=false, reason="verify"`; client shows re-verify prompt; after acknowledgment, store new fingerprint.

**Phase 4 (mid-playback):**
- Proxy (`src/app/api/stream/route.ts`) updates `stream_sessions` `last_seen_at` on each segment request (with viewer + channel + token-derived identity).
- Client can also POST to `/api/player` with `viewer` (already done); could add `/api/stream/report` for explicit disconnect, but timeout-based cleanup (30-90s) may suffice for MVP.

**Evidence lines cited:**
- Plans/seat defs: `src/lib/supabase/plans.ts:22-27`
- Gate + account_state call: `src/lib/account-gate.ts:40-97`
- Schema profiles/household/watch_sessions/account_state: `supabase/schema.sql:22-38,96-122,320-337`
- Player gate (POST /api/player): `src/app/api/player/route.ts:112-118`
- Stream token: `src/lib/stream.ts:334-345`
- Audience storage (in-memory): `src/lib/audience.ts:24-92`
- Household read / account API: `src/app/api/account/route.ts:53-54,245,261-279`
