import assert from "node:assert/strict";
import test from "node:test";
import {
  deduceErrorSignature,
  isCleanDeduction,
  isComparisonReversal,
} from "../../lib/learning/deduce-evidence.ts";
import { buildDeduceRun, DEDUCE_SKILLS, strikeLine } from "../../lib/kernels/deduce-tasks.ts";
import { rulingConstraint, satisfies } from "../../lib/kernels/deduce-constraints.ts";
import { describeSignature, isKnownSignature } from "../../lib/learning/error-signatures.ts";
import {
  buildLearnerModel,
  chooseLearningIntent,
  explainSkillForAdult,
  graspLabel,
} from "../../lib/adrian-learner-model.ts";
import { distinctCategories, mechanicCategory } from "../../lib/kernels/kernel-registry.ts";

const CLEAN = { unjustifiedEliminations: 0, misattributedStrikes: 0, restored: 0, misappliedKinds: [] };

function numberTask() {
  return {
    id: "t",
    skillId: "math-place-value",
    skillLabel: "Place value",
    subject: "Math",
    standardCode: null,
    prompt: "Which number am I?",
    candidates: [
      { id: "n-44", label: "44", emoji: "🪵", value: 44, denominator: 0, attributes: ["even"], position: 44 },
      { id: "n-48", label: "48", emoji: "🍄", value: 48, denominator: 0, attributes: ["even"], position: 48 },
      { id: "n-63", label: "63", emoji: "🌿", value: 63, denominator: 0, attributes: ["odd"], position: 63 },
    ],
    clues: [
      { kind: "tens-is", count: 4 },
      { kind: "lacks-digit", digit: 8 },
    ],
    solutionId: "n-44",
    cluesNeeded: 2,
    explanation: "44 is the only one that fits every clue.",
  };
}

/* ================================================================== */
/* The distinction the verb exists for                                */
/* ================================================================== */

test("working the clues and landing on the answer are told apart", () => {
  const worked = isCleanDeduction({ correct: true, revealedCount: 2, cluesNeeded: 2, trace: CLEAN });
  assert.equal(worked, true);

  // Right card, but decided before the clues could separate the field.
  const early = isCleanDeduction({ correct: true, revealedCount: 1, cluesNeeded: 2, trace: CLEAN });
  assert.equal(early, false, "an answer reached before the clues is not deduction");

  // Right card, but reached by crossing out cards nothing contradicted.
  const swept = isCleanDeduction({
    correct: true,
    revealedCount: 2,
    cluesNeeded: 2,
    trace: { unjustifiedEliminations: 2, misattributedStrikes: 0, restored: 0, misappliedKinds: [] },
  });
  assert.equal(swept, false, "clearing the board is not reasoning");

  // A wrong answer is never clean, however careful the process looked.
  assert.equal(
    isCleanDeduction({ correct: false, revealedCount: 2, cluesNeeded: 2, trace: CLEAN }),
    false
  );
});

test("an uncorrected unsupported cross-out still counts against the solve", () => {
  // The distinction the UI maintains: only cross-outs still standing at the
  // end count. One left uncorrected means the field was not narrowed by
  // reasoning alone.
  assert.equal(
    isCleanDeduction({
      correct: true,
      revealedCount: 2,
      cluesNeeded: 2,
      trace: { unjustifiedEliminations: 1, misattributedStrikes: 0, restored: 3, misappliedKinds: [] },
    }),
    false
  );
});

test("correcting yourself is not held against you", () => {
  // Crossed a card out, thought again, brought it back, then solved it.
  const recovered = isCleanDeduction({
    correct: true,
    revealedCount: 2,
    cluesNeeded: 2,
    trace: { unjustifiedEliminations: 0, misattributedStrikes: 0, restored: 2, misappliedKinds: [] },
  });
  assert.equal(recovered, true, "restoring a card is a correction, not a fault");
});

/* ================================================================== */
/* Signatures                                                         */
/* ================================================================== */

test("keeping a card the clues exclude is named by which relationship was missed", () => {
  const task = numberTask();
  const comparison = {
    ...task,
    clues: [{ kind: "greater-than", value: 50 }, { kind: "lacks-digit", digit: 8 }],
    solutionId: "n-63",
  };
  assert.equal(
    deduceErrorSignature({
      task: comparison,
      chosen: comparison.candidates[0],
      revealedCount: 2,
      trace: CLEAN,
    }),
    "deduce.comparison-ignored"
  );

  const ordering = {
    ...task,
    clues: [{ kind: "comes-after", anchorId: "n-44" }, { kind: "lacks-digit", digit: 3 }],
    solutionId: "n-48",
  };
  assert.equal(
    deduceErrorSignature({
      task: ordering,
      chosen: ordering.candidates[0],
      revealedCount: 2,
      trace: CLEAN,
    }),
    "deduce.order-relation-ignored"
  );

  const fraction = {
    ...task,
    candidates: [
      { id: "f-1-3", label: "1/3", emoji: "🍰", value: 1, denominator: 3, attributes: [], position: 0.33 },
      { id: "f-3-4", label: "3/4", emoji: "🍰", value: 3, denominator: 4, attributes: [], position: 0.75 },
      { id: "f-1-4", label: "1/4", emoji: "🍰", value: 1, denominator: 4, attributes: [], position: 0.25 },
    ],
    clues: [{ kind: "denominator-is", value: 4 }, { kind: "numerator-is", value: 3 }],
    solutionId: "f-3-4",
  };
  assert.equal(
    deduceErrorSignature({
      task: fraction,
      chosen: fraction.candidates[0],
      revealedCount: 2,
      trace: CLEAN,
    }),
    "deduce.fraction-part-confused"
  );
});

test("deciding early and sweeping the board are separate observations", () => {
  const task = numberTask();
  // Only one clue seen; the kept card fits it, so nothing is contradicted.
  assert.equal(
    deduceErrorSignature({
      task,
      chosen: task.candidates[1],
      revealedCount: 1,
      trace: CLEAN,
    }),
    "deduce.decided-before-enough-clues"
  );

  // All clues seen, kept card fits them all, yet it is wrong: the answer
  // itself must have been crossed out along the way.
  const swept = {
    ...task,
    clues: [{ kind: "tens-is", count: 4 }],
    cluesNeeded: 1,
    solutionId: "n-48",
  };
  assert.equal(
    deduceErrorSignature({
      task: swept,
      chosen: swept.candidates[0],
      revealedCount: 1,
      trace: { unjustifiedEliminations: 1, misattributedStrikes: 0, restored: 0, misappliedKinds: [] },
    }),
    "deduce.ruled-out-without-a-reason"
  );
});

test("a systematic comparison reversal is recognised only when unmistakable", () => {
  const task = {
    ...numberTask(),
    clues: [{ kind: "greater-than", value: 45 }, { kind: "lacks-digit", digit: 3 }],
    solutionId: "n-48",
  };
  // Ruled out exactly the cards the comparison keeps, kept the ones it excludes.
  assert.equal(
    isComparisonReversal({ task, ruledOutIds: ["n-48", "n-63"], revealedCount: 2 }),
    true
  );
  // A partial or ordinary mistake is not a reversal.
  assert.equal(isComparisonReversal({ task, ruledOutIds: ["n-48"], revealedCount: 2 }), false);
  assert.equal(isComparisonReversal({ task, ruledOutIds: [], revealedCount: 2 }), false);
  // No comparison revealed yet, so no reversal can be claimed.
  assert.equal(isComparisonReversal({ task, ruledOutIds: ["n-48", "n-63"], revealedCount: 0 }), false);
});

test("deduce signatures describe the clue relationship, never the child", () => {
  const signatures = [
    "deduce.comparison-ignored",
    "deduce.order-relation-ignored",
    "deduce.fraction-part-confused",
    "deduce.contradicted-card-kept",
    "deduce.decided-before-enough-clues",
    "deduce.ruled-out-without-a-reason",
  ];
  for (const signature of signatures) {
    assert.ok(isKnownSignature(signature), `${signature} must be known`);
    const phrase = describeSignature(signature);
    assert.ok(phrase && phrase.length > 0);
    assert.doesNotMatch(
      phrase,
      /understand|deficit|weak|struggl|unable|careless|lazy|guess/i,
      `${signature} wording judges the child`
    );
  }
});

test("a real generated puzzle produces no signature when solved properly", () => {
  const [task] = buildDeduceRun({
    profileId: "kid", grade: 2, skillId: "math-place-value", dayKey: "2026-09-01",
  });
  const answer = task.candidates.find((row) => row.id === task.solutionId);
  assert.equal(
    deduceErrorSignature({
      task,
      chosen: answer,
      revealedCount: task.clues.length,
      trace: CLEAN,
    }),
    null
  );
});

/* ================================================================== */
/* Mechanic categories: breadth that means something                  */
/* ================================================================== */

test("kinds of thinking are counted, not skins", () => {
  assert.equal(mechanicCategory("choose"), "recognition");
  assert.equal(mechanicCategory("recall"), "recognition");
  assert.equal(mechanicCategory("build"), "construction");
  assert.equal(mechanicCategory("place"), "position");
  assert.equal(mechanicCategory("deduce"), "inference");

  // Recognising an answer twice over is one kind of demand, not two.
  assert.deepEqual(distinctCategories(["choose", "recall"]), ["recognition"]);
  assert.equal(distinctCategories(["choose", "build", "place", "deduce"]).length, 4);
});

/* ================================================================== */
/* The learner model                                                  */
/* ================================================================== */

const START = new Date("2026-08-01T09:00:00.000Z").getTime();

function attempt(overrides = {}, index = 0) {
  return {
    at: new Date(START + index * 60_000).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "Which number am I?",
    correctAnswer: "44",
    givenAnswer: "44",
    correct: true,
    responseMs: 5000,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "1.NBT.B.3",
    mechanic: "choose",
    taskId: `task-${index}`,
    errorSignature: null,
    reasoned: null,
    ...overrides,
  };
}

function run(count, overrides = {}, offset = 0) {
  return Array.from({ length: count }, (_, index) =>
    attempt({ ...overrides, taskId: `${overrides.mechanic ?? "choose"}-${offset + index}` }, offset + index)
  );
}

test("solving by guessing never becomes secure deduction evidence", () => {
  // Every answer right, every one of them reached without using the clues.
  const guessed = buildLearnerModel("kid", [
    ...run(6, { mechanic: "build", gameSlug: "maker-workshop" }),
    ...run(8, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: false }, 6),
  ]);
  const skill = guessed.skills[0];
  assert.ok(skill.secureMechanics.includes("build"));
  assert.ok(
    !skill.secureMechanics.includes("deduce"),
    "right answers without reasoning are not deductive competence"
  );

  // The same run, actually reasoned, does count.
  const reasoned = buildLearnerModel("kid", [
    ...run(6, { mechanic: "build", gameSlug: "maker-workshop" }),
    ...run(8, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: true }, 6),
  ]);
  assert.ok(reasoned.skills[0].secureMechanics.includes("deduce"));
});

test("mechanics that cannot report reasoning are unaffected by the rule", () => {
  const model = buildLearnerModel("kid", run(10, { mechanic: "choose" }));
  assert.deepEqual(model.skills[0].secureMechanics, ["choose"]);
});

test("four ways of recognising is still one kind of knowing", () => {
  const recognitionOnly = buildLearnerModel("kid", [
    ...run(6, { mechanic: "choose", gameSlug: "number-quest" }),
    ...run(6, { mechanic: "recall", gameSlug: "memory-match" }, 6),
  ]);
  const skill = recognitionOnly.skills[0];
  assert.equal(skill.secureMechanics.length, 2, "two mechanics are secure");
  assert.deepEqual(skill.secureCategories, ["recognition"]);
  assert.equal(skill.grasp, "single-context", "but only one kind of demand");
});

test("construction, position and inference together read as genuine breadth", () => {
  const broad = buildLearnerModel("kid", [
    ...run(5, { mechanic: "build", gameSlug: "maker-workshop" }),
    ...run(5, { mechanic: "place", gameSlug: "stepping-stones" }, 5),
    ...run(5, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: true }, 10),
  ]);
  const skill = broad.skills[0];
  assert.equal(skill.secureCategories.length, 3);
  assert.equal(skill.grasp, "cross-context");
  assert.match(graspLabel(skill), /3 different kinds/);
  assert.match(explainSkillForAdult(skill, "Adrian"), /Adrian/);
});

/* ================================================================== */
/* Teaching decisions                                                 */
/* ================================================================== */

test("a skill secure in building and placing is offered inference next", () => {
  const model = buildLearnerModel("kid", [
    ...run(8, { mechanic: "build", gameSlug: "maker-workshop", responseMs: 2600 }),
    ...run(8, { mechanic: "place", gameSlug: "stepping-stones", responseMs: 2600 }, 8),
  ]);
  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "transfer");
  assert.ok(
    decision.preferredHref?.includes("clue-hollow"),
    `expected a route into Clue Hollow, got ${decision.preferredHref}`
  );
  assert.ok(decision.preferredHref?.includes("skill=math-place-value"));
  assert.doesNotMatch(decision.childReason, /deduce|infer|reason|logic/i);
});

test("inference is offered after the concrete forms, not before them", () => {
  // Secure only in recognition: the child should meet the idea in their
  // hands before being asked to work it out from relationships.
  const model = buildLearnerModel("kid", run(16, { mechanic: "choose", responseMs: 2600 }));
  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "transfer");
  assert.ok(
    decision.preferredHref?.includes("maker-workshop"),
    `construction comes first, got ${decision.preferredHref}`
  );
});

test("a weak representation is still addressed rather than skipped for novelty", () => {
  // Secure building, struggling with placing, and no inference evidence at
  // all. The new verb must not distract from the form that needs work.
  const model = buildLearnerModel("kid", [
    ...run(8, { mechanic: "build", gameSlug: "maker-workshop" }),
    ...run(6, {
      mechanic: "place",
      gameSlug: "stepping-stones",
      correct: false,
      givenAnswer: "63",
    }, 8),
  ]);
  const skill = model.skills[0];
  assert.equal(skill.state, "representation-specific-difficulty");

  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "represent");
  assert.ok(
    decision.preferredHref?.includes("stepping-stones"),
    `the weaker form is the destination, got ${decision.preferredHref}`
  );
  assert.ok(!decision.preferredHref?.includes("clue-hollow"));
});

test("a repeated structural error still outranks the newest activity", () => {
  const model = buildLearnerModel("kid", [
    ...run(6, { mechanic: "build", gameSlug: "maker-workshop" }),
    ...Array.from({ length: 5 }, (_, index) =>
      attempt({
        mechanic: "build",
        gameSlug: "maker-workshop",
        correct: false,
        givenAnswer: String(index + 2),
        errorSignature: "place-value.tens-omitted",
        taskId: `pv-${index}`,
      }, 6 + index)
    ),
    ...run(3, { mechanic: "build", gameSlug: "maker-workshop", correct: false, givenAnswer: "1" }, 11),
  ]);
  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "reteach");
  assert.ok(
    decision.preferredHref?.includes("maker-workshop"),
    "a composition error is answered with something to build"
  );
});

test("thin deduction evidence stays unknown rather than becoming a claim", () => {
  const model = buildLearnerModel("kid", run(2, {
    mechanic: "deduce",
    gameSlug: "clue-hollow",
    reasoned: true,
  }));
  assert.equal(model.skills[0].state, "unknown");
  assert.equal(chooseLearningIntent(model).intent, "explore");
});

test("legacy rows carry no reasoning claim", () => {
  const model = buildLearnerModel("kid", run(6, { mechanic: "deduce", gameSlug: "clue-hollow" }));
  // reasoned is null on every row, so the rule cannot penalise them.
  assert.ok(model.skills[0].mechanics.some((row) => row.mechanic === "deduce"));
  assert.equal(model.skills[0].mechanics.find((row) => row.mechanic === "deduce").reasonedRate, 1);
});

/*
 * Naming the clue, played out over the whole generated space.
 *
 * These replay agents against every puzzle the generators can produce, using
 * exactly the rules the surface applies: a crossing is unjustified when no
 * shown clue rules the card out, and misattributed when some clue does but
 * not the one the child named.
 *
 * The point of the verb is that a right answer reached by guessing and a
 * right answer reached by reasoning look different. Before naming the clue
 * they did not: revealing every clue costs nothing, every puzzle needs its
 * whole clue set, and at full reveal every card except the answer is ruled
 * out by something — so sparing one card at random left a trace identical to
 * a reasoner's on a quarter of puzzles, and an outright oracle read the
 * answer off the surface's own replies on all of them.
 */
function playSpace(name, chooseSpared, nameClue) {
  let puzzles = 0;
  let reasoned = 0;
  for (let profile = 0; profile < 12; profile += 1) {
    for (const grade of [-1, 0, 1, 2, 3, 4, 5]) {
      for (const skillId of DEDUCE_SKILLS) {
        for (const task of buildDeduceRun({
          profileId: `kid-${profile}`,
          grade,
          skillId,
          difficultyShift: 0,
          dayKey: "2026-09-05",
        })) {
          puzzles += 1;
          const spared = chooseSpared(task, profile);
          const crossed = task.candidates.filter((row) => row.id !== spared.id);
          let unjustifiedEliminations = 0;
          let misattributedStrikes = 0;
          for (const [order, card] of crossed.entries()) {
            const named = task.clues[nameClue(task, card, profile, order)];
            if (!rulingConstraint(card, task.clues, task.candidates)) unjustifiedEliminations += 1;
            else if (satisfies(card, named, task.candidates)) misattributedStrikes += 1;
          }
          if (isCleanDeduction({
            correct: spared.id === task.solutionId,
            revealedCount: task.clues.length,
            cluesNeeded: task.cluesNeeded,
            trace: { unjustifiedEliminations, misattributedStrikes, restored: 0, misappliedKinds: [] },
          })) reasoned += 1;
        }
      }
    }
  }
  return { name, puzzles, rate: reasoned / puzzles };
}

const solutionOf = (task) => task.candidates.find((row) => row.id === task.solutionId);
const rulingClueIndex = (task, card) =>
  task.clues.findIndex((clue) => !satisfies(card, clue, task.candidates));

test("a child who names the ruling clue is always credited", () => {
  const played = playSpace("honest", solutionOf, rulingClueIndex);
  assert.equal(
    played.rate,
    1,
    `reasoning correctly must always read as reasoning, got ${played.rate}`
  );
});

test("a child who misnames a clue on every puzzle is not credited", () => {
  // Wrong on the first card of every puzzle, right on the rest.
  const played = playSpace("misnames one clue per puzzle", solutionOf, (task, card, _p, order) => {
    if (order === 0) {
      const wrong = task.clues.findIndex((clue) => satisfies(card, clue, task.candidates));
      if (wrong >= 0) return wrong;
    }
    return rulingClueIndex(task, card);
  });
  // Forgiveness for a real slip lives a level up: a run is four puzzles and
  // the model wants a reasoned rate of 0.6, so slipping on one still leaves
  // 0.75. Measured over 16,800 runs, that child clears the bar every time.
  // Slipping on *every* puzzle is a habit, and this is what says so.
  assert.ok(
    played.rate < 0.1,
    `misnaming a clue every time must not read as reasoning, got ${played.rate}`
  );
});

test("crossing out without reading the clues does not read as reasoning", () => {
  const played = playSpace(
    "blind",
    (task, profile) => task.candidates[profile % task.candidates.length],
    (task, _card, profile) => profile % task.clues.length
  );
  assert.ok(
    played.rate < 0.1,
    `blind play must not look like reasoning, got ${(played.rate * 100).toFixed(2)}%`
  );
});

/*
 * The structural fact the whole design rests on: no clue ever rules out the
 * answer. It is why a child cannot cross out the solution and still show a
 * clean trace, and why "spare a card at random" was worth a quarter of the
 * puzzles before naming was required.
 */
test("no clue ever rules out the answer", () => {
  for (let profile = 0; profile < 6; profile += 1) {
    for (const grade of [-1, 0, 1, 2, 3, 4, 5]) {
      for (const skillId of DEDUCE_SKILLS) {
        for (const task of buildDeduceRun({
          profileId: `kid-${profile}`, grade, skillId, difficultyShift: 0, dayKey: "2026-09-05",
        })) {
          assert.equal(
            rulingConstraint(solutionOf(task), task.clues, task.candidates),
            null,
            `${task.id} has a clue that rules out its own answer`
          );
        }
      }
    }
  }
});

/* The sentence a strike says cannot depend on whether the strike was right. */
test("the strike sentence is built from the child's two choices and nothing else", () => {
  assert.equal(strikeLine("I am more than 3.", "11"), "I am more than 3. 11 is out.");
  assert.equal(strikeLine.length, 2);
});
