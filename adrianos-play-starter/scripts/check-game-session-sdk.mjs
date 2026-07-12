import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migratedGames = [
  "dinosaur-detective/page.tsx",
  "human-body-explorer/page.tsx",
  "money-math/page.tsx",
  "music-maker/page.tsx",
  "question-quest/QuestionQuest.tsx",
  "solar-system-explorer/page.tsx",
  "treasure-map-math/page.tsx",
];

const failures = [];

for (const relativePath of migratedGames) {
  const file = path.join(root, "app", "games", relativePath);
  const source = await fs.readFile(file, "utf8");
  if (!source.includes("useGameSession")) failures.push(`${relativePath}: missing useGameSession`);
  if (!source.includes("completeGame(")) failures.push(`${relativePath}: missing completeGame call`);
  if (source.includes("useAdrianProgress")) failures.push(`${relativePath}: bypasses shared SDK`);
  if (/completed\s*:\s*true/.test(source)) failures.push(`${relativePath}: hand-rolls completion flag`);
}

const sdk = await fs.readFile(path.join(root, "lib", "game-session.ts"), "utf8");
if (!sdk.includes("completedRef.current")) failures.push("game-session.ts: missing duplicate-completion protection");
if (!sdk.includes("completed: true")) failures.push("game-session.ts: missing verified completion award");
if (!sdk.includes("recordPlay(gameSlug)")) failures.push("game-session.ts: missing play recording");

if (failures.length) {
  console.error("Game completion SDK contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Game completion SDK audit passed for ${migratedGames.length} migrated games.`);
