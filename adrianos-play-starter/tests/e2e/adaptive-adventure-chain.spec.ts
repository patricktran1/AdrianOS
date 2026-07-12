import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Adaptive Adventure Chain", () => {
  test("turns a verified completion into three distinct personalized next paths", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-game-power-loop="active"]')).toBeVisible();
    await expect(page.locator('[data-adventure-chain="active"]')).toHaveCount(0);

    await page.evaluate(({ progressKey, learningKey }) => {
      const now = new Date();
      const timestamp = now.toISOString();
      window.localStorage.setItem(learningKey, JSON.stringify({
        version: 1,
        updatedAt: timestamp,
        skills: {
          "math-word-problems": {
            id: "math-word-problems",
            label: "Solve addition word problems",
            subject: "Math",
            attempts: 3,
            correct: 1,
            streak: 0,
            mastery: 28,
            lastPracticed: timestamp,
          },
        },
        reviewQueue: [{
          id: "dino-time-rescue:math-word-problems:qa",
          gameSlug: "dino-time-rescue",
          skillId: "math-word-problems",
          subject: "Math",
          prompt: "A dinosaur has 27 shells and finds 18 more. How many now?",
          correctAnswer: "45",
          dueAt: new Date(now.getTime() - 60_000).toISOString(),
          updatedAt: timestamp,
          successes: 0,
          status: "due",
          data: { skillLabel: "Solve addition word problems" },
        }],
        dailyAdventure: null,
      }));
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 210,
        coins: 8,
        level: 2,
        games: {
          "story-expedition": {
            plays: 1,
            completions: 1,
            bestScore: 500,
            lastPlayed: timestamp,
            lastCompleted: timestamp,
          },
        },
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY });

    await expect(page.locator('[data-power-moment="active"]')).toBeVisible();

    const chain = page.locator('[data-adventure-chain="active"]');
    await expect(chain).toBeVisible({ timeout: 8_000 });
    await expect(chain.getByRole("heading", { name: "Choose what happens next" })).toBeVisible();
    await expect(chain.getByText("real play and mastery evidence")).toBeVisible();

    const cards = chain.locator(".adventure-chain-card");
    await expect(cards).toHaveCount(3);
    await expect(chain.locator('[data-chain-kind="stretch"]')).toHaveCount(1);
    await expect(chain.locator('[data-chain-kind="rescue"]')).toHaveCount(1);
    await expect(chain.locator('[data-chain-kind="explore"]')).toHaveCount(1);
    await expect(chain.locator('[data-chain-game="mastery-rescue-lab"]')).toHaveCount(1);

    const slugs = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-chain-game") ?? "")
    );
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).not.toContain("story-expedition");

    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("does not offer a next path for progress changes without a completion", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-game-power-loop="active"]')).toBeVisible();

    await page.evaluate((progressKey) => {
      const timestamp = new Date().toISOString();
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 20,
        coins: 2,
        level: 1,
        games: {
          "math-motion-lab": {
            plays: 1,
            completions: 0,
            bestScore: 0,
            lastPlayed: timestamp,
            lastCompleted: null,
          },
        },
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, PROGRESS_KEY);

    await page.waitForTimeout(4_100);
    await expect(page.locator('[data-adventure-chain="active"]')).toHaveCount(0);
  });

  test("cancels a pending next path when the learner immediately replays", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-game-power-loop="active"]')).toBeVisible();

    await page.evaluate((progressKey) => {
      const timestamp = new Date().toISOString();
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 40,
        coins: 4,
        level: 1,
        games: {
          "story-expedition": {
            plays: 1,
            completions: 1,
            bestScore: 420,
            lastPlayed: timestamp,
            lastCompleted: timestamp,
          },
        },
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, PROGRESS_KEY);

    await expect(page.locator('[data-power-moment="active"]')).toBeVisible();

    await page.evaluate((progressKey) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      progress.games["story-expedition"].plays = 2;
      progress.games["story-expedition"].lastPlayed = new Date().toISOString();
      window.localStorage.setItem(progressKey, JSON.stringify(progress));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, PROGRESS_KEY);

    await page.waitForTimeout(4_100);
    await expect(page.locator('[data-adventure-chain="active"]')).toHaveCount(0);
  });
});
