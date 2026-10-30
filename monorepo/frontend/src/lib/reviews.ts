/**
 * The reviews, on the server.
 *
 * This is the only place that touches the two review tables, and it is
 * server-only by construction: it imports the Supabase server clients,
 * which throw if a browser ever gets hold of them. Everything the browser
 * learns arrives through `/api/reviews`, shaped here.
 *
 * Three rules shape the whole module, and they are the ones the issue
 * asks for:
 *
 *   1. **The rows are the truth.** The rating, the body, the counts and
 *      the reader's own reaction are read from the database on every
 *      request. Nothing is cached in a browser, nothing is carried
 *      between requests, and a patched console is worth nothing here.
 *
 *   2. **Reading is open; writing asks for a session.** The public read
 *      runs under the anon key — the same privileges the browser has. A
 *      write runs under the visitor's own token, so the row level
 *      policies are the second line of defence after the bearer check,
 *      not instead of it.
 *
 *   3. **Nothing is invented.** A review is written by an account, a
 *      channel id is checked against the catalogue, a programme is only
 *      named when the guide named it, and an empty answer says it is
 *      empty rather than filling itself with something plausible.
 */

import { catalogueChannel } from "@/lib/catalogue";
import { byPopularity } from "@/lib/review-rank";
import {
  REACTION_KINDS,
  type ReactionCounts,
  type ReactionKind,
  type Review,
} from "@/components/reviews/types";
import {
  getPublicClient,
  getUserClient,
  hasPublicConfig,
  readUser,
} from "@/lib/supabase/server";

/** How many reviews the popular section asks for. */
export const POPULAR_LIMIT = 6;

/** How many reviews a channel list asks for. */
export const CHANNEL_LIMIT = 40;

/** The shortest body that is a review and not a cough. */
const BODY_MIN = 2;

/** The longest body one review may carry. */
const BODY_MAX = 1200;

/** The longest channel name, programme title or label we will store. */
const TEXT_MAX = 120;

/* ------------------------------------------------------------------ *
 * The rows, as the database has them
 * ------------------------------------------------------------------ */

type ReviewRow = {
  id: string;
  user_id: string;
  channel_id: string;
  channel_name: string;
  programme_title: string | null;
  programme_starts_at: string | null;
  programme_ends_at: string | null;
  rating: number;
  body: string;
  author_label: string;
  created_at: string;
};

type OwnReactionRow = {
  review_id: string;
  kind: string;
};

type CountRow = {
  review_id: string;
  like_count: number;
  love_count: number;
  clap_count: number;
};

/** A row of the counts function, verified rather than believed. */
function readCounts(rows: unknown): Map<string, ReactionCounts> {
  const map = new Map<string, ReactionCounts>();
  if (!Array.isArray(rows)) return map;

  for (const row of rows as CountRow[]) {
    if (typeof row.review_id !== "string") continue;
    map.set(row.review_id, {
      like: numberOrZero(row.like_count),
      love: numberOrZero(row.love_count),
      clap: numberOrZero(row.clap_count),
    });
  }
  return map;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** A reaction kind, or null. Anything else is not a reaction. */
export function readKind(value: unknown): ReactionKind | null {
  return REACTION_KINDS.includes(value as ReactionKind)
    ? (value as ReactionKind)
    : null;
}

/** A rating between 1 and 5, or null. */
export function readRating(value: unknown): number | null {
  const rating = typeof value === "number" ? Math.floor(value) : Number.NaN;
  return rating >= 1 && rating <= 5 ? rating : null;
}

/** A piece of text: trimmed, length-checked, never invented. */
function readText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) return null;
  return text;
}

/** A uuid, or null. */
function readId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? id
    : null;
}

/** An instant, as the guide writes it. Returns a Date or null. */
function readInstant(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * A row, turned into the shape the browser reads.
 *
 * The counts come from the aggregate function and never from the row: a
 * review row has no counter to send in the first place.
 */
function toReview(
  row: ReviewRow,
  counts: ReactionCounts,
  own: ReactionKind | null,
): Review {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    programmeTitle: row.programme_title,
    programmeStartsAt: row.programme_starts_at,
    programmeEndsAt: row.programme_ends_at,
    rating: row.rating,
    body: row.body,
    authorLabel: row.author_label,
    createdAt: row.created_at,
    counts,
    own,
  };
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * The reviews, in the order the blend puts them.
 *
 * The whole read is three round trips: the rows, the counts, and — when a
 * token came with the request — the reader's own reactions. The last one
 * runs under the reader's own token and reads only rows the row level
 * policies say are theirs, so a visitor learns their own reaction and
 * nothing about anybody else's.
 *
 * The ranking happens here, on the server, and not in the browser: the
 * order is part of what the section is, so it is not something a client
 * can arrange differently.
 */
export async function readReviews(options: {
  token?: string | null;
  channelId?: string | null;
  limit?: number;
  now?: Date;
} ): Promise<{ configured: boolean; reason: string | null; reviews: Review[] }> {
  if (!hasPublicConfig()) {
    return {
      configured: false,
      reason:
        "Recenziile citesc datele de pe server, iar serverul nu este configurat (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      reviews: [],
    };
  }

  const limit = Math.min(Math.max(options.limit ?? POPULAR_LIMIT, 1), 100);

  try {
    const client = getPublicClient();

    // A generous window: the blend decides what is popular, and cutting
    // the pool here would be ranking a room instead of the house.
    let query = client
      .from("reviews")
      .select(
        "id,user_id,channel_id,channel_name,programme_title,programme_starts_at,programme_ends_at,rating,body,author_label,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (options.channelId) query = query.eq("channel_id", options.channelId);

    const rows = await query;
    const list = (rows.data as ReviewRow[] | null) ?? [];
    if (list.length === 0) {
      return { configured: true, reason: null, reviews: [] };
    }

    const ids = list.map((row) => row.id);
    const [countAnswer, own] = await Promise.all([
      client.rpc("review_reaction_counts", { p_ids: ids }),
      readOwnReactions(ids, options.token ?? null),
    ]);

    const countMap = readCounts(countAnswer.data);

    const reviews = list.map((row) =>
      toReview(
        row,
        countMap.get(row.id) ?? { like: 0, love: 0, clap: 0 },
        own.get(row.id) ?? null,
      ),
    );

    const ranked = reviews
      .sort((a, b) => byPopularity(a, b, (options.now ?? new Date()).getTime()))
      .slice(0, limit);

    return { configured: true, reason: null, reviews: ranked };
  } catch {
    // The desk is unreachable. That is a fact about us, and the section
    // says so — it does not pretend the reviews are empty.
    return {
      configured: false,
      reason:
        "Recenziile nu au putut fi citite acum. Încearcă din nou într-un moment.",
      reviews: [],
    };
  }
}

/**
 * The reader's own reactions, by review id.
 *
 * Runs under the reader's token, so the policy decides: their rows and
 * nothing else. A visitor who is not signed in has no reactions, and the
 * answer says so by being empty rather than by pretending.
 */
async function readOwnReactions(
  ids: string[],
  token: string | null,
): Promise<Map<string, ReactionKind>> {
  const map = new Map<string, ReactionKind>();
  if (!token || ids.length === 0) return map;

  const user = await readUser(token);
  if (!user) return map;

  const { data } = await getUserClient(token)
    .from("review_reactions")
    .select("review_id,kind")
    .in("review_id", ids);

  for (const row of (data as OwnReactionRow[] | null) ?? []) {
    const kind = readKind(row.kind);
    if (kind) map.set(row.review_id, kind);
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/** What a review is asked to carry when it is written. */
export type ReviewDraft = {
  rating: number;
  body: string;
  channelId: string;
  programmeTitle: string | null;
  programmeStartsAt: string | null;
  programmeEndsAt: string | null;
};

/** A draft, or the sentence that says why it cannot be written. */
export type DraftResult =
  | { ok: true; draft: ReviewDraft }
  | { ok: false; error: string };

/**
 * Read a draft out of a request body.
 *
 * The channel is checked against the catalogue: a review belongs to a
 * channel that exists, and a channel id invented in a console is not one.
 * The programme is optional — the guide does not cover every slot — and
 * when it is missing the review is a review of the channel and says so,
 * rather than being attached to a programme nobody named.
 */
export async function readDraft(payload: unknown): Promise<DraftResult> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Recenzia nu a ajuns întreagă." };
  }

  const body = payload as Record<string, unknown>;

  const rating = readRating(body.rating);
  if (rating === null) {
    return { ok: false, error: "Alege un rating de la 1 la 5 stele." };
  }

  const text = readText(body.body, BODY_MIN, BODY_MAX);
  if (text === null) {
    return {
      ok: false,
      error: `Scrie câteva cuvinte — cel puțin ${BODY_MIN}, cel mult ${BODY_MAX}.`,
    };
  }

  const channelId =
    typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId || !catalogueChannel(channelId)) {
    return { ok: false, error: "Alege un canal din catalog." };
  }

  const programmeTitle = readText(body.programmeTitle, 1, TEXT_MAX);
  const programmeStartsAt = readInstant(body.programmeStartsAt);
  const programmeEndsAt = readInstant(body.programmeEndsAt);

  return {
    ok: true,
    draft: {
      rating,
      body: text,
      channelId,
      programmeTitle: programmeTitle?.trim() ?? null,
      programmeStartsAt: programmeStartsAt?.toISOString() ?? null,
      programmeEndsAt: programmeEndsAt?.toISOString() ?? null,
    },
  };
}

/**
 * Write one review, and answer with the row the server now holds.
 *
 * The insert runs under the visitor's own token, so the insert policy is
 * the last word on whose review this is. The author label is copied from
 * the account at write time — the profile row is nobody else's business
 * to read later, and the review has to be able to say who wrote it.
 */
export async function writeReview(
  token: string,
  draft: ReviewDraft,
): Promise<
  | { ok: true; review: Review }
  | { ok: false; error: string; status: number }
> {
  const user = await readUser(token);
  if (!user) {
    return {
      ok: false,
      error: "Sesiunea a expirat. Autentifică-te din nou.",
      status: 401,
    };
  }

  const label = await authorLabel(token, user.id, user.email);

  const client = getUserClient(token);
  const { data, error } = await client
    .from("reviews")
    .insert({
      user_id: user.id,
      channel_id: draft.channelId,
      channel_name: catalogueChannel(draft.channelId)?.name ?? draft.channelId,
      programme_title: draft.programmeTitle,
      programme_starts_at: draft.programmeStartsAt,
      programme_ends_at: draft.programmeEndsAt,
      rating: draft.rating,
      body: draft.body,
      author_label: label,
    })
    .select(
      "id,user_id,channel_id,channel_name,programme_title,programme_starts_at,programme_ends_at,rating,body,author_label,created_at",
    )
    .single();

  if (error || !data) {
    // The unique index refuses a second review of the same slot. That is
    // a rule, not a failure, and it is said plainly.
    const duplicate =
      error?.code === "23505" || /duplicate key/i.test(error?.message ?? "");
    return {
      ok: false,
      error: duplicate
        ? "Ai scris deja o recenzie pentru această emisiune."
        : "Recenzia nu a putut fi salvată. Încearcă din nou.",
      status: duplicate ? 409 : 500,
    };
  }

  return {
    ok: true,
    review: toReview(data as ReviewRow, { like: 0, love: 0, clap: 0 }, null),
  };
}

/**
 * The name an account goes by, or nothing invented.
 *
 * The profile row is read with the visitor's own client, so this is a row
 * the policy already says is theirs. When there is no name, the e-mail's
 * local part is used; when there is no e-mail either, the review is
 * signed "Vizionator" — a truthful label for somebody who was here.
 */
async function authorLabel(
  token: string,
  userId: string,
  email: string | null,
): Promise<string> {
  const { data } = await getUserClient(token)
    .from("profiles")
    .select("display_name,email")
    .eq("id", userId)
    .maybeSingle();

  const row = (data ?? {}) as { display_name?: unknown; email?: unknown };

  const name = typeof row.display_name === "string" ? row.display_name.trim() : "";
  if (name) return name.slice(0, TEXT_MAX);

  const address =
    typeof row.email === "string" && row.email.includes("@")
      ? row.email
      : (email ?? "");
  const local = address.split("@")[0]?.trim() ?? "";
  if (local) return local.slice(0, TEXT_MAX);

  return "Vizionator";
}

/**
 * Set, change or clear one reaction, and answer with the row's counts.
 *
 * The write goes under the visitor's token, and the review id is read
 * from the body rather than trusted: the policy would refuse somebody
 * else's row anyway, but the answer is better when it is asked politely.
 *
 * `kind: null` clears the visitor's reaction — that is a delete of their
 * own row, not a decrement of a counter, because there is no counter.
 */
export async function reactToReview(
  token: string,
  reviewId: string,
  kind: ReactionKind | null,
): Promise<
  | { ok: true; review: Review }
  | { ok: false; error: string; status: number }
> {
  const user = await readUser(token);
  if (!user) {
    return {
      ok: false,
      error: "Sesiunea a expirat. Autentifică-te din nou.",
      status: 401,
    };
  }

  const id = readId(reviewId);
  if (!id) {
    return { ok: false, error: "Recenzia nu a putut fi găsită.", status: 400 };
  }

  const client = getUserClient(token);

  if (kind === null) {
    const { error } = await client
      .from("review_reactions")
      .delete()
      .eq("review_id", id)
      .eq("user_id", user.id);
    if (error) {
      return {
        ok: false,
        error: "Reacția nu a putut fi eliminată. Încearcă din nou.",
        status: 500,
      };
    }
  } else {
    const { error } = await client
      .from("review_reactions")
      .upsert(
        { review_id: id, user_id: user.id, kind },
        { onConflict: "review_id,user_id" },
      );
    if (error) {
      return {
        ok: false,
        error: "Reacția nu a putut fi salvată. Încearcă din nou.",
        status: 500,
      };
    }
  }

  const answer = await oneReview(client, id, user.id);
  if (!answer.review) {
    return {
      ok: false,
      error: "Recenzia nu a putut fi găsită.",
      status: 404,
    };
  }
  return { ok: true, review: answer.review };
}

/**
 * One review, with the counts the aggregate function answers with.
 *
 * This is the answer the browser reconciles its optimistic copy against,
 * so it is read again after the write rather than returned from it: the
 * number the visitor sees has to be the number the server holds.
 */
async function oneReview(
  client: ReturnType<typeof getUserClient>,
  reviewId: string,
  userId: string,
): Promise<{ review: Review | null }> {
  const [row, counts, own] = await Promise.all([
    client
      .from("reviews")
      .select(
        "id,user_id,channel_id,channel_name,programme_title,programme_starts_at,programme_ends_at,rating,body,author_label,created_at",
      )
      .eq("id", reviewId)
      .maybeSingle(),
    client.rpc("review_reaction_counts", { p_ids: [reviewId] }),
    client
      .from("review_reactions")
      .select("review_id,kind")
      .eq("review_id", reviewId)
      .eq("user_id", userId),
  ]);

  const data = row.data as ReviewRow | null;
  if (!data) return { review: null };

  const countMap = readCounts(counts.data);
  const ownRows = (own.data as OwnReactionRow[] | null) ?? [];
  const ownKind = readKind(ownRows[0]?.kind ?? null);

  return {
    review: toReview(
      data,
      countMap.get(reviewId) ?? { like: 0, love: 0, clap: 0 },
      ownKind,
    ),
  };
}
