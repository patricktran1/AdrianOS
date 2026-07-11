"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type LearningDayMode = "full" | "light" | "free";
export type LearningDayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type LearningSchedule = {
  version: 1;
  days: Record<LearningDayKey, LearningDayMode>;
  fullMinutes: number;
  lightMinutes: number;
  schoolMode: boolean;
  libraryAfterSession: boolean;
  updatedAt: string;
};

export const LEARNING_SCHEDULE_EVENT = "adrianos-learning-schedule-updated";
const SCHEDULE_ITEM_ID = "learning-schedule";
const SCHEDULE_GAME_SLUG = "adrianos-learning-schedule";

const DAY_KEYS: LearningDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function defaultSchedule(): LearningSchedule {
  return {
    version: 1,
    days: {
      monday: "full",
      tuesday: "full",
      wednesday: "full",
      thursday: "full",
      friday: "full",
      saturday: "light",
      sunday: "free",
    },
    fullMinutes: 12,
    lightMinutes: 6,
    schoolMode: true,
    libraryAfterSession: true,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMode(value: unknown): LearningDayMode {
  return value === "light" || value === "free" ? value : "full";
}

function normalizeSchedule(value: unknown): LearningSchedule {
  const fallback = defaultSchedule();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<LearningSchedule>;
  const rawDays = raw.days && typeof raw.days === "object" ? raw.days as Partial<Record<LearningDayKey, LearningDayMode>> : {};
  const days = { ...fallback.days };
  for (const day of DAY_KEYS) days[day] = normalizeMode(rawDays[day]);
  return {
    version: 1,
    days,
    fullMinutes: typeof raw.fullMinutes === "number" ? Math.max(8, Math.min(30, Math.round(raw.fullMinutes))) : fallback.fullMinutes,
    lightMinutes: typeof raw.lightMinutes === "number" ? Math.max(3, Math.min(15, Math.round(raw.lightMinutes))) : fallback.lightMinutes,
    schoolMode: typeof raw.schoolMode === "boolean" ? raw.schoolMode : fallback.schoolMode,
    libraryAfterSession: typeof raw.libraryAfterSession === "boolean" ? raw.libraryAfterSession : fallback.libraryAfterSession,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : fallback.updatedAt,
  };
}

function parseSchedule(item: ReviewItem | undefined): LearningSchedule | null {
  if (!item || item.gameSlug !== SCHEDULE_GAME_SLUG) return null;
  const raw = item.data?.scheduleJson;
  if (typeof raw !== "string") return null;
  try {
    return normalizeSchedule(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readLearningSchedule(profileId: string): LearningSchedule {
  const state = readLearningForProfile(profileId);
  return parseSchedule(state.reviewQueue.find((item) => item.id === SCHEDULE_ITEM_ID)) ?? defaultSchedule();
}

export function writeLearningSchedule(profileId: string, schedule: LearningSchedule): LearningSchedule {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next = normalizeSchedule({ ...schedule, updatedAt: now });
  const item: ReviewItem = {
    id: SCHEDULE_ITEM_ID,
    gameSlug: SCHEDULE_GAME_SLUG,
    skillId: "weekly-learning-schedule",
    subject: "Logic",
    prompt: "Parent weekly learning schedule",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
    data: {
      learningSchedule: true,
      scheduleJson: JSON.stringify(next),
    },
  };
  const reviewQueue = state.reviewQueue.filter((row) => row.id !== SCHEDULE_ITEM_ID);
  writeLearningForProfile(profileId, { ...state, reviewQueue: [...reviewQueue, item].slice(-100) });
  window.dispatchEvent(new Event(LEARNING_SCHEDULE_EVENT));
  return next;
}

export function learningDayKey(date = new Date()): LearningDayKey {
  const keys: LearningDayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return keys[date.getDay()];
}

export function learningPlanForDate(profileId: string, date = new Date()): {
  mode: LearningDayMode;
  minutes: number;
  day: LearningDayKey;
} {
  const schedule = readLearningSchedule(profileId);
  const day = learningDayKey(date);
  const mode = schedule.days[day];
  return {
    mode,
    minutes: mode === "full" ? schedule.fullMinutes : mode === "light" ? schedule.lightMinutes : 8,
    day,
  };
}

export function dayLabel(day: LearningDayKey): string {
  return day[0].toUpperCase() + day.slice(1);
}
