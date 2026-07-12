"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import type { SkillNode } from "@/lib/adrian-skill-graph";
import {
  curriculumPriorityForSkill,
  primaryStandardForSkill,
} from "@/lib/adrian-curriculum";
import {
  elementaryMilestoneForSkill,
  elementaryPriorityForSkill,
} from "@/lib/adrian-elementary-path";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";

export function getCurriculumRecommendedSkill(
  profile: Pick<ChildProfile, "id" | "age">,
  nodes: SkillNode[]
): SkillNode | null {
  const available = nodes.filter((node) => !node.locked && node.stage !== "Mastered");
  const activeGoal = available
    .filter((node) => node.goal && !node.goalComplete)
    .sort((a, b) => a.goal!.dueDate.localeCompare(b.goal!.dueDate))[0];
  if (activeGoal) return activeGoal;

  const review = available
    .filter((node) => node.dueReviews > 0)
    .sort((a, b) => b.dueReviews - a.dueReviews)[0];
  if (review) return review;

  const grade = readProfileGrade(profile);
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
