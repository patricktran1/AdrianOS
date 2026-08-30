import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKernelRun,
  defaultKernelSkill,
  judgeKernelAnswer,
  KERNEL_RUN_LENGTH,
  KERNEL_SKILLS,
} from "../../lib/kernels/kernel-tasks.ts";

const GRADES = [-1, 0, 1, 2, 3, 4, 5];
const SHIFTS = [-1, 0, 1];

function runsForEveryCombination() {
  const runs = [];
  for (const verb of ["build", "place"]) {
    for (const skillId of KERNEL_SKILLS[verb]) {
      for (const grade of GRADES) {
        for (const difficultyShift of SHIFTS) {
          runs.push({
            verb,
            skillId,
            grade,
            tasks: buildKernelRun({
              verb,
              profileId: "kid",
              grade,
              skillId,
              difficultyShift,
              dayKey: "2026-08-30",
            }),
          });
        }
      }
    }
  }
  return runs;
}

/**
 * Greedy exact composition works for every kernel tray because part values
 * are canonical denominations (10s and 1s, or all 1s).
 */
function composable(task) {
  const parts = [...task.tray].sort((a, b) => b.value - a.value);
  let total = 0;
  for (const part of parts) {
    if (total + part.value <= task.targetValue + 1e-9) total += part.value;
  }
  return Math.abs(total - task.targetValue) < 1e-9;
}

test("every skill, grade, and difficulty produces a full, valid run", () => {
  for (const run of runsForEveryCombination()) {
    assert.equal(run.tasks.length, KERNEL_RUN_LENGTH, `${run.verb}/${run.skillId}/g${run.grade}`);
    for (const task of run.tasks) {
      assert.equal(task.verb, run.verb);
      assert.equal(task.skillId, run.skillId, "a requested skill must not be silently swapped");
      assert.ok(task.prompt.length > 0 && task.hint.length > 0 && task.explanation.length > 0);
      assert.ok(task.tray.length > 0);
      assert.equal(new Set(task.tray.map((part) => part.id)).size, task.tray.length,
        "tray part ids must be unique so taps are unambiguous");
      if (task.verb === "build") {
        assert.equal(task.slots, 0);
        assert.deepEqual(task.targetIds, []);
        assert.ok(task.targetValue > 0);
        assert.ok(composable(task), `${task.id}: the tray cannot compose ${task.targetValue}`);
      } else {
        assert.equal(task.slots, task.targetIds.length);
        assert.ok(task.slots >= 3);
        const trayIds = new Set(task.tray.map((part) => part.id));
        for (const id of task.targetIds) {
          assert.ok(trayIds.has(id), `${task.id}: target ${id} missing from tray`);
        }
      }
    }
    const ids = run.tasks.map((task) => task.id);
    assert.equal(new Set(ids).size, ids.length, "task ids within a run must be unique");
  }
});

test("runs are stable within a day and vary across days", () => {
  const input = { verb: "build", profileId: "kid", grade: 2, skillId: "math-place-value", dayKey: "2026-08-30" };
  assert.deepEqual(buildKernelRun(input), buildKernelRun(input));

  const days = ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"];
  const distinct = new Set(days.map((dayKey) => JSON.stringify(buildKernelRun({ ...input, dayKey }))));
  assert.ok(distinct.size > 1, "tomorrow must not replay today's exact run");
});

test("counting trays always hold more blocks than the target", () => {
  // If selecting every block could succeed, the task would not require
  // counting at all.
  for (const grade of GRADES) {
    for (let day = 1; day <= 9; day += 1) {
      const tasks = buildKernelRun({
        verb: "build",
        profileId: `kid-${day}`,
        grade,
        skillId: "math-counting",
        dayKey: `2026-08-0${day}`,
      });
      for (const task of tasks) {
        assert.ok(task.tray.length > task.targetValue, `${task.id}: select-all would pass`);
      }
    }
  }
});

test("place-value targets keep tens and ones distinct so transposition is readable", () => {
  for (let day = 1; day <= 9; day += 1) {
    const tasks = buildKernelRun({
      verb: "build",
      profileId: `kid-${day}`,
      grade: 2,
      skillId: "math-place-value",
      dayKey: `2026-08-0${day}`,
    });
    for (const task of tasks) {
      const tens = Math.floor(task.targetValue / 10);
      const ones = task.targetValue % 10;
      assert.notEqual(tens, ones, `${task.id}: ${task.targetValue} hides a swap`);
    }
  }
});

test("BUILD judges any valid composition, not one blessed shape", () => {
  const rod = (index) => ({ id: `ten-${index}`, label: "10", emoji: "🟨", value: 10 });
  const block = (index) => ({ id: `one-${index}`, label: "1", emoji: "🟦", value: 1 });
  const task = {
    id: "t",
    verb: "build",
    skillId: "math-place-value",
    skillLabel: "Place value",
    subject: "Math",
    standardCode: null,
    prompt: "",
    hint: "",
    explanation: "",
    tray: [rod(0), rod(1), ...Array.from({ length: 13 }, (_, i) => block(i))],
    slots: 0,
    targetIds: [],
    targetValue: 13,
    format: "integer",
    denominator: 0,
    targetLabel: "13",
  };
  const withRod = judgeKernelAnswer(task, [rod(0), block(0), block(1), block(2)]);
  assert.equal(withRod.correct, true);
  assert.equal(withRod.canonicalAnswer, "13");

  const allOnes = judgeKernelAnswer(task, Array.from({ length: 13 }, (_, i) => block(i)));
  assert.equal(allOnes.correct, true, "thirteen ones are as valid as a rod and three");

  const short = judgeKernelAnswer(task, [rod(0), block(0)]);
  assert.equal(short.correct, false);
  assert.equal(short.canonicalAnswer, "11", "the wrong build reads back as what was actually made");

  assert.equal(judgeKernelAnswer(task, []).correct, false, "an empty box never passes");
});

test("BUILD canonical answers read as fractions and decimals in their own notation", () => {
  const piece = (index) => ({ id: `p-${index}`, label: "1/4", emoji: "🍕", value: 1 });
  const fraction = {
    id: "f", verb: "build", skillId: "math-fractions", skillLabel: "Fractions", subject: "Math",
    standardCode: null, prompt: "", hint: "", explanation: "",
    tray: [piece(0), piece(1), piece(2), piece(3)],
    slots: 0, targetIds: [], targetValue: 3, format: "fraction", denominator: 4, targetLabel: "3/4",
  };
  assert.equal(judgeKernelAnswer(fraction, [piece(0), piece(1), piece(2)]).canonicalAnswer, "3/4");
  assert.equal(judgeKernelAnswer(fraction, [piece(0)]).canonicalAnswer, "1/4");

  const tenth = (index) => ({ id: `t-${index}`, label: "0.1", emoji: "🟪", value: 10 });
  const hundredth = (index) => ({ id: `h-${index}`, label: "0.01", emoji: "🟩", value: 1 });
  const decimal = {
    id: "d", verb: "build", skillId: "math-decimals", skillLabel: "Decimals", subject: "Math",
    standardCode: null, prompt: "", hint: "", explanation: "",
    tray: [tenth(0), tenth(1), tenth(2), tenth(3), hundredth(0), hundredth(1), hundredth(2), hundredth(3), hundredth(4), hundredth(5), hundredth(6)],
    slots: 0, targetIds: [], targetValue: 47, format: "decimal", denominator: 0, targetLabel: "0.47",
  };
  const built = judgeKernelAnswer(decimal, [tenth(0), tenth(1), tenth(2), tenth(3), hundredth(0), hundredth(1), hundredth(2), hundredth(3), hundredth(4), hundredth(5), hundredth(6)]);
  assert.equal(built.correct, true);
  assert.equal(built.canonicalAnswer, "0.47");
});

test("PLACE demands the exact order and reports the chosen sequence", () => {
  const tasks = buildKernelRun({
    verb: "place", profileId: "kid", grade: 2, skillId: "math-place-value", dayKey: "2026-08-30",
  });
  const task = tasks[0];
  const byId = new Map(task.tray.map((part) => [part.id, part]));
  const right = task.targetIds.map((id) => byId.get(id));
  const judged = judgeKernelAnswer(task, right);
  assert.equal(judged.correct, true);
  assert.equal(judged.canonicalAnswer, right.map((part) => part.label).join(", "));

  const reversed = judgeKernelAnswer(task, [...right].reverse());
  assert.equal(reversed.correct, false);
  assert.equal(reversed.canonicalAnswer, [...right].reverse().map((part) => part.label).join(", "));

  assert.equal(judgeKernelAnswer(task, right.slice(0, -1)).correct, false, "a short path is not a crossing");
});

test("sequence banks respect the grade floor", () => {
  // The water cycle reads at grade 3+; a TK child ordering life cycles must
  // never be handed it.
  for (let day = 1; day <= 9; day += 1) {
    for (const profileId of ["kid-a", "kid-b", "kid-c"]) {
      const tasks = buildKernelRun({
        verb: "place", profileId, grade: -1, skillId: "science-life-cycles", dayKey: `2026-08-0${day}`,
      });
      for (const task of tasks) {
        const labels = task.tray.map((part) => part.label);
        assert.ok(!labels.includes("Water evaporates"), `${task.id} reached TK`);
      }
    }
  }
});

test("an unknown skill falls back to the grade default instead of crashing", () => {
  const tasks = buildKernelRun({
    verb: "build", profileId: "kid", grade: 0, skillId: "not-a-skill", dayKey: "2026-08-30",
  });
  assert.equal(tasks.length, KERNEL_RUN_LENGTH);
  assert.equal(tasks[0].skillId, defaultKernelSkill("build", 0));
});

test("prototype key names in the skill parameter never dispatch off the generator map", () => {
  // skillId arrives from a query parameter; "constructor" or "toString"
  // resolve truthily on a plain object, so only own keys may count.
  for (const hostile of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    for (const verb of ["build", "place"]) {
      const tasks = buildKernelRun({
        verb, profileId: "kid", grade: 2, skillId: hostile, dayKey: "2026-08-30",
      });
      assert.equal(tasks.length, KERNEL_RUN_LENGTH, `${verb}/${hostile}`);
      assert.equal(tasks[0].skillId, defaultKernelSkill(verb, 2), `${verb}/${hostile}`);
    }
  }
});

test("grade defaults follow the arc of the curriculum", () => {
  assert.equal(defaultKernelSkill("build", -1), "math-counting");
  assert.equal(defaultKernelSkill("build", 1), "math-place-value");
  assert.equal(defaultKernelSkill("place", 2), "reading-sequencing");
  assert.equal(defaultKernelSkill("build", 3), "math-fractions");
  assert.equal(defaultKernelSkill("place", 5), "math-decimals");
});
