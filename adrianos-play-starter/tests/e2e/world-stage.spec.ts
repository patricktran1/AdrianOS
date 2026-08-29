import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };
const LANDSCAPE_PHONE = { width: 844, height: 390 };
const DESKTOP = { width: 1280, height: 860 };

type ProgressSeed = { slug: string; plays: number; completions: number };

async function seedWorld(
  page: Page,
  options: {
    grade?: number;
    age?: number;
    games?: ProgressSeed[];
    coins?: number;
    schoolMode?: boolean;
    evidence?: unknown[];
  } = {}
) {
  // Seeded once per browser context rather than on every navigation, so a
  // reload can prove that world state actually persisted.
  await page.addInitScript((seed) => {
    const MARKER = "adrianos-world-spec-seeded";
    if (window.localStorage.getItem(MARKER) === "yes") return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(MARKER, "yes");
    window.localStorage.setItem("adrianos-family-v1", JSON.stringify({
      activeProfileId: "qa-learner",
      profiles: [{
        id: "qa-learner",
        name: "QA Learner",
        age: seed.age ?? 7,
        emoji: "\u2b50",
        createdAt: "2026-07-12T00:00:00.000Z",
      }],
      parentPinHash: null,
    }));
    window.localStorage.setItem("adrianos-family-customized-v1", "yes");

    const reviewQueue: unknown[] = [{
      id: "profile-grade",
      gameSlug: "adrianos-grade-profile",
      skillId: "profile-grade",
      subject: "Learning Skills",
      prompt: "Parent-selected elementary curriculum grade",
      correctAnswer: "",
      dueAt: "9999-12-31T23:59:59.999Z",
      updatedAt: "2026-07-12T00:00:00.000Z",
      successes: 0,
      status: "resolved",
      data: { grade: seed.grade ?? 2, profileSetting: true, elementaryScope: true },
    }];

    const games: Record<string, unknown> = {};
    for (const row of seed.games ?? []) {
      games[row.slug] = {
        plays: row.plays,
        completions: row.completions,
        bestScore: 90,
        lastPlayed: new Date().toISOString(),
        lastCompleted: row.completions > 0 ? new Date().toISOString() : null,
      };
    }
    const clears = (seed.games ?? []).reduce((sum, row) => sum + row.completions, 0);
    window.localStorage.setItem("adrianos-progress-v2:qa-learner", JSON.stringify({
      xp: clears * 60,
      coins: seed.coins ?? clears * 12,
      level: Math.floor((clears * 60) / 200) + 1,
      games,
      activity: [],
    }));
    if (seed.evidence) {
      window.localStorage.setItem(
        "adrianos-evidence-v1:qa-learner",
        JSON.stringify(seed.evidence)
      );
    }
    if (seed.schoolMode === false) {
      // Turning School Mode off leaves the learner model in charge of the beacon.
      reviewQueue.push({
          id: "learning-schedule",
          gameSlug: "adrianos-learning-schedule",
          skillId: "learning-schedule",
          subject: "Learning Skills",
          prompt: "Weekly learning schedule",
          correctAnswer: "",
          dueAt: "9999-12-31T23:59:59.999Z",
          updatedAt: new Date().toISOString(),
          successes: 0,
          status: "resolved",
          data: {
            scheduleJson: JSON.stringify({
              version: 1,
              days: {
                monday: "full", tuesday: "full", wednesday: "full", thursday: "full",
                friday: "full", saturday: "light", sunday: "free",
              },
              fullMinutes: 12,
              lightMinutes: 6,
              schoolMode: false,
              libraryAfterSession: true,
              updatedAt: new Date().toISOString(),
            }),
          },
      });
    }

    window.localStorage.setItem(
      "adrianos-learning-v1:qa-learner",
      JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), skills: {}, reviewQueue })
    );
  }, options);
}

function evidenceRow(overrides: Record<string, unknown>, index: number) {
  return {
    at: new Date(Date.UTC(2026, 7, 1, 9, index)).toISOString(),
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "In 147, what digit is in the tens place?",
    correctAnswer: "4",
    givenAnswer: "4",
    correct: true,
    responseMs: 3200,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
    ...overrides,
  };
}

async function assertNoScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - window.innerHeight,
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.vertical, "the world must fit one viewport").toBeLessThanOrEqual(2);
  expect(overflow.horizontal, "the world must not scroll sideways").toBeLessThanOrEqual(2);
}

test.describe("the AdrianOS world", () => {
  test("opens as one screen with a single obvious target", async ({ page }) => {
    await seedWorld(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const stage = page.locator('[data-world-stage="active"]');
    await expect(stage).toBeVisible();
    await assertNoScroll(page);

    // Exactly one beacon, and it is visibly the largest target on the map.
    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toHaveCount(1);
    const beaconBox = await beacon.boundingBox();
    const others = page.locator('[data-world-landmark][data-beacon="false"]');
    await expect(others).toHaveCount(4);
    const otherBox = await others.first().boundingBox();
    expect(beaconBox?.width ?? 0).toBeGreaterThan(otherBox?.width ?? 0);

    // The guide speaks in child language, never assessment language.
    const guide = page.locator('[data-world-guide="true"]');
    await expect(guide).toBeVisible();
    expect(await guide.innerText()).not.toMatch(/score|wrong|incorrect|behind|assess|%/i);

    // A whole home screen of choices, not a wall of them.
    const controls = await page.locator("button, a").count();
    expect(controls, "the home screen must stay legible to a young child").toBeLessThan(20);
  });

  test("reaches gameplay in one tap from a cold open", async ({ page }) => {
    await seedWorld(page, { schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toBeVisible();
    await beacon.click();

    await expect(page).toHaveURL(/\/games\//);
    await expect(page.locator('[data-game-feel-shell="active"]')).toBeVisible();
  });

  test("places keep their position and name while the activity there changes", async ({ page }) => {
    await seedWorld(page, { schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const before = await page.locator('[data-world-landmark="boss"]').boundingBox();
    const label = await page.locator('[data-world-landmark="boss"]').innerText();
    expect(label).toContain("Power Peak");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-landmark="boss"]')).toBeVisible();
    const after = await page.locator('[data-world-landmark="boss"]').boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(2);
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
  });

  test("a repeated wrong answer moves the beacon onto that skill", async ({ page }) => {
    // Fluent everywhere except place value, where the same wrong answer repeats.
    const evidence = [
      ...Array.from({ length: 8 }, (_, index) =>
        evidenceRow({ gameSlug: "adaptive-boss-arena" }, index)
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        evidenceRow(
          { gameSlug: "adaptive-boss-arena", correct: false, givenAnswer: "7" },
          8 + index
        )
      ),
    ];
    await seedWorld(page, { schoolMode: false, evidence });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const stage = page.locator('[data-world-stage="active"]');
    await expect(stage).toHaveAttribute("data-world-intent", "reteach");
    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toContainText("Adaptive Boss Arena");
  });

  test("with no evidence the world leads with somewhere new rather than a diagnosis", async ({ page }) => {
    await seedWorld(page, { schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toHaveAttribute(
      "data-world-intent",
      "explore"
    );
  });

  test("a planned session mission becomes the beacon and starts in one tap", async ({ page }) => {
    await seedWorld(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toBeVisible();
    await beacon.click();

    // Straight into guided play: no school screen, no mission list, no confirm.
    await expect(page).toHaveURL(/guided=1/);
    await expect(page).toHaveURL(/school=1/);
  });

  test("a world with no verified clears is built of nothing", async ({ page }) => {
    await seedWorld(page, { games: [] });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toBeVisible();
    expect(await page.locator('[class*="structure"]').count()).toBe(0);
  });

  test("each verified clear adds exactly one structure to the world", async ({ page }) => {
    await seedWorld(page, {
      games: [
        // Four completions across two games, plus plays that must not count.
        { slug: "number-quest", plays: 9, completions: 2 },
        { slug: "memory-match", plays: 7, completions: 2 },
      ],
    });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[class*="structure"]')).toHaveCount(4);
  });

  test("finishing a game announces the new treasure in the world", async ({ page }) => {
    await seedWorld(page, { games: [{ slug: "number-quest", plays: 2, completions: 1 }] });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const celebration = page.locator('[data-world-celebration="true"]');
    await expect(celebration).toBeVisible();
    await expect(celebration).toContainText("Dragon Egg");
    await celebration.click();
    await expect(celebration).toBeHidden();

    // It celebrates once. A reload must not replay the same unlock.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toBeVisible();
    await expect(page.locator('[data-world-celebration="true"]')).toHaveCount(0);
  });

  test("an unlocked treasure can be equipped and travels into every game", async ({ page }) => {
    await seedWorld(page, {
      games: [
        { slug: "number-quest", plays: 6, completions: 3 },
        { slug: "memory-match", plays: 3, completions: 1 },
      ],
    });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const celebration = page.locator('[data-world-celebration="true"]');
    if (await celebration.isVisible()) await celebration.click();

    await page.getByRole("button", { name: /Collection/ }).click();
    const vault = page.locator('[data-power-locker="active"]');
    await expect(vault).toBeVisible();
    await expect(vault.locator('[data-power-locker-prize="2:0"]')).toBeVisible();
    await expect(vault.locator('[data-power-locker-prize="2:3"][data-locked="false"]')).toBeVisible();
    await expect(vault.locator('[data-power-locker-prize="2:4"][data-locked="true"]')).toBeVisible();

    await vault.locator('[data-power-locker-prize="2:0"]').click();
    await expect(vault.locator('[data-power-locker-prize="2:0"][data-power-locker-selected="true"]'))
      .toBeVisible();
    await expect(page.locator('[data-power-locker-active="Dragon Egg"]')).toBeVisible();

    await page.goto("/games/memory-match", { waitUntil: "domcontentloaded" });
    const companion = page.locator('[data-power-locker-companion="Dragon Egg"]');
    await expect(companion).toHaveAttribute("data-power-locker-ready", "true");
  });

  test("every place is reachable and can be favourited from one sheet", async ({ page }) => {
    await seedWorld(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /All places/ }).click();
    const sheet = page.locator('[data-world-sheet="places"]');
    await expect(sheet).toBeVisible();

    const memoryMatch = sheet.locator('[data-game-slug="memory-match"]');
    await expect(memoryMatch).toBeVisible();

    const star = sheet.locator('[data-favorite-slug="memory-match"]');
    await expect(star).toHaveAttribute("data-favorite", "false");
    await star.click();
    await expect(star).toHaveAttribute("data-favorite", "true");

    // A favourite leads the list so it is findable without hunting.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /All places/ }).click();
    const firstTile = page.locator('[data-world-sheet="places"] [data-game-slug]').first();
    await expect(firstTile).toHaveAttribute("data-game-slug", "memory-match");

    await firstTile.click();
    await expect(page).toHaveURL(/\/games\/memory-match/);
  });

  test("a found secret pays out once and stays found", async ({ page }) => {
    await seedWorld(page, { schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const secrets = page.locator('[data-world-secret="true"]');
    await expect(secrets).toHaveCount(3);
    await secrets.first().click();
    await expect(page.getByRole("status")).toContainText("Secret found");
    await expect(secrets).toHaveCount(2);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-secret="true"]')).toHaveCount(2);

    await page.locator('[data-world-me="true"]').click();
    await expect(page.locator('[data-world-sheet="me"]')).toContainText("5");
  });

  test("the whole world is reachable by keyboard, beacon first", async ({ page }) => {
    await seedWorld(page, { schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.locator('[data-world-me="true"]')).toBeFocused();

    // Tab forward until a landmark takes focus; the beacon must be the first one.
    let landmark: string | null = null;
    for (let step = 0; step < 12 && landmark === null; step += 1) {
      await page.keyboard.press("Tab");
      landmark = await page.evaluate(() =>
        document.activeElement?.getAttribute("data-beacon") ?? null
      );
    }
    expect(landmark).toBe("true");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/games\//);
  });

  test("a sheet closes with Escape and with the backdrop", async ({ page }) => {
    await seedWorld(page);
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.locator('[data-world-me="true"]').click();
    await expect(page.locator('[data-world-sheet="me"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-world-sheet="me"]')).toHaveCount(0);

    await page.locator('[data-world-me="true"]').click();
    await expect(page.locator('[data-world-sheet="me"]')).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator('[data-world-sheet="me"]')).toHaveCount(0);
  });

  test("reduced motion stops the world animating", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: DESKTOP,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await seedWorld(page, { games: [{ slug: "number-quest", plays: 4, completions: 2 }] });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toHaveAttribute(
      "data-reduced-motion",
      "true"
    );

    const animated = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll('[data-world-landmark][data-beacon="true"] span'),
        ...document.querySelectorAll('[class*="structure"]'),
        ...document.querySelectorAll('[data-world-secret="true"]'),
      ];
      return nodes.filter((node) =>
        getComputedStyle(node).animationName !== "none"
      ).length;
    });
    expect(animated, "reduced motion must silence the world's ambient animation").toBe(0);
    await context.close();
  });

  test("adult chrome never floats over the child's world", async ({ page }) => {
    await seedWorld(page);
    await page.setViewportSize(PHONE);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toBeVisible();
    await page.waitForTimeout(2200);

    await expect(page.getByRole("button", { name: "Parent feedback" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "AdrianOS navigation" })).toHaveCount(0);
    await expect(page.getByText("Put AdrianOS on this device")).toHaveCount(0);

    // The grown-up door is present, small, and goes somewhere gated.
    const door = page.getByRole("button", { name: "Grown-up area" });
    await expect(door).toBeVisible();
    const box = await door.boundingBox();
    expect(box?.width ?? 0).toBeLessThan(60);
    await door.click();
    await expect(page).toHaveURL(/\/parent/);
    await expect(page.getByRole("heading", { name: /parent PIN/i })).toBeVisible();
  });

  for (const [name, viewport] of [
    ["phone portrait", PHONE],
    ["phone landscape", LANDSCAPE_PHONE],
    ["tablet", TABLET],
    ["desktop", DESKTOP],
  ] as const) {
    test(`fits ${name} without scrolling`, async ({ page }) => {
      await seedWorld(page, {
        games: [
          { slug: "number-quest", plays: 8, completions: 4 },
          { slug: "memory-match", plays: 6, completions: 3 },
          { slug: "math-blast", plays: 4, completions: 2 },
        ],
      });
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-world-stage="active"]')).toBeVisible();
      const celebration = page.locator('[data-world-celebration="true"]');
      if (await celebration.isVisible()) await celebration.click();
      await assertNoScroll(page);

      // Every travel control stays inside the viewport and stays tappable.
      for (const selector of ['[data-world-landmark]', '[class*="railButton"]']) {
        const nodes = page.locator(selector);
        const count = await nodes.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index += 1) {
          const box = await nodes.nth(index).boundingBox();
          expect(box, `${selector}#${index} should be laid out`).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(-1);
          expect(box!.y).toBeGreaterThanOrEqual(-1);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
          expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(40);
        }
      }
    });
  }

  test("TK sees an age-appropriate world with the same one-tap route in", async ({ page }) => {
    await seedWorld(page, { grade: -1, age: 4, schoolMode: false });
    await page.setViewportSize(PHONE);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-world-stage="active"]')).toBeVisible();
    await assertNoScroll(page);
    await page.getByRole("button", { name: /Collection/ }).click();
    await expect(page.locator('[data-world-sheet="collection"]')).toContainText("Critter Parade");
    await page.keyboard.press("Escape");

    await page.locator('[data-world-landmark][data-beacon="true"]').click();
    await expect(page).toHaveURL(/\/games\//);
  });

  test("Grade 5 gets its own collection and world without extra taps", async ({ page }) => {
    await seedWorld(page, { grade: 5, age: 10, schoolMode: false });
    await page.setViewportSize(DESKTOP);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Collection/ }).click();
    await expect(page.locator('[data-world-sheet="collection"]')).toContainText(
      "Cyber City Artifact Grid"
    );
  });
});
