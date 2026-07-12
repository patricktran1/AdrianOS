"use client";

import { getSubjectMastery } from "@/lib/adrian-learning";
import {
  interestMatch,
  readLearningProfile,
  type LearnerInterest,
} from "@/lib/adrian-learning-profile";
import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import type { Game } from "@/lib/games";

export const WORLD_QUEST_BOSS_SLUG = "adaptive-boss-arena";

export type WorldQuestMissionKind = "power" | "wonder" | "wildcard";

export type WorldQuestTheme = {
  title: string;
  emoji: string;
  helper: string;
  accent: string;
  accent2: string;
  defaultInterest: LearnerInterest;
};

export type WorldQuestMission = {
  id: string;
  kind: WorldQuestMissionKind;
  eyebrow: string;
  title: string;
  reason: string;
  gameSlug: string;
  href: string;
  emoji: string;
  subject: Game["subject"];
  difficulty: string;
  completed: boolean;
  completedAt: string | null;
};

export type WeeklyWorldQuest = {
  weekKey: string;
  weekLabel: string;
  grade: ElementaryGrade;
  theme: WorldQuestTheme;
  story: string;
  missions: WorldQuestMission[];
  completedMissions: number;
  bossUnlocked: boolean;
  bossCompleted: boolean;
  bossTitle: string;
  bossEmoji: string;
  bossHref: string;
  progressPercent: number;
  nextMission: WorldQuestMission | null;
};

const QUEST_THEMES: Record<ElementaryGrade, WorldQuestTheme> = {
  [-1]: { title: "Critter Crown Trail", emoji: "🐣🌿", helper: "Pip", accent: "#ffd45c", accent2: "#7fdcff", defaultInterest: "Animals" },
  0: { title: "Rainbow Rocket Realm", emoji: "🌈🚀", helper: "Nova", accent: "#ff9bd2", accent2: "#7fdcff", defaultInterest: "Space" },
  1: { title: "Robot City Power Grid", emoji: "🤖⚡", helper: "Bolt", accent: "#7fdcff", accent2: "#d9ff5b", defaultInterest: "Building" },
  2: { title: "Dino Isles Expedition", emoji: "🦖🏝️", helper: "Zip", accent: "#d9ff5b", accent2: "#ffbd6a", defaultInterest: "Dinosaurs" },
  3: { title: "Starlight Frontier", emoji: "🪐🛰️", helper: "Comet", accent: "#c6b8ff", accent2: "#7fdcff", defaultInterest: "Space" },
  4: { title: "Temple of Four Gates", emoji: "🗿🔥", helper: "Koa", accent: "#ffbd6a", accent2: "#d9ff5b", defaultInterest: "Stories" },
  5: { title: "Cyberverse Uprising", emoji: "🌐💠", helper: "Pulse", accent: "#60f3c4", accent2: "#c6b8ff", defaultInterest: "Technology" },
};

const FLAGSHIP_BY_GRADE: Record<ElementaryGrade, string> = {
  [-1]: "daily-adventure-remix",
  0: "rainbow-rocket-park",
  1: "robot-rescue-city",
  2: "dino-time-rescue",
  3: "space-station-sigma",
  4: "mystery-temple",
  5: "cyber-city-five",
};

const FALLBACK_SUBJECTS: Game["subject"][] = ["Math", "Reading", "Science"];
const EXCLUDED_MISSIONS = new Set([
  WORLD_QUEST_BOSS_SLUG,
  "mastery-rescue-lab",
  "family-quest-party",
]);

const STORY_BEATS = [
  "Three world beacons have gone dark. Restore each one, then face the guardian at the final gate.",
  "A storm scattered three knowledge keys across the realm. Recover them before the guardian seals the portal.",
  "The weekly map has awakened. Clear three different worlds to charge the path into the Boss Arena.",
];

function hashNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function chooseStable<T>(items: T[], seed: string): T | undefined {
  if (items.length === 0) return undefined;
  return items[hashNumber(seed) % items.length];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekWindow(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const lastDay = new Date(end);
  lastDay.setDate(lastDay.getDate() - 1);
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = lastDay.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    key: localDateKey(start),
    label: `${startLabel}–${endLabel}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function minimumAge(ageLabel: string): number {
  const match = ageLabel.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function ageAppropriate(game: Game, age: number): boolean {
  if (age <= 4) {
    return ["memory-match", "pattern-master", "guess-who", "daily-adventure-remix"].includes(game.slug)
      || game.subject === "Creativity"
      || game.subject === "Memory";
  }
  return age + 1 >= minimumAge(game.age);
}

function difficultyFor(mastery: number): string {
  if (mastery >= 78) return "Challenge";
  if (mastery >= 38) return "Skill Builder";
  return "Gentle Start";
}

function missionHref(game: Game, mastery: number, kind: WorldQuestMissionKind): string {
  const params = new URLSearchParams({ from: "world-quest", gate: kind });
  if (game.slug === "word-builder") {
    params.set("difficulty", mastery >= 78 ? "Hard" : mastery >= 38 ? "Medium" : "Easy");
  }
  if (game.slug === "math-blast") {
    params.set("difficulty", String(mastery >= 78 ? 5 : mastery >= 38 ? 3 : 1));
  }
  return `/games/${game.slug}?${params.toString()}`;
}

function completedThisWeek(progress: AdrianProgress, gameSlug: string, startIso: string, endIso: string): string | null {
  const completedAt = progress.games[gameSlug]?.lastCompleted ?? null;
  return completedAt && completedAt >= startIso && completedAt < endIso ? completedAt : null;
}

function sortedGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildWeeklyWorldQuest(
  profile: ChildProfile,
  games: Game[],
  progress: AdrianProgress,
  date = new Date(),
): WeeklyWorldQuest {
  const grade = readProfileGrade(profile);
  const theme = QUEST_THEMES[grade];
  const week = weekWindow(date);
  const seed = `${profile.id}:${week.key}:${grade}`;
  const settings = readLearningProfile(profile.id);
  const masteryRows = getSubjectMastery(profile.id, games, progress);
  const masteryMap = new Map(masteryRows.map((row) => [row.subject, row.mastery]));
  const allPlayable = sortedGames(games.filter((game) => game.status === "playable" && !EXCLUDED_MISSIONS.has(game.slug)));
  const ageMatched = allPlayable.filter((game) => ageAppropriate(game, profile.age));
  const pool = ageMatched.length >= 3 ? ageMatched : allPlayable;
  const selected = new Set<string>();

  function pick(candidates: Game[], salt: string): Game | undefined {
    const available = sortedGames(candidates.filter((game) => !selected.has(game.slug)));
    const picked = chooseStable(available, `${seed}:${salt}`);
    if (picked) selected.add(picked.slug);
    return picked;
  }

  const prioritySubjects = settings.priorities.length > 0 ? settings.priorities : FALLBACK_SUBJECTS;
  const prioritySubject = chooseStable(prioritySubjects, `${seed}:priority`) ?? "Math";
  const flagship = pool.find((game) => game.slug === FLAGSHIP_BY_GRADE[grade]);
  const powerGame = pick(pool.filter((game) => game.subject === prioritySubject), "power")
    ?? (flagship && !selected.has(flagship.slug) ? (selected.add(flagship.slug), flagship) : undefined)
    ?? pick(pool, "power-fallback");

  const interests = settings.interests.length > 0 ? settings.interests : [theme.defaultInterest];
  const interest = chooseStable(interests, `${seed}:interest`) ?? theme.defaultInterest;
  const wonderGame = pick(pool.filter((game) => interestMatch(game, [interest]) === interest), "wonder")
    ?? pick(pool.filter((game) => game.subject !== powerGame?.subject), "wonder-fallback")
    ?? pick(pool, "wonder-any");

  const wildcardGame = pick(
    pool.filter((game) => game.subject !== powerGame?.subject && game.subject !== wonderGame?.subject),
    "wildcard",
  ) ?? pick(pool, "wildcard-fallback");

  const missionGames = [powerGame, wonderGame, wildcardGame].filter((game): game is Game => Boolean(game));
  const kinds: WorldQuestMissionKind[] = ["power", "wonder", "wildcard"];
  const eyebrows = ["POWER GATE", "WONDER GATE", "WILDCARD GATE"];

  const missions = missionGames.map((game, index): WorldQuestMission => {
    const mastery = masteryMap.get(game.subject) ?? 0;
    const completedAt = completedThisWeek(progress, game.slug, week.startIso, week.endIso);
    const kind = kinds[index] ?? "wildcard";
    const reason = kind === "power"
      ? `${game.subject} is a parent priority this week. ${difficultyFor(mastery)} mode is ready.`
      : kind === "wonder"
        ? `${interest} is one of ${profile.name}'s curiosity signals, woven into a real learning mission.`
        : `A different ${game.subject} world keeps the quest broad, surprising, and connected.`;
    return {
      id: `${week.key}:${kind}:${game.slug}`,
      kind,
      eyebrow: eyebrows[index] ?? "WORLD GATE",
      title: game.title,
      reason,
      gameSlug: game.slug,
      href: missionHref(game, mastery, kind),
      emoji: game.emoji,
      subject: game.subject,
      difficulty: difficultyFor(mastery),
      completed: Boolean(completedAt),
      completedAt,
    };
  });

  const completedMissions = missions.filter((mission) => mission.completed).length;
  const bossUnlocked = missions.length === 3 && completedMissions === 3;
  const latestMissionCompletion = missions
    .map((mission) => mission.completedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const bossGame = games.find((game) => game.slug === WORLD_QUEST_BOSS_SLUG);
  const bossCompletedAt = completedThisWeek(progress, WORLD_QUEST_BOSS_SLUG, week.startIso, week.endIso);
  const bossCompleted = Boolean(
    bossUnlocked
      && bossCompletedAt
      && latestMissionCompletion
      && bossCompletedAt >= latestMissionCompletion,
  );

  return {
    weekKey: week.key,
    weekLabel: week.label,
    grade,
    theme,
    story: STORY_BEATS[hashNumber(`${seed}:story`) % STORY_BEATS.length],
    missions,
    completedMissions,
    bossUnlocked,
    bossCompleted,
    bossTitle: bossGame?.title ?? "Adaptive Boss Arena",
    bossEmoji: bossGame?.emoji ?? "👑",
    bossHref: `/games/${WORLD_QUEST_BOSS_SLUG}?from=world-quest&gate=boss`,
    progressPercent: Math.round((completedMissions / 3) * 75 + (bossCompleted ? 25 : 0)),
    nextMission: missions.find((mission) => !mission.completed) ?? null,
  };
}
