import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const curriculumPath = path.join(root, "lib", "adrian-curriculum.ts");
const skillGraphPath = path.join(root, "lib", "adrian-skill-graph.ts");

const [curriculumSource, skillSource] = await Promise.all([
  fs.readFile(curriculumPath, "utf8"),
  fs.readFile(skillGraphPath, "utf8"),
]);

const skillIds = new Set(
  [...skillSource.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((match) => match[1])
);

const standards = [];
const standardPattern = /code:\s*"([^"]+)"[\s\S]*?grade:\s*(-?\d+)[\s\S]*?skillIds:\s*\[([^\]]*)\][\s\S]*?strength:\s*"(direct|supporting|enrichment)"/g;
for (const match of curriculumSource.matchAll(standardPattern)) {
  standards.push({
    code: match[1],
    grade: Number(match[2]),
    skillIds: [...match[3].matchAll(/"([a-z0-9-]+)"/g)].map((row) => row[1]),
    strength: match[4],
  });
}

const errors = [];
if (standards.length < 10) errors.push(`Expected a substantive standards pack; found ${standards.length}.`);

const codes = new Set();
for (const standard of standards) {
  if (codes.has(standard.code)) errors.push(`Duplicate curriculum code: ${standard.code}`);
  codes.add(standard.code);
  if (standard.grade !== 2) errors.push(`Initial curriculum pack must remain Grade 2: ${standard.code}`);
  if (standard.skillIds.length === 0) errors.push(`Standard ${standard.code} has no mapped skills.`);
  for (const skillId of standard.skillIds) {
    if (!skillIds.has(skillId)) errors.push(`Standard ${standard.code} points to missing skill ${skillId}.`);
  }
}

if (!standards.some((standard) => standard.strength === "direct")) {
  errors.push("Curriculum map must include direct evidence alignments.");
}
if (!standards.some((standard) => standard.strength === "supporting")) {
  errors.push("Curriculum map must distinguish supporting enrichment from direct evidence.");
}

for (const requiredCode of ["2.OA.A.1", "RL.2.1", "W.2.3", "2-PS1-1", "K-2-ETS1-3"]) {
  if (!codes.has(requiredCode)) errors.push(`Required Grade 2 anchor is missing: ${requiredCode}`);
}

if (errors.length > 0) {
  console.error("Curriculum integrity check failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Curriculum integrity check passed for ${standards.length} Grade 2 standards and ${skillIds.size} catalog skills.`);
