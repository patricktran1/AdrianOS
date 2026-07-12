"use client";

import type { Game } from "@/lib/games";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type LearningState,
  type ReviewItem,
} from "@/lib/adrian-learning";
import { readDailyRemixState } from "@/lib/daily-adventure-remix-state";
import type { AdrianProgress } from "@/lib/adrian-progress";

const ARCADE_GAME_SLUG = "adrianos-adventure-arcade";
const ARCADE_STATE_ID = "arcade-library-state";
const MAX_RECENT = 6;
const MAX_FAVORITES = 12;

export type ArcadeState = {
  favorites: string[];
  recent: string[];
};

export type ArcadePortalId =
  | "for-you"
  | "story"
  | "quick"
  | "boss"
  | "together"
  | "rescue"
  | "all";

export const FEATURED_GAME_BY_GRADE: Record<ElementaryGrade, string> = {
  [-1]: "daily-adventure-remix",
  0: "rainbow-rocket-park",
  1: "robot-rescue-city",
  2: "dino-time-rescue",
  3: "space-station-sigma",
  4: "mystery-temple",
  5: "cyber-city-five",
};

const STORY_SLUGS = new Set([
  "rainbow-rocket-park",
  "robot-rescue-city",
  "dino-time-rescue",
  "space-station-sigma",
  "mystery-temple",
  "cyber-city-five",
  "question-quest",
  "treasure-map-math",
  "solar-system-explorer",
  "human-body-explorer",
]);

const QUICK_SLUGS = new Set([
  "daily-adventure-remix",
  "number-quest",
  "math-blast",
  "reading-lab",
  "science-quest",
  "money-math",
  "pattern-master",
  "music-maker",
]);

const BOSS_SLUGS = new Set(["adaptive-boss-arena", "daily-adventure-remix"]);
const TOGETHER_SLUGS = new Set(["family-quest-party"]);
const RESCUE_SLUGS = new Set(["mastery-rescue-lab", "mastery-lab"]);

function cleanList(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  return [...new Set(value.split("|").map((item) => item.trim()).filter(Boolean))];
}

function stateItem(state: LearningState): ReviewItem | null {
  return state.reviewQueue.find(
    (item) => item.gameSlug === ARCADE_GAME_SLUG && item.id === ARCADE_STATE_ID
  ) ?? null;
}

export function readArcadeState(profileId: string): ArcadeState {
  const item = stateItem(readLearningForProfile(profileId));
  return {
    favorites: cleanList(item?.data?.favorites),
    recent: cleanList(item?.data?.recent),
  };
}

function writeArcadeState(profileId: string, next: ArcadeState): ArcadeState {
  const current = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: ARCADE_STATE_ID,
    gameSlug: ARCADE_GAME_SLUG,
    skillId: "arcade-preferences",
    subject: "Learning Skills",
    prompt: "Per-learner Adventure Arcade favorites and recent games",
    correctAnswer: "",
    data: {
      favorites: next.favorites.slice(0, MAX_FAVORITES).join("|"),
      recent: next.recent.slice(0, MAX_RECENT).join("|"),
      profileSetting: true,
      syncedArcadeState: true,
    },
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
  };

  writeLearningForProfile(profileId, {
    ...current,
    reviewQueue: [
      ...current.reviewQueue.filter(
        (row) => !(row.gameSlug === ARCADE_GAME_SLUG && row.id === ARCADE_STATE_ID)
      ),
      item,
    ].slice(-100),
  });
  return next;
}

export function rememberArcadeGame(profileId: string, slug: string): ArcadeState {
  const current = readArcadeState(profileId);
  return writeArcadeState(profileId, {
    ...current,
    recent: [slug, ...current.recent.filter((item) => item !== slug)].slice(0, MAX_RECENT),
  });
}

export function toggleArcadeFavorite(profileId: string, slug: string): ArcadeState {
  const current = readArcadeState(profileId);
  const favorites = current.favorites.includes(slug)
    ? current.favorites.filter((item) => item !== slug)
    : [slug, ...current.favorites.filter((item) => item !== slug)].slice(0, MAX_FAVORITES);
  return writeArcadeState(profileId, { ...current, favorites });
}

export function gameAgeRange(game: Pick<Game, "age">): { min: number; max: number } {
  const values = game.age.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (values.length === 0) return { min: 4, max: 11 };
  if (values.length === 1) return { min: values[0], max: values[0] };
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function isGameAgeFit(game: Game, age: number): boolean {
  const range = gameAgeRange(game);
  return age >= range.min && age <= range.max;
}

export function gamesForPortal(games: Game[], portal: ArcadePortalId): Game[] {
  const playable = games.filter((game) => game.status === "playable");
  if (portal === "story") return playable.filter((game) => STORY_SLUGS.has(game.slug));
  if (portal === "quick") return playable.filter((game) => QUICK_SLUGS.has(game.slug));
  if (portal === "boss") return playable.filter((game) => BOSS_SLUGS.has(game.slug));
  if (portal === "together") return playable.filter((game) => TOGETHER_SLUGS.has(game.slug));
  if (portal === "rescue") return playable.filter((game) => RESCUE_SLUGS.has(game.slug));
  return playable;
}

export function dueReviewCount(profileId: string, now = new Date()): number {
  const state = readLearningForProfile(profileId);
  return state.reviewQueue.filter((item) => {
    if (item.status !== "due") return false;
    if (item.data?.profileSetting || item.data?.syncedDailyReward || item.data?.syncedArcadeState) return false;
    const dueAt = new Date(item.dueAt).getTime();
    return Number.isFinite(dueAt) && dueAt <= now.getTime();
  }).length;
}

export function recommendedGameSlug(options: {
  profileId: string;
  grade: ElementaryGrade;
  games: Game[];
  progress: AdrianProgress;
}): { slug: string; reason: string; eyebrow: string } {
  const available = new Set(options.games.filter((game) => game.status === "playable").map((game) => game.slug));
  const reviews = dueReviewCount(options.profileId);
  if (reviews > 0 && available.has("mastery-rescue-lab")) {
    return {
      slug: "mastery-rescue-lab",
      eyebrow: "RESCUE MISSION READY",
      reason: `${reviews} skill${reviews === 1 ? "" : "s"} ready for a playful rematch.`,
    };
  }

  const daily = readDailyRemixState(options.profileId);
  if (!daily.completedToday && available.has("daily-adventure-remix")) {
    return {
      slug: "daily-adventure-remix",
      eyebrow: "TODAY’S FRESH RUN",
      reason: "A new five-gate route is ready, and today’s treasure is still unclaimed.",
    };
  }

  const featured = FEATURED_GAME_BY_GRADE[options.grade];
  const featuredProgress = options.progress.games[featured];
  if (available.has(featured) && (featuredProgress?.completions ?? 0) === 0) {
    return {
      slug: featured,
      eyebrow: "GRADE ADVENTURE",
      reason: "Your grade-level story campaign is ready to continue.",
    };
  }

  if (available.has("adaptive-boss-arena")) {
    return {
      slug: "adaptive-boss-arena",
      eyebrow: "CHALLENGE MATCH",
      reason: "The boss changes difficulty after every round to keep the battle in your learning zone.",
    };
  }

  return {
    slug: available.has(featured) ? featured : options.games.find((game) => game.status === "playable")?.slug ?? "daily-adventure-remix",
    eyebrow: "PLAY NEXT",
    reason: "A grade-fit adventure is ready.",
  };
}
