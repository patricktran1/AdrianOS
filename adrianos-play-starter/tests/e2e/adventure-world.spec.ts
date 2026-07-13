import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

const gameRow = (completions: number) => ({
  plays: Math.max(1, completions),
  completions,
  bestScore: completions > 0 ? 100 : 0,
  lastPlayed: "2026-07-13T08:00:00.000Z",
  lastCompleted: completions > 0 ? "2026-07-13T08:00:00.000Z" : null,
});

async function seedWorld(page: Page, clears: number) {
  await page.addInitScript(({ clears, progressKey, learningKey }) => {
    const slugs = [
      "math-blast",
      "reading-lab",
      "science-quest",
      "dino-dash-volcano-escape",
      "memory-match",
      "word-forge-studio",
      "dino-habitat-builder",
      "story-expedition",
      "adaptive-boss-arena",
      "solar-system-explorer",
      "music-maker",
      "dinosaur-detective",
    ];
    const games: Record<string, unknown> = {};
    for (let index = 0; index < clears; index += 1) {
      const slug = slugs[index % slugs.length];
      const current = games[slug] as { completions?: number } | undefined;
      const completions = Number(current?.completions ?? 0) + 1;
      games[slug] = {
        plays: completions,
        completions,
        bestScore: 100 + completions,
        lastPlayed: "2026-07-13T08:00:00.000Z",
        lastCompleted: "2026-07-13T08:00:00.000Z",
      };
    }
    window.localStorage.setItem(progressKey, JSON.stringify({
      xp: clears * 50,
      coins: clears * 10,
      level: 1,
      games,
      activity: [],
    }));

    const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
    const queue = Array.isArray(learning.reviewQueue) ? learning.reviewQueue : [];
    const keep = queue.filter((row: { gameSlug?: string; id?: string }) =>
      !(row.gameSlug === "adrianos-learning-profile" && row.id === "learner-profile-settings")
      && !(row.gameSlug === "adrianos-power-locker" && row.id === "power-locker-state")
    );
    window.localStorage.setItem(learningKey, JSON.stringify({
      ...learning,
      skills: learning.skills ?? {},
      dailyAdventure: learning.dailyAdventure ?? null,
      reviewQueue: [
        ...keep,
        {
          id: "learner-profile-settings",
          gameSlug: "adrianos-learning-profile",
          skillId: "learner-profile",
          subject: "Learning Skills",
          prompt: "Parent-selected learner interests and priorities",
          correctAnswer: "",
          dueAt: "9999-12-31T23:59:59.999Z",
          updatedAt: "2026-07-13T08:00:00.000Z",
          successes: 0,
          status: "resolved",
          data: {
            learnerProfile: true,
            interestsJson: JSON.stringify(["Dinosaurs", "Building", "Stories"]),
            prioritiesJson: JSON.stringify(["Math", "Reading"]),
            sessionMinutes: 12,
            updatedAt: "2026-07-13T08:00:00.000Z",
          },
        },
        {
          id: "power-locker-state",
          gameSlug: "adrianos-power-locker",
          skillId: "profile-customization",
          subject: "Creativity",
          prompt: "Selected cosmetic companion for AdrianOS games",
          correctAnswer: "",
          dueAt: "9999-12-31T23:59:59.999Z",
          updatedAt: "2026-07-13T08:00:00.000Z",
          successes: 0,
          status: "resolved",
          data: {
            equippedPrizeKey: "2:0",
            equippedPrizeName: "Dragon Egg",
            equippedPrizeEmoji: "🥚",
            companionAura: "spark",
            profileSetting: true,
            syncedPowerLocker: true,
          },
        },
      ],
    }));
  }, { clears, progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY });
}

async function progressSnapshot(page: Page): Promise<string> {
  return page.evaluate((key) => window.localStorage.getItem(key) ?? "", PROGRESS_KEY);
}

test.describe("living Adventure World", () => {
  test("turns real clears, interests, and the equipped companion into a playable world", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedWorld(page, 4);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const world = page.getByRole("region", { name: "QA Learner's Adventure World" });
    await expect(world).toHaveAttribute("data-adventure-world", "active");
    await expect(world.getByRole("heading", { name: "Jurassic Junction" })).toBeVisible();
    await expect(world).toHaveAttribute("data-world-stage", "2");
    await expect(world).toHaveAttribute("data-world-growth", "4");
    await expect(world.locator("[data-world-growth-piece]")).toHaveCount(4);

    const portals = world.locator("[data-world-portal]");
    await expect(portals).toHaveCount(5);
    const games = await portals.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-world-game") ?? ""),
    );
    expect(new Set(games).size).toBe(5);
    expect(games).toContain("dino-habitat-builder");

    const companion = world.locator("[data-world-companion]");
    await expect(companion).toHaveAttribute("data-world-companion", "Dragon Egg");
    const firstScout = await companion.getAttribute("data-world-scout");
    await companion.click();
    await expect.poll(() => companion.getAttribute("data-world-scout")).not.toBe(firstScout);
    await expect(world.getByText(/is glowing\. Let’s go!/)).toBeVisible();

    const hero = world.locator("[data-world-hero-game]");
    const heroSlug = await hero.getAttribute("data-world-hero-game");
    expect(heroSlug).toBeTruthy();
    await hero.click();
    await expect(page).toHaveURL(new RegExp(`/games/${heroSlug}\\?from=adventure-world&portal=`));
  });

  test("keeps sky changes and hidden secrets purely cosmetic", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedWorld(page, 2);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const before = await progressSnapshot(page);
    const world = page.getByRole("region", { name: "QA Learner's Adventure World" });
    const skyBefore = await world.locator("[data-world-sky]").getAttribute("data-world-sky");
    await world.getByRole("button", { name: /Change the sky/i }).click();
    await expect.poll(() => world.locator("[data-world-sky]").getAttribute("data-world-sky")).not.toBe(skyBefore);

    const secrets = world.locator("[data-world-secret]");
    await expect(secrets).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) await secrets.nth(index).click();
    await expect(world.locator("[data-world-secret-celebration=true]")).toBeVisible();
    await expect(world.getByText("Pure explorer glory. No fake XP or mastery.", { exact: true })).toBeVisible();
    expect(await progressSnapshot(page)).toBe(before);
  });

  test("starts alive at zero clears, grows only from verified history, and stays phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedWorld(page, 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const world = page.getByRole("region", { name: "QA Learner's Adventure World" });
    await expect(world).toHaveAttribute("data-world-stage", "0");
    await expect(world).toHaveAttribute("data-world-growth", "0");
    await expect(world.locator("[data-world-growth-piece]")).toHaveCount(0);
    await expect(world.getByText("Your world is awake and every portal is ready.", { exact: true })).toBeVisible();
    await expect(world.locator("[data-world-portal]")).toHaveCount(5);

    const companionAnimation = await world.locator("[data-world-companion]").evaluate((element) =>
      getComputedStyle(element.querySelector("span[class*='companionEmoji']") as Element).animationName,
    );
    expect(companionAnimation).toBe("none");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(await progressSnapshot(page)).toContain('"games":{}');
  });
});
