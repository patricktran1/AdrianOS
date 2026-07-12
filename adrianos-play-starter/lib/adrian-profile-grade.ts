"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

const GRADE_GAME_SLUG = "adrianos-grade-profile";
const GRADE_ITEM_ID = "profile-grade";

export function inferredGradeForAge(age: number): number {
  if (age <= 4) return -1;
  if (age === 5) return 0;
  return Math.max(1, Math.min(12, Math.round(age) - 5));
}

export function gradeLabel(grade: number): string {
  if (grade < 0) return "Pre-K";
  if (grade === 0) return "Kindergarten";
  return `Grade ${grade}`;
}

export function readProfileGrade(profile: Pick<ChildProfile, "id" | "age">): number {
  if (typeof window === "undefined") return inferredGradeForAge(profile.age);
  const state = readLearningForProfile(profile.id);
  const item = state.reviewQueue.find(
    (row) => row.gameSlug === GRADE_GAME_SLUG && row.id === GRADE_ITEM_ID
  );
  const raw = item?.data?.grade;
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(-1, Math.min(12, Math.round(raw)))
    : inferredGradeForAge(profile.age);
}

export function writeProfileGrade(profileId: string, grade: number): number {
  const clean = Math.max(-1, Math.min(12, Math.round(grade)));
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: GRADE_ITEM_ID,
    gameSlug: GRADE_GAME_SLUG,
    skillId: "profile-grade",
    subject: "Learning Skills",
    prompt: "Parent-selected curriculum grade",
    correctAnswer: "",
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
    data: { grade: clean, profileSetting: true },
  };
  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [
      ...state.reviewQueue.filter(
        (row) => !(row.gameSlug === GRADE_GAME_SLUG && row.id === GRADE_ITEM_ID)
      ),
      item,
    ].slice(-100),
  });
  return clean;
}

export const GRADE_OPTIONS = [
  { value: -1, label: "Pre-K" },
  { value: 0, label: "Kindergarten" },
  ...Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Grade ${index + 1}` })),
] as const;
