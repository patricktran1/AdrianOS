/**
 * A cheap look at how far through today a child is.
 *
 * The guided ribbon sits on top of every game screen and asks one question:
 * has the activity I am on been finished, and how many are there?
 *
 * This module deliberately imports nothing — not even the session schema it
 * agrees with. The ribbon is rendered by the game frame, which fifty routes
 * share, and giving that frame an import edge into the planner's module graph
 * stops the bundler hoisting the frame into one shared chunk: it duplicates
 * the frame's whole subgraph, content banks included, into every game route.
 * Measured, that edge cost 1.9 MB of client JavaScript.
 *
 * The price is a few lines of validation that exist twice. A unit test holds
 * the two readings to the same answer.
 */

export const SESSION_GLANCE_PREFIX = "adrianos-session-v1:";

export type SessionGlance = {
  /** Steps the plan still contains, dropped ones excluded. */
  total: number;
  /** How many have been finished. */
  done: number;
  /** Index of the step being worked on, or -1 when the session is over. */
  currentIndex: number;
  complete: boolean;
};

const EMPTY: SessionGlance = { total: 0, done: 0, currentIndex: -1, complete: false };

/** Statuses a stored step may carry. Anything else is not a step. */
const STATUSES = new Set(["planned", "done", "dropped"]);

/**
 * Reads progress out of a stored plan.
 *
 * Nothing here trusts the shape: a plan comes from localStorage, so every
 * value is checked against a constant collection before it is counted.
 */
export function glanceFromValue(value: unknown): SessionGlance {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = value as { v?: unknown; status?: unknown; goals?: unknown };
  if (raw.v !== 1) return EMPTY;
  if (!Array.isArray(raw.goals)) return EMPTY;

  const statuses: string[] = [];
  for (const entry of raw.goals) {
    if (!entry || typeof entry !== "object") return EMPTY;
    const status = (entry as { st?: unknown }).st;
    if (typeof status !== "string" || !STATUSES.has(status)) return EMPTY;
    if (status !== "dropped") statuses.push(status);
  }
  if (statuses.length === 0) return EMPTY;

  const currentIndex = statuses.indexOf("planned");
  return {
    total: statuses.length,
    done: statuses.filter((status) => status === "done").length,
    currentIndex,
    complete: raw.status === "complete" || currentIndex < 0,
  };
}

export function readSessionGlance(profileId: string): SessionGlance {
  if (typeof window === "undefined" || !profileId) return EMPTY;
  try {
    const raw = window.localStorage.getItem(`${SESSION_GLANCE_PREFIX}${profileId}`);
    return glanceFromValue(raw ? JSON.parse(raw) : null);
  } catch {
    return EMPTY;
  }
}
