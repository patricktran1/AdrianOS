"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";

export type MusicToolCard = { id: string; label: string; emoji: string; earnedAt: string };
export type MusicToolkit = { version: 1; cards: MusicToolCard[]; missions: number; updatedAt: string };

const ITEM_ID = "music-lab-toolkit";
const GAME_SLUG = "adrianos-music-toolkit";
export const MUSIC_TOOLKIT_EVENT = "adrianos-music-toolkit-updated";
const EMPTY: MusicToolkit = { version: 1, cards: [], missions: 0, updatedAt: "1970-01-01T00:00:00.000Z" };

function parse(item: ReviewItem | undefined): MusicToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.musicToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<MusicToolkit>;
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card): card is MusicToolCard => Boolean(card && typeof card.id === "string" && typeof card.label === "string" && typeof card.emoji === "string" && typeof card.earnedAt === "string")).slice(-50)
      : [];
    return { version: 1, cards, missions: Number.isFinite(parsed.missions) ? Math.max(0, Math.floor(parsed.missions ?? 0)) : 0, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt };
  } catch { return EMPTY; }
}

export function readMusicToolkit(profileId: string): MusicToolkit {
  return parse(readLearningForProfile(profileId).reviewQueue.find((item) => item.id === ITEM_ID));
}

function write(profileId: string, toolkit: MusicToolkit): MusicToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next = { ...toolkit, version: 1 as const, cards: toolkit.cards.slice(-50), updatedAt: now };
  const item: ReviewItem = {
    id: ITEM_ID, gameSlug: GAME_SLUG, skillId: "music-toolkit", subject: "Music", prompt: "Music Lab listening and creation tools", correctAnswer: "", dueAt: "2999-12-31T23:59:59.999Z", updatedAt: now, successes: next.cards.length, status: "resolved", data: { musicToolkit: true, toolkitJson: JSON.stringify(next) },
  };
  writeLearningForProfile(profileId, { ...learning, reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100) });
  window.dispatchEvent(new Event(MUSIC_TOOLKIT_EVENT));
  return next;
}

export function addMusicToolCards(profileId: string, cards: Array<Omit<MusicToolCard, "earnedAt">>): { toolkit: MusicToolkit; added: MusicToolCard[] } {
  const current = readMusicToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = cards.filter((card) => !known.has(card.id)).map((card) => ({ ...card, earnedAt }));
  const toolkit = write(profileId, { ...current, missions: current.missions + 1, cards: [...current.cards, ...added] });
  return { toolkit, added };
}
