"use client";

import { useCallback, useEffect, useRef } from "react";
import { type ProgressReward, useAdrianProgress } from "@/lib/adrian-progress";

export type GameCompletionReward = Omit<ProgressReward, "completed">;

/**
 * Shared AdrianOS game-session contract.
 *
 * - Records the initial play exactly once per mounted game session.
 * - Records a verified completion at most once per session.
 * - Uses the existing progress event so School Mode, cloud sync, reports,
 *   portfolios, and dashboards update through the current snapshot system.
 * - restartGame() resets duplicate protection and records a new play.
 */
export function useGameSession(gameSlug: string) {
  const { recordPlay, award } = useAdrianProgress();
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    recordPlay(gameSlug);
  }, [gameSlug, recordPlay]);

  const completeGame = useCallback((reward: GameCompletionReward = {}) => {
    if (completedRef.current) return false;
    completedRef.current = true;
    award(gameSlug, { ...reward, completed: true });
    return true;
  }, [award, gameSlug]);

  const restartGame = useCallback(() => {
    completedRef.current = false;
    recordPlay(gameSlug);
  }, [gameSlug, recordPlay]);

  return { completeGame, restartGame };
}
