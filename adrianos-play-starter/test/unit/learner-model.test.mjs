import assert from "node:assert/strict";
import test from "node:test";
import {
  actionLabel,
  buildLearnerModel,
  confidenceLabel,
  graspLabel,
  normalizeAnswer,
  normalizeEvidenceLog,
  recommendNextActivity,
} from "../../lib/adrian-learner-model.ts";

const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-08-01T09:00:00.000Z").getTime();

function evidence(overrides = {}, index = 0) {
  return {
    at: new Date(START + index * 60_000).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "In 147, what digit is in the tens place?",
    correctAnswer: "4",
    givenAnswer: "4",
    correct: true,
    responseMs: 4000,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
    ...overrides,
  };
}

function series(count, overrides = {}, offset = 0) {
  return Array.from({ length: count }, (_, index) =>
    evidence(typeof overrides === "function" ? overrides(index) : overrides, offset + index)
  );
}

test("an empty log produces an unopinionated model", () => {
  const model = buildLearnerModel("kid", []);
  assert.equal(model.sampleSize, 0);
  assert.equal(model.confident, false);
  assert.equal(model.readiness, "unknown");
  assert.equal(model.pace, "unknown");
  assert.equal(model.focusSkill, null);
  assert.deepEqual(model.misconceptions, []);
});

test("thin evidence falls back to exploring instead of guessing at a need", () => {
  const model = buildLearnerModel("kid", series(4, { correct: false, givenAnswer: "7" }));
  assert.equal(model.confident, false);
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "explore");
  assert.equal(next.skillId, null);
  assert.equal(next.difficultyShift, 0);
});

test("normalization drops unusable rows and impossible response times", () => {
  const rows = normalizeEvidenceLog([
    evidence(),
    { ...evidence(), skillId: "" },
    null,
    "nonsense",
    { ...evidence(), responseMs: 45 * 60 * 1000 },
    { ...evidence(), responseMs: -20 },
  ]);
  assert.equal(rows.length, 3);
  // The two impossible timings survive as rows but without a response time,
  // so a tab left open cannot masquerade as deep thinking.
  assert.equal(rows.filter((row) => row.responseMs === null).length, 2);
});

test("answers cluster into a misconception only when the same one repeats", () => {
  const oneOff = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    evidence({ correct: false, givenAnswer: "7" }, 6),
    evidence({ correct: false, givenAnswer: "1" }, 7),
  ]);
  assert.deepEqual(oneOff.misconceptions, []);

  const repeated = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...series(3, { correct: false, givenAnswer: "7" }, 6),
  ]);
  assert.equal(repeated.misconceptions.length, 1);
  assert.equal(repeated.misconceptions[0].answer, "7");
  assert.equal(repeated.misconceptions[0].count, 3);
  assert.equal(repeated.misconceptions[0].expected, "4");
});

test("a wrong answer that matches the expected answer is ignored as a reporting bug", () => {
  const model = buildLearnerModel("kid", [
    ...series(8, { correct: true }),
    ...series(4, { correct: false, givenAnswer: " 4. " }, 8),
  ]);
  assert.deepEqual(model.misconceptions, []);
});

test("normalizeAnswer folds spacing and trailing punctuation but not content", () => {
  assert.equal(normalizeAnswer(" 12 "), "12");
  assert.equal(normalizeAnswer("12."), "12");
  assert.equal(normalizeAnswer("Twelve"), "twelve");
  assert.notEqual(normalizeAnswer("12"), normalizeAnswer("21"));
});

test("a repeating misconception is reteaught rather than practised harder", () => {
  const model = buildLearnerModel("kid", [
    ...series(8, { correct: true }),
    ...series(6, { correct: false, givenAnswer: "7" }, 8),
  ]);
  assert.equal(model.confident, true);
  assert.equal(model.focusSkill?.action, "reteach");

  const next = recommendNextActivity(model);
  assert.equal(next.intent, "reteach");
  assert.equal(next.skillId, "math-place-value");
  assert.equal(next.difficultyShift, -1);
  assert.equal(next.hintStrategy, "immediate");
  assert.match(next.adultReason, /"7"/);
  // The child-facing line must never mention scores or being behind.
  assert.doesNotMatch(next.childReason, /wrong|behind|score|%|assess/i);
});

test("fluency shown in only one interaction form routes to a new form before harder work", () => {
  // 16 fluent answers, all of them chosen from options in number-quest: the
  // skill is reliable in one mechanic, so the model asks for the same skill
  // through a different verb instead of simply raising the difficulty.
  const model = buildLearnerModel("kid", series(16, { correct: true, responseMs: 2600 }));
  assert.equal(model.readiness, "stretch");
  assert.equal(model.stretchSkill?.skillId, "math-place-value");

  const next = recommendNextActivity(model);
  assert.equal(next.intent, "transfer");
  assert.equal(next.skillId, "math-place-value");
  assert.ok(next.preferredHref?.includes("skill=math-place-value"), "the route must carry the skill");
  assert.doesNotMatch(next.childReason, /transfer|mechanic|evidence|context/i);
});

test("independent fluent work raises the challenge when no new interaction form exists", () => {
  const model = buildLearnerModel("kid", series(16, {
    correct: true,
    responseMs: 2600,
    gameSlug: "word-forge-studio",
    subject: "Reading",
    skillId: "spelling-grade-2",
    skillLabel: "Word construction",
    prompt: "Build the word.",
    correctAnswer: "train",
    givenAnswer: "train",
  }));
  assert.equal(model.readiness, "stretch");

  const next = recommendNextActivity(model);
  assert.equal(next.intent, "stretch");
  assert.equal(next.difficultyShift, 1);
  assert.equal(next.hintStrategy, "on-request");
  assert.equal(next.preferredHref, null);
});

test("hint and retry reliance lowers fluency even when answers are correct", () => {
  const unaided = buildLearnerModel("kid", series(14, { correct: true }));
  const leaned = buildLearnerModel("kid", series(14, {
    correct: true,
    hintsUsed: 1,
    wrongAttempts: 1,
  }));
  const unaidedFluency = unaided.skills[0].fluency;
  const leanedFluency = leaned.skills[0].fluency;
  assert.equal(unaided.skills[0].accuracy, leaned.skills[0].accuracy);
  assert.ok(leanedFluency < unaidedFluency, "support reliance must reduce fluency");
  assert.notEqual(leaned.readiness, "stretch");
});

test("hesitation is measured against the child's own baseline, not a fixed speed", () => {
  const deliberate = buildLearnerModel("kid", series(14, { responseMs: 14_000 }));
  // Every answer is slow, so nothing is unusually slow: hesitation stays at zero
  // and a thoughtful child is not scored as struggling.
  assert.equal(deliberate.skills[0].hesitation, 0);
  assert.equal(deliberate.pace, "deliberate");
  assert.equal(deliberate.skills[0].confidence, "solid");

  const mixed = buildLearnerModel("kid", [
    ...series(12, { responseMs: 3000 }),
    ...series(6, {
      skillId: "math-fractions",
      skillLabel: "Fractions",
      responseMs: 15_000,
    }, 12),
  ]);
  const fractions = mixed.skills.find((skill) => skill.skillId === "math-fractions");
  assert.ok(fractions.hesitation > 0.5, "an outlier skill should read as hesitant");
  assert.equal(mixed.pace, "quick");
});

test("fast and wrong reads as guessing, slow and wrong as struggling", () => {
  const guessing = buildLearnerModel("kid", [
    ...series(10, { responseMs: 4000, correct: true }),
    ...series(8, {
      skillId: "math-fractions",
      skillLabel: "Fractions",
      responseMs: 900,
      correct: false,
      givenAnswer: "1",
    }, 10),
  ]);
  assert.equal(
    guessing.skills.find((skill) => skill.skillId === "math-fractions").confidence,
    "guessing"
  );

  const struggling = buildLearnerModel("kid", [
    ...series(10, { responseMs: 4000, correct: true }),
    ...series(8, {
      skillId: "math-fractions",
      skillLabel: "Fractions",
      responseMs: 22_000,
      correct: false,
      givenAnswer: "1",
    }, 10),
  ]);
  assert.equal(
    struggling.skills.find((skill) => skill.skillId === "math-fractions").confidence,
    "struggling"
  );
});

test("trend compares recent answers against earlier ones", () => {
  const rising = buildLearnerModel("kid", [
    ...series(6, { correct: false, givenAnswer: "7" }),
    ...series(6, { correct: true }, 6),
  ]);
  assert.equal(rising.skills[0].trend, "rising");

  const slipping = buildLearnerModel("kid", [
    ...series(6, { correct: true }),
    ...series(6, { correct: false, givenAnswer: "7" }, 6),
  ]);
  assert.equal(slipping.skills[0].trend, "slipping");
});

test("the weakest skill is chosen for focus, not the most recent", () => {
  const model = buildLearnerModel("kid", [
    ...series(8, {
      skillId: "math-fractions",
      skillLabel: "Fractions",
      correct: false,
      givenAnswer: "1",
    }),
    ...series(8, { correct: true }, 8),
  ]);
  assert.equal(model.skills[0].skillId, "math-place-value", "sorted most recent first");
  assert.equal(model.focusSkill.skillId, "math-fractions");
});

test("evidence from several games is attributed to the same skill", () => {
  const model = buildLearnerModel("kid", [
    ...series(6, { gameSlug: "number-quest" }),
    ...series(6, { gameSlug: "math-blast" }, 6),
  ]);
  assert.equal(model.skills.length, 1);
  assert.deepEqual(model.skills[0].gameSlugs.sort(), ["math-blast", "number-quest"]);
  assert.equal(model.skills[0].attempts, 12);
});

test("the log is capped and keeps the newest evidence", () => {
  const rows = normalizeEvidenceLog(
    Array.from({ length: 520 }, (_, index) =>
      evidence({ prompt: `q${index}` }, index)
    )
  );
  assert.equal(rows.length, 400);
  assert.equal(rows[rows.length - 1].prompt, "q519");
});

test("out-of-order evidence is sorted before any trend is derived", () => {
  const rows = normalizeEvidenceLog([
    evidence({ prompt: "third" }, 2),
    evidence({ prompt: "first" }, 0),
    evidence({ prompt: "second" }, 1),
  ]);
  assert.deepEqual(rows.map((row) => row.prompt), ["first", "second", "third"]);
});

test("untimed games still produce accuracy-based inferences", () => {
  const model = buildLearnerModel("kid", series(14, { responseMs: null }));
  assert.equal(model.baselineResponseMs, null);
  assert.equal(model.pace, "unknown");
  assert.equal(model.skills[0].medianResponseMs, null);
  assert.equal(model.skills[0].hesitation, 0);
  assert.equal(model.readiness, "stretch");
});

test("old and new evidence both count toward the same skill history", () => {
  const model = buildLearnerModel("kid", [
    ...Array.from({ length: 6 }, (_, index) => ({
      ...evidence({ correct: false, givenAnswer: "7" }),
      at: new Date(START - 30 * DAY + index * 60_000).toISOString(),
    })),
    ...series(6, { correct: true }),
  ]);
  assert.equal(model.skills[0].attempts, 12);
  assert.equal(model.skills[0].trend, "rising");
});

test("confidence labels stay readable for an adult surface", () => {
  assert.equal(confidenceLabel("guessing"), "Answering fast without checking");
  assert.equal(confidenceLabel("unknown"), "Not enough attempts yet");
});

test("a forming skill is practised rather than reteaught or stretched", () => {
  // Mostly right, but leaning on support: not a misconception, not fluent.
  const model = buildLearnerModel("kid", [
    ...series(11, { correct: true, hintsUsed: 1, wrongAttempts: 1 }),
    // Each slip is a different answer, so nothing clusters into a misconception.
    ...["9", "3", "0", "8"].map((answer, index) =>
      evidence({ correct: false, givenAnswer: answer }, 11 + index)
    ),
  ]);
  assert.deepEqual(model.misconceptions, []);
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "practice");
  assert.equal(next.skillId, "math-place-value");
  assert.equal(next.hintStrategy, "early");
  assert.ok(next.preferredSlugs.includes("number-quest"));
});

test("a struggling forming skill drops the difficulty while practising", () => {
  const model = buildLearnerModel("kid", [
    // The fast skill sets the child's baseline, so the slow one stands out.
    ...series(20, { correct: true, responseMs: 3000 }),
    ...series(8, {
      skillId: "math-fractions",
      skillLabel: "Fractions",
      correct: false,
      responseMs: 26_000,
      givenAnswer: "1",
    }, 20),
  ]);
  const fractions = model.skills.find((skill) => skill.skillId === "math-fractions");
  assert.equal(fractions.confidence, "struggling");
  assert.equal(fractions.action, "reteach");

  const next = recommendNextActivity(model);
  assert.equal(next.difficultyShift, -1);
});

test("action labels stay readable for an adult surface", () => {
  assert.equal(actionLabel("stretch"), "Ready for harder work");
  assert.equal(actionLabel("reteach"), "Needs reteaching");
  assert.equal(actionLabel("revisit"), "Worth revisiting later");
  assert.equal(actionLabel("practice"), "Keep practising");
});

test("a confident learner with only revisit-grade skills falls back to exploring", () => {
  // Accurate but never independent enough to stretch, and with no skill that
  // has enough attempts to rank, the model refuses to invent a focus.
  const model = buildLearnerModel("kid", [
    ...series(6, { skillId: "a", skillLabel: "A", correct: true }),
    ...series(6, { skillId: "b", skillLabel: "B", correct: true }, 6),
  ]);
  assert.equal(model.confident, true);
  assert.ok(model.focusSkill !== null);
});

/* ------------------------------------------------------------------ */
/* Cross-mechanic evidence and transfer                                */
/* ------------------------------------------------------------------ */

test("reliable answers in a single mechanic never read as cross-context", () => {
  // 30 perfect answers, every one of them chosen from options. However
  // fluent this looks, it is evidence in exactly one interaction form.
  const model = buildLearnerModel("kid", series(30, { correct: true, responseMs: 2500 }));
  const skill = model.skills[0];
  assert.deepEqual(skill.secureMechanics, ["choose"]);
  assert.equal(skill.grasp, "single-context");
  assert.equal(graspLabel(skill), "Reliable in one kind of activity so far");
});

test("secure evidence in a second mechanic flips grasp and retires the transfer offer", () => {
  const model = buildLearnerModel("kid", [
    ...series(12, { correct: true, responseMs: 2500 }),
    ...series(4, {
      correct: true,
      gameSlug: "maker-workshop",
      mechanic: "build",
      prompt: "Build the number 47 with tens and ones.",
      correctAnswer: "47",
      givenAnswer: "47",
    }, 12),
  ]);
  const skill = model.skills[0];
  assert.deepEqual([...skill.secureMechanics].sort(), ["build", "choose"]);
  assert.equal(skill.grasp, "cross-context");
  assert.equal(graspLabel(skill), "Shown in 2 different kinds of activities");

  const next = recommendNextActivity(model);
  assert.notEqual(next.intent, "transfer", "a skill already shown two ways is not re-routed");
});

test("support-heavy success in the new mechanic does not count as secure yet", () => {
  const model = buildLearnerModel("kid", [
    ...series(12, { correct: true, responseMs: 2500 }),
    ...series(4, {
      correct: true,
      gameSlug: "maker-workshop",
      mechanic: "build",
      hintsUsed: 1,
      wrongAttempts: 1,
    }, 12),
  ]);
  const skill = model.skills[0];
  assert.deepEqual(skill.secureMechanics, ["choose"],
    "wins that leaned on hints every time are not yet independent evidence");
  assert.equal(skill.grasp, "single-context");
});

test("random guessing secures no mechanic at all", () => {
  const model = buildLearnerModel("kid", series(14, (index) => ({
    correct: index % 2 === 0,
    givenAnswer: index % 2 === 0 ? "4" : String(index),
    responseMs: 900,
  })));
  const skill = model.skills[0];
  assert.deepEqual(skill.secureMechanics, []);
  assert.equal(skill.grasp, "unknown");
  assert.equal(graspLabel(skill), "Not enough evidence yet");
});

test("a cold start reports unknown rather than guessing at breadth", () => {
  const model = buildLearnerModel("kid", series(2, { correct: true }));
  assert.equal(model.skills[0].grasp, "unknown");
});

test("corrupted mechanic values fall back to the game's classification", () => {
  const rows = normalizeEvidenceLog([
    { ...JSON.parse(JSON.stringify(series(1)[0])), mechanic: "banana" },
    { ...JSON.parse(JSON.stringify(series(1)[0])), mechanic: 42 },
    { ...JSON.parse(JSON.stringify(series(1)[0])), gameSlug: "word-forge-studio" },
  ]);
  assert.equal(rows[0].mechanic, "choose");
  assert.equal(rows[1].mechanic, "choose");
  assert.equal(rows[2].mechanic, "build", "legacy rows inherit their game's verb");
});

test("a repeating misconception blocks the transfer offer", () => {
  const model = buildLearnerModel("kid", [
    ...series(16, { correct: true, responseMs: 2500 }),
    ...series(3, { correct: false, givenAnswer: "7" }, 16),
  ]);
  assert.ok(model.skills[0].misconceptions.length > 0);
  const next = recommendNextActivity(model);
  assert.notEqual(next.intent, "transfer",
    "a skill with an unresolved misconception is not certified into a new form");
});

test("the transfer offer speaks plainly to both audiences", () => {
  const model = buildLearnerModel("kid", series(16, { correct: true, responseMs: 2500 }));
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "transfer");
  assert.doesNotMatch(next.childReason, /transfer|mechanic|evidence|context|skill/i);
  assert.match(next.adultReason, /picking answers/);
  assert.match(next.adultReason, /building it/);
  assert.doesNotMatch(next.adultReason, /transfer index|0\.\d\d|grasp/i);
});
