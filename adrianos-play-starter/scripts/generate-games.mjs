import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createGeneratedGamesSource,
  normalizeGameMetadata,
} from "./lib/game-catalog.mjs";

const root = process.cwd();
const gamesDir = path.join(root, "app", "games");
const outputPath = path.join(root, "lib", "generated-games.ts");

async function main() {
  const entries = await fs.readdir(gamesDir, { withFileTypes: true });
  const games = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadataPath = path.join(gamesDir, entry.name, "game.json");
    try {
      const raw = await fs.readFile(metadataPath, "utf8");
      games.push(normalizeGameMetadata(entry.name, JSON.parse(raw)));
    } catch (error) {
      if (error?.code === "ENOENT") {
        console.warn(`Skipping ${entry.name}: no game.json found.`);
        continue;
      }
      throw new Error(`Invalid metadata in ${entry.name}: ${error.message}`);
    }
  }

  const output = createGeneratedGamesSource(games);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");
  console.log(`Generated ${games.length} elementary games.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
