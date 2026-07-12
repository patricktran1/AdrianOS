import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  curriculum: path.join(root, "lib", "adrian-curriculum.ts"),
  gradeStandards: path.join(root, "lib", "adrian-grade-standards.ts"),
  skillGraph: path.join(root, "lib", "adrian-skill-graph.ts"),
  numberQuest: path.join(root, "app", "games", "number-quest", "page.tsx"),
  questSystem: path.join(root, "lib", "adrian-quest-system.ts"),
  questPage: path.join(root, "app", "quests", "page.tsx"),
  schoolBridge: path.join(root, "components", "QuestWorldsBridge.tsx"),
};

const [curriculumSource, gradeSource, skillSource, numberQuestSource, questSystemSource, questPageSource, schoolBridgeSource] = await Promise.all(
  Object.values(paths).map((file) => fs.readFile(file, "utf8")),
);

const catalogSkillIds = new Set(
  [...skillSource.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]),
);
const numberQuestSkillIds = new Set([
  "math-counting",
  "math-place-value",
  "math-multiplication",
  "math-division",
  "math-fractions",
  "math-decimals",
  "math-measurement",
  "math-geometry",
]);
const knownSkillIds = new Set([...catalogSkillIds, ...numberQuestSkillIds]);

const standards = [];
const combinedStandardsSource = `${gradeSource}\n${curriculumSource}`;
const standardPattern = /code:\s*"([^"]+)"[\s\S]*?framework:\s*"([^"]+)"[\s\S]*?grade:\s*(-?\d+)[\s\S]*?subject:\s*"(Math|Reading|Science)"[\s\S]*?skillIds:\s*\[([^\]]*)\][\s\S]*?strength:\s*"(direct|supporting|enrichment)"/g;
for (const match of combinedStandardsSource.matchAll(standardPattern)) {
  standards.push({
    code: match[1],
    framework: match[2],
    grade: Number(match[3]),
    subject: match[4],
    skillIds: [...match[5].matchAll(/"([a-z0-9-]+)"/g)].map((row) => row[1]),
    strength: match[6],
  });
}

const errors = [];
if (standards.length < 60) errors.push(`Expected a substantive TK-5 priority pack; found ${standards.length}.`);

const identities = new Set();
for (const standard of standards) {
  const identity = `${standard.grade}:${standard.code}`;
  if (identities.has(identity)) errors.push(`Duplicate curriculum standard: ${identity}`);
  identities.add(identity);
  if (standard.grade < -1 || standard.grade > 5) errors.push(`Out-of-scope grade on ${standard.code}: ${standard.grade}`);
  if (standard.skillIds.length === 0) errors.push(`Standard ${standard.code} has no mapped skills.`);
  if (!["CA CCSS Math", "CA CCSS ELA", "CA NGSS", "CA TK Foundations"].includes(standard.framework)) {
    errors.push(`Unsupported framework on ${standard.code}: ${standard.framework}`);
  }
  for (const skillId of standard.skillIds) {
    if (!knownSkillIds.has(skillId)) errors.push(`Standard ${standard.code} points to missing skill ${skillId}.`);
  }
}

for (const grade of [-1, 0, 1, 2, 3, 4, 5]) {
  const gradeStandards = standards.filter((standard) => standard.grade === grade);
  if (gradeStandards.length < 5) errors.push(`Grade ${grade} needs at least five priority standards.`);
  for (const subject of ["Math", "Reading", "Science"]) {
    if (!gradeStandards.some((standard) => standard.subject === subject)) {
      errors.push(`Grade ${grade} has no ${subject} priority standard.`);
    }
  }
}

if (!standards.some((standard) => standard.strength === "direct")) errors.push("Curriculum map needs direct evidence alignments.");
if (!standards.some((standard) => standard.strength === "supporting")) errors.push("Curriculum map must distinguish supporting practice.");

for (const requiredCode of [
  "K.CC.A.1", "1.OA.A.1", "2.OA.A.1", "3.OA.A.1", "4.NF.A.1", "5.NBT.A.3",
  "RL.K.1", "RL.1.1", "RL.2.1", "RL.3.1", "RL.4.1", "RL.5.1",
  "K-PS2-1", "1-PS4-1", "2-PS1-1", "3-PS2-1", "4-PS3-1", "5-PS1-1",
]) {
  if (!standards.some((standard) => standard.code === requiredCode)) errors.push(`Required grade anchor is missing: ${requiredCode}`);
}

for (const skillId of numberQuestSkillIds) {
  if (!numberQuestSource.includes(`"${skillId}"`)) errors.push(`Number Quest does not implement ${skillId}.`);
}
if (!numberQuestSource.includes("recordLearningAttempt") || !numberQuestSource.includes("CLUE UNLOCKED") || !numberQuestSource.includes("data-correct")) {
  errors.push("Number Quest must collect evidence and provide clue/retry browser hooks.");
}
if (!questSystemSource.includes("claimStandardsQuest") || !questSystemSource.includes("standards-quest:${grade}:${code}")) {
  errors.push("Quest rewards must be mastery-gated and idempotent per grade and standard.");
}
for (const world of ["Number Kingdom", "Story Realm", "Discovery Lab"]) {
  if (!questSystemSource.includes(world) || !questPageSource.includes("QUEST_WORLDS")) errors.push(`Missing quest world: ${world}`);
}
if (!schoolBridgeSource.includes('aria-label="Curriculum quest worlds"') || !schoolBridgeSource.includes('/quests')) {
  errors.push("School Mode must surface the grade-level quest map.");
}

if (errors.length > 0) {
  console.error("Curriculum integrity check failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Curriculum integrity check passed for ${standards.length} TK-5 priority standards, ${knownSkillIds.size} playable skills, and 3 quest worlds.`);
