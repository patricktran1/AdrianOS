import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

function localDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.describe("Daily Mission Control", () => {
  test("turns the homepage into a clear daily learning route", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const control = page.getByRole("region", { name: "Daily mission control" });
    await expect(control).toBeVisible();
    await expect(control.getByRole("heading", { name: "QA Learner’s launch plan" })).toBeVisible();
    await expect(control.getByLabel("1 of 4 missions complete")).toBeVisible();
    await expect(control.getByLabel("Memory systems clear: complete")).toBeVisible();
    await expect(control.locator(".primary-mission-button")).toHaveAttribute("href", "/games/daily-adventure-remix");
    await expect(control.locator(".primary-mission-button")).toContainText("Run today’s remix");
    await expect(page.getByRole("region", { name: "Adventure Arcade" })).toBeVisible();
  });

  test("puts a due memory rescue ahead of the normal route", async ({ page }) => {
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
            id: "mission-control-due-review",
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

    const control = page.getByRole("region", { name: "Daily mission control" });
    await expect(control.getByLabel("0 of 4 missions complete")).toBeVisible();
    await expect(control.getByLabel("Rescue 1 skill: ready")).toBeVisible();
    await expect(control.locator(".primary-mission-button")).toHaveAttribute("href", "/games/mastery-rescue-lab");
    await expect(control.locator(".primary-mission-button")).toContainText("Rescue 1 skill");
  });

  test("recognizes verified wins completed today", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.addInitScript(({ learningKey, progressKey, today }) => {
      const now = new Date().toISOString();
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      window.localStorage.setItem(learningKey, JSON.stringify({
        ...learning,
        skills: learning.skills ?? {},
        dailyAdventure: learning.dailyAdventure ?? null,
        reviewQueue: [
          ...(Array.isArray(learning.reviewQueue) ? learning.reviewQueue : []),
          {
            id: "daily-remix-synced-state",
            gameSlug: "daily-adventure-remix",
            skillId: "daily-remix-habit",
            subject: "Logic",
            prompt: "Daily Adventure Remix completion and streak state",
            correctAnswer: "",
            data: { lastDay: today, streak: 3, bestStreak: 3, syncedDailyReward: true },
            dueAt: "9999-12-31T23:59:59.999Z",
            updatedAt: now,
            successes: 3,
            status: "resolved",
          },
        ],
      }));
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 300,
        coins: 40,
        level: 2,
        games: {
          "story-expedition": {
            plays: 1,
            completions: 1,
            bestScore: 100,
            lastPlayed: now,
            lastCompleted: now,
          },
          "dino-time-rescue": {
            plays: 1,
            completions: 1,
            bestScore: 100,
            lastPlayed: now,
            lastCompleted: now,
          },
        },
        activity: [],
      }));
    }, { learningKey: LEARNING_KEY, progressKey: PROGRESS_KEY, today: localDateKey() });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const control = page.getByRole("region", { name: "Daily mission control" });
    await expect(control.getByLabel("4 of 4 missions complete")).toBeVisible();
    await expect(control.getByText("DAILY LAUNCH COMPLETE", { exact: true })).toBeVisible();
    await expect(control.locator(".primary-mission-button")).toHaveAttribute("href", "/games/family-quest-party");
    await expect(control.locator(".primary-mission-button")).toContainText("Play a bonus quest");
  });

  test("fits Mission Control on a phone without horizontal overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("region", { name: "Daily mission control" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
