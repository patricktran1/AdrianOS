import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const engine = await source("lib/adrian-mastery-loop.ts");
const runtime = await source("lib/adrian-mastery-runtime.ts");
const bridge = await source("components/MasteryLoopBridge.tsx");
const lab = await source("app/mastery-lab/page.tsx");
const parent = await source("components/ParentMasteryLoopPortal.tsx");
const layout = await source("app/layout.tsx");
const gate = await source("components/FamilyOnboardingGate.tsx");
const parentPage = await source("app/parent/page.tsx");

const contracts = [
  [engine, "EVIDENCE_THRESHOLD = 2", "engine: repeated-friction threshold is missing"],
  [engine, "RETENTION_DELAY_MS", "engine: delayed retention phase is missing"],
  [engine, "syncMasteryLoopForProfile", "engine: background synchronization is missing"],
  [engine, "recordMasteryCheck", "engine: verification result recording is missing"],
  [engine, "injectMasteryMission", "engine: School Mode intervention injection is missing"],
  [runtime, "runMasteryLoopForProfile", "runtime: guarded background execution is missing"],
  [runtime, "normalizeMission", "runtime: learner-facing skill labels are not normalized"],
  [bridge, "MasteryLoopBridge", "bridge: mastery evidence is not watched in the app shell"],
  [lab, "Mastery Lab", "learner: Mastery Lab route is missing"],
  [lab, "recordLearningAttempt", "learner: understanding checks do not create learning evidence"],
  [lab, "completed: true", "learner: verified lab completion cannot finish a guided mission"],
  [parent, "MASTERY RECOVERY", "parent: recovery visibility is missing"],
  [parent, "Mastery recovery loops", "parent: accessible mastery summary is missing"],
  [layout, "<MasteryLoopBridge />", "layout: mastery loop bridge is not mounted"],
  [gate, '"/mastery-lab"', "privacy: Mastery Lab is not protected by learner setup"],
  [parentPage, "<ParentMasteryLoopPortal />", "parent: recovery portal is not mounted"],
];

for (const [text, expected, message] of contracts) {
  if (!text.includes(expected)) failures.push(message);
}

if (failures.length) {
  console.error("Mastery recovery contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mastery recovery contract passed.");
