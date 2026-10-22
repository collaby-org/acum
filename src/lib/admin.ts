/**
 * The desk: who may enter, and what they may read.
 *
 * A desk account is an ordinary account — the same sign-in the visitor uses
 * — that carries one of three marks:
 *
 *   1. its e-mail is listed in `ADMIN_EMAILS`;
 *   2. its plan is `comp`;
 *   3. its bypass is on.
 *
 * The check lives here, on the server, and every route under `/api/admin`
 * calls it before it reads a single row. A desk that is only hidden behind
 * a client-side check is not a desk: the browser would simply ask the API
 * for the data it was not shown.
 *
 * The session is the Supabase session. It is read from the `Authorization`
 * header, the way the rest of the product reads it, and a session cookie is
 * accepted as well — a cookie is something the visitor can write, so it is
 * never believed: the token inside it is checked against the auth server
 * before anything is read.
 *
 * Everything below the guard is read with the service role, because the
 * policies in `supabase/schema.sql` give the accounts, the messages and the
 * statistics to nobody else.
 */

import { cookies } from "next/headers";
import { CHANNELS } from "@/data/channels";
import type { CategoryId, Quality, ServerStatus } from "@/data/types";
import { toPublicChannel } from "@/lib/catalogue";
import { planDefinition, type Plan } from "@/lib/supabase/plans";
import {
  bearerToken,
  getServiceClient,
  hasServiceRole,
  readUser,
} from "@/lib/supabase/server";

export type { Plan };

/** The plans a desk account may hold, in the order they are shown. */
export const PLAN_IDS: readonly Plan[] = [
  "free",
  "monthly",
  "household",
  "lifetime",
  "comp",
];

/** The name a plan is shown under, in the product's own words. */
export function planLabel(plan: Plan): string {
  if (plan === "comp") return "Concediat";
  return planDefinition(plan).name;
}

/** True when the plan is one the schema knows. */
export function isPlan(value: unknown): value is Plan {
  return (
    typeof value === "string" &&
    (PLAN_IDS as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ *
 * Time
 *
 * The product counts the day in Romania, the same way the database's
 * `minutes_watched_today` does. Everything the desk shows — today, the
 * thirty day series — is cut on the Romanian midnight, not on the UTC one.
 * ------------------------------------------------------------------ */

const ZONE = "Europe/Bucharest";

/** The Romanian day of an instant, as `YYYY-MM-DD`. */
export function localDay(when: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** How far the Romanian clock is from UTC, at a given instant. */
function zoneOffsetMs(when: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(when);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    map[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asUtc - when.getTime();
}

/** The Romanian day `offset` days before today, as `YYYY-MM-DD`. */
export function dayOffset(offset: number): string {
  const [year, month, day] = localDay().split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) - offset * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** The instant the Romanian day `day` begins, in UTC. */
export function startOfLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  // The offset is taken at midday, so a clock change inside the day cannot
  // move the boundary.
  const offset = zoneOffsetMs(new Date(Date.UTC(year, month - 1, date, 12)));
  return new Date(Date.UTC(year, month - 1, date) - offset);
}

/** The Romanian day `day`, as a pair of UTC instants. */
export function dayBounds(day: string): { start: string; end: string } {
  const start = startOfLocalDay(day);
  const end = new Date(start.getTime() + 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ------------------------------------------------------------------ *
 * The session
 * ------------------------------------------------------------------ */

export type AuthSession = {
  userId: string;
  email: string | null;
};

type SessionCookie = {
  access_token?: string;
  refresh_token?: string;
};

/** Parse a JSON payload, or give up quietly. */
function tryJson(value: string): SessionCookie | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as SessionCookie;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Decode a payload that was written base64 — with or without the URL safe
 * alphabet, and with or without the `base64-` marker the SSR helper adds.
 */
function tryBase64(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const bodies = [trimmed];
  if (trimmed.startsWith("base64-")) bodies.push(trimmed.slice(7));

  for (const body of bodies) {
    for (const encoded of [body, body.replace(/-/g, "+").replace(/_/g, "/")]) {
      try {
        const decoded = Buffer.from(encoded, "base64").toString("utf8");
        if (decoded.trim().startsWith("{")) return decoded;
      } catch {
        /* not base64 */
      }
    }
  }
  return null;
}

/** The session a cookie carries, in whichever shape it was written. */
function sessionFromValue(raw: string): SessionCookie | null {
  const direct = tryJson(raw);
  if (direct) return direct;
  const decoded = tryBase64(raw);
  if (decoded) return tryJson(decoded);
  return null;
}

/**
 * The session cookies, read the way the sign-in left them.
 *
 * The name of the cookie is not a contract — it carries the project
 * reference, and it changes with the client library — so every cookie is
 * offered to the parser and the one that holds a session wins. A cookie
 * that was cut in pieces is put back together first.
 */
function cookieCandidates(jar: { name: string; value: string }[]): string[] {
  const candidates: string[] = [];
  const chunks = new Map<string, { index: number; value: string }[]>();

  for (const cookie of jar) {
    candidates.push(cookie.value);
    const dot = cookie.name.indexOf(".");
    if (dot <= 0) continue;
    const prefix = cookie.name.slice(0, dot);
    const index = Number(cookie.name.slice(dot + 1));
    if (!Number.isInteger(index)) continue;
    const list = chunks.get(prefix) ?? [];
    list.push({ index, value: cookie.value });
    chunks.set(prefix, list);
  }

  // A cookie cut in pieces: the pieces are base64, and the session is the
  // whole of them decoded together.
  for (const [, pieces] of chunks) {
    pieces.sort((a, b) => a.index - b.index);
    candidates.push(pieces.map((piece) => piece.value).join(""));
    const decoded = pieces.map((piece) => tryBase64(piece.value) ?? "").join("");
    if (decoded) candidates.push(decoded);
  }

  return candidates;
}

/**
 * The signed-in account, or null.
 *
 * The header comes first: it is how the rest of the product carries the
 * session, and it is the only one that survives a page reload. The cookie
 * is the second way in, for a sign-in that keeps the session on the server.
 */
export async function readSession(request?: Request): Promise<AuthSession | null> {
  const header = request ? bearerToken(request) : null;
  if (header) {
    const user = await readUser(header);
    if (user) return { userId: user.id, email: user.email };
  }

  let jar: { name: string; value: string }[] = [];
  try {
    jar = (await cookies()).getAll();
  } catch {
    // A context without a request has no cookies to offer.
    return null;
  }

  for (const raw of cookieCandidates(jar)) {
    const session = sessionFromValue(raw);
    if (!session?.access_token) continue;
    const user = await readUser(session.access_token);
    if (user) return { userId: user.id, email: user.email };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * The guard
 * ------------------------------------------------------------------ */

export type DeskSession = {
  userId: string;
  email: string | null;
  /** Which of the three marks let this account in. */
  via: "email" | "plan" | "bypass";
};

export type DeskState =
  | { status: "ok"; session: DeskSession }
  | { status: "signed-out" }
  | { status: "forbidden"; email: string | null }
  | { status: "no-key" };

/** The e-mails that are let in without a plan of their own. */
export function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const list = raw
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
}

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  plan_until: string | null;
  bypass: boolean;
  note: string | null;
  created_at: string;
  last_seen_at: string | null;
};

/** The profile of one account, read with the service role. */
async function readProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await getServiceClient()
    .from("profiles")
    .select("id,email,display_name,plan,plan_until,bypass,note,created_at,last_seen_at")
    .eq("id", userId)
    .limit(1);
  const row = (data as ProfileRow[] | null)?.[0];
  return row ?? null;
}

/**
 * Whether this request may open the desk, and who is asking.
 *
 * The order matters. A signed-in visitor is checked against
 * `ADMIN_EMAILS` first, because that list needs no database. The service
 * role is needed for the plan and the bypass, so when it is missing the
 * desk cannot open at all — and says so, rather than showing an empty
 * product.
 */
export async function deskState(request?: Request): Promise<DeskState> {
  const session = await readSession(request);
  if (!session) return { status: "signed-out" };

  const email = session.email?.toLowerCase() ?? null;
  if (email && adminEmails().has(email)) {
    if (!hasServiceRole()) return { status: "no-key" };
    return { status: "ok", session: { ...session, via: "email" } };
  }

  if (!hasServiceRole()) return { status: "no-key" };

  // A failure here is the database, not the key: it travels up and the
  // route answers with a readable error, not with a refusal.
  const profile = await readProfile(session.userId);

  if (!profile) return { status: "forbidden", email };

  if (profile.plan === "comp") {
    return { status: "ok", session: { ...session, via: "plan" } };
  }
  if (profile.bypass) {
    return { status: "ok", session: { ...session, via: "bypass" } };
  }

  return { status: "forbidden", email };
}

/** Thrown by `requireDesk` when the request may not open the desk. */
export class DeskError extends Error {
  readonly state: DeskState;

  constructor(state: DeskState) {
    super("Acces interzis.");
    this.name = "DeskError";
    this.state = state;
  }
}

/** The session, or a refusal. Every route starts with this. */
export async function requireDesk(request?: Request): Promise<DeskSession> {
  const state = await deskState(request);
  if (state.status !== "ok") throw new DeskError(state);
  return state.session;
}

/**
 * The guard, in the shape a route wants it.
 *
 * A route that is refused never reaches the database, and a route that
 * cannot read the database says so instead of answering with an empty
 * list — an empty list would look like a quiet day.
 */
export async function deskGuard(
  request?: Request,
): Promise<
  { ok: true; session: DeskSession } | { ok: false; response: Response }
> {
  try {
    const state = await deskState(request);
    if (state.status !== "ok") {
      return { ok: false, response: deskRefusal(state) };
    }
    return { ok: true, session: state.session };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Panoul nu a putut citi datele. Încearcă din nou." },
        { status: 500, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

/** The answer a route gives when the guard says no. */
export function deskRefusal(state: DeskState): Response {
  if (state.status === "signed-out") {
    return Response.json(
      { error: "Trebuie să fii conectat." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  if (state.status === "no-key") {
    return Response.json(
      {
        error:
          "Cheia de service role lipsește. Setează SUPABASE_SERVICE_ROLE_KEY și reîncearcă.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: "Contul nu are acces la panou." },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

/* ------------------------------------------------------------------ *
 * Reading, in pages
 * ------------------------------------------------------------------ */

/**
 * Read every row of a query.
 *
 * PostgREST answers a page at a time, and a desk that shows a total must
 * show the whole set behind it — so the pages are walked until the last.
 */
async function paged<T>(
  query: (range: { from: number; to: number }) => PromiseLike<{
    data: T[] | null;
  }>,
  pageSize = 1000,
  maxRows = 20_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data } = await query({ from, to: from + pageSize - 1 });
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * The accounts
 * ------------------------------------------------------------------ */

export type Account = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: Plan;
  plan_until: string | null;
  bypass: boolean;
  note: string | null;
  created_at: string;
  last_seen_at: string | null;
  /** How much this account has watched today, in minutes. */
  minutes_today: number;
};

/** The minutes watched today, by account. */
async function minutesTodayByUser(): Promise<Map<string, number>> {
  const { start, end } = dayBounds(localDay());
  const client = getServiceClient();

  const sessions = await paged<{ user_id: string; seconds: number }>(
    (range) =>
      client
        .from("watch_sessions")
        .select("user_id,seconds")
        .gte("started_at", start)
        .lt("started_at", end)
        .range(range.from, range.to),
  );

  const seconds = new Map<string, number>();
  for (const session of sessions) {
    seconds.set(
      session.user_id,
      (seconds.get(session.user_id) ?? 0) + (session.seconds ?? 0),
    );
  }

  const minutes = new Map<string, number>();
  for (const [user, total] of seconds) {
    minutes.set(user, Math.round(total / 60));
  }
  return minutes;
}

/**
 * The accounts, newest first.
 *
 * The search is a case-insensitive match on the e-mail or the name; the
 * plan is an exact filter. Both are done by the database, so the desk does
 * not have to hold the whole account list in memory to search it.
 */
export async function listAccounts(options: {
  q?: string;
  plan?: Plan | null;
  limit?: number;
} = {}): Promise<Account[]> {
  const { q = "", plan = null, limit = 50 } = options;
  const client = getServiceClient();

  let query = client
    .from("profiles")
    .select(
      "id,email,display_name,plan,plan_until,bypass,note,created_at,last_seen_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (plan) query = query.eq("plan", plan);

  const needle = q.replace(/[,()*\\%]/g, " ").trim();
  if (needle) {
    query = query.or(
      `email.ilike.*${needle}*,display_name.ilike.*${needle}*`,
    );
  }

  const [{ data }, minutes] = await Promise.all([
    query,
    minutesTodayByUser(),
  ]);

  const rows = (data as ProfileRow[] | null) ?? [];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    plan: isPlan(row.plan) ? row.plan : "free",
    plan_until: row.plan_until,
    bypass: Boolean(row.bypass),
    note: row.note,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    minutes_today: minutes.get(row.id) ?? 0,
  }));
}

/** The newest accounts, for the overview. */
export async function recentRegistrations(
  limit = 6,
): Promise<
  {
    id: string;
    email: string | null;
    display_name: string | null;
    plan: Plan;
    created_at: string;
  }[]
> {
  const { data } = await getServiceClient()
    .from("profiles")
    .select("id,email,display_name,plan,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data as ProfileRow[] | null) ?? [];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    plan: isPlan(row.plan) ? row.plan : "free",
    created_at: row.created_at,
  }));
}

/* ------------------------------------------------------------------ *
 * The grant
 * ------------------------------------------------------------------ */

export type Grant = {
  userId: string;
  plan: Plan;
  /** When the access ends. `null` means it never ends. */
  planUntil: string | null;
  /** The paywall does not apply to this account. */
  bypass: boolean;
  /** Why the desk did it. Kept with the account, for the audit. */
  note: string;
  /** Who did it. */
  by: string;
};

/** The audit line a grant leaves on the account. */
function auditLine(grant: Grant, from: Plan, at: Date): string {
  const stamp = new Intl.DateTimeFormat("ro-RO", {
    timeZone: ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(at);

  const until = grant.planUntil
    ? ` până la ${new Intl.DateTimeFormat("ro-RO", {
        timeZone: ZONE,
        dateStyle: "medium",
      }).format(new Date(grant.planUntil))}`
    : "";

  return `[${stamp}] ${planLabel(from)} → ${planLabel(grant.plan)}${until} · bypass: ${grant.bypass ? "da" : "nu"} · ${grant.by}${
    grant.note ? ` · ${grant.note}` : ""
  }`;
}

/**
 * Grant access by hand, and leave the trace.
 *
 * The plan, the end date and the bypass are written with the service role,
 * which is the only thing that may write them — a visitor cannot buy
 * themselves a lifetime account by updating their own row.
 *
 * The audit is the note on the account: one line per grant, with who did
 * it, when, what changed and why. It is appended, never overwritten, so
 * the last dozen grants are always there to be read.
 */
export async function grantAccess(grant: Grant): Promise<Account> {
  const client = getServiceClient();
  const before = await readProfile(grant.userId);
  if (!before) throw new Error("Contul nu există.");

  const from = isPlan(before.plan) ? before.plan : "free";
  const at = new Date();

  const planUntil =
    grant.plan === "monthly" && !grant.planUntil
      ? new Date(at.getTime() + 30 * 86_400_000).toISOString()
      : grant.plan === "free" ||
          grant.plan === "lifetime" ||
          grant.plan === "comp"
        ? null
        : grant.planUntil;

  const history = (before.note ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  history.push(auditLine({ ...grant, planUntil }, from, at));
  const note = history.slice(-12).join("\n");

  const { data, error } = await client
    .from("profiles")
    .update({
      plan: grant.plan,
      plan_until: planUntil,
      bypass: grant.bypass,
      note,
    })
    .eq("id", grant.userId)
    .select(
      "id,email,display_name,plan,plan_until,bypass,note,created_at,last_seen_at",
    )
    .limit(1);

  const row = (data as ProfileRow[] | null)?.[0];
  if (error || !row) {
    throw new Error("Contul nu a putut fi actualizat.");
  }

  // A paid plan handed out to an account that had none is a conversion,
  // and the statistics have to know about it.
  if (from === "free" && grant.plan !== "free" && grant.plan !== "comp") {
    await countConversion(localDay());
  }

  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    plan: isPlan(row.plan) ? row.plan : "free",
    plan_until: row.plan_until,
    bypass: Boolean(row.bypass),
    note: row.note,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    minutes_today: 0,
  };
}

/** Add one conversion to a day in the statistics. */
async function countConversion(day: string): Promise<void> {
  const client = getServiceClient();

  const { data } = await client
    .from("daily_stats")
    .select("conversions")
    .eq("day", day)
    .limit(1);

  const current = Number((data as { conversions?: number }[] | null)?.[0]?.conversions ?? 0);
  const next = Number.isFinite(current) ? current + 1 : 1;

  const { data: patched } = await client
    .from("daily_stats")
    .update({ conversions: next, updated_at: new Date().toISOString() })
    .eq("day", day)
    .select("day");

  if (!patched || patched.length === 0) {
    await client.from("daily_stats").upsert(
      {
        day,
        sign_ins: 0,
        minutes_watched: 0,
        paywalls: 0,
        conversions: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "day" },
    );
  }
}

/* ------------------------------------------------------------------ *
 * The messages
 * ------------------------------------------------------------------ */

export type Message = {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  body: string;
  page: string | null;
  agent: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
};

export type MessageState = "inbox" | "unread" | "archived";

/**
 * The messages the contact form wrote.
 *
 * The table has an insert policy for anybody and a select policy the
 * service role alone satisfies, so this is read with the service role.
 */
export async function listMessages(
  options: { state?: MessageState; limit?: number } = {},
): Promise<Message[]> {
  const { state = "inbox", limit = 100 } = options;

  let query = getServiceClient()
    .from("messages")
    .select("id,name,email,subject,body,page,agent,read,archived,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (state === "archived") {
    query = query.eq("archived", true);
  } else {
    query = query.eq("archived", false);
    if (state === "unread") query = query.eq("read", false);
  }

  const { data } = await query;
  return (data as Message[] | null) ?? [];
}

/** Mark a message as read, or archive it. */
export async function setMessageState(
  id: string,
  patch: { read?: boolean; archived?: boolean },
): Promise<Message | null> {
  const { data } = await getServiceClient()
    .from("messages")
    .update(patch)
    .eq("id", id)
    .select("id,name,email,subject,body,page,agent,read,archived,created_at")
    .limit(1);

  return (data as Message[] | null)?.[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * The statistics
 * ------------------------------------------------------------------ */

export type DayPoint = {
  day: string;
  sign_ins: number;
  minutes_watched: number;
  paywalls: number;
  conversions: number;
};

export type Series = {
  days: DayPoint[];
  totals: {
    sign_ins: number;
    minutes_watched: number;
    paywalls: number;
    conversions: number;
  };
};

type DailyRow = {
  day: string;
  sign_ins: number;
  minutes_watched: number;
  paywalls: number;
  conversions: number;
};

type SessionRow = {
  user_id: string;
  seconds: number;
  started_at: string;
};

/**
 * The last thirty days, rolled up.
 *
 * The watch sessions are the source of truth for the minutes and for the
 * accounts that came in; `daily_stats` keeps what the rest of the product
 * measured — the paywalls and the conversions. The two are merged, and the
 * rollup never lowers a number: a day that was counted once is not
 * uncounted the next time the desk looks at it.
 */
export async function dailySeries(days = 30): Promise<Series> {
  const list: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) list.push(dayOffset(offset));

  const first = list[0];
  const today = list[list.length - 1];
  const { start, end } = dayBounds(first);
  const todayBounds = dayBounds(today);
  const client = getServiceClient();

  const [stored, sessions, seen] = await Promise.all([
    client
      .from("daily_stats")
      .select("day,sign_ins,minutes_watched,paywalls,conversions")
      .gte("day", first)
      .order("day", { ascending: true }),
    paged<SessionRow>((range) =>
      client
        .from("watch_sessions")
        .select("user_id,seconds,started_at")
        .gte("started_at", start)
        .lt("started_at", end)
        .order("started_at", { ascending: true })
        .range(range.from, range.to),
    ),
    client
      .from("profiles")
      .select("id,last_seen_at")
      .gte("last_seen_at", todayBounds.start)
      .lt("last_seen_at", todayBounds.end),
  ]);

  const storedByDay = new Map(
    ((stored.data as DailyRow[] | null) ?? []).map((row) => [row.day, row]),
  );

  // The minutes and the accounts, counted from the sessions.
  const minutes = new Map<string, number>();
  const viewers = new Map<string, Set<string>>();
  for (const day of list) {
    minutes.set(day, 0);
    viewers.set(day, new Set());
  }
  for (const session of sessions) {
    const day = localDay(new Date(session.started_at));
    minutes.set(day, (minutes.get(day) ?? 0) + (session.seconds ?? 0));
    viewers.get(day)?.add(session.user_id);
  }

  // Today also counts the accounts that were seen without watching.
  const todayViewers = viewers.get(today) ?? new Set<string>();
  for (const profile of (seen.data as { id: string }[] | null) ?? []) {
    todayViewers.add(profile.id);
  }

  const points: DayPoint[] = [];
  const changed: { day: string; patch: Partial<DailyRow> }[] = [];

  for (const day of list) {
    const storedRow = storedByDay.get(day);
    const computedMinutes = Math.round((minutes.get(day) ?? 0) / 60);
    const computedSignIns = viewers.get(day)?.size ?? 0;

    const signIns = Math.max(storedRow?.sign_ins ?? 0, computedSignIns);
    const watched = Math.max(storedRow?.minutes_watched ?? 0, computedMinutes);

    points.push({
      day,
      sign_ins: signIns,
      minutes_watched: watched,
      paywalls: storedRow?.paywalls ?? 0,
      conversions: storedRow?.conversions ?? 0,
    });

    // Only what grew is written back, and only the columns the desk owns.
    const patch: Partial<DailyRow> = {};
    if (signIns !== (storedRow?.sign_ins ?? 0)) patch.sign_ins = signIns;
    if (watched !== (storedRow?.minutes_watched ?? 0)) {
      patch.minutes_watched = watched;
    }
    if (Object.keys(patch).length) changed.push({ day, patch });
  }

  if (changed.length) await writeDaily(changed);

  const totals = points.reduce(
    (sum, point) => ({
      sign_ins: sum.sign_ins + point.sign_ins,
      minutes_watched: sum.minutes_watched + point.minutes_watched,
      paywalls: sum.paywalls + point.paywalls,
      conversions: sum.conversions + point.conversions,
    }),
    { sign_ins: 0, minutes_watched: 0, paywalls: 0, conversions: 0 },
  );

  return { days: points, totals };
}

/** Write the rollup back, one column at a time, so nothing else is lost. */
async function writeDaily(
  changed: { day: string; patch: Partial<DailyRow> }[],
): Promise<void> {
  const client = getServiceClient();

  for (const { day, patch } of changed) {
    const body = { ...patch, updated_at: new Date().toISOString() };
    const { data } = await client
      .from("daily_stats")
      .update(body)
      .eq("day", day)
      .select("day");

    if (!data || data.length === 0) {
      await client.from("daily_stats").upsert(
        {
          day,
          sign_ins: 0,
          minutes_watched: 0,
          paywalls: 0,
          conversions: 0,
          ...body,
        },
        { onConflict: "day" },
      );
    }
  }
}

export type Today = {
  /** Every account that exists. */
  accounts: number;
  sign_ins: number;
  minutes_watched: number;
  paywalls: number;
  conversions: number;
  /** How the accounts are spread over the plans. */
  plans: { plan: Plan; count: number }[];
};

/** The numbers of the day, and the split of the plans. */
export async function todayNumbers(series?: Series): Promise<Today> {
  const points = series ?? (await dailySeries(30));
  const today = points.days[points.days.length - 1];
  const client = getServiceClient();

  const [accounts, ...planCounts] = await Promise.all([
    client.from("profiles").select("id", { count: "exact" }).limit(1),
    ...PLAN_IDS.map((plan) =>
      client
        .from("profiles")
        .select("id", { count: "exact" })
        .eq("plan", plan)
        .limit(1),
    ),
  ]);

  return {
    accounts: accounts.count ?? 0,
    sign_ins: today?.sign_ins ?? 0,
    minutes_watched: today?.minutes_watched ?? 0,
    paywalls: today?.paywalls ?? 0,
    conversions: today?.conversions ?? 0,
    plans: PLAN_IDS.map((plan, index) => ({
      plan,
      count: planCounts[index]?.count ?? 0,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * The catalogue
 *
 * The catalogue is kept on the server, with the addresses the streams come
 * from. The desk is a browser like any other, so it is shown the same
 * public view the visitor gets: names, artwork, status, quality — and no
 * address, and no source page.
 *
 * The feed stack of a channel is not part of that view either. The desk
 * sees how many feeds the catalogue holds in total, and how many channels
 * have a spare one; it does not see how many any single channel has.
 * ------------------------------------------------------------------ */

export type CatalogueRow = {
  id: string;
  name: string;
  family: string;
  category: CategoryId;
  status: ServerStatus;
  quality: Quality;
  logo: string | null;
  logoHd: string | null;
  views: number | null;
};

export type CatalogueSummary = {
  channels: number;
  /** How many upstream feeds the catalogue holds. */
  feeds: number;
  /** How many channels can play right now. */
  live: number;
  /** How many channels have a spare feed to fall back on. */
  withFallback: number;
  quality: { quality: Quality; count: number }[];
  status: { status: ServerStatus; count: number }[];
};

/** The catalogue as the desk is allowed to see it. */
export function catalogueRows(): CatalogueRow[] {
  return CHANNELS.map((channel) => {
    const view = toPublicChannel(channel);
    return {
      id: view.id,
      name: view.name,
      family: view.family,
      category: view.category,
      status: view.status,
      quality: view.quality,
      logo: view.logo,
      logoHd: view.logoHd,
      views: view.views,
    };
  });
}

/** The catalogue at a glance. */
export function catalogueSummary(): CatalogueSummary {
  const quality = new Map<Quality, number>();
  const status = new Map<ServerStatus, number>();
  let feeds = 0;
  let live = 0;
  let withFallback = 0;

  for (const channel of CHANNELS) {
    feeds += channel.servers.length;
    if (channel.status === "live") live += 1;
    if (channel.servers.length > 1) withFallback += 1;
    quality.set(channel.quality, (quality.get(channel.quality) ?? 0) + 1);
    status.set(channel.status, (status.get(channel.status) ?? 0) + 1);
  }

  return {
    channels: CHANNELS.length,
    feeds,
    live,
    withFallback,
    quality: [...quality.entries()]
      .map(([quality, count]) => ({ quality, count }))
      .sort((a, b) => b.count - a.count),
    status: [...status.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}

