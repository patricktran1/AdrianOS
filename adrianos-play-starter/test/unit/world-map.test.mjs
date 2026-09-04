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
  const map = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL), [], new Date(2026, 7, 1, 13));
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
  // Spelling has no alternate kernel verb, so fluency here is a true stretch
  // rather than a transfer opportunity.
  const model = buildLearnerModel("kid", evidenceRun(16, {
    gameSlug: "word-forge-studio",
    subject: "Reading",
    skillId: "spelling-grade-2",
    skillLabel: "Word construction",
    prompt: "Build the word.",
    correctAnswer: "train",
    givenAnswer: "train",
  }));
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "stretch");

  // No place hosts word-forge-studio, so the subject match wins: Mystery
  // Grove is currently running a Reading game, which is the fluent subject.
  const map = buildWorldMap(world(), model, next);
  assert.equal(map.beacon.portal.id, "mystery");
  assert.equal(map.beacon.portal.game.subject, "Reading");
});

test("a transfer beacon carries the skill-parameterised kernel route", () => {
  // Fluent place value shown only by choosing answers: the model wants the
  // same skill built by hand, and Maker Bay happens to host Maker Workshop.
  const model = buildLearnerModel("kid", evidenceRun(16, { responseMs: 2600 }));
  const next = recommendNextActivity(model);
  assert.equal(next.intent, "transfer");

  const portals = TRAIL_ORDER.map((id) =>
    id === "build"
      ? portal(id, {
          game: {
            slug: "maker-workshop", title: "Maker Workshop", subject: "Math", emoji: "🧱",
            description: "", age: "Ages 4–11", status: "playable",
          },
          href: "/games/maker-workshop?from=adventure-world&portal=build",
        })
      : portal(id)
  );
  const map = buildWorldMap(world({ portals, heroPortal: portals[0] }), model, next);
  assert.equal(map.intent, "transfer");
  assert.equal(map.beacon.portal.game.slug, "maker-workshop");
  assert.equal(map.beacon.href, "/games/maker-workshop?skill=math-place-value&from=transfer");
  // Guide language stays a child's invitation, not an assessment.
  assert.doesNotMatch(map.guideLine, /transfer|mechanic|evidence|context|assess/i);

  // The destination survives even when the portal is hosting a different
  // game: a place hosts whatever the session needs today.
  const elsewhere = buildWorldMap(world(), model, next);
  assert.equal(elsewhere.beacon.href, "/games/maker-workshop?skill=math-place-value&from=transfer");
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

test("the beacon carries the session's destination without moving the map", () => {
  // The world used to arbitrate between the learner model and a stored
  // playlist. There is one planner now, so whatever `next` names is simply
  // where the beacon leads.
  const model = buildLearnerModel("kid", evidenceRun(16, { responseMs: 2600 }));
  const next = recommendNextActivity(model);
  const plain = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  const routed = buildWorldMap(world(), model, next);

  assert.equal(routed.beacon.href, next.preferredHref);
  assert.equal(routed.guideLine, next.childReason);
  // The place name and its coordinates are untouched: the geography is stable
  // even when the activity waiting there changes.
  assert.equal(routed.landmarks.length, plain.landmarks.length);
  for (const landmark of routed.landmarks) {
    const same = plain.landmarks.find((row) => row.portal.id === landmark.portal.id);
    assert.equal(landmark.label, same.label);
    assert.deepEqual(landmark.wide, same.wide);
  }
  // Non-beacon landmarks keep their own destinations.
  for (const landmark of routed.landmarks.filter((row) => !row.beacon)) {
    assert.equal(landmark.href, landmark.portal.href);
  }
});

test("the world holds no second opinion about where to go", () => {
  // buildWorldMap takes the decision it is given. Anything that wants to
  // change the beacon has to change the plan, which is the point.
  const model = buildLearnerModel("kid", evidenceRun(16, { responseMs: 2600 }));
  const next = recommendNextActivity(model);
  const first = buildWorldMap(world(), model, next);
  const second = buildWorldMap(world(), model, next);
  assert.equal(first.beacon.href, second.beacon.href);
  assert.equal(first.beacon.portal.id, second.beacon.portal.id);
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

test("found glints disappear from the map", () => {
  const all = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL));
  assert.equal(all.glints.length, 3);
  const partial = buildWorldMap(world(), EMPTY_LEARNER_MODEL, recommendNextActivity(EMPTY_LEARNER_MODEL), [0, 2]);
  assert.equal(partial.glints.length, 1);
  assert.equal(partial.glints[0].emoji, "🦴");
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

test("the beacon is labelled with where it actually leads", () => {
  // A landmark hosts a rotating game. When the session routes past it, the
  // label has to say the destination, or a child taps "Stepping Stones" and
  // arrives somewhere else entirely.
  const next = {
    intent: "explore",
    skillId: null,
    skillLabel: null,
    subject: null,
    preferredSlugs: ["placement-adventure"],
    preferredHref: "/games/placement-adventure?first=1",
    childReason: "Let's find your starting point together.",
    adultReason: "A short check that tunes the first route.",
    difficultyShift: 0,
    hintStrategy: "on-request",
  };
  const unnamed = buildWorldMap(world(), EMPTY_LEARNER_MODEL, next);
  const named = buildWorldMap(
    world(), EMPTY_LEARNER_MODEL, next, [], undefined,
    (slug) => (slug === "placement-adventure" ? "Placement Adventure" : null)
  );
  assert.equal(named.beacon.href, "/games/placement-adventure?first=1");
  assert.equal(named.beacon.status, "Placement Adventure");
  // Without a resolver the map falls back to the hosted game rather than
  // inventing a name for a destination it does not recognise.
  assert.equal(unnamed.beacon.status, unnamed.beacon.portal.game.title);
});
