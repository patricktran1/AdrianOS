"use client";

import { useCallback, useEffect, useState } from "react";

export type GameProgress = {
  plays: number;
  completions: number;
  bestScore: number;
  lastPlayed: string | null;
};

export type DailyActivity = {
  date: string;
  plays: number;
  completions: number;
  xp: number;
  coins: number;
};

export type AdrianProgress = {
  xp: number;
  coins: number;
  level: number;
  games: Record<string, GameProgress>;
  activity: DailyActivity[];
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
  activity: [],
};

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeActivity(value: unknown): DailyActivity[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const activity = item as Partial<DailyActivity>;
      return {
        date: typeof activity.date === "string" ? activity.date : "",
        plays: Math.max(0, safeNumber(activity.plays)),
        completions: Math.max(0, safeNumber(activity.completions)),
        xp: Math.max(0, safeNumber(activity.xp)),
        coins: Math.max(0, safeNumber(activity.coins)),
      };
    })
    .filter((item) => item.date)
    .slice(-30);
}

function normalizeProgress(value: unknown): AdrianProgress {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_PROGRESS, games: {}, activity: [] };
  }

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
    activity: normalizeActivity(raw.activity),
  };
}

function updateTodayActivity(
  activity: DailyActivity[],
  change: Partial<Omit<DailyActivity, "date">>
): DailyActivity[] {
  const today = localDateKey();
  const existing = activity.find((item) => item.date === today) ?? {
    date: today,
    plays: 0,
    completions: 0,
    xp: 0,
    coins: 0,
  };

  const updated: DailyActivity = {
    ...existing,
    plays: existing.plays + Math.max(0, change.plays ?? 0),
    completions: existing.completions + Math.max(0, change.completions ?? 0),
    xp: existing.xp + Math.max(0, change.xp ?? 0),
    coins: existing.coins + Math.max(0, change.coins ?? 0),
  };

  return [...activity.filter((item) => item.date !== today), updated]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setProgress(readAdrianProgress());
      setHydrated(true);
    };

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
      activity: updateTodayActivity(current.activity, { plays: 1 }),
    };
    setProgress(writeAdrianProgress(next));
    return next;
  }, []);

  const award = useCallback((gameSlug: string, reward: ProgressReward) => {
    const current = readAdrianProgress();
    const game = current.games[gameSlug] ?? normalizeGameProgress(null);
    const earnedXp = Math.max(0, reward.xp ?? 0);
    const earnedCoins = Math.max(0, reward.coins ?? 0);
    const completed = reward.completed ? 1 : 0;
    const nextXp = current.xp + earnedXp;
    const next: AdrianProgress = {
      xp: nextXp,
      coins: current.coins + earnedCoins,
      level: Math.floor(nextXp / XP_PER_LEVEL) + 1,
      games: {
        ...current.games,
        [gameSlug]: {
          ...game,
          bestScore: Math.max(game.bestScore, Math.max(0, reward.score ?? 0)),
          completions: game.completions + completed,
          lastPlayed: new Date().toISOString(),
        },
      },
      activity: updateTodayActivity(current.activity, {
        completions: completed,
        xp: earnedXp,
        coins: earnedCoins,
      }),
    };
    setProgress(writeAdrianProgress(next));
    return next;
  }, []);

  const spendCoins = useCallback((amount: number): boolean => {
    const cost = Math.max(0, Math.floor(amount));
    const current = readAdrianProgress();
    if (cost === 0 || current.coins < cost) return false;

    const next: AdrianProgress = {
      ...current,
      coins: current.coins - cost,
    };
    setProgress(writeAdrianProgress(next));
    return true;
  }, []);

  return {
    progress,
    hydrated,
    recordPlay,
    award,
    spendCoins,
    xpIntoLevel: progress.xp % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
  };
}
