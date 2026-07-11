import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const gamesDir = path.join(root, "app", "games");
const outputPath = path.join(root, "lib", "generated-games.ts");

const allowedSubjects = new Set([
  "Logic",
  "Memory",
  "Math",
  "Reading",
  "Science",
  "Geography",
  "History",
  "Civics",
  "Economics",
  "Wellbeing",
  "Health",
  "Digital Citizenship",
  "Music",
  "Art",
  "Engineering",
  "Movement",
  "Coding",
  "Creativity",
]);

async function main() {
  const entries = await fs.readdir(gamesDir, { withFileTypes: true });
  const games = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metadataPath = path.join(gamesDir, entry.name, "game.json");
    try {
      const raw = await fs.readFile(metadataPath, "utf8");
      const game = JSON.parse(raw);
      if (!game.slug || !game.title || !game.description || !game.emoji) throw new Error("Missing required metadata fields.");
      if (game.slug !== entry.name) throw new Error(`Slug "${game.slug}" must match folder name "${entry.name}".`);
      if (!allowedSubjects.has(game.subject)) throw new Error(`Unsupported subject "${game.subject}".`);
      games.push({ slug: game.slug, title: game.title, description: game.description, emoji: game.emoji, subject: game.subject, age: game.age ?? "Ages 6+", status: game.status ?? "playable", order: Number.isFinite(game.order) ? game.order : 999 });
    } catch (error) {
      if (error?.code === "ENOENT") { console.warn(`Skipping ${entry.name}: no game.json found.`); continue; }
      throw new Error(`Invalid metadata in ${entry.name}: ${error.message}`);
    }
  }

  games.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const output = `// AUTO-GENERATED. DO NOT EDIT BY HAND.\nimport type { Game } from "./games";\n\nexport const games: Game[] = ${JSON.stringify(games.map(({ order, ...game }) => game), null, 2)};\n`;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, "utf8");
  console.log(`Generated ${games.length} games.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
