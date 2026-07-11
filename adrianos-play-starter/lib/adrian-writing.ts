"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type WritingGenre = "Story" | "Opinion" | "Teach";

export type WritingPrompt = {
  id: string;
  title: string;
  emoji: string;
  genre: WritingGenre;
  minAge: number;
  maxAge: number;
  prompt: string;
  planQuestion: string;
  ideaChoices: string[];
  sentenceStarters: string[];
};

export type WritingPiece = {
  id: string;
  profileId: string;
  promptId: string;
  weekKey: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  currentStep: 0 | 1 | 2;
  title: string;
  selectedIdeas: string[];
  draft: string;
  finalText: string;
  parentNote: string;
  rewardClaimed: boolean;
  revisionCount: number;
  updatedAt: string;
};

export type WritingStudioState = {
  version: 1;
  activePieceId: string | null;
  pieces: WritingPiece[];
  updatedAt: string;
};

export type WritingAnalysis = {
  wordCount: number;
  sentenceCount: number;
  capitalStart: boolean;
  endingPunctuation: boolean;
  enoughWords: boolean;
  enoughSentences: boolean;
  organized: boolean;
  revisionChanged: boolean;
  readyToPublish: boolean;
  score: number;
  checks: Array<{ id: string; label: string; passed: boolean; tip: string }>;
};

const WRITING_ITEM_ID = "writing-studio-state";
const WRITING_GAME_SLUG = "adrianos-writing-studio";
export const WRITING_STUDIO_EVENT = "adrianos-writing-studio-updated";

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: "animal-helper-day",
    title: "An Animal Saves the Day",
    emoji: "🦊",
    genre: "Story",
    minAge: 3,
    maxAge: 6,
    prompt: "Tell a story about an animal that helps someone.",
    planQuestion: "Who is the animal, and what helpful thing does it do?",
    ideaChoices: ["🐶 brave dog", "🦉 wise owl", "🐬 fast dolphin", "🐘 strong elephant", "🌧️ storm", "🌲 forest", "🏠 home", "🩹 helps someone"],
    sentenceStarters: ["My animal is…", "One day…", "It helped by…", "At the end…"],
  },
  {
    id: "moon-picnic",
    title: "Picnic on the Moon",
    emoji: "🌙",
    genre: "Story",
    minAge: 3,
    maxAge: 7,
    prompt: "Imagine a picnic on the moon. What happens there?",
    planQuestion: "Who comes, what food do they bring, and what surprises them?",
    ideaChoices: ["🚀 rocket", "🥪 sandwich", "🍓 berries", "👽 tiny alien", "🌍 Earth view", "🪨 moon rock", "🦘 giant jump", "⭐ shooting star"],
    sentenceStarters: ["We flew…", "On the moon…", "Suddenly…", "We came home…"],
  },
  {
    id: "best-snack",
    title: "The Best Snack",
    emoji: "🍎",
    genre: "Opinion",
    minAge: 4,
    maxAge: 8,
    prompt: "Choose the best snack and explain why it wins.",
    planQuestion: "What snack do you choose, and what are two reasons?",
    ideaChoices: ["🍎 apple", "🍿 popcorn", "🥨 pretzel", "🍓 berries", "tastes good", "gives energy", "easy to carry", "fun to share"],
    sentenceStarters: ["I think the best snack is…", "One reason is…", "Another reason is…", "That is why…"],
  },
  {
    id: "weather-day",
    title: "A Wild Weather Day",
    emoji: "⛈️",
    genre: "Story",
    minAge: 4,
    maxAge: 8,
    prompt: "Write about a day when the weather did something surprising.",
    planQuestion: "Where are you, what changes, and how do you respond?",
    ideaChoices: ["☀️ hot sun", "🌧️ sudden rain", "❄️ snow", "🌪️ wind", "🏫 school", "🏖️ beach", "☂️ umbrella", "🏃 race home"],
    sentenceStarters: ["The day began…", "Then the sky…", "I decided to…", "Finally…"],
  },
  {
    id: "playground-door",
    title: "The Door Under the Playground",
    emoji: "🚪",
    genre: "Story",
    minAge: 6,
    maxAge: 11,
    prompt: "A small door appears beneath the playground slide. Write what happens when it opens.",
    planQuestion: "Who finds the door, what is behind it, and what problem must be solved?",
    ideaChoices: ["🔑 silver key", "🐉 tiny dragon", "🗺️ hidden map", "⏳ time machine", "🌳 underground forest", "🤖 lost robot", "💎 glowing stone", "🚫 locked tunnel"],
    sentenceStarters: ["During recess…", "Behind the door…", "The problem began when…", "In the end…"],
  },
  {
    id: "robot-lost-map",
    title: "The Robot With the Wrong Map",
    emoji: "🤖",
    genre: "Story",
    minAge: 6,
    maxAge: 11,
    prompt: "A delivery robot receives the wrong map and ends up somewhere unexpected.",
    planQuestion: "Where was it going, where did it arrive, and how does it fix the mistake?",
    ideaChoices: ["🏥 hospital", "🎂 bakery", "🏰 castle", "🌋 volcano", "📦 mystery package", "🧭 broken compass", "🦾 helpful arm", "📡 sends a signal"],
    sentenceStarters: ["The robot was supposed to…", "Instead, it arrived…", "To solve the problem…", "Finally…"],
  },
  {
    id: "school-pet",
    title: "Should Our School Have a Pet?",
    emoji: "🐢",
    genre: "Opinion",
    minAge: 6,
    maxAge: 12,
    prompt: "Decide whether a school should have a classroom pet and support your opinion.",
    planQuestion: "What is your opinion, and what evidence supports it?",
    ideaChoices: ["teaches responsibility", "helps students feel calm", "needs daily care", "allergies", "costs money", "fun to observe", "weekend care", "clean habitat"],
    sentenceStarters: ["I believe…", "My first reason is…", "For example…", "Some people may think…", "Therefore…"],
  },
  {
    id: "best-superpower",
    title: "The Most Useful Superpower",
    emoji: "⚡",
    genre: "Opinion",
    minAge: 6,
    maxAge: 12,
    prompt: "Choose the most useful superpower and persuade someone to agree.",
    planQuestion: "Which power wins, and how would it help in real situations?",
    ideaChoices: ["flying", "super strength", "healing", "talking to animals", "invisibility", "stopping time", "helps in emergencies", "protects people"],
    sentenceStarters: ["The most useful superpower is…", "It would help because…", "For instance…", "This is better than…", "In conclusion…"],
  },
  {
    id: "grow-a-seed",
    title: "How to Grow a Seed",
    emoji: "🌱",
    genre: "Teach",
    minAge: 5,
    maxAge: 10,
    prompt: "Teach a reader how to plant and care for a seed.",
    planQuestion: "What materials and steps does the reader need?",
    ideaChoices: ["seed", "soil", "cup or pot", "water", "sunlight", "make a small hole", "check each day", "wait for a sprout"],
    sentenceStarters: ["First…", "Next…", "Then…", "Remember to…", "After a few days…"],
  },
  {
    id: "why-rain-falls",
    title: "Why Rain Falls",
    emoji: "🌧️",
    genre: "Teach",
    minAge: 7,
    maxAge: 12,
    prompt: "Explain how water can travel from the ground to clouds and back as rain.",
    planQuestion: "What happens first, next, and finally in the water cycle?",
    ideaChoices: ["sun warms water", "evaporation", "water vapor rises", "clouds form", "drops grow heavy", "rain falls", "water collects", "cycle repeats"],
    sentenceStarters: ["The cycle begins when…", "As the water warms…", "High in the sky…", "When drops become heavy…", "Then the cycle…"],
  },
  {
    id: "teach-an-animal",
    title: "Teach Me About an Animal",
    emoji: "🦈",
    genre: "Teach",
    minAge: 6,
    maxAge: 12,
    prompt: "Choose an animal and teach the reader about its habitat, body, and behavior.",
    planQuestion: "Where does it live, what body parts help it, and what does it do?",
    ideaChoices: ["ocean", "forest", "desert", "cold habitat", "camouflage", "sharp senses", "special movement", "food and hunting"],
    sentenceStarters: ["This animal lives…", "Its body helps it…", "One interesting behavior is…", "This matters because…"],
  },
  {
    id: "better-neighborhood",
    title: "One Way to Improve Our Neighborhood",
    emoji: "🏘️",
    genre: "Opinion",
    minAge: 7,
    maxAge: 12,
    prompt: "Propose one change that would make a neighborhood better and explain the plan.",
    planQuestion: "What problem would you solve, who would it help, and how could people begin?",
    ideaChoices: ["safer crosswalk", "more trees", "clean park", "community garden", "bike path", "library box", "helps children", "brings neighbors together"],
    sentenceStarters: ["Our neighborhood should…", "The current problem is…", "This change would help…", "We could begin by…", "As a result…"],
  },
];

const EMPTY_STATE: WritingStudioState = {
  version: 1,
  activePieceId: null,
  pieces: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function writingWeekKey(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(copy);
}

function normalizePiece(value: unknown): WritingPiece | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WritingPiece>;
  if (!raw.id || !raw.profileId || !raw.promptId || !raw.weekKey) return null;
  return {
    id: String(raw.id),
    profileId: String(raw.profileId),
    promptId: String(raw.promptId),
    weekKey: String(raw.weekKey),
    assignedAt: typeof raw.assignedAt === "string" ? raw.assignedAt : new Date().toISOString(),
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    currentStep: raw.currentStep === 1 || raw.currentStep === 2 ? raw.currentStep : 0,
    title: typeof raw.title === "string" ? raw.title : "",
    selectedIdeas: Array.isArray(raw.selectedIdeas)
      ? raw.selectedIdeas.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
    draft: typeof raw.draft === "string" ? raw.draft : "",
    finalText: typeof raw.finalText === "string" ? raw.finalText : "",
    parentNote: typeof raw.parentNote === "string" ? raw.parentNote : "",
    rewardClaimed: raw.rewardClaimed === true,
    revisionCount: typeof raw.revisionCount === "number" && Number.isFinite(raw.revisionCount)
      ? Math.max(0, Math.round(raw.revisionCount))
      : 0,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseState(item: ReviewItem | undefined): WritingStudioState {
  if (!item || item.gameSlug !== WRITING_GAME_SLUG || item.data?.writingStudio !== true) return EMPTY_STATE;
  const raw = item.data.writingJson;
  if (typeof raw !== "string") return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<WritingStudioState>;
    const pieces = Array.isArray(parsed.pieces)
      ? parsed.pieces.map(normalizePiece).filter((piece): piece is WritingPiece => Boolean(piece)).slice(-24)
      : [];
    const activePieceId = typeof parsed.activePieceId === "string" && pieces.some((piece) => piece.id === parsed.activePieceId)
      ? parsed.activePieceId
      : pieces.find((piece) => !piece.completedAt)?.id ?? null;
    return {
      version: 1,
      activePieceId,
      pieces,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function readWritingStudio(profileId: string): WritingStudioState {
  const learning = readLearningForProfile(profileId);
  return parseState(learning.reviewQueue.find((item) => item.id === WRITING_ITEM_ID));
}

function writeWritingStudio(profileId: string, state: WritingStudioState): WritingStudioState {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: WritingStudioState = {
    ...state,
    version: 1,
    pieces: state.pieces.slice(-24),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: WRITING_ITEM_ID,
    gameSlug: WRITING_GAME_SLUG,
    skillId: "writing-portfolio",
    subject: "Reading",
    prompt: "Writing Studio drafts and published work",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.pieces.filter((piece) => piece.completedAt).length,
    status: "resolved",
    data: {
      writingStudio: true,
      writingJson: JSON.stringify(next),
    },
  };
  const queue = learning.reviewQueue.filter((row) => row.id !== WRITING_ITEM_ID);
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...queue, item].slice(-100),
  });
  window.dispatchEvent(new Event(WRITING_STUDIO_EVENT));
  return next;
}

export function writingPromptsForAge(age: number): WritingPrompt[] {
  const matching = WRITING_PROMPTS.filter((prompt) => age >= prompt.minAge && age <= prompt.maxAge);
  return matching.length > 0 ? matching : WRITING_PROMPTS;
}

export function getWritingPrompt(promptId: string): WritingPrompt | null {
  return WRITING_PROMPTS.find((prompt) => prompt.id === promptId) ?? null;
}

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 31 + value.charCodeAt(index)) >>> 0;
  return total;
}

function newPiece(profileId: string, promptId: string, weekKey = writingWeekKey()): WritingPiece {
  const now = new Date().toISOString();
  return {
    id: `writing:${weekKey}:${promptId}:${Date.now().toString(36)}`,
    profileId,
    promptId,
    weekKey,
    assignedAt: now,
    startedAt: null,
    completedAt: null,
    currentStep: 0,
    title: "",
    selectedIdeas: [],
    draft: "",
    finalText: "",
    parentNote: "",
    rewardClaimed: false,
    revisionCount: 0,
    updatedAt: now,
  };
}

export function ensureWeeklyWriting(profile: ChildProfile): WritingPiece {
  const state = readWritingStudio(profile.id);
  const weekKey = writingWeekKey();
  const currentWeek = state.pieces
    .filter((piece) => piece.weekKey === weekKey)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
  if (currentWeek) return currentWeek;

  const prompts = writingPromptsForAge(profile.age);
  const prompt = prompts[hash(`${profile.id}:${weekKey}:writing`) % prompts.length];
  const piece = newPiece(profile.id, prompt.id, weekKey);
  writeWritingStudio(profile.id, {
    ...state,
    activePieceId: piece.id,
    pieces: [...state.pieces, piece],
  });
  return piece;
}

export function assignWritingPrompt(profileId: string, promptId: string): WritingPiece {
  if (!getWritingPrompt(promptId)) throw new Error("Unknown writing prompt.");
  const state = readWritingStudio(profileId);
  const piece = newPiece(profileId, promptId);
  writeWritingStudio(profileId, {
    ...state,
    activePieceId: piece.id,
    pieces: [...state.pieces, piece],
  });
  return piece;
}

export function updateWritingPiece(
  profileId: string,
  pieceId: string,
  change: Partial<Omit<WritingPiece, "id" | "profileId" | "promptId" | "weekKey" | "assignedAt">>
): WritingPiece | null {
  const state = readWritingStudio(profileId);
  const existing = state.pieces.find((piece) => piece.id === pieceId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const finalChanged = typeof change.finalText === "string" && change.finalText.trim() !== existing.finalText.trim();
  const updated: WritingPiece = {
    ...existing,
    ...change,
    selectedIdeas: change.selectedIdeas ? [...new Set(change.selectedIdeas)].slice(0, 8) : existing.selectedIdeas,
    revisionCount: finalChanged ? existing.revisionCount + 1 : existing.revisionCount,
    startedAt: existing.startedAt ?? now,
    updatedAt: now,
  };
  writeWritingStudio(profileId, {
    ...state,
    activePieceId: updated.completedAt ? null : updated.id,
    pieces: state.pieces.map((piece) => piece.id === pieceId ? updated : piece),
  });
  return updated;
}

export function completeWritingPiece(profileId: string, pieceId: string): WritingPiece | null {
  return updateWritingPiece(profileId, pieceId, {
    currentStep: 2,
    completedAt: new Date().toISOString(),
  });
}

export function claimWritingReward(profileId: string, pieceId: string): WritingPiece | null {
  return updateWritingPiece(profileId, pieceId, { rewardClaimed: true });
}

export function readWritingHistory(profileId: string): WritingPiece[] {
  return [...readWritingStudio(profileId).pieces].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

export function findWritingPiece(profileId: string, pieceId: string): WritingPiece | null {
  return readWritingStudio(profileId).pieces.find((piece) => piece.id === pieceId) ?? null;
}

function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const marked = trimmed.match(/[^.!?]+[.!?]+/g)?.length ?? 0;
  return marked > 0 ? marked : 1;
}

function includesAny(text: string, values: string[]): boolean {
  const lower = text.toLowerCase();
  return values.some((value) => {
    const words = value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length >= 4);
    return words.some((word) => lower.includes(word));
  });
}

export function analyzeWriting(
  text: string,
  age: number,
  prompt: WritingPrompt,
  selectedIdeas: string[],
  originalDraft = ""
): WritingAnalysis {
  const trimmed = text.trim();
  const words = trimmed.match(/[A-Za-z0-9']+/g) ?? [];
  const sentences = sentenceCount(trimmed);
  const capitalStart = /^[A-Z]/.test(trimmed);
  const endingPunctuation = /[.!?]$/.test(trimmed);
  const requiredWords = age <= 5 ? 3 : age <= 7 ? 18 : 35;
  const requiredSentences = age <= 5 ? 1 : age <= 7 ? 3 : 5;
  const enoughWords = words.length >= requiredWords;
  const enoughSentences = sentences >= requiredSentences;
  const organizationSignals = prompt.genre === "Story"
    ? ["then", "next", "suddenly", "finally", "end"]
    : prompt.genre === "Opinion"
      ? ["because", "reason", "example", "therefore", "think", "believe"]
      : ["first", "next", "then", "because", "finally", "step"];
  const organized = age <= 5
    ? selectedIdeas.length >= 2
    : includesAny(trimmed, organizationSignals) || includesAny(trimmed, selectedIdeas);
  const revisionChanged = Boolean(originalDraft.trim()) && trimmed !== originalDraft.trim();
  const checks = [
    { id: "sentences", label: age <= 5 ? "Tell at least one complete idea" : `Write at least ${requiredSentences} sentences`, passed: enoughSentences && enoughWords, tip: `Add detail until you have ${requiredSentences} complete sentence${requiredSentences === 1 ? "" : "s"}.` },
    { id: "capital", label: "Begin with a capital letter", passed: capitalStart, tip: "Check the first letter of your writing." },
    { id: "punctuation", label: "Finish with punctuation", passed: endingPunctuation, tip: "Add a period, question mark, or exclamation point at the end." },
    { id: "organization", label: prompt.genre === "Story" ? "Show the order of events" : prompt.genre === "Opinion" ? "Give a reason or example" : "Explain the steps clearly", passed: organized, tip: prompt.genre === "Story" ? "Try words such as then, suddenly, or finally." : prompt.genre === "Opinion" ? "Use because, for example, or therefore." : "Use first, next, then, or finally." },
  ];
  const score = checks.filter((check) => check.passed).length;
  return {
    wordCount: words.length,
    sentenceCount: sentences,
    capitalStart,
    endingPunctuation,
    enoughWords,
    enoughSentences,
    organized,
    revisionChanged,
    readyToPublish: age <= 5 ? score >= 3 : score === checks.length,
    score,
    checks,
  };
}

export function writingArtifactSummary(piece: WritingPiece): string {
  const prompt = getWritingPrompt(piece.promptId);
  const title = piece.title.trim() || prompt?.title || "Published writing";
  const text = piece.finalText.trim() || piece.draft.trim();
  const excerpt = text.length > 220 ? `${text.slice(0, 217)}…` : text;
  return `${title}${excerpt ? `: ${excerpt}` : "."}`;
}
