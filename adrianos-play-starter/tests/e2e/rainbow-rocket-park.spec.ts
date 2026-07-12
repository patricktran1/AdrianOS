import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Kindergarten Rainbow Rocket Park", () => {
  test("teaches after a miss, launches three times, and records six skills", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 0 });
    await page.goto("/games/rainbow-rocket-park", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Build a rainbow rocket." })).toBeVisible();
    await page.getByRole("button", { name: "🔊 Sound on" }).click();
    await page.getByRole("button", { name: "Start building →" }).click();

    await page.getByRole("button", { name: "3", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Touch each star once");
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "Add the rocket part →" }).click();

    for (let mission = 2; mission <= 6; mission += 1) {
      await page.locator('button[data-correct="true"]').click();
      await expect(page.getByRole("status")).toContainText("ROCKET REPORT");
      await page.getByRole("button", { name: mission === 6 ? "Launch the rainbow rocket →" : "Add the rocket part →" }).click();
      if (mission === 2 || mission === 4) {
        await expect(page.getByText("MINI LAUNCH", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Fly to the next world →" }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "QA Learner launched the rocket!" })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        completions: progress.games?.["rainbow-rocket-park"]?.completions ?? 0,
        countingAttempts: learning.skills?.["math-counting"]?.attempts ?? 0,
        shapes: Boolean(learning.skills?.["math-geometry"]),
        sounds: Boolean(learning.skills?.["reading-spelling-easy"]),
        ecosystems: Boolean(learning.skills?.["environment-ecosystems"]),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({ completions: 1, countingAttempts: 2, shapes: true, sounds: true, ecosystems: true });
  });

  test("features the Kindergarten adventure without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 0 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Rainbow Rocket Park" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Start building →" })).toHaveAttribute("href", "/games/rainbow-rocket-park");
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
