const SUBJECTS = [
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
  "Life Skills",
  "Environment",
  "Learning Skills",
  "Coding",
  "Creativity",
];

export const ALLOWED_SUBJECTS = Object.freeze([...SUBJECTS]);
const allowedSubjectSet = new Set(ALLOWED_SUBJECTS);
const allowedStatuses = new Set(["playable", "coming-soon"]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required metadata field: ${field}.`);
  }
  return value.trim();
}

export function elementaryAgeLabel(value) {
  const raw = String(value ?? "Ages 6+").trim();
  const numbers = [...raw.matchAll(/\d+/g)].map((match) => Number(match[0]));

  if (numbers.length === 0) return "Ages 6–11";

  const minimum = clamp(numbers[0], 4, 11);
  if (numbers.length === 1) {
    if (raw.includes("+")) return minimum === 11 ? "Age 11" : `Ages ${minimum}–11`;
    return `Age ${minimum}`;
  }

  const maximum = clamp(numbers[1], minimum, 11);
  return minimum === maximum ? `Age ${minimum}` : `Ages ${minimum}–${maximum}`;
}

export function normalizeGameMetadata(folderName, metadata) {
  const folder = requiredText(folderName, "folderName");
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Game metadata must be an object.");
  }

  const slug = requiredText(metadata.slug, "slug");
  const title = requiredText(metadata.title, "title");
  const description = requiredText(metadata.description, "description");
  const emoji = requiredText(metadata.emoji, "emoji");
  const subject = requiredText(metadata.subject, "subject");
  const status = metadata.status ?? "playable";

  if (slug !== folder) {
    throw new Error(`Slug "${slug}" must match folder name "${folder}".`);
  }
  if (!allowedSubjectSet.has(subject)) {
    throw new Error(`Unsupported subject "${subject}".`);
  }
  if (!allowedStatuses.has(status)) {
    throw new Error(`Unsupported status "${status}".`);
  }

  return {
    slug,
    title,
    description,
    emoji,
    subject,
    age: elementaryAgeLabel(metadata.age),
    status,
    order: Number.isFinite(metadata.order) ? metadata.order : 999,
  };
}

export function sortGames(games) {
  return [...games].sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export function assertUniqueGameSlugs(games) {
  const slugs = new Set();
  for (const game of games) {
    if (slugs.has(game.slug)) throw new Error(`Duplicate game slug: ${game.slug}`);
    slugs.add(game.slug);
  }
}

export function createGeneratedGamesSource(games) {
  assertUniqueGameSlugs(games);
  const publicGames = sortGames(games).map(({ order: _order, ...game }) => game);
  return `// AUTO-GENERATED. DO NOT EDIT BY HAND.\nimport type { Game } from "./games";\n\nexport const games: Game[] = ${JSON.stringify(publicGames, null, 2)};\n`;
}
