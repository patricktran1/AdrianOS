"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  ELEMENTARY_GRADE_OPTIONS,
  elementaryGradeLabel,
  inferredElementaryGradeForAge,
  normalizeElementaryGrade,
  type ElementaryGrade,
} from "@/lib/adrian-elementary-scope";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

const GRADE_GAME_SLUG = "adrianos-grade-profile";
const GRADE_ITEM_ID = "profile-grade";

export function inferredGradeForAge(age: number): ElementaryGrade {
  return inferredElementaryGradeForAge(age);
}

export function gradeLabel(grade: number): string {
  return elementaryGradeLabel(grade);
}

export function readProfileGrade(profile: Pick<ChildProfile, "id" | "age">): ElementaryGrade {
  if (typeof window === "undefined") return inferredGradeForAge(profile.age);
  const state = readLearningForProfile(profile.id);
  const item = state.reviewQueue.find(
    (row) => row.gameSlug === GRADE_GAME_SLUG && row.id === GRADE_ITEM_ID
  );
  const raw = item?.data?.grade;
  return typeof raw === "number" && Number.isFinite(raw)
    ? normalizeElementaryGrade(raw, profile.age)
    : inferredGradeForAge(profile.age);
}

export function writeProfileGrade(profileId: string, grade: number): ElementaryGrade {
  const clean = normalizeElementaryGrade(grade);
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: GRADE_ITEM_ID,
    gameSlug: GRADE_GAME_SLUG,
    skillId: "profile-grade",
    subject: "Learning Skills",
    prompt: "Parent-selected elementary curriculum grade",
    correctAnswer: "",
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 0,
    status: "resolved",
    data: { grade: clean, profileSetting: true, elementaryScope: true },
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

export const GRADE_OPTIONS = ELEMENTARY_GRADE_OPTIONS;
