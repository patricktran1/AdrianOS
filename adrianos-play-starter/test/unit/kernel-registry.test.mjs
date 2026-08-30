import assert from "node:assert/strict";
import test from "node:test";
import {
  alternateMechanicRoute,
  KERNEL_GAMES,
  kernelVerbsForSkill,
  mechanicForGame,
  normalizeMechanic,
} from "../../lib/kernels/kernel-registry.ts";
import { KERNEL_SKILLS } from "../../lib/kernels/kernel-tasks.ts";

test("games default to choose unless they genuinely host another verb", () => {
  assert.equal(mechanicForGame("number-quest"), "choose");
  assert.equal(mechanicForGame("a-game-that-does-not-exist"), "choose");
  assert.equal(mechanicForGame("word-forge-studio"), "build");
  assert.equal(mechanicForGame("math-motion-lab"), "place");
  assert.equal(mechanicForGame("memory-match"), "recall");
  assert.equal(mechanicForGame(KERNEL_GAMES.build.slug), "build");
  assert.equal(mechanicForGame(KERNEL_GAMES.place.slug), "place");
});

test("normalizeMechanic accepts only the four verbs", () => {
  assert.equal(normalizeMechanic("build"), "build");
  assert.equal(normalizeMechanic("place"), "place");
  assert.equal(normalizeMechanic("choose"), "choose");
  assert.equal(normalizeMechanic("recall"), "recall");
  assert.equal(normalizeMechanic("banana"), null);
  assert.equal(normalizeMechanic(3), null);
  assert.equal(normalizeMechanic(undefined), null);
});

test("kernel verbs per skill mirror the task engine's coverage", () => {
  assert.deepEqual(kernelVerbsForSkill("math-place-value"), ["build", "place"]);
  assert.deepEqual(kernelVerbsForSkill("math-addition"), ["build"]);
  assert.deepEqual(kernelVerbsForSkill("reading-sequencing"), ["place"]);
  assert.deepEqual(kernelVerbsForSkill("spelling-grade-2"), []);
  for (const verb of ["build", "place"]) {
    for (const skillId of KERNEL_SKILLS[verb]) {
      assert.ok(kernelVerbsForSkill(skillId).includes(verb));
    }
  }
});

test("alternate routes avoid mechanics the skill is already shown in", () => {
  const fresh = alternateMechanicRoute("math-place-value", ["choose"]);
  assert.equal(fresh?.verb, "build");
  assert.equal(fresh?.slug, "maker-workshop");
  assert.ok(fresh?.href.includes("skill=math-place-value"));
  assert.ok(fresh?.href.includes("from=transfer"));

  const afterBuild = alternateMechanicRoute("math-place-value", ["choose", "build"]);
  assert.equal(afterBuild?.verb, "place");
  assert.equal(afterBuild?.slug, "stepping-stones");

  assert.equal(
    alternateMechanicRoute("math-place-value", ["choose", "build", "place"]),
    null,
    "a skill shown through every kernel verb has nowhere new to route"
  );
  assert.equal(alternateMechanicRoute("spelling-grade-2", ["build"]), null);
});
