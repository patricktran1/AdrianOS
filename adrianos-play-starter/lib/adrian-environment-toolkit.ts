"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";

export type EnvironmentTool = { id: string; label: string; emoji: string; earnedAt: string };
export type EnvironmentToolkit = { version: 1; cards: EnvironmentTool[]; missions: number; updatedAt: string };

const ITEM_ID = "environment-toolkit";
const GAME_SLUG = "adrianos-environment-toolkit";
export const ENVIRONMENT_TOOLKIT_EVENT = "adrianos-environment-toolkit-updated";
const EMPTY: EnvironmentToolkit = { version: 1, cards: [], missions: 0, updatedAt: "1970-01-01T00:00:00.000Z" };

function parse(item: ReviewItem | undefined): EnvironmentToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.environmentToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<EnvironmentToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card): card is EnvironmentTool => Boolean(card && typeof card.id === "string" && typeof card.label === "string" && typeof card.emoji === "string" && typeof card.earnedAt === "string")).slice(-60)
      : [];
    return { version: 1, cards, missions: typeof parsed.missions === "number" ? Math.max(0, Math.floor(parsed.missions)) : 0, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt };
  } catch { return EMPTY; }
}

export function readEnvironmentToolkit(profileId: string): EnvironmentToolkit {
  const learning = readLearningForProfile(profileId);
  return parse(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeToolkit(profileId: string, toolkit: EnvironmentToolkit): EnvironmentToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next = { ...toolkit, version: 1 as const, cards: toolkit.cards.slice(-60), updatedAt: now };
  const item: ReviewItem = { id: ITEM_ID, gameSlug: GAME_SLUG, skillId: "environment-toolkit", subject: "Environment", prompt: "Nature & Environment Toolkit", correctAnswer: "", dueAt: "2999-12-31T23:59:59.999Z", updatedAt: now, successes: next.cards.length, status: "resolved", data: { environmentToolkit: true, toolkitJson: JSON.stringify(next) } };
  writeLearningForProfile(profileId, { ...learning, reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100) });
  window.dispatchEvent(new Event(ENVIRONMENT_TOOLKIT_EVENT));
  return next;
}

export function addEnvironmentTools(profileId: string, cards: Array<Omit<EnvironmentTool, "earnedAt">>): { toolkit: EnvironmentToolkit; added: EnvironmentTool[] } {
  const current = readEnvironmentToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards.filter((card) => !known.has(card.id)).map((card) => ({ ...card, earnedAt }));
  const toolkit = writeToolkit(profileId, { ...current, missions: current.missions + 1, cards: [...current.cards, ...added] });
  return { toolkit, added };
}
