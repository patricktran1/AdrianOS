import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueGameSlugs,
  createGeneratedGamesSource,
  elementaryAgeLabel,
  normalizeGameMetadata,
  sortGames,
} from "../../scripts/lib/game-catalog.mjs";

function validMetadata(overrides = {}) {
  return {
    slug: "wonder-lab",
    title: "Wonder Lab",
    description: "Build and test connected science experiments.",
    emoji: "🔬",
    subject: "Science",
    age: "Ages 6+",
    status: "playable",
    order: 2,
    ...overrides,
  };
}

test("normalizes exact ages, open-ended ages, ranges, and invalid bounds", () => {
  assert.equal(elementaryAgeLabel("Age 8"), "Age 8");
  assert.equal(elementaryAgeLabel("Ages 6+"), "Ages 6–11");
  assert.equal(elementaryAgeLabel("Ages 5-7"), "Ages 5–7");
  assert.equal(elementaryAgeLabel("Ages 2-14"), "Ages 4–11");
  assert.equal(elementaryAgeLabel("not supplied"), "Ages 6–11");
});

test("normalizes valid metadata without mutating the source object", () => {
  const source = validMetadata();
  const normalized = normalizeGameMetadata("wonder-lab", source);

  assert.deepEqual(normalized, {
    slug: "wonder-lab",
    title: "Wonder Lab",
    description: "Build and test connected science experiments.",
    emoji: "🔬",
    subject: "Science",
    age: "Ages 6–11",
    status: "playable",
    order: 2,
  });
  assert.equal(source.age, "Ages 6+");
});

test("applies safe defaults for status, age, and ordering", () => {
  const normalized = normalizeGameMetadata("wonder-lab", validMetadata({
    age: undefined,
    status: undefined,
    order: "second",
  }));

  assert.equal(normalized.age, "Ages 6–11");
  assert.equal(normalized.status, "playable");
  assert.equal(normalized.order, 999);
});

test("rejects malformed metadata with actionable messages", () => {
  assert.throws(
    () => normalizeGameMetadata("wonder-lab", null),
    /metadata must be an object/i,
  );
  assert.throws(
    () => normalizeGameMetadata("wonder-lab", validMetadata({ title: " " })),
    /title/i,
  );
  assert.throws(
    () => normalizeGameMetadata("wonder-lab", validMetadata({ slug: "other-lab" })),
    /must match folder name/i,
  );
  assert.throws(
    () => normalizeGameMetadata("wonder-lab", validMetadata({ subject: "Astrology" })),
    /unsupported subject/i,
  );
  assert.throws(
    () => normalizeGameMetadata("wonder-lab", validMetadata({ status: "retired" })),
    /unsupported status/i,
  );
});

test("sorts by explicit order and then title without mutating input", () => {
  const games = [
    validMetadata({ slug: "zebra", title: "Zebra", order: 2 }),
    validMetadata({ slug: "beta", title: "Beta", order: 1 }),
    validMetadata({ slug: "alpha", title: "Alpha", order: 1 }),
  ];

  const sorted = sortGames(games);
  assert.deepEqual(sorted.map((game) => game.slug), ["alpha", "beta", "zebra"]);
  assert.deepEqual(games.map((game) => game.slug), ["zebra", "beta", "alpha"]);
});

test("rejects duplicate slugs before generating the public catalog", () => {
  const games = [validMetadata(), validMetadata({ title: "Duplicate" })];
  assert.throws(() => assertUniqueGameSlugs(games), /duplicate game slug/i);
  assert.throws(() => createGeneratedGamesSource(games), /duplicate game slug/i);
});

test("generates deterministic TypeScript and removes internal ordering", () => {
  const source = createGeneratedGamesSource([
    validMetadata({ slug: "second", title: "Second", order: 2 }),
    validMetadata({ slug: "first", title: "First", order: 1 }),
  ]);

  assert.match(source, /AUTO-GENERATED/);
  assert.match(source, /export const games: Game\[\]/);
  assert.ok(source.indexOf('"slug": "first"') < source.indexOf('"slug": "second"'));
  assert.doesNotMatch(source, /"order"/);
});
