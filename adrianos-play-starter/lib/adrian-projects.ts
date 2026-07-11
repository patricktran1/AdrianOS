"use client";

import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
} from "@/lib/adrian-learning";
import type { Game } from "@/lib/games";

export type ProjectTemplate = {
  id: string;
  title: string;
  emoji: string;
  summary: string;
  minAge: number;
  maxAge: number;
  subjects: Game["subject"][];
  minutes: number;
  discover: {
    fact: string;
    question: string;
    options: string[];
    answer: string;
  };
  makePrompt: string;
  ideaChoices: string[];
  explainPrompts: string[];
};

export type ProjectWork = {
  id: string;
  profileId: string;
  templateId: string;
  weekKey: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  currentStep: 0 | 1 | 2;
  discoverAnswer: string;
  discoverCorrect: boolean | null;
  projectName: string;
  selectedIdeas: string[];
  makeText: string;
  explainText: string;
  parentNote: string;
  rewardClaimed: boolean;
  updatedAt: string;
};

export type ProjectStudioState = {
  version: 1;
  activeProjectId: string | null;
  projects: ProjectWork[];
  updatedAt: string;
};

const PROJECT_ITEM_ID = "project-studio-state";
const PROJECT_GAME_SLUG = "adrianos-project-studio";
export const PROJECT_STUDIO_EVENT = "adrianos-project-studio-updated";

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "shape-town",
    title: "Build Shape Town",
    emoji: "🏘️",
    summary: "Use shapes and colors to invent a tiny town.",
    minAge: 3,
    maxAge: 5,
    subjects: ["Math", "Creativity"],
    minutes: 10,
    discover: {
      fact: "Circles roll, squares stack, and triangles can make strong roofs.",
      question: "Which shape would make a good wheel?",
      options: ["Circle", "Square", "Triangle"],
      answer: "Circle",
    },
    makePrompt: "Choose the parts your town needs, then describe what you built.",
    ideaChoices: ["🔵 Round wheels", "🔺 Triangle roofs", "🟦 Square homes", "🌳 Park", "🌉 Bridge", "🚦 Traffic light"],
    explainPrompts: ["My town is called…", "The best part of my town is…"],
  },
  {
    id: "animal-helper",
    title: "Invent an Animal Helper",
    emoji: "🦊",
    summary: "Create an animal character with a helpful job.",
    minAge: 3,
    maxAge: 6,
    subjects: ["Science", "Creativity", "Reading"],
    minutes: 10,
    discover: {
      fact: "Animals use body parts in special ways. Birds use wings, fish use fins, and dogs use powerful noses.",
      question: "What helps a fish move through water?",
      options: ["Fins", "Feathers", "Paws"],
      answer: "Fins",
    },
    makePrompt: "Choose your animal’s powers and the job it will do.",
    ideaChoices: ["👃 Super smell", "🪽 Flying", "🏊 Fast swimming", "🌙 Night vision", "🧰 Fixes things", "🩹 Helps people"],
    explainPrompts: ["My animal helper can…", "It helps by…"],
  },
  {
    id: "snack-shop",
    title: "Open a Snack Shop",
    emoji: "🍎",
    summary: "Design a menu, choose prices, and explain how your shop works.",
    minAge: 6,
    maxAge: 10,
    subjects: ["Math", "Reading", "Creativity"],
    minutes: 20,
    discover: {
      fact: "A shop needs prices so customers know what each item costs. A budget helps the owner avoid spending more than the shop earns.",
      question: "A smoothie costs $3 and an apple costs $2. What is the total?",
      options: ["$4", "$5", "$6"],
      answer: "$5",
    },
    makePrompt: "Choose menu items, name the shop, and describe one customer order with its total price.",
    ideaChoices: ["🍎 $2 apple", "🥪 $4 sandwich", "🥤 $3 smoothie", "🍪 $1 cookie", "🥕 $2 carrots", "🍓 $3 berries"],
    explainPrompts: ["My shop is special because…", "One customer order would be…"],
  },
  {
    id: "helpful-robot",
    title: "Invent a Helpful Robot",
    emoji: "🤖",
    summary: "Design a robot, its sensors, and the instructions that make it useful.",
    minAge: 6,
    maxAge: 11,
    subjects: ["Coding", "Science", "Creativity"],
    minutes: 20,
    discover: {
      fact: "Robots use sensors to notice the world and programs to decide what to do next.",
      question: "Which part helps a robot notice an object in front of it?",
      options: ["Sensor", "Wheel", "Battery sticker"],
      answer: "Sensor",
    },
    makePrompt: "Choose the robot’s tools, give it a name, and write a short command sequence.",
    ideaChoices: ["📷 Camera sensor", "🦾 Grabber arm", "🛞 Wheels", "🔊 Voice speaker", "🌡️ Temperature sensor", "🧹 Cleaning tool"],
    explainPrompts: ["My robot solves the problem of…", "Its program should first…, then…, and finally…"],
  },
  {
    id: "new-planet",
    title: "Design a New Planet",
    emoji: "🪐",
    summary: "Create a planet with weather, land, life, and a scientific explanation.",
    minAge: 6,
    maxAge: 11,
    subjects: ["Science", "Reading", "Creativity"],
    minutes: 20,
    discover: {
      fact: "A planet’s distance from its star, atmosphere, and surface can change its temperature and weather.",
      question: "What surrounds Earth and contains the air we breathe?",
      options: ["Atmosphere", "Core", "Ocean floor"],
      answer: "Atmosphere",
    },
    makePrompt: "Choose the planet’s features, name it, and describe what a visitor would discover.",
    ideaChoices: ["🌋 Volcanoes", "🧊 Ice oceans", "🌳 Giant forests", "🌪️ Purple storms", "👽 Tiny life", "💍 Rings"],
    explainPrompts: ["Life could survive there because…", "The most surprising thing about my planet is…"],
  },
  {
    id: "tiny-city",
    title: "Plan a Tiny City",
    emoji: "🏙️",
    summary: "Balance homes, transportation, nature, and a small city budget.",
    minAge: 7,
    maxAge: 12,
    subjects: ["Math", "Geography", "Creativity"],
    minutes: 25,
    discover: {
      fact: "City planners decide where people live, how they travel, and where shared places such as parks and libraries should go.",
      question: "Which place is designed for everyone in a neighborhood to share?",
      options: ["Public park", "Private bedroom", "Locked garage"],
      answer: "Public park",
    },
    makePrompt: "Choose city features, name the city, and explain how people move safely from place to place.",
    ideaChoices: ["🏠 Homes", "🏫 School", "🌳 Park", "📚 Library", "🚌 Bus route", "🚲 Bike path", "🏥 Clinic", "🌉 Bridge"],
    explainPrompts: ["My city works well because…", "I would improve the city by…"],
  },
  {
    id: "weather-reporter",
    title: "Become a Weather Reporter",
    emoji: "⛅",
    summary: "Build a forecast from observations and explain what people should prepare for.",
    minAge: 6,
    maxAge: 11,
    subjects: ["Science", "Reading"],
    minutes: 15,
    discover: {
      fact: "Weather reports combine temperature, clouds, wind, and precipitation to describe what may happen outside.",
      question: "Which word means water falling from clouds?",
      options: ["Precipitation", "Gravity", "Orbit"],
      answer: "Precipitation",
    },
    makePrompt: "Choose today’s conditions, name your weather station, and write a short forecast.",
    ideaChoices: ["☀️ Sunny", "☁️ Cloudy", "🌧️ Rain", "🌬️ Windy", "❄️ Snow", "⛈️ Thunderstorms"],
    explainPrompts: ["People should prepare by…", "My evidence for this forecast is…"],
  },
  {
    id: "mini-museum",
    title: "Curate a Mini Museum",
    emoji: "🏛️",
    summary: "Choose exhibits, write labels, and explain the story connecting them.",
    minAge: 7,
    maxAge: 12,
    subjects: ["Reading", "Science", "Creativity"],
    minutes: 25,
    discover: {
      fact: "Museum curators select objects and write labels that help visitors understand why each object matters.",
      question: "What should a museum label help a visitor understand?",
      options: ["Why the object matters", "Only its color", "Where the exit is"],
      answer: "Why the object matters",
    },
    makePrompt: "Choose exhibits, name the museum, and write one exhibit label.",
    ideaChoices: ["🦖 Fossil", "🚀 Space capsule", "🎨 Painting", "🪨 Crystal", "🤖 Early robot", "🗺️ Ancient map"],
    explainPrompts: ["The big story of my museum is…", "Visitors should remember…"],
  },
];

const EMPTY_STATE: ProjectStudioState = {
  version: 1,
  activeProjectId: null,
  projects: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function projectWeekKey(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(copy);
}

function normalizeProject(value: unknown): ProjectWork | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ProjectWork>;
  if (!raw.id || !raw.profileId || !raw.templateId || !raw.weekKey) return null;
  return {
    id: String(raw.id),
    profileId: String(raw.profileId),
    templateId: String(raw.templateId),
    weekKey: String(raw.weekKey),
    assignedAt: typeof raw.assignedAt === "string" ? raw.assignedAt : new Date().toISOString(),
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    currentStep: raw.currentStep === 1 || raw.currentStep === 2 ? raw.currentStep : 0,
    discoverAnswer: typeof raw.discoverAnswer === "string" ? raw.discoverAnswer : "",
    discoverCorrect: typeof raw.discoverCorrect === "boolean" ? raw.discoverCorrect : null,
    projectName: typeof raw.projectName === "string" ? raw.projectName : "",
    selectedIdeas: Array.isArray(raw.selectedIdeas)
      ? raw.selectedIdeas.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
    makeText: typeof raw.makeText === "string" ? raw.makeText : "",
    explainText: typeof raw.explainText === "string" ? raw.explainText : "",
    parentNote: typeof raw.parentNote === "string" ? raw.parentNote : "",
    rewardClaimed: raw.rewardClaimed === true,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseState(item: ReviewItem | undefined): ProjectStudioState {
  if (!item || item.gameSlug !== PROJECT_GAME_SLUG || item.data?.projectStudio !== true) return EMPTY_STATE;
  const raw = item.data.projectsJson;
  if (typeof raw !== "string") return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectStudioState>;
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects.map(normalizeProject).filter((row): row is ProjectWork => Boolean(row)).slice(-24)
      : [];
    const activeProjectId = typeof parsed.activeProjectId === "string" && projects.some((row) => row.id === parsed.activeProjectId)
      ? parsed.activeProjectId
      : projects.find((row) => !row.completedAt)?.id ?? null;
    return {
      version: 1,
      activeProjectId,
      projects,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function readProjectStudio(profileId: string): ProjectStudioState {
  const learning = readLearningForProfile(profileId);
  return parseState(learning.reviewQueue.find((item) => item.id === PROJECT_ITEM_ID));
}

function writeProjectStudio(profileId: string, state: ProjectStudioState): ProjectStudioState {
  const learning = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const next: ProjectStudioState = {
    ...state,
    version: 1,
    projects: state.projects.slice(-24),
    updatedAt: now,
  };
  const item: ReviewItem = {
    id: PROJECT_ITEM_ID,
    gameSlug: PROJECT_GAME_SLUG,
    skillId: "project-based-learning",
    subject: "Creativity",
    prompt: "Project Studio work and completed artifacts",
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: next.projects.filter((project) => project.completedAt).length,
    status: "resolved",
    data: {
      projectStudio: true,
      projectsJson: JSON.stringify(next),
    },
  };
  const queue = learning.reviewQueue.filter((row) => row.id !== PROJECT_ITEM_ID);
  writeLearningForProfile(profileId, {
    ...learning,
    reviewQueue: [...queue, item].slice(-100),
  });
  window.dispatchEvent(new Event(PROJECT_STUDIO_EVENT));
  return next;
}

export function projectTemplatesForAge(age: number): ProjectTemplate[] {
  const matching = PROJECT_TEMPLATES.filter((template) => age >= template.minAge && age <= template.maxAge);
  return matching.length > 0 ? matching : PROJECT_TEMPLATES;
}

export function getProjectTemplate(templateId: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 31 + value.charCodeAt(index)) >>> 0;
  return total;
}

function newProject(profileId: string, templateId: string, weekKey = projectWeekKey()): ProjectWork {
  const now = new Date().toISOString();
  return {
    id: `project:${weekKey}:${templateId}:${Date.now().toString(36)}`,
    profileId,
    templateId,
    weekKey,
    assignedAt: now,
    startedAt: null,
    completedAt: null,
    currentStep: 0,
    discoverAnswer: "",
    discoverCorrect: null,
    projectName: "",
    selectedIdeas: [],
    makeText: "",
    explainText: "",
    parentNote: "",
    rewardClaimed: false,
    updatedAt: now,
  };
}

export function ensureWeeklyProject(profile: ChildProfile): ProjectWork {
  const state = readProjectStudio(profile.id);
  const weekKey = projectWeekKey();
  const currentWeek = state.projects
    .filter((project) => project.weekKey === weekKey)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
  if (currentWeek) return currentWeek;

  const templates = projectTemplatesForAge(profile.age);
  const template = templates[hash(`${profile.id}:${weekKey}`) % templates.length];
  const project = newProject(profile.id, template.id, weekKey);
  writeProjectStudio(profile.id, {
    ...state,
    activeProjectId: project.id,
    projects: [...state.projects, project],
  });
  return project;
}

export function assignProject(profileId: string, templateId: string): ProjectWork {
  if (!getProjectTemplate(templateId)) throw new Error("Unknown project template.");
  const state = readProjectStudio(profileId);
  const project = newProject(profileId, templateId);
  writeProjectStudio(profileId, {
    ...state,
    activeProjectId: project.id,
    projects: [...state.projects, project],
  });
  return project;
}

export function updateProject(
  profileId: string,
  projectId: string,
  change: Partial<Omit<ProjectWork, "id" | "profileId" | "templateId" | "weekKey" | "assignedAt">>
): ProjectWork | null {
  const state = readProjectStudio(profileId);
  const existing = state.projects.find((project) => project.id === projectId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: ProjectWork = {
    ...existing,
    ...change,
    selectedIdeas: change.selectedIdeas ? [...new Set(change.selectedIdeas)].slice(0, 8) : existing.selectedIdeas,
    startedAt: existing.startedAt ?? now,
    updatedAt: now,
  };
  writeProjectStudio(profileId, {
    ...state,
    activeProjectId: updated.completedAt ? null : updated.id,
    projects: state.projects.map((project) => project.id === projectId ? updated : project),
  });
  return updated;
}

export function completeProject(profileId: string, projectId: string): ProjectWork | null {
  return updateProject(profileId, projectId, {
    currentStep: 2,
    completedAt: new Date().toISOString(),
  });
}

export function claimProjectReward(profileId: string, projectId: string): ProjectWork | null {
  return updateProject(profileId, projectId, { rewardClaimed: true });
}

export function readProjectHistory(profileId: string): ProjectWork[] {
  return [...readProjectStudio(profileId).projects].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

export function projectArtifactSummary(project: ProjectWork): string {
  const template = getProjectTemplate(project.templateId);
  const name = project.projectName.trim() || template?.title || "Project";
  const ideas = project.selectedIdeas.length > 0 ? project.selectedIdeas.join(", ") : "original ideas";
  const explanation = project.explainText.trim() || project.makeText.trim();
  return `${name}: ${ideas}${explanation ? `. ${explanation}` : "."}`;
}
