/**
 * The streams a plan may run at once, and the house they belong to.
 *
 * Two things are decided here, and both are decided on the server:
 *
 *   1. **How many.** The free tier is one stream, the individual plan two,
 *      the household and lifetime plans four. The count is the number of
 *      rows in `stream_sessions` that are still alive — not a number the
 *      browser keeps, because a browser can be told to keep a different one.
 *   2. **From where.** A household plan is bound to one device, the first
 *      one that played. A second device is not refused for good: it is asked
 *      to confirm the household, and confirming re-binds it. That is the
 *      case the product must survive — a new phone, a holiday, a move.
 *
 * The registry is deliberately forgiving. The repository is deployed before
 * the database is migrated, so every statement here treats "the table or the
 * column does not exist" as "there is nothing to enforce yet" and lets the
 * picture through. A limit that fails closed on a missing table would brick
 * the product on the first deploy.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserClient } from "@/lib/supabase/server";
import { bindsHousehold, streamLimit, type Plan } from "@/lib/supabase/plans";

/**
 * How long a session counts as alive without a heartbeat.
 *
 * The player beats every thirty seconds; ninety leaves room for a tab that
 * was backgrounded, a retry and a slow segment before the seat is freed.
 */
const LIVE_WINDOW_MS = 90_000;

/** A device identifier: opaque, no spaces, no separators we do not expect. */
const DEVICE = /^[A-Za-z0-9._-]{8,128}$/;

/** A salt for the fallback fingerprint, so the hash is not portable. */
const SALT = process.env.ACUM_DEVICE_SALT ?? "acum-streams";

/**
 * The device that asked, as the browser named it.
 *
 * The header is the real answer. When a client is too old to send one — or
 * an attacker simply removes it — the request is still given a stable name,
 * built from the browser string and the address it came from. That is not a
 * fingerprint of a person; it is enough to count and to keep a household
 * from being played from a second machine without saying so.
 */
export function deviceFrom(request: Request): string {
  const named = (request.headers.get("x-acum-device") ?? "").trim();
  if (DEVICE.test(named)) return named;

  const agent = request.headers.get("user-agent") ?? "";
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const address = forwarded.split(",")[0]?.trim() ?? "";
  const digest = createHash("sha256")
    .update(`${SALT}|${agent}|${address}`)
    .digest("base64url")
    .slice(0, 32);
  return `fp-${digest}`;
}

/** The profile fields the decision needs. */
type StreamProfile = {
  plan: string;
  bypass: boolean;
  household_id: string | null;
  household_device: string | null;
};

/** One live row of the registry. */
type LiveRow = { id: string; device: string | null };

export type StreamClaim =
  | { allowed: true; sessionId: string | null }
  | { allowed: false; reason: "stream_limit"; limit: number; active: number }
  | { allowed: false; reason: "verify_device" };

/** The account's plan and house, or null when the row cannot be read. */
async function readProfile(
  client: SupabaseClient,
  userId: string,
): Promise<StreamProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("plan,bypass,household_id,household_device")
    .eq("id", userId)
    .limit(1);

  if (error) return null;
  return (data as StreamProfile[] | null)?.[0] ?? null;
}

/** The live sessions that count against this account, or null when unknown. */
async function readLive(
  client: SupabaseClient,
  account: { userId: string; householdId: string | null },
): Promise<LiveRow[] | null> {
  const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();

  let query = client
    .from("stream_sessions")
    .select("id,device")
    .is("ended_at", null)
    .gt("last_seen_at", since);

  // A household shares one pool of screens; everybody else counts alone.
  query = account.householdId
    ? query.eq("household_id", account.householdId)
    : query.eq("user_id", account.userId);

  const { data, error } = await query.limit(50);
  if (error) return null;
  return (data as LiveRow[] | null) ?? [];
}

/** Bind the house to this device. Best-effort: the row may not exist yet. */
async function bindDevice(
  client: SupabaseClient,
  userId: string,
  device: string,
): Promise<void> {
  try {
    await client
      .from("profiles")
      .update({ household_device: device })
      .eq("id", userId);
  } catch {
    /* not migrated: nothing is bound, nothing is enforced */
  }
}

/**
 * Register this device's stream, or refresh the one it already has.
 *
 * One row per device, kept alive by the player's heartbeat, so reopening the
 * same channel on the same screen does not cost a second seat.
 */
async function openSession(
  client: SupabaseClient,
  input: {
    userId: string;
    householdId: string | null;
    device: string;
    channelId: string | null;
  },
): Promise<string | null> {
  const now = new Date().toISOString();

  try {
    const { data: existing, error: readError } = await client
      .from("stream_sessions")
      .select("id")
      .eq("user_id", input.userId)
      .eq("device", input.device)
      .is("ended_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(1);

    if (readError) return null;

    const id = (existing as { id: string }[] | null)?.[0]?.id;
    if (id) {
      await client
        .from("stream_sessions")
        .update({ last_seen_at: now, channel_id: input.channelId })
        .eq("id", id);
      return id;
    }

    const { data: inserted, error: writeError } = await client
      .from("stream_sessions")
      .insert({
        user_id: input.userId,
        household_id: input.householdId,
        device: input.device,
        channel_id: input.channelId,
        last_seen_at: now,
      })
      .select("id")
      .limit(1);

    if (writeError) return null;
    return (inserted as { id: string }[] | null)?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * May this account start a stream, and on which seat.
 *
 * The order is the product's: the plan is read, an unlimited account is let
 * through without a row, a household is checked against its device, and only
 * then is the seat counted. Everything that cannot be read is allowed —
 * the gate above has already decided whether the allowance is spent, and
 * this check must never be the reason a paying viewer sees a black frame.
 */
export async function claimStream(input: {
  token: string;
  userId: string;
  device: string;
  channelId: string | null;
}): Promise<StreamClaim> {
  const client = getUserClient(input.token);
  const profile = await readProfile(client, input.userId);

  // No profile, or no `household_device` column yet: nothing to enforce.
  if (!profile) return { allowed: true, sessionId: null };

  const plan = profile.plan as Plan;
  const limit = streamLimit(plan);

  // The desk's own accounts, and the plans without a limit, are not counted.
  if (profile.bypass || limit === null) {
    return { allowed: true, sessionId: null };
  }

  if (bindsHousehold(plan)) {
    const bound = profile.household_device;
    if (!bound) {
      await bindDevice(client, input.userId, input.device);
    } else if (bound !== input.device) {
      return { allowed: false, reason: "verify_device" };
    }
  }

  const live = await readLive(client, {
    userId: input.userId,
    householdId: profile.household_id,
  });

  // The registry is not there yet, or could not be read: let it play.
  if (live === null) return { allowed: true, sessionId: null };

  // This device's own row is not a second screen.
  const others = live.filter((row) => row.device !== input.device).length;
  if (others >= limit) {
    return { allowed: false, reason: "stream_limit", limit, active: others };
  }

  const sessionId = await openSession(client, {
    userId: input.userId,
    householdId: profile.household_id,
    device: input.device,
    channelId: input.channelId,
  });

  return { allowed: true, sessionId };
}

/** Keep a session alive. Called by the player every half minute. */
export async function touchStreamSession(input: {
  token: string;
  userId: string;
  sessionId: string;
}): Promise<boolean> {
  try {
    const { error } = await getUserClient(input.token)
      .from("stream_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", input.sessionId)
      .eq("user_id", input.userId);
    return !error;
  } catch {
    return false;
  }
}

/** Close a session: the player was closed, or moved to another channel. */
export async function endStreamSession(input: {
  token: string;
  userId: string;
  sessionId: string;
}): Promise<boolean> {
  try {
    const { error } = await getUserClient(input.token)
      .from("stream_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", input.sessionId)
      .eq("user_id", input.userId)
      .is("ended_at", null);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Confirm the household on this device.
 *
 * The deliberate act behind "update household": the viewer says this is the
 * screen the house plays on. Every other live session of the account is
 * closed, because the point of the confirmation is that there is one home,
 * not two.
 */
export async function rebindHousehold(input: {
  token: string;
  userId: string;
  device: string;
}): Promise<boolean> {
  const client = getUserClient(input.token);
  const profile = await readProfile(client, input.userId);
  if (!profile) return false;
  if (!bindsHousehold(profile.plan as Plan)) return false;

  try {
    const { error } = await client
      .from("profiles")
      .update({ household_device: input.device })
      .eq("id", input.userId);
    if (error) return false;

    await client
      .from("stream_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("user_id", input.userId)
      .neq("device", input.device)
      .is("ended_at", null);

    return true;
  } catch {
    return false;
  }
}
