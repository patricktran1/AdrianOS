"use client";

import type { AdrianProgress, DailyActivity } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import { readCoachForProfile } from "@/lib/adrian-coach";
import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";
import { readPlacementReport } from "@/lib/adrian-placement";
import { getRecommendedSkill, getSkillGraph, type SkillNode } from "@/lib/adrian-skill-graph";
import type { Game } from "@/lib/games";

export type WeeklyMasterySnapshot = Record<
  string,
  {
    label: string;
    subject: Game["subject"];
    mastery: number;
    attempts: number;
    stage: string;
  }
>;

export type WeeklyMasteryChange = {
  skillId: string;
  label: string;
  subject: Game["subject"];
  mastery: number;
  delta: number;
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  profileAge: number;
  daysActive: number;
  plays: number;
  completions: number;
  xp: number;
  coins: number;
  previousPlays: number;
  previousCompletions: number;
  activeGameSlugs: string[];
  skillsPracticed: string[];
  masterySnapshot: WeeklyMasterySnapshot;
  masteryChanges: WeeklyMasteryChange[];
  newlyMastered: string[];
  reviewsDue: number;
  coachSessions: number;
  coachHints: number;
  coachChecks: number;
  coachChecksCorrect: number;
  coachHelpful: number;
  coachNeedsAnotherPath: number;
  activeGoals: number;
  completedGoals: number;
  placementCompletedThisWeek: boolean;
  nextFocusSkillId: string | null;
  recommendedMinutes: number;
  wins: string[];
  watchItems: string[];
  summary: string;
};

const WEEKLY_GAME_SLUG = "adrianos-weekly-report";
const WEEKLY_ITEM_PREFIX = "weekly-report:";
export const WEEKLY_REPORT_EVENT = "adrianos-weekly-report-updated";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, Math.max(0, month - 1), day || 1, 12, 0, 0, 0);
}

function addDays(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function startOfWeek(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  return localDateKey(copy);
}

function localKeyFromIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}

function inRange(value: string, start: string, end: string): boolean {
  return value >= start && value <= end;
}

function sumActivity(rows: DailyActivity[]) {
  return rows.reduce(
    (total, row) => ({
      daysActive: total.daysActive + (row.plays > 0 || row.completions > 0 ? 1 : 0),
      plays: total.plays + row.plays,
      completions: total.completions + row.completions,
      xp: total.xp + row.xp,
      coins: total.coins + row.coins,
    }),
    { daysActive: 0, plays: 0, completions: 0, xp: 0, coins: 0 }
  );
}

function parseReport(item: ReviewItem): WeeklyReport | null {
  if (item.gameSlug !== WEEKLY_GAME_SLUG || item.data?.weeklyReport !== true) return null;
  const raw = item.data.reportJson;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as WeeklyReport;
    if (!parsed || typeof parsed.weekStart !== "string" || typeof parsed.weekEnd !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function reportSignature(report: WeeklyReport): string {
  const { generatedAt: _generatedAt, ...stable } = report;
  return JSON.stringify(stable);
}

function masterySnapshot(nodes: SkillNode[]): WeeklyMasterySnapshot {
  const snapshot: WeeklyMasterySnapshot = {};
  for (const node of nodes) {
    snapshot[node.id] = {
      label: node.label,
      subject: node.subject,
      mastery: node.mastery,
      attempts: node.attempts,
      stage: node.stage,
    };
  }
  return snapshot;
}

function mostRecentPreviousReport(reports: WeeklyReport[], weekStart: string): WeeklyReport | null {
  return reports
    .filter((report) => report.weekStart < weekStart)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0] ?? null;
}

function skillLabel(nodes: SkillNode[], skillId: string): string {
  return nodes.find((node) => node.id === skillId)?.label ?? skillId;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function readWeeklyReports(profileId: string): WeeklyReport[] {
  return readLearningForProfile(profileId).reviewQueue
    .map(parseReport)
    .filter((report): report is WeeklyReport => Boolean(report))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export function buildWeeklyReport(
  profile: ChildProfile,
  progress: AdrianProgress,
  games: Game[],
  now = new Date()
): WeeklyReport {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(weekStart, -1);
  const learning = readLearningForProfile(profile.id);
  const coach = readCoachForProfile(profile.id);
  const placement = readPlacementReport(profile.id);
  const nodes = getSkillGraph(profile, progress);
  const recommended = getRecommendedSkill(nodes);
  const reports = readWeeklyReports(profile.id);
  const previousReport = mostRecentPreviousReport(reports, weekStart);

  const currentActivity = progress.activity.filter((row) => inRange(row.date, weekStart, weekEnd));
  const previousActivity = progress.activity.filter((row) => inRange(row.date, previousStart, previousEnd));
  const totals = sumActivity(currentActivity);
  const priorTotals = sumActivity(previousActivity);

  const activeGameSlugs = games
    .filter((game) => {
      const played = localKeyFromIso(progress.games[game.slug]?.lastPlayed ?? null);
      return Boolean(played && inRange(played, weekStart, weekEnd));
    })
    .map((game) => game.slug);

  const skillsPracticed = Object.values(learning.skills)
    .filter((skill) => {
      const date = localKeyFromIso(skill.lastPracticed);
      return Boolean(date && inRange(date, weekStart, weekEnd));
    })
    .sort((a, b) => (b.lastPracticed ?? "").localeCompare(a.lastPracticed ?? ""))
    .map((skill) => skill.id);

  const currentSnapshot = masterySnapshot(nodes);
  const priorSnapshot = previousReport?.masterySnapshot ?? {};
  const masteryChanges = Object.entries(currentSnapshot)
    .map(([skillId, row]) => ({
      skillId,
      label: row.label,
      subject: row.subject,
      mastery: row.mastery,
      delta: row.mastery - (priorSnapshot[skillId]?.mastery ?? row.mastery),
    }))
    .filter((row) => row.delta !== 0)
    .sort((a, b) => b.delta - a.delta);

  const newlyMastered = nodes
    .filter((node) => node.stage === "Mastered" && (priorSnapshot[node.id]?.mastery ?? 0) < 80)
    .map((node) => node.id);

  const nowIso = now.toISOString();
  const reviewsDue = learning.reviewQueue.filter(
    (item) =>
      item.gameSlug !== WEEKLY_GAME_SLUG &&
      item.gameSlug !== "adrianos-skill-goal" &&
      item.status === "due" &&
      item.dueAt <= nowIso
  ).length;

  const coachRows = coach.interactions.filter((interaction) => {
    const date = localKeyFromIso(interaction.startedAt);
    return Boolean(date && inRange(date, weekStart, weekEnd));
  });
  const coachChecks = coachRows.filter((row) => row.checkResult !== null).length;
  const coachChecksCorrect = coachRows.filter((row) => row.checkResult === "correct").length;
  const coachHelpful = coachRows.filter((row) => row.helpful === true).length;
  const coachNeedsAnotherPath = coachRows.filter((row) => row.helpful === false).length;

  const activeGoals = nodes.filter((node) => node.goal && !node.goalComplete).length;
  const completedGoals = nodes.filter((node) => node.goalComplete).length;
  const placementDate = placement ? localKeyFromIso(placement.completedAt) : null;
  const placementCompletedThisWeek = Boolean(
    placementDate && inRange(placementDate, weekStart, weekEnd)
  );
  const recommendedMinutes = placement?.recommendedMinutes ?? (profile.age <= 4 ? 8 : profile.age <= 8 ? 12 : 15);

  const positiveChanges = masteryChanges.filter((row) => row.delta > 0);
  const recentlyPracticedNodes = nodes.filter((node) => skillsPracticed.includes(node.id));
  const lowestRecent = [...recentlyPracticedNodes]
    .filter((node) => node.mastery < 60)
    .sort((a, b) => a.mastery - b.mastery)[0];

  const wins: string[] = [];
  if (placementCompletedThisWeek) wins.push("Completed Placement Adventure and created a personalized starting map.");
  if (totals.daysActive >= 4) wins.push(`Practiced on ${totals.daysActive} different days this week.`);
  if (newlyMastered.length > 0) {
    wins.push(`Reached mastery in ${newlyMastered.slice(0, 2).map((id) => skillLabel(nodes, id)).join(" and ")}.`);
  }
  if (positiveChanges.length > 0) {
    const best = positiveChanges[0];
    wins.push(`${best.label} rose ${best.delta} mastery points.`);
  }
  if (totals.completions > 0) wins.push(`Finished ${totals.completions} learning mission${totals.completions === 1 ? "" : "s"}.`);
  if (coachChecks >= 2 && coachChecksCorrect / coachChecks >= 0.75) {
    wins.push(`Answered ${coachChecksCorrect} of ${coachChecks} Coach Mode checks correctly.`);
  }
  if (wins.length === 0 && totals.plays > 0) wins.push("Built a useful week of learning evidence for the adaptive path.");
  if (wins.length === 0) wins.push("This week is ready to begin. AdrianOS has preserved the current mastery baseline.");

  const watchItems: string[] = [];
  if (reviewsDue > 0) watchItems.push(`${reviewsDue} spaced review item${reviewsDue === 1 ? " is" : "s are"} ready.`);
  if (lowestRecent) watchItems.push(`${lowestRecent.label} is the lowest recently practiced skill at ${lowestRecent.mastery}%.`);
  if (coachNeedsAnotherPath > 0) {
    watchItems.push(`Coach Mode was marked “needs another path” ${coachNeedsAnotherPath} time${coachNeedsAnotherPath === 1 ? "" : "s"}.`);
  }
  if (activeGoals > 0) watchItems.push(`${activeGoals} parent goal${activeGoals === 1 ? " remains" : "s remain"} in progress.`);
  if (watchItems.length === 0) watchItems.push("No urgent learning friction appeared in the available data.");

  const nextFocusSkillId = recommended?.id ?? placement?.nextSkillId ?? null;
  const focusLabel = nextFocusSkillId ? skillLabel(nodes, nextFocusSkillId) : "open exploration";
  const activityTrend = totals.plays - priorTotals.plays;
  const trendText = priorTotals.plays === 0
    ? "This is the first tracked comparison week."
    : activityTrend > 0
      ? `Activity increased by ${activityTrend} play${activityTrend === 1 ? "" : "s"} from last week.`
      : activityTrend < 0
        ? `Activity was ${Math.abs(activityTrend)} play${Math.abs(activityTrend) === 1 ? "" : "s"} lower than last week.`
        : "Activity matched last week.";
  const summary = `${profile.name} was active on ${totals.daysActive} day${totals.daysActive === 1 ? "" : "s"}, completed ${totals.completions} mission${totals.completions === 1 ? "" : "s"}, and earned ${totals.xp} XP. ${trendText} The best next focus is ${focusLabel} for about ${recommendedMinutes} minutes per learning day.`;

  return {
    weekStart,
    weekEnd,
    generatedAt: now.toISOString(),
    profileAge: profile.age,
    daysActive: totals.daysActive,
    plays: totals.plays,
    completions: totals.completions,
    xp: totals.xp,
    coins: totals.coins,
    previousPlays: priorTotals.plays,
    previousCompletions: priorTotals.completions,
    activeGameSlugs,
    skillsPracticed: unique(skillsPracticed),
    masterySnapshot: currentSnapshot,
    masteryChanges,
    newlyMastered,
    reviewsDue,
    coachSessions: coachRows.length,
    coachHints: coachRows.reduce((sum, row) => sum + row.hintsViewed, 0),
    coachChecks,
    coachChecksCorrect,
    coachHelpful,
    coachNeedsAnotherPath,
    activeGoals,
    completedGoals,
    placementCompletedThisWeek,
    nextFocusSkillId,
    recommendedMinutes,
    wins: wins.slice(0, 4),
    watchItems: watchItems.slice(0, 4),
    summary,
  };
}

export function saveWeeklyReport(profileId: string, report: WeeklyReport): WeeklyReport {
  const state = readLearningForProfile(profileId);
  const id = `${WEEKLY_ITEM_PREFIX}${report.weekStart}`;
  const existing = state.reviewQueue.find((item) => item.id === id);
  const existingReport = existing ? parseReport(existing) : null;
  if (existingReport && reportSignature(existingReport) === reportSignature(report)) {
    return existingReport;
  }

  const item: ReviewItem = {
    id,
    gameSlug: WEEKLY_GAME_SLUG,
    skillId: report.nextFocusSkillId ?? "weekly-learning",
    subject: report.nextFocusSkillId && report.masterySnapshot[report.nextFocusSkillId]
      ? report.masterySnapshot[report.nextFocusSkillId].subject
      : "Logic",
    prompt: `Weekly learning report beginning ${report.weekStart}`,
    correctAnswer: "",
    dueAt: `${report.weekEnd}T23:59:59.999Z`,
    updatedAt: report.generatedAt,
    successes: 0,
    status: "resolved",
    data: {
      weeklyReport: true,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      reportJson: JSON.stringify(report),
    },
  };

  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [...state.reviewQueue.filter((row) => row.id !== id), item].slice(-100),
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WEEKLY_REPORT_EVENT));
  return report;
}

export function refreshWeeklyReport(
  profile: ChildProfile,
  progress: AdrianProgress,
  games: Game[],
  now = new Date()
): WeeklyReport {
  return saveWeeklyReport(profile.id, buildWeeklyReport(profile, progress, games, now));
}
