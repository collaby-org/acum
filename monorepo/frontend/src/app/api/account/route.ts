/**
 * The account.
 *
 * `GET /api/account` — the state of the account, right now: the plan, the
 * minutes watched today, the allowance and whether the picture is gated.
 *
 * `POST /api/account` — a watch session: the channel and the seconds. The
 * session is written and the new state comes back.
 *
 * The browser is never trusted with the clock. The visitor says how long it
 * thinks it watched; the server decides what is written down:
 *
 *   - the seconds are clamped to what the wall clock allows — a day cannot
 *     hold more watch time than it has hours, whatever the browser claims,
 *   - a negative number is not a way to take time back off the counter,
 *   - a single report cannot be bigger than a quarter of an hour,
 *   - and the row level policies make sure the session belongs to the
 *     visitor who sent it.
 *
 * The plan itself is never read from the browser: it lives on the profile
 * row, the row level policies keep the visitor's hand off it, and the
 * trigger in the schema throws if a signed-in visitor tries to change it.
 */
import { bearerToken, getUserClient, readUser } from "@/lib/supabase/server";
import {
  allowanceMinutes,
  FREE_ALLOWANCE_SECONDS,
  type Plan,
} from "@/lib/supabase/plans";

/** The state the interface works with. */
export type AccountState = {
  /** True when somebody is signed in. */
  signedIn: boolean;
  /** The account's email, when it is known. */
  email: string | null;
  /** The plan the account is on, after an expired plan has been demoted. */
  plan: Plan;
  /** When the paid access ends. `null` means it never ends. */
  planUntil: string | null;
  /** True when the desk lifted the limit for this account. */
  bypass: boolean;
  /** The minutes watched since midnight, in Romania. */
  minutesWatchedToday: number;
  /** The daily allowance in minutes. `null` means there is no limit. */
  allowanceMinutes: number | null;
  /** The minutes left today. `null` when there is no limit. */
  remainingMinutes: number | null;
  /** True when the picture must not play. */
  gated: boolean;
  /** Why the picture is gated. */
  reason: "signed_out" | "allowance_spent" | null;
  /** The household this account belongs to, when it belongs to one. */
  householdId: string | null;
  /** True when the state was read from the server. */
  ready: boolean;
};

/**
 * How much the wall clock may disagree with the browser.
 *
 * The visitor's timer and the server's clock are two different clocks; a
 * minute of slack keeps a fair report from being cut short, and a minute is
 * nothing next to a two hour allowance.
 */
const CLOCK_TOLERANCE_SECONDS = 60;

/** The largest report a single request may carry. */
const MAX_REPORT_SECONDS = 900;

/** How often the profile's "last seen" is written. */
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1000;

/** The last time each account was written to, per process. */
const lastSeen = new Map<string, number>();

/** The state of a visitor who is not signed in. */
function anonymousState(): AccountState {
  return {
    signedIn: false,
    email: null,
    plan: "free",
    planUntil: null,
    bypass: false,
    minutesWatchedToday: 0,
    allowanceMinutes: FREE_ALLOWANCE_SECONDS / 60,
    remainingMinutes: FREE_ALLOWANCE_SECONDS / 60,
    gated: true,
    reason: "signed_out",
    householdId: null,
    ready: true,
  };
}

/**
 * The offset of a timezone, in minutes, at a given moment.
 *
 * Romania moves between UTC+1 and UTC+2, so the offset is read from the
 * timezone database rather than assumed.
 */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour % 24,
    values.minute,
    values.second,
  );

  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * The start of today, in Romania.
 *
 * The day the allowance is counted over is the Romanian day — the same one
 * the SQL function uses — so the two never disagree about where midnight is.
 */
function romaniaDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  const midnight = Date.UTC(values.year, values.month - 1, values.day);
  const offset = zoneOffsetMinutes(now, "Europe/Bucharest");
  return new Date(midnight - offset * 60000);
}

/** A plan id that is one the schema knows. */
function readPlan(value: unknown): Plan {
  if (
    value === "free" ||
    value === "monthly" ||
    value === "lifetime" ||
    value === "household" ||
    value === "comp"
  ) {
    return value;
  }
  return "free";
}

/**
 * The state of a signed-in visitor.
 *
 * The plan is read from the profile row, but an expired plan is demoted here
 * and not in the database: the desk is the one who moves a plan on, and the
 * paywall must not trust a row whose date has passed.
 */
function buildState(input: {
  email: string | null;
  plan: Plan;
  planUntil: string | null;
  bypass: boolean;
  minutesWatchedToday: number;
  householdId: string | null;
  now: Date;
}): AccountState {
  const expired =
    input.planUntil !== null &&
    new Date(input.planUntil).getTime() <= input.now.getTime();

  const plan: Plan = expired ? "free" : input.plan;
  const limit = allowanceMinutes(plan);
  const allowance = limit ?? null;
  const remaining =
    allowance === null ? null : Math.max(0, allowance - input.minutesWatchedToday);

  // The desk's bypass lifts the limit even for a free account.
  const spent = allowance !== null && input.minutesWatchedToday >= allowance;

  return {
    signedIn: true,
    email: input.email,
    plan,
    planUntil: input.planUntil,
    bypass: input.bypass,
    minutesWatchedToday: input.minutesWatchedToday,
    allowanceMinutes: allowance,
    remainingMinutes: remaining,
    gated: !input.bypass && spent,
    reason: !input.bypass && spent ? "allowance_spent" : null,
    householdId: input.householdId,
    ready: true,
  };
}

/** The raw state row, as the database has it. */
type RawState = {
  plan?: unknown;
  plan_until?: unknown;
  bypass?: unknown;
  minutes_watched_today?: unknown;
  household_id?: unknown;
};

/**
 * Read the account state.
 *
 * The read runs under the visitor's own token, so the row level policies
 * decide what is visible: their row and nothing else.
 */
async function readState(
  accessToken: string,
  userId: string,
  email: string | null,
  now: Date,
): Promise<AccountState> {
  const client = getUserClient(accessToken);

  const { data, error } = await client.rpc("account_state", {
    p_user: userId,
  });

  if (error || !data || typeof data !== "object") {
    // The function is the shortest way in, but the state can also be read
    // from the tables themselves — and the tables are the truth.
    const { data: profile } = await client
      .from("profiles")
      .select("plan, plan_until, bypass, household_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: minutes } = await client.rpc("minutes_watched_today", {
      p_user: userId,
    });

    return buildState({
      email,
      plan: readPlan(profile?.plan),
      planUntil:
        typeof profile?.plan_until === "string" ? profile.plan_until : null,
      bypass: Boolean(profile?.bypass),
      minutesWatchedToday:
        typeof minutes === "number" ? minutes : 0,
      householdId:
        typeof profile?.household_id === "string" ? profile.household_id : null,
      now,
    });
  }

  const raw = data as RawState;

  return buildState({
    email,
    plan: readPlan(raw.plan),
    planUntil: typeof raw.plan_until === "string" ? raw.plan_until : null,
    bypass: Boolean(raw.bypass),
    minutesWatchedToday:
      typeof raw.minutes_watched_today === "number"
        ? raw.minutes_watched_today
        : 0,
    householdId:
      typeof raw.household_id === "string" ? raw.household_id : null,
    now,
  });
}

/**
 * Write the "last seen" of an account, now and then.
 *
 * The account may only be signing in to look at the catalogue, so the moment
 * is worth keeping — but a write every minute would be noise.
 */
async function touchLastSeen(
  accessToken: string,
  userId: string,
  now: Date,
): Promise<void> {
  const previous = lastSeen.get(userId) ?? 0;
  if (now.getTime() - previous < LAST_SEEN_INTERVAL_MS) return;
  lastSeen.set(userId, now.getTime());

  try {
    await getUserClient(accessToken)
      .from("profiles")
      .update({ last_seen_at: now.toISOString() })
      .eq("id", userId);
  } catch {
    /* the moment is a nicety, not a requirement */
  }
}

/** The seconds already watched today, straight from the sessions. */
async function secondsWatchedToday(
  accessToken: string,
  dayStart: Date,
): Promise<number> {
  const { data, error } = await getUserClient(accessToken)
    .from("watch_sessions")
    .select("seconds")
    .gte("started_at", dayStart.toISOString())
    .limit(1000);

  if (error || !Array.isArray(data)) return 0;

  return data.reduce((total, row) => {
    const seconds = Number(row.seconds);
    return total + (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
  }, 0);
}

/** The channel a session belongs to, as a short piece of text. */
function readChannel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const channel = value.trim().slice(0, 64);
  return channel.length > 0 ? channel : null;
}

export async function GET(request: Request) {
  const now = new Date();
  const token = bearerToken(request);

  if (!token) {
    return Response.json(anonymousState(), {
      headers: { "cache-control": "no-store" },
    });
  }

  const user = await readUser(token);
  if (!user) {
    return Response.json(anonymousState(), {
      headers: { "cache-control": "no-store" },
    });
  }

  const state = await readState(token, user.id, user.email, now);
  await touchLastSeen(token, user.id, now);

  return Response.json(state, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const now = new Date();
  const token = bearerToken(request);

  if (!token) {
    return Response.json(
      { error: "Autentifică-te pentru a înregistra vizionarea." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const user = await readUser(token);
  if (!user) {
    return Response.json(
      { error: "Sesiunea a expirat. Autentifică-te din nou." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  let payload: { channel?: unknown; seconds?: unknown };
  try {
    payload = (await request.json()) as { channel?: unknown; seconds?: unknown };
  } catch {
    payload = {};
  }

  const reported = Number(payload.seconds);
  const channel = readChannel(payload.channel);

  // The clock is the server's. A day cannot hold more watch time than it
  // has hours, so the report is cut to what the wall clock allows.
  const dayStart = romaniaDayStart(now);
  const elapsedToday = Math.max(
    0,
    Math.floor((now.getTime() - dayStart.getTime()) / 1000),
  );
  const watched = await secondsWatchedToday(token, dayStart);
  const room = Math.max(
    0,
    elapsedToday + CLOCK_TOLERANCE_SECONDS - watched,
  );

  const accepted = Math.min(
    Math.max(0, Number.isFinite(reported) ? Math.floor(reported) : 0),
    Math.min(MAX_REPORT_SECONDS, room),
  );

  if (accepted > 0) {
    const { error } = await getUserClient(token)
      .from("watch_sessions")
      .insert({
        user_id: user.id,
        channel_id: channel,
        seconds: accepted,
        started_at: new Date(now.getTime() - accepted * 1000).toISOString(),
        ended_at: now.toISOString(),
      });

    if (error) {
      return Response.json(
        { error: "Vizionarea nu a putut fi înregistrată." },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  }

  const state = await readState(token, user.id, user.email, now);
  await touchLastSeen(token, user.id, now);

  return Response.json(state, { headers: { "cache-control": "no-store" } });
}
