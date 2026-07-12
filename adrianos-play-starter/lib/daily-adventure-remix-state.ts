"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";
import { dailyRemixDateKey } from "@/lib/daily-adventure-remix";

const GAME_SLUG = "daily-adventure-remix";
const STATE_ID = "daily-remix-synced-state";

export type DailyRemixState = {
  completedToday: boolean;
  streak: number;
  bestStreak: number;
};

function stateItem(profileId: string): ReviewItem | null {
  return readLearningForProfile(profileId).reviewQueue.find(
    (item) => item.gameSlug === GAME_SLUG && item.id === STATE_ID
  ) ?? null;
}

export function readDailyRemixState(profileId: string, day = dailyRemixDateKey()): DailyRemixState {
  const item = stateItem(profileId);
  const lastDay = typeof item?.data?.lastDay === "string" ? item.data.lastDay : "";
  const streak = typeof item?.data?.streak === "number" ? item.data.streak : 0;
  const bestStreak = typeof item?.data?.bestStreak === "number" ? item.data.bestStreak : streak;
  return { completedToday: lastDay === day, streak, bestStreak };
}

export function claimDailyRemix(profileId: string, day = dailyRemixDateKey()): {
  firstToday: boolean;
  streak: number;
  bestStreak: number;
} {
  const current = readLearningForProfile(profileId);
  const existing = current.reviewQueue.find(
    (item) => item.gameSlug === GAME_SLUG && item.id === STATE_ID
  );
  const lastDay = typeof existing?.data?.lastDay === "string" ? existing.data.lastDay : "";
  const previousStreak = typeof existing?.data?.streak === "number" ? existing.data.streak : 0;
  const previousBest = typeof existing?.data?.bestStreak === "number" ? existing.data.bestStreak : previousStreak;

  if (lastDay === day) {
    return { firstToday: false, streak: previousStreak, bestStreak: previousBest };
  }

  const yesterday = new Date(`${day}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = lastDay === dailyRemixDateKey(yesterday) ? previousStreak + 1 : 1;
  const bestStreak = Math.max(previousBest, streak);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: STATE_ID,
    gameSlug: GAME_SLUG,
    skillId: "daily-remix-habit",
    subject: "Logic",
    prompt: "Daily Adventure Remix completion and streak state",
    correctAnswer: "",
    data: { lastDay: day, streak, bestStreak, syncedDailyReward: true },
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: streak,
    status: "resolved",
  };

  writeLearningForProfile(profileId, {
    ...current,
    reviewQueue: [
      ...current.reviewQueue.filter(
        (row) => !(row.gameSlug === GAME_SLUG && row.id === STATE_ID)
      ),
      item,
    ].slice(-100),
  });

  return { firstToday: true, streak, bestStreak };
}
