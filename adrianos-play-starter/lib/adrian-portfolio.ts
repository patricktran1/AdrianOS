"use client";

import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";
import { getSkillGraph, type SkillNode } from "@/lib/adrian-skill-graph";
import { readWeeklyReports, type WeeklyReport } from "@/lib/adrian-weekly-report";
import type { Game } from "@/lib/games";

export type PortfolioHighlightKind =
  | "mastery"
  | "growth"
  | "session"
  | "achievement"
  | "practice";

export type PortfolioHighlight = {
  id: string;
  kind: PortfolioHighlightKind;
  emoji: string;
  title: string;
  detail: string;
  date: string;
  subject: Game["subject"] | null;
  value: string | null;
};

export type PortfolioTranscriptRow = {
  skillId: string;
  label: string;
  subject: Game["subject"];
  description: string;
  stage: SkillNode["stage"];
  mastery: number;
  attempts: number;
  correct: number;
  accuracy: number;
  dueReviews: number;
  lastPracticed: string | null;
};

export type LearningPortfolio = {
  profile: ChildProfile;
  generatedAt: string;
  totalXp: number;
  totalCompletions: number;
  completedSessions: number;
  activeSkills: number;
  masteredSkills: number;
  practicingSkills: number;
  subjectsWithEvidence: number;
  summary: string;
  transcript: PortfolioTranscriptRow[];
  highlights: PortfolioHighlight[];
  showcase: PortfolioHighlight[];
  recentWeeks: WeeklyReport[];
};

const PORTFOLIO_ITEM_ID = "portfolio-showcase";
const PORTFOLIO_GAME_SLUG = "adrianos-portfolio";
export const PORTFOLIO_EVENT = "adrianos-portfolio-updated";

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseShowcase(item: ReviewItem | undefined): string[] | null {
  if (!item || item.gameSlug !== PORTFOLIO_GAME_SLUG || item.data?.portfolioShowcase !== true) {
    return null;
  }
  const raw = item.data.showcaseJson;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function readPortfolioShowcase(profileId: string): string[] | null {
  const state = readLearningForProfile(profileId);
  return parseShowcase(state.reviewQueue.find((item) => item.id === PORTFOLIO_ITEM_ID));
}

export function writePortfolioShowcase(profileId: string, ids: string[]): string[] {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const unique = [...new Set(ids)].slice(0, 12);
  const item: ReviewItem = {
    id: PORTFOLIO_ITEM_ID,
    gameSlug: PORTFOLIO_GAME_SLUG,
    skillId: "learning-portfolio",
    subject: "Creativity",
    prompt: "Parent-selected learning portfolio showcase",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: unique.length,
    status: "resolved",
    data: {
      portfolioShowcase: true,
      showcaseJson: JSON.stringify(unique),
    },
  };
  const queue = state.reviewQueue.filter((row) => row.id !== PORTFOLIO_ITEM_ID);
  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: [...queue, item].slice(-100),
  });
  window.dispatchEvent(new Event(PORTFOLIO_EVENT));
  return unique;
}

export function togglePortfolioHighlight(profileId: string, highlightId: string, fallbackIds: string[]): string[] {
  const selected = readPortfolioShowcase(profileId) ?? fallbackIds;
  const next = selected.includes(highlightId)
    ? selected.filter((id) => id !== highlightId)
    : [...selected, highlightId];
  return writePortfolioShowcase(profileId, next);
}

function completedSessionRows(profileId: string): Array<{
  date: string;
  completedAt: string;
  missions: number;
}> {
  const state = readLearningForProfile(profileId);
  const rows: Array<{ date: string; completedAt: string; missions: number }> = [];
  for (const item of state.reviewQueue) {
    if (item.gameSlug !== "adrianos-daily-session") continue;
    const raw = item.data?.sessionJson;
    if (typeof raw !== "string") continue;
    try {
      const parsed = JSON.parse(raw) as {
        date?: unknown;
        completedAt?: unknown;
        missions?: unknown;
      };
      const date = typeof parsed.date === "string" ? parsed.date : null;
      const completedAt = validDate(parsed.completedAt);
      const missions = Array.isArray(parsed.missions) ? parsed.missions.length : 0;
      if (date && completedAt) rows.push({ date, completedAt, missions });
    } catch {
      // Ignore old or incomplete session payloads.
    }
  }
  return rows.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function skillLastPracticed(profileId: string, node: SkillNode): string | null {
  const learning = readLearningForProfile(profileId);
  const direct = learning.skills[node.id]?.lastPracticed ?? null;
  if (direct) return direct;
  const candidates = Object.values(learning.skills)
    .filter((skill) => skill.subject === node.subject && skill.label === node.label)
    .map((skill) => skill.lastPracticed)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));
  return candidates[0] ?? null;
}

function transcriptFor(profile: ChildProfile, progress: AdrianProgress): PortfolioTranscriptRow[] {
  return getSkillGraph(profile, progress)
    .filter((node) => node.attempts > 0 || node.mastery > 0 || node.goal)
    .map((node) => ({
      skillId: node.id,
      label: node.label,
      subject: node.subject,
      description: node.description,
      stage: node.stage,
      mastery: node.mastery,
      attempts: node.attempts,
      correct: node.correct,
      accuracy: node.attempts > 0 ? Math.round((node.correct / node.attempts) * 100) : 0,
      dueReviews: node.dueReviews,
      lastPracticed: skillLastPracticed(profile.id, node),
    }))
    .sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return b.mastery - a.mastery;
    });
}

function addHighlight(map: Map<string, PortfolioHighlight>, highlight: PortfolioHighlight): void {
  if (!map.has(highlight.id)) map.set(highlight.id, highlight);
}

function buildHighlights(
  profile: ChildProfile,
  progress: AdrianProgress,
  games: Game[],
  transcript: PortfolioTranscriptRow[],
  reports: WeeklyReport[],
  sessions: ReturnType<typeof completedSessionRows>
): PortfolioHighlight[] {
  const highlights = new Map<string, PortfolioHighlight>();
  const now = new Date().toISOString();

  for (const row of transcript.filter((item) => item.stage === "Mastered").slice(0, 8)) {
    addHighlight(highlights, {
      id: `mastery:${row.skillId}`,
      kind: "mastery",
      emoji: "🏆",
      title: `Mastered ${row.label}`,
      detail: `${row.mastery}% mastery${row.attempts > 0 ? ` across ${row.attempts} attempts` : ""}.`,
      date: row.lastPracticed ?? now,
      subject: row.subject,
      value: `${row.mastery}%`,
    });
  }

  for (const report of reports.slice(0, 3)) {
    for (const change of report.masteryChanges.filter((row) => row.delta > 0).slice(0, 4)) {
      addHighlight(highlights, {
        id: `growth:${report.weekStart}:${change.skillId}`,
        kind: "growth",
        emoji: "📈",
        title: `${change.label} grew`,
        detail: `Improved ${change.delta} mastery points during the week of ${report.weekStart}.`,
        date: report.generatedAt,
        subject: change.subject,
        value: `+${change.delta}`,
      });
    }
  }

  for (const session of sessions.slice(0, 8)) {
    addHighlight(highlights, {
      id: `session:${session.date}`,
      kind: "session",
      emoji: "🎒",
      title: "Completed a school day",
      detail: `Finished ${session.missions} guided mission${session.missions === 1 ? "" : "s"}.`,
      date: session.completedAt,
      subject: null,
      value: session.date,
    });
  }

  const gameRows = Object.entries(progress.games)
    .filter(([, row]) => row.completions > 0 || row.bestScore > 0)
    .sort((a, b) => {
      if (b[1].completions !== a[1].completions) return b[1].completions - a[1].completions;
      return b[1].bestScore - a[1].bestScore;
    })
    .slice(0, 8);

  for (const [slug, row] of gameRows) {
    const game = games.find((item) => item.slug === slug);
    if (!game) continue;
    addHighlight(highlights, {
      id: `achievement:${slug}`,
      kind: "achievement",
      emoji: game.emoji,
      title: `${game.title} achievement`,
      detail: `${row.completions} completion${row.completions === 1 ? "" : "s"}${row.bestScore > 0 ? ` with a best score of ${row.bestScore}` : ""}.`,
      date: row.lastPlayed ?? now,
      subject: game.subject,
      value: row.bestScore > 0 ? String(row.bestScore) : `${row.completions} done`,
    });
  }

  for (const row of transcript.filter((item) => item.stage === "Practicing").slice(0, 6)) {
    addHighlight(highlights, {
      id: `practice:${row.skillId}`,
      kind: "practice",
      emoji: "🛠️",
      title: `Building ${row.label}`,
      detail: `${row.attempts} attempts with ${row.accuracy}% accuracy.`,
      date: row.lastPracticed ?? now,
      subject: row.subject,
      value: `${row.mastery}%`,
    });
  }

  return [...highlights.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function buildLearningPortfolio(
  profile: ChildProfile,
  progress: AdrianProgress,
  games: Game[]
): LearningPortfolio {
  const transcript = transcriptFor(profile, progress);
  const reports = readWeeklyReports(profile.id).slice(0, 6);
  const sessions = completedSessionRows(profile.id);
  const highlights = buildHighlights(profile, progress, games, transcript, reports, sessions);
  const selected = readPortfolioShowcase(profile.id);
  const defaultIds = highlights.slice(0, 6).map((item) => item.id);
  const showcaseIds = selected ?? defaultIds;
  const showcase = showcaseIds
    .map((id) => highlights.find((item) => item.id === id))
    .filter((item): item is PortfolioHighlight => Boolean(item));
  const masteredSkills = transcript.filter((row) => row.stage === "Mastered").length;
  const practicingSkills = transcript.filter((row) => row.stage === "Practicing").length;
  const activeSkills = transcript.length;
  const subjectsWithEvidence = new Set(transcript.map((row) => row.subject)).size;
  const totalCompletions = Object.values(progress.games).reduce((sum, row) => sum + row.completions, 0);
  const summary = activeSkills === 0
    ? `${profile.name} is beginning a new learning portfolio. Evidence will appear after the first completed activities.`
    : `${profile.name} has learning evidence across ${subjectsWithEvidence} subject${subjectsWithEvidence === 1 ? "" : "s"}, with ${masteredSkills} mastered skill${masteredSkills === 1 ? "" : "s"} and ${practicingSkills} skill${practicingSkills === 1 ? "" : "s"} currently being practiced.`;

  return {
    profile,
    generatedAt: new Date().toISOString(),
    totalXp: progress.xp,
    totalCompletions,
    completedSessions: sessions.length,
    activeSkills,
    masteredSkills,
    practicingSkills,
    subjectsWithEvidence,
    summary,
    transcript,
    highlights,
    showcase,
    recentWeeks: reports,
  };
}
