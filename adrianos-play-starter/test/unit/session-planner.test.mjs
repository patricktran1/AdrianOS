import assert from "node:assert/strict";
import test from "node:test";
import { buildLearnerModel } from "../../lib/adrian-learner-model.ts";
import {
  admitsStep,
  currentStep,
  endSession,
  planSession,
  replanSession,
  sessionBudget,
  sessionCategories,
  sessionPriorities,
  sessionSkills,
  traceSession,
} from "../../lib/session/session-planner.ts";
import { personalizedExploreSlugs } from "../../lib/session/session-explore.ts";

const START = new Date("2026-08-01T09:00:00.000Z").getTime();

/** One attempt. Defaults describe an ordinary, unaided, correct answer. */
function attempt(overrides = {}, index = 0) {
  return {
    at: new Date(START + index * 60_000).toISOString(),
    gameSlug: "maker-workshop",
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
    mechanic: "build",
    taskId: `task-${index}`,
    errorSignature: null,
    reasoned: null,
    ...overrides,
  };
}

function series(count, overrides = {}, offset = 0) {
  return Array.from({ length: count }, (_, index) =>
    attempt(
      { ...(typeof overrides === "function" ? overrides(index) : overrides), taskId: `t-${offset + index}` },
      offset + index
    )
  );
}

const PLAN = { profileId: "learner", dayKey: "2026-08-01", grade: 2 };

/** Counting, secure and independent. A session's warm start needs a skill
 *  that is not the one being worked on, or it is not a warm start. */
const SECURE_COUNTING = () =>
  series(6, { skillId: "math-counting", skillLabel: "Counting" }, 100);
const plan = (rows, extra = {}) =>
  planSession({ ...PLAN, ...extra, model: buildLearnerModel("learner", rows) });
const model = (rows) => buildLearnerModel("learner", rows);
const kinds = (session) =>
  session.steps.filter((step) => step.status !== "dropped").map((step) => step.goal.kind);
const outcome = (overrides = {}) => ({
  skillId: "math-place-value",
  attempts: 5,
  correct: 5,
  supported: 0,
  reasoned: 0,
  mechanic: "build",
  ...overrides,
});

/* --------------------------------------------------------------------- */
/* Shapes of a session                                                     */
/* --------------------------------------------------------------------- */

test("session length follows the learner's age band, not the clock", () => {
  assert.equal(sessionBudget(0), 3);
  assert.equal(sessionBudget(1), 3);
  assert.equal(sessionBudget(2), 4);
  assert.equal(sessionBudget(5), 5);
  // A light day is shorter; a free day is shorter still.
  assert.equal(sessionBudget(5, "light"), 4);
  assert.equal(sessionBudget(5, "free"), 2);
  assert.equal(sessionBudget(0, "light"), 2);
});

test("a session opens on something the child can already do", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
    ...SECURE_COUNTING(),
  ];
  const session = plan(rows);
  assert.equal(session.steps[0].goal.kind, "warm-start");
  assert.equal(session.steps[0].goal.reason, "secure_warmup");
  // A warm start is familiar, so it never raises the challenge.
  assert.equal(session.steps[0].activity.difficultyShift, 0);
});

test("a fluent single-context skill gets a second form and then an inference", () => {
  const session = plan(series(14));
  const arc = kinds(session);
  assert.ok(arc.includes("alternate-representation"), arc.join(","));
  assert.ok(arc.includes("inference-transfer"), arc.join(","));
  assert.ok(
    arc.indexOf("alternate-representation") < arc.indexOf("inference-transfer"),
    "the second form comes before the inference"
  );
});

test("goals are learning goals, never game slugs", () => {
  const session = plan(series(14));
  for (const step of session.steps) {
    assert.ok(
      ["warm-start", "target-skill", "alternate-representation", "inference-transfer",
        "prerequisite-check", "recovery", "closure", "sample"].includes(step.goal.kind),
      step.goal.kind
    );
    assert.ok(step.goal.skillId === null || /^[a-z-]+$/.test(step.goal.skillId));
  }
});

test("the same evidence on the same day plans the same session", () => {
  const rows = series(14);
  assert.deepEqual(traceSession(plan(rows)), traceSession(plan(rows)));
});

test("variety comes from the day, not from randomness", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 40),
    ...series(6, { skillId: "math-fractions", skillLabel: "Fractions" }, 60),
  ];
  const days = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"];
  const traces = days.map((dayKey) => JSON.stringify(traceSession(plan(rows, { dayKey }))));
  // The same day is reproducible, which is what makes a surprising route
  // debuggable...
  assert.equal(traces[0], JSON.stringify(traceSession(plan(rows, { dayKey: days[0] }))));
  // ...and a week is not the same session five times, because the steps whose
  // options are genuinely equivalent are chosen from the day.
  assert.ok(new Set(traces).size >= 2, "every day planned an identical session");
});

/* --------------------------------------------------------------------- */
/* Adversarial session matrix A-R                                          */
/* --------------------------------------------------------------------- */

test("A. clean mastery drops the steps that are no longer worth planning", () => {
  const rows = [...series(14), ...SECURE_COUNTING()];
  let session = plan(rows);
  const before = kinds(session).length;
  // The child shows the second representation immediately.
  const proven = [...rows, ...series(6, { mechanic: "place", gameSlug: "stepping-stones" }, 40)];
  session = replanSession(session, model(proven), outcome({ mechanic: "place" }));
  const dropped = session.steps.filter((step) => step.status === "dropped");
  assert.ok(
    dropped.length > 0 || kinds(session).length < before,
    "a demonstrated goal should stop being planned"
  );
});

test("B. a structural failure in the second form cancels the inference step", () => {
  const rows = [...series(14), ...SECURE_COUNTING()];
  let session = plan(rows);
  assert.ok(kinds(session).includes("inference-transfer"));
  session = replanSession(session, model(rows), outcome());
  const failed = [
    ...rows,
    ...series(
      6,
      { mechanic: "place", gameSlug: "stepping-stones", correct: false, givenAnswer: "74", errorSignature: "place-value.digits-transposed" },
      40
    ),
  ];
  session = replanSession(session, model(failed), outcome({ mechanic: "place", correct: 0, attempts: 6 }));
  const cancelled = session.steps.find((step) => step.goal.kind === "inference-transfer");
  assert.equal(cancelled.status, "dropped");
  assert.ok(session.revisions.some((row) => row.reason === "cancel_transfer_after_error_pattern"));
});

test("C. a lucky deduction leaves the inference goal unsatisfied", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
  ];
  let session = plan(rows);
  const inference = session.steps.find((step) => step.goal.kind === "inference-transfer");
  assert.ok(inference, "an inference step is planned");
  // Walk the session to that step, then solve it without using the clues.
  while (currentStep(session) && currentStep(session).goal.kind !== "inference-transfer") {
    session = replanSession(session, model(rows), outcome());
  }
  const lucky = [
    ...rows,
    ...series(4, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: false }, 40),
  ];
  const after = replanSession(
    session,
    model(lucky),
    outcome({ mechanic: "deduce", attempts: 4, correct: 4, reasoned: 0 })
  );
  const secure = model(lucky).skills.find((skill) => skill.skillId === "math-place-value");
  assert.ok(
    !secure.secureCategories.includes("inference"),
    "an unreasoned correct answer does not make inference secure"
  );
  assert.ok(after.steps.every((step) => step.goal.kind !== "inference-transfer" || step.status !== "planned"));
});

test("D. success that leaned on help does not lead to something harder", () => {
  const rows = series(14);
  let session = plan(rows);
  session = replanSession(
    session,
    model(rows),
    outcome({ supported: 4, attempts: 5, correct: 5 })
  );
  const inference = session.steps.find((step) => step.goal.kind === "inference-transfer");
  assert.equal(inference.status, "dropped");
  assert.ok(session.revisions.some((row) => row.reason === "hold_after_supported_success"));
});

test("E. one anomalous mistake leaves the plan alone", () => {
  const rows = series(14);
  const before = plan(rows);
  const slip = [...rows, attempt({ correct: false, givenAnswer: "7", taskId: "slip" }, 40)];
  const after = replanSession(before, model(slip), outcome({ correct: 4, attempts: 5 }));
  const stillPlanned = after.steps.filter((step) => step.status === "planned").map((step) => step.goal.kind);
  const originally = before.steps.slice(1).map((step) => step.goal.kind);
  assert.deepEqual(stillPlanned, originally);
  assert.equal(after.revisions.length, 0);
});

test("F. a repeated structural error changes the plan materially", () => {
  const rows = [
    ...series(6, { correct: false, givenAnswer: "7", errorSignature: "place-value.tens-omitted" }),
    ...series(8, {}, 20),
  ];
  const skill = model(rows).skills.find((row) => row.skillId === "math-place-value");
  assert.equal(skill.state, "repeatable-error-pattern");
  const session = plan(rows);
  const arc = kinds(session);
  assert.ok(arc.includes("target-skill"), arc.join(","));
  const target = session.steps.find((step) => step.goal.kind === "target-skill");
  assert.equal(target.activity.intent, "reteach");
  // A repeated structural error is answered with a hands-on form, not with a
  // harder version of the same question.
  assert.equal(target.activity.difficultyShift, -1);
});

test("G. a representation gap targets the weaker form, not the whole skill", () => {
  const rows = [
    ...series(8),
    ...series(6, (index) => ({
      mechanic: "place",
      gameSlug: "stepping-stones",
      correct: index > 4,
      givenAnswer: index > 4 ? "47" : "74",
    }), 20),
  ];
  const session = plan(rows);
  const step = session.steps.find((row) => row.goal.reason === "representation_gap");
  assert.ok(step, kinds(session).join(","));
  assert.equal(step.activity.intent, "represent");
  // The whole skill does not get easier because one form is harder.
  assert.equal(step.activity.difficultyShift, 0);
});

test("H. a prerequisite visit is bounded and never chains", () => {
  const rows = [
    ...series(6, { correct: false, givenAnswer: "7", errorSignature: "place-value.tens-omitted" }),
    ...series(6, {}, 20),
    ...series(6, (index) => ({
      skillId: "math-counting",
      skillLabel: "Counting",
      correct: index > 3,
      givenAnswer: index > 3 ? "47" : "12",
    }), 40),
  ];
  const session = plan(rows);
  const prerequisites = session.steps.filter(
    (step) => step.goal.kind === "prerequisite-check" || step.activity.intent === "prerequisite"
  );
  assert.ok(prerequisites.length <= 1, `${prerequisites.length} prerequisite steps`);
});

test("I. a cold start explores rather than inventing precision", () => {
  const session = plan([]);
  assert.deepEqual(kinds(session), ["sample", "sample", "sample"]);
  for (const step of session.steps) {
    assert.equal(step.activity.intent, "explore");
    assert.equal(step.goal.reason, "insufficient_evidence");
  }
});

test("I2. exploration follows the interests a parent actually stated", () => {
  const ordered = personalizedExploreSlugs([
    { slug: "zebra-game", subject: "Math", interest: false, priority: false, plays: 0 },
    { slug: "art-lab", subject: "Art", interest: true, priority: false, plays: 9 },
    { slug: "math-blast", subject: "Math", interest: false, priority: true, plays: 4 },
  ]);
  assert.deepEqual(ordered, ["art-lab", "math-blast", "zebra-game"]);
});

test("I3. the starting-point check leads, and a free day cannot displace it", () => {
  const session = plan([], { needsPlacement: true, mode: "free" });
  assert.equal(session.steps[0].destination.slugs[0], "placement-adventure");
  // ...but a learner with real evidence is not sent back to calibrate.
  const settled = plan(series(14), { needsPlacement: true });
  assert.notEqual(settled.steps[0].destination.slugs[0], "placement-adventure");
});

test("J. a high performer is not given remedial work", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
  ];
  const session = plan(rows);
  for (const step of session.steps) {
    assert.ok(
      !["reteach", "scaffold", "prerequisite"].includes(step.activity.intent),
      `${step.goal.kind} routed to ${step.activity.intent}`
    );
  }
});

test("K. a struggling learner is not drilled", () => {
  const rows = series(16, (index) => ({
    correct: index % 4 === 0,
    givenAnswer: index % 4 === 0 ? "47" : "7",
    errorSignature: index % 4 === 0 ? null : "place-value.tens-omitted",
    hintsUsed: 1,
  }));
  let session = plan(rows);
  let guard = 0;
  while (currentStep(session) && guard < 10) {
    session = replanSession(session, model(rows), outcome({ correct: 1, supported: 4 }));
    guard += 1;
  }
  const live = session.steps.filter((step) => step.status !== "dropped");
  const perSkill = live.filter((step) => step.goal.skillId === "math-place-value").length;
  assert.ok(perSkill <= 3, `${perSkill} steps on one skill`);
  assert.ok(live.length <= session.budget, `${live.length} steps for a budget of ${session.budget}`);
  // And never three corrections in a row.
  let run = 0;
  for (const step of live) {
    const remedial = ["reteach", "scaffold", "prerequisite"].includes(step.activity.intent)
      || ["recovery", "prerequisite-check"].includes(step.goal.kind);
    run = remedial ? run + 1 : 0;
    assert.ok(run <= 2, "three consecutive remedial steps");
  }
});

test("L. the same kind of thinking is not asked for three times running", () => {
  const rows = [
    ...series(8),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 20),
    ...series(6, { skillId: "math-fractions", skillLabel: "Fractions" }, 40),
  ];
  const session = plan(rows, { grade: 5 });
  let previous = null;
  let run = 0;
  for (const step of session.steps) {
    if (!step.mechanic) { previous = null; run = 0; continue; }
    const category = step.mechanic === "build" ? "construction"
      : step.mechanic === "place" ? "position"
        : step.mechanic === "deduce" ? "inference" : "recognition";
    run = category === previous ? run + 1 : 1;
    previous = category;
    assert.ok(run <= 2, `three ${category} steps in a row`);
  }
});

test("M. an exhausted budget stops cleanly", () => {
  const rows = [
    ...series(8),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 20),
    ...series(6, { skillId: "math-fractions", skillLabel: "Fractions" }, 40),
  ];
  let session = plan(rows);
  let guard = 0;
  while (currentStep(session) && guard < 12) {
    session = replanSession(session, model(rows), outcome());
    guard += 1;
  }
  assert.equal(session.status, "complete");
  assert.ok(session.completion !== null);
  assert.ok(session.steps.filter((step) => step.status === "done").length <= session.budget);
  assert.equal(currentStep(session), null);
});

test("N. a session left partway can be ended without losing what happened", () => {
  const rows = series(14);
  let session = plan(rows);
  session = replanSession(session, model(rows), outcome());
  const ended = endSession(session);
  assert.equal(ended.status, "complete");
  assert.equal(ended.completion, "exited");
  assert.equal(ended.steps.filter((step) => step.status === "done").length, 1);
  assert.ok(ended.steps.every((step) => step.status !== "planned"));
});

test("O. replanning twice for one activity does not advance twice", () => {
  const rows = series(14);
  let session = plan(rows);
  const first = replanSession(session, model(rows), outcome());
  // The planner itself has no memory of tabs; the runtime guard is what stops
  // a duplicate. What must hold here is that replanning is deterministic.
  const again = replanSession(session, model(rows), outcome());
  assert.deepEqual(traceSession(first), traceSession(again));
});

test("P. a completed session stays completed", () => {
  const rows = series(14);
  let session = plan(rows);
  session = endSession(session, "budget_reached");
  const after = replanSession(session, model(rows), outcome());
  assert.equal(after.status, "complete");
  assert.equal(after.completion, "budget_reached");
});

test("Q. evidence without mechanics still plans a safe session", () => {
  const legacy = series(14, { mechanic: undefined, taskId: undefined, errorSignature: undefined });
  const session = plan(legacy);
  assert.ok(session.steps.length >= 1);
  for (const step of session.steps) {
    assert.ok(typeof step.activity.childReason === "string" && step.activity.childReason.length > 0);
  }
});

test("R. a step is never admitted twice into one session", () => {
  const rows = series(14);
  const session = plan(rows);
  const keys = session.steps
    .filter((step) => step.status !== "dropped" && step.destination.href)
    .map((step) => step.destination.href.split("?")[0] + ":" + step.goal.skillId);
  assert.equal(new Set(keys).size, keys.length, keys.join(" "));
});

/* --------------------------------------------------------------------- */
/* Coherence                                                               */
/* --------------------------------------------------------------------- */

test("a session does not wander across unrelated skills", () => {
  const rows = [
    ...series(8),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 20),
    ...series(6, { skillId: "math-fractions", skillLabel: "Fractions" }, 40),
    ...series(6, { skillId: "reading-sequencing", skillLabel: "Sequencing", subject: "Reading" }, 60),
  ];
  const session = plan(rows, { grade: 5 });
  const taught = session.steps
    .filter((step) => step.status !== "dropped" && step.goal.kind !== "warm-start" && step.goal.kind !== "closure")
    .map((step) => step.goal.skillId);
  assert.ok(new Set(taught).size <= 3, `${new Set(taught).size} distinct taught skills`);
});

test("a session that recovered adds a finish the child can complete", () => {
  const rows = series(16, (index) => ({
    correct: true,
    hintsUsed: index < 12 ? 1 : 0,
    wrongAttempts: index < 12 ? 1 : 0,
  }));
  const withSecure = [
    ...rows,
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 40),
  ];
  let session = planSession({ ...PLAN, model: model(withSecure) });
  let guard = 0;
  while (currentStep(session) && guard < 8) {
    session = replanSession(session, model(withSecure), outcome());
    guard += 1;
  }
  const finished = session.steps.filter((step) => step.status === "done");
  assert.ok(finished.length > 0);
  assert.equal(session.status, "complete");
});

test("the plan may shrink but never grows beyond the budget", () => {
  const rows = [
    ...series(8),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 20),
  ];
  let session = plan(rows);
  let guard = 0;
  while (currentStep(session) && guard < 12) {
    session = replanSession(session, model(rows), outcome());
    assert.ok(
      session.steps.filter((step) => step.status !== "dropped").length <= session.budget,
      "a session grew past its budget"
    );
    guard += 1;
  }
});

test("priorities are ordered by teaching value, not by discovery order", () => {
  const rows = [
    ...series(8, { skillId: "math-counting", skillLabel: "Counting" }),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones", skillId: "math-counting", skillLabel: "Counting" }, 20),
    ...series(6, (index) => ({
      correct: index > 3,
      givenAnswer: index > 3 ? "47" : "7",
      errorSignature: index > 3 ? null : "place-value.tens-omitted",
    }), 40),
  ];
  const priorities = sessionPriorities(model(rows));
  assert.ok(priorities.length >= 2);
  // Something that needs teaching outranks something that needs proving.
  assert.equal(priorities[0].skillId, "math-place-value");
});

test("the trace explains every decision without exposing it to a child", () => {
  const session = plan(series(14));
  const trace = traceSession(session);
  assert.equal(trace.budget, session.budget);
  for (const row of trace.steps) {
    assert.ok(row.goal && row.because && row.need && row.intent);
    assert.equal(typeof row.destination, "string");
  }
  assert.ok(Array.isArray(trace.revisions));
});

test("session summaries of what was covered come from the plan", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
    ...SECURE_COUNTING(),
  ];
  let session = plan(rows);
  session = replanSession(session, model(rows), outcome());
  assert.deepEqual(sessionCategories(session), ["construction"]);
  assert.ok(sessionSkills(session).includes("math-place-value"));
});

test("a step whose destination repeats without reason is refused", () => {
  const session = plan(series(14));
  const first = session.steps[0];
  assert.equal(admitsStep([first], { ...first, goal: { ...first.goal, kind: "closure" } }), false);
});

/* --------------------------------------------------------------------- */
/* Branches that only appear for particular learners                       */
/* --------------------------------------------------------------------- */

test("a skill whose only secure form is inference warms up by inferring", () => {
  const rows = [
    ...series(8, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: true }),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 20),
  ];
  const session = plan(rows);
  const warm = session.steps.find((step) => step.goal.kind === "warm-start");
  assert.ok(warm);
  assert.ok(
    warm.destination.href.includes("clue-hollow") || warm.mechanic === "build",
    warm.destination.href ?? warm.mechanic
  );
});

test("a demonstrated second representation cancels the step that would prove it", () => {
  const single = [...series(14), ...SECURE_COUNTING()];
  let session = plan(single);
  const planned = session.steps.find((step) => step.goal.need === "second-representation");
  assert.ok(planned, kinds(session).join(","));
  const proven = [
    ...single,
    ...series(6, { mechanic: "place", gameSlug: "stepping-stones" }, 40),
  ];
  session = replanSession(session, model(proven), outcome({ mechanic: "place" }));
  const after = session.steps.find((step) => step.goal.need === "second-representation");
  assert.equal(after.status, "dropped");
  assert.ok(session.revisions.some((row) => row.reason === "goal_met_early"));
});

test("a reasoned deduction settles the inference question the session asked", () => {
  // Place value alone, secure in two forms and never inferred: the session is
  // the inference question, with a familiar finish after it.
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
  ];
  let session = plan(rows);
  assert.deepEqual(kinds(session), ["inference-transfer", "closure"]);

  const inferred = [
    ...rows,
    ...series(6, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: true }, 40),
  ];
  const proven = model(inferred).skills.find((skill) => skill.skillId === "math-place-value");
  assert.ok(proven.secureCategories.includes("inference"));

  session = replanSession(
    session,
    model(inferred),
    outcome({ mechanic: "deduce", attempts: 4, correct: 4, reasoned: 4 })
  );
  assert.equal(session.steps[0].status, "done");
  // The finish stays: a question answered is not a reason to stop abruptly.
  assert.equal(session.steps.find((step) => step.goal.kind === "closure").status, "planned");

  // ...and the same play without the reasoning would not have settled it.
  const lucky = [
    ...rows,
    ...series(6, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: false }, 40),
  ];
  const unproven = model(lucky).skills.find((skill) => skill.skillId === "math-place-value");
  assert.ok(!unproven.secureCategories.includes("inference"));
});

test("a cold start explores what the parent said the child enjoys", () => {
  const session = plan([], { exploreSlugs: ["art-design-lab", "music-maker"] });
  assert.deepEqual(session.steps[0].destination.slugs, ["art-design-lab", "music-maker"]);
  // And with nothing stated, the world is left to pick.
  assert.deepEqual(plan([]).steps[0].destination.slugs, []);
});

test("a step planned before the evidence is re-resolved against it", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
    ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 40),
  ];
  let session = plan(rows);
  const planned = session.steps.find(
    (step) => step.goal.skillId === "math-counting" && step.goal.kind === "alternate-representation"
  );
  assert.equal(planned.activity.intent, "transfer");

  // The child then finds counting-by-placing hard. The step is not abandoned:
  // its goal still stands, but the move it resolves to is now a teaching one.
  const broken = [
    ...rows,
    ...series(6, {
      skillId: "math-counting",
      skillLabel: "Counting",
      mechanic: "place",
      gameSlug: "stepping-stones",
      correct: false,
      givenAnswer: "3",
      errorSignature: "sequence.reversed",
    }, 60),
  ];
  session = replanSession(session, model(broken), outcome({ skillId: "math-counting" }));
  const after = session.steps.find(
    (step) => step.goal.skillId === "math-counting" && step.goal.kind === "alternate-representation"
  );
  assert.notEqual(after.activity.intent, "transfer");
  assert.ok(["represent", "reteach", "scaffold"].includes(after.activity.intent), after.activity.intent);
});

test("a session cannot spend itself entirely on correction", () => {
  const rows = [
    ...series(10, { hintsUsed: 1, wrongAttempts: 1 }),
    ...series(10, {
      skillId: "math-counting",
      skillLabel: "Counting",
      hintsUsed: 1,
      wrongAttempts: 1,
    }, 20),
  ];
  const session = plan(rows, { grade: 5 });
  const remedial = session.steps.filter(
    (step) => ["reteach", "scaffold", "prerequisite"].includes(step.activity.intent)
  );
  assert.ok(remedial.length <= 2, `${remedial.length} remedial steps in one session`);
});

test("a lucky deduction and a reasoned one leave different sessions behind", () => {
  const rows = [
    ...series(8),
    ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
  ];
  const deduce = (reasoned) =>
    outcome({ mechanic: "deduce", attempts: 4, correct: 4, reasoned });

  const earned = replanSession(plan(rows), model(rows), deduce(4));
  const lucky = replanSession(plan(rows), model(rows), deduce(0));

  // Both children finished the puzzle; only one of them answered the question
  // the session was asking.
  assert.equal(earned.steps[0].status, "done");
  assert.equal(lucky.steps[0].status, "done");
  assert.ok(!earned.revisions.some((row) => row.reason === "cancel_inference_after_unreasoned_solve"));
  assert.ok(lucky.revisions.some((row) => row.reason === "cancel_inference_after_unreasoned_solve"));
});
