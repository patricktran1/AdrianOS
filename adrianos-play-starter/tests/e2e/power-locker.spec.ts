import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

async function seedFourClears(page: Page) {
  await page.evaluate((progressKey) => {
    const now = new Date().toISOString();
    window.localStorage.setItem(progressKey, JSON.stringify({
      xp: 240,
      coins: 12,
      level: 2,
      games: {
        "story-expedition": { plays: 1, completions: 1, bestScore: 400, lastPlayed: now, lastCompleted: now },
        "math-motion-lab": { plays: 1, completions: 1, bestScore: 500, lastPlayed: now, lastCompleted: now },
        "dino-dash": { plays: 1, completions: 1, bestScore: 800, lastPlayed: now, lastCompleted: now },
        "daily-adventure-remix": { plays: 1, completions: 1, bestScore: 650, lastPlayed: now, lastCompleted: now },
      },
      activity: [],
    }));
    window.dispatchEvent(new Event("adrianos-progress-updated"));
  }, PROGRESS_KEY);
}

test.describe("Prize Vault Power Locker", () => {
  test("equips an unlocked prize and brings it into every game", async ({ page, context }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await seedFourClears(page);

    const vault = page.getByRole("region", { name: "Prize Vault" });
    await expect(vault).toHaveAttribute("data-power-locker", "active");
    await expect(vault.locator('[data-power-locker-active="Blue Gem"]')).toBeVisible();
    await expect(vault.getByRole("button", { name: "Equip Dragon Egg as game companion" })).toBeVisible();
    await expect(vault.getByRole("button", { name: "Equip Fire Spark as game companion" })).toBeVisible();
    await expect(vault.getByRole("button", { name: "Equip Castle Key as game companion" })).toBeVisible();
    await expect(vault.getByRole("button", { name: "Blue Gem is your active game companion" })).toBeVisible();
    await expect(vault.getByRole("button", { name: /Tiny Crown/ })).toHaveCount(0);

    const before = await page.evaluate((progressKey) => window.localStorage.getItem(progressKey), PROGRESS_KEY);
    await vault.getByRole("button", { name: "Equip Dragon Egg as game companion" }).click();
    await expect(vault.locator('[data-power-locker-active="Dragon Egg"]')).toBeVisible();

    await expect.poll(async () => page.evaluate((learningKey) => {
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const item = learning.reviewQueue?.find((row: { gameSlug?: string; id?: string }) =>
        row.gameSlug === "adrianos-power-locker" && row.id === "power-locker-state"
      );
      return {
        key: item?.data?.equippedPrizeKey ?? "",
        name: item?.data?.equippedPrizeName ?? "",
        profileSetting: item?.data?.profileSetting ?? false,
      };
    }, LEARNING_KEY)).toEqual({ key: "2:0", name: "Dragon Egg", profileSetting: true });

    const after = await page.evaluate((progressKey) => window.localStorage.getItem(progressKey), PROGRESS_KEY);
    expect(after).toBe(before);

    const gamePage = await context.newPage();
    await gamePage.goto("/games/dinosaur-detective", { waitUntil: "domcontentloaded" });
    const companion = gamePage.locator('[data-power-locker-companion="Dragon Egg"]');
    await expect(companion).toHaveAttribute("data-power-locker-ready", "true");
    await expect(companion).toHaveAttribute("data-power-locker-aura", "spark");
    await expect(gamePage.getByLabel("Dragon Egg, active game companion")).toBeVisible();

    await gamePage.getByRole("button", { name: /Tyrannosaurus rex$/ }).click();
    await expect(companion).toHaveAttribute("data-power-locker-reaction", "cheer");
    await gamePage.close();
  });

  test("keeps the companion and locker phone-safe", async ({ page, context }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await seedFourClears(page);

    const vault = page.getByRole("region", { name: "Prize Vault" });
    await expect(vault.locator('[data-power-locker-active="Blue Gem"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });

    const gamePage = await context.newPage();
    await gamePage.setViewportSize({ width: 390, height: 844 });
    await gamePage.goto("/games/dino-dash", { waitUntil: "domcontentloaded" });
    await expect(gamePage.locator('[data-power-locker-companion="Blue Gem"]')).toBeVisible();
    await expect.poll(async () => gamePage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
    await gamePage.close();
  });
});
