/**
 * What to offer a child the model cannot yet reason about.
 *
 * Two things have to survive here from before the planner existed, because
 * both are real product promises rather than incidental behaviour:
 *
 * 1. A learner who has never done the short starting-point check does it
 *    first, and nothing displaces it — not a light day, not an interest
 *    pick, not a teaching decision. Everything downstream is calibrated by
 *    it, so guessing first and calibrating later is the wrong order.
 *
 * 2. Exploration is personalised. A blank-slate session is the one moment
 *    AdrianOS has no evidence at all, and the parent's stated interests and
 *    priorities are the only signal in the building. Ignoring them would
 *    make the first session the least considered one.
 *
 * Pure: the caller supplies the catalogue and the play counts.
 */

export const PLACEMENT_SLUG = "placement-adventure";

/** The starting-point check, as a destination. Always the first step. */
export const PLACEMENT_HREF = `/games/${PLACEMENT_SLUG}?first=1`;

export type ExploreCandidate = {
  slug: string;
  subject: string;
  /** True when the game matches something the child was said to enjoy. */
  interest: boolean;
  /** True when the game's subject is one the parent asked to prioritise. */
  priority: boolean;
  plays: number;
};

/**
 * Orders exploration candidates. Interest first, then parent priority, then
 * novelty, then the slug so the same inputs always give the same order.
 *
 * Weights rather than a score with a threshold: a child whose interests
 * match nothing should still be offered the least-played thing rather than
 * an empty list.
 */
export function personalizedExploreSlugs(
  candidates: readonly ExploreCandidate[],
  limit = 4
): string[] {
  return [...candidates]
    .sort((a, b) => {
      if (a.interest !== b.interest) return a.interest ? -1 : 1;
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.plays !== b.plays) return a.plays - b.plays;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, limit)
    .map((row) => row.slug);
}
