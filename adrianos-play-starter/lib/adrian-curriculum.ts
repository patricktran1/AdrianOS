import type { ChildProfile } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { readLearningForProfile } from "@/lib/adrian-learning";
import { ELEMENTARY_PRIORITY_STANDARDS } from "@/lib/adrian-grade-standards";

export type CurriculumFramework = "CA CCSS Math" | "CA CCSS ELA" | "CA NGSS" | "CA TK Foundations";
export type CurriculumStrength = "direct" | "supporting" | "enrichment";

export type CurriculumStandard = {
  code: string;
  framework: CurriculumFramework;
  grade: number;
  subject: "Math" | "Reading" | "Science";
  title: string;
  childGoal: string;
  skillIds: string[];
  strength: CurriculumStrength;
};

export type CurriculumSkillNode = {
  id: string;
  mastery: number;
  locked: boolean;
  stage: string;
};

// Detailed California Grade 2 pack created for Adrian's initial cohort.
const GRADE_TWO_STANDARDS: CurriculumStandard[] = [
  { code: "2.OA.A.1", framework: "CA CCSS Math", grade: 2, subject: "Math", title: "One- and two-step addition and subtraction problems", childGoal: "I can decide what a story problem is asking and solve it with addition or subtraction.", skillIds: ["math-word-problems"], strength: "direct" },
  { code: "2.OA.B.2", framework: "CA CCSS Math", grade: 2, subject: "Math", title: "Fluently add and subtract within 20", childGoal: "I can add and subtract within 20 accurately and explain a strategy.", skillIds: ["math-addition", "math-subtraction"], strength: "direct" },
  { code: "2.NBT.B.5", framework: "CA CCSS Math", grade: 2, subject: "Math", title: "Add and subtract within 100 using place-value strategies", childGoal: "I can use tens, ones, and number relationships to add and subtract within 100.", skillIds: ["math-addition", "math-subtraction", "math-place-value"], strength: "direct" },
  { code: "2.MD.C.8", framework: "CA CCSS Math", grade: 2, subject: "Math", title: "Solve money word problems", childGoal: "I can combine coins and solve everyday money problems.", skillIds: ["math-money"], strength: "direct" },
  { code: "2.G.A.1", framework: "CA CCSS Math", grade: 2, subject: "Math", title: "Recognize and draw shapes by their attributes", childGoal: "I can name and draw shapes using sides, angles, and faces.", skillIds: ["math-geometry"], strength: "direct" },
  { code: "RL.2.1", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Ask and answer questions about story details", childGoal: "I can use details from a story to answer who, what, where, when, why, and how questions.", skillIds: ["reading-comprehension-detail", "reading-inference"], strength: "direct" },
  { code: "RL.2.5", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Describe how a story is organized", childGoal: "I can explain how the beginning starts a story and how the ending finishes it.", skillIds: ["reading-sequencing"], strength: "direct" },
  { code: "RI.2.1", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Ask and answer questions about informational text", childGoal: "I can find key facts in a nonfiction passage and use them in my answer.", skillIds: ["reading-comprehension-detail"], strength: "direct" },
  { code: "RI.2.3", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Connect events, ideas, and steps", childGoal: "I can explain how events, scientific ideas, or steps in a process connect.", skillIds: ["reading-sequencing", "science-earth", "science-technology"], strength: "supporting" },
  { code: "L.2.4", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Determine word meaning using context and word parts", childGoal: "I can use the sentence, prefixes, roots, and compound words to figure out a new word.", skillIds: ["reading-vocabulary", "reading-spelling-medium"], strength: "direct" },
  { code: "L.2.2", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Use grade-level capitalization, punctuation, and spelling", childGoal: "I can edit my writing for capitals, punctuation, and spelling patterns.", skillIds: ["writing-conventions", "reading-spelling-medium"], strength: "direct" },
  { code: "W.2.3", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Write a sequenced narrative with details", childGoal: "I can write events in order, add details, use time words, and create an ending.", skillIds: ["writing-ideas", "writing-sentences", "writing-organization"], strength: "direct" },
  { code: "W.2.5", framework: "CA CCSS ELA", grade: 2, subject: "Reading", title: "Strengthen writing by revising and editing", childGoal: "I can reread a draft and make one meaningful improvement.", skillIds: ["writing-revision", "writing-conventions"], strength: "direct" },
  { code: "2-PS1-1", framework: "CA NGSS", grade: 2, subject: "Science", title: "Describe and classify materials by observable properties", childGoal: "I can compare materials and choose properties that make them useful for a job.", skillIds: ["engineering-materials"], strength: "direct" },
  { code: "2-LS4-1", framework: "CA NGSS", grade: 2, subject: "Science", title: "Compare the diversity of life in different habitats", childGoal: "I can observe and compare the plants and animals that live in different places.", skillIds: ["environment-ecosystems", "geography-places-regions"], strength: "supporting" },
  { code: "2-ESS1-1", framework: "CA NGSS", grade: 2, subject: "Science", title: "Use evidence to compare fast and slow Earth events", childGoal: "I can use evidence to explain that some Earth changes happen quickly and others happen slowly.", skillIds: ["science-earth"], strength: "supporting" },
  { code: "2-ESS2-2", framework: "CA NGSS", grade: 2, subject: "Science", title: "Develop a model of land and bodies of water", childGoal: "I can use a map or model to show landforms and bodies of water.", skillIds: ["geography-land-water", "geography-map-skills"], strength: "direct" },
  { code: "K-2-ETS1-3", framework: "CA NGSS", grade: 2, subject: "Science", title: "Compare solutions using evidence from tests", childGoal: "I can test two designs, compare what happened, and explain which parts worked best.", skillIds: ["engineering-iteration", "engineering-structures", "engineering-materials"], strength: "direct" },
];

// Focused, playable priority packs for every supported elementary grade.
// Standards are not the same as a complete curriculum: the app states whether a link is direct evidence or supporting practice.
export const CURRICULUM_STANDARDS: CurriculumStandard[] = [
  ...ELEMENTARY_PRIORITY_STANDARDS,
  ...GRADE_TWO_STANDARDS,
].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject) || a.code.localeCompare(b.code));

export function standardsForGrade(grade: number): CurriculumStandard[] {
  return CURRICULUM_STANDARDS.filter((standard) => standard.grade === grade);
}

export function standardsForSkill(skillId: string, grade?: number): CurriculumStandard[] {
  return CURRICULUM_STANDARDS.filter(
    (standard) => standard.skillIds.includes(skillId) && (grade === undefined || standard.grade === grade)
  );
}

export function primaryStandardForSkill(skillId: string, grade: number): CurriculumStandard | null {
  const matches = standardsForSkill(skillId, grade);
  return matches.find((standard) => standard.strength === "direct") ?? matches[0] ?? null;
}

export function curriculumPriorityForSkill(skillId: string, grade: number): number {
  const matches = standardsForSkill(skillId, grade);
  if (matches.some((standard) => standard.strength === "direct")) return 0;
  if (matches.some((standard) => standard.strength === "supporting")) return 1;
  if (matches.some((standard) => standard.strength === "enrichment")) return 2;
  return 3;
}

export function curriculumProgress(
  grade: number,
  nodes: CurriculumSkillNode[],
  profileId?: string,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (profileId && typeof window !== "undefined") {
    const learning = readLearningForProfile(profileId);
    for (const [id, skill] of Object.entries(learning.skills)) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          mastery: skill.mastery,
          locked: false,
          stage: skill.mastery >= 85 ? "Mastered" : skill.mastery >= 55 ? "Practicing" : "Exploring",
        });
      }
    }
  }

  return standardsForGrade(grade).map((standard) => {
    const evidence = standard.skillIds.map((id) => byId.get(id)).filter(Boolean) as CurriculumSkillNode[];
    const mastery = evidence.length > 0
      ? Math.round(evidence.reduce((sum, node) => sum + node.mastery, 0) / evidence.length)
      : 0;
    return {
      ...standard,
      mastery,
      available: evidence.some((node) => !node.locked),
      mastered: mastery >= 85,
    };
  });
}

export function curriculumPackLabel(profile: Pick<ChildProfile, "id" | "age">): string {
  const grade = readProfileGrade(profile);
  return grade < 0 ? "California TK priority foundations" : `California ${gradeLabel(grade)} priority standards`;
}
