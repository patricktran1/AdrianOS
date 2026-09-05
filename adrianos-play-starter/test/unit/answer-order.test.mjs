import assert from "node:assert/strict";
import test from "node:test";
import {
  optionSeed,
  presentDeck,
  presentIndexed,
  presentItem,
  presentOptions,
  presentValues,
} from "../../lib/learning/answer-order.ts";
import { CIVIC_MISSIONS } from "../../lib/adrian-civic-bank.ts";
import { ECONOMICS_MISSIONS } from "../../lib/adrian-economics-bank.ts";
import { HEALTH_MISSIONS } from "../../lib/adrian-health-bank.ts";
import { HISTORY_MISSIONS } from "../../lib/adrian-history-bank.ts";
import { WELLBEING_MISSIONS } from "../../lib/adrian-wellbeing-bank.ts";
import { WORLD_MISSIONS } from "../../lib/adrian-world-bank.ts";
import { ENGINEERING_MISSIONS } from "../../lib/adrian-engineering-bank.ts";
import { LIFE_SKILLS_MISSIONS } from "../../lib/adrian-life-skills-bank.ts";
import { DIGITAL_SCENARIOS } from "../../lib/adrian-digital-bank.ts";
import { ENVIRONMENT_MISSIONS } from "../../lib/adrian-environment-bank.ts";
import { MOVEMENT_MISSIONS } from "../../lib/adrian-movement-bank.ts";
import { MUSIC_MISSIONS } from "../../lib/adrian-music-bank.ts";
import { STUDY_MISSIONS } from "../../lib/adrian-study-skills-bank.ts";
import { READING_STORIES } from "../../lib/adrian-reading-bank.ts";

/*
 * Every authored multiple-choice row in the repository, flattened. These are
 * the questions a child actually meets in the subject labs, and the subject
 * labs are the only place several subjects are observed at all.
 */
const BANKS = [
  ["civic-lab", CIVIC_MISSIONS],
  ["economics-lab", ECONOMICS_MISSIONS],
  ["health-safety-lab", HEALTH_MISSIONS],
  ["history-lab", HISTORY_MISSIONS],
  ["feelings-friendship-lab", WELLBEING_MISSIONS],
  ["world-explorer", WORLD_MISSIONS],
  ["engineering-lab", ENGINEERING_MISSIONS],
  ["life-skills-lab", LIFE_SKILLS_MISSIONS],
  ["digital-citizenship-lab", DIGITAL_SCENARIOS],
  ["nature-environment-lab", ENVIRONMENT_MISSIONS],
  ["movement-lab", MOVEMENT_MISSIONS],
  ["music-lab", MUSIC_MISSIONS],
  ["study-skills-lab", STUDY_MISSIONS],
];

const READING_QUESTIONS = READING_STORIES.flatMap((story) =>
  story.questions.map((question) => ({ ...question, id: `${story.id}:${question.id}` }))
);

const ALL_ROWS = [
  ...BANKS.flatMap(([slug, rows]) => rows.map((row) => ({ slug, row }))),
  ...READING_QUESTIONS.map((row) => ({ slug: "reading-lab", row })),
];

const PROFILES = Array.from({ length: 200 }, (_, index) => `kid-${index}`);

/*
 * The bank invariants the whole idea rests on. A row whose answer is missing,
 * or that lists the same string twice, cannot be permuted without changing
 * what it asks — the module falls back to the authored order for those, and
 * this test is what keeps the fallback from silently becoming the norm.
 */
test("every authored row can be permuted without changing the question", () => {
  for (const { slug, row } of ALL_ROWS) {
    assert.ok(
      row.options.length >= 2,
      `${slug}/${row.id} offers fewer than two options`
    );
    assert.ok(
      row.options.includes(row.answer),
      `${slug}/${row.id} has an answer that is not one of its options`
    );
    assert.equal(
      new Set(row.options).size,
      row.options.length,
      `${slug}/${row.id} lists the same option twice`
    );
  }
});

/*
 * The finding this whole change exists for: authored first, rendered first.
 * Left alone, "tap the top button" is a complete strategy.
 */
test("the authored banks really do put the answer first", () => {
  const first = ALL_ROWS.filter(({ row }) => row.options[0] === row.answer).length;
  assert.ok(
    first / ALL_ROWS.length > 0.9,
    `expected the authored bias this change exists to remove, saw ${first}/${ALL_ROWS.length}`
  );
});

/*
 * And the property that replaces it. Across many children, the answer must
 * land in each of the three slots about a third of the time — otherwise some
 * position is still worth guessing.
 */
test("no presented position is worth guessing", () => {
  const slots = [0, 0, 0];
  let total = 0;
  for (const { slug, row } of ALL_ROWS) {
    for (const profileId of PROFILES) {
      const shown = presentOptions(
        row.options,
        row.answer,
        optionSeed(profileId, slug, row.id)
      );
      slots[shown.indexOf(row.answer)] += 1;
      total += 1;
    }
  }
  const share = slots.map((count) => count / total);
  for (const [index, value] of share.entries()) {
    assert.ok(
      Math.abs(value - 1 / 3) < 0.03,
      `slot ${index} holds the answer ${(value * 100).toFixed(1)}% of the time`
    );
  }
});

/* A child guessing one position does no better than chance, per subject. */
test("tapping the top button is no better than chance in any subject", () => {
  for (const [slug, rows] of BANKS) {
    let hits = 0;
    let total = 0;
    for (const row of rows) {
      for (const profileId of PROFILES) {
        const shown = presentOptions(
          row.options,
          row.answer,
          optionSeed(profileId, slug, row.id)
        );
        if (shown[0] === row.answer) hits += 1;
        total += 1;
      }
    }
    const rate = hits / total;
    assert.ok(
      Math.abs(rate - 1 / 3) < 0.05,
      `${slug}: first-button strategy scores ${(rate * 100).toFixed(1)}%`
    );
  }
});

/*
 * Presentation is a permutation and nothing else. Same questions, same
 * answers, same distractors — a different order.
 */
test("presenting a row changes the order and nothing else", () => {
  for (const { slug, row } of ALL_ROWS) {
    const authored = [...row.options];
    const shown = presentItem(row, optionSeed("kid", slug, row.id));
    assert.deepEqual(
      [...shown.options].sort(),
      [...authored].sort(),
      `${slug}/${row.id} lost or gained an option`
    );
    assert.equal(shown.answer, row.answer, `${slug}/${row.id} changed its answer`);
    assert.equal(shown.id, row.id, `${slug}/${row.id} changed its id`);
    assert.equal(shown.prompt, row.prompt, `${slug}/${row.id} changed its prompt`);
    // The bank is module state shared by every child on the device. Presenting
    // a row for one of them must not reorder it for the next.
    assert.deepEqual(row.options, authored, `${slug}/${row.id} mutated the authored bank`);
    assert.notEqual(shown.options, row.options, `${slug}/${row.id} handed back the bank's own array`);
  }
});

/*
 * Buttons must not move under a child's finger. A retry after a miss shows
 * the layout they just studied, so the miss is about the question.
 */
test("the same child sees the same order every time", () => {
  for (const { slug, row } of ALL_ROWS.slice(0, 60)) {
    const seed = optionSeed("kid", slug, row.id);
    const once = presentOptions(row.options, row.answer, seed);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      assert.deepEqual(
        presentOptions(row.options, row.answer, seed),
        once,
        `${slug}/${row.id} moved between renders`
      );
    }
  }
});

/* An order learned by watching a sibling is worth nothing. */
test("two children see different orders often enough to matter", () => {
  let differ = 0;
  for (const { slug, row } of ALL_ROWS) {
    const mine = presentOptions(row.options, row.answer, optionSeed("kid-a", slug, row.id));
    const theirs = presentOptions(row.options, row.answer, optionSeed("kid-b", slug, row.id));
    if (mine.join("|") !== theirs.join("|")) differ += 1;
  }
  assert.ok(
    differ / ALL_ROWS.length > 0.5,
    `only ${differ}/${ALL_ROWS.length} rows differ between two children`
  );
});

/* Different items are ordered independently, so a deck teaches no pattern. */
test("two items are ordered independently of each other", () => {
  const row = ALL_ROWS[0].row;
  const a = presentOptions(row.options, row.answer, optionSeed("kid", "civic-lab", "item-a"));
  const b = presentOptions(row.options, row.answer, optionSeed("kid", "civic-lab", "item-b"));
  assert.notDeepEqual(a, b);
});

/*
 * Option text is content, and content must never reach a prototype. These
 * strings are the ones that broke lookups elsewhere in the codebase.
 */
test("options named after prototype members are ordinary strings", () => {
  const hostile = ["constructor", "__proto__", "toString"];
  for (const answer of hostile) {
    for (const profileId of PROFILES.slice(0, 40)) {
      const shown = presentOptions(hostile, answer, optionSeed(profileId, "lab", "hostile"));
      assert.equal(shown.length, 3);
      assert.ok(shown.includes(answer));
      assert.deepEqual([...shown].sort(), [...hostile].sort());
    }
    const indexed = presentIndexed(hostile, hostile.indexOf(answer), "seed");
    assert.equal(indexed.choices[indexed.answerIndex], answer);
  }
});

/*
 * A row that cannot be permuted safely is shown as authored rather than
 * throwing in a child's face. The contract check is what makes it loud.
 */
test("a row that cannot be permuted safely is left exactly as authored", () => {
  assert.deepEqual(presentOptions(["only"], "only", "s"), ["only"]);
  assert.deepEqual(presentOptions(["a", "a", "b"], "b", "s"), ["a", "a", "b"]);
  assert.deepEqual(presentOptions(["a", "b", "c"], "missing", "s"), ["a", "b", "c"]);
  assert.deepEqual(presentValues([2, 2, 3], 3, "s"), [2, 2, 3]);
  assert.deepEqual(presentValues([1, 2, 3], 9, "s"), [1, 2, 3]);
});

/* An indexed row's index must still point at the same choice. */
test("an indexed answer follows its choice to the new position", () => {
  const choices = ["alpha", "beta", "gamma", "delta"];
  for (let answerIndex = 0; answerIndex < choices.length; answerIndex += 1) {
    for (const profileId of PROFILES.slice(0, 50)) {
      const shown = presentIndexed(choices, answerIndex, optionSeed(profileId, "quest", "q1"));
      assert.equal(shown.choices[shown.answerIndex], choices[answerIndex]);
      assert.deepEqual([...shown.choices].sort(), [...choices].sort());
    }
  }
});

/* An out-of-range index is nonsense, and nonsense is left alone. */
test("an out-of-range answer index leaves the choices as authored", () => {
  const choices = ["a", "b", "c"];
  assert.deepEqual(presentIndexed(choices, 7, "s"), { choices, answerIndex: 7 });
});

/*
 * math-blast built four numbers and "shuffled" them with a comparator, which
 * is not a shuffle: it left the first and last positions worth far more than
 * the middle two. Numbers get the same guarantee as text.
 */
test("numeric choices land in every position equally", () => {
  const slots = [0, 0, 0, 0];
  let total = 0;
  for (let answer = 3; answer < 203; answer += 1) {
    const values = [answer, answer + 1, answer + 2, answer + 3];
    for (const profileId of PROFILES) {
      const shown = presentValues(values, answer, optionSeed(profileId, "math-blast", `p${answer}`));
      slots[shown.indexOf(answer)] += 1;
      total += 1;
    }
  }
  for (const [index, count] of slots.entries()) {
    const share = count / total;
    assert.ok(
      Math.abs(share - 0.25) < 0.015,
      `numeric slot ${index} holds the answer ${(share * 100).toFixed(2)}% of the time`
    );
  }
});

/*
 * The coach's own quick check rotated three choices by a fixed amount, which
 * put its answer at index 1 on every question it ever asked.
 */
test("a three-choice quick check does not park its answer in one slot", () => {
  const choices = ["right", "wrong-one", "wrong-two"];
  const seen = new Set();
  for (const profileId of PROFILES) {
    const shown = presentIndexed(choices, 0, optionSeed(profileId, "coach", "check"));
    seen.add(shown.answerIndex);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

/* A deck is presented row by row, each seeded by its own id. */
test("a deck presents each row independently and keeps every row", () => {
  const deck = CIVIC_MISSIONS.slice(0, 8);
  const shown = presentDeck(deck, "kid", "civic-lab");
  assert.equal(shown.length, deck.length);
  for (const [index, row] of shown.entries()) {
    assert.equal(row.id, deck[index].id);
    assert.equal(row.answer, deck[index].answer);
    assert.deepEqual(
      row.options,
      presentOptions(
        deck[index].options,
        deck[index].answer,
        optionSeed("kid", "civic-lab", deck[index].id)
      )
    );
  }
});
