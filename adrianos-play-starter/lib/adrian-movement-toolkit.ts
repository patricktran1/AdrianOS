"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";

export type MovementToolCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type MovementToolkit = {
  version: 1;
  cards: MovementToolCard[];
  missions: number;
  minutes: number;
  updatedAt: string;
};

const ITEM_ID = "movement-toolkit";
const GAME_SLUG = "adrianos-movement-toolkit";
export const MOVEMENT_TOOLKIT_EVENT = "adrianos-movement-toolkit-updated";

const EMPTY: MovementToolkit = {
  version: 1,
  cards: [],
  missions: 0,
  minutes: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parse(item: ReviewItem | undefined): MovementToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.movementToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<MovementToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card): card is MovementToolCard => Boolean(
          card && typeof card.id === "string" && typeof card.label === "string" && typeof card.emoji === "string" && typeof card.earnedAt === "string"
        )).slice(-60)
      : [];
    return {
      version: 1,
      cards,
      missions: typeof parsed.missions === "number" && Number.isFinite(parsed.missions) ? Math.max(0, Math.floor(parsed.missions)) : 0,
      minutes: typeof parsed.minutes === "number" && Number.isFinite(parsed.minutes) ? Math.max(0, Math.floor(parsed.minutes)) : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY;
  }
}

export function readMovementToolkit(profileId: string): MovementToolkit {
  const learning = readLearningForProfile(profileId);
  return parse(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeToolkit(profileId: string, toolkit: MovementToolkit): MovementToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: MovementToolkit = { ...toolkit, version: 1, cards: toolkit.cards.slice(-60), updatedAt: now };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "movement-toolkit",
    subject: "Movement",
    prompt: "Movement Lab toolkit",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: { movementToolkit: true, toolkitJson: JSON.stringify(next) },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(MOVEMENT_TOOLKIT_EVENT));
  return next;
}

export function addMovementTools(
  profileId: string,
  cards: Array<Omit<MovementToolCard, "earnedAt">>,
  secondsMoved: number
): { toolkit: MovementToolkit; added: MovementToolCard[] } {
  const current = readMovementToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards.filter((card) => !known.has(card.id)).map((card) => ({ ...card, earnedAt }));
  const toolkit = writeToolkit(profileId, {
    ...current,
    missions: current.missions + 1,
    minutes: current.minutes + Math.max(1, Math.round(secondsMoved / 60)),
    cards: [...current.cards, ...added],
  });
  return { toolkit, added };
}
