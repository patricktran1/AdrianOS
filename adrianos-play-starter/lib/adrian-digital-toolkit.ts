"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";

export type DigitalToolCard = { id: string; label: string; emoji: string; earnedAt: string };
export type DigitalToolkit = { version: 1; cards: DigitalToolCard[]; missions: number; updatedAt: string };

const ITEM_ID = "digital-citizenship-toolkit";
const GAME_SLUG = "adrianos-digital-toolkit";
export const DIGITAL_TOOLKIT_EVENT = "adrianos-digital-toolkit-updated";
const EMPTY: DigitalToolkit = { version: 1, cards: [], missions: 0, updatedAt: "1970-01-01T00:00:00.000Z" };

function parse(item: ReviewItem | undefined): DigitalToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.digitalToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<DigitalToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card): card is DigitalToolCard => Boolean(card && typeof card.id === "string" && typeof card.label === "string" && typeof card.emoji === "string" && typeof card.earnedAt === "string")).slice(-50)
      : [];
    return { version: 1, cards, missions: typeof parsed.missions === "number" ? Math.max(0, Math.floor(parsed.missions)) : 0, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt };
  } catch { return EMPTY; }
}

export function readDigitalToolkit(profileId: string): DigitalToolkit {
  return parse(readLearningForProfile(profileId).reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeDigitalToolkit(profileId: string, toolkit: DigitalToolkit): DigitalToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next = { ...toolkit, version: 1 as const, cards: toolkit.cards.slice(-50), updatedAt: now };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "digital-citizenship-toolkit",
    subject: "Digital Citizenship",
    prompt: "Digital Citizenship Lab tools",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: { digitalToolkit: true, toolkitJson: JSON.stringify(next) },
  };
  writeLearningForProfile(profileId, { ...learning, reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100) });
  window.dispatchEvent(new Event(DIGITAL_TOOLKIT_EVENT));
  return next;
}

export function addDigitalToolCards(profileId: string, cards: Array<Omit<DigitalToolCard, "earnedAt">>): { toolkit: DigitalToolkit; added: DigitalToolCard[] } {
  const current = readDigitalToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards.filter((card) => !known.has(card.id)).map((card) => ({ ...card, earnedAt }));
  const toolkit = writeDigitalToolkit(profileId, { ...current, missions: current.missions + 1, cards: [...current.cards, ...added] });
  return { toolkit, added };
}
