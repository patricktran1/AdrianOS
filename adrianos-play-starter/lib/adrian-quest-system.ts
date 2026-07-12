"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";
import {
  standardsForGrade,
  type CurriculumStandard,
} from "@/lib/adrian-curriculum";

export type QuestWorldId = "numbers" | "stories" | "discovery";

export type QuestWorld = {
  id: QuestWorldId;
  title: string;
  emoji: string;
  description: string;
};

export type StandardsQuest = CurriculumStandard & {
  mastery: number;
  mastered: boolean;
  claimed: boolean;
  world: QuestWorldId;
  practiceHref: string;
  rewardXp: number;
  rewardCoins: number;
};

export const QUEST_WORLDS: QuestWorld[] = [
  { id: "numbers", title: "Number Kingdom", emoji: "🏰", description: "Crack number gates, patterns, shapes, and real-world math." },
  { id: "stories", title: "Story Realm", emoji: "📚", description: "Read for clues, build vocabulary, and publish clear ideas." },
  { id: "discovery", title: "Discovery Lab", emoji: "🔬", description: "Observe, test, model, and explain how the world works." },
];

const REWARD_SLUG = "adrianos-standards-quest";

function rewardId(grade: number, code: string): string {
  return `standards-quest:${grade}:${code}`;
}

function worldFor(standard: CurriculumStandard): QuestWorldId {
  if (standard.subject === "Math") return "numbers";
  if (standard.subject === "Reading") return "stories";
  return "discovery";
}

export function questPracticeHref(standard: CurriculumStandard): string {
  const first = standard.skillIds[0] ?? "";
  if (standard.subject === "Math") return `/games/number-quest?focus=${encodeURIComponent(first)}&standard=${encodeURIComponent(standard.code)}`;
  if (first.startsWith("writing-")) return `/games/writing-studio?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("reading-")) return `/games/reading-lab?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("engineering-")) return `/games/engineering-lab?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("environment-")) return `/games/nature-environment-lab?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("geography-")) return `/games/world-explorer?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("history-")) return `/games/history-lab?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("civics-")) return `/games/civic-lab?focus=${encodeURIComponent(first)}`;
  if (first.startsWith("creativity-") || first.startsWith("music-")) return "/games/music-maker";
  return `/games/science-quest?focus=${encodeURIComponent(first)}`;
}

function claimedRewardIds(profileId: string): Set<string> {
  return new Set(
    readLearningForProfile(profileId).reviewQueue
      .filter((item) => item.gameSlug === REWARD_SLUG && item.data?.questReward === true)
      .map((item) => item.id),
  );
}

function standardMastery(profileId: string, standard: CurriculumStandard): number {
  const learning = readLearningForProfile(profileId);
  const evidence = standard.skillIds
    .map((skillId) => learning.skills[skillId])
    .filter(Boolean);
  if (evidence.length === 0) return 0;
  return Math.round(evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length);
}

export function standardsQuestsForGrade(profileId: string, grade: number): StandardsQuest[] {
  const claimed = claimedRewardIds(profileId);
  return standardsForGrade(grade).map((standard) => {
    const mastery = standardMastery(profileId, standard);
    return {
      ...standard,
      mastery,
      mastered: mastery >= 85,
      claimed: claimed.has(rewardId(grade, standard.code)),
      world: worldFor(standard),
      practiceHref: questPracticeHref(standard),
      rewardXp: standard.strength === "direct" ? 20 : 12,
      rewardCoins: standard.strength === "direct" ? 6 : 4,
    };
  });
}

export function claimStandardsQuest(profileId: string, quest: StandardsQuest): boolean {
  if (!quest.mastered || quest.claimed) return false;
  const state = readLearningForProfile(profileId);
  const id = rewardId(quest.grade, quest.code);
  if (state.reviewQueue.some((item) => item.id === id)) return false;
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id,
    gameSlug: REWARD_SLUG,
    skillId: quest.skillIds[0] ?? "curriculum-quest",
    subject: quest.subject,
    prompt: `Mastery reward for ${quest.code}`,
    correctAnswer: "",
    dueAt: "9999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: 1,
    status: "resolved",
    data: {
      questReward: true,
      standardCode: quest.code,
      grade: quest.grade,
      world: quest.world,
      xp: quest.rewardXp,
      coins: quest.rewardCoins,
    },
  };
  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [...state.reviewQueue, item].slice(-100),
  });
  return true;
}

export function questWorldSummary(quests: StandardsQuest[], worldId: QuestWorldId) {
  const rows = quests.filter((quest) => quest.world === worldId);
  const mastered = rows.filter((quest) => quest.mastered).length;
  const claimed = rows.filter((quest) => quest.claimed).length;
  const mastery = rows.length > 0
    ? Math.round(rows.reduce((sum, quest) => sum + quest.mastery, 0) / rows.length)
    : 0;
  return {
    rows,
    mastered,
    claimed,
    mastery,
    complete: rows.length > 0 && mastered === rows.length,
  };
}
