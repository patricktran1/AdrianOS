import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Grade 2 Dino Time Rescue", () => {
  test("teaches after a miss and completes all three story worlds", async ({ page }) => {
    await seedQaFamily(page, { clear: true });
    await page.goto("/games/dino-time-rescue", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "The dinosaurs are trapped in time." })).toBeVisible();
    await page.getByRole("button", { name: /Zip the Raptor/ }).click();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Open the time portal →" }).click();

    await expect(page.getByText("Fern Forest", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "It is hungry", exact: true }).click();
    await expect(page.getByText("CLUE UNLOCKED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thunder frightened it", exact: true }).click();
    await expect(page.getByText("RESCUE REPORT", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next rescue →" }).click();

    for (let mission = 2; mission <= 9; mission += 1) {
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByText("RESCUE REPORT", { exact: true })).toBeVisible();
      const label = mission === 9
        ? "Seal the time portal →"
        : mission === 3 || mission === 6
          ? "Clear the boss gate →"
          : "Next rescue →";
      await page.getByRole("button", { name: label, exact: true }).click();

      if (mission === 3 || mission === 6) {
        await expect(page.getByText("CHAPTER CLEARED", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: /Enter .* →/ }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "QA Learner saved the dinosaur timeline!" })).toBeVisible();

    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        plays: progress.games?.["dino-time-rescue"]?.plays ?? 0,
        completions: progress.games?.["dino-time-rescue"]?.completions ?? 0,
        detailAttempts: learning.skills?.["reading-comprehension-detail"]?.attempts ?? 0,
        storyMasteryRecorded: Boolean(learning.skills?.["math-word-problems"]),
        scienceRecorded: Boolean(learning.skills?.["engineering-materials"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({
      plays: 1,
      completions: 1,
      detailAttempts: 2,
      storyMasteryRecorded: true,
      scienceRecorded: true,
    });
  });

  test("features the Grade 2 adventure in School Mode without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight).toBeVisible();
    await expect(spotlight.getByRole("heading", { name: "Dino Time Rescue" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Start the rescue →" })).toHaveAttribute("href", "/games/dino-time-rescue");
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
