"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type CivicToolCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type CivicToolbox = {
  version: 1;
  cards: CivicToolCard[];
  missions: number;
  updatedAt: string;
};

const ITEM_ID = "civic-lab-toolbox";
const GAME_SLUG = "adrianos-civic-toolbox";
export const CIVIC_TOOLBOX_EVENT = "adrianos-civic-toolbox-updated";

const EMPTY_TOOLBOX: CivicToolbox = {
  version: 1,
  cards: [],
  missions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseToolbox(item: ReviewItem | undefined): CivicToolbox {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.civicToolbox !== true) return EMPTY_TOOLBOX;
  const raw = item.data.toolboxJson;
  if (typeof raw !== "string") return EMPTY_TOOLBOX;
  try {
    const parsed = JSON.parse(raw) as Partial<CivicToolbox>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card): card is CivicToolCard => Boolean(
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
    return EMPTY_TOOLBOX;
  }
}

export function readCivicToolbox(profileId: string): CivicToolbox {
  const learning = readLearningForProfile(profileId);
  return parseToolbox(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeCivicToolbox(profileId: string, toolbox: CivicToolbox): CivicToolbox {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: CivicToolbox = {
    ...toolbox,
    version: 1,
    cards: toolbox.cards.slice(-50),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "civics-toolbox",
    subject: "Civics",
    prompt: "Civic Lab toolbox cards",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: {
      civicToolbox: true,
      toolboxJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(CIVIC_TOOLBOX_EVENT));
  return next;
}

export function addCivicToolCards(
  profileId: string,
  cards: Array<Omit<CivicToolCard, "earnedAt">>
): { toolbox: CivicToolbox; added: CivicToolCard[] } {
  const current = readCivicToolbox(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards
    .filter((card) => !known.has(card.id))
    .map((card) => ({ ...card, earnedAt }));
  const toolbox = writeCivicToolbox(profileId, {
    ...current,
    missions: current.missions + 1,
    cards: [...current.cards, ...added],
  });
  return { toolbox, added };
}
