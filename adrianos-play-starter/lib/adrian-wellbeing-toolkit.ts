"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type WellbeingToolCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type WellbeingToolkit = {
  version: 1;
  cards: WellbeingToolCard[];
  missions: number;
  updatedAt: string;
};

const ITEM_ID = "feelings-friendship-toolkit";
const GAME_SLUG = "adrianos-wellbeing-toolkit";
export const WELLBEING_TOOLKIT_EVENT = "adrianos-wellbeing-toolkit-updated";

const EMPTY_TOOLKIT: WellbeingToolkit = {
  version: 1,
  cards: [],
  missions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseToolkit(item: ReviewItem | undefined): WellbeingToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.wellbeingToolkit !== true) return EMPTY_TOOLKIT;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY_TOOLKIT;
  try {
    const parsed = JSON.parse(raw) as Partial<WellbeingToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card): card is WellbeingToolCard => Boolean(
            card
            && typeof card === "object"
            && typeof card.id === "string"
            && typeof card.label === "string"
            && typeof card.emoji === "string"
            && typeof card.earnedAt === "string"
          ))
          .slice(-50)
      : [];
    return {
      version: 1,
      cards,
      missions: typeof parsed.missions === "number" && Number.isFinite(parsed.missions)
        ? Math.max(0, Math.floor(parsed.missions))
        : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY_TOOLKIT;
  }
}

export function readWellbeingToolkit(profileId: string): WellbeingToolkit {
  const learning = readLearningForProfile(profileId);
  return parseToolkit(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeWellbeingToolkit(profileId: string, toolkit: WellbeingToolkit): WellbeingToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: WellbeingToolkit = {
    ...toolkit,
    version: 1,
    cards: toolkit.cards.slice(-50),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "wellbeing-calm-friendship-toolkit",
    subject: "Wellbeing",
    prompt: "Feelings and Friendship Lab tools",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: {
      wellbeingToolkit: true,
      toolkitJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(WELLBEING_TOOLKIT_EVENT));
  return next;
}

export function addWellbeingToolCards(
  profileId: string,
  cards: Array<Omit<WellbeingToolCard, "earnedAt">>
): { toolkit: WellbeingToolkit; added: WellbeingToolCard[] } {
  const current = readWellbeingToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards
    .filter((card) => !known.has(card.id))
    .map((card) => ({ ...card, earnedAt }));
  const toolkit = writeWellbeingToolkit(profileId, {
    ...current,
    missions: current.missions + 1,
    cards: [...current.cards, ...added],
  });
  return { toolkit, added };
}
