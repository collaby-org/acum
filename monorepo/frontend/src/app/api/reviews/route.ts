/**
 * The reviews.
 *
 *   GET  /api/reviews?channel=<id>&limit=<n>
 *   POST /api/reviews
 *
 * `GET` is open to everybody, the same way the programme guide is: the
 * reviews and their counts are what the site published, and reading them
 * is not a privilege. It runs under the anon key — the same privileges a
 * browser has — which is the honest way to give the public read away.
 *
 * `POST` asks for a session, and the session is verified against the auth
 * server rather than read off a header and believed. What it writes is
 * validated here: a rating between 1 and 5, a body that is actually a
 * sentence, and a channel that exists in the catalogue. A channel id
 * invented in a console is not a channel.
 *
 * Neither route hands back a number the browser could not have read for
 * itself. The counts come from the aggregate function, the author label
 * is copied from the account that wrote it, and an empty section is an
 * empty section — there is no seed data behind the scenes waiting to
 * make the page look busy.
 */

import { connection } from "next/server";
import { bearerToken } from "@/lib/supabase/server";
import {
  CHANNEL_LIMIT,
  POPULAR_LIMIT,
  readDraft,
  readReviews,
  writeReview,
} from "@/lib/reviews";
import type { ErrorPayload, Review, ReviewsPayload } from "@/components/reviews/types";

/** The answer, with the shape the browser is promised. */
function answer(payload: ReviewsPayload): Response {
  return Response.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}

/** The answer a refusal gives, in the shape the browser expects. */
function refusal(error: string, status: number, needsSession = false): Response {
  return Response.json({ error, needsSession } satisfies ErrorPayload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** A token, or the refusal a missing one gets. */
function session(request: Request): { ok: true; token: string } | { ok: false; response: Response } {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: refusal(
        "Autentifică-te pentru a scrie o recenzie.",
        401,
        true,
      ),
    };
  }
  return { ok: true, token };
}

export async function GET(request: Request) {
  // The list is about now, so it is rendered per request.
  await connection();

  const search = new URL(request.url).searchParams;
  const channel = search.get("channel");
  const limit = search.get("limit");

  const parsed =
    limit && Number.isFinite(Number(limit)) ? Number(limit) : POPULAR_LIMIT;

  // The token is optional on a read: it is the only way the answer can
  // say which of the reactions are the reader's own.
  const token = bearerToken(request);

  const result = await readReviews({
    token,
    channelId: channel,
    limit: Math.min(Math.max(parsed, 1), CHANNEL_LIMIT),
  });

  const payload: ReviewsPayload = {
    configured: result.configured,
    reason: result.reason,
    reviews: result.reviews,
    total: result.reviews.length,
  };

  return answer(payload);
}

export async function POST(request: Request) {
  const session_ = session(request);
  if (!session_.ok) return session_.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const draft = await readDraft(payload);
  if (!draft.ok) return refusal(draft.error, 400);

  const written = await writeReview(session_.token, draft.draft);
  if (!written.ok) return refusal(written.error, written.status);

  return Response.json(
    { review: written.review satisfies Review },
    { headers: { "cache-control": "no-store" } },
  );
}
