"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type HistoryArchiveCard = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type HistoryArchive = {
  version: 1;
  cards: HistoryArchiveCard[];
  investigations: number;
  updatedAt: string;
};

const ITEM_ID = "history-lab-archive";
const GAME_SLUG = "adrianos-history-archive";
export const HISTORY_ARCHIVE_EVENT = "adrianos-history-archive-updated";

const EMPTY_ARCHIVE: HistoryArchive = {
  version: 1,
  cards: [],
  investigations: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseArchive(item: ReviewItem | undefined): HistoryArchive {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.historyArchive !== true) return EMPTY_ARCHIVE;
  const raw = item.data.archiveJson;
  if (typeof raw !== "string") return EMPTY_ARCHIVE;
  try {
    const parsed = JSON.parse(raw) as Partial<HistoryArchive>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card): card is HistoryArchiveCard => Boolean(
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
      investigations: typeof parsed.investigations === "number" && Number.isFinite(parsed.investigations)
        ? Math.max(0, Math.floor(parsed.investigations))
        : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY_ARCHIVE;
  }
}

export function readHistoryArchive(profileId: string): HistoryArchive {
  const learning = readLearningForProfile(profileId);
  return parseArchive(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeHistoryArchive(profileId: string, archive: HistoryArchive): HistoryArchive {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: HistoryArchive = {
    ...archive,
    version: 1,
    cards: archive.cards.slice(-50),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "history-archive",
    subject: "History",
    prompt: "History Lab archive cards",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: {
      historyArchive: true,
      archiveJson: JSON.stringify(next),
    },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(HISTORY_ARCHIVE_EVENT));
  return next;
}

export function addHistoryArchiveCards(
  profileId: string,
  cards: Array<Omit<HistoryArchiveCard, "earnedAt">>
): { archive: HistoryArchive; added: HistoryArchiveCard[] } {
  const current = readHistoryArchive(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards
    .filter((card) => !known.has(card.id))
    .map((card) => ({ ...card, earnedAt }));
  const archive = writeHistoryArchive(profileId, {
    ...current,
    investigations: current.investigations + 1,
    cards: [...current.cards, ...added],
  });
  return { archive, added };
}
