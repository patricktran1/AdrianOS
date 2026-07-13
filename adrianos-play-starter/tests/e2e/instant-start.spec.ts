import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

test.describe("Instant Start game entry", () => {
  test("turns a Quick Fun launch into an active Math Blast round without another tap", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-blast?from=quick-play&mood=quick", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-start-director="active"]');
    await expect(director).toHaveAttribute("data-instant-start-enabled", "true");
    await expect(director).toHaveAttribute("data-instant-start-target", /60-Second Blast/);
    await expect(director).toHaveAttribute("data-instant-start-state", "playing");

    await expect(page.getByRole("heading", { name: "Make math feel like a game." })).toHaveCount(0);
    await expect(page.getByText("Time", { exact: true })).toBeVisible();
    await expect(page.getByText("60s", { exact: true })).toBeVisible();

    await expect.poll(async () => page.evaluate((key) => {
      const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return progress.games?.["math-blast"]?.plays ?? 0;
    }, PROGRESS_KEY)).toBe(1);
  });

  test("keeps the normal game menu when Math Blast is opened manually", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-blast", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-start-director="active"]');
    await expect(director).toHaveAttribute("data-instant-start-enabled", "false");
    await expect(page.getByRole("heading", { name: "Make math feel like a game." })).toBeVisible();

    const plays = await page.evaluate((key) => {
      const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return progress.games?.["math-blast"]?.plays ?? 0;
    }, PROGRESS_KEY);
    expect(plays).toBe(0);
  });

  test("does not press an answer when a game already opens directly into play", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dinosaur-detective?from=quick-play&mood=adventure", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-start-director="active"]');
    await expect(director).toHaveAttribute("data-instant-start-enabled", "true");
    await expect(director).toHaveAttribute("data-instant-start-state", "playing", { timeout: 5_000 });
    await expect(page.getByText("Case 1 of 6", { exact: true })).toBeVisible();
    await expect(page.getByText("Score 0", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tyrannosaurus rex/ })).toBeEnabled();
    await expect(page.locator(".game-feel-correct, .game-feel-retry")).toHaveCount(0);
  });

  test("keeps the instant-start overlay phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/math-blast?from=quick-play&mood=quick", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-game-start-director="active"]')).toHaveAttribute("data-instant-start-state", "playing");
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
