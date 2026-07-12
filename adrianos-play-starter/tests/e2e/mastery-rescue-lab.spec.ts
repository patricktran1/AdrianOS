import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const REVIEW_ID = "number-quest:math-addition:rescue-test";

async function seedDueReview(page: import("@playwright/test").Page) {
  await seedQaFamily(page, { clear: true, grade: 2 });
  await page.addInitScript(({ key, reviewId }) => {
    const learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    learning.version = 1;
    learning.updatedAt = new Date().toISOString();
    learning.skills = learning.skills ?? {};
    learning.reviewQueue = [{
      id: reviewId,
      gameSlug: "number-quest",
      skillId: "math-addition",
      subject: "Math",
      prompt: "What is 27 + 18?",
      correctAnswer: "45",
      data: { skillLabel: "Add within 100", hint: "Add ones, regroup, then add tens.", explanation: "27 + 18 = 45." },
      dueAt: "2000-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
      successes: 0,
      status: "due",
    }];
    learning.dailyAdventure = null;
    window.localStorage.setItem(key, JSON.stringify(learning));
  }, { key: LEARNING_KEY, reviewId: REVIEW_ID });
}

test.describe("Mastery Rescue Lab", () => {
  test("turns a real missed question into two adaptive rematches and resolves it", async ({ page }) => {
    await seedDueReview(page);
    await page.goto("/games/mastery-rescue-lab", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dino Rescue Lab" })).toBeVisible();
    await expect(page.getByText("1 skills from earlier misses", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Start the rescue →", exact: true }).click();

    await expect(page.getByRole("heading", { name: "What is 27 + 18?" })).toBeVisible();
    await page.getByRole("button", { name: "35", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Add ones, regroup");
    await page.getByRole("button", { name: "45", exact: true }).click();
    await page.getByRole("button", { name: "Next rematch →", exact: true }).click();

    await page.getByRole("button", { name: "45", exact: true }).click();
    await page.getByRole("button", { name: "Complete the rescue →", exact: true }).click();
    await expect(page.getByRole("heading", { name: "QA Learner rescued the lost hatchlings!" })).toBeVisible();

    const result = await page.evaluate(({ learningKey, progressKey, reviewId }) => {
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const review = learning.reviewQueue?.find((item: { id?: string }) => item.id === reviewId);
      return {
        status: review?.status,
        successes: review?.successes,
        attempts: learning.skills?.["math-addition"]?.attempts,
        completions: progress.games?.["mastery-rescue-lab"]?.completions,
      };
    }, { learningKey: LEARNING_KEY, progressKey: PROGRESS_KEY, reviewId: REVIEW_ID });

    expect(result).toMatchObject({ status: "resolved", successes: 2, attempts: 3, completions: 1 });
  });

  test("provides fresh TK practice with large phone-safe controls when no review is due", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/mastery-rescue-lab", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Critter Care Lab" })).toBeVisible();
    await expect(page.getByText("No rescue items are waiting", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Start the rescue →", exact: true }).click();

    const box = await page.locator('button[data-correct="true"]').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(76);
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
