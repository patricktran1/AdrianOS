import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`Elementary scope check failed: ${message}`);
  process.exit(1);
};

const scope = read("lib/adrian-elementary-scope.ts");
const grade = read("lib/adrian-profile-grade.ts");
const milestones = read("lib/adrian-elementary-path.ts");
const skillGraph = read("lib/adrian-skill-graph.ts");
const layout = read("app/layout.tsx");
const setupPage = read("app/family/setup/page.tsx");
const schoolCard = read("components/CurriculumPathCard.tsx");
const familyAdmin = read("lib/family-profile-admin.ts");
const generatedGames = read("lib/generated-games.ts");
const journeyPage = path.join(root, "app/curriculum/elementary/page.tsx");

if (!scope.includes("ELEMENTARY_MIN_AGE = 4") || !scope.includes("ELEMENTARY_MAX_AGE = 11")) {
  fail("the supported age range must remain 4 through 11");
}
if (!scope.includes("ELEMENTARY_MIN_GRADE: ElementaryGrade = -1") || !scope.includes("ELEMENTARY_MAX_GRADE: ElementaryGrade = 5")) {
  fail("the supported grade range must remain TK through Grade 5");
}
if (!scope.includes('label: "TK (Transitional Kindergarten)"') || scope.includes('label: "Grade 6"')) {
  fail("grade options must begin with TK and stop before Grade 6");
}
if (!grade.includes("ELEMENTARY_GRADE_OPTIONS") || !grade.includes("normalizeElementaryGrade")) {
  fail("profile grade reads and writes must use the shared elementary boundary");
}
if (!familyAdmin.includes("normalizeElementaryAge") || !familyAdmin.includes("normalizeElementaryGrade")) {
  fail("family profile saves must normalize both age and grade");
}
if (!layout.includes("<ElementaryScopeBridge />")) {
  fail("the root layout must migrate restored and cloud-synced profiles into scope");
}
if (!setupPage.includes("ElementaryFamilySetup")) {
  fail("family setup must expose only elementary age choices");
}
if (!fs.existsSync(journeyPage)) {
  fail("the Elementary Journey route is missing");
}
if (!schoolCard.includes("TK–5 ELEMENTARY JOURNEY") || !schoolCard.includes('/curriculum/elementary')) {
  fail("School Mode must surface the Elementary Journey");
}

const catalogIds = new Set(
  [...skillGraph.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
);
const milestoneSkillIds = new Set();
for (const block of milestones.matchAll(/skillIds:\s*\[([^\]]*)\]/g)) {
  for (const match of block[1].matchAll(/"([a-z0-9-]+)"/g)) milestoneSkillIds.add(match[1]);
}
const missing = [...milestoneSkillIds].filter((id) => !catalogIds.has(id));
if (missing.length > 0) {
  fail(`elementary milestones reference missing skill IDs: ${missing.join(", ")}`);
}

for (const gradeValue of [-1, 0, 1, 2, 3, 4, 5]) {
  if (!milestones.includes(`grade: ${gradeValue},`)) fail(`Grade ${gradeValue} has no milestone pack`);
}

const ageLabels = [...generatedGames.matchAll(/"age":\s*"([^"]+)"/g)].map((match) => match[1]);
if (ageLabels.length === 0) fail("the generated game catalog has no age labels");
for (const label of ageLabels) {
  const numbers = label.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0 || numbers.some((value) => value < 4 || value > 11)) {
    fail(`game age label is outside ages 4–11: ${label}`);
  }
  if (label.includes("+")) fail(`open-ended game age labels are not allowed: ${label}`);
}

console.log(`Elementary scope check passed: TK–5, ages 4–11, ${milestoneSkillIds.size} linked skills, ${ageLabels.length} games.`);
