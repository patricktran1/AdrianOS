import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Grade 1 Robot Rescue City", () => {
  test("teaches after a miss, builds six robot parts, and records mastery", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 1 });
    await page.goto("/games/robot-rescue-city", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Robot City lost its power." })).toBeVisible();
    await page.getByRole("button", { name: /Bolt/ }).click();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Launch the rescue →" }).click();

    await page.getByRole("button", { name: "9", exact: true }).click();
    await expect(page.getByText("REPAIR CLUE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "11", exact: true }).click();
    await expect(page.getByText("REPAIR REPORT", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Install the part →" }).click();

    for (let mission = 2; mission <= 6; mission += 1) {
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByText("REPAIR REPORT", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: mission === 6 ? "Power up the city →" : "Install the part →" }).click();
      if (mission === 2 || mission === 4) {
        await expect(page.getByText("GARAGE CHECKPOINT", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Open the next district →" }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "QA Learner rebuilt the rescue robot!" })).toBeVisible();
    await expect(page.getByText("6/6", { exact: true })).toBeVisible();

    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        plays: progress.games?.["robot-rescue-city"]?.plays ?? 0,
        completions: progress.games?.["robot-rescue-city"]?.completions ?? 0,
        additionAttempts: learning.skills?.["math-addition-within-20"]?.attempts ?? 0,
        phonicsRecorded: Boolean(learning.skills?.["phonics-long-vowels"]),
        engineeringRecorded: Boolean(learning.skills?.["engineering-light-communication"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({
      plays: 1,
      completions: 1,
      additionAttempts: 2,
      phonicsRecorded: true,
      engineeringRecorded: true,
    });
  });

  test("features the Grade 1 adventure in School Mode without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Robot Rescue City" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Launch the rescue →" })).toHaveAttribute("href", "/games/robot-rescue-city");
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
