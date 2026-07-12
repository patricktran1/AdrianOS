import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Grade 5 Cyber City Five", () => {
  test("adapts after a miss, builds an upgrade stack, and secures eight districts", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/cyber-city-five", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Cyber City is under attack." })).toBeVisible();
    await page.getByRole("button", { name: /Overclock/ }).click();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Enter the network →" }).click();

    await page.getByRole("button", { name: "8.407", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Write 8.47 as 8.470");
    await page.getByRole("button", { name: "8.47", exact: true }).click();
    await page.getByRole("button", { name: "Capture the code fragment →" }).click();

    for (let mission = 2; mission <= 8; mission += 1) {
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByRole("status")).toContainText("SYSTEM LOG");
      await page.getByRole("button", { name: mission === 8 ? "Restore the city core →" : "Capture the code fragment →" }).click();
      if (mission === 2 || mission === 4 || mission === 6) {
        await expect(page.getByText("UPGRADE FORK", { exact: true })).toBeVisible();
        const upgrade = mission === 2 ? "Firewall Patch" : mission === 4 ? "Hint Cache" : "Turbo Packet";
        await page.getByRole("button", { name: new RegExp(upgrade) }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "The eight code fragments align." })).toBeVisible();
    await page.getByRole("button", { name: "Seal the city core →" }).click();
    await expect(page.getByRole("heading", { name: "QA Learner saved Cyber City Five!" })).toBeVisible();
    await expect(page.getByText("3", { exact: true })).toHaveCount(0);

    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        completions: progress.games?.["cyber-city-five"]?.completions ?? 0,
        decimalAttempts: learning.skills?.["math-decimals"]?.attempts ?? 0,
        fractions: Boolean(learning.skills?.["math-fractions"]),
        evidence: Boolean(learning.skills?.["reading-inference"]),
        space: Boolean(learning.skills?.["science-space"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({
      completions: 1,
      decimalAttempts: 2,
      fractions: true,
      evidence: true,
      space: true,
    });
  });

  test("features the Grade 5 strategy adventure without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Cyber City Five" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Enter the network →" })).toHaveAttribute("href", "/games/cyber-city-five");
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
