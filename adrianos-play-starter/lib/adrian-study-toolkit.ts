"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type StudyTool = {
  id: string;
  label: string;
  emoji: string;
  earnedAt: string;
};

export type StudyToolkit = {
  version: 1;
  tools: StudyTool[];
  missions: number;
  updatedAt: string;
};

const ITEM_ID = "study-skills-toolkit";
const GAME_SLUG = "adrianos-study-toolkit";
export const STUDY_TOOLKIT_EVENT = "adrianos-study-toolkit-updated";

const EMPTY: StudyToolkit = {
  version: 1,
  tools: [],
  missions: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function parseToolkit(item: ReviewItem | undefined): StudyToolkit {
  if (!item || item.gameSlug !== GAME_SLUG || item.data?.studyToolkit !== true) return EMPTY;
  const raw = item.data.toolkitJson;
  if (typeof raw !== "string") return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<StudyToolkit>;
    const tools = Array.isArray(parsed.tools)
      ? parsed.tools.filter((tool): tool is StudyTool => Boolean(
          tool
          && typeof tool === "object"
          && typeof tool.id === "string"
          && typeof tool.label === "string"
          && typeof tool.emoji === "string"
          && typeof tool.earnedAt === "string"
        )).slice(-50)
      : [];
    return {
      version: 1,
      tools,
      missions: typeof parsed.missions === "number" && Number.isFinite(parsed.missions)
        ? Math.max(0, Math.floor(parsed.missions))
        : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY;
  }
}

export function readStudyToolkit(profileId: string): StudyToolkit {
  const learning = readLearningForProfile(profileId);
  return parseToolkit(learning.reviewQueue.find((item) => item.id === ITEM_ID));
}

function writeStudyToolkit(profileId: string, toolkit: StudyToolkit): StudyToolkit {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: StudyToolkit = { ...toolkit, version: 1, tools: toolkit.tools.slice(-50), updatedAt: now };
  const item: ReviewItem = {
    id: ITEM_ID,
    gameSlug: GAME_SLUG,
    skillId: "study-toolkit",
    subject: "Learning Skills",
    prompt: "Study Skills Toolkit",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.tools.length,
    status: "resolved",
    data: { studyToolkit: true, toolkitJson: JSON.stringify(next) },
  };
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...learning.reviewQueue.filter((row) => row.id !== ITEM_ID), item].slice(-100),
  });
  window.dispatchEvent(new Event(STUDY_TOOLKIT_EVENT));
  return next;
}

export function addStudyTools(
  profileId: string,
  tools: Array<Omit<StudyTool, "earnedAt">>
): { toolkit: StudyToolkit; added: StudyTool[] } {
  const current = readStudyToolkit(profileId);
  const known = new Set(current.tools.map((tool) => tool.id));
  const earnedAt = new Date().toISOString();
  const added = tools.filter((tool) => !known.has(tool.id)).map((tool) => ({ ...tool, earnedAt }));
  const toolkit = writeStudyToolkit(profileId, {
    ...current,
    missions: current.missions + 1,
    tools: [...current.tools, ...added],
  });
  return { toolkit, added };
}
