"use client";

import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
  type SkillProgress,
} from "@/lib/adrian-learning";

export type PlacementDomain = "Math" | "Reading" | "Science" | "Memory" | "Logic";
export type PlacementSubject = PlacementDomain;

export type PlacementAnswer = {
  questionId: string;
  domain: PlacementDomain;
  skillId: string;
  skillLabel: string;
  subject: PlacementSubject;
  level: 1 | 2 | 3;
  correct: boolean;
};

export type PlacementPlanDay = {
  day: number;
  skillId: string;
  minutes: number;
  activity: "learn" | "practice" | "review";
};

export type PlacementReport = {
  completedAt: string;
  age: number;
  durationSeconds: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  strengths: string[];
  building: string[];
  nextSkillId: string | null;
  planSkillIds: string[];
  recommendedMinutes: number;
  plan: PlacementPlanDay[];
};

type SkillInfo = {
  label: string;
  subject: PlacementSubject;
  prerequisites: string[];
};

const SKILLS: Record<string, SkillInfo> = {
  "memory-matching": { label: "Visual matching", subject: "Memory", prerequisites: [] },
  "memory-working-memory": { label: "Working memory", subject: "Memory", prerequisites: ["memory-matching"] },
  "logic-patterns": { label: "Recognizing patterns", subject: "Logic", prerequisites: [] },
  "logic-multi-step": { label: "Multi-step reasoning", subject: "Logic", prerequisites: ["logic-patterns"] },
  "math-addition": { label: "Addition", subject: "Math", prerequisites: [] },
  "math-subtraction": { label: "Subtraction", subject: "Math", prerequisites: ["math-addition"] },
  "math-money": { label: "Money math", subject: "Math", prerequisites: ["math-addition"] },
  "reading-spelling-easy": { label: "Short-word spelling", subject: "Reading", prerequisites: [] },
  "reading-spelling-medium": { label: "Medium-word spelling", subject: "Reading", prerequisites: ["reading-spelling-easy"] },
  "reading-spelling-hard": { label: "Advanced spelling", subject: "Reading", prerequisites: ["reading-spelling-medium"] },
  "science-earth": { label: "Earth science", subject: "Science", prerequisites: [] },
  "science-body": { label: "Human body", subject: "Science", prerequisites: [] },
  "science-space": { label: "Space science", subject: "Science", prerequisites: [] },
  "science-technology": { label: "Technology systems", subject: "Science", prerequisites: [] },
};

export const PLACEMENT_EVENT = "adrianos-placement-updated";
const REPORT_ID = "placement-report";
const REPORT_GAME_SLUG = "placement-adventure-report";
const GOAL_GAME_SLUG = "adrianos-skill-goal";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseStringArray(value: string | number | boolean | undefined): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parsePlan(value: string | number | boolean | undefined): PlacementPlanDay[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const plan: PlacementPlanDay[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const skillId = typeof row.skillId === "string" ? row.skillId : "";
      if (!skillId) continue;
      const activity: PlacementPlanDay["activity"] =
        row.activity === "practice" || row.activity === "review" ? row.activity : "learn";
      plan.push({
        day: typeof row.day === "number" ? row.day : plan.length + 1,
        skillId,
        minutes: typeof row.minutes === "number" ? row.minutes : 10,
        activity,
      });
    }
    return plan;
  } catch {
    return [];
  }
}

function reportFromItem(item: ReviewItem | undefined): PlacementReport | null {
  if (!item || item.gameSlug !== REPORT_GAME_SLUG || item.data?.placementReport !== true) return null;
  const data = item.data;
  return {
    completedAt: typeof data.completedAt === "string" ? data.completedAt : item.updatedAt,
    age: typeof data.age === "number" ? data.age : 7,
    durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : 0,
    totalQuestions: typeof data.totalQuestions === "number" ? data.totalQuestions : 0,
    correctAnswers: typeof data.correctAnswers === "number" ? data.correctAnswers : 0,
    accuracy: typeof data.accuracy === "number" ? data.accuracy : 0,
    strengths: parseStringArray(data.strengthsJson),
    building: parseStringArray(data.buildingJson),
    nextSkillId: typeof data.nextSkillId === "string" && data.nextSkillId ? data.nextSkillId : null,
    planSkillIds: parseStringArray(data.planSkillIdsJson),
    recommendedMinutes: typeof data.recommendedMinutes === "number" ? data.recommendedMinutes : 12,
    plan: parsePlan(data.planJson),
  };
}

export function readPlacementReport(profileId: string): PlacementReport | null {
  const state = readLearningForProfile(profileId);
  return reportFromItem(state.reviewQueue.find((item) => item.id === REPORT_ID));
}

export function hasCompletedPlacement(profileId: string): boolean {
  return readPlacementReport(profileId) !== null;
}

function answerSignal(answer: PlacementAnswer): number {
  if (answer.correct) {
    if (answer.level === 3) return 89;
    if (answer.level === 2) return 74;
    return 58;
  }
  if (answer.level === 3) return 48;
  if (answer.level === 2) return 34;
  return 18;
}

function answerWeight(answer: PlacementAnswer): number {
  return answer.level === 3 ? 5 : answer.level === 2 ? 4 : 3;
}

function mergeEvidence(previous: SkillProgress | undefined, rows: PlacementAnswer[]): SkillProgress {
  const first = rows[0];
  let weightedScore = 0;
  let totalWeight = 0;
  let correctAnswers = 0;
  for (const answer of rows) {
    const weight = answerWeight(answer);
    weightedScore += answerSignal(answer) * weight;
    totalWeight += weight;
    if (answer.correct) correctAnswers += 1;
  }
  const placementMastery = Math.round(weightedScore / Math.max(1, totalWeight));
  const now = new Date().toISOString();

  if (!previous || previous.attempts === 0) {
    const attempts = Math.max(totalWeight, rows.length);
    return {
      id: first.skillId,
      label: first.skillLabel,
      subject: first.subject,
      attempts,
      correct: clamp(Math.round((placementMastery / 100) * attempts), 0, attempts),
      streak: correctAnswers === rows.length ? rows.length : 0,
      mastery: placementMastery,
      lastPracticed: now,
    };
  }

  const combinedWeight = previous.attempts + totalWeight;
  return {
    ...previous,
    label: first.skillLabel,
    subject: first.subject,
    attempts: previous.attempts + rows.length,
    correct: clamp(previous.correct + correctAnswers, 0, previous.attempts + rows.length),
    streak: correctAnswers === rows.length ? previous.streak + rows.length : 0,
    mastery: Math.round(
      (previous.mastery * previous.attempts + placementMastery * totalWeight) /
        Math.max(1, combinedWeight)
    ),
    lastPracticed: now,
  };
}

function inferPrerequisites(skills: Record<string, SkillProgress>): Record<string, SkillProgress> {
  const next: Record<string, SkillProgress> = { ...skills };
  for (const [skillId, skill] of Object.entries(skills)) {
    if (skill.mastery < 70) continue;
    const info = SKILLS[skillId];
    if (!info) continue;
    for (const prerequisiteId of info.prerequisites) {
      const prerequisiteInfo = SKILLS[prerequisiteId];
      if (!prerequisiteInfo) continue;
      const previous = next[prerequisiteId];
      const mastery = Math.min(82, Math.max(58, skill.mastery - 14));
      if (previous && previous.mastery >= mastery) continue;
      const attempts = Math.max(previous?.attempts ?? 0, 4);
      next[prerequisiteId] = {
        id: prerequisiteId,
        label: prerequisiteInfo.label,
        subject: prerequisiteInfo.subject,
        attempts,
        correct: Math.round((mastery / 100) * attempts),
        streak: previous?.streak ?? 0,
        mastery,
        lastPracticed: skill.lastPracticed,
      };
    }
  }
  return next;
}

function choosePlanSkills(skills: Record<string, SkillProgress>, profile: ChildProfile): string[] {
  const preferred = Object.values(skills)
    .filter((skill) => skill.mastery < 80)
    .sort((a, b) => a.mastery - b.mastery)
    .map((skill) => skill.id);
  const fallback = profile.age <= 4
    ? ["memory-matching", "logic-patterns", "math-addition"]
    : ["math-addition", "reading-spelling-easy", "science-earth", "memory-working-memory", "logic-multi-step"];
  const candidates = [...preferred, ...fallback];
  const subjects = new Set<PlacementSubject>();
  const selected: string[] = [];

  for (const skillId of candidates) {
    const info = SKILLS[skillId];
    if (!info || subjects.has(info.subject) || selected.includes(skillId)) continue;
    subjects.add(info.subject);
    selected.push(skillId);
    if (selected.length >= 3) break;
  }
  return selected;
}

function makePlan(skillIds: string[], minutes: number): PlacementPlanDay[] {
  const ids = skillIds.length > 0 ? skillIds : ["math-addition"];
  const plan: PlacementPlanDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    plan.push({
      day: index + 1,
      skillId: ids[index % ids.length],
      minutes,
      activity: index === 6 ? "review" : index >= 3 ? "practice" : "learn",
    });
  }
  return plan;
}

function goalItem(skillId: string, completedAt: string): ReviewItem | null {
  const info = SKILLS[skillId];
  if (!info) return null;
  const due = new Date(new Date(completedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueDate = due.toISOString().slice(0, 10);
  return {
    id: `goal:${skillId}`,
    gameSlug: GOAL_GAME_SLUG,
    skillId,
    subject: info.subject,
    prompt: `Placement goal: ${info.label}`,
    correctAnswer: "",
    dueAt: `${dueDate}T23:59:59.999Z`,
    updatedAt: completedAt,
    successes: 0,
    status: "resolved",
    data: {
      goal: true,
      targetMastery: 80,
      dueDate,
      createdAt: completedAt,
    },
  };
}

export function savePlacementReport(
  profile: ChildProfile,
  _progress: AdrianProgress,
  answers: PlacementAnswer[],
  durationSeconds: number
): PlacementReport {
  const current = readLearningForProfile(profile.id);
  const groups = new Map<string, PlacementAnswer[]>();
  for (const answer of answers) {
    const rows = groups.get(answer.skillId) ?? [];
    rows.push(answer);
    groups.set(answer.skillId, rows);
  }

  const seeded: Record<string, SkillProgress> = { ...current.skills };
  for (const [skillId, rows] of groups.entries()) {
    seeded[skillId] = mergeEvidence(seeded[skillId], rows);
  }
  const skills = inferPrerequisites(seeded);
  const planSkillIds = choosePlanSkills(skills, profile);
  const nextSkillId = planSkillIds[0] ?? null;
  const tested = Object.values(skills).filter((skill) => groups.has(skill.id));
  const strengths = tested
    .filter((skill) => skill.mastery >= 70)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 4)
    .map((skill) => skill.id);
  const building = tested
    .filter((skill) => skill.mastery < 70)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4)
    .map((skill) => skill.id);
  const recommendedMinutes = profile.age <= 4 ? 8 : profile.age <= 8 ? 12 : 15;
  const correctAnswers = answers.filter((answer) => answer.correct).length;
  const accuracy = answers.length > 0 ? Math.round((correctAnswers / answers.length) * 100) : 0;
  const completedAt = new Date().toISOString();
  const plan = makePlan(planSkillIds, recommendedMinutes);

  const report: PlacementReport = {
    completedAt,
    age: profile.age,
    durationSeconds: Math.max(0, Math.round(durationSeconds)),
    totalQuestions: answers.length,
    correctAnswers,
    accuracy,
    strengths,
    building,
    nextSkillId,
    planSkillIds,
    recommendedMinutes,
    plan,
  };

  const reportItem: ReviewItem = {
    id: REPORT_ID,
    gameSlug: REPORT_GAME_SLUG,
    skillId: nextSkillId ?? "placement-starting-map",
    subject: nextSkillId && SKILLS[nextSkillId] ? SKILLS[nextSkillId].subject : "Logic",
    prompt: `${profile.name} placement starting map`,
    correctAnswer: "",
    dueAt: completedAt,
    updatedAt: completedAt,
    successes: 0,
    status: "resolved",
    data: {
      placementReport: true,
      completedAt,
      age: profile.age,
      durationSeconds: report.durationSeconds,
      totalQuestions: report.totalQuestions,
      correctAnswers,
      accuracy,
      strengthsJson: JSON.stringify(strengths),
      buildingJson: JSON.stringify(building),
      nextSkillId: nextSkillId ?? "",
      planSkillIdsJson: JSON.stringify(planSkillIds),
      recommendedMinutes,
      planJson: JSON.stringify(plan),
    },
  };

  const placementGoals = planSkillIds
    .slice(0, 2)
    .map((skillId) => goalItem(skillId, completedAt))
    .filter((item): item is ReviewItem => item !== null);
  const replaceIds = new Set<string>([REPORT_ID, ...placementGoals.map((item) => item.id)]);

  writeLearningForProfile(profile.id, {
    ...current,
    skills,
    dailyAdventure: null,
    reviewQueue: [
      ...current.reviewQueue.filter((item) => !replaceIds.has(item.id)),
      reportItem,
      ...placementGoals,
    ].slice(-100),
  });

  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLACEMENT_EVENT));
  return report;
}

export function skillLabel(skillId: string): string {
  return SKILLS[skillId]?.label ?? skillId;
}
