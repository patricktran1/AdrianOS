"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";

export type ArtToolCard = { id: string; label: string; emoji: string; earnedAt: string };
export type ArtToolkit = { version: 1; cards: ArtToolCard[]; missions: number; artworks: number; updatedAt: string };

const ITEM_ID = "art-design-toolkit";
const GAME_SLUG = "adrianos-art-toolkit";
export const ART_TOOLKIT_EVENT = "adrianos-art-toolkit-updated";
const EMPTY: ArtToolkit = { version: 1, cards: [], missions: 0, artworks: 0, updatedAt: "1970-01-01T00:00:00.000Z" };

function parse(item: ReviewItem | undefined): ArtToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.artToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<ArtToolkit>;
    return {
      version: 1,
      cards: Array.isArray(parsed.cards) ? parsed.cards.filter((card): card is ArtToolCard => Boolean(card && typeof card.id === "string" && typeof card.label === "string" && typeof card.emoji === "string" && typeof card.earnedAt === "string")).slice(-50) : [],
      missions: typeof parsed.missions === "number" ? Math.max(0, Math.floor(parsed.missions)) : 0,
      artworks: typeof parsed.artworks === "number" ? Math.max(0, Math.floor(parsed.artworks)) : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch { return EMPTY; }
}

export function readArtToolkit(profileId: string): ArtToolkit {
  const state = readLearningForProfile(profileId);
  return parse(state.reviewQueue.find((item) => item.id === ITEM_ID));
}

function write(profileId: string, toolkit: ArtToolkit): ArtToolkit {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next = { ...toolkit, version: 1 as const, cards: toolkit.cards.slice(-50), updatedAt: now };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "art-toolkit",
    subject: "Art",
    prompt: "Art & Design Lab toolkit",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.cards.length,
    status: "resolved",
    data: { artToolkit: true, toolkitJson: JSON.stringify(next) },
  };
  writeLearningForProfile(profileId, { ...state, reviewQueue: [...state.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100) });
  window.dispatchEvent(new Event(ART_TOOLKIT_EVENT));
  return next;
}

export function addArtTools(profileId: string, tools: Array<Omit<ArtToolCard, "earnedAt">>, artwork = false): { toolkit: ArtToolkit; added: ArtToolCard[] } {
  const current = readArtToolkit(profileId);
  const known = new Set(current.cards.map((card) => card.id));
  const earnedAt = new Date().toISOString();
  const added = tools.filter((tool) => !known.has(tool.id)).map((tool) => ({ ...tool, earnedAt }));
  const toolkit = write(profileId, { ...current, cards: [...current.cards, ...added], missions: current.missions + 1, artworks: current.artworks + (artwork ? 1 : 0) });
  return { toolkit, added };
}
