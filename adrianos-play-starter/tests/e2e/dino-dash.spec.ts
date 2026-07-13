import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const GAME_SLUG = "dino-dash-volcano-escape";
const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";

async function gameProgress(page: import("@playwright/test").Page) {
  return page.evaluate(({ key, slug }) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    const row = progress.games?.[slug] ?? {};
    return {
      plays: Number(row.plays ?? 0),
      completions: Number(row.completions ?? 0),
      bestScore: Number(row.bestScore ?? 0),
    };
  }, { key: PROGRESS_KEY, slug: GAME_SLUG });
}

test.describe("Dino Dash: Volcano Escape", () => {
  test("starts on the first gate and advances without Start or Next buttons", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto(`/games/${GAME_SLUG}`, { waitUntil: "domcontentloaded" });

    const game = page.locator('[data-dino-dash="active"]');
    await expect(game).toHaveAttribute("data-dino-gate", "1");
    await expect(game).toHaveAttribute("data-dino-phase", "ready");
    await expect(page.getByRole("button", { name: /start|begin/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);

    await page.locator('[data-dino-answer][data-correct="false"]').first().click();
    await expect(game).toHaveAttribute("data-dino-gate", "1");
    await expect(game).toHaveAttribute("data-dino-shields", "2");
    await expect(game).toHaveAttribute("data-dino-phase", "ready", { timeout: 3000 });

    await page.locator('[data-dino-answer][data-correct="true"]').click();
    await expect(game).toHaveAttribute("data-dino-gate", "2", { timeout: 3000 });
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);
  });

  test("clears eight verified gates, records one completion, and replays cleanly", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto(`/games/${GAME_SLUG}`, { waitUntil: "domcontentloaded" });

    const game = page.locator('[data-dino-dash="active"]');
    await expect.poll(async () => (await gameProgress(page)).plays).toBe(1);

    for (let gate = 1; gate <= 8; gate += 1) {
      await expect(game).toHaveAttribute("data-dino-gate", String(gate));
      await page.locator('[data-dino-answer][data-correct="true"]').click();
      if (gate < 8) {
        await expect(game).toHaveAttribute("data-dino-gate", String(gate + 1), { timeout: 3500 });
      }
    }

    await expect(page.locator('[data-dino-complete="true"]')).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole("heading", { name: "Volcano escaped!" })).toBeVisible();
    await expect.poll(() => gameProgress(page)).toMatchObject({
      plays: 1,
      completions: 1,
    });
    expect((await gameProgress(page)).bestScore).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(page.locator('[data-dino-dash="active"]')).toHaveAttribute("data-dino-gate", "1");
    await expect.poll(() => gameProgress(page)).toMatchObject({
      plays: 2,
      completions: 1,
    });
  });

  test("uses the learner grade and stays playable on a phone", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/games/${GAME_SLUG}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/Grade 5 · 5\.NBT/)).toBeVisible();
    await expect(page.locator('[data-dino-answer]')).toHaveCount(3);
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
