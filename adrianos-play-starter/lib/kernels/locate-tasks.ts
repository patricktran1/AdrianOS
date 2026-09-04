/**
 * LOCATE: the task engine for finding evidence in a text.
 *
 * BUILD asks whether a child can construct an idea, PLACE whether they can
 * position it, DEDUCE whether they can arrive at it from relationships. None
 * of them can ask the question reading actually turns on: *how do you know?*
 *
 * A three-option comprehension question cannot either. A child who read
 * "He put on a yellow raincoat" and a child who guessed between three colours
 * produce the same row — right, on a one-in-three baseline. So the passage is
 * not scenery here. The child marks the sentence that tells them before they
 * answer, which makes the part that was previously invisible — whether the
 * text was used at all — into an observable action.
 *
 * Everything here is pure and derived from the existing story bank: no new
 * prose, no runtime randomness beyond a seed, and no network.
 */

import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
// Relative with extension so the module loads under node type stripping
// (unit tests) as well as the bundler.
import { createSeededRandom, seededShuffle } from "../deterministic-random.ts";
import {
  READING_SKILLS,
  READING_STORIES,
  type ReadingLevel,
  type ReadingSkill,
  type ReadingStory,
} from "../adrian-reading-bank.ts";

/** One sentence of a passage, as the child sees and taps it. */
export type LocateSentence = {
  id: string;
  text: string;
};

/** One answer a child can give. */
export type LocateOption = {
  id: string;
  text: string;
};

export type LocateTask = {
  id: string;
  skillId: string;
  skillLabel: string;
  subject: "Reading";
  standardCode: string;
  storyId: string;
  title: string;
  emoji: string;
  /** The passage, in reading order. Never reordered: this is not sequencing. */
  sentences: LocateSentence[];
  /** The question. Short; the passage carries the content. */
  prompt: string;
  options: LocateOption[];
  answerId: string;
  /**
   * The sentences that make the answer knowable.
   *
   * Authored rather than derived. For a detail question the answer's words
   * are usually in the sentence and could be matched, but for an inference
   * they are deliberately not — "Pip saw dark clouds" is what tells you the
   * raincoat was for rain, and no string comparison finds that.
   */
  supportingIds: string[];
  hint: string;
  explanation: string;
};

/** Skills LOCATE can express. Sequencing is left to PLACE and DEDUCE. */
export const LOCATE_SKILLS: string[] = [
  "reading-comprehension-detail",
  "reading-vocabulary",
  "reading-inference",
];

/** Which reading-bank skill key each id belongs to. */
const SKILL_KEY_BY_ID = new Map<string, ReadingSkill>([
  [READING_SKILLS.detail.id, "detail"],
  [READING_SKILLS.vocabulary.id, "vocabulary"],
  [READING_SKILLS.inference.id, "inference"],
]);

/**
 * Reading standards for citing the text, by grade band. The verb is the same
 * at every age; what changes is how much text the child holds at once.
 */
function standardFor(grade: ElementaryGrade): string {
  if (grade <= 0) return "RL.K.1";
  if (grade <= 1) return "RL.1.1";
  if (grade <= 2) return "RL.2.1";
  return "RL.3.1";
}

/** Reading level for a grade, matching how the bank is banded. */
function levelFor(grade: ElementaryGrade): ReadingLevel {
  if (grade <= 1) return "Starter";
  if (grade <= 3) return "Growing";
  return "Challenge";
}

const TERMINALS = new Set([".", "!", "?"]);
const CLOSERS = new Set(["'", '"', "’", "”"]);

/**
 * Splits a passage into sentences.
 *
 * Hand-rolled and linear rather than a regex: the one this replaced pinned a
 * repetition to the end of the input, which is the shape that backtracks
 * quadratically and was removed from this codebase once already.
 *
 * Two rules beyond "break after . ! ?": a closing quote belongs to the
 * sentence it ends, and a lowercase word after one continues it — so
 * "'Good night, Grandpa.' Dad helped" breaks and "a faint 'Hello!' returned
 * from the cliffs" does not.
 */
export function splitSentences(passage: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let index = 0;

  while (index < passage.length) {
    const character = passage[index];
    if (!TERMINALS.has(character)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < passage.length && TERMINALS.has(passage[end])) end += 1;
    while (end < passage.length && CLOSERS.has(passage[end])) end += 1;

    let next = end;
    while (next < passage.length && passage[next] === " ") next += 1;
    // Nothing follows, or what follows opens a new sentence.
    const following = passage[next];
    const continues = next > end
      && following !== undefined
      && following === following.toLowerCase()
      && following !== following.toUpperCase();
    if (next === end && next < passage.length) {
      index = end;
      continue;
    }
    if (continues) {
      index = end;
      continue;
    }
    sentences.push(passage.slice(start, end).trim());
    start = next;
    index = next;
  }

  const tail = passage.slice(start).trim();
  if (tail.length > 0) sentences.push(tail);
  return sentences;
}

export const LOCATE_RUN_LENGTH = 4;

export type LocateRunInput = {
  profileId: string;
  dayKey: string;
  grade: ElementaryGrade;
  skillId?: string | null;
};

/** The skill a run will actually teach, matched against this module's list. */
export function resolveLocateSkill(
  grade: ElementaryGrade,
  skillId?: string | null
): string {
  return (
    LOCATE_SKILLS.find((candidate) => candidate === skillId)
    ?? defaultLocateSkill(grade)
  );
}

export function defaultLocateSkill(grade: ElementaryGrade): string {
  return grade <= 1 ? "reading-comprehension-detail" : "reading-inference";
}

/** Stories at the child's level, falling back so a run is always possible. */
function storiesFor(grade: ElementaryGrade, skillKey: ReadingSkill): ReadingStory[] {
  const level = levelFor(grade);
  const has = (story: ReadingStory) =>
    story.questions.some((question) => question.skill === skillKey);
  const banded = READING_STORIES.filter((story) => story.level === level && has(story));
  return banded.length > 0 ? banded : READING_STORIES.filter(has);
}

/**
 * A run of tasks for one visit: one skill, different stories, stable within a
 * day so a same-day replay is a fair rematch.
 */
export function buildLocateRun(input: LocateRunInput): LocateTask[] {
  const skillId = resolveLocateSkill(input.grade, input.skillId);
  const skillKey = SKILL_KEY_BY_ID.get(skillId) ?? "detail";
  const pool = storiesFor(input.grade, skillKey);
  const ordered = seededShuffle(pool, `${input.profileId}:${input.dayKey}:locate:${skillId}`);

  const tasks: LocateTask[] = [];
  for (const story of ordered) {
    if (tasks.length >= LOCATE_RUN_LENGTH) break;
    const task = locateTask(story, skillKey, skillId, input);
    if (task) tasks.push(task);
  }
  return tasks;
}

function locateTask(
  story: ReadingStory,
  skillKey: ReadingSkill,
  skillId: string,
  input: LocateRunInput
): LocateTask | null {
  const question = story.questions.find((row) => row.skill === skillKey);
  if (!question) return null;
  const sentences = splitSentences(story.passage).map((text, index) => ({
    id: `s${index}`,
    text,
  }));
  const supportingIds = question.supports
    .filter((index) => index >= 0 && index < sentences.length)
    .map((index) => `s${index}`);
  if (supportingIds.length === 0) return null;

  const random = createSeededRandom(`${input.profileId}:${input.dayKey}:${story.id}`);
  const options = seededShuffle(
    question.options.map((text, index) => ({ id: `o${index}`, text })),
    `${input.profileId}:${input.dayKey}:${story.id}:options:${Math.floor(random() * 4)}`
  );
  const answer = options.find((option) => option.text === question.answer);
  if (!answer) return null;

  const label = READING_SKILLS[skillKey].label;
  return {
    id: `locate-${story.id}-${question.id}`,
    skillId,
    skillLabel: label,
    subject: "Reading",
    standardCode: standardFor(input.grade),
    storyId: story.id,
    title: story.title,
    emoji: story.emoji,
    sentences,
    prompt: question.prompt,
    options,
    answerId: answer.id,
    supportingIds,
    hint: question.hint,
    explanation: question.explanation,
  };
}
