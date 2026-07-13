import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ArcadeState } from "@/lib/adventure-arcade";
import { FEATURED_GAME_BY_GRADE, isGameAgeFit } from "@/lib/adventure-arcade";
import type { Game } from "@/lib/games";

export type QuickPlayMood = "adventure" | "quick" | "challenge" | "create" | "surprise";

export type QuickPlayChoice = {
  mood: QuickPlayMood;
  eyebrow: string;
  game: Game;
  href: string;
  reason: string;
  plays: number;
  completions: number;
};

export type QuickPlayDeck = {
  surprise: QuickPlayChoice;
  choices: QuickPlayChoice[];
};

type BuildQuickPlayDeckInput = {
  profileId: string;
  age: number;
  grade: ElementaryGrade;
  games: Game[];
  progress: AdrianProgress;
  arcade: ArcadeState;
  now?: Date;
};

type MoodDefinition = {
  mood: Exclude<QuickPlayMood, "surprise">;
  eyebrow: string;
  reason: string;
  slugs: string[];
};

const FUN_EXCLUSIONS = new Set([
  "placement-adventure",
  "mastery-lab",
  "mastery-rescue-lab",
]);

const STORY_GAMES = [
  "daily-adventure-remix",
  "story-expedition",
  "dino-time-rescue",
  "robot-rescue-city",
  "rainbow-rocket-park",
  "space-station-sigma",
  "mystery-temple",
  "cyber-city-five",
  "treasure-map-math",
  "dinosaur-detective",
  "question-quest",
  "solar-system-explorer",
  "human-body-explorer",
];

const QUICK_GAMES = [
  "daily-adventure-remix",
  "music-maker",
  "pattern-master",
  "number-quest",
  "math-blast",
  "money-math",
  "reading-lab",
  "science-quest",
  "memory-match",
];

const CHALLENGE_GAMES = [
  "adaptive-boss-arena",
  "dino-time-rescue",
  "robot-rescue-city",
  "space-station-sigma",
  "mystery-temple",
  "cyber-city-five",
  "treasure-map-math",
  "dinosaur-detective",
  "question-quest",
];

const CREATE_GAMES = [
  "music-maker",
  "word-forge-studio",
  "family-quest-party",
  "guess-who",
  "memory-match",
  "pattern-master",
  "rainbow-rocket-park",
  "story-expedition",
];

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function definitionsForGrade(grade: ElementaryGrade): MoodDefinition[] {
  return [
    {
      mood: "adventure",
      eyebrow: "BIG ADVENTURE",
      reason: "Jump into a story world made for your grade.",
      slugs: [FEATURED_GAME_BY_GRADE[grade], ...STORY_GAMES],
    },
    {
      mood: "quick",
      eyebrow: "QUICK FUN",
      reason: "A fast game you can start right away.",
      slugs: QUICK_GAMES,
    },
    {
      mood: "challenge",
      eyebrow: "CHALLENGE ME",
      reason: "Take on a puzzle, mystery, or boss battle.",
      slugs: CHALLENGE_GAMES,
    },
    {
      mood: "create",
      eyebrow: "MAKE & PLAY",
      reason: "Use music, words, memory, or imagination.",
      slugs: CREATE_GAMES,
    },
  ];
}

function hrefFor(game: Game, mood: QuickPlayMood): string {
  const params = new URLSearchParams({ from: "quick-play", mood });
  return `/games/${game.slug}?${params.toString()}`;
}

function toChoice(
  game: Game,
  definition: Pick<MoodDefinition, "mood" | "eyebrow" | "reason"> | {
    mood: "surprise";
    eyebrow: string;
    reason: string;
  },
  progress: AdrianProgress,
): QuickPlayChoice {
  const row = progress.games[game.slug];
  return {
    ...definition,
    game,
    href: hrefFor(game, definition.mood),
    plays: row?.plays ?? 0,
    completions: row?.completions ?? 0,
  };
}

function ranked(
  candidates: Game[],
  input: BuildQuickPlayDeckInput,
  seed: string,
): Game[] {
  return [...candidates].sort((left, right) => {
    const score = (game: Game) => {
      const row = input.progress.games[game.slug];
      const recentIndex = input.arcade.recent.indexOf(game.slug);
      const recentPenalty = recentIndex === 0 ? 120 : recentIndex > 0 ? 30 - Math.min(20, recentIndex * 3) : 0;
      const favoriteBonus = input.arcade.favorites.includes(game.slug) ? -24 : 0;
      const playCost = (row?.completions ?? 0) * 12 + (row?.plays ?? 0) * 2;
      return recentPenalty + favoriteBonus + playCost + hash01(`${seed}:${game.slug}`) * 5;
    };
    return score(left) - score(right) || left.title.localeCompare(right.title);
  });
}

export function buildQuickPlayDeck(input: BuildQuickPlayDeckInput): QuickPlayDeck | null {
  const now = input.now ?? new Date();
  const playable = input.games.filter((game) => game.status === "playable" && !FUN_EXCLUSIONS.has(game.slug));
  const ageFit = playable.filter((game) => isGameAgeFit(game, input.age));
  const pool = ageFit.length >= 5 ? ageFit : playable;
  if (pool.length === 0) return null;

  const bySlug = new Map(pool.map((game) => [game.slug, game]));
  const definitions = definitionsForGrade(input.grade);
  const selected = new Set<string>();
  const choices: QuickPlayChoice[] = [];
  const seedBase = `${input.profileId}:${localDayKey(now)}`;

  for (const definition of definitions) {
    const candidates = definition.slugs
      .map((slug) => bySlug.get(slug))
      .filter((game): game is Game => game !== undefined && !selected.has(game.slug));
    const fallback = pool.filter((game) => !selected.has(game.slug));
    const game = ranked(candidates.length > 0 ? candidates : fallback, input, `${seedBase}:${definition.mood}`)[0];
    if (!game) continue;
    selected.add(game.slug);
    choices.push(toChoice(game, definition, input.progress));
  }

  const fallbackLabels: Array<Pick<MoodDefinition, "mood" | "eyebrow" | "reason">> = [
    { mood: "adventure", eyebrow: "NEW WORLD", reason: "Open a different playful world." },
    { mood: "quick", eyebrow: "FAST PICK", reason: "Start playing in one tap." },
    { mood: "challenge", eyebrow: "LEVEL UP", reason: "Try a fresh challenge." },
    { mood: "create", eyebrow: "PLAY YOUR WAY", reason: "Explore a different kind of fun." },
  ];

  while (choices.length < Math.min(4, pool.length)) {
    const game = ranked(
      pool.filter((candidate) => !selected.has(candidate.slug)),
      input,
      `${seedBase}:fallback:${choices.length}`,
    )[0];
    if (!game) break;
    const definition = fallbackLabels[choices.length] ?? fallbackLabels[0];
    selected.add(game.slug);
    choices.push(toChoice(game, definition, input.progress));
  }

  const newestRecent = input.arcade.recent[0];
  const surpriseCandidates = pool.filter((game) => !selected.has(game.slug) && game.slug !== newestRecent);
  const nonRecentPool = pool.filter((game) => game.slug !== newestRecent);
  const surprisePool = surpriseCandidates.length > 0
    ? surpriseCandidates
    : nonRecentPool.length > 0
      ? nonRecentPool
      : pool;
  const surpriseGame = ranked(surprisePool, input, `${seedBase}:surprise:${input.arcade.recent.join("|")}`)[0];
  if (!surpriseGame) return null;

  return {
    surprise: toChoice(surpriseGame, {
      mood: "surprise",
      eyebrow: "ONE-TAP SURPRISE",
      reason: "A fun, age-fit game picked from real play history.",
    }, input.progress),
    choices: choices.slice(0, 4),
  };
}
