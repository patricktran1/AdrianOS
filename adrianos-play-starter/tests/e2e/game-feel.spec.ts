import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

test.describe("AdrianOS game feel engine", () => {
  test("gives a flagship world its own animated identity and tactile controls", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dino-time-rescue", { waitUntil: "domcontentloaded" });

    const shell = page.locator('[data-game-feel-shell="active"]');
    await expect(shell).toHaveAttribute("data-game-slug", "dino-time-rescue");
    await expect(shell).toHaveAttribute("data-game-theme", "dino");
    await expect(page.locator(".game-feel-world-ribbon")).toContainText("DINO TIME RESCUE");
    await expect(page.locator(".game-feel-token")).toHaveCount(6);

    const firstControl = page.locator(".game-stage button:not([disabled])").first();
    await expect(firstControl).toBeVisible();
    await firstControl.click();
    await expect(page.locator(".game-feel-burst")).toBeVisible();
  });

  test("turns verified progress into visible XP, coin, and quest-clear feedback", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });
    const shell = page.locator('[data-game-feel-shell="active"]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("data-game-feel-ready", "true");

    await page.evaluate(({ progressKey }) => {
      const now = new Date().toISOString();
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 40,
        coins: 5,
        level: 1,
        games: {
          "story-expedition": {
            plays: 1,
            completions: 1,
            bestScore: 100,
            lastPlayed: now,
            lastCompleted: now,
          },
        },
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, { progressKey: PROGRESS_KEY });

    await expect(page.locator(".game-feel-celebration")).toContainText("Quest clear!");
    await expect(page.locator(".game-feel-reward").filter({ hasText: "+40 XP" })).toBeVisible();
    await expect(page.locator(".game-feel-reward").filter({ hasText: "+5 coins" })).toBeVisible();
  });

  test("keeps animated game worlds phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });

    const shell = page.locator('[data-game-feel-shell="active"]');
    await expect(shell).toHaveAttribute("data-game-theme", "daily");
    await expect(page.locator(".game-feel-world-ribbon")).toBeHidden();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("respects reduced-motion preferences", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/space-station-sigma", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-game-theme="space"]')).toBeVisible();
    await expect(page.locator(".game-feel-token").first()).toBeHidden();
    await expect(page.locator(".game-feel-orbit")).toBeHidden();
  });
});
