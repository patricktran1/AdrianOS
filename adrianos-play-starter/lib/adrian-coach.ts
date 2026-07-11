"use client";

import { useEffect, useMemo, useState } from "react";
import { getActiveProfile } from "@/lib/adrian-profiles";

export type CoachCheckResult = "correct" | "incorrect" | null;

export type CoachInteraction = {
  id: string;
  gameSlug: string;
  skillId: string;
  skillLabel: string;
  prompt: string;
  startedAt: string;
  updatedAt: string;
  hintsViewed: number;
  voicePlays: number;
  checkResult: CoachCheckResult;
  helpful: boolean | null;
};

export type CoachState = {
  version: 1;
  updatedAt: string;
  interactions: CoachInteraction[];
};

export type CoachSummary = {
  sessions: number;
  hintsViewed: number;
  voicePlays: number;
  checksCompleted: number;
  checksCorrect: number;
  helpfulVotes: number;
};

const STORAGE_PREFIX = "adrianos-coach-v1:";
export const COACH_EVENT = "adrianos-coach-updated";

const EMPTY_STATE: CoachState = {
  version: 1,
  updatedAt: "1970-01-01T00:00:00.000Z",
  interactions: [],
};

function storageKey(profileId: string): string {
  return `${STORAGE_PREFIX}${profileId}`;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeInteraction(value: unknown): CoachInteraction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CoachInteraction>;
  if (!raw.id || !raw.gameSlug || !raw.skillId || !raw.prompt) return null;
  return {
    id: String(raw.id),
    gameSlug: String(raw.gameSlug),
    skillId: String(raw.skillId),
    skillLabel: typeof raw.skillLabel === "string" && raw.skillLabel ? raw.skillLabel : String(raw.skillId),
    prompt: String(raw.prompt),
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    hintsViewed: safeNumber(raw.hintsViewed),
    voicePlays: safeNumber(raw.voicePlays),
    checkResult: raw.checkResult === "correct" || raw.checkResult === "incorrect" ? raw.checkResult : null,
    helpful: typeof raw.helpful === "boolean" ? raw.helpful : null,
  };
}

function normalizeState(value: unknown): CoachState {
  if (!value || typeof value !== "object") return { ...EMPTY_STATE, interactions: [] };
  const raw = value as Partial<CoachState>;
  const interactions = Array.isArray(raw.interactions)
    ? raw.interactions
        .map(normalizeInteraction)
        .filter((item): item is CoachInteraction => Boolean(item))
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .slice(-120)
    : [];
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    interactions,
  };
}

export function readCoachForProfile(profileId: string): CoachState {
  if (typeof window === "undefined") return { ...EMPTY_STATE, interactions: [] };
  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    return raw ? normalizeState(JSON.parse(raw)) : { ...EMPTY_STATE, interactions: [] };
  } catch {
    return { ...EMPTY_STATE, interactions: [] };
  }
}

export function writeCoachForProfile(profileId: string, state: CoachState): CoachState {
  if (typeof window === "undefined") return state;
  const next: CoachState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    interactions: state.interactions.slice(-120),
  };
  window.localStorage.setItem(storageKey(profileId), JSON.stringify(next));
  window.dispatchEvent(new Event(COACH_EVENT));
  return next;
}

function updateInteraction(
  profileId: string,
  interactionId: string,
  change: (current: CoachInteraction) => CoachInteraction
): CoachState {
  const state = readCoachForProfile(profileId);
  const interactions = state.interactions.map((interaction) =>
    interaction.id === interactionId ? change(interaction) : interaction
  );
  return writeCoachForProfile(profileId, { ...state, interactions });
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function beginCoachInteraction(
  input: Pick<CoachInteraction, "gameSlug" | "skillId" | "skillLabel" | "prompt">,
  profileId = getActiveProfile().id
): string {
  const state = readCoachForProfile(profileId);
  const now = new Date().toISOString();
  const id = `${input.gameSlug}:${input.skillId}:${hashText(input.prompt)}:${Date.now().toString(36)}`;
  const interaction: CoachInteraction = {
    ...input,
    id,
    startedAt: now,
    updatedAt: now,
    hintsViewed: 0,
    voicePlays: 0,
    checkResult: null,
    helpful: null,
  };
  writeCoachForProfile(profileId, {
    ...state,
    interactions: [...state.interactions, interaction],
  });
  return id;
}

export function recordCoachHint(profileId: string, interactionId: string, hintLevel: number): void {
  updateInteraction(profileId, interactionId, (current) => ({
    ...current,
    hintsViewed: Math.max(current.hintsViewed, hintLevel),
    updatedAt: new Date().toISOString(),
  }));
}

export function recordCoachVoice(profileId: string, interactionId: string): void {
  updateInteraction(profileId, interactionId, (current) => ({
    ...current,
    voicePlays: current.voicePlays + 1,
    updatedAt: new Date().toISOString(),
  }));
}

export function recordCoachCheck(profileId: string, interactionId: string, correct: boolean): void {
  updateInteraction(profileId, interactionId, (current) => ({
    ...current,
    checkResult: correct ? "correct" : "incorrect",
    updatedAt: new Date().toISOString(),
  }));
}

export function recordCoachHelpful(profileId: string, interactionId: string, helpful: boolean): void {
  updateInteraction(profileId, interactionId, (current) => ({
    ...current,
    helpful,
    updatedAt: new Date().toISOString(),
  }));
}

export function summarizeCoach(state: CoachState): CoachSummary {
  return state.interactions.reduce<CoachSummary>(
    (summary, interaction) => ({
      sessions: summary.sessions + 1,
      hintsViewed: summary.hintsViewed + interaction.hintsViewed,
      voicePlays: summary.voicePlays + interaction.voicePlays,
      checksCompleted: summary.checksCompleted + (interaction.checkResult ? 1 : 0),
      checksCorrect: summary.checksCorrect + (interaction.checkResult === "correct" ? 1 : 0),
      helpfulVotes: summary.helpfulVotes + (interaction.helpful === true ? 1 : 0),
    }),
    { sessions: 0, hintsViewed: 0, voicePlays: 0, checksCompleted: 0, checksCorrect: 0, helpfulVotes: 0 }
  );
}

export function useCoachState(profileId = getActiveProfile().id) {
  const [state, setState] = useState<CoachState>(() => readCoachForProfile(profileId));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setState(readCoachForProfile(profileId));
      setHydrated(true);
    };
    refresh();
    window.addEventListener(COACH_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(COACH_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, [profileId]);

  const summary = useMemo(() => summarizeCoach(state), [state]);
  return { state, summary, hydrated };
}
