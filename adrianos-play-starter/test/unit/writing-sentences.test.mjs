import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKernelRun,
  judgeKernelAnswer,
  KERNEL_RUN_LENGTH,
  KERNEL_SKILLS,
} from "../../lib/kernels/kernel-tasks.ts";
import { WRITING_SENTENCES } from "../../lib/writing/sentence-bank.ts";
import { mechanicForGame } from "../../lib/kernels/kernel-registry.ts";
import { signatureFavoursVerb, isKnownSignature } from "../../lib/learning/error-signatures.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];
const SHIFTS = [-1, 0, 1];
const WRITING_PLACE = ["writing-sentences", "writing-conventions"];

function runs(skillId) {
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
          dayKey: "2026-09-04",
        }),
      });
    }
  }
  return out;
}

/*
 * A scramble with two correct answers marks a child wrong for writing a
 * correct sentence. The story bank failed this — two thirds of its sentences
 * carry "and", "or", or a comma — which is why these are authored.
 */
test("no sentence in the bank can be reordered and still read correctly", () => {
  for (const sentence of WRITING_SENTENCES) {
    const body = sentence.text.slice(0, -1);
    assert.ok(
      !/ and | or |,|;/.test(body),
      `${sentence.id} has a swappable part: "${sentence.text}"`
    );
  }
});

test("every sentence carries exactly one capital and one ending mark", () => {
  for (const sentence of WRITING_SENTENCES) {
    assert.match(sentence.text, /[.!?]$/, `${sentence.id} has no ending mark`);
    const body = sentence.text.slice(0, -1);
    assert.ok(!/[.!?]/.test(body), `${sentence.id} has punctuation inside it`);
    const capitals = body.split(/\s+/).filter((word) => /^[A-Z]/.test(word));
    // More than one capital makes "which word starts the sentence" ambiguous,
    // and the first-word capital is the cue the task rests on.
    assert.equal(capitals.length, 1, `${sentence.id} has ${capitals.length} capitals`);
    assert.ok(/^[A-Z]/.test(sentence.text), `${sentence.id} does not start with one`);
  }
});

test("the bank is banded so older children get more tiles", () => {
  const tiles = (level) =>
    WRITING_SENTENCES.filter((row) => row.level === level)
      .map((row) => row.text.slice(0, -1).split(/\s+/).length);
  const starter = tiles("Starter");
  const growing = tiles("Growing");
  const challenge = tiles("Challenge");
  for (const band of [starter, growing, challenge]) {
    assert.ok(band.length >= 12, "each band needs enough sentences to be practice");
  }
  assert.ok(Math.max(...starter) < Math.min(...growing), "Starter must be shorter than Growing");
  assert.ok(Math.max(...growing) <= Math.min(...challenge), "Growing must not exceed Challenge");
  const ids = WRITING_SENTENCES.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, "sentence ids must be unique");
});

test("both writing place skills produce a full run at every grade", () => {
  for (const skillId of WRITING_PLACE) {
    assert.ok(KERNEL_SKILLS.place.includes(skillId), `${skillId} is not registered`);
    for (const { grade, tasks } of runs(skillId)) {
      assert.equal(tasks.length, KERNEL_RUN_LENGTH, `${skillId} grade ${grade}`);
      for (const task of tasks) {
        assert.equal(task.skillId, skillId, `${skillId} produced a ${task.skillId} task`);
        assert.equal(task.verb, "place");
        assert.match(task.standardCode, /^L\./, "writing tasks cite a language standard");
      }
    }
  }
});

test("the tray holds every word plus the ending mark, and nothing else", () => {
  for (const skillId of WRITING_PLACE) {
    for (const { tasks } of runs(skillId)) {
      for (const task of tasks) {
        const rebuilt = task.targetIds
          .map((id) => task.tray.find((part) => part.id === id).label);
        const mark = rebuilt[rebuilt.length - 1];
        assert.match(mark, /^[.!?]$/, `${task.id} does not end with its mark`);
        assert.equal(
          `${rebuilt.slice(0, -1).join(" ")}${mark}`,
          task.targetLabel,
          `${task.id} tiles do not rebuild the sentence`
        );
        assert.equal(task.slots, task.tray.length, "every tile is used");
        // The capital can only go first: that is the conventions half.
        assert.match(rebuilt[0], /^[A-Z]/, `${task.id} does not open with a capital`);
      }
    }
  }
});

test("the tray is never handed to the child already in order", () => {
  let scrambled = 0;
  let total = 0;
  for (const skillId of WRITING_PLACE) {
    for (const { tasks } of runs(skillId)) {
      for (const task of tasks) {
        total += 1;
        const asShown = task.tray.map((part) => part.id).join();
        if (asShown !== task.targetIds.join()) scrambled += 1;
      }
    }
  }
  assert.equal(scrambled, total, "a tray already in order is not a task");
});

/*
 * Two tiles reading the same are the same tile. Nothing in the bank repeats a
 * word today; this holds the judging open for the first author who writes
 * "the cat sat on the mat" rather than silently marking it wrong.
 */
test("an arrangement that reads identically is accepted", () => {
  const [task] = buildKernelRun({
    verb: "place",
    profileId: "kid",
    grade: 2,
    skillId: "writing-sentences",
    difficultyShift: 0,
    dayKey: "2026-09-04",
  });
  const byId = new Map(task.tray.map((part) => [part.id, part]));
  const right = task.targetIds.map((id) => byId.get(id));
  assert.equal(judgeKernelAnswer(task, right).correct, true);
  assert.equal(judgeKernelAnswer(task, [...right].reverse()).correct, false);

  // A synthetic duplicate: the same label under a different id must pass.
  const twin = { ...right[0], id: "twin" };
  const withTwin = { ...task, tray: [...task.tray, twin] };
  assert.equal(
    judgeKernelAnswer(withTwin, [twin, ...right.slice(1)]).correct,
    true,
    "a duplicate tile in the same position must read as the same sentence"
  );
});

test("every other place task keeps distinct labels, so that rule stays narrow", () => {
  for (const skillId of KERNEL_SKILLS.place) {
    if (WRITING_PLACE.includes(skillId)) continue;
    for (const { tasks } of runs(skillId)) {
      for (const task of tasks) {
        const labels = task.targetIds
          .map((id) => task.tray.find((part) => part.id === id).label);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${task.id} has two tiles reading the same`
        );
      }
    }
  }
});

test("the writing studio is not classified as picking an offered answer", () => {
  assert.equal(mechanicForGame("writing-studio"), "compose");
});

/*
 * The studio computed six structural facts and recorded two of them ANDed
 * together with no signature, so a writing misconception could never reach
 * the three distinct tasks a pattern needs.
 */
test("each writing observation is nameable on its own", () => {
  const signatures = [
    "writing.no-capital-letter",
    "writing.no-ending-punctuation",
    "writing.too-few-sentences",
    "writing.ideas-not-connected",
    "writing.draft-unchanged",
  ];
  for (const signature of signatures) {
    assert.ok(isKnownSignature(signature), `${signature} is not in the vocabulary`);
  }
  // The three a sentence-building task actually practises route to it.
  assert.equal(signatureFavoursVerb("writing.no-capital-letter"), "place");
  assert.equal(signatureFavoursVerb("writing.no-ending-punctuation"), "place");
  assert.equal(signatureFavoursVerb("writing.too-few-sentences"), "place");
  // The two it does not are left unrouted rather than sent somewhere wrong.
  assert.equal(signatureFavoursVerb("writing.ideas-not-connected"), null);
  assert.equal(signatureFavoursVerb("writing.draft-unchanged"), null);
});
