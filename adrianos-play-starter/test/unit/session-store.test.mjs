import assert from "node:assert/strict";
import test from "node:test";
import { buildLearnerModel } from "../../lib/adrian-learner-model.ts";
import {
  currentStep as currentStepFor,
  endSession,
  planSession,
  replanSession,
  traceSession,
} from "../../lib/session/session-planner.ts";
import { glanceFromValue } from "../../lib/session/session-glance.ts";
import {
  ensureSessionPlan,
  parseStoredSession,
  restoreSession,
  serializeSession,
} from "../../lib/session/session-store.ts";
import { summariseSession } from "../../lib/session/session-summary.ts";

const START = new Date("2026-08-01T09:00:00.000Z").getTime();

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

const series = (count, overrides = {}, offset = 0) =>
  Array.from({ length: count }, (_, index) =>
    attempt(
      { ...(typeof overrides === "function" ? overrides(index) : overrides), taskId: `t-${offset + index}` },
      offset + index
    )
  );

const ROWS = [
  ...series(8),
  ...series(8, { mechanic: "place", gameSlug: "stepping-stones" }, 20),
  ...series(6, { skillId: "math-counting", skillLabel: "Counting" }, 40),
];
const MODEL = buildLearnerModel("learner", ROWS);
const PLAN = { profileId: "learner", dayKey: "2026-08-01", grade: 2, model: MODEL };
const outcome = {
  skillId: "math-place-value",
  attempts: 5,
  correct: 5,
  supported: 0,
  reasoned: 0,
  mechanic: "build",
};

/* --------------------------------------------------------------------- */
/* What is kept                                                            */
/* --------------------------------------------------------------------- */

test("a stored session keeps only fields that change a teaching decision", () => {
  const stored = serializeSession(planSession(PLAN), null);
  assert.deepEqual(
    Object.keys(stored).sort(),
    ["budget", "completion", "day", "days", "goals", "grade", "last", "rev", "reward", "status", "v", "visited"]
  );
  for (const goal of stored.goals) {
    assert.deepEqual(Object.keys(goal).sort(), ["d", "k", "n", "r", "s", "st"]);
  }
});

test("no prompt, answer, timing or route is written to storage", () => {
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const text = JSON.stringify(serializeSession(plan, null));
  for (const leak of ["Build the number", "47", "responseMs", "http", "?skill=", "&from=", "childReason"]) {
    assert.ok(!text.includes(leak), `stored session leaked ${leak}: ${text}`);
  }
});

/* --------------------------------------------------------------------- */
/* What comes back                                                         */
/* --------------------------------------------------------------------- */

test("a stored session round-trips into the same live plan", () => {
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const restored = restoreSession(parseStoredSession(serializeSession(plan, null)), MODEL, "learner");
  assert.deepEqual(traceSession(restored).steps.map((step) => [step.goal, step.status]),
    traceSession(plan).steps.map((step) => [step.goal, step.status]));
  assert.equal(restored.status, plan.status);
  assert.equal(restored.budget, plan.budget);
});

test("a completed step keeps where it went, so the session cannot repeat it", () => {
  let plan = planSession(PLAN);
  const first = plan.steps[0].destination.href;
  plan = replanSession(plan, MODEL, outcome);
  const restored = restoreSession(parseStoredSession(serializeSession(plan, null)), MODEL, "learner");
  const done = restored.steps.find((step) => step.status === "done");
  assert.ok(done.destination.key, "a completed step remembers its destination key");
  assert.ok(first.includes(done.destination.key.split(":")[0]));
});

/* --------------------------------------------------------------------- */
/* Corrupt and hostile storage                                             */
/* --------------------------------------------------------------------- */

test("corrupt storage is thrown away and the plan rebuilt from evidence", () => {
  for (const junk of [
    null,
    undefined,
    "not an object",
    42,
    {},
    { v: 2, day: "2026-08-01", goals: [] },
    { v: 1, day: "nope", grade: 2, budget: 4, status: "active", goals: [{ k: "warm-start" }] },
    { v: 1, day: "2026-08-01", grade: 2, budget: 4, status: "active", goals: [] },
    { v: 1, day: "2026-08-01", grade: -1, budget: 4, status: "active", goals: [{ k: "closure", s: null, n: "none", r: "secure_warmup", st: "done" }] },
  ]) {
    assert.equal(parseStoredSession(junk), null, JSON.stringify(junk));
    const result = ensureSessionPlan({
      stored: junk,
      model: MODEL,
      profileId: "learner",
      dayKey: "2026-08-01",
      grade: 2,
    });
    assert.equal(result.plan.status, "active");
    assert.ok(result.plan.steps.length > 0);
  }
});

test("prototype keys never validate as session values", () => {
  for (const hostile of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(
      parseStoredSession({
        v: 1,
        day: "2026-08-01",
        grade: 2,
        budget: 4,
        status: "active",
        goals: [{ k: hostile, s: null, n: "none", r: "secure_warmup", st: "done" }],
      }),
      null,
      `${hostile} validated as a goal kind`
    );
    assert.equal(
      parseStoredSession({
        v: 1,
        day: "2026-08-01",
        grade: 2,
        budget: 4,
        status: "active",
        completion: hostile,
        goals: [{ k: "closure", s: null, n: "none", r: "secure_warmup", st: "done" }],
      })?.completion,
      null,
      `${hostile} validated as a completion reason`
    );
  }
});

test("a skill id that is not an identifier invalidates the plan", () => {
  assert.equal(
    parseStoredSession({
      v: 1,
      day: "2026-08-01",
      grade: 2,
      budget: 4,
      status: "active",
      goals: [{ k: "closure", s: "../../etc/passwd", n: "none", r: "secure_warmup", st: "done" }],
    }),
    null
  );
});

test("a destination key that is not a game and a skill is dropped, not trusted", () => {
  const parsed = parseStoredSession({
    v: 1,
    day: "2026-08-01",
    grade: 2,
    budget: 4,
    status: "active",
    goals: [{ k: "closure", s: null, n: "none", r: "secure_warmup", st: "done", d: "https://example.com/x" }],
    visited: ["https://example.com/x", "maker-workshop:math-place-value"],
  });
  assert.equal(parsed.goals[0].d, null);
  assert.deepEqual(parsed.visited, ["maker-workshop:math-place-value"]);
});

/* --------------------------------------------------------------------- */
/* Days, resumption and memory                                             */
/* --------------------------------------------------------------------- */

test("today's session resumes; yesterday's is replaced and remembered", () => {
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const stored = serializeSession(plan, null);

  const resumed = ensureSessionPlan({
    stored, model: MODEL, profileId: "learner", dayKey: "2026-08-01", grade: 2,
  });
  assert.equal(resumed.source, "restored");
  assert.equal(resumed.plan.steps.filter((step) => step.status === "done").length, 1);

  const tomorrow = ensureSessionPlan({
    stored, model: MODEL, profileId: "learner", dayKey: "2026-08-02", grade: 2,
  });
  assert.equal(tomorrow.source, "planned");
  assert.equal(tomorrow.plan.steps.filter((step) => step.status === "done").length, 0);
  assert.equal(tomorrow.last.day, "2026-08-01");
});

test("finished days accumulate but never grow without bound", () => {
  const plan = { ...planSession(PLAN), status: "complete", completion: "closure_complete" };
  const many = Array.from({ length: 40 }, (_, index) => `2026-06-${String((index % 28) + 1).padStart(2, "0")}`);
  const stored = serializeSession(plan, null, { days: many });
  assert.ok(stored.days.length <= 14, stored.days.length);
  assert.ok(stored.days.includes("2026-08-01"));
});

/* --------------------------------------------------------------------- */
/* Parent summary                                                          */
/* --------------------------------------------------------------------- */

const BANNED = [
  /\d+\s*%/,
  /\bscore\b/i, /\bpercentile\b/i, /\bprobability\b/i, /\blevel\b/i, /\bIQ\b/,
  /cognitive/i, /deficit/i, /disorder/i, /diagnos/i, /\bweakness\b/i,
  /\bbehind\b/i, /\bstruggling\b/i, /low performer/i, /\bshould know\b/i,
  /\bbad at\b/i, /misconception probability/i, /\bindex\b/i,
];

function assertPlainLanguage(summary) {
  for (const value of Object.values(summary)) {
    for (const pattern of BANNED) {
      assert.ok(!pattern.test(value), `"${value}" matched ${pattern}`);
    }
    assert.ok(value.length > 0);
  }
}

test("the parent summary answers four questions in observable language", () => {
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const summary = summariseSession(plan, MODEL, "Adrian");
  assert.deepEqual(Object.keys(summary).sort(), ["next", "observed", "responded", "workedOn"]);
  assert.ok(summary.workedOn.startsWith("Adrian"));
  assertPlainLanguage(summary);
});

test("the summary stays plain across every kind of session", () => {
  const cases = [
    ROWS,
    [],
    series(16, (index) => ({ correct: index % 3 === 0, givenAnswer: index % 3 === 0 ? "47" : "7", errorSignature: index % 3 === 0 ? null : "place-value.tens-omitted" })),
    series(16, { hintsUsed: 1, wrongAttempts: 1 }),
    series(16, { responseMs: 400, correct: false, givenAnswer: "7" }),
    [...series(8), ...series(6, (index) => ({ mechanic: "place", gameSlug: "stepping-stones", correct: index > 4, givenAnswer: index > 4 ? "47" : "74" }), 20)],
  ];
  for (const rows of cases) {
    const model = buildLearnerModel("learner", rows);
    let plan = planSession({ ...PLAN, model });
    for (let step = 0; step < 3 && plan.status === "active"; step += 1) {
      plan = replanSession(plan, model, outcome);
    }
    assertPlainLanguage(summariseSession(plan, model, "Adrian"));
    assertPlainLanguage(summariseSession(plan, model, ""));
  }
});

test("a summary reports a changed route rather than hiding it", () => {
  const rows = series(14);
  let plan = planSession({ ...PLAN, model: buildLearnerModel("learner", rows) });
  const model = buildLearnerModel("learner", rows);
  plan = replanSession(plan, model, { ...outcome, supported: 4 });
  const summary = summariseSession(plan, model, "Adrian");
  assert.match(summary.responded, /changed the route/);
  assertPlainLanguage(summary);
});

/* --------------------------------------------------------------------- */
/* Every shape the summary can take                                        */
/* --------------------------------------------------------------------- */

test("a session nobody has started yet says so plainly", () => {
  const summary = summariseSession(planSession(PLAN), MODEL, "Adrian");
  assert.match(summary.workedOn, /has not started/);
  assert.match(summary.next, /first activity/);
  assertPlainLanguage(summary);
});

test("the summary names what was observed for each kind of evidence", () => {
  const cases = [
    ["secure", ROWS, /answered independently/],
    ["emerging", series(14, (index) => ({ correct: index % 3 !== 0, givenAnswer: index % 3 !== 0 ? "47" : "48" })), /coming along|not yet/],
    ["support-dependent", series(16, { hintsUsed: 1, wrongAttempts: 1 }), /hint or a second try/],
    ["possible-random-response", series(16, (index) => ({ responseMs: 300, correct: index % 5 === 0, givenAnswer: index % 5 === 0 ? "47" : "3" })), /faster than the questions/],
    [
      "repeatable-error-pattern",
      [
        ...series(8),
        ...series(6, { correct: false, givenAnswer: "7", errorSignature: "place-value.tens-omitted" }, 20),
      ],
      /several different|hands-on form/,
    ],
    [
      "representation-specific-difficulty",
      [...series(8), ...series(8, (index) => ({ mechanic: "place", gameSlug: "stepping-stones", correct: index > 6, givenAnswer: index > 6 ? "47" : "74" }), 20)],
      /went well/,
    ],
  ];
  for (const [label, rows, pattern] of cases) {
    const model = buildLearnerModel("learner", rows);
    let plan = planSession({ ...PLAN, model });
    plan = replanSession(plan, model, outcome);
    const summary = summariseSession(plan, model, "Adrian");
    assert.match(summary.observed + " " + summary.next, pattern, `${label}: ${summary.observed} / ${summary.next}`);
    assertPlainLanguage(summary);
  }
});

test("a completed session says how it ended without judging it", () => {
  const model = buildLearnerModel("learner", ROWS);
  let plan = planSession({ ...PLAN, model });
  let guard = 0;
  while (plan.status === "active" && guard < 8) {
    plan = replanSession(plan, model, outcome);
    guard += 1;
  }
  const summary = summariseSession(plan, model, "Adrian");
  assert.match(summary.next, /session (ended|finished)|whole session|stopped there|enough to start/i);
  assertPlainLanguage(summary);
});

test("a session with no evidence to teach from still reads sensibly", () => {
  const model = buildLearnerModel("learner", []);
  let plan = planSession({ ...PLAN, model });
  plan = replanSession(plan, model, { ...outcome, skillId: null, mechanic: null });
  const summary = summariseSession(plan, model, "Adrian");
  assert.match(summary.workedOn, /explored/);
  assertPlainLanguage(summary);
});

test("several skills in one session are listed, not enumerated as data", () => {
  const rows = [
    ...ROWS,
    ...series(6, { skillId: "math-fractions", skillLabel: "Fractions" }, 60),
  ];
  const model = buildLearnerModel("learner", rows);
  let plan = planSession({ ...PLAN, model, grade: 5 });
  let guard = 0;
  while (plan.status === "active" && guard < 6) {
    plan = replanSession(plan, model, outcome);
    guard += 1;
  }
  const summary = summariseSession(plan, model, "Adrian");
  assert.match(summary.workedOn, /activities/);
  assertPlainLanguage(summary);
});

/* --------------------------------------------------------------------- */
/* Storage details                                                         */
/* --------------------------------------------------------------------- */

test("session memory survives a day boundary and is itself validated", () => {
  const parsed = parseStoredSession({
    v: 1,
    day: "2026-08-01",
    grade: 2,
    budget: 4,
    status: "complete",
    completion: "closure_complete",
    goals: [{ k: "closure", s: null, n: "none", r: "secure_warmup", st: "done" }],
    last: { day: "2026-07-31", completion: "budget_reached" },
    days: ["2026-07-31", "2026-07-31", "nope", 7],
    reward: "2026-08-01",
  });
  assert.deepEqual(parsed.last, { day: "2026-07-31", completion: "budget_reached" });
  assert.deepEqual(parsed.days, ["2026-07-31"]);
  assert.equal(parsed.reward, "2026-08-01");

  // A memory whose day is nonsense is dropped rather than repaired.
  const broken = parseStoredSession({
    v: 1, day: "2026-08-01", grade: 2, budget: 4, status: "active",
    goals: [{ k: "closure", s: null, n: "none", r: "secure_warmup", st: "done" }],
    last: { day: "yesterday" }, rev: ["not-a-reason", "budget_reached"], reward: "soon",
  });
  assert.equal(broken.last, null);
  assert.deepEqual(broken.rev, ["budget_reached"]);
  assert.equal(broken.reward, null);
});

test("a plan restored for a learner whose evidence has moved on is up to date", () => {
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const stored = serializeSession(plan, null);
  // The child then demonstrates the very thing a later step was to prove.
  const proven = [...ROWS, ...series(6, { mechanic: "deduce", gameSlug: "clue-hollow", reasoned: true }, 80)];
  const restored = restoreSession(parseStoredSession(stored), buildLearnerModel("learner", proven), "learner");
  for (const step of restored.steps) {
    assert.ok(step.activity.childReason.length > 0);
  }
  assert.equal(restored.steps.filter((step) => step.status === "done").length, 1);
});

test("a restored plan still knows where its steps were going", () => {
  // A brand-new learner: the first step is the starting-point check, and it
  // must survive a reload. Restoring it as "somewhere new" would send a child
  // nobody has watched yet to a game chosen at random.
  const empty = buildLearnerModel("learner", []);
  const context = { needsPlacement: true, exploreSlugs: ["art-design-lab"] };
  const planned = planSession({ ...PLAN, model: empty, ...context });
  assert.equal(planned.steps[0].goal.kind, "placement");
  assert.equal(planned.steps[0].destination.slugs[0], "placement-adventure");

  const restored = restoreSession(
    parseStoredSession(serializeSession(planned, null)),
    empty,
    "learner",
    context
  );
  assert.equal(restored.steps[0].destination.slugs[0], "placement-adventure");
  assert.equal(restored.steps[1].destination.slugs[0], "art-design-lab");
});

test("a placement goal that is not a known goal kind is refused", () => {
  assert.equal(
    parseStoredSession({
      v: 1, day: "2026-08-01", grade: 2, budget: 4, status: "active",
      goals: [{ k: "placment", s: null, n: "first-samples", r: "insufficient_evidence", st: "planned" }],
    }),
    null
  );
});

test("a change of explanation raised mid-session still gets into it", () => {
  const intervention = {
    skillId: "math-addition",
    skillLabel: "Addition",
    slug: "mastery-lab",
    href: "/mastery-lab?intervention=abc",
    childReason: "Let's try addition a completely different way.",
    adultReason: "Addition became sticky twice, so AdrianOS is switching explanations.",
    retention: false,
  };
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const stored = serializeSession(plan, null);

  const withIt = ensureSessionPlan({
    stored,
    model: MODEL,
    profileId: "learner",
    dayKey: "2026-08-01",
    grade: 2,
    intervention,
  });
  const step = withIt.plan.steps.find((row) => row.destination.slugs[0] === "mastery-lab");
  assert.ok(step, "the intervention was not added to the running session");
  assert.equal(step.status, "planned");
  assert.equal(step.activity.intent, "reteach");
  // It is next, not last: steps already finished stay finished.
  assert.equal(withIt.plan.steps.filter((row) => row.status === "done").length, 1);
  assert.equal(currentStepFor(withIt.plan).destination.slugs[0], "mastery-lab");

  // And adding it twice does not stack it.
  const again = ensureSessionPlan({
    stored: serializeSession(withIt.plan, null),
    model: MODEL,
    profileId: "learner",
    dayKey: "2026-08-01",
    grade: 2,
    intervention,
  });
  assert.equal(
    again.plan.steps.filter((row) => row.destination.slugs[0] === "mastery-lab").length,
    1
  );
});

test("a retention check is a gentle revisit, not a re-teach", () => {
  const plan = planSession({
    ...PLAN,
    intervention: {
      skillId: "math-addition",
      skillLabel: "Addition",
      slug: "mastery-lab",
      href: "/mastery-lab?intervention=abc",
      childReason: "Quick check: do you still have addition?",
      adultReason: "A short memory check will confirm that Addition stayed strong.",
      retention: true,
    },
  });
  assert.equal(plan.steps[0].goal.kind, "recovery");
  assert.equal(plan.steps[0].activity.intent, "practice");
  assert.equal(plan.steps[0].activity.difficultyShift, 0);
});

test("the cheap progress read agrees with the validated one", () => {
  // session-glance duplicates a little validation on purpose: it is loaded by
  // the ribbon on every game screen, and giving that screen an import edge
  // into the planner's module graph cost 1.9 MB of duplicated client code.
  // The duplication is only safe while the two readings agree.
  let plan = planSession(PLAN);
  plan = replanSession(plan, MODEL, outcome);
  const stored = serializeSession(plan, null);
  const glance = glanceFromValue(stored);
  const live = plan.steps.filter((step) => step.status !== "dropped");
  assert.equal(glance.total, live.length);
  assert.equal(glance.done, live.filter((step) => step.status === "done").length);
  assert.equal(glance.currentIndex, live.findIndex((step) => step.status === "planned"));
  assert.equal(glance.complete, plan.status === "complete");

  // A finished session reads as finished.
  const ended = serializeSession(endSession(plan, "closure_complete"), null);
  assert.equal(glanceFromValue(ended).complete, true);

  // And anything that is not a plan reads as nothing at all.
  for (const junk of [null, undefined, 7, "x", {}, { v: 2, goals: [] }, { v: 1, goals: [{ st: "constructor" }] }, { v: 1, goals: [] }]) {
    assert.deepEqual(
      glanceFromValue(junk),
      { total: 0, done: 0, currentIndex: -1, complete: false },
      JSON.stringify(junk)
    );
  }
});
