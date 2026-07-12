"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import type { SkillNode } from "@/lib/adrian-skill-graph";
import { readLearningForProfile } from "@/lib/adrian-learning";
import {
  curriculumPriorityForSkill,
  primaryStandardForSkill,
  standardsForGrade,
} from "@/lib/adrian-curriculum";
import {
  elementaryMilestoneForSkill,
  elementaryPriorityForSkill,
} from "@/lib/adrian-elementary-path";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";

const NUMBER_QUEST_LABELS: Record<string, string> = {
  "math-counting": "Counting and quantity",
  "math-place-value": "Place value",
  "math-multiplication": "Multiplication",
  "math-division": "Division",
  "math-fractions": "Fractions",
  "math-decimals": "Decimals",
  "math-measurement": "Measurement",
  "math-geometry": "Geometry",
};

function numberQuestNodes(
  profile: Pick<ChildProfile, "id" | "age">,
  grade: number,
  existing: SkillNode[],
): SkillNode[] {
  const existingIds = new Set(existing.map((node) => node.id));
  const learning = readLearningForProfile(profile.id);
  const now = new Date().toISOString();
  const standards = standardsForGrade(grade);
  const descriptions = new Map<string, string>();
  for (const standard of standards) {
    for (const skillId of standard.skillIds) {
      if (NUMBER_QUEST_LABELS[skillId] && !descriptions.has(skillId)) descriptions.set(skillId, standard.childGoal);
    }
  }

  return [...descriptions.entries()]
    .filter(([id]) => !existingIds.has(id))
    .map(([id, description], index) => {
      const evidence = learning.skills[id];
      const mastery = evidence?.mastery ?? 0;
      const dueReviews = learning.reviewQueue.filter(
        (item) => item.skillId === id && item.status === "due" && item.dueAt <= now,
      ).length;
      return {
        id,
        label: NUMBER_QUEST_LABELS[id],
        subject: "Math",
        description,
        prerequisites: [],
        gameSlug: "number-quest",
        minAge: 4,
        order: 50 + index,
        evidenceSkillIds: [id],
        mastery,
        attempts: evidence?.attempts ?? 0,
        correct: evidence?.correct ?? 0,
        stage: mastery >= 85 ? "Mastered" : mastery >= 35 ? "Practicing" : "Learning",
        locked: false,
        dueReviews,
        goal: null,
        goalComplete: false,
      } satisfies SkillNode;
    });
}

export function getCurriculumRecommendedSkill(
  profile: Pick<ChildProfile, "id" | "age">,
  nodes: SkillNode[]
): SkillNode | null {
  const grade = readProfileGrade(profile);
  const expanded = [...nodes, ...numberQuestNodes(profile, grade, nodes)];
  const available = expanded.filter((node) => !node.locked && node.stage !== "Mastered");
  const activeGoal = available
    .filter((node) => node.goal && !node.goalComplete)
    .sort((a, b) => a.goal!.dueDate.localeCompare(b.goal!.dueDate))[0];
  if (activeGoal) return activeGoal;

  const review = available
    .filter((node) => node.dueReviews > 0)
    .sort((a, b) => b.dueReviews - a.dueReviews)[0];
  if (review) return review;

  return [...available].sort((a, b) => {
    const standards = curriculumPriorityForSkill(a.id, grade) - curriculumPriorityForSkill(b.id, grade);
    if (standards !== 0) return standards;
    const elementary = elementaryPriorityForSkill(a.id, grade) - elementaryPriorityForSkill(b.id, grade);
    if (elementary !== 0) return elementary;
    const mastery = a.mastery - b.mastery;
    if (mastery !== 0) return mastery;
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    return a.order - b.order;
  })[0] ?? null;
}

export function curriculumReasonForSkill(
  profile: Pick<ChildProfile, "id" | "age">,
  skillId: string
): string | null {
  const grade = readProfileGrade(profile);
  const standard = primaryStandardForSkill(skillId, grade);
  if (standard) {
    const evidence = standard.strength === "direct"
      ? "This activity collects practice evidence for"
      : "This activity builds background for";
    return `${evidence} ${standard.code}: ${standard.childGoal}`;
  }
  const milestone = elementaryMilestoneForSkill(skillId, grade);
  return milestone
    ? `${gradeLabel(grade)} Elementary Journey: ${milestone.childGoal}`
    : null;
}
