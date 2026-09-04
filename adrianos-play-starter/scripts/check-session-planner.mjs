import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * Architectural contracts for the session planner.
 *
 * AdrianOS shipped for a long time with two answers to "what next?": a
 * learner model that reasoned from evidence, and a stored three-item playlist
 * built from the curriculum graph that, because School Mode is on by default,
 * silently won. These checks exist so that cannot happen again, and so the
 * guarantees that make a session a session — bounded remediation, a plan that
 * may shrink, evidence that has to be earned — cannot be removed quietly.
 *
 * They are string checks. Crude, but they fail loudly and they name the
 * promise rather than the implementation.
 */

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const planner = await source("lib/session/session-planner.ts");
const goals = await source("lib/session/session-goals.ts");
const store = await source("lib/session/session-store.ts");
const schema = await source("lib/session/session-schema.ts");
const glance = await source("lib/session/session-glance.ts");
const summary = await source("lib/session/session-summary.ts");
const runtime = await source("lib/adrian-session-runtime.ts");
const world = await source("components/WorldStage.tsx");
const chain = await source("components/AdaptiveAdventureChain.tsx");
const school = await source("lib/adrian-daily-session.ts");
const model = await source("lib/adrian-learner-model.ts");

/* ------------------------------------------------------------------ */
/* One planner, one teaching engine                                     */
/* ------------------------------------------------------------------ */

if (!planner.includes("export function planSession") || !planner.includes("export function replanSession")) {
  failures.push("planner: the session planner is no longer exported");
}
if (!planner.includes("chooseSkillIntent(model, goal.skillId)")) {
  failures.push("planner: goals no longer resolve through the teaching decision engine");
}
if (!model.includes("export function chooseSkillIntent")) {
  failures.push("learner model: the per-skill teaching decision is no longer exported");
}
if (!model.includes("return ask([skill]);")) {
  failures.push("learner model: a per-skill question can answer about a different skill");
}

// The world must point at the plan, not hold a second opinion about it.
if (!world.includes("return step ? step.activity : recommendNextActivity(learner)")) {
  failures.push("world: the beacon no longer resolves from the current planner state");
}
if (world.includes("ensureDailySession") || world.includes("WorldPriority")) {
  failures.push("world: a second source of routing has come back to the world screen");
}
// The post-activity screen shows the plan's step; it never decides for itself.
if (!chain.includes("SESSION_STEP_EVENT") || !chain.includes("stepRef.current")) {
  failures.push("post-activity: the next destination is no longer taken from the session");
}
if (!runtime.includes("SESSION_STEP_EVENT") || !runtime.includes("function announce")) {
  failures.push("session runtime: the current step is no longer announced to screens");
}
// ...and it must stay cheap: the games layout is copied into every game route.
for (const heavy of ["adrian-session-runtime", "session-planner", "adrian-learner-model", "adrian-mastery-loop"]) {
  if (new RegExp(`^import [^\n]*from "@/lib/(session/)?${heavy}"`, "m").test(chain)) {
    failures.push(`post-activity: importing ${heavy} puts the planner into every game route`);
  }
}
if (chain.includes("buildAdventureChain")) {
  failures.push("post-activity: a page-specific learning policy has come back");
}
if (!chain.includes('data-chain-count="1"')) {
  failures.push("post-activity: the child is offered more than one next destination");
}
// The school screens project the plan; they do not plan.
for (const forbidden of ["getCurriculumRecommendedSkill", "ensureDailyAdventure", "getSkillGraph"]) {
  if (school.includes(forbidden)) {
    failures.push(`school screens: ${forbidden} means a second planner is running`);
  }
}

/* ------------------------------------------------------------------ */
/* Protections a child depends on                                       */
/* ------------------------------------------------------------------ */

const protections = [
  ["MAX_STEPS_PER_SKILL", "a cap on how much of one session a single skill may take"],
  ["MAX_CONSECUTIVE_REMEDIAL", "a cap on consecutive corrective steps"],
  ["MAX_CONSECUTIVE_CATEGORY", "a cap on repeating one kind of thinking"],
  ["MAX_PREREQUISITE_STEPS", "a bound on prerequisite detours"],
  ["COLD_START_STEPS", "a bound on unguided exploration"],
  ["export function sessionBudget", "an age-aware session length"],
  ["export function admitsStep", "the guard every step passes through"],
];
for (const [needle, description] of protections) {
  if (!planner.includes(needle)) failures.push(`planner: missing ${description}`);
}
if (!goals.includes("isRemedialGoal") || !goals.includes("isRemedialIntent")) {
  failures.push("planner: remediation is no longer identifiable, so it cannot be bounded");
}

// A plan may shrink. It may not grow, except for the one closure case.
const additions = planner.match(/steps\.push\(/g) ?? [];
if (additions.length > 4) {
  failures.push(`planner: ${additions.length} places add steps; a session that grows when it goes badly is a treadmill`);
}
if (!planner.includes('status: "dropped"')) {
  failures.push("planner: a plan can no longer shrink");
}

// Final correctness is not the same as understanding.
if (!planner.includes("function inferenceUnearned")) {
  failures.push("planner: an unreasoned right answer can now satisfy an inference goal");
}
if (!planner.includes('step.goal.need === "inference"')) {
  failures.push("planner: the inference goal no longer checks how the answer was reached");
}
// A representation gap is about the form, not the skill.
if (!planner.includes('"representation_gap"')) {
  failures.push("planner: representation-specific difficulty is no longer a distinct goal");
}

/* ------------------------------------------------------------------ */
/* Stored session state is child data                                   */
/* ------------------------------------------------------------------ */

if (!schema.includes("export function parseStoredSession")) {
  failures.push("session schema: stored sessions are no longer validated before use");
}
for (const table of ["GOAL_KINDS", "EVIDENCE_NEEDS", "REASONS", "REVISION_REASONS", "COMPLETIONS", "STEP_STATUSES"]) {
  if (!new RegExp(`const ${table} = new Set`).test(schema)) {
    failures.push(`session schema: ${table} must be a Set, not a prototype-bearing object`);
  }
}
if (!schema.includes("function asMember")) {
  failures.push("session schema: enum validation against constant collections is missing");
}
// Corrupt storage is discarded, not repaired into a plan nobody planned.
if (!schema.includes("if (raw.v !== 1) return null;")) {
  failures.push("session schema: an unknown storage version is no longer rejected");
}
// Reading progress must not cost a page the planner: the ribbon that sits on
// every game screen once dragged the learner model, the kernel task banks and
// the whole game catalogue onto all fifty of them.
for (const heavy of ["session-planner", "adrian-learner-model", "generated-games", "kernel-registry"]) {
  if (schema.includes(`${heavy}.ts"`) && heavy !== "session-planner") {
    failures.push(`session schema: importing ${heavy} puts planning weight into every reader`);
  }
  if (glance.includes(heavy)) {
    failures.push(`session glance: importing ${heavy} defeats the point of a cheap read`);
  }
}
if (!runtime.includes("catch {")) {
  failures.push("session runtime: unreadable storage must not break the session");
}
// Nothing about what a child said, only what it changes.
for (const field of ["prompt", "givenAnswer", "correctAnswer", "responseMs", "href:"]) {
  if (new RegExp(`${field}[^\\n]*:\\s*(step|plan|row)\\.`).test(store)) {
    failures.push(`session store: ${field} is being persisted and has no planning use`);
  }
}
const ribbon = await source("components/DailySessionBar.tsx");
if (ribbon.includes("adrian-daily-session") || ribbon.includes("generated-games")) {
  failures.push("guided ribbon: reading session progress must not load the planner or the catalogue");
}

/* ------------------------------------------------------------------ */
/* What a child and a parent are allowed to see                          */
/* ------------------------------------------------------------------ */

const CHILD_FACING = [
  "components/WorldStage.tsx",
  "components/AdaptiveAdventureChain.tsx",
  "components/DailySessionBar.tsx",
];
const JARGON = [
  "session planner", "learning goal", "teaching intent", "evidence need",
  "session budget", "warm-start", "inference-transfer", "alternate-representation",
  "curriculum objective", "mastery percent",
];
for (const file of CHILD_FACING) {
  const text = (await source(file)).toLowerCase();
  for (const term of JARGON) {
    // Only rendered text matters; a type name or an import is not on screen.
    const rendered = new RegExp(`>[^<>{}]*${term}`, "i");
    if (rendered.test(text)) failures.push(`${file}: planner jargon "${term}" is rendered to a child`);
  }
}

const PSYCHOMETRIC = /misconception probability|cognitive (deficit|index|score)|reasoning percentile|inference iq|deductive reasoning score/i;
if (PSYCHOMETRIC.test(summary)) {
  failures.push("parent summary: psychometric language has appeared");
}
if (/\bdoes not understand\b|\bdeficit\b|\bdisorder\b|\bstruggling\b|\bbehind\b/i.test(summary)) {
  failures.push("parent summary: wording claims knowledge of the child rather than describing what happened");
}
if (!summary.includes("export function summariseSession")) {
  failures.push("parent summary: the four-question session summary is missing");
}

/* ------------------------------------------------------------------ */
/* No LLM, no network, in the planning path                             */
/* ------------------------------------------------------------------ */

for (const [file, text] of [
  ["session-planner.ts", planner],
  ["session-store.ts", store],
  ["session-schema.ts", schema],
  ["session-glance.ts", glance],
  ["session-summary.ts", summary],
  ["adrian-session-runtime.ts", runtime],
]) {
  if (/\bfetch\(|XMLHttpRequest|anthropic|openai|\bawait import\(/i.test(text)) {
    failures.push(`${file}: the planning path must stay pure, local and synchronous`);
  }
}

if (failures.length) {
  console.error("Session planner contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Session planner contract passed: one planner, ${protections.length} protections, validated storage, and no planner language on any child-facing surface.`
);
