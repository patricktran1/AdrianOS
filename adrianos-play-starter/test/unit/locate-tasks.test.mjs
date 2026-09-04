import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocateRun,
  defaultLocateSkill,
  LOCATE_RUN_LENGTH,
  LOCATE_SKILLS,
  resolveLocateSkill,
  splitSentences,
} from "../../lib/kernels/locate-tasks.ts";
import { READING_STORIES } from "../../lib/adrian-reading-bank.ts";
import {
  isSupportedAnswer,
  isSweep,
  locateErrorSignature,
  markedTheEvidence,
  markingBudget,
} from "../../lib/learning/locate-evidence.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];

function runs(skillId) {
  return GRADES.map((grade) => ({
    grade,
    tasks: buildLocateRun({ profileId: "kid", dayKey: "2026-09-04", grade, skillId }),
  }));
}

/*
 * A passage that does not survive being split has been silently rewritten
 * for the child. Checked against every story rather than a sample, because
 * the failure is invisible: the text still reads, it is simply not the text
 * the author wrote.
 */
test("splitting a passage never loses or changes a word", () => {
  for (const story of READING_STORIES) {
    const sentences = splitSentences(story.passage);
    assert.equal(
      sentences.join(" "),
      story.passage.trim(),
      `${story.id} does not survive splitting`
    );
    assert.ok(sentences.length >= 3, `${story.id} split into ${sentences.length}`);
    for (const sentence of sentences) {
      assert.ok(sentence.trim().length > 0, `${story.id} produced an empty sentence`);
    }
  }
});

test("a period inside quoted speech does not split a sentence in two", () => {
  // The rule that matters: a lowercase word after a closing quote continues
  // the sentence, an uppercase one starts a new one.
  assert.deepEqual(
    splitSentences("She wrote, 'Good night, Grandpa.' Dad helped her."),
    ["She wrote, 'Good night, Grandpa.'", "Dad helped her."]
  );
  assert.deepEqual(
    splitSentences("A faint 'Hello!' returned from the cliffs. Bea smiled."),
    ["A faint 'Hello!' returned from the cliffs.", "Bea smiled."]
  );
});

/*
 * The supporting sentences are authored, so nothing but a test stops one
 * pointing at a sentence that is not there — which would make the task
 * unanswerable while still looking complete.
 */
test("every authored supporting sentence exists in its passage", () => {
  for (const story of READING_STORIES) {
    const count = splitSentences(story.passage).length;
    for (const question of story.questions) {
      assert.ok(
        question.supports.length > 0,
        `${story.id}/${question.id} names no supporting sentence`
      );
      for (const index of question.supports) {
        assert.ok(
          Number.isInteger(index) && index >= 0 && index < count,
          `${story.id}/${question.id} points at sentence ${index} of ${count}`
        );
      }
    }
  }
});

/*
 * A detail or vocabulary answer that cannot be found in the sentence named
 * is an authoring slip, and the child would be marked wrong for reading
 * correctly. Inference is deliberately exempt: its whole point is that the
 * answer's words are not in the passage.
 */
test("a detail or vocabulary answer is findable in the sentence named", () => {
  const STOP = new Set(["the", "a", "an", "of", "to", "in", "on", "at", "and", "or",
    "it", "its", "was", "were", "is", "are", "for", "that", "this", "with", "he",
    "she", "they", "his", "her", "their", "one", "two", "some", "not", "did", "do",
    "from", "by", "as", "be", "been", "had", "has", "have", "what", "who", "where",
    "when", "why", "how", "which", "made", "make", "more", "than", "them", "there",
    "then", "so", "up", "out", "into", "about", "before", "after", "all", "can",
    "could", "would", "will", "may", "might", "much", "many"]);
  const words = (text) => text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));

  for (const story of READING_STORIES) {
    const sentences = splitSentences(story.passage);
    for (const question of story.questions) {
      if (question.skill !== "detail" && question.skill !== "vocabulary") continue;
      const named = question.supports.map((i) => sentences[i]).join(" ").toLowerCase();
      const keys = question.skill === "vocabulary"
        ? story.vocabulary.map((row) => row.word)
        : words(question.answer);
      assert.ok(
        keys.some((key) => named.includes(key.toLowerCase())),
        `${story.id}/${question.skill}: "${question.answer}" is not in ${JSON.stringify(question.supports)}`
      );
    }
  }
});

test("every locate skill produces a full run at every grade", () => {
  for (const skillId of LOCATE_SKILLS) {
    for (const { grade, tasks } of runs(skillId)) {
      assert.equal(tasks.length, LOCATE_RUN_LENGTH, `${skillId} grade ${grade}`);
      for (const task of tasks) {
        assert.equal(task.skillId, skillId, `${skillId} grade ${grade} taught ${task.skillId}`);
        assert.ok(task.supportingIds.length > 0);
        const ids = new Set(task.sentences.map((row) => row.id));
        for (const id of task.supportingIds) assert.ok(ids.has(id));
        assert.ok(task.options.some((row) => row.id === task.answerId));
        assert.ok(task.standardCode.startsWith("RL."));
      }
    }
  }
});

test("a run never repeats a story, so four tasks are four texts", () => {
  for (const skillId of LOCATE_SKILLS) {
    for (const { tasks, grade } of runs(skillId)) {
      const stories = tasks.map((task) => task.storyId);
      assert.equal(new Set(stories).size, stories.length, `${skillId} grade ${grade} repeats a story`);
    }
  }
});

test("the same child on the same day gets the same run, and a different one tomorrow", () => {
  const monday = buildLocateRun({ profileId: "kid", dayKey: "2026-09-04", grade: 2, skillId: "reading-inference" });
  const again = buildLocateRun({ profileId: "kid", dayKey: "2026-09-04", grade: 2, skillId: "reading-inference" });
  const tuesday = buildLocateRun({ profileId: "kid", dayKey: "2026-09-05", grade: 2, skillId: "reading-inference" });
  assert.deepEqual(monday.map((t) => t.id), again.map((t) => t.id));
  assert.notDeepEqual(monday.map((t) => t.id), tuesday.map((t) => t.id));
});

test("a skill id from a query string can never choose the task", () => {
  // The id arrives from a URL, so it is matched against this module's own
  // list rather than used to index anything.
  for (const hostile of ["constructor", "__proto__", "toString", "", null, undefined]) {
    const skill = resolveLocateSkill(2, hostile);
    assert.ok(LOCATE_SKILLS.includes(skill), `resolved to ${skill}`);
  }
  assert.equal(resolveLocateSkill(2, "reading-inference"), "reading-inference");
  assert.ok(LOCATE_SKILLS.includes(defaultLocateSkill(0)));
  assert.ok(LOCATE_SKILLS.includes(defaultLocateSkill(5)));
});

const task = () =>
  buildLocateRun({ profileId: "kid", dayKey: "2026-09-04", grade: 3, skillId: "reading-inference" })[0];

test("marking the passage flat is not evidence of finding anything", () => {
  const row = task();
  const everything = { markedIds: row.sentences.map((s) => s.id), unmarked: 0 };
  assert.ok(markedTheEvidence(row, everything), "the supporting sentence was marked");
  assert.ok(isSweep(row, everything), "but only by marking all of them");
  assert.equal(isSupportedAnswer({ correct: true, task: row, trace: everything }), false);
  assert.equal(
    locateErrorSignature({ task: row, correct: true, trace: everything }),
    "reading.marked-the-whole-passage"
  );
});

test("the marking budget allows the answer's own sentences", () => {
  for (const skillId of LOCATE_SKILLS) {
    for (const { tasks } of runs(skillId)) {
      for (const row of tasks) {
        const exact = { markedIds: [...row.supportingIds], unmarked: 0 };
        assert.equal(isSweep(row, exact), false, `${row.id} calls its own evidence a sweep`);
        assert.ok(markingBudget(row) >= row.supportingIds.length);
      }
    }
  }
});

test("each way of answering is told apart from the others", () => {
  const row = task();
  const supporting = [...row.supportingIds];
  const elsewhere = row.sentences.find((s) => !row.supportingIds.includes(s.id));
  assert.ok(elsewhere, "a passage needs a sentence the answer does not rest on");
  const trace = (ids) => ({ markedIds: ids, unmarked: 0 });

  // Found it and read it: the only case that counts as reading.
  assert.equal(isSupportedAnswer({ correct: true, task: row, trace: trace(supporting) }), true);
  assert.equal(locateErrorSignature({ task: row, correct: true, trace: trace(supporting) }), null);

  // Found the sentence, took another meaning from it.
  assert.equal(
    locateErrorSignature({ task: row, correct: false, trace: trace(supporting) }),
    "reading.evidence-found-but-misread"
  );
  // Right answer that did not come from where the child said it did.
  assert.equal(
    locateErrorSignature({ task: row, correct: true, trace: trace([elsewhere.id]) }),
    "reading.answered-without-evidence"
  );
  // Looked, but in another part.
  assert.equal(
    locateErrorSignature({ task: row, correct: false, trace: trace([elsewhere.id]) }),
    "reading.looked-in-another-part"
  );
});

test("taking a mark back does not make an answer count as unread", () => {
  const row = task();
  const corrected = { markedIds: [...row.supportingIds], unmarked: 3 };
  assert.equal(isSupportedAnswer({ correct: true, task: row, trace: corrected }), true);
});
