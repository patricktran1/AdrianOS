"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import type { Game } from "@/lib/games";
import {
  readLearningForProfile,
  stageForMastery,
  writeLearningForProfile,
  type LearningStage,
  type ReviewItem,
} from "@/lib/adrian-learning";

export type SkillDefinition = {
  id: string;
  label: string;
  subject: Game["subject"];
  description: string;
  prerequisites: string[];
  gameSlug: string;
  minAge: number;
  order: number;
  evidenceSkillIds?: string[];
};

export type SkillGoal = {
  id: string;
  skillId: string;
  targetMastery: number;
  dueDate: string;
  createdAt: string;
};

export type SkillNode = SkillDefinition & {
  mastery: number;
  attempts: number;
  correct: number;
  stage: LearningStage;
  locked: boolean;
  dueReviews: number;
  goal: SkillGoal | null;
  goalComplete: boolean;
};

const GOAL_GAME_SLUG = "adrianos-skill-goal";
const LEARNING_EVENT = "adrianos-learning-updated";
const PROGRESS_EVENT = "adrianos-progress-updated";
const FAMILY_EVENT = "adrianos-family-updated";

export const SKILL_CATALOG: SkillDefinition[] = [
  {
    id: "memory-matching",
    label: "Visual matching",
    subject: "Memory",
    description: "Notice which pictures are the same and remember where they are.",
    prerequisites: [],
    gameSlug: "memory-match",
    minAge: 3,
    order: 1,
  },
  {
    id: "memory-working-memory",
    label: "Working memory",
    subject: "Memory",
    description: "Hold several locations or ideas in mind while solving a task.",
    prerequisites: ["memory-matching"],
    gameSlug: "memory-match",
    minAge: 5,
    order: 2,
  },
  {
    id: "creativity-rhythm",
    label: "Rhythm patterns",
    subject: "Creativity",
    description: "Hear, copy, and create short musical patterns.",
    prerequisites: [],
    gameSlug: "music-maker",
    minAge: 3,
    order: 1,
  },
  {
    id: "creativity-composition",
    label: "Musical composition",
    subject: "Creativity",
    description: "Combine rhythm and sound into a longer original idea.",
    prerequisites: ["creativity-rhythm"],
    gameSlug: "music-maker",
    minAge: 5,
    order: 2,
  },
  {
    id: "logic-patterns",
    label: "Recognizing patterns",
    subject: "Logic",
    description: "Find what repeats and predict what should come next.",
    prerequisites: [],
    gameSlug: "pattern-master",
    minAge: 4,
    order: 1,
  },
  {
    id: "logic-multi-step",
    label: "Multi-step reasoning",
    subject: "Logic",
    description: "Keep track of several clues or steps before choosing an answer.",
    prerequisites: ["logic-patterns"],
    gameSlug: "pattern-master",
    minAge: 6,
    order: 2,
  },
  {
    id: "math-addition",
    label: "Addition",
    subject: "Math",
    description: "Combine two quantities and find the total.",
    prerequisites: [],
    gameSlug: "math-blast",
    minAge: 5,
    order: 1,
    evidenceSkillIds: ["math-addition"],
  },
  {
    id: "math-subtraction",
    label: "Subtraction",
    subject: "Math",
    description: "Find how many remain or how far apart two numbers are.",
    prerequisites: ["math-addition"],
    gameSlug: "math-blast",
    minAge: 6,
    order: 2,
    evidenceSkillIds: ["math-subtraction"],
  },
  {
    id: "math-money",
    label: "Money math",
    subject: "Math",
    description: "Add and subtract amounts of money in everyday situations.",
    prerequisites: ["math-addition"],
    gameSlug: "math-blast",
    minAge: 6,
    order: 3,
    evidenceSkillIds: ["math-money"],
  },
  {
    id: "math-word-problems",
    label: "Math word problems",
    subject: "Math",
    description: "Turn a short story into the correct math operation.",
    prerequisites: ["math-addition", "math-subtraction"],
    gameSlug: "treasure-map-math",
    minAge: 7,
    order: 4,
  },
  {
    id: "reading-spelling-easy",
    label: "Short-word spelling",
    subject: "Reading",
    description: "Build familiar words with four or five letters.",
    prerequisites: [],
    gameSlug: "word-builder",
    minAge: 5,
    order: 1,
    evidenceSkillIds: ["reading-spelling-easy"],
  },
  {
    id: "reading-spelling-medium",
    label: "Medium-word spelling",
    subject: "Reading",
    description: "Build longer words and remember their letter order.",
    prerequisites: ["reading-spelling-easy"],
    gameSlug: "word-builder",
    minAge: 6,
    order: 2,
    evidenceSkillIds: ["reading-spelling-medium"],
  },
  {
    id: "reading-spelling-hard",
    label: "Advanced spelling",
    subject: "Reading",
    description: "Build long science and everyday vocabulary words.",
    prerequisites: ["reading-spelling-medium"],
    gameSlug: "word-builder",
    minAge: 7,
    order: 3,
    evidenceSkillIds: ["reading-spelling-hard"],
  },
  {
    id: "reading-comprehension-detail",
    label: "Finding story details",
    subject: "Reading",
    description: "Locate important facts and answer directly from a passage.",
    prerequisites: ["reading-spelling-easy"],
    gameSlug: "reading-lab",
    minAge: 5,
    order: 4,
    evidenceSkillIds: ["reading-comprehension-detail"],
  },
  {
    id: "reading-sequencing",
    label: "Story sequencing",
    subject: "Reading",
    description: "Put events and ideas in the order shown by a passage.",
    prerequisites: ["reading-comprehension-detail"],
    gameSlug: "reading-lab",
    minAge: 6,
    order: 5,
    evidenceSkillIds: ["reading-sequencing"],
  },
  {
    id: "reading-vocabulary",
    label: "Vocabulary in context",
    subject: "Reading",
    description: "Use nearby words and events to understand unfamiliar vocabulary.",
    prerequisites: ["reading-comprehension-detail"],
    gameSlug: "reading-lab",
    minAge: 6,
    order: 6,
    evidenceSkillIds: ["reading-vocabulary"],
  },
  {
    id: "reading-inference",
    label: "Reading inference",
    subject: "Reading",
    description: "Combine passage clues with reasoning to understand what is implied.",
    prerequisites: ["reading-comprehension-detail", "reading-sequencing"],
    gameSlug: "reading-lab",
    minAge: 7,
    order: 7,
    evidenceSkillIds: ["reading-inference"],
  },
  {
    id: "writing-ideas",
    label: "Planning writing ideas",
    subject: "Reading",
    description: "Choose a clear topic, characters, reasons, facts, or events before drafting.",
    prerequisites: ["reading-comprehension-detail"],
    gameSlug: "writing-studio",
    minAge: 4,
    order: 8,
    evidenceSkillIds: ["writing-ideas"],
  },
  {
    id: "writing-sentences",
    label: "Sentence construction",
    subject: "Reading",
    description: "Turn ideas into complete sentences with enough detail for the writer’s level.",
    prerequisites: ["writing-ideas"],
    gameSlug: "writing-studio",
    minAge: 5,
    order: 9,
    evidenceSkillIds: ["writing-sentences"],
  },
  {
    id: "writing-conventions",
    label: "Capitalization and punctuation",
    subject: "Reading",
    description: "Use capital letters and ending punctuation to make sentences easy to read.",
    prerequisites: ["writing-sentences"],
    gameSlug: "writing-studio",
    minAge: 6,
    order: 10,
    evidenceSkillIds: ["writing-conventions"],
  },
  {
    id: "writing-organization",
    label: "Organizing a paragraph",
    subject: "Reading",
    description: "Connect events, reasons, or steps in a clear and useful order.",
    prerequisites: ["writing-sentences"],
    gameSlug: "writing-studio",
    minAge: 6,
    order: 11,
    evidenceSkillIds: ["writing-organization"],
  },
  {
    id: "writing-revision",
    label: "Revising a draft",
    subject: "Reading",
    description: "Reread a first draft and make a meaningful improvement before publishing.",
    prerequisites: ["writing-conventions", "writing-organization"],
    gameSlug: "writing-studio",
    minAge: 7,
    order: 12,
    evidenceSkillIds: ["writing-revision"],
  },
  {
    id: "science-earth",
    label: "Earth science",
    subject: "Science",
    description: "Understand weather, rocks, water, and Earth’s motion.",
    prerequisites: [],
    gameSlug: "science-quest",
    minAge: 6,
    order: 1,
    evidenceSkillIds: ["science-earth"],
  },
  {
    id: "science-body",
    label: "Human body",
    subject: "Science",
    description: "Understand how major body parts help us live and move.",
    prerequisites: [],
    gameSlug: "science-quest",
    minAge: 6,
    order: 2,
    evidenceSkillIds: ["science-body"],
  },
  {
    id: "science-space",
    label: "Space science",
    subject: "Science",
    description: "Understand planets, stars, gravity, and orbits.",
    prerequisites: [],
    gameSlug: "science-quest",
    minAge: 6,
    order: 3,
    evidenceSkillIds: ["science-space"],
  },
  {
    id: "science-technology",
    label: "Technology systems",
    subject: "Science",
    description: "Understand computers, energy, robots, and information.",
    prerequisites: [],
    gameSlug: "science-quest",
    minAge: 6,
    order: 4,
    evidenceSkillIds: ["science-technology"],
  },
  {
    id: "geography-map-skills",
    label: "Map skills and directions",
    subject: "Geography",
    description: "Use directions, symbols, scale, coordinates, and terrain clues to read maps.",
    prerequisites: [],
    gameSlug: "world-explorer",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["geography-map-skills"],
  },
  {
    id: "geography-land-water",
    label: "Landforms and water",
    subject: "Geography",
    description: "Understand rivers, islands, coasts, watersheds, mountains, and other physical features.",
    prerequisites: ["geography-map-skills"],
    gameSlug: "world-explorer",
    minAge: 5,
    order: 2,
    evidenceSkillIds: ["geography-land-water"],
  },
  {
    id: "geography-places-regions",
    label: "Places and regions",
    subject: "Geography",
    description: "Compare climates, settlements, population patterns, and connected regions.",
    prerequisites: ["geography-map-skills"],
    gameSlug: "world-explorer",
    minAge: 6,
    order: 3,
    evidenceSkillIds: ["geography-places-regions"],
  },
  {
    id: "geography-communities-culture",
    label: "Communities and culture",
    subject: "Geography",
    description: "Understand public places, traditions, perspectives, and how communities organize life.",
    prerequisites: ["geography-map-skills"],
    gameSlug: "world-explorer",
    minAge: 6,
    order: 4,
    evidenceSkillIds: ["geography-communities-culture"],
  },
  {
    id: "geography-human-environment",
    label: "People and environments",
    subject: "Geography",
    description: "Reason about adaptation, resources, risk, sustainability, and how places shape human choices.",
    prerequisites: ["geography-land-water", "geography-communities-culture"],
    gameSlug: "world-explorer",
    minAge: 7,
    order: 5,
    evidenceSkillIds: ["geography-human-environment"],
  },
  {
    id: "history-chronology",
    label: "Chronology and timelines",
    subject: "History",
    description: "Place events in order, compare dates, and reason about overlapping timelines.",
    prerequisites: [],
    gameSlug: "history-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["history-chronology"],
  },
  {
    id: "history-change-continuity",
    label: "Change and continuity",
    subject: "History",
    description: "Identify what changed over time and what continued beneath new tools or institutions.",
    prerequisites: ["history-chronology"],
    gameSlug: "history-lab",
    minAge: 5,
    order: 2,
    evidenceSkillIds: ["history-change-continuity"],
  },
  {
    id: "history-cause-effect",
    label: "Historical cause and effect",
    subject: "History",
    description: "Separate causes, effects, triggers, and longer-term conditions in historical change.",
    prerequisites: ["history-chronology"],
    gameSlug: "history-lab",
    minAge: 6,
    order: 3,
    evidenceSkillIds: ["history-cause-effect"],
  },
  {
    id: "history-sources-evidence",
    label: "Historical sources and evidence",
    subject: "History",
    description: "Use artifacts, documents, corroboration, source purpose, and direct evidence to test claims.",
    prerequisites: ["history-chronology"],
    gameSlug: "history-lab",
    minAge: 6,
    order: 4,
    evidenceSkillIds: ["history-sources-evidence"],
  },
  {
    id: "history-perspective",
    label: "Historical perspective",
    subject: "History",
    description: "Compare viewpoints, connect accounts to roles, and notice whose voice is absent.",
    prerequisites: ["history-sources-evidence"],
    gameSlug: "history-lab",
    minAge: 7,
    order: 5,
    evidenceSkillIds: ["history-perspective"],
  },
  {
    id: "civics-rules-responsibilities",
    label: "Rules and responsibilities",
    subject: "Civics",
    description: "Connect shared rules to their purposes and balance participation with responsibility.",
    prerequisites: [],
    gameSlug: "civic-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["civics-rules-responsibilities"],
  },
  {
    id: "civics-public-services",
    label: "Public services and institutions",
    subject: "Civics",
    description: "Match community needs to public services, institutions, budgets, and accessible delivery.",
    prerequisites: ["civics-rules-responsibilities"],
    gameSlug: "civic-lab",
    minAge: 5,
    order: 2,
    evidenceSkillIds: ["civics-public-services"],
  },
  {
    id: "civics-rights-fairness",
    label: "Rights, fairness, and inclusion",
    subject: "Civics",
    description: "Reason about fair process, participation, access, expression, safety, and minority needs.",
    prerequisites: ["civics-rules-responsibilities"],
    gameSlug: "civic-lab",
    minAge: 5,
    order: 3,
    evidenceSkillIds: ["civics-rights-fairness"],
  },
  {
    id: "civics-decision-making",
    label: "Community decision-making",
    subject: "Civics",
    description: "Use evidence, discussion, voting, compromise, pilots, and transparent trade-offs to make decisions.",
    prerequisites: ["civics-rules-responsibilities", "civics-rights-fairness"],
    gameSlug: "civic-lab",
    minAge: 6,
    order: 4,
    evidenceSkillIds: ["civics-decision-making"],
  },
  {
    id: "civics-information-literacy",
    label: "Civic information literacy",
    subject: "Civics",
    description: "Check claims, context, source quality, samples, original records, and emotional manipulation.",
    prerequisites: ["civics-rules-responsibilities"],
    gameSlug: "civic-lab",
    minAge: 6,
    order: 5,
    evidenceSkillIds: ["civics-information-literacy"],
  },
  {
    id: "economics-needs-scarcity",
    label: "Needs, wants, and scarcity",
    subject: "Economics",
    description: "Distinguish needs from wants and reason about limited time, money, space, and resources.",
    prerequisites: [],
    gameSlug: "economics-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["economics-needs-scarcity"],
  },
  {
    id: "economics-budget-saving",
    label: "Budgeting and saving",
    subject: "Economics",
    description: "Build balanced plans, save toward goals, prepare for surprises, and adapt when costs change.",
    prerequisites: ["economics-needs-scarcity"],
    gameSlug: "economics-lab",
    minAge: 5,
    order: 2,
    evidenceSkillIds: ["economics-budget-saving"],
  },
  {
    id: "economics-tradeoffs",
    label: "Trade-offs and opportunity cost",
    subject: "Economics",
    description: "Identify what a choice gives up and compare immediate and future benefits and costs.",
    prerequisites: ["economics-needs-scarcity"],
    gameSlug: "economics-lab",
    minAge: 5,
    order: 3,
    evidenceSkillIds: ["economics-tradeoffs"],
  },
  {
    id: "economics-markets-prices",
    label: "Markets, prices, and exchange",
    subject: "Economics",
    description: "Interpret supply, demand, price signals, voluntary exchange, competition, and value.",
    prerequisites: ["economics-needs-scarcity", "economics-tradeoffs"],
    gameSlug: "economics-lab",
    minAge: 6,
    order: 4,
    evidenceSkillIds: ["economics-markets-prices"],
  },
  {
    id: "economics-work-enterprise",
    label: "Work, value, and enterprise",
    subject: "Economics",
    description: "Understand costs, profit, productivity, entrepreneurship, reinvestment, and incentives.",
    prerequisites: ["economics-budget-saving"],
    gameSlug: "economics-lab",
    minAge: 6,
    order: 5,
    evidenceSkillIds: ["economics-work-enterprise"],
  },
  {
    id: "wellbeing-emotional-awareness",
    label: "Emotional awareness",
    subject: "Wellbeing",
    description: "Name emotions, notice body clues, and recognize that several feelings can be true at once.",
    prerequisites: [],
    gameSlug: "feelings-friendship-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["wellbeing-emotional-awareness"],
  },
  {
    id: "wellbeing-self-regulation",
    label: "Self-regulation",
    subject: "Wellbeing",
    description: "Pause, calm the body, separate worries from plans, and focus effort on controllable actions.",
    prerequisites: ["wellbeing-emotional-awareness"],
    gameSlug: "feelings-friendship-lab",
    minAge: 4,
    order: 2,
    evidenceSkillIds: ["wellbeing-self-regulation"],
  },
  {
    id: "wellbeing-communication-listening",
    label: "Communication and listening",
    subject: "Wellbeing",
    description: "Make clear requests, listen for understanding, use I-messages, and discuss difficult problems directly.",
    prerequisites: ["wellbeing-emotional-awareness"],
    gameSlug: "feelings-friendship-lab",
    minAge: 5,
    order: 3,
    evidenceSkillIds: ["wellbeing-communication-listening"],
  },
  {
    id: "wellbeing-empathy-perspective",
    label: "Empathy and perspective",
    subject: "Wellbeing",
    description: "Respect different experiences, hold two perspectives at once, and use curiosity before assumptions.",
    prerequisites: ["wellbeing-emotional-awareness", "wellbeing-communication-listening"],
    gameSlug: "feelings-friendship-lab",
    minAge: 5,
    order: 4,
    evidenceSkillIds: ["wellbeing-empathy-perspective"],
  },
  {
    id: "wellbeing-conflict-boundaries",
    label: "Conflict resolution and boundaries",
    subject: "Wellbeing",
    description: "Create fair solutions, repair harm, state boundaries clearly, and protect privacy and consent.",
    prerequisites: ["wellbeing-self-regulation", "wellbeing-communication-listening"],
    gameSlug: "feelings-friendship-lab",
    minAge: 5,
    order: 5,
    evidenceSkillIds: ["wellbeing-conflict-boundaries"],
  },
  {
    id: "health-daily-care",
    label: "Daily body care",
    subject: "Health",
    description: "Use sleep, hydration, varied food, movement, and recovery to care for the body each day.",
    prerequisites: [],
    gameSlug: "health-safety-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["health-daily-care"],
  },
  {
    id: "health-hygiene-germs",
    label: "Hygiene and germ prevention",
    subject: "Health",
    description: "Use handwashing, cough habits, sun protection, and food-safety reasoning to reduce preventable exposure.",
    prerequisites: ["health-daily-care"],
    gameSlug: "health-safety-lab",
    minAge: 4,
    order: 2,
    evidenceSkillIds: ["health-hygiene-germs"],
  },
  {
    id: "health-body-signals-help",
    label: "Body signals and asking for help",
    subject: "Health",
    description: "Notice important body signals, stop unsafe activity, describe patterns, and involve a trusted adult.",
    prerequisites: ["health-daily-care"],
    gameSlug: "health-safety-lab",
    minAge: 4,
    order: 3,
    evidenceSkillIds: ["health-body-signals-help"],
  },
  {
    id: "health-medicine-poison",
    label: "Medicine and poison safety",
    subject: "Health",
    description: "Avoid unknown substances, never share medicine, check labels and ingredients, and use trusted expert help.",
    prerequisites: ["health-body-signals-help"],
    gameSlug: "health-safety-lab",
    minAge: 4,
    order: 4,
    evidenceSkillIds: ["health-medicine-poison"],
  },
  {
    id: "health-injury-emergency",
    label: "Injury and emergency response",
    subject: "Health",
    description: "Choose protective gear, get adult help, recognize urgent danger, and contact emergency or poison services appropriately.",
    prerequisites: ["health-body-signals-help"],
    gameSlug: "health-safety-lab",
    minAge: 4,
    order: 5,
    evidenceSkillIds: ["health-injury-emergency"],
  },
  {
    id: "digital-privacy-sharing",
    label: "Privacy and thoughtful sharing",
    subject: "Digital Citizenship",
    description: "Protect location, identity, routines, images, and personal details before sharing.",
    prerequisites: [],
    gameSlug: "digital-citizenship-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["digital-privacy-sharing"],
  },
  {
    id: "digital-security-scams",
    label: "Passwords, scams, and account safety",
    subject: "Digital Citizenship",
    description: "Keep credentials private, recognize suspicious pressure, and use trusted routes to secure accounts.",
    prerequisites: ["digital-privacy-sharing"],
    gameSlug: "digital-citizenship-lab",
    minAge: 4,
    order: 2,
    evidenceSkillIds: ["digital-security-scams"],
  },
  {
    id: "digital-kindness-boundaries",
    label: "Online kindness and boundaries",
    subject: "Digital Citizenship",
    description: "Communicate respectfully, protect consent and privacy, and reject harassment or doxxing.",
    prerequisites: ["digital-privacy-sharing"],
    gameSlug: "digital-citizenship-lab",
    minAge: 5,
    order: 3,
    evidenceSkillIds: ["digital-kindness-boundaries"],
  },
  {
    id: "digital-media-ai-literacy",
    label: "Media and AI literacy",
    subject: "Digital Citizenship",
    description: "Verify dramatic claims, inspect sources, and treat edited or AI-generated content as unproven until checked.",
    prerequisites: ["digital-privacy-sharing"],
    gameSlug: "digital-citizenship-lab",
    minAge: 5,
    order: 4,
    evidenceSkillIds: ["digital-media-ai-literacy"],
  },
  {
    id: "digital-balance-help",
    label: "Screen balance and getting help",
    subject: "Digital Citizenship",
    description: "Use stopping plans, protect sleep and attention, and involve a trusted adult when online pressure feels unsafe.",
    prerequisites: ["digital-privacy-sharing"],
    gameSlug: "digital-citizenship-lab",
    minAge: 4,
    order: 5,
    evidenceSkillIds: ["digital-balance-help"],
  },
  {
    id: "music-steady-beat",
    label: "Steady beat",
    subject: "Music",
    description: "Hear, maintain, and compare a steady pulse and changes in tempo.",
    prerequisites: [],
    gameSlug: "music-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["music-steady-beat"],
  },
  {
    id: "music-rhythm-patterns",
    label: "Rhythm patterns",
    subject: "Music",
    description: "Recognize short and long sounds, rests, repeated rhythm cells, and syncopation.",
    prerequisites: ["music-steady-beat"],
    gameSlug: "music-lab",
    minAge: 4,
    order: 2,
    evidenceSkillIds: ["music-rhythm-patterns"],
  },
  {
    id: "music-pitch-direction",
    label: "Pitch direction",
    subject: "Music",
    description: "Hear whether notes move higher, lower, repeat, form contours, or span larger intervals.",
    prerequisites: [],
    gameSlug: "music-lab",
    minAge: 4,
    order: 3,
    evidenceSkillIds: ["music-pitch-direction"],
  },
  {
    id: "music-listening-form",
    label: "Musical listening",
    subject: "Music",
    description: "Identify repetition, contrast, phrase relationships, and simple musical form.",
    prerequisites: ["music-steady-beat", "music-pitch-direction"],
    gameSlug: "music-lab",
    minAge: 5,
    order: 4,
    evidenceSkillIds: ["music-listening-form"],
  },
  {
    id: "music-composition",
    label: "Simple composition",
    subject: "Music",
    description: "Use motifs, home notes, contour, rhythm, and variation to shape musical ideas.",
    prerequisites: ["music-rhythm-patterns", "music-pitch-direction"],
    gameSlug: "music-lab",
    minAge: 5,
    order: 5,
    evidenceSkillIds: ["music-composition"],
  },
  {
    id: "art-color-relationships",
    label: "Color relationships",
    subject: "Art",
    description: "Use warm and cool colors, contrast, value, and palette choices intentionally.",
    prerequisites: [],
    gameSlug: "art-design-lab",
    minAge: 4,
    order: 1,
    evidenceSkillIds: ["art-color-relationships"],
  },
  {
    id: "art-shape-form",
    label: "Shape and form",
    subject: "Art",
    description: "Recognize geometric and organic shapes and use overlap, planes, and shading to suggest form.",
    prerequisites: [],
    gameSlug: "art-design-lab",
    minAge: 4,
    order: 2,
    evidenceSkillIds: ["art-shape-form"],
  },
  {
    id: "art-composition",
    label: "Composition and balance",
    subject: "Art",
    description: "Create focal points, visual balance, hierarchy, and purposeful use of space.",
    prerequisites: ["art-shape-form"],
    gameSlug: "art-design-lab",
    minAge: 5,
    order: 3,
    evidenceSkillIds: ["art-composition"],
  },
  {
    id: "art-observation",
    label: "Visual observation",
    subject: "Art",
    description: "Look closely, notice evidence, compare details, and explain visual effects precisely.",
    prerequisites: [],
    gameSlug: "art-design-lab",
    minAge: 4,
    order: 4,
    evidenceSkillIds: ["art-observation"],
  },
  {
    id: "art-visual-storytelling",
    label: "Visual storytelling",
    subject: "Art",
    description: "Use sequence, symbols, setting, and design choices to communicate an idea without relying only on words.",
    prerequisites: ["art-composition", "art-observation"],
    gameSlug: "art-design-lab",
    minAge: 5,
    order: 5,
    evidenceSkillIds: ["art-visual-storytelling"],
  },
  {
    id: "coding-sequences",
    label: "Command sequences",
    subject: "Coding",
    description: "Put commands in the right order to reach a goal.",
    prerequisites: [],
    gameSlug: "robot-commands",
    minAge: 6,
    order: 1,
  },
  {
    id: "coding-turns",
    label: "Direction and turns",
    subject: "Coding",
    description: "Predict how left and right turns change direction.",
    prerequisites: ["coding-sequences"],
    gameSlug: "robot-commands",
    minAge: 6,
    order: 2,
  },
  {
    id: "coding-loops",
    label: "Loops",
    subject: "Coding",
    description: "Use repeated commands to solve a route efficiently.",
    prerequisites: ["coding-turns"],
    gameSlug: "robot-commands",
    minAge: 7,
    order: 3,
  },
  {
    id: "coding-debugging",
    label: "Debugging",
    subject: "Coding",
    description: "Find the command that caused a plan to fail and repair it.",
    prerequisites: ["coding-loops"],
    gameSlug: "robot-commands",
    minAge: 7,
    order: 4,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function goalFromReview(item: ReviewItem): SkillGoal | null {
  if (item.gameSlug !== GOAL_GAME_SLUG || item.data?.goal !== true) return null;
  const target = item.data.targetMastery;
  const dueDate = item.data.dueDate;
  const createdAt = item.data.createdAt;
  return {
    id: item.id,
    skillId: item.skillId,
    targetMastery: typeof target === "number" ? clamp(Math.round(target), 50, 100) : 80,
    dueDate: typeof dueDate === "string" ? dueDate : item.dueAt,
    createdAt: typeof createdAt === "string" ? createdAt : item.updatedAt,
  };
}

export function readSkillGoals(profileId: string): SkillGoal[] {
  return readLearningForProfile(profileId).reviewQueue
    .map(goalFromReview)
    .filter((goal): goal is SkillGoal => Boolean(goal));
}

export function setSkillGoal(
  profileId: string,
  skillId: string,
  targetMastery = 80,
  dueDate?: string
): SkillGoal {
  const state = readLearningForProfile(profileId);
  const definition = SKILL_CATALOG.find((skill) => skill.id === skillId);
  if (!definition) throw new Error("Unknown skill.");
  const now = new Date();
  const due = dueDate ?? localDateKey(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const id = `goal:${skillId}`;
  const goal: SkillGoal = {
    id,
    skillId,
    targetMastery: clamp(Math.round(targetMastery), 50, 100),
    dueDate: due,
    createdAt: now.toISOString(),
  };
  const item: ReviewItem = {
    id,
    gameSlug: GOAL_GAME_SLUG,
    skillId,
    subject: definition.subject,
    prompt: `Parent goal: ${definition.label}`,
    correctAnswer: "",
    dueAt: `${due}T23:59:59.999Z`,
    updatedAt: now.toISOString(),
    successes: 0,
    status: "resolved",
    data: {
      goal: true,
      targetMastery: goal.targetMastery,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
    },
  };
  const reviewQueue = [
    ...state.reviewQueue.filter((row) => row.id !== id),
    item,
  ].slice(-100);
  writeLearningForProfile(profileId, { ...state, reviewQueue });
  return goal;
}

export function removeSkillGoal(profileId: string, skillId: string): void {
  const state = readLearningForProfile(profileId);
  writeLearningForProfile(profileId, {
    ...state,
    reviewQueue: state.reviewQueue.filter(
      (item) => !(item.gameSlug === GOAL_GAME_SLUG && item.skillId === skillId)
    ),
  });
}

function explicitEvidence(definition: SkillDefinition, profileId: string) {
  const state = readLearningForProfile(profileId);
  const ids = definition.evidenceSkillIds ?? [definition.id];
  const skills = ids
    .map((id) => state.skills[id])
    .filter((skill) => Boolean(skill));
  if (skills.length === 0) return { mastery: 0, attempts: 0, correct: 0 };
  const attempts = skills.reduce((sum, skill) => sum + skill.attempts, 0);
  const correct = skills.reduce((sum, skill) => sum + skill.correct, 0);
  const mastery = Math.round(
    skills.reduce((sum, skill) => sum + skill.mastery, 0) / skills.length
  );
  return { mastery, attempts, correct };
}

function broadGameSignal(definition: SkillDefinition, progress: AdrianProgress): number {
  const game = progress.games[definition.gameSlug];
  if (!game) return 0;
  const raw = game.plays * 5 + game.completions * 13 + (game.bestScore > 0 ? 7 : 0);
  return clamp(raw - Math.max(0, definition.order - 1) * 7, 0, 55);
}

export function getSkillGraph(
  profile: ChildProfile,
  progress: AdrianProgress
): SkillNode[] {
  const state = readLearningForProfile(profile.id);
  const goals = readSkillGoals(profile.id);
  const now = new Date().toISOString();
  const appropriate = SKILL_CATALOG.filter((skill) => skill.minAge <= profile.age + 1);
  const base = new Map<string, Omit<SkillNode, "locked">>();

  for (const definition of appropriate) {
    const evidence = explicitEvidence(definition, profile.id);
    const broad = broadGameSignal(definition, progress);
    const mastery = evidence.attempts > 0
      ? evidence.mastery
      : broad;
    const dueReviews = state.reviewQueue.filter(
      (item) =>
        item.gameSlug !== GOAL_GAME_SLUG &&
        item.skillId === definition.id &&
        item.status === "due" &&
        item.dueAt <= now
    ).length;
    const goal = goals.find((item) => item.skillId === definition.id) ?? null;
    base.set(definition.id, {
      ...definition,
      mastery,
      attempts: evidence.attempts,
      correct: evidence.correct,
      stage: stageForMastery(mastery, evidence.attempts),
      dueReviews,
      goal,
      goalComplete: Boolean(goal && mastery >= goal.targetMastery),
    });
  }

  return appropriate.map((definition) => {
    const node = base.get(definition.id)!;
    const hasDirectEvidence = node.attempts > 0 || node.mastery > 0;
    const locked = !hasDirectEvidence && definition.prerequisites.some((id) => {
      const prerequisite = base.get(id);
      return !prerequisite || prerequisite.mastery < 35;
    });
    return { ...node, locked };
  });
}

export function getRecommendedSkill(nodes: SkillNode[]): SkillNode | null {
  const available = nodes.filter((node) => !node.locked && node.stage !== "Mastered");
  const activeGoal = available
    .filter((node) => node.goal && !node.goalComplete)
    .sort((a, b) => a.goal!.dueDate.localeCompare(b.goal!.dueDate))[0];
  if (activeGoal) return activeGoal;
  const review = available
    .filter((node) => node.dueReviews > 0)
    .sort((a, b) => b.dueReviews - a.dueReviews)[0];
  if (review) return review;
  return available.sort((a, b) => {
    if (a.subject !== b.subject) return a.mastery - b.mastery;
    return a.order - b.order;
  })[0] ?? null;
}

export function skillHref(node: SkillNode): string {
  const params = new URLSearchParams();
  if (node.dueReviews > 0) params.set("review", "1");
  if (node.gameSlug === "math-blast") {
    const topic = node.id === "math-money"
      ? "money"
      : node.id === "math-subtraction"
        ? "subtraction"
        : "addition";
    params.set("topic", topic);
    params.set("difficulty", String(node.mastery >= 78 ? 5 : node.mastery >= 38 ? 3 : 1));
  }
  if (node.gameSlug === "word-builder") {
    const difficulty = node.id.endsWith("hard")
      ? "Hard"
      : node.id.endsWith("medium")
        ? "Medium"
        : "Easy";
    params.set("difficulty", difficulty);
  }
  if (node.gameSlug === "reading-lab") {
    const level = node.id === "reading-inference"
      ? "Challenge"
      : node.id === "reading-comprehension-detail"
        ? "Starter"
        : "Growing";
    params.set("level", level);
  }
  if (node.gameSlug === "art-design-lab") {
    const level = node.id === "art-color-relationships" || node.id === "art-shape-form"
      ? "Color Explorer"
      : node.id === "art-composition" || node.id === "art-visual-storytelling"
        ? "Design Detective"
        : "Picture Maker";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "music-lab") {
    const level = node.id === "music-steady-beat" || node.id === "music-pitch-direction"
      ? "Beat Starter"
      : node.id === "music-listening-form" || node.id === "music-composition"
        ? "Music Detective"
        : "Melody Maker";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "digital-citizenship-lab") {
    const level = node.id === "digital-privacy-sharing" || node.id === "digital-balance-help"
      ? "Safe Starter"
      : node.id === "digital-media-ai-literacy" || node.id === "digital-security-scams"
        ? "Digital Detective"
        : "Smart Sharer";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "health-safety-lab") {
    const level = node.id === "health-daily-care" || node.id === "health-hygiene-germs"
      ? "Healthy Helper"
      : node.id === "health-medicine-poison" || node.id === "health-injury-emergency"
        ? "Safety Strategist"
        : "Body Steward";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "feelings-friendship-lab") {
    const level = node.id === "wellbeing-emotional-awareness" || node.id === "wellbeing-self-regulation"
      ? "Feelings Finder"
      : node.id === "wellbeing-conflict-boundaries"
        ? "Calm Problem Solver"
        : "Friendship Builder";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "economics-lab") {
    const level = node.id === "economics-needs-scarcity"
      ? "Money Explorer"
      : node.id === "economics-markets-prices" || node.id === "economics-work-enterprise"
        ? "Market Thinker"
        : "Budget Builder";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "civic-lab") {
    const level = node.id === "civics-rules-responsibilities"
      ? "Community Helper"
      : node.id === "civics-information-literacy" || node.id === "civics-decision-making"
        ? "Civic Designer"
        : "Citizen";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "history-lab") {
    const level = node.id === "history-chronology"
      ? "Time Traveler"
      : node.id === "history-perspective"
        ? "Evidence Detective"
        : "Historian";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "world-explorer") {
    const level = node.id === "geography-map-skills"
      ? "Navigator"
      : node.id === "geography-human-environment"
        ? "World Builder"
        : "Explorer";
    params.set("level", level);
    params.set("focus", node.id);
  }
  if (node.gameSlug === "science-quest") {
    const topic = node.id.replace("science-", "");
    params.set("topic", topic.charAt(0).toUpperCase() + topic.slice(1));
  }
  const query = params.toString();
  return `/games/${node.gameSlug}${query ? `?${query}` : ""}`;
}

export function useSkillGraph(profile: ChildProfile, progress: AdrianProgress) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(LEARNING_EVENT, refresh);
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener(FAMILY_EVENT, refresh);
    return () => {
      window.removeEventListener(LEARNING_EVENT, refresh);
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener(FAMILY_EVENT, refresh);
    };
  }, []);

  const nodes = useMemo(
    () => getSkillGraph(profile, progress),
    [profile.id, profile.age, progress, revision]
  );
  const goals = useMemo(
    () => readSkillGoals(profile.id),
    [profile.id, revision]
  );
  const recommended = useMemo(() => getRecommendedSkill(nodes), [nodes]);

  return { nodes, goals, recommended };
}
