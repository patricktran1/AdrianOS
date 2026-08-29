import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorldMap,
  describeWorldDecision,
  skyForHour,
  TRAIL_ORDER,
  trailPoints,
} from "../../lib/adrian-world-map.ts";
import {
  buildLearnerModel,
  EMPTY_LEARNER_MODEL,
  recommendNextActivity,
} from "../../lib/adrian-learner-model.ts";

const PORTAL_GAMES = {
  action: { slug: "dino-dash-volcano-escape", title: "Dino Dash", subject: "Math", emoji: "🦖" },
  build: { slug: "dino-habitat-builder", title: "Habitat Builder", subject: "Science", emoji: "🔨" },
  mystery: { slug: "story-expedition", title: "Story Expedition", subject: "Reading", emoji: "🔎" },
  discover: { slug: "solar-system-explorer", title: "Solar System", subject: "Science", emoji: "🔭" },
  boss: { slug: "adaptive-boss-arena", title: "Boss Arena", subject: "Logic", emoji: "👾" },
};

const EYEBROWS = {
  action: "ACTION TRAIL",
  build: "MAKER BAY",
  mystery: "MYSTERY GROVE",
  discover: "DISCOVERY DOCK",
  boss: "POWER PEAK",
};

function portal(id, overrides = {}) {
  const game = PORTAL_GAMES[id];
  return {
    id,
    eyebrow: EYEBROWS[id],
    title: `Go to ${id}`,
    description: "",
    emoji: game.emoji,
    game: { ...game, description: "", age: "Ages 6+", status: "playable" },
    href: `/games/${game.slug}?from=adventure-world&portal=${id}`,
    plays: 0,
    completions: 0,
    interest: null,
    ...overrides,
  };
}

function world(overrides = {}) {
  const portals = overrides.portals ?? TRAIL_ORDER.map((id) => portal(id));
  return {
    themeId: "jurassic",
    title: "Jurassic Junction",
    tagline: "",
    guideEmoji: "🦖",
    sky: "day",
    weatherLabel: "Adventure blue",
    clears: 0,
    stage: { index: 0, title: "Base Camp", copy: "", nextAt: 1 },
    growthPieces: [],
    nextGrowthPiece: { emoji: "🪺", label: "Hatchling nest" },
    portals,
    heroPortal: portals[0],
    secretIcons: ["🥚", "🦴", "💎"],
    ...overrides,
  };
}

function evidenceRun(count, overrides = {}) {
  return Array.from({ length: count }, (_, index) => ({
    at: new Date(Date.UTC(2026, 7, 1, 9, index)).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "What is in the tens place?",
    correctAnswer: "4",
    givenAnswer: "4",
    correct: true,
    responseMs: 3000,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
    ...overrides,
  }));
}

test("the sky follows the real clock rather than a random roll", () => {
  assert.equal(skyForHour(2), "night");
  assert.equal(skyForHour(7), "sunrise");
  assert.equal(skyForHour(13), "day");
  assert.equal(skyForHour(18), "sunset");
  assert.equal(skyForHour(23), "night");
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL), [], null, new Date(2026, 7, 1, 13));
  assert.equal(map.sky, "day");
});

test("exactly one landmark is the beacon", () => {
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  assert.equal(map.landmarks.filter((landmark) => landmark.beacon).length, 1);
  assert.equal(map.beacon.beacon, true);
});

test("landmark positions never move between builds", () => {
  const first = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  const busy = world({
    portals: TRAIL_ORDER.map((id) => portal(id, { plays: 9, completions: 4 })),
    clears: 12,
  });
  const second = buildWorldMap(busy, EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));

  for (const landmark of first.landmarks) {
    const match = second.landmarks.find((row) => row.portal.id === landmark.portal.id);
    assert.deepEqual(match.wide, landmark.wide, `${landmark.portal.id} moved on the wide map`);
    assert.deepEqual(match.tall, landmark.tall, `${landmark.portal.id} moved on the tall map`);
  }
});

test("places are named after the place, not the game currently there", () => {
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  const grove = map.landmarks.find((landmark) => landmark.portal.id === "mystery");
  assert.equal(grove.label, "Mystery Grove");
  assert.equal(grove.status, "Story Expedition");
  assert.equal(map.landmarks.find((row) => row.portal.id === "boss").label, "Power Peak");
});

test("with no evidence the beacon is the least-played place", () => {
  const portals = [
    portal("action", { plays: 6, completions: 3 }),
    portal("build", { plays: 4, completions: 1 }),
    portal("mystery", { plays: 0, completions: 0 }),
    portal("discover", { plays: 2, completions: 0 }),
    portal("boss", { plays: 5, completions: 2 }),
  ];
  const map = buildWorldMap(
    world({ portals, heroPortal: portals[0] }),
    EMPTY_LEARNER_MODEL,
    recommendNextActivity(EMPTY_LEARNER_MODEL)
  );
  assert.equal(map.beacon.portal.id, "mystery");
  assert.equal(map.intent, "explore");
});

test("a misconception steers the beacon to the place that teaches that skill", () => {
  const model = buildLearnerModel("kid", [
    ...evidenceRun(8, { gameSlug: "dino-dash-volcano-escape" }),
    ...evidenceRun(6, {
      gameSlug: "dino-dash-volcano-escape",
      correct: false,
      givenAnswer: "7",
    }),
  ]);
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "reteach");

  const map = buildWorldMap(world(), model, next);
  assert.equal(map.beacon.portal.game.slug, "dino-dash-volcano-escape");
  assert.equal(map.intent, "reteach");
  assert.match(map.rationale, /"7"/);
});

test("a stretch goes to a place teaching the same subject", () => {
  const model = buildLearnerModel("kid", evidenceRun(16, { gameSlug: "word-forge-studio" }));
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "stretch");

  // No place hosts word-forge-studio, so the subject match wins: Action Trail
  // is currently running a Math game, which is the fluent subject.
  const map = buildWorldMap(world(), model, next);
  assert.equal(map.beacon.portal.id, "action");
  assert.equal(map.beacon.portal.game.subject, "Math");
});

test("a stretch with no subject match falls through to the boss peak", () => {
  const model = buildLearnerModel("kid", evidenceRun(16, {
    gameSlug: "music-lab",
    subject: "Music",
    skillId: "music-rhythm",
    skillLabel: "Rhythm",
  }));
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "stretch");

  const map = buildWorldMap(world(), model, next);
  assert.equal(map.beacon.portal.id, "boss");
});

test("a pending mission takes over the beacon without moving the map", () => {
  const priority = {
    slug: "number-quest",
    title: "Find the right starting point",
    emoji: "🧭",
    href: "/games/number-quest?guided=1",
    guideLine: "Your quest is ready. Tap the bright one!",
    rationale: "A planned session mission is pending.",
  };
  const plain = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  const guided = buildWorldMap(
    world(),
    EMPTY_LEARNER_MODEL,
    recommendNextActivity(EMPTY_LEARNER_MODEL),
    [],
    priority
  );

  assert.equal(guided.beacon.href, "/games/number-quest?guided=1");
  assert.equal(guided.beacon.status, "Find the right starting point");
  assert.equal(guided.guideLine, priority.guideLine);
  // The place name and its coordinates are untouched: the geography is stable
  // even when the activity waiting there changes.
  assert.equal(guided.beacon.label, plain.beacon.label);
  assert.deepEqual(guided.beacon.wide, plain.beacon.wide);
  // Non-beacon landmarks keep their own destinations.
  for (const landmark of guided.landmarks.filter((row) => !row.beacon)) {
    assert.equal(landmark.href, landmark.portal.href);
  }
});

test("the priority claims the place that already hosts its game", () => {
  const priority = {
    slug: "adaptive-boss-arena",
    title: "Boss run",
    emoji: "👾",
    href: "/games/adaptive-boss-arena?guided=1",
    guideLine: "Ready?",
    rationale: "Mission pending.",
  };
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL), [], priority);
  assert.equal(map.beacon.portal.id, "boss");
});

test("structures accumulate with clears and sit on terrain", () => {
  const map = buildWorldMap(
    world({
      clears: 5,
      growthPieces: [
        { emoji: "🪺", label: "Hatchling nest" },
        { emoji: "🌿", label: "Fern meadow" },
        { emoji: "💦", label: "Watering pond" },
        { emoji: "🌉", label: "Canyon bridge" },
        { emoji: "⛺", label: "Explorer shelter" },
      ],
    }),
    EMPTY_LEARNER_MODEL,
    recommendNextActivity(EMPTY_LEARNER_MODEL)
  );
  assert.equal(map.structures.length, 5);
  for (const structure of map.structures) {
    assert.ok(structure.wide.y >= 40, `${structure.label} floats above the terrain`);
    assert.ok(structure.tall.y >= 40, `${structure.label} floats above the terrain`);
    assert.ok(structure.scale > 0 && structure.scale <= 1);
  }
});

test("found secrets disappear from the map", () => {
  const all = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  assert.equal(all.secrets.length, 3);
  const partial = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL), [0, 2]);
  assert.equal(partial.secrets.length, 1);
  assert.equal(partial.secrets[0].emoji, "🦴");
});

test("the trail visits every landmark in a fixed order", () => {
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  const wide = trailPoints(map.landmarks, "wide").split(" ");
  assert.equal(wide.length, TRAIL_ORDER.length);
  const first = map.landmarks.find((row) => row.portal.id === TRAIL_ORDER[0]);
  assert.equal(wide[0], `${first.wide.x},${first.wide.y}`);
  assert.notEqual(trailPoints(map.landmarks, "tall"), trailPoints(map.landmarks, "wide"));
});

test("the guide never speaks assessment language to the child", () => {
  const model = buildLearnerModel("kid", [
    ...evidenceRun(8, { gameSlug: "dino-dash-volcano-escape" }),
    ...evidenceRun(6, { gameSlug: "dino-dash-volcano-escape", correct: false, givenAnswer: "7" }),
  ]);
  const map = buildWorldMap(world(), model, recommendNextActivity(model));
  assert.doesNotMatch(map.guideLine, /wrong|incorrect|score|behind|level|%|assess|struggl/i);
  assert.ok(map.guideLine.length < 90, "guide lines must stay readable at a glance");
});

test("the adult explanation names the evidence behind the choice", () => {
  const model = buildLearnerModel("kid", evidenceRun(14));
  const map = buildWorldMap(world(), model, recommendNextActivity(model));
  const summary = describeWorldDecision(map, model);
  assert.match(summary, /14 recorded answers/);
  assert.match(summary, new RegExp(map.beacon.label));
});
