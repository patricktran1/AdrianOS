"use client";

import {
  exportFamilyBackup,
  importFamilyBackup,
  readFamilyState,
  type ChildProfile,
  type FamilyBackup,
  type FamilyState,
} from "@/lib/adrian-profiles";
import {
  inferredGradeForAge,
  readProfileGrade,
  writeProfileGrade,
} from "@/lib/adrian-profile-grade";
import {
  readLearningProfile,
  writeLearningProfile,
  type LearnerInterest,
  type LearningPriority,
} from "@/lib/adrian-learning-profile";

export type FamilyChildDraft = {
  id?: string;
  name: string;
  age: number;
  grade: number;
  emoji: string;
  interests: LearnerInterest[];
  priorities: LearningPriority[];
  sessionMinutes: 8 | 12 | 18;
};

const CUSTOMIZED_KEY = "adrianos-family-customized-v1";

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function cleanEmoji(value: string): string {
  return value.trim().slice(0, 8) || "⭐";
}

function cleanAge(value: number): number {
  return Number.isFinite(value) ? Math.max(3, Math.min(18, Math.round(value))) : 7;
}

function cleanGrade(value: number, age: number): number {
  return Number.isFinite(value)
    ? Math.max(-1, Math.min(12, Math.round(value)))
    : inferredGradeForAge(age);
}

function baseSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "student";
}

function uniqueId(name: string, used: Set<string>): string {
  const base = baseSlug(name);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function isValidExistingId(value: string | undefined, used: Set<string>): value is string {
  return Boolean(value && /^[a-z0-9-]{1,40}$/.test(value) && !used.has(value));
}

function keepProfileData(source: Record<string, unknown> | undefined, ids: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const id of ids) {
    if (source?.[id] && typeof source[id] === "object") result[id] = source[id];
  }
  return result;
}

function removeDeletedProfileStorage(deletedIds: string[]): void {
  if (typeof window === "undefined") return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith("adrianos-")) continue;
    if (deletedIds.some((id) => key.endsWith(`:${id}`))) window.localStorage.removeItem(key);
  }
}

export function isStarterFamilyState(family: FamilyState = readFamilyState()): boolean {
  if (typeof window !== "undefined" && window.localStorage.getItem(CUSTOMIZED_KEY) === "yes") return false;
  return family.profiles.length === 0;
}

export function currentFamilyDrafts(): FamilyChildDraft[] {
  return readFamilyState().profiles.map((profile) => {
    const learningProfile = readLearningProfile(profile.id);
    return {
      id: profile.id,
      name: profile.name,
      age: profile.age,
      grade: readProfileGrade(profile),
      emoji: profile.emoji,
      interests: learningProfile.interests,
      priorities: learningProfile.priorities,
      sessionMinutes: learningProfile.sessionMinutes,
    };
  });
}

export function replaceFamilyChildren(drafts: FamilyChildDraft[]): ChildProfile[] {
  const validDrafts = drafts
    .map((draft) => ({
      ...draft,
      name: cleanName(draft.name),
      age: cleanAge(draft.age),
      interests: Array.isArray(draft.interests) ? draft.interests : [],
      priorities: Array.isArray(draft.priorities) ? draft.priorities : [],
      sessionMinutes: draft.sessionMinutes === 8 || draft.sessionMinutes === 18 ? draft.sessionMinutes : 12,
    }))
    .filter((draft) => Boolean(draft.name));
  if (validDrafts.length === 0) throw new Error("Add at least one child profile.");

  const existing = exportFamilyBackup();
  const oldIds = new Set(existing.family.profiles.map((profile) => profile.id));
  const used = new Set<string>();
  const now = new Date().toISOString();
  const profiles: ChildProfile[] = validDrafts.map((draft) => {
    const id = isValidExistingId(draft.id, used) ? draft.id : uniqueId(draft.name, used);
    if (draft.id === id) used.add(id);
    const previous = existing.family.profiles.find((profile) => profile.id === id);
    return {
      id,
      name: draft.name,
      age: draft.age,
      emoji: cleanEmoji(draft.emoji),
      createdAt: previous?.createdAt ?? now,
    };
  });

  const ids = new Set(profiles.map((profile) => profile.id));
  const backup: FamilyBackup = {
    ...existing,
    exportedAt: now,
    family: {
      ...existing.family,
      profiles,
      activeProfileId: ids.has(existing.family.activeProfileId)
        ? existing.family.activeProfileId
        : profiles[0].id,
    },
    progressByProfile: keepProfileData(existing.progressByProfile, ids),
    hubByProfile: keepProfileData(existing.hubByProfile, ids),
    learningByProfile: keepProfileData(existing.learningByProfile, ids),
    coachByProfile: keepProfileData(existing.coachByProfile, ids),
  };

  const deletedIds = [...oldIds].filter((id) => !ids.has(id));
  removeDeletedProfileStorage(deletedIds);
  if (!importFamilyBackup(backup)) throw new Error("The family profiles could not be saved.");
  profiles.forEach((profile, index) => {
    const draft = validDrafts[index];
    writeProfileGrade(profile.id, cleanGrade(draft.grade, profile.age));
    writeLearningProfile(profile.id, {
      interests: draft.interests,
      priorities: draft.priorities,
      sessionMinutes: draft.sessionMinutes,
    });
  });
  window.localStorage.setItem(CUSTOMIZED_KEY, "yes");
  return profiles;
}
