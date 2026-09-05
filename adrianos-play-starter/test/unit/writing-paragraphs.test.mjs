import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKernelRun,
  judgeKernelAnswer,
  KERNEL_RUN_LENGTH,
  KERNEL_SKILLS,
  LONG_LABEL_CHARS,
} from "../../lib/kernels/kernel-tasks.ts";
import { WRITING_PARAGRAPHS } from "../../lib/writing/paragraph-bank.ts";
import { READING_STORIES } from "../../lib/adrian-reading-bank.ts";
import { splitSentences } from "../../lib/kernels/locate-tasks.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];
const SHIFTS = [-1, 0, 1];
const SENTENCES_PER_LEVEL = { Starter: 3, Growing: 4, Challenge: 5 };

function runs(skillId = "writing-organization") {
  const out = [];
  for (const grade of GRADES) {
    for (const difficultyShift of SHIFTS) {
      out.push({
        grade,
        difficultyShift,
        tasks: buildKernelRun({
          verb: "place",
          profileId: "kid",
          grade,
          skillId,
          difficultyShift,
          dayKey: "2026-09-05",
        }),
      });
    }
  }
  return out;
}

/*
 * A sentence that could open the paragraph is a sentence that might belong
 * somewhere else too. Every sentence after the first has to point backwards —
 * with a connective, a pronoun, or a definite reference to something named
 * earlier — or the ordering has more than one right answer and a child who
 * organises it perfectly well is marked wrong.
 */
const CUE = /^(Then|So|Next|Finally|Later|First|Now|After|Once|Soon|That|Those|Because|While|When|By|At|During|Right|One|But|And|Inside|Outside|Nearby|Meanwhile|Afterwards)\b/i;
const PRONOUN = /\b(he|she|it|they|him|her|them|his|hers|its|their|that|those|this|these|there|here|again)\b/i;
const STOP = new Set(["a", "an", "and", "the", "of", "to", "in", "on", "at", "for", "with",
  "was", "were", "is", "are", "had", "has", "have", "did", "do", "not", "but", "so", "then",
  "into", "onto", "over", "out", "up", "down", "all", "one", "two", "his", "her", "its",
  "their", "she", "he", "it", "they", "them", "him", "our", "my", "we", "i", "you", "that",
  "this", "these", "those", "from", "by", "as", "be", "been", "when", "while", "very"]);

/** Crude stem, so "bottles" links to "bottle" and "smells" to "smell". */
function stem(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  return w.replace(/(ing|ed|es|s)$/, "");
}

function contentWords(sentence) {
  return new Set(
    sentence.split(/\s+/)
      .map(stem)
      .filter((word) => word.length > 2 && !STOP.has(word))
  );
}

/**
 * Whether a sentence needs something before it, so it cannot open.
 *
 * Three ways a sentence can be tied to what came before: it opens with a
 * connective, it uses a pronoun or demonstrative, or it simply talks about
 * something already named. The third is the one that catches the cases a word
 * list misses — "Inside, a noisy machine swallowed each bottle" is pinned by
 * "bottle", not by any device an enumeration would have listed.
 */
function pointsBackward(sentence, earlier) {
  if (CUE.test(sentence)) return true;
  if (PRONOUN.test(sentence)) return true;
  const before = new Set(earlier.flatMap((row) => [...contentWords(row)]));
  for (const word of contentWords(sentence)) {
    if (before.has(word)) return true;
  }
  return false;
}

/*
 * The predicate is a proxy, so it is worth proving it can still say no. A
 * sentence that introduces everything it mentions could sit anywhere, and
 * that is exactly the paragraph this guard exists to reject.
 */
test("the guard rejects a sentence that could sit anywhere", () => {
  const earlier = ["A small brown dog barked at a passing van."];
  assert.equal(pointsBackward("Rain fell on a quiet field all afternoon.", earlier), false);
  assert.equal(pointsBackward("Two children built a sandcastle by the sea.", earlier), false);
  assert.equal(pointsBackward("Then the noise stopped.", earlier), true);
  assert.equal(pointsBackward("She carried the empty bowl to the sink.", earlier), true);
  assert.equal(pointsBackward("The dog wagged a happy tail.", earlier), true);
});

test("every sentence after the first points back at something before it", () => {
  for (const paragraph of WRITING_PARAGRAPHS) {
    const [opening, ...rest] = paragraph.sentences;
    assert.ok(
      !CUE.test(opening),
      `${paragraph.id} opens with a connective, so it cannot be the first sentence: "${opening}"`
    );
    rest.forEach((sentence, index) => {
      assert.ok(
        pointsBackward(sentence, paragraph.sentences.slice(0, index + 1)),
        `${paragraph.id} has a sentence that could open the paragraph: "${sentence}"`
      );
    });
  }
});

test("the bank is not one formula a child could solve without reading", () => {
  let fullyCued = 0;
  for (const paragraph of WRITING_PARAGRAPHS) {
    const rest = paragraph.sentences.slice(1);
    if (rest.every((sentence) => CUE.test(sentence))) fullyCued += 1;
  }
  // Some cue words are the point — knowing what "then" and "so" do is part of
  // organising writing. But if every paragraph were solvable by reading only
  // first words, the task would never ask a child to follow a reference.
  assert.ok(
    fullyCued / WRITING_PARAGRAPHS.length < 0.7,
    `${fullyCued}/${WRITING_PARAGRAPHS.length} paragraphs can be ordered from first words alone`
  );
});

test("paragraphs are banded, uniquely named, and complete", () => {
  const ids = WRITING_PARAGRAPHS.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, "paragraph ids must be unique");
  const perLevel = {};
  for (const paragraph of WRITING_PARAGRAPHS) {
    perLevel[paragraph.level] = (perLevel[paragraph.level] ?? 0) + 1;
    assert.equal(
      paragraph.sentences.length,
      SENTENCES_PER_LEVEL[paragraph.level],
      `${paragraph.id} has the wrong number of sentences for ${paragraph.level}`
    );
    assert.ok(paragraph.title.trim().length > 0, `${paragraph.id} has no title`);
    for (const sentence of paragraph.sentences) {
      assert.match(sentence, /^[A-Z]/, `${paragraph.id}: "${sentence}" has no capital`);
      assert.match(sentence, /[.!?]$/, `${paragraph.id}: "${sentence}" has no ending mark`);
    }
  }
  for (const level of Object.keys(SENTENCES_PER_LEVEL)) {
    assert.ok(perLevel[level] >= 12, `${level} needs enough paragraphs to be practice`);
  }
});

/*
 * A child who met a passage in Spyglass Bay saw it in its correct order. Handing
 * the same text back scrambled would measure what they remember, not how they
 * organise.
 */
test("no paragraph reuses a sentence from the story bank", () => {
  const fromStories = new Set(
    READING_STORIES.flatMap((story) => splitSentences(story.passage))
      .map((sentence) => sentence.toLowerCase())
  );
  for (const paragraph of WRITING_PARAGRAPHS) {
    for (const sentence of paragraph.sentences) {
      assert.ok(
        !fromStories.has(sentence.toLowerCase()),
        `${paragraph.id} reuses a Spyglass Bay sentence: "${sentence}"`
      );
    }
  }
});

test("organising is registered and produces its own tasks at every grade", () => {
  assert.ok(KERNEL_SKILLS.place.includes("writing-organization"));
  for (const { grade, tasks } of runs()) {
    assert.equal(tasks.length, KERNEL_RUN_LENGTH, `grade ${grade}`);
    for (const task of tasks) {
      assert.equal(task.skillId, "writing-organization");
      assert.equal(task.verb, "place");
      assert.match(task.standardCode, /^W\./, "organising cites a writing standard");
      const rebuilt = task.targetIds.map(
        (id) => task.tray.find((part) => part.id === id).label
      );
      assert.equal(rebuilt.join(" "), task.targetLabel, `${task.id} tiles do not rebuild it`);
      assert.equal(task.slots, task.tray.length, "every sentence is placed");
    }
  }
});

test("a run never repeats a paragraph, and never hands it over in order", () => {
  for (const { tasks, grade } of runs()) {
    const ids = tasks.map((task) => task.id);
    assert.equal(new Set(ids).size, ids.length, `grade ${grade} repeats a paragraph`);
    for (const task of tasks) {
      assert.notEqual(
        task.tray.map((part) => part.id).join(),
        task.targetIds.join(),
        `${task.id} is already in order`
      );
    }
  }
});

/*
 * The tray was built for "47" and "3 x 4". Sentence pieces need the stacked
 * layout, and the surface picks it by measuring the task's own labels — so
 * these tasks have to actually cross the threshold, and the number tasks have
 * to stay under it or their layout would change too.
 */
test("sentence pieces trip the readable layout and number pieces do not", () => {
  for (const { tasks } of runs()) {
    for (const task of tasks) {
      const longest = Math.max(...task.tray.map((part) => part.label.length));
      assert.ok(
        longest > LONG_LABEL_CHARS,
        `${task.id} would render in the 64px tile layout (longest ${longest})`
      );
    }
  }
  for (const skillId of KERNEL_SKILLS.place) {
    if (skillId === "writing-organization") continue;
    for (const { tasks } of runs(skillId)) {
      for (const task of tasks) {
        const longest = Math.max(...task.tray.map((part) => part.label.length));
        assert.ok(
          longest <= LONG_LABEL_CHARS,
          `${skillId} task ${task.id} would switch layout (longest ${longest})`
        );
      }
    }
  }
});

test("the right order is accepted and a shuffled one is not", () => {
  const [task] = buildKernelRun({
    verb: "place",
    profileId: "kid",
    grade: 3,
    skillId: "writing-organization",
    difficultyShift: 0,
    dayKey: "2026-09-05",
  });
  const byId = new Map(task.tray.map((part) => [part.id, part]));
  const right = task.targetIds.map((id) => byId.get(id));
  assert.equal(judgeKernelAnswer(task, right).correct, true);
  assert.equal(judgeKernelAnswer(task, [...right].reverse()).correct, false);
  const swapped = [...right];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.equal(judgeKernelAnswer(task, swapped).correct, false);
});
