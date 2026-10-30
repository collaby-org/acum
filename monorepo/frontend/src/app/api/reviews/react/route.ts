/**
 * One reaction, set, changed or cleared.
 *
 *   POST /api/reviews/react   { reviewId, kind }
 *
 * `kind` is `like`, `love` or `clap`, and `null` clears the reader's
 * reaction. The row is the truth: the primary key is (review, account),
 * so pressing another button replaces the row rather than adding to a
 * counter. That is what keeps it one reaction per visitor per review
 * rather than a free-for-all — and it is the database that says so, not
 * the browser.
 *
 * The write runs under the visitor's own token. The insert policy is the
 * last word on whose reaction this is, and it is checked against the
 * token, never inferred from the body.
 *
 * The answer is the review the server now holds, with the counts read
 * back from the aggregate function. That is what the browser reconciles
 * its optimistic copy against: a reaction that only exists in the
 * browser is not a reaction.
 */

import { bearerToken } from "@/lib/supabase/server";
import { readKind, reactToReview } from "@/lib/reviews";
import type { ErrorPayload, Review } from "@/components/reviews/types";

/** The answer a refusal gives, in the shape the browser expects. */
function refusal(error: string, status: number, needsSession = false): Response {
  return Response.json({ error, needsSession } satisfies ErrorPayload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return refusal(
      "Autentifică-te pentru a reacționa la o recenzie.",
      401,
      true,
    );
  }

  let payload: { reviewId?: unknown; kind?: unknown };
  try {
    payload = (await request.json()) as { reviewId?: unknown; kind?: unknown };
  } catch {
    return refusal("Cererea nu a ajuns întreagă.", 400);
  }

  const reviewId = typeof payload.reviewId === "string" ? payload.reviewId : "";
  const kind = readKind(payload.kind);

  // `kind: null` clears the reaction. An unrecognised kind is not the
  // same thing, and it is refused rather than silently ignored.
  const clear = payload.kind === null;
  if (!clear && !kind) {
    return refusal("Reacția nu este una din cele trei.", 400);
  }

  const answer = await reactToReview(token, reviewId, clear ? null : kind);
  if (!answer.ok) return refusal(answer.error, answer.status);

  return Response.json(
    { review: answer.review satisfies Review },
    { headers: { "cache-control": "no-store" } },
  );
}
