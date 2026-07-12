import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const SETTINGS_KEY = "adrianos-play-settings-v1";

test.describe("AdrianOS game power loop", () => {
  test("persists play settings in a fresh game page", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dino-time-rescue", { waitUntil: "domcontentloaded" });

    const controls = page.locator('[data-game-power-loop="active"]');
    await expect(controls).toHaveAttribute("data-power-ready", "true");
    await expect(controls).toHaveAttribute("data-sfx-enabled", "true");

    await page.getByRole("button", { name: "Play settings", exact: true }).click();
    await page.getByRole("button", { name: /Sound effects/ }).click();
    await expect(controls).toHaveAttribute("data-sfx-enabled", "false");
    await expect.poll(async () => page.evaluate((key) => {
      const value = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return value.sfx;
    }, SETTINGS_KEY)).toBe(false);

    const freshPage = await page.context().newPage();
    await freshPage.goto("/games/dino-time-rescue", { waitUntil: "domcontentloaded" });
    await expect(freshPage.locator('[data-game-power-loop="active"]')).toHaveAttribute("data-power-ready", "true");
    await expect(freshPage.locator('[data-game-power-loop="active"]')).toHaveAttribute("data-sfx-enabled", "false");
    await freshPage.close();
  });

  test("builds a visible power streak from consecutive correct answers", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (pattern: number | number[]) => {
          window.localStorage.setItem("qa-last-vibration", JSON.stringify(pattern));
          return true;
        },
      });
    });
    await page.goto("/games/mastery-rescue-lab", { waitUntil: "domcontentloaded" });

    const controls = page.locator('[data-game-power-loop="active"]');
    await expect(controls).toHaveAttribute("data-power-ready", "true");
    await page.getByRole("button", { name: "Start the rescue →", exact: true }).click();

    await page.getByRole("button", { name: "45", exact: true }).click();
    await expect(controls).toHaveAttribute("data-power-streak", "1");
    await expect(controls).toHaveAttribute("data-last-feedback", "correct");
    await page.getByRole("button", { name: "Next rematch →", exact: true }).click();

    await page.getByRole("button", { name: "45", exact: true }).click();
    await expect(controls).toHaveAttribute("data-power-streak", "2");
    await expect(page.locator(".game-power-streak")).toContainText("2× POWER STREAK");
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("qa-last-vibration"))).not.toBeNull();
  });

  test("turns a verified completion into an immediate level and prize reveal", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });

    const controls = page.locator('[data-game-power-loop="active"]');
    await expect(controls).toHaveAttribute("data-power-ready", "true");

    await page.evaluate(({ progressKey }) => {
      const now = new Date().toISOString();
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 210,
        coins: 8,
        level: 2,
        games: {
          "story-expedition": {
            plays: 1,
            completions: 1,
            bestScore: 500,
            lastPlayed: now,
            lastCompleted: now,
          },
        },
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, { progressKey: PROGRESS_KEY });

    const moment = page.locator('[data-power-moment="active"]');
    await expect(moment).toContainText("POWER-UP + PRIZE");
    await expect(moment).toContainText("Level 2 + Dragon Egg!");
    await expect(moment).toContainText("Dragon Treasure Hoard");
    await expect(controls).toHaveAttribute("data-last-feedback", "level");
  });

  test("keeps the power controls phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-game-power-loop="active"]')).toBeVisible();
    await page.getByRole("button", { name: "Play settings", exact: true }).click();
    await expect(page.getByLabel("Play settings panel")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
