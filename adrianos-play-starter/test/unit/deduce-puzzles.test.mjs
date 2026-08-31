import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeduceConstraintKind,
  isRuledOut,
  rulingConstraint,
  satisfies,
  solutionsFor,
  validatePuzzle,
} from "../../lib/kernels/deduce-constraints.ts";
import {
  buildDeduceRun,
  DEDUCE_RUN_LENGTH,
  DEDUCE_SKILLS,
  deduceShape,
  defaultDeduceSkill,
  describeClue,
  resolveDeduceSkill,
} from "../../lib/kernels/deduce-tasks.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];
const SHIFTS = [-1, 0, 1];

function card(overrides = {}) {
  return {
    id: "c",
    label: "47",
    emoji: "🪵",
    value: 47,
    denominator: 0,
    attributes: ["odd"],
    position: 47,
    ...overrides,
  };
}

/* ================================================================== */
/* Constraint evaluation                                              */
/* ================================================================== */

test("every constraint kind decides membership from candidate data alone", () => {
  const forty_seven = card();
  assert.equal(satisfies(forty_seven, { kind: "greater-than", value: 40 }), true);
  assert.equal(satisfies(forty_seven, { kind: "greater-than", value: 47 }), false);
  assert.equal(satisfies(forty_seven, { kind: "less-than", value: 50 }), true);
  assert.equal(satisfies(forty_seven, { kind: "has-digit", digit: 7 }), true);
  assert.equal(satisfies(forty_seven, { kind: "has-digit", digit: 3 }), false);
  assert.equal(satisfies(forty_seven, { kind: "lacks-digit", digit: 3 }), true);
  assert.equal(satisfies(forty_seven, { kind: "tens-is", count: 4 }), true);
  assert.equal(satisfies(forty_seven, { kind: "tens-is", count: 7 }), false);
  assert.equal(satisfies(forty_seven, { kind: "in-category", category: "odd" }), true);
  assert.equal(satisfies(forty_seven, { kind: "not-in-category", category: "even" }), true);

  const third = card({ value: 1, denominator: 3, label: "1/3" });
  assert.equal(satisfies(third, { kind: "numerator-is", value: 1 }), true);
  assert.equal(satisfies(third, { kind: "denominator-is", value: 3 }), true);
  assert.equal(satisfies(third, { kind: "denominator-is", value: 4 }), false);
});

test("before and after are relationships, and a missing anchor excludes rather than throws", () => {
  const universe = [
    card({ id: "a", position: 0 }),
    card({ id: "b", position: 1 }),
    card({ id: "c", position: 2 }),
  ];
  assert.equal(satisfies(universe[0], { kind: "comes-before", anchorId: "b" }, universe), true);
  assert.equal(satisfies(universe[2], { kind: "comes-before", anchorId: "b" }, universe), false);
  assert.equal(satisfies(universe[2], { kind: "comes-after", anchorId: "b" }, universe), true);
  // An anchor outside the universe makes the clue unsatisfiable, which the
  // validator then reports rather than the game crashing on a child.
  assert.equal(satisfies(universe[0], { kind: "comes-after", anchorId: "nope" }, universe), false);
});

test("constraint kinds are validated against the authoritative list", () => {
  assert.equal(isDeduceConstraintKind("greater-than"), true);
  assert.equal(isDeduceConstraintKind("made-up"), false);
  // Prototype keys must not pass: constraint data can come from storage.
  for (const hostile of ["constructor", "toString", "__proto__", "valueOf"]) {
    assert.equal(isDeduceConstraintKind(hostile), false, `${hostile} must not validate`);
  }
  assert.equal(isDeduceConstraintKind(7), false);
  assert.equal(isDeduceConstraintKind(null), false);
});

/* ================================================================== */
/* The validator                                                      */
/* ================================================================== */

test("the validator counts solutions and finds dead weight", () => {
  const candidates = [
    card({ id: "n-44", value: 44, label: "44", attributes: ["even"] }),
    card({ id: "n-48", value: 48, label: "48", attributes: ["even"] }),
    card({ id: "n-63", value: 63, label: "63", attributes: ["odd"] }),
  ];
  const good = [
    { kind: "tens-is", count: 4 },
    { kind: "lacks-digit", digit: 8 },
  ];
  const report = validatePuzzle(candidates, good);
  assert.equal(report.solutionCount, 1);
  assert.deepEqual(report.redundant, []);
  assert.deepEqual(report.trivial, []);
  assert.equal(report.cluesNeeded, 2, "both clues are needed to get to one");
  assert.equal(report.usable, true);

  // A clue that alone identifies the answer makes the rest decoration.
  const trivial = validatePuzzle(candidates, [
    { kind: "in-category", category: "odd" },
    { kind: "greater-than", value: 10 },
  ]);
  assert.ok(trivial.trivial.length > 0);
  assert.equal(trivial.usable, false);

  // A clue that removes nobody is redundant.
  const redundant = validatePuzzle(candidates, [
    { kind: "tens-is", count: 4 },
    { kind: "lacks-digit", digit: 8 },
    { kind: "greater-than", value: 1 },
  ]);
  assert.ok(redundant.redundant.length > 0);
  assert.equal(redundant.usable, false);
});

test("a puzzle with no answer or several answers is never usable", () => {
  const candidates = [
    card({ id: "a", value: 10 }),
    card({ id: "b", value: 20 }),
    card({ id: "c", value: 30 }),
  ];
  const contradictory = validatePuzzle(candidates, [
    { kind: "greater-than", value: 25 },
    { kind: "less-than", value: 15 },
  ]);
  assert.equal(contradictory.solutionCount, 0);
  assert.equal(contradictory.usable, false);

  const ambiguous = validatePuzzle(candidates, [
    { kind: "greater-than", value: 5 },
    { kind: "less-than", value: 25 },
  ]);
  assert.equal(ambiguous.solutionCount, 2);
  assert.equal(ambiguous.usable, false);
});

/* ================================================================== */
/* Generation: the guarantee that reaches the child                   */
/* ================================================================== */

test("every generated puzzle, across the seed space, is solvable and honest", () => {
  let checked = 0;
  for (const skillId of DEDUCE_SKILLS) {
    for (const grade of GRADES) {
      for (const difficultyShift of SHIFTS) {
        for (let day = 1; day <= 6; day += 1) {
          const run = buildDeduceRun({
            profileId: `kid-${day}`,
            grade,
            skillId,
            difficultyShift,
            dayKey: `2026-09-0${day}`,
          });
          assert.equal(
            run.length,
            DEDUCE_RUN_LENGTH,
            `${skillId} g${grade} shift${difficultyShift} produced ${run.length} puzzles`
          );
          for (const task of run) {
            const report = validatePuzzle(task.candidates, task.clues);
            assert.equal(report.solutionCount, 1, `${task.id} must have exactly one answer`);
            assert.deepEqual(report.redundant, [], `${task.id} has a clue that does nothing`);
            assert.deepEqual(report.trivial, [], `${task.id} has a clue that gives it away`);
            assert.ok(report.usable, `${task.id} is not fit to show a child`);
            // The stated answer is the one the clues actually select.
            const solved = solutionsFor(task.candidates, task.clues);
            assert.equal(solved[0].id, task.solutionId, `${task.id} names the wrong answer`);
            assert.ok(task.clues.length >= 2, `${task.id} must need more than one clue`);
            assert.equal(task.skillId, skillId, "a requested skill must not be swapped");
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 500, `expected a broad sweep, checked ${checked}`);
});

test("runs are reproducible for a seed and vary across days", () => {
  const input = {
    profileId: "kid",
    grade: 2,
    skillId: "math-place-value",
    dayKey: "2026-09-01",
  };
  assert.deepEqual(buildDeduceRun(input), buildDeduceRun(input));

  const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
  const distinct = new Set(
    days.map((dayKey) => JSON.stringify(buildDeduceRun({ ...input, dayKey })))
  );
  assert.ok(distinct.size > 1, "tomorrow must not repeat today's mysteries");
});

test("no puzzle can be solved from a single clue", () => {
  // The point of the verb: clues must be combined.
  for (const skillId of DEDUCE_SKILLS) {
    const run = buildDeduceRun({
      profileId: "kid",
      grade: 2,
      skillId,
      dayKey: "2026-09-01",
    });
    for (const task of run) {
      for (const clue of task.clues) {
        assert.notEqual(
          solutionsFor(task.candidates, [clue]).length,
          1,
          `${task.id}: one clue is enough, so the rest are decoration`
        );
      }
      assert.ok(task.cluesNeeded >= 2, `${task.id} should need at least two clues`);
    }
  }
});

test("difficulty is a small table that can be read aloud", () => {
  const easy = deduceShape(-1, -1);
  const hard = deduceShape(5, 1);
  assert.ok(easy.candidateCount < hard.candidateCount, "harder means more cards");
  assert.ok(easy.clueCount <= hard.clueCount);
  assert.equal(deduceShape(0, 0).candidateCount, 3, "the youngest start with three");
  // Every level stays inside the table rather than drifting.
  for (const grade of GRADES) {
    for (const shift of SHIFTS) {
      const shape = deduceShape(grade, shift);
      assert.ok(shape.candidateCount >= 3 && shape.candidateCount <= 5);
      assert.ok(shape.clueCount >= 2 && shape.clueCount <= 3);
    }
  }
});

test("skill selection resolves through the module's own list", () => {
  assert.equal(resolveDeduceSkill(2, "math-place-value"), "math-place-value");
  assert.equal(resolveDeduceSkill(2, "not-a-skill"), defaultDeduceSkill(2));
  // A query parameter cannot reach an inherited property.
  for (const hostile of ["constructor", "toString", "__proto__"]) {
    assert.equal(resolveDeduceSkill(2, hostile), defaultDeduceSkill(2));
  }
  assert.equal(buildDeduceRun({
    profileId: "kid", grade: 2, skillId: "constructor", dayKey: "2026-09-01",
  }).length, DEDUCE_RUN_LENGTH);
});

/* ================================================================== */
/* Clue wording                                                       */
/* ================================================================== */

test("clues read as a child would hear them, and never leak the answer", () => {
  const universe = [
    card({ id: "a", label: "Egg", position: 0 }),
    card({ id: "b", label: "Tadpole", position: 1 }),
  ];
  assert.match(describeClue({ kind: "greater-than", value: 35 }, universe), /more than 35/);
  assert.match(describeClue({ kind: "tens-is", count: 4 }, universe), /4 tens/);
  assert.match(describeClue({ kind: "comes-after", anchorId: "a" }, universe), /after Egg/);
  assert.match(describeClue({ kind: "in-category", category: "even" }, universe), /even/);

  for (const skillId of DEDUCE_SKILLS) {
    for (const task of buildDeduceRun({ profileId: "kid", grade: 2, skillId, dayKey: "2026-09-02" })) {
      const answer = task.candidates.find((row) => row.id === task.solutionId);
      for (const clue of task.clues) {
        const text = describeClue(clue, task.candidates);
        assert.ok(text.length > 0, `${clue.kind} needs child-facing wording`);
        assert.ok(text.length < 60, "clues stay glanceable for an early reader");
        // A clue that simply states the answer would not be a clue.
        assert.notEqual(text.trim(), `I am ${answer.label}.`);
      }
    }
  }
});

/* ================================================================== */
/* Elimination checking                                               */
/* ================================================================== */

test("a card is ruled out only by a clue that actually excludes it", () => {
  const universe = [
    card({ id: "n-44", value: 44, label: "44" }),
    card({ id: "n-63", value: 63, label: "63" }),
  ];
  const revealed = [{ kind: "tens-is", count: 4 }];
  assert.equal(isRuledOut(universe[0], revealed, universe), false);
  assert.equal(isRuledOut(universe[1], revealed, universe), true);
  assert.equal(rulingConstraint(universe[0], revealed, universe), null);
  assert.deepEqual(rulingConstraint(universe[1], revealed, universe), revealed[0]);
  // With nothing revealed, nothing is ruled out: crossing a card out then is
  // an unsupported move, which is exactly what the trace records.
  assert.equal(isRuledOut(universe[1], [], universe), false);
});
