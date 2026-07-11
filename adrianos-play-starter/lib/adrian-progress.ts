"use client";

import { useCallback, useEffect, useState } from "react";

export type GameProgress = {
  plays: number;
  completions: number;
  bestScore: number;
  lastPlayed: string | null;
};

export type AdrianProgress = {
  xp: number;
  coins: number;
  level: number;
  games: Record<string, GameProgress>;
};

export type ProgressReward = {
  xp?: number;
  coins?: number;
  score?: number;
  completed?: boolean;
};

const STORAGE_KEY = "adrianos-progress-v1";
const PROGRESS_EVENT = "adrianos-progress-updated";
const XP_PER_LEVEL = 200;

const EMPTY_PROGRESS: AdrianProgress = {
  xp: 0,
  coins: 0,
  level: 1,
  games: {},
};

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeGameProgress(value: unknown): GameProgress {
  const game = value && typeof value === "object" ? value as Partial<GameProgress> : {};
  return {
    plays: Math.max(0, safeNumber(game.plays)),
    completions: Math.max(0, safeNumber(game.completions)),
    bestScore: Math.max(0, safeNumber(game.bestScore)),
    lastPlayed: typeof game.lastPlayed === "string" ? game.lastPlayed : null,
  };
}

function normalizeProgress(value: unknown): AdrianProgress {
  if (!value || typeof value !== "object") return EMPTY_PROGRESS;
  const raw = value as Partial<AdrianProgress>;
  const xp = Math.max(0, safeNumber(raw.xp));
  const games: Record<string, GameProgress> = {};

  if (raw.games && typeof raw.games === "object") {
    for (const [slug, game] of Object.entries(raw.games)) {
      games[slug] = normalizeGameProgress(game);
    }
  }

  return {
    xp,
    coins: Math.max(0, safeNumber(raw.coins)),
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    games,
  };
}

export function readAdrianProgress(): AdrianProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

function writeAdrianProgress(progress: AdrianProgress): AdrianProgress {
  if (typeof window === "undefined") return progress;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event(PROGRESS_EVENT));
  return progress;
}

export function useAdrianProgress() {
  const [progress, setProgress] = useState<AdrianProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    const refresh = () => setProgress(readAdrianProgress());
    refresh();

    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const recordPlay = useCallback((gameSlug: string) => {
    const current = readAdrianProgress();
    const game = current.games[gameSlug] ?? normalizeGameProgress(null);
    const next: AdrianProgress = {
      ...current,
      games: {
        ...current.games,
        [gameSlug]: {
          ...game,
          plays: game.plays + 1,
          lastPlayed: new Date().toISOString(),
        },
      },
    };
    setProgress(writeAdrianProgress(next));
    return next;
  }, []);

  const award = useCallback((gameSlug: string, reward: ProgressReward) => {
    const current = readAdrianProgress();
    const game = current.games[gameSlug] ?? normalizeGameProgress(null);
    const nextXp = current.xp + Math.max(0, reward.xp ?? 0);
    const next: AdrianProgress = {
      xp: nextXp,
      coins: current.coins + Math.max(0, reward.coins ?? 0),
      level: Math.floor(nextXp / XP_PER_LEVEL) + 1,
      games: {
        ...current.games,
        [gameSlug]: {
          ...game,
          bestScore: Math.max(game.bestScore, Math.max(0, reward.score ?? 0)),
          completions: game.completions + (reward.completed ? 1 : 0),
          lastPlayed: new Date().toISOString(),
        },
      },
    };
    setProgress(writeAdrianProgress(next));
    return next;
  }, []);

  return {
    progress,
    recordPlay,
    award,
    xpIntoLevel: progress.xp % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
  };
}
