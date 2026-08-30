"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildLearnerModel,
  EMPTY_LEARNER_MODEL,
  EVIDENCE_LIMIT,
  normalizeEvidenceLog,
  type LearnerModel,
  type LearningEvidence,
} from "@/lib/adrian-learner-model";

const EVIDENCE_PREFIX = "adrianos-evidence-v1:";
export const EVIDENCE_EVENT = "adrianos-evidence-updated";

/**
 * Response time is measured here rather than inside each game.
 *
 * Every game already funnels answers through `recordLearningAttempt`, so the
 * clock can be started when a game mounts or advances and stopped when the
 * answer arrives. That gives real latency for all games without threading a
 * timer through 40+ game components, and games that want finer control can
 * still pass `responseMs` explicitly.
 */
const questionClocks = new Map<string, number>();

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/** Marks the moment a question became answerable for a game. */
export function markQuestionShown(gameSlug: string): void {
  questionClocks.set(gameSlug, now());
}

/** Reads and clears the elapsed time since the question was shown. */
export function takeResponseMs(gameSlug: string): number | null {
  const started = questionClocks.get(gameSlug);
  questionClocks.delete(gameSlug);
  if (started === undefined) return null;
  const elapsed = Math.round(now() - started);
  return elapsed > 0 ? elapsed : null;
}

export function clearQuestionClocks(): void {
  questionClocks.clear();
}

function storageKey(profileId: string): string {
  return `${EVIDENCE_PREFIX}${profileId}`;
}

export function readEvidence(profileId: string): LearningEvidence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    return raw ? normalizeEvidenceLog(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeEvidence(profileId: string, rows: LearningEvidence[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(profileId),
      JSON.stringify(rows.slice(-EVIDENCE_LIMIT))
    );
    window.dispatchEvent(new Event(EVIDENCE_EVENT));
  } catch {
    // A full or unavailable store must never break gameplay.
  }
}

export function appendEvidence(
  profileId: string,
  row: LearningEvidence
): LearningEvidence[] {
  const next = [...readEvidence(profileId), row].slice(-EVIDENCE_LIMIT);
  writeEvidence(profileId, next);
  return next;
}

export function clearEvidence(profileId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(profileId));
    window.dispatchEvent(new Event(EVIDENCE_EVENT));
  } catch {
    // Ignore storage failures.
  }
}

export function readLearnerModel(profileId: string): LearnerModel {
  if (!profileId) return EMPTY_LEARNER_MODEL;
  return buildLearnerModel(profileId, readEvidence(profileId));
}

/** Live learner model for a profile, refreshed as gameplay evidence lands. */
export function useLearnerModel(profileId: string) {
  const [model, setModel] = useState<LearnerModel>(EMPTY_LEARNER_MODEL);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setModel(readLearnerModel(profileId));
    setHydrated(true);
  }, [profileId]);

  useEffect(() => {
    refresh();
    window.addEventListener(EVIDENCE_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(EVIDENCE_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [refresh]);

  return { model, hydrated, refresh };
}
