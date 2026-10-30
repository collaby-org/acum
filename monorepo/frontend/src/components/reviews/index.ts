/**
 * The reviews, one entry point.
 *
 * The section, the composer, the row and the types travel together: a
 * surface that shows one of them shows the rest, and the mirror that
 * eventually carries them into `monorepo/tv/` should be able to import
 * one path.
 */

export { PopularReviews } from "./popular-reviews";
export { ReviewCard } from "./review-card";
export { ReviewComposer, type ComposerChannel } from "./review-composer";
export { ReactionRow } from "./reaction-row";
export { Stars, StarPicker } from "./star-rating";
export { ZoomOverlay, type ZoomPoint } from "./zoom-overlay";
export {
  EMPTY_COUNTS,
  REACTION_KINDS,
  REACTION_LABELS,
  type ReactionCounts,
  type ReactionKind,
  type Review,
  type ReviewsPayload,
} from "./types";
