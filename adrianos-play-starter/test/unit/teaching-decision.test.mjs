import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLearnerModel,
  chooseLearningIntent,
  explainSkillForAdult,
  normalizeEvidenceLog,
} from "../../lib/adrian-learner-model.ts";

const START = new Date("2026-08-01T09:00:00.000Z").getTime();

/** One attempt. Defaults describe an ordinary, unaided, correct answer. */
function attempt(overrides = {}, index = 0) {
  return {
    at: new Date(START + index * 60_000).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "Build the number 47.",
    correctAnswer: "47",
    givenAnswer: "47",
    correct: true,
    responseMs: 4000,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
    mechanic: "choose",
    taskId: `task-${index}`,
    errorSignature: null,
    ...overrides,
  };
}

function series(count, overrides = {}, offset = 0) {
  return Array.from({ length: count }, (_, index) =>
    attempt(typeof overrides === "function" ? overrides(index) : overrides, offset + index)
  );
}

/** Distinct tasks that all show the same structural error. */
function patternedMisses(count, overrides = {}, offset = 0) {
  return Array.from({ length: count }, (_, index) =>
    attempt(
      {
        correct: false,
        givenAnswer: String(index + 2),
        errorSignature: "place-value.tens-omitted",
        taskId: `pv-task-${index}`,
        ...overrides,
      },
      offset + index
    )
  );
}

/* ================================================================== */
/* A. An isolated slip must not change routing                        */
/* ================================================================== */

test("A: eight comparable wins and one strange miss is a slip, not a pattern", () => {
  const model = buildLearnerModel("kid", [
    ...series(12, { correct: true }),
    attempt(
      { correct: false, givenAnswer: "3", errorSignature: "place-value.tens-omitted", taskId: "odd-one" },
      12
    ),
  ]);
  const skill = model.skills[0];
  assert.deepEqual(skill.errorPatterns, [], "one odd answer is not a pattern");
  assert.notEqual(skill.state, "repeatable-error-pattern");

  const decision = chooseLearningIntent(model);
  assert.ok(
    !["reteach", "prerequisite", "scaffold"].includes(decision.intent),
    `a lone slip must not trigger remediation, got ${decision.intent}`
  );
});

/* ================================================================== */
/* B. A repeated structural pattern becomes actionable                */
/* ================================================================== */

test("B: the same structural error across independent tasks becomes actionable", () => {
  const model = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    ...series(3, { correct: false, givenAnswer: "1", taskId: "x" }, 11),
  ]);
  const skill = model.skills[0];
  assert.equal(skill.state, "repeatable-error-pattern");
  assert.equal(skill.errorPatterns[0].signature, "place-value.tens-omitted");
  assert.equal(skill.errorPatterns[0].taskCount, 5);

  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "reteach");
  // A composition error is answered with something you can build.
  assert.ok(decision.preferredHref?.includes("maker-workshop"), "should route to BUILD");
  assert.ok(decision.preferredHref?.includes("skill=math-place-value"));
  assert.equal(decision.difficultyShift, -1);
});

test("B2: retrying one task is one task's worth of evidence", () => {
  // Five misses, all of the same task: a child stuck on one question, not a
  // child with a habit across the skill.
  const model = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...Array.from({ length: 5 }, (_, index) =>
      attempt(
        {
          correct: false,
          givenAnswer: "7",
          errorSignature: "place-value.tens-omitted",
          taskId: "the-same-task",
        },
        6 + index
      )
    ),
  ]);
  assert.deepEqual(model.skills[0].errorPatterns, [], "one task cannot become a pattern");
});

/* ================================================================== */
/* C. Random rapid answering                                          */
/* ================================================================== */

test("C: fast inconsistent answers are not promoted into a misconception", () => {
  const model = buildLearnerModel("kid", [
    ...series(14, (index) => ({
      correct: false,
      responseMs: 300,
      givenAnswer: String(index),
      errorSignature: "place-value.tens-omitted",
      taskId: `rapid-${index}`,
    })),
  ]);
  const skill = model.skills[0];
  assert.equal(skill.rapidResponses, true);
  assert.equal(skill.state, "possible-random-response");
  assert.deepEqual(skill.errorPatterns, [], "answers too fast to read carry no structure");

  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "scaffold");
  assert.equal(decision.hintStrategy, "immediate");
  assert.doesNotMatch(decision.childReason, /guess|random|slow down|careless|stop/i);
});

/* ================================================================== */
/* D. Slow but accurate                                               */
/* ================================================================== */

test("D: consistently slow and correct is not treated as difficulty", () => {
  // Every answer is slow, so nothing is slow *for this child*.
  const model = buildLearnerModel("kid", series(16, { correct: true, responseMs: 15_000 }));
  const skill = model.skills[0];
  assert.equal(skill.rapidResponses, false);
  assert.equal(skill.hesitation, 0);
  assert.deepEqual(skill.errorPatterns, []);
  assert.ok(
    ["secure", "emerging"].includes(skill.state),
    `slow and right should not read as difficulty, got ${skill.state}`
  );
  const decision = chooseLearningIntent(model);
  assert.ok(!["scaffold", "reteach", "prerequisite"].includes(decision.intent));
});

/* ================================================================== */
/* E. Support dependence                                              */
/* ================================================================== */

test("E: success carried by hints is never called secure", () => {
  const model = buildLearnerModel("kid", series(16, {
    correct: true,
    hintsUsed: 1,
    wrongAttempts: 1,
  }));
  const skill = model.skills[0];
  assert.equal(skill.state, "support-dependent");
  assert.deepEqual(skill.secureMechanics, []);
  assert.equal(skill.grasp, "unknown");

  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "scaffold");
  assert.equal(decision.difficultyShift, -1);
});

/* ================================================================== */
/* F, G, H. Representation combinations                               */
/* ================================================================== */

function mechanicRun(mechanic, count, correct, offset, extra = {}) {
  return series(count, {
    mechanic,
    gameSlug: mechanic === "build" ? "maker-workshop" : "stepping-stones",
    correct,
    givenAnswer: correct ? "47" : "74",
    taskId: `${mechanic}-${offset}-${Math.random()}`,
    ...extra,
  }, offset).map((row, index) => ({ ...row, taskId: `${mechanic}-${offset + index}` }));
}

test("F: secure in BUILD and weak in PLACE reads as representation-specific", () => {
  const model = buildLearnerModel("kid", [
    ...mechanicRun("build", 8, true, 0),
    ...mechanicRun("place", 6, false, 8),
  ]);
  const skill = model.skills[0];
  assert.deepEqual(skill.secureMechanics, ["build"]);
  assert.deepEqual(skill.weakMechanics, ["place"]);
  assert.equal(skill.state, "representation-specific-difficulty");

  const decision = chooseLearningIntent(model);
  assert.equal(decision.intent, "represent");
  assert.ok(decision.preferredHref?.includes("stepping-stones"), "routes to the weaker form");
  // The skill itself is fine, so the level must not drop.
  assert.equal(decision.difficultyShift, 0);
  assert.doesNotMatch(decision.childReason, /can't|cannot|bad|weak|wrong/i);
});

test("G: secure in both forms stays secure and cross-context", () => {
  const model = buildLearnerModel("kid", [
    ...mechanicRun("build", 8, true, 0),
    ...mechanicRun("place", 8, true, 8),
  ]);
  const skill = model.skills[0];
  assert.deepEqual([...skill.secureMechanics].sort(), ["build", "place"]);
  assert.deepEqual(skill.weakMechanics, []);
  assert.equal(skill.grasp, "cross-context");
  assert.equal(skill.state, "secure");
  assert.notEqual(chooseLearningIntent(model).intent, "represent");
});

test("H: weak in both forms is not mistaken for a representation problem", () => {
  const model = buildLearnerModel("kid", [
    ...mechanicRun("build", 7, false, 0),
    ...mechanicRun("place", 7, false, 7),
  ]);
  const skill = model.skills[0];
  assert.deepEqual(skill.secureMechanics, []);
  assert.equal(skill.state !== "representation-specific-difficulty", true);
  assert.notEqual(chooseLearningIntent(model).intent, "represent");
});

/* ================================================================== */
/* I. History plus recent trouble                                     */
/* ================================================================== */

test("I: recent repeated errors act without erasing earlier evidence", () => {
  const model = buildLearnerModel("kid", [
    ...series(20, { correct: true }),
    ...patternedMisses(4, {}, 20),
    ...series(4, { correct: false, givenAnswer: "0", taskId: "misc" }, 24),
  ]);
  const skill = model.skills[0];
  assert.equal(skill.attempts, 28, "earlier evidence is still counted");
  assert.equal(skill.correct, 20);
  assert.equal(skill.state, "repeatable-error-pattern");
  assert.equal(chooseLearningIntent(model).intent, "reteach");
});

test("I2: a long-ago pattern stops driving routing once it stops recurring", () => {
  const model = buildLearnerModel("kid", [
    ...patternedMisses(4, {}, 0),
    ...series(16, { correct: true }, 4),
  ]);
  assert.deepEqual(
    model.skills[0].errorPatterns,
    [],
    "an error that stopped recurring should fall out of the recent window"
  );
});

/* ================================================================== */
/* J. Cold start                                                      */
/* ================================================================== */

test("J: a cold start explores rather than inventing a need", () => {
  assert.equal(chooseLearningIntent(buildLearnerModel("kid", [])).intent, "explore");
  const thin = buildLearnerModel("kid", series(2, { correct: false, givenAnswer: "9" }));
  assert.equal(thin.skills[0].state, "unknown");
  assert.equal(chooseLearningIntent(thin).intent, "explore");
});

/* ================================================================== */
/* K, L. Legacy and corrupted evidence                                */
/* ================================================================== */

test("K: legacy rows without the new fields parse without inventing anything", () => {
  const legacy = {
    at: new Date(START).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "In 268, what digit is in the tens place?",
    correctAnswer: "6",
    givenAnswer: "2",
    correct: false,
    responseMs: 4000,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
  };
  const rows = normalizeEvidenceLog([legacy]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].taskId, null);
  assert.equal(rows[0].errorSignature, null, "no signature may be invented for legacy rows");
  assert.equal(rows[0].mechanic, "choose", "mechanic still falls back to the game");
});

test("L: corrupted persisted evidence falls back safely", () => {
  const rows = normalizeEvidenceLog([
    { ...attempt(), errorSignature: "child-does-not-understand-place-value" },
    { ...attempt(), errorSignature: 42 },
    { ...attempt(), taskId: { nope: true } },
    null,
    "nonsense",
  ]);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.errorSignature, null, "unknown signatures must not survive");
  }
  assert.equal(rows[2].taskId, null);
});

test("L2: a fabricated signature cannot drive routing", () => {
  // Distinct wrong answers, so no literal repeat exists either: the only
  // thing that could promote a pattern here is the invented signature.
  const model = buildLearnerModel("kid", [
    ...series(4, { correct: true }),
    ...series(8, (index) => ({
      correct: false,
      givenAnswer: `wrong-${index}`,
      errorSignature: "totally-made-up-signature",
      taskId: `fake-${index}`,
    }), 4),
  ]);
  assert.deepEqual(model.skills[0].errorPatterns, []);
  assert.deepEqual(model.skills[0].misconceptions, []);
  const decision = chooseLearningIntent(model);
  assert.doesNotMatch(
    decision.adultReason,
    /totally-made-up-signature/,
    "an unknown signature must never reach an explanation"
  );
});

/* ================================================================== */
/* O. Prerequisite routing                                            */
/* ================================================================== */

test("O: a prerequisite is only revisited when it is itself unsteady", () => {
  // Place value shows a repeated pattern, and counting underneath it is also
  // shaky: going back is justified.
  const shaky = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    ...series(6, {
      skillId: "math-counting",
      skillLabel: "Counting",
      correct: false,
      givenAnswer: "4",
      taskId: "count-bad",
    }, 11).map((row, index) => ({ ...row, taskId: `count-bad-${index}` })),
  ]);
  const decision = chooseLearningIntent(shaky);
  assert.equal(decision.intent, "prerequisite");
  assert.equal(decision.skillId, "math-counting");

  // Same place-value pattern, but counting is solid: the child needs help
  // with place value, not a trip backwards.
  const solidBelow = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    ...series(8, {
      skillId: "math-counting",
      skillLabel: "Counting",
      correct: true,
    }, 11).map((row, index) => ({ ...row, taskId: `count-good-${index}` })),
  ]);
  assert.equal(chooseLearningIntent(solidBelow).intent, "reteach");
});

test("O2: an unpractised prerequisite is never assumed to be the problem", () => {
  const model = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    // A single counting attempt says nothing either way.
    attempt({ skillId: "math-counting", skillLabel: "Counting", correct: false, taskId: "c1" }, 11),
  ]);
  assert.equal(chooseLearningIntent(model).intent, "reteach", "silence is not evidence of a gap");
});

/* ================================================================== */
/* The three win-condition cases must diverge                         */
/* ================================================================== */

test("the three headline cases produce three different next experiences", () => {
  const slip = buildLearnerModel("A", [
    ...series(12, { correct: true }),
    attempt({ correct: false, givenAnswer: "3", errorSignature: "place-value.tens-omitted", taskId: "one-off" }, 12),
  ]);
  const pattern = buildLearnerModel("B", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    ...series(3, { correct: false, givenAnswer: "1", taskId: "y" }, 11),
  ]);
  const representation = buildLearnerModel("C", [
    ...mechanicRun("build", 8, true, 0),
    ...mechanicRun("place", 6, false, 8),
  ]);

  const decisions = [slip, pattern, representation].map(chooseLearningIntent);
  const intents = decisions.map((decision) => decision.intent);
  assert.equal(new Set(intents).size, 3, `expected three distinct intents, got ${intents.join(", ")}`);

  const states = [slip, pattern, representation].map((model) => model.skills[0].state);
  assert.equal(new Set(states).size, 3, `expected three distinct states, got ${states.join(", ")}`);

  // And the destinations genuinely differ, not just the labels.
  assert.notEqual(decisions[1].preferredHref, decisions[2].preferredHref);
});

/* ================================================================== */
/* Parent language                                                    */
/* ================================================================== */

test("parent explanations describe what happened and what changed", () => {
  const pattern = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...patternedMisses(5, {}, 6),
    ...series(3, { correct: false, givenAnswer: "1", taskId: "z" }, 11),
  ]);
  const sentence = explainSkillForAdult(pattern.skills[0], "Adrian");
  assert.match(sentence, /Adrian/);
  assert.match(sentence, /different/);
  assert.doesNotMatch(sentence, /\d+%\s*(probability|confidence)|deficit|disorder|AI |does not understand/i);

  const representation = buildLearnerModel("kid", [
    ...mechanicRun("build", 8, true, 0),
    ...mechanicRun("place", 6, false, 8),
  ]);
  const second = explainSkillForAdult(representation.skills[0], "Adrian");
  assert.match(second, /reliably/);
  assert.doesNotMatch(second, /weak|deficit|behind|cannot/i);
});

test("no decision ever speaks to a child in the language of failure", () => {
  const models = [
    buildLearnerModel("kid", series(16, { correct: true, hintsUsed: 1, wrongAttempts: 1 })),
    buildLearnerModel("kid", [...series(6, { correct: true }), ...patternedMisses(5, {}, 6), ...series(3, { correct: false, givenAnswer: "1", taskId: "w" }, 11)]),
    buildLearnerModel("kid", [...mechanicRun("build", 8, true, 0), ...mechanicRun("place", 6, false, 8)]),
    buildLearnerModel("kid", series(14, (index) => ({ correct: false, responseMs: 300, givenAnswer: String(index), taskId: `r${index}` }))),
    buildLearnerModel("kid", []),
  ];
  for (const model of models) {
    const decision = chooseLearningIntent(model);
    assert.doesNotMatch(
      decision.childReason,
      /\b(bad|behind|easy|weak|deficit|fail|failing|wrong|poor|low|slow)\b|should know|struggl|can't|cannot/i,
      `child-facing copy must protect self-concept: "${decision.childReason}"`
    );
    assert.ok(decision.childReason.length < 80, "child copy stays glanceable");
  }
});
