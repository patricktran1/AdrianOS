import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptKernelRun,
  DEFAULT_ADAPTATION,
} from "../../lib/kernels/kernel-adaptation.ts";

function activity(overrides = {}) {
  return {
    intent: "practice",
    skillId: "math-place-value",
    skillLabel: "Place value",
    subject: "Math",
    preferredSlugs: [],
    preferredHref: null,
    childReason: "",
    adultReason: "",
    difficultyShift: 0,
    hintStrategy: "on-request",
    ...overrides,
  };
}

test("a decision about another skill never adapts this run", () => {
  const other = activity({ intent: "reteach", skillId: "math-fractions" });
  assert.deepEqual(adaptKernelRun(other, "math-place-value"), DEFAULT_ADAPTATION);
  assert.deepEqual(adaptKernelRun(null, "math-place-value"), DEFAULT_ADAPTATION);
});

test("a repeated structural error starts smaller with the strategy on screen", () => {
  const adaptation = adaptKernelRun(activity({ intent: "reteach" }), "math-place-value");
  assert.equal(adaptation.difficultyShift, -1);
  assert.equal(adaptation.scaffold, "visible");
  assert.ok(adaptation.reason, "the change must be explainable");
});

test("a representation difficulty keeps the level and adds help", () => {
  // The skill is fine; only this way of showing it is new. Dropping the
  // level would teach the child the skill itself is the problem.
  const adaptation = adaptKernelRun(activity({ intent: "represent" }), "math-place-value");
  assert.equal(adaptation.difficultyShift, 0);
  assert.equal(adaptation.scaffold, "visible");
});

test("rapid answering earns a settle pause, support dependence does not", () => {
  const rapid = adaptKernelRun(
    activity({ intent: "scaffold", hintStrategy: "immediate" }),
    "math-place-value"
  );
  assert.ok(rapid.settleMs > 0, "Check waits a beat when answers arrive unread");
  assert.equal(rapid.difficultyShift, -1);

  const leaning = adaptKernelRun(
    activity({ intent: "scaffold", hintStrategy: "early" }),
    "math-place-value"
  );
  assert.equal(leaning.settleMs, 0, "needing help is not the same as rushing");
  assert.equal(leaning.scaffold, "visible");
});

test("independent fluency raises the level and leaves help alone", () => {
  const adaptation = adaptKernelRun(activity({ intent: "stretch" }), "math-place-value");
  assert.equal(adaptation.difficultyShift, 1);
  assert.equal(adaptation.scaffold, "on-miss");
});

test("prerequisite and transfer runs are shaped for their purpose", () => {
  const prerequisite = adaptKernelRun(activity({ intent: "prerequisite" }), "math-place-value");
  assert.equal(prerequisite.difficultyShift, -1);
  assert.equal(prerequisite.scaffold, "visible");

  const transfer = adaptKernelRun(activity({ intent: "transfer" }), "math-place-value");
  assert.equal(transfer.difficultyShift, 0);
  assert.equal(transfer.scaffold, "on-miss");
});

test("ordinary intents leave the run at its default shape", () => {
  for (const intent of ["practice", "explore"]) {
    assert.deepEqual(
      adaptKernelRun(activity({ intent }), "math-place-value"),
      DEFAULT_ADAPTATION,
      `${intent} should not reshape the run`
    );
  }
});

test("every adaptation that changes the run can say why", () => {
  for (const intent of ["reteach", "prerequisite", "represent", "scaffold", "stretch", "transfer"]) {
    const adaptation = adaptKernelRun(activity({ intent }), "math-place-value");
    assert.ok(adaptation.reason && adaptation.reason.length > 20, `${intent} needs a reason`);
    assert.doesNotMatch(
      adaptation.reason,
      /\b(weak|deficit|behind|bad|fail)\b/i,
      `${intent} reason must stay observational`
    );
  }
});
