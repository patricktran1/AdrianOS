"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type HealthToolCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type HealthToolkit = {
  version: 1;
  cards: HealthToolCard[];
  missions: number;
  updatedAt: string;
};

const ITEM_ID = "health-safety-toolkit";
const GAME_SLUG = "adrianos-health-toolkit";
export const HEALTH_TOOLKIT_EVENT = "adrianos-health-toolkit-updated";

const EMPTY_TOOLKIT: HealthToolkit = {
  version: 1,
  cards: [],
  missions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseToolkit(item: ReviewItem | undefined): HealthToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.healthToolkit !== true) return EMPTY_TOOLKIT;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY_TOOLKIT;
  try {
    const parsed = JSON.parse(raw) as Partial<HealthToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card): card is HealthToolCard => Boolean(
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

export function readHealthToolkit(profileId: string): HealthToolkit {
  const learning = readLearningForProfile(profileId);
  return parseToolkit(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeHealthToolkit(profileId: string, toolkit: HealthToolkit): HealthToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: HealthToolkit = {
    ...toolkit,
    version: 1,
    cards: toolkit.cards.slice(-50),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "health-safety-toolkit",
    subject: "Health",
    prompt: "Health and Safety Lab practical tools",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: {
      healthToolkit: true,
      toolkitJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(HEALTH_TOOLKIT_EVENT));
  return next;
}

export function addHealthToolCards(
  profileId: string,
  cards: Array<Omit<HealthToolCard, "earnedAt">>
): { toolkit: HealthToolkit; added: HealthToolCard[] } {
  const current = readHealthToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards
    .filter((card) => !known.has(card.id))
    .map((card) => ({ ...card, earnedAt }));
  const toolkit = writeHealthToolkit(profileId, {
    ...current,
    missions: current.missions + 1,
    cards: [...current.cards, ...added],
  });
  return { toolkit, added };
}
