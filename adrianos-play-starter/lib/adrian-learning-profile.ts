"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";
import type { Game } from "@/lib/games";

export type LearnerInterest =
  | "Animals"
  | "Space"
  | "Dinosaurs"
  | "Music"
  | "Building"
  | "Human Body"
  | "Nature"
  | "Technology"
  | "Stories"
  | "Art";

export type LearningPriority = Extract<
  Game["subject"],
  "Math" | "Reading" | "Science" | "Logic" | "Creativity" | "Memory"
>;

export type LearningProfileSettings = {
  configured: boolean;
  interests: LearnerInterest[];
  priorities: LearningPriority[];
  sessionMinutes: 8 | 12 | 18;
  updatedAt: string | null;
};

export const LEARNER_INTERESTS: LearnerInterest[] = [
  "Animals",
  "Space",
  "Dinosaurs",
  "Music",
  "Building",
  "Human Body",
  "Nature",
  "Technology",
  "Stories",
  "Art",
];

export const LEARNING_PRIORITIES: LearningPriority[] = [
  "Math",
  "Reading",
  "Science",
  "Logic",
  "Creativity",
  "Memory",
];

export const SESSION_LENGTHS = [
  { value: 8 as const, label: "8 minutes · quick start" },
  { value: 12 as const, label: "12 minutes · balanced" },
  { value: 18 as const, label: "18 minutes · deeper practice" },
];

const ITEM_ID = "learner-profile-settings";
const GAME_SLUG = "adrianos-learning-profile";

const EMPTY_SETTINGS: LearningProfileSettings = {
  configured: false,
  interests: [],
  priorities: [],
  sessionMinutes: 12,
  updatedAt: null,
};

function parseStringArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is T => typeof item === "string" && allowed.includes(item as T));
  } catch {
    return [];
  }
}

export function readLearningProfile(profileId: string): LearningProfileSettings {
  const state = readLearningForProfile(profileId);
  const item = state.reviewQueue.find((row) => row.id === ITEM_ID && row.gameSlug === GAME_SLUG);
  if (!item || item.data?.learnerProfile !== true) return { ...EMPTY_SETTINGS };
  const rawMinutes = item.data.sessionMinutes;
  const sessionMinutes: 8 | 12 | 18 = rawMinutes === 8 || rawMinutes === 18 ? rawMinutes : 12;
  return {
    configured: true,
    interests: parseStringArray(item.data.interestsJson, LEARNER_INTERESTS),
    priorities: parseStringArray(item.data.prioritiesJson, LEARNING_PRIORITIES),
    sessionMinutes,
    updatedAt: typeof item.data.updatedAt === "string" ? item.data.updatedAt : item.updatedAt,
  };
}

export function writeLearningProfile(
  profileId: string,
  settings: Pick<LearningProfileSettings, "interests" | "priorities" | "sessionMinutes">
): LearningProfileSettings {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const interests = [...new Set(settings.interests)].filter((item): item is LearnerInterest => LEARNER_INTERESTS.includes(item));
  const priorities = [...new Set(settings.priorities)].filter((item): item is LearningPriority => LEARNING_PRIORITIES.includes(item)).slice(0, 3);
  const sessionMinutes: 8 | 12 | 18 = settings.sessionMinutes === 8 || settings.sessionMinutes === 18 ? settings.sessionMinutes : 12;
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "learner-profile",
    subject: "Learning Skills",
    prompt: "Parent-selected learner interests and priorities",
    correctAnswer: "",
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
    data: {
      learnerProfile: true,
      interestsJson: JSON.stringify(interests),
      prioritiesJson: JSON.stringify(priorities),
      sessionMinutes,
      updatedAt: now,
    },
  };

  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [
      ...state.reviewQueue.filter((row) => !(row.id === ITEM_ID && row.gameSlug === GAME_SLUG)),
      item,
    ].slice(-100),
  });

  return { configured: true, interests, priorities, sessionMinutes, updatedAt: now };
}

export function interestMatch(game: Game, interests: LearnerInterest[]): LearnerInterest | null {
  const haystack = `${game.title} ${game.description} ${game.subject}`.toLowerCase();
  const terms: Record<LearnerInterest, string[]> = {
    Animals: ["animal", "wildlife", "pet"],
    Space: ["space", "planet", "solar", "rocket", "astronaut"],
    Dinosaurs: ["dinosaur", "fossil", "prehistoric"],
    Music: ["music", "melody", "rhythm", "sound"],
    Building: ["build", "engineering", "robot", "design", "structure"],
    "Human Body": ["body", "health", "organ", "brain"],
    Nature: ["nature", "earth", "weather", "environment", "plant", "ocean"],
    Technology: ["technology", "computer", "coding", "robot", "digital"],
    Stories: ["story", "reading", "word", "book", "writing"],
    Art: ["art", "draw", "color", "creative"],
  };
  return interests.find((interest) => terms[interest].some((term) => haystack.includes(term))) ?? null;
}
