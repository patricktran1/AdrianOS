import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import type { SkillNode } from "@/lib/adrian-skill-graph";

export type ElementaryMilestoneArea = "Math" | "Literacy" | "Writing" | "Science" | "Thinking";

export type ElementaryMilestone = {
  id: string;
  grade: ElementaryGrade;
  area: ElementaryMilestoneArea;
  title: string;
  childGoal: string;
  skillIds: string[];
};

export type ElementaryMilestoneProgress = ElementaryMilestone & {
  mastery: number;
  available: boolean;
  mastered: boolean;
  lowestSkill: SkillNode | null;
};

// These are AdrianOS product milestones, not a claim of complete standards coverage.
// Grade 2 also has a separate, explicit California standards pack in adrian-curriculum.ts.
export const ELEMENTARY_MILESTONES: ElementaryMilestone[] = [
  {
    id: "tk-count-match",
    grade: -1,
    area: "Math",
    title: "Match, sort, and notice quantity",
    childGoal: "I can match objects, notice which group has more, and explain a simple pattern.",
    skillIds: ["memory-matching", "logic-patterns"],
  },
  {
    id: "tk-story-ideas",
    grade: -1,
    area: "Literacy",
    title: "Talk about pictures and stories",
    childGoal: "I can describe what I notice and tell an idea in my own words.",
    skillIds: ["writing-ideas", "reading-spelling-easy"],
  },
  {
    id: "tk-make-create",
    grade: -1,
    area: "Writing",
    title: "Create and communicate an idea",
    childGoal: "I can choose an idea and share it with pictures, words, rhythm, or movement.",
    skillIds: ["writing-ideas", "creativity-rhythm"],
  },
  {
    id: "tk-world-noticing",
    grade: -1,
    area: "Science",
    title: "Observe the world closely",
    childGoal: "I can notice changes, describe what I see, and ask a useful question.",
    skillIds: ["geography-map-skills", "science-earth"],
  },
  {
    id: "tk-attention",
    grade: -1,
    area: "Thinking",
    title: "Build attention and working memory",
    childGoal: "I can remember a short direction and keep trying when a puzzle changes.",
    skillIds: ["memory-matching", "logic-patterns"],
  },
  {
    id: "k-number-stories",
    grade: 0,
    area: "Math",
    title: "Build early number stories",
    childGoal: "I can combine small groups and explain what happened to the total.",
    skillIds: ["math-addition", "logic-patterns"],
  },
  {
    id: "k-words-details",
    grade: 0,
    area: "Literacy",
    title: "Build words and find story details",
    childGoal: "I can build familiar words and answer a question using a story detail.",
    skillIds: ["reading-spelling-easy", "reading-comprehension-detail"],
  },
  {
    id: "k-sentences",
    grade: 0,
    area: "Writing",
    title: "Turn an idea into a sentence",
    childGoal: "I can say or write a complete thought about one clear idea.",
    skillIds: ["writing-ideas", "writing-sentences"],
  },
  {
    id: "k-land-water",
    grade: 0,
    area: "Science",
    title: "Describe land, water, and living things",
    childGoal: "I can describe features of a place and what living things need there.",
    skillIds: ["geography-land-water", "science-earth"],
  },
  {
    id: "k-follow-pattern",
    grade: 0,
    area: "Thinking",
    title: "Follow a pattern and remember steps",
    childGoal: "I can continue a pattern and hold two simple steps in mind.",
    skillIds: ["logic-patterns", "memory-working-memory"],
  },
  {
    id: "g1-add-subtract",
    grade: 1,
    area: "Math",
    title: "Add and subtract with meaning",
    childGoal: "I can use addition or subtraction to solve a small real-world problem.",
    skillIds: ["math-addition", "math-subtraction"],
  },
  {
    id: "g1-read-sequence",
    grade: 1,
    area: "Literacy",
    title: "Read details in order",
    childGoal: "I can find important details and put story events in order.",
    skillIds: ["reading-comprehension-detail", "reading-sequencing", "reading-spelling-medium"],
  },
  {
    id: "g1-write-clear",
    grade: 1,
    area: "Writing",
    title: "Write clear complete sentences",
    childGoal: "I can write a complete sentence with a capital letter and ending mark.",
    skillIds: ["writing-sentences", "writing-conventions"],
  },
  {
    id: "g1-earth-body",
    grade: 1,
    area: "Science",
    title: "Explain an observable system",
    childGoal: "I can describe how something on Earth or in the body changes or works.",
    skillIds: ["science-earth", "science-body"],
  },
  {
    id: "g1-two-step-thinking",
    grade: 1,
    area: "Thinking",
    title: "Reason through two connected steps",
    childGoal: "I can remember what happened first and use it to decide what comes next.",
    skillIds: ["memory-working-memory", "logic-multi-step"],
  },
  {
    id: "g2-problem-solving",
    grade: 2,
    area: "Math",
    title: "Solve addition, subtraction, and money problems",
    childGoal: "I can choose an operation, show my strategy, and check whether my answer makes sense.",
    skillIds: ["math-addition", "math-subtraction", "math-money", "math-word-problems"],
  },
  {
    id: "g2-read-understand",
    grade: 2,
    area: "Literacy",
    title: "Use details, sequence, and context",
    childGoal: "I can use passage evidence and nearby words to explain what a text means.",
    skillIds: ["reading-comprehension-detail", "reading-sequencing", "reading-vocabulary"],
  },
  {
    id: "g2-write-organize",
    grade: 2,
    area: "Writing",
    title: "Organize and improve a short piece",
    childGoal: "I can put ideas in order, use conventions, and make one meaningful revision.",
    skillIds: ["writing-sentences", "writing-conventions", "writing-organization", "writing-revision"],
  },
  {
    id: "g2-observe-design",
    grade: 2,
    area: "Science",
    title: "Use evidence to compare natural and designed systems",
    childGoal: "I can compare observations or tests and explain which evidence supports my idea.",
    skillIds: ["science-earth", "engineering-materials", "engineering-iteration"],
  },
  {
    id: "g2-connected-reasoning",
    grade: 2,
    area: "Thinking",
    title: "Keep track of connected clues",
    childGoal: "I can hold several clues in mind and explain the steps in my reasoning.",
    skillIds: ["logic-multi-step", "memory-working-memory"],
  },
  {
    id: "g3-multi-step-math",
    grade: 3,
    area: "Math",
    title: "Solve and explain multi-step math",
    childGoal: "I can break a problem into parts, choose operations, and explain my solution path.",
    skillIds: ["math-word-problems", "math-addition", "math-subtraction"],
  },
  {
    id: "g3-read-beyond",
    grade: 3,
    area: "Literacy",
    title: "Infer meaning from text evidence",
    childGoal: "I can combine details and context to explain an idea the author does not state directly.",
    skillIds: ["reading-vocabulary", "reading-inference", "reading-spelling-hard"],
  },
  {
    id: "g3-paragraph",
    grade: 3,
    area: "Writing",
    title: "Build and revise an organized paragraph",
    childGoal: "I can organize related sentences, edit conventions, and revise for clarity.",
    skillIds: ["writing-organization", "writing-conventions", "writing-revision"],
  },
  {
    id: "g3-systems",
    grade: 3,
    area: "Science",
    title: "Describe patterns in living and Earth systems",
    childGoal: "I can notice a pattern in a system and use observations to explain it.",
    skillIds: ["science-body", "science-earth", "geography-places-regions"],
  },
  {
    id: "g3-plan-check",
    grade: 3,
    area: "Thinking",
    title: "Plan, test, and improve a solution",
    childGoal: "I can make a plan, test it, and use the result to improve my next attempt.",
    skillIds: ["logic-multi-step", "engineering-iteration"],
  },
  {
    id: "g4-strategy-math",
    grade: 4,
    area: "Math",
    title: "Choose efficient mathematical strategies",
    childGoal: "I can compare solution strategies and defend the one that works best.",
    skillIds: ["math-word-problems", "math-money", "logic-multi-step"],
  },
  {
    id: "g4-evidence-reading",
    grade: 4,
    area: "Literacy",
    title: "Support an interpretation with evidence",
    childGoal: "I can make an inference and point to details that support it.",
    skillIds: ["reading-inference", "reading-vocabulary", "reading-comprehension-detail"],
  },
  {
    id: "g4-revise-purpose",
    grade: 4,
    area: "Writing",
    title: "Revise writing for purpose and organization",
    childGoal: "I can reorganize or rewrite part of a draft so the reader understands it better.",
    skillIds: ["writing-organization", "writing-revision", "writing-conventions"],
  },
  {
    id: "g4-model-system",
    grade: 4,
    area: "Science",
    title: "Model and test a system",
    childGoal: "I can use a model or test to explain how parts of a system affect one another.",
    skillIds: ["science-space", "science-technology", "engineering-iteration"],
  },
  {
    id: "g4-human-environment",
    grade: 4,
    area: "Thinking",
    title: "Reason about people, places, and consequences",
    childGoal: "I can compare choices and explain how a decision may affect people or environments.",
    skillIds: ["geography-human-environment", "logic-multi-step"],
  },
  {
    id: "g5-complex-problems",
    grade: 5,
    area: "Math",
    title: "Sustain a complex problem-solving chain",
    childGoal: "I can organize a multi-step problem, check each step, and revise a strategy that fails.",
    skillIds: ["math-word-problems", "math-money", "logic-multi-step"],
  },
  {
    id: "g5-synthesize-text",
    grade: 5,
    area: "Literacy",
    title: "Synthesize details, vocabulary, and inference",
    childGoal: "I can combine evidence from across a text to explain a larger idea.",
    skillIds: ["reading-inference", "reading-vocabulary", "reading-sequencing"],
  },
  {
    id: "g5-independent-writing",
    grade: 5,
    area: "Writing",
    title: "Plan, draft, and revise independently",
    childGoal: "I can organize a complete piece and make purposeful revisions before publishing.",
    skillIds: ["writing-ideas", "writing-organization", "writing-revision", "writing-conventions"],
  },
  {
    id: "g5-explain-systems",
    grade: 5,
    area: "Science",
    title: "Use evidence to explain interconnected systems",
    childGoal: "I can explain how information, energy, matter, or forces move through a system.",
    skillIds: ["science-technology", "science-space", "engineering-iteration"],
  },
  {
    id: "g5-independent-learning",
    grade: 5,
    area: "Thinking",
    title: "Manage an independent learning cycle",
    childGoal: "I can plan, monitor my understanding, use feedback, and improve my work.",
    skillIds: ["memory-working-memory", "logic-multi-step", "study-planning"],
  },
];

export function elementaryMilestonesForGrade(grade: ElementaryGrade): ElementaryMilestone[] {
  return ELEMENTARY_MILESTONES.filter((milestone) => milestone.grade === grade);
}

export function elementaryMilestoneProgress(
  grade: ElementaryGrade,
  nodes: SkillNode[],
): ElementaryMilestoneProgress[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return elementaryMilestonesForGrade(grade).map((milestone) => {
    const evidence = milestone.skillIds
      .map((skillId) => byId.get(skillId))
      .filter((node): node is SkillNode => Boolean(node));
    const mastery = milestone.skillIds.length > 0
      ? Math.round(milestone.skillIds.reduce((sum, skillId) => sum + (byId.get(skillId)?.mastery ?? 0), 0) / milestone.skillIds.length)
      : 0;
    const lowestSkill = [...evidence]
      .filter((node) => !node.locked)
      .sort((a, b) => a.mastery - b.mastery)[0] ?? null;
    return {
      ...milestone,
      mastery,
      available: evidence.some((node) => !node.locked),
      mastered: mastery >= 80 && milestone.skillIds.every((skillId) => (byId.get(skillId)?.mastery ?? 0) >= 65),
      lowestSkill,
    };
  });
}

export function elementaryGradeReadiness(grade: ElementaryGrade, nodes: SkillNode[]): number {
  const rows = elementaryMilestoneProgress(grade, nodes);
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, row) => sum + row.mastery, 0) / rows.length);
}

export function nextElementaryMilestone(
  grade: ElementaryGrade,
  nodes: SkillNode[],
): ElementaryMilestoneProgress | null {
  return elementaryMilestoneProgress(grade, nodes)
    .filter((row) => !row.mastered)
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.mastery - b.mastery;
    })[0] ?? null;
}

export function elementaryPriorityForSkill(skillId: string, grade: ElementaryGrade): number {
  const index = elementaryMilestonesForGrade(grade).findIndex((milestone) => milestone.skillIds.includes(skillId));
  return index >= 0 ? index : 99;
}

export function elementaryMilestoneForSkill(
  skillId: string,
  grade: ElementaryGrade,
): ElementaryMilestone | null {
  return elementaryMilestonesForGrade(grade).find((milestone) => milestone.skillIds.includes(skillId)) ?? null;
}
