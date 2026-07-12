import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Grade 3 Space Station Sigma", () => {
  test("teaches after a miss, restores seven systems, and records evidence", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 3 });
    await page.goto("/games/space-station-sigma", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Space Station Sigma is going dark." })).toBeVisible();
    await page.getByRole("button", { name: /Star Navigator/ }).click();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Board the station →" }).click();

    await page.getByRole("button", { name: "10", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Think 4 groups of 6");
    await page.getByRole("button", { name: "24", exact: true }).click();
    await page.getByRole("button", { name: "Install the repair →" }).click();

    for (let mission = 2; mission <= 7; mission += 1) {
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByRole("status")).toContainText("SYSTEM REPORT");
      await page.getByRole("button", { name: mission === 7 ? "Restore the final core →" : "Install the repair →" }).click();
      if (mission === 2 || mission === 4 || mission === 6) {
        await expect(page.getByText("SYSTEM CHECKPOINT", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Enter the next sector →" }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "QA Learner saved Space Station Sigma!" })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        completions: progress.games?.["space-station-sigma"]?.completions ?? 0,
        multiplicationAttempts: learning.skills?.["math-multiplication"]?.attempts ?? 0,
        division: Boolean(learning.skills?.["math-division"]),
        engineering: Boolean(learning.skills?.["engineering-design"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({ completions: 1, multiplicationAttempts: 2, division: true, engineering: true });
  });

  test("features the Grade 3 adventure without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 3 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Space Station Sigma" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Board the station →" })).toHaveAttribute("href", "/games/space-station-sigma");
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
