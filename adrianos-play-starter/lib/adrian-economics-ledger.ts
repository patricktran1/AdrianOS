"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type EconomicsToolCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type EconomicsLedger = {
  version: 1;
  cards: EconomicsToolCard[];
  missions: number;
  updatedAt: string;
};

const ITEM_ID = "economics-lab-ledger";
const GAME_SLUG = "adrianos-economics-ledger";
export const ECONOMICS_LEDGER_EVENT = "adrianos-economics-ledger-updated";

const EMPTY_LEDGER: EconomicsLedger = {
  version: 1,
  cards: [],
  missions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseLedger(item: ReviewItem | undefined): EconomicsLedger {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.economicsLedger !== true) return EMPTY_LEDGER;
  const raw = item.data.ledgerJson;
  if (typeof raw !== "string") return EMPTY_LEDGER;
  try {
    const parsed = JSON.parse(raw) as Partial<EconomicsLedger>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card): card is EconomicsToolCard => Boolean(
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
    return EMPTY_LEDGER;
  }
}

export function readEconomicsLedger(profileId: string): EconomicsLedger {
  const learning = readLearningForProfile(profileId);
  return parseLedger(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeEconomicsLedger(profileId: string, ledger: EconomicsLedger): EconomicsLedger {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: EconomicsLedger = {
    ...ledger,
    version: 1,
    cards: ledger.cards.slice(-50),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "economics-decision-ledger",
    subject: "Economics",
    prompt: "Economics Lab decision tools",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: {
      economicsLedger: true,
      ledgerJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(ECONOMICS_LEDGER_EVENT));
  return next;
}

export function addEconomicsToolCards(
  profileId: string,
  cards: Array<Omit<EconomicsToolCard, "earnedAt">>
): { ledger: EconomicsLedger; added: EconomicsToolCard[] } {
  const current = readEconomicsLedger(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards
    .filter((card) => !known.has(card.id))
    .map((card) => ({ ...card, earnedAt }));
  const ledger = writeEconomicsLedger(profileId, {
    ...current,
    missions: current.missions + 1,
    cards: [...current.cards, ...added],
  });
  return { ledger, added };
}
