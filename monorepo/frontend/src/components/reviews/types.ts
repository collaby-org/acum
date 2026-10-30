/**
 * The reviews, as they travel.
 *
 * These shapes are the contract between `src/app/api/reviews` and every
 * surface that reads it — the homepage section today, the TV mirror when
 * it arrives. They live here, in the component tree, because both ends
 * need them and neither end owns them: the route shapes its answer from
 * them and the browser reads its answer into them.
 *
 * Nothing in here is client state. The counts and the `own` mark are what
 * the server last said; the optimistic copy a browser shows while a
 * request is in the air is a copy of this, replaced the moment the
 * answer comes back.
 */

/** The three reactions. Ordered the way they are worth: clap first. */
export const REACTION_KINDS = ["clap", "love", "like"] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

/** How many people have reacted, per kind. */
export type ReactionCounts = Record<ReactionKind, number>;

/** A count with nothing in it. */
export const EMPTY_COUNTS: ReactionCounts = { clap: 0, love: 0, like: 0 };

/** The label a reaction wears on the row. */
export const REACTION_LABELS: Record<ReactionKind, string> = {
  clap: "Aplauze",
  love: "Iubesc",
  like: "Îmi place",
};

/** One review, as the endpoint hands it over. */
export type Review = {
  id: string;
  channelId: string;
  /** The channel's name as it was when the review was written. */
  channelName: string;
  /** What was on air. `null` when the guide had nothing to say. */
  programmeTitle: string | null;
  programmeStartsAt: string | null;
  programmeEndsAt: string | null;
  /** 1..5. */
  rating: number;
  body: string;
  authorLabel: string;
  createdAt: string;
  counts: ReactionCounts;
  /** The reader's own reaction, when the server was told who is asking. */
  own: ReactionKind | null;
};

/** What `GET /api/reviews` answers with. */
export type ReviewsPayload = {
  /**
   * True when the desk is reachable. False is a statement about *us*,
   * never about the reviews: it means nobody can see anything, not that
   * there is nothing to see.
   */
  configured: boolean;
  /** Why the desk cannot be read, in a sentence a person can read. */
  reason: string | null;
  /** The reviews, in the order the blend puts them. */
  reviews: Review[];
  /** How many the endpoint read before it ranked them. */
  total: number;
};

/** What a write answers with: the row the server now holds. */
export type WritePayload = {
  review: Review;
};

/** What a failed write answers with. */
export type ErrorPayload = {
  error: string;
  /** True when the answer is "you need a session", not "something broke". */
  needsSession?: boolean;
};
