import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Adventure Arcade homepage", () => {
  test("puts a due mastery rescue ahead of generic game discovery", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.addInitScript(({ learningKey }) => {
      const current = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      window.localStorage.setItem(learningKey, JSON.stringify({
        ...current,
        skills: current.skills ?? {},
        dailyAdventure: current.dailyAdventure ?? null,
        reviewQueue: [
          ...(Array.isArray(current.reviewQueue) ? current.reviewQueue : []),
          {
            id: "qa-due-review",
            gameSlug: "math-blast",
            skillId: "math-addition",
            subject: "Math",
            prompt: "What is 8 + 7?",
            correctAnswer: "15",
            dueAt: "2020-01-01T00:00:00.000Z",
            updatedAt: "2020-01-01T00:00:00.000Z",
            successes: 0,
            status: "due",
          },
        ],
      }));
    }, { learningKey: LEARNING_KEY });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const recommendation = page.getByRole("region", { name: "Play next recommendation" });
    await expect(recommendation.getByText("RESCUE MISSION READY", { exact: true })).toBeVisible();
    await expect(recommendation.getByRole("heading", { name: "Mastery Rescue Lab" })).toBeVisible();
    await expect(recommendation.getByText("1 skill ready for a playful rematch.", { exact: true })).toBeVisible();
  });

  test("offers the fresh daily remix when no rescue is due", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const recommendation = page.getByRole("region", { name: "Play next recommendation" });
    await expect(recommendation.getByText("TODAY’S FRESH RUN", { exact: true })).toBeVisible();
    await expect(recommendation.getByRole("heading", { name: "Daily Adventure Remix" })).toBeVisible();
  });

  test("keeps favorites in the synced learner record and filters by age by default", async ({ page, browser }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "All games" }).click();
    const search = page.getByRole("textbox", { name: "Search games" });
    await search.fill("Cyber City Five");
    await expect(page.getByRole("heading", { name: "Cyber City Five" })).toHaveCount(0);

    await page.getByRole("button", { name: "Age 7 fit" }).click();
    await expect(page.getByRole("heading", { name: "Cyber City Five" })).toBeVisible();

    await search.fill("Dino Time Rescue");
    await page.getByRole("button", { name: "Save Dino Time Rescue as a favorite" }).click();
    await expect.poll(async () => page.evaluate((learningKey) => {
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const item = learning.reviewQueue?.find((row: { gameSlug?: string; id?: string }) =>
        row.gameSlug === "adrianos-adventure-arcade" && row.id === "arcade-library-state"
      );
      return item?.data?.favorites ?? "";
    }, LEARNING_KEY)).toContain("dino-time-rescue");

    const storageState = await page.context().storageState();
    const restoredContext = await browser.newContext({ storageState });
    const restoredPage = await restoredContext.newPage();
    await restoredPage.goto("/", { waitUntil: "domcontentloaded" });
    const collection = restoredPage.getByRole("region", { name: "My arcade collection" });
    await expect(collection.getByText("MY FAVORITES", { exact: true })).toBeVisible();
    await expect(collection.getByRole("link", { name: /Dino Time Rescue/ })).toBeVisible();
    await restoredContext.close();
  });

  test("fits the grade-aware arcade on an iPhone viewport", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("region", { name: "Adventure Arcade" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play together" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
