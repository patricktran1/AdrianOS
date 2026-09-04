import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKernelRun,
  judgeKernelAnswer,
  KERNEL_SKILLS,
} from "../../lib/kernels/kernel-tasks.ts";
import {
  buildDeduceRun,
  describeClue,
  DEDUCE_SKILLS,
} from "../../lib/kernels/deduce-tasks.ts";
import { satisfies } from "../../lib/kernels/deduce-constraints.ts";
import { operationSignature } from "../../lib/learning/error-signatures.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];
const SHIFTS = [-1, 0, 1];
const ARITHMETIC = ["math-subtraction", "math-multiplication", "math-division"];
const NEW_SKILLS = [...ARITHMETIC, "logic-patterns"];

/** Every (skill, grade, shift) run for one verb. */
function runs(verb, skillId) {
  const out = [];
  for (const grade of GRADES) {
    for (const difficultyShift of SHIFTS) {
      out.push({
        grade,
        difficultyShift,
        tasks: buildKernelRun({
          verb,
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

/** A tray selection totalling `value`, for judging. */
function blocks(value) {
  return Array.from({ length: Math.max(0, value) }, (_, index) => ({
    id: `b-${index}`,
    label: "1",
    emoji: "x",
    value: 1,
  }));
}

/*
 * The registry promises a generator per skill, but `generatorFor` falls back
 * to counting for an id it does not carry. Without this test a skill could be
 * listed, route successfully, and quietly teach counting under a subtraction
 * label — producing evidence attributed to a skill the child never met.
 */
test("every registered kernel skill has its own generator", () => {
  for (const verb of ["build", "place"]) {
    for (const skillId of KERNEL_SKILLS[verb]) {
      for (const { tasks, grade } of runs(verb, skillId)) {
        assert.ok(tasks.length > 0, `${verb}/${skillId} grade ${grade} produced no tasks`);
        for (const task of tasks) {
          assert.equal(
            task.skillId,
            skillId,
            `${verb}/${skillId} grade ${grade} produced a ${task.skillId} task`
          );
          assert.equal(task.verb, verb);
        }
      }
    }
  }
});

test("every registered deduce skill has its own generator", () => {
  for (const skillId of DEDUCE_SKILLS) {
    for (const grade of GRADES) {
      for (const difficultyShift of SHIFTS) {
        const tasks = buildDeduceRun({
          profileId: "kid",
          dayKey: "2026-09-04",
          grade,
          skillId,
          difficultyShift,
        });
        assert.ok(tasks.length > 0, `${skillId} grade ${grade} produced no puzzles`);
        for (const task of tasks) {
          assert.equal(task.skillId, skillId);
        }
      }
    }
  }
});

test("a child is never asked to build a negative or fractional amount", () => {
  for (const skillId of NEW_SKILLS) {
    for (const { tasks } of runs("build", skillId)) {
      for (const task of tasks) {
        assert.ok(Number.isInteger(task.targetValue), `${task.id} target is not whole`);
        assert.ok(task.targetValue > 0, `${task.id} target ${task.targetValue} is not positive`);
      }
    }
  }
});

test("the tray can always reach the target, and always overshoots it", () => {
  for (const skillId of NEW_SKILLS) {
    for (const { tasks } of runs("build", skillId)) {
      for (const task of tasks) {
        const most = task.tray.reduce((sum, part) => sum + part.value, 0);
        assert.ok(
          most >= task.targetValue,
          `${task.id} tray holds ${most}, cannot reach ${task.targetValue}`
        );
        // A tray that exactly equals the target lets "use everything" pass
        // without the child working anything out.
        assert.ok(
          most > task.targetValue,
          `${task.id} tray totals exactly the target, so it can be solved by emptying it`
        );
      }
    }
  }
});

test("division always shares exactly, and names both numbers it shared", () => {
  for (const { tasks } of runs("build", "math-division")) {
    for (const task of tasks) {
      assert.equal(task.operation?.kind, "divide");
      const { left: total, right: groups } = task.operation;
      assert.ok(groups >= 2, `${task.id} shares between ${groups}`);
      assert.equal(total % groups, 0, `${task.id} leaves a remainder`);
      assert.equal(task.targetValue, total / groups);
    }
  }
});

test("a pattern task shows enough terms to settle its rule", () => {
  for (const { tasks } of runs("build", "logic-patterns")) {
    for (const task of tasks) {
      const shown = task.prompt.match(/\d+/g).map(Number);
      assert.ok(shown.length >= 4, `${task.id} shows only ${shown.length} terms`);
      const steps = new Set(shown.slice(1).map((value, index) => value - shown[index]));
      assert.equal(steps.size, 1, `${task.id} does not step by a constant`);
      assert.equal(task.targetValue, shown[shown.length - 1] + [...steps][0]);
    }
  }
});

/*
 * The observation a construction task can make that a multiple-choice one
 * cannot: a child who builds 17 for "take 5 away from 12" has worked a whole
 * operation correctly on the wrong instruction, which is a different thing to
 * teach than a child who builds 6.
 */
test("working the wrong operation is named, and a near miss is not", () => {
  const [task] = buildKernelRun({
    verb: "build",
    profileId: "kid",
    grade: 3,
    skillId: "math-subtraction",
    difficultyShift: 0,
    dayKey: "2026-09-04",
  });
  const { left, right } = task.operation;
  assert.equal(
    judgeKernelAnswer(task, blocks(left + right)).errorSignature,
    "operation.added-instead-of-subtracted"
  );
  assert.equal(judgeKernelAnswer(task, blocks(task.targetValue)).correct, true);
  assert.equal(
    judgeKernelAnswer(task, blocks(task.targetValue - 1)).errorSignature,
    "count.short-by-one"
  );
});

test("repeating the last term instead of continuing the rule is named", () => {
  const [task] = buildKernelRun({
    verb: "build",
    profileId: "kid",
    grade: 3,
    skillId: "logic-patterns",
    difficultyShift: 0,
    dayKey: "2026-09-04",
  });
  assert.equal(task.operation.kind, "pattern");
  assert.equal(
    judgeKernelAnswer(task, blocks(task.operation.right)).errorSignature,
    "pattern.previous-term-repeated"
  );
});

test("an operation is only claimed when it differs from the right answer", () => {
  // 2 + 2 and 2 x 2 are both 4. There is nothing to observe about a child
  // who answers 4, and claiming otherwise would be a false report to a parent.
  assert.equal(operationSignature("multiply", 2, 2, 4), null);
  assert.equal(operationSignature("subtract", 6, 3, 3), null);
  assert.equal(operationSignature("subtract", 12, 5, 17), "operation.added-instead-of-subtracted");
  assert.equal(operationSignature("divide", 12, 3, 9), "operation.subtracted-instead-of-divided");
  assert.equal(operationSignature("divide", 12, 0, 12), null);
});

test("an expression ordering cannot be solved by reading the first number", () => {
  let orderingsThatDisagreeWithFirstNumber = 0;
  let total = 0;
  for (const skillId of ARITHMETIC) {
    for (const { tasks } of runs("place", skillId)) {
      for (const task of tasks) {
        total += 1;
        const correct = task.targetIds.map(
          (id) => task.tray.find((part) => part.id === id)
        );
        // Every stone must be distinct in value, or the order is ambiguous.
        const values = correct.map((part) => part.value);
        assert.equal(new Set(values).size, values.length, `${task.id} has a tie`);
        assert.deepEqual(values, [...values].sort((a, b) => a - b));

        const firsts = correct.map((part) => Number(part.label.match(/\d+/)[0]));
        const byFirst = [...firsts].sort((a, b) => a - b);
        if (firsts.join() !== byFirst.join()) orderingsThatDisagreeWithFirstNumber += 1;
      }
    }
  }
  // Not every single task: a three-stone set drawn from a narrow range
  // sometimes has no ordering the leading number cannot also produce, and the
  // generator falls back rather than failing to make a task. But the mechanic
  // has to be doing real work most of the time, or it is a magnitude-reading
  // task wearing an arithmetic label. Measured at 72% when this was written.
  assert.ok(
    orderingsThatDisagreeWithFirstNumber / total > 0.65,
    `only ${orderingsThatDisagreeWithFirstNumber}/${total} orderings need the operation worked out`
  );
});

test("every deduce puzzle has exactly one card that fits every clue", () => {
  for (const skillId of DEDUCE_SKILLS) {
    for (const grade of GRADES) {
      const tasks = buildDeduceRun({
        profileId: "kid",
        dayKey: "2026-09-04",
        grade,
        skillId,
        difficultyShift: 0,
      });
      for (const task of tasks) {
        const surviving = task.candidates.filter((candidate) =>
          task.clues.every((clue) => satisfies(candidate, clue, task.candidates))
        );
        assert.equal(surviving.length, 1, `${task.id} has ${surviving.length} answers`);
        assert.equal(surviving[0].id, task.solutionId);
      }
    }
  }
});

/*
 * "I have no 4 in me" three times over is a valid deduction and a poor
 * puzzle: it asks a child to read digits rather than to think about the idea
 * the task is teaching.
 */
test("no puzzle is made only of digit-elimination clues", () => {
  for (const skillId of DEDUCE_SKILLS) {
    for (const grade of GRADES) {
      for (const difficultyShift of SHIFTS) {
        const tasks = buildDeduceRun({
          profileId: "kid",
          dayKey: "2026-09-04",
          grade,
          skillId,
          difficultyShift,
        });
        for (const task of tasks) {
          assert.ok(
            !task.clues.every((clue) => clue.kind === "lacks-digit"),
            `${task.id} is only digit elimination`
          );
        }
      }
    }
  }
});

/*
 * On a card reading "12 - 5", "I am more than 4" does not say whether the
 * clue is about the card or about what the card works out to.
 */
test("clues about a card's answer say so", () => {
  const cases = [
    ["math-subtraction", "answer", /My answer is more than 4\./],
    ["math-multiplication", "answer", /My answer is more than 4\./],
    ["logic-patterns", "next", /My next number is more than 4\./],
    ["math-counting", "value", /I am more than 4\./],
  ];
  for (const [skillId, voice, wording] of cases) {
    const [task] = buildDeduceRun({
      profileId: "kid",
      dayKey: "2026-09-04",
      grade: 3,
      skillId,
      difficultyShift: 0,
    });
    assert.equal(task.voice, voice, `${skillId} speaks in the wrong voice`);
    assert.match(
      describeClue({ kind: "greater-than", value: 4 }, task.candidates, task.voice),
      wording
    );
  }
});

test("an expression card never shows its own answer", () => {
  for (const skillId of ["math-subtraction", "math-multiplication", "logic-patterns"]) {
    for (const grade of GRADES) {
      const tasks = buildDeduceRun({
        profileId: "kid",
        dayKey: "2026-09-04",
        grade,
        skillId,
        difficultyShift: 0,
      });
      for (const task of tasks) {
        for (const candidate of task.candidates) {
          assert.notEqual(
            candidate.label,
            String(candidate.value),
            `${task.id} card ${candidate.label} gives its answer away`
          );
        }
      }
    }
  }
});
