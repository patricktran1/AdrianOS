import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

async function start(page: import("@playwright/test").Page) {
  await page.goto("/games/adaptive-boss-arena", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Enter the arena →", exact: true }).click();
}

test.describe("Adaptive Boss Arena", () => {
  test("raises difficulty after an independent hit and records mastery evidence", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page);

    await expect(page.getByRole("heading", { name: "27 + 16 = ?" })).toBeVisible();
    await page.locator('button[data-correct="true"]').click();
    await page.getByRole("button", { name: "Next adaptive round →", exact: true }).click();

    await expect(page.getByText("ROUND 2 · POWER ATTACK", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Which detail proves the nest was safe?" })).toBeVisible();

    const skill = await page.evaluate((key) => {
      const learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return learning.skills?.["math-word-problems"];
    }, LEARNING_KEY);
    expect(skill?.attempts).toBe(1);
    expect(skill?.correct).toBe(1);
  });

  test("activates coach mode after a miss, records adaptive review evidence, and keeps the next round supported", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page);

    await page.locator('button[data-correct="false"]').first().click();
    await expect(page.getByText("COACH MODE", { exact: true })).toBeVisible();

    const reviewLevel = await page.evaluate((key) => {
      const learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return learning.reviewQueue?.find((row: { data?: { adaptiveLevel?: string } }) => row.data?.adaptiveLevel)?.data?.adaptiveLevel;
    }, LEARNING_KEY);
    expect(reviewLevel).toBe("easy");

    await page.locator('button[data-correct="true"]').click();
    await page.getByRole("button", { name: "Next adaptive round →", exact: true }).click();

    await expect(page.getByText("ROUND 2 · WARM-UP ATTACK", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "9 + 8 = ?" })).toBeVisible();
  });

  test("offers a meaningfully different TK arena with large phone tap targets", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/adaptive-boss-arena", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Critter Cloud Boss" })).toBeVisible();
    await page.getByRole("button", { name: "Enter the arena →", exact: true }).click();
    const box = await page.locator('button[data-correct="true"]').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(76);
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
