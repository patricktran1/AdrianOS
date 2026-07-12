import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Grade 4 Mystery Temple", () => {
  test("teaches after a miss, clears a branching route, and records evidence", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 4 });
    await page.goto("/games/mystery-temple", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "The Mystery Temple has awakened." })).toBeVisible();
    await page.getByRole("button", { name: /Sun Compass/ }).click();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Enter the temple →" }).click();

    await page.getByRole("button", { name: /Fraction Falls/ }).click();
    await page.getByRole("button", { name: "4/7", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Multiply the numerator and denominator");
    await page.getByRole("button", { name: "6/8", exact: true }).click();
    await page.getByRole("button", { name: "Claim the rune →" }).click();

    for (let room = 2; room <= 5; room += 1) {
      await page.getByRole("button").filter({ hasText: room === 2 ? "Hall of Whispers" : room === 3 ? "Crystal Quarry" : room === 4 ? "Weather Chamber" : "Mirror Library" }).click();
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByRole("status")).toContainText("RUNE REPORT");
      await page.getByRole("button", { name: room === 5 ? "Approach the vault →" : "Claim the rune →" }).click();
    }

    await expect(page.getByRole("heading", { name: "Five runes align the ancient lock." })).toBeVisible();
    await page.getByRole("button", { name: "Open the vault →" }).click();
    await expect(page.getByRole("heading", { name: "QA Learner conquered Mystery Temple!" })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        completions: progress.games?.["mystery-temple"]?.completions ?? 0,
        fractionAttempts: learning.skills?.["math-equivalent-fractions"]?.attempts ?? 0,
        multiplication: Boolean(learning.skills?.["math-multi-digit-multiplication"]),
        erosion: Boolean(learning.skills?.["science-weathering-erosion"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({ completions: 1, fractionAttempts: 2, multiplication: true, erosion: true });
  });

  test("features the Grade 4 adventure without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 4 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Mystery Temple" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Enter the temple →" })).toHaveAttribute("href", "/games/mystery-temple");
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
