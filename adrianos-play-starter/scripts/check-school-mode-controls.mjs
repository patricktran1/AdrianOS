import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const gamesDir = path.join(root, "app", "games");
const extensions = new Set([".css", ".ts", ".tsx"]);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const relative = (file) => path.relative(root, file).split(path.sep).join("/");

async function main() {
  const files = await walk(gamesDir);
  const failures = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    if (file.endsWith(".css")) {
      for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = match[1].trim().replace(/\s+/g, " ");
        const declarations = match[2];
        const fixedBottom = /position\s*:\s*fixed/i.test(declarations) && /bottom\s*:/i.test(declarations);
        if (fixedBottom && !/--school-mode-ribbon-clearance/.test(declarations)) failures.push(`${relative(file)}: ${selector}`);
      }
      continue;
    }

    for (const match of text.matchAll(/position\s*:\s*["']fixed["']/g)) {
      const nearby = text.slice(Math.max(0, match.index - 250), Math.min(text.length, match.index + 650));
      if (/bottom\s*:/.test(nearby) && !/--school-mode-ribbon-clearance/.test(nearby)) failures.push(`${relative(file)}: inline fixed bottom control near character ${match.index}`);
    }
  }

  if (failures.length) {
    console.error("Game controls can overlap the School Mode mission ribbon:");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error("Add var(--school-mode-ribbon-clearance, 0px) to the control's normal bottom offset.");
    process.exit(1);
  }

  console.log(`School Mode control audit passed across ${files.length} game source files.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
