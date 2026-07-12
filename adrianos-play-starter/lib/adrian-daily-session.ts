"use client";

import { readProgressForProfile, type AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  ensureDailyAdventure,
  readLearningForProfile,
  writeLearningForProfile,
  type AdventureItem,
  type ReviewItem,
} from "@/lib/adrian-learning";
import {
  learningPlanForDate,
  type LearningDayMode,
} from "@/lib/adrian-learning-schedule";
import {
  getSkillGraph,
  skillHref,
} from "@/lib/adrian-skill-graph";
import {
  curriculumReasonForSkill,
  getCurriculumRecommendedSkill,
} from "@/lib/adrian-curriculum-recommendation";
import type { Game } from "@/lib/games";

export type DailySessionMissionStatus = "pending" | "active" | "complete";

export type DailySessionMission = AdventureItem & {
  baselineCompletions: number;
  status: DailySessionMissionStatus;
  startedAt: string | null;
  completedAt: string | null;
};

export type DailySession = {
  version: 1;
  profileId: string;
  date: string;
  scheduleMode: LearningDayMode;
  startedAt: string | null;
  completedAt: string | null;
  currentIndex: number;
  recommendedMinutes: number;
  missions: DailySessionMission[];
  rewardClaimed: boolean;
  updatedAt: string;
};

const SESSION_GAME_SLUG = "adrianos-daily-session";
const SESSION_ITEM_PREFIX = "daily-session:";
export const DAILY_SESSION_EVENT = "adrianos-daily-session-updated";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sessionItemId(date: string): string {
  return `${SESSION_ITEM_PREFIX}${date}`;
}

function parseMission(value: unknown): DailySessionMission | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DailySessionMission>;
  if (!raw.id || !raw.gameSlug || !raw.title || !raw.href) return null;
  const kind = raw.kind === "review" || raw.kind === "explore" ? raw.kind : "skill";
  const status: DailySessionMissionStatus =
    raw.status === "complete" ? "complete" : raw.status === "active" ? "active" : "pending";
  return {
    id: String(raw.id),
    kind,
    gameSlug: String(raw.gameSlug),
    title: String(raw.title),
    reason: typeof raw.reason === "string" ? raw.reason : "Today’s learning mission.",
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "Adaptive",
    href: String(raw.href),
    baselinePlays: typeof raw.baselinePlays === "number" ? raw.baselinePlays : 0,
    baselineCompletions: typeof raw.baselineCompletions === "number" ? raw.baselineCompletions : 0,
    status,
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
  };
}

function parseSession(item: ReviewItem | undefined): DailySession | null {
  if (!item || item.gameSlug !== SESSION_GAME_SLUG) return null;
  const rawJson = item.data?.sessionJson;
  if (typeof rawJson !== "string") return null;
  try {
    const raw = JSON.parse(rawJson) as Partial<DailySession>;
    if (!raw || typeof raw.date !== "string" || typeof raw.profileId !== "string") return null;
    const missions = Array.isArray(raw.missions)
      ? raw.missions.map(parseMission).filter((mission): mission is DailySessionMission => Boolean(mission))
      : [];
    if (missions.length === 0) return null;
    const scheduleMode: LearningDayMode = raw.scheduleMode === "light" || raw.scheduleMode === "free" ? raw.scheduleMode : "full";
    return {
      version: 1,
      profileId: raw.profileId,
      date: raw.date,
      scheduleMode,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
      completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
      currentIndex: typeof raw.currentIndex === "number" ? raw.currentIndex : 0,
      recommendedMinutes: typeof raw.recommendedMinutes === "number" ? raw.recommendedMinutes : 12,
      missions,
      rewardClaimed: raw.rewardClaimed === true,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : item.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readDailySession(profileId: string, date = localDateKey()): DailySession | null {
  const state = readLearningForProfile(profileId);
  return parseSession(state.reviewQueue.find((item) => item.id === sessionItemId(date)));
}

function writeDailySession(profileId: string, session: DailySession): DailySession {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: DailySession = { ...session, updatedAt: now };
  const item: ReviewItem = {
    id: sessionItemId(session.date),
    gameSlug: SESSION_GAME_SLUG,
    skillId: "daily-guided-session",
    subject: "Logic",
    prompt: `Guided learning session for ${session.date}`,
    correctAnswer: "",
    dueAt: `${session.date}T23:59:59.999Z`,
    updatedAt: now,
    successes: session.missions.filter((mission) => mission.status === "complete").length,
    status: "resolved",
    data: {
      dailySession: true,
      sessionJson: JSON.stringify(next),
    },
  };

  const otherItems = state.reviewQueue.filter((row) => row.gameSlug !== SESSION_GAME_SLUG);
  const recentSessions = state.reviewQueue
    .filter((row) => row.gameSlug === SESSION_GAME_SLUG && row.id !== item.id)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(-13);

  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [...otherItems, ...recentSessions, item].slice(-100),
  });
  window.dispatchEvent(new Event(DAILY_SESSION_EVENT));
  return next;
}

function resolveAdventureItems(
  profile: ChildProfile,
  games: Game[],
  progress: AdrianProgress
): AdventureItem[] {
  const state = ensureDailyAdventure(profile, games, progress);
  const items = [...(state.dailyAdventure?.items ?? [])];
  const skillIndex = items.findIndex((item) => item.kind === "skill");
  const recommended = getCurriculumRecommendedSkill(profile, getSkillGraph(profile, progress));

  if (recommended && skillIndex >= 0) {
    const duplicate = items.some(
      (item, index) => index !== skillIndex && item.gameSlug === recommended.gameSlug
    );
    if (!duplicate) {
      items[skillIndex] = {
        ...items[skillIndex],
        id: `${state.dailyAdventure?.date ?? localDateKey()}:skill:${recommended.id}`,
        gameSlug: recommended.gameSlug,
        title: recommended.label,
        reason: recommended.goal && !recommended.goalComplete
          ? `Parent goal: reach ${recommended.goal.targetMastery}% mastery.`
          : recommended.dueReviews > 0
            ? `Review ${recommended.dueReviews} missed item${recommended.dueReviews === 1 ? "" : "s"} in this skill.`
            : curriculumReasonForSkill(profile, recommended.id)
              ?? "This is the next unlocked skill after its prerequisites.",
        difficulty: `${recommended.stage} · ${recommended.mastery}%`,
        href: skillHref(recommended),
        baselinePlays: progress.games[recommended.gameSlug]?.plays ?? 0,
      };
    }
  }

  return items.slice(0, 3);
}

function scheduledItems(items: AdventureItem[], mode: LearningDayMode): AdventureItem[] {
  if (mode === "full") return items.slice(0, 3);
  if (mode === "light") {
    const focused = items.find((item) => item.kind === "review")
      ?? items.find((item) => item.kind === "skill")
      ?? items[0];
    return focused ? [focused] : [];
  }
  const explore = items.find((item) => item.kind === "explore") ?? items[items.length - 1] ?? items[0];
  return explore ? [explore] : [];
}

export function ensureDailySession(
  profile: ChildProfile,
  games: Game[],
  progress: AdrianProgress
): DailySession {
  const date = localDateKey();
  const existing = readDailySession(profile.id, date);
  if (existing) return existing;

  const plan = learningPlanForDate(profile.id);
  const now = new Date().toISOString();
  const selectedItems = scheduledItems(resolveAdventureItems(profile, games, progress), plan.mode);
  const session: DailySession = {
    version: 1,
    profileId: profile.id,
    date,
    scheduleMode: plan.mode,
    startedAt: null,
    completedAt: null,
    currentIndex: 0,
    recommendedMinutes: plan.minutes,
    missions: selectedItems.map((item) => ({
      ...item,
      baselineCompletions: progress.games[item.gameSlug]?.completions ?? 0,
      status: "pending",
      startedAt: null,
      completedAt: null,
    })),
    rewardClaimed: false,
    updatedAt: now,
  };
  return writeDailySession(profile.id, session);
}

export function startDailySessionMission(
  profileId: string,
  missionIndex: number
): DailySession | null {
  const session = readDailySession(profileId);
  if (!session || !session.missions[missionIndex]) return null;
  const now = new Date().toISOString();
  const progress = readProgressForProfile(profileId);
  const missions = session.missions.map((mission, index) => {
    if (mission.status === "complete") return mission;
    if (index === missionIndex) {
      const firstStart = mission.startedAt === null;
      const game = progress.games[mission.gameSlug];
      return {
        ...mission,
        status: "active" as const,
        startedAt: mission.startedAt ?? now,
        baselinePlays: firstStart ? game?.plays ?? mission.baselinePlays : mission.baselinePlays,
        baselineCompletions: firstStart ? game?.completions ?? mission.baselineCompletions : mission.baselineCompletions,
      };
    }
    return { ...mission, status: "pending" as const };
  });
  return writeDailySession(profileId, {
    ...session,
    startedAt: session.startedAt ?? now,
    currentIndex: missionIndex,
    missions,
  });
}

export function completeDailySessionMission(
  profileId: string,
  missionIndex: number
): DailySession | null {
  const session = readDailySession(profileId);
  if (!session || !session.missions[missionIndex]) return null;
  const now = new Date().toISOString();
  const missions = session.missions.map((mission, index) =>
    index === missionIndex
      ? { ...mission, status: "complete" as const, startedAt: mission.startedAt ?? now, completedAt: now }
      : mission.status === "active"
        ? { ...mission, status: "pending" as const }
        : mission
  );
  const nextIndex = missions.findIndex((mission) => mission.status !== "complete");
  const complete = nextIndex < 0;
  return writeDailySession(profileId, {
    ...session,
    startedAt: session.startedAt ?? now,
    completedAt: complete ? session.completedAt ?? now : null,
    currentIndex: complete ? missions.length : nextIndex,
    missions,
  });
}

export function claimDailySessionReward(profileId: string): DailySession | null {
  const session = readDailySession(profileId);
  if (!session || !session.completedAt || session.rewardClaimed) return session;
  return writeDailySession(profileId, { ...session, rewardClaimed: true });
}

export function guidedMissionHref(
  mission: DailySessionMission,
  profileId: string,
  missionIndex: number,
  total: number
): string {
  const [path, query = ""] = mission.href.split("?");
  const params = new URLSearchParams(query);
  params.set("guided", "1");
  params.set("school", "1");
  params.set("guidedProfile", profileId);
  params.set("guidedMission", String(missionIndex));
  params.set("guidedTotal", String(total));
  return `${path}?${params.toString()}`;
}

export function dailySessionStreak(profileId: string): number {
  const rows = readLearningForProfile(profileId).reviewQueue
    .filter((item) => item.gameSlug === SESSION_GAME_SLUG)
    .map(parseSession)
    .filter((session): session is DailySession => Boolean(session?.completedAt))
    .map((session) => session.date)
    .sort((a, b) => b.localeCompare(a));
  const completed = new Set(rows);
  const cursor = new Date();
  if (!completed.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
