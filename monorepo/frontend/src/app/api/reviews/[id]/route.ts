/**
 * One review, changed or deleted.
 *
 *   PATCH  /api/reviews/<id>   { rating?, body? }
 *   DELETE /api/reviews/<id>
 *
 * Both ask for a session, and both check the session against the row: a
 * review may only be changed or deleted by the account that wrote it.
 * The check is made here, on the server, against the account behind the
 * token — never against anything the browser says about itself.
 *
 * The answers are plain. `200` carries the review as the server now
 * holds it, `204` says the review is gone and carries nothing, and every
 * refusal is a Romanian sentence with the status code that belongs to it:
 * `401` for no session, `400` for a malformed request, `403` for a review
 * that belongs to somebody else, `404` for one that is not there.
 */

import { bearerToken } from "@/lib/supabase/server";
import { deleteReview, editReview } from "@/lib/reviews";
import type { ErrorPayload, Review } from "@/components/reviews/types";

/** The answer a refusal gives, in the shape the browser expects. */
function refusal(
  error: string,
  status: number,
  needsSession = false,
): Response {
  return Response.json({ error, needsSession } satisfies ErrorPayload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** A token, or the refusal a missing one gets. */
function session(
  request: Request,
  what: string,
): { ok: true; token: string } | { ok: false; response: Response } {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: refusal(`Autentifică-te pentru a ${what} recenzia.`, 401, true),
    };
  }
  return { ok: true, token };
}

/**
 * Change one review.
 *
 * The body may carry a rating, a body, or both. What the server refuses
 * to accept it says why, in a sentence a person can read.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session_ = session(request, "modifica");
  if (!session_.ok) return session_.response;

  const { id } = await context.params;

  let payload: { rating?: unknown; body?: unknown };
  try {
    payload = (await request.json()) as { rating?: unknown; body?: unknown };
  } catch {
    return refusal("Cererea nu a ajuns întreagă.", 400);
  }

  const changes: { rating?: number; body?: string } = {};

  if (payload.rating !== undefined) {
    if (typeof payload.rating !== "number") {
      return refusal("Alege un rating de la 1 la 5 stele.", 400);
    }
    changes.rating = payload.rating;
  }

  if (payload.body !== undefined) {
    if (typeof payload.body !== "string") {
      return refusal("Recenzia trebuie să fie text.", 400);
    }
    changes.body = payload.body;
  }

  const answer = await editReview(session_.token, id, changes);
  if (!answer.ok) return refusal(answer.error, answer.status);

  return Response.json(
    { review: answer.review satisfies Review },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Delete one review.
 *
 * The reactions go with it: they belonged to the review, not to the
 * account. Nothing is said in the body — the answer is the absence of a
 * review.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session_ = session(request, "șterge");
  if (!session_.ok) return session_.response;

  const { id } = await context.params;

  const answer = await deleteReview(session_.token, id);
  if (!answer.ok) return refusal(answer.error, answer.status);

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
