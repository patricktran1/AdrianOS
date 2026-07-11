"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import type { AdrianProgress } from "@/lib/adrian-progress";
import { getActiveProfile, type ChildProfile } from "@/lib/adrian-profiles";

export type LearningStage = "Learning" | "Practicing" | "Mastered";

export type SkillProgress = {
  id: string;
  label: string;
  subject: Game["subject"];
  attempts: number;
  correct: number;
  streak: number;
  mastery: number;
  lastPracticed: string | null;
};

export type ReviewItem = {
  id: string;
  gameSlug: string;
  skillId: string;
  subject: Game["subject"];
  prompt: string;
  correctAnswer: string;
  data?: Record<string, string | number | boolean>;
  dueAt: string;
  updatedAt: string;
  successes: number;
  status: "due" | "resolved";
};

export type AdventureItem = {
  id: string;
  kind: "review" | "skill" | "explore";
  gameSlug: string;
  title: string;
  reason: string;
  difficulty: string;
  href: string;
  baselinePlays: number;
};

export type DailyAdventure = {
  date: string;
  items: AdventureItem[];
};

export type LearningState = {
  version: 1;
  updatedAt: string;
  skills: Record<string, SkillProgress>;
  reviewQueue: ReviewItem[];
  dailyAdventure: DailyAdventure | null;
};

export type LearningAttempt = {
  gameSlug: string;
  subject: Game["subject"];
  skillId: string;
  skillLabel: string;
  prompt: string;
  correctAnswer: string;
  correct: boolean;
  review?: boolean;
  data?: Record<string, string | number | boolean>;
};

export type SubjectMastery = {
  subject: Game["subject"];
  mastery: number;
  stage: LearningStage;
  attempts: number;
  correct: number;
  gamesPlayed: number;
};

const STORAGE_PREFIX = "adrianos-learning-v1:";
const LEARNING_EVENT = "adrianos-learning-updated";
const FAMILY_EVENT = "adrianos-family-updated";
const PROGRESS_EVENT = "adrianos-progress-updated";

const EMPTY_STATE: LearningState = {
  version: 1,
  updatedAt: "1970-01-01T00:00:00.000Z",
  skills: {},
  reviewQueue: [],
  dailyAdventure: null,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeSkill(value: unknown, id: string): SkillProgress | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SkillProgress>;
  const subject = typeof raw.subject === "string" ? raw.subject as Game["subject"] : "Logic";
  const attempts = Math.max(0, safeNumber(raw.attempts));
  const correct = clamp(safeNumber(raw.correct), 0, attempts);
  return {
    id,
    label: typeof raw.label === "string" && raw.label ? raw.label : id,
    subject,
    attempts,
    correct,
    streak: Math.max(0, safeNumber(raw.streak)),
    mastery: clamp(safeNumber(raw.mastery), 0, 100),
    lastPracticed: typeof raw.lastPracticed === "string" ? raw.lastPracticed : null,
  };
}

function normalizeReview(value: unknown): ReviewItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ReviewItem>;
  if (!raw.id || !raw.gameSlug || !raw.skillId || !raw.prompt) return null;
  return {
    id: String(raw.id),
    gameSlug: String(raw.gameSlug),
    skillId: String(raw.skillId),
    subject: (typeof raw.subject === "string" ? raw.subject : "Logic") as Game["subject"],
    prompt: String(raw.prompt),
    correctAnswer: typeof raw.correctAnswer === "string" ? raw.correctAnswer : "",
    data: raw.data && typeof raw.data === "object" ? raw.data : undefined,
    dueAt: typeof raw.dueAt === "string" ? raw.dueAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    successes: Math.max(0, safeNumber(raw.successes)),
    status: raw.status === "resolved" ? "resolved" : "due",
  };
}

function normalizeState(value: unknown): LearningState {
  if (!value || typeof value !== "object") return { ...EMPTY_STATE, skills: {}, reviewQueue: [] };
  const raw = value as Partial<LearningState>;
  const skills: Record<string, SkillProgress> = {};
  if (raw.skills && typeof raw.skills === "object") {
    for (const [id, value] of Object.entries(raw.skills)) {
      const skill = normalizeSkill(value, id);
      if (skill) skills[id] = skill;
    }
  }
  const reviewQueue = Array.isArray(raw.reviewQueue)
    ? raw.reviewQueue.map(normalizeReview).filter((item): item is ReviewItem => Boolean(item)).slice(-100)
    : [];
  const dailyAdventure = raw.dailyAdventure && typeof raw.dailyAdventure === "object"
    ? raw.dailyAdventure as DailyAdventure
    : null;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    skills,
    reviewQueue,
    dailyAdventure,
  };
}

function storageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${profileId}`;
}

export function readLearningForProfile(profileId: string): LearningState {
  if (typeof window === "undefined") return { ...EMPTY_STATE, skills: {}, reviewQueue: [] };
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    return raw ? normalizeState(JSON.parse(raw)) : { ...EMPTY_STATE, skills: {}, reviewQueue: [] };
  } catch {
    return { ...EMPTY_STATE, skills: {}, reviewQueue: [] };
  }
}

export function writeLearningForProfile(profileId: string, state: LearningState): LearningState {
  if (typeof window === "undefined") return state;
  const next = { ...state, version: 1 as const, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(storageKey(profileId), JSON.stringify(next));
  window.dispatchEvent(new Event(LEARNING_EVENT));
  return next;
}

export function stageForMastery(mastery: number, attempts = 0): LearningStage {
  if (mastery >= 80 && attempts >= 5) return "Mastered";
  if (mastery >= 42 || attempts >= 3) return "Practicing";
  return "Learning";
}

function calculateMastery(attempts: number, correct: number, streak: number): number {
  if (attempts <= 0) return 0;
  const accuracy = correct / attempts;
  const volume = Math.min(1, attempts / 12);
  const momentum = Math.min(1, streak / 5);
  return clamp(Math.round(accuracy * 62 + volume * 26 + momentum * 12), 0, 100);
}

export function recordLearningAttempt(
  attempt: LearningAttempt,
  profileId = getActiveProfile().id
): LearningState {
  const current = readLearningForProfile(profileId);
  const previous = current.skills[attempt.skillId] ?? {
    id: attempt.skillId,
    label: attempt.skillLabel,
    subject: attempt.subject,
    attempts: 0,
    correct: 0,
    streak: 0,
    mastery: 0,
    lastPracticed: null,
  };
  const attempts = previous.attempts + 1;
  const correct = previous.correct + (attempt.correct ? 1 : 0);
  const streak = attempt.correct ? previous.streak + 1 : 0;
  const now = new Date();
  const itemId = `${attempt.gameSlug}:${attempt.skillId}:${hashText(attempt.prompt)}`;
  const queue = [...current.reviewQueue];
  const existingIndex = queue.findIndex((item) => item.id === itemId);

  if (!attempt.correct) {
    const dueAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const item: ReviewItem = {
      id: itemId,
      gameSlug: attempt.gameSlug,
      skillId: attempt.skillId,
      subject: attempt.subject,
      prompt: attempt.prompt,
      correctAnswer: attempt.correctAnswer,
      data: attempt.data,
      dueAt,
      updatedAt: now.toISOString(),
      successes: 0,
      status: "due",
    };
    if (existingIndex >= 0) queue[existingIndex] = item;
    else queue.push(item);
  } else if (attempt.review && existingIndex >= 0) {
    const existing = queue[existingIndex];
    const successes = existing.successes + 1;
    queue[existingIndex] = {
      ...existing,
      successes,
      status: successes >= 2 ? "resolved" : "due",
      dueAt: successes >= 2
        ? existing.dueAt
        : new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  return writeLearningForProfile(profileId, {
    ...current,
    skills: {
      ...current.skills,
      [attempt.skillId]: {
        ...previous,
        label: attempt.skillLabel,
        subject: attempt.subject,
        attempts,
        correct,
        streak,
        mastery: calculateMastery(attempts, correct, streak),
        lastPracticed: now.toISOString(),
      },
    },
    reviewQueue: queue.slice(-100),
  });
}

export function getDueReviewItems(profileId: string, gameSlug?: string): ReviewItem[] {
  const now = new Date().toISOString();
  return readLearningForProfile(profileId).reviewQueue
    .filter((item) => item.status === "due" && item.dueAt <= now)
    .filter((item) => !gameSlug || item.gameSlug === gameSlug)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

function ageMinimum(ageLabel: string): number {
  const match = ageLabel.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function ageAppropriate(game: Game, age: number): boolean {
  if (age <= 4) {
    return ["memory-match", "music-maker", "guess-who", "pattern-master"].includes(game.slug)
      || game.subject === "Creativity"
      || game.subject === "Memory";
  }
  return age + 1 >= ageMinimum(game.age);
}

function subjectSignal(subject: Game["subject"], progress: AdrianProgress, games: Game[]): number {
  const relevant = games.filter((game) => game.subject === subject);
  if (relevant.length === 0) return 0;
  const values = relevant.map((game) => {
    const row = progress.games[game.slug];
    if (!row) return 0;
    return clamp(row.plays * 5 + row.completions * 14 + (row.bestScore > 0 ? 8 : 0), 0, 70);
  });
  return Math.round(values.reduce((sum, value) => sum + value, 0) / relevant.length);
}

export function getSubjectMastery(
  profileId: string,
  games: Game[],
  progress: AdrianProgress
): SubjectMastery[] {
  const state = readLearningForProfile(profileId);
  const subjects = Array.from(new Set(games.map((game) => game.subject)));
  return subjects.map((subject) => {
    const skills = Object.values(state.skills).filter((skill) => skill.subject === subject);
    const attempts = skills.reduce((sum, skill) => sum + skill.attempts, 0);
    const correct = skills.reduce((sum, skill) => sum + skill.correct, 0);
    const explicit = skills.length > 0
      ? Math.round(skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length)
      : 0;
    const broadSignal = subjectSignal(subject, progress, games);
    const mastery = skills.length > 0
      ? Math.round(explicit * 0.78 + broadSignal * 0.22)
      : broadSignal;
    const gamesPlayed = games
      .filter((game) => game.subject === subject)
      .filter((game) => (progress.games[game.slug]?.plays ?? 0) > 0).length;
    return {
      subject,
      mastery,
      stage: stageForMastery(mastery, attempts),
      attempts,
      correct,
      gamesPlayed,
    };
  }).sort((a, b) => a.mastery - b.mastery);
}

function difficultyFor(mastery: number): string {
  if (mastery >= 78) return "Challenge";
  if (mastery >= 38) return "Skill Builder";
  return "Gentle Start";
}

function gameHref(game: Game, mastery: number, review = false): string {
  const params = new URLSearchParams();
  if (review) params.set("review", "1");
  if (game.slug === "word-builder") {
    params.set("difficulty", mastery >= 78 ? "Hard" : mastery >= 38 ? "Medium" : "Easy");
  }
  if (game.slug === "math-blast") {
    params.set("difficulty", String(mastery >= 78 ? 5 : mastery >= 38 ? 3 : 1));
  }
  const query = params.toString();
  return `/games/${game.slug}${query ? `?${query}` : ""}`;
}

function preferredGame(
  games: Game[],
  candidates: string[],
  excluded: Set<string>
): Game | undefined {
  return candidates
    .map((slug) => games.find((game) => game.slug === slug && game.status === "playable"))
    .find((game): game is Game => Boolean(game && !excluded.has(game.slug)));
}

function createDailyAdventure(
  profile: ChildProfile,
  games: Game[],
  progress: AdrianProgress,
  state: LearningState
): DailyAdventure {
  const playable = games.filter((game) => game.status === "playable" && ageAppropriate(game, profile.age));
  const allPlayable = games.filter((game) => game.status === "playable");
  const pool = playable.length >= 3 ? playable : allPlayable;
  const masteryRows = getSubjectMastery(profile.id, games, progress);
  const masteryMap = new Map(masteryRows.map((row) => [row.subject, row.mastery]));
  const due = state.reviewQueue
    .filter((item) => item.status === "due" && item.dueAt <= new Date().toISOString())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const selected = new Set<string>();
  const items: AdventureItem[] = [];

  const addGame = (game: Game | undefined, kind: AdventureItem["kind"], reason: string, review = false) => {
    if (!game || selected.has(game.slug) || items.length >= 3) return;
    selected.add(game.slug);
    const mastery = masteryMap.get(game.subject) ?? 0;
    items.push({
      id: `${localDateKey()}:${kind}:${game.slug}`,
      kind,
      gameSlug: game.slug,
      title: game.title,
      reason,
      difficulty: review ? "Review" : difficultyFor(mastery),
      href: gameHref(game, mastery, review),
      baselinePlays: progress.games[game.slug]?.plays ?? 0,
    });
  };

  if (due.length > 0) {
    const reviewGame = pool.find((game) => game.slug === due[0].gameSlug)
      ?? allPlayable.find((game) => game.slug === due[0].gameSlug);
    const count = due.filter((item) => item.gameSlug === due[0].gameSlug).length;
    addGame(reviewGame, "review", `Bring back ${count} missed ${count === 1 ? "question" : "questions"}.`, true);
  }

  if (profile.age <= 4) {
    addGame(preferredGame(pool, ["memory-match", "pattern-master", "guess-who"], selected), "skill", "Build matching, attention, and patterns.");
    addGame(preferredGame(pool, ["music-maker", "human-body-explorer", "solar-system-explorer"], selected), "explore", "A short curiosity mission.");
  } else {
    for (const row of masteryRows) {
      if (items.length >= 2) break;
      const game = pool
        .filter((item) => item.subject === row.subject && !selected.has(item.slug))
        .sort((a, b) => (progress.games[a.slug]?.plays ?? 0) - (progress.games[b.slug]?.plays ?? 0))[0];
      addGame(game, "skill", `${row.subject} is ready for the next step.`);
    }
  }

  const funCandidates = ["memory-match", "robot-commands", "music-maker", "dinosaur-detective", "guess-who"];
  addGame(preferredGame(pool, funCandidates, selected), "explore", "Finish with a fun choice.");

  for (const game of pool) {
    addGame(game, items.length === 0 ? "skill" : "explore", items.length === 0 ? "Start today’s learning streak." : "Try something different.");
    if (items.length >= 3) break;
  }

  return { date: localDateKey(), items: items.slice(0, 3) };
}

export function ensureDailyAdventure(
  profile: ChildProfile,
  games: Game[],
  progress: AdrianProgress
): LearningState {
  const current = readLearningForProfile(profile.id);
  if (current.dailyAdventure?.date === localDateKey() && current.dailyAdventure.items.length > 0) {
    return current;
  }
  return writeLearningForProfile(profile.id, {
    ...current,
    dailyAdventure: createDailyAdventure(profile, games, progress, current),
  });
}

export function useLearningState(games: Game[], progress: AdrianProgress) {
  const [state, setState] = useState<LearningState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const profile = getActiveProfile();

  const refresh = useCallback(() => {
    const active = getActiveProfile();
    setState(ensureDailyAdventure(active, games, progress));
    setHydrated(true);
  }, [games, progress]);

  useEffect(() => {
    refresh();
    window.addEventListener(LEARNING_EVENT, refresh);
    window.addEventListener(FAMILY_EVENT, refresh);
    window.addEventListener(PROGRESS_EVENT, refresh);
    return () => {
      window.removeEventListener(LEARNING_EVENT, refresh);
      window.removeEventListener(FAMILY_EVENT, refresh);
      window.removeEventListener(PROGRESS_EVENT, refresh);
    };
  }, [refresh]);

  const mastery = useMemo(
    () => getSubjectMastery(profile.id, games, progress),
    [profile.id, games, progress, state.updatedAt]
  );
  const dueReviews = useMemo(
    () => state.reviewQueue.filter((item) => item.status === "due" && item.dueAt <= new Date().toISOString()),
    [state.reviewQueue]
  );

  return { state, hydrated, mastery, dueReviews, profile };
}
