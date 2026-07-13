import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

async function answerCurrentGate(page: Page, gate: number, missFirst = false) {
  const play = page.locator('[data-remix-stage="play"]');
  await expect(play).toHaveAttribute("data-remix-gate", String(gate));
  if (missFirst) {
    await page.locator('button[data-correct="false"]:not(:disabled)').first().click();
    await expect(page.getByText("CLUE UNLOCKED", { exact: true })).toBeVisible();
  }
  await page.locator('button[data-correct="true"]:not(:disabled)').click();
  await expect(page.getByText("GATE REPORT", { exact: true })).toBeVisible();
  if (gate < 5) {
    await expect(play).toHaveAttribute("data-remix-gate", String(gate + 1), { timeout: 5000 });
  } else {
    await expect(page.locator('[data-remix-stage="finish"]')).toBeVisible({ timeout: 5000 });
  }
}

async function finishFiveGateRun(page: Page, missFirst = false) {
  for (let gate = 1; gate <= 5; gate += 1) {
    await answerCurrentGate(page, gate, missFirst && gate === 1);
  }
}

test.describe("Daily Adventure Remix", () => {
  test("starts Grade 2 Dino Dash immediately with an automatic power and one daily reward", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });

    const play = page.locator('[data-remix-stage="play"]');
    await expect(play).toBeVisible();
    await expect(page.getByText("Dino Dash Rescue", { exact: true })).toBeVisible();
    await expect(play).toHaveAttribute("data-remix-gate", "1");
    await expect(play).toHaveAttribute("data-remix-power", /^(compass|shield|magnet)$/);
    await expect(page.getByRole("button", { name: /Start today’s remix/ })).toHaveCount(0);
    await expect(page.getByText(/Choose one run power/)).toHaveCount(0);

    await finishFiveGateRun(page, true);
    await expect(page.getByRole("heading", { name: "QA Learner cleared Dino Dash!" })).toBeVisible();

    const first = await page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const state = learning.reviewQueue?.find((row: { id?: string }) => row.id === "daily-remix-synced-state");
      return {
        plays: progress.games?.["daily-adventure-remix"]?.plays ?? 0,
        completions: progress.games?.["daily-adventure-remix"]?.completions ?? 0,
        xp: progress.xp ?? 0,
        coins: progress.coins ?? 0,
        streak: state?.data?.streak ?? 0,
        lastDay: state?.data?.lastDay ?? "",
        attempts: Object.values(learning.skills ?? {}).reduce((sum: number, skill) => sum + Number((skill as { attempts?: number }).attempts ?? 0), 0),
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY });

    expect(first.plays).toBe(1);
    expect(first.completions).toBe(1);
    expect(first.streak).toBe(1);
    expect(first.lastDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.attempts).toBeGreaterThanOrEqual(6);

    await page.getByRole("button", { name: "Replay instantly", exact: true }).click();
    await expect(page.locator('[data-remix-stage="play"]')).toHaveAttribute("data-remix-gate", "1");
    await finishFiveGateRun(page);

    const second = await page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const state = learning.reviewQueue?.find((row: { id?: string }) => row.id === "daily-remix-synced-state");
      return {
        plays: progress.games?.["daily-adventure-remix"]?.plays ?? 0,
        completions: progress.games?.["daily-adventure-remix"]?.completions ?? 0,
        xp: progress.xp ?? 0,
        coins: progress.coins ?? 0,
        streak: state?.data?.streak ?? 0,
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY });

    expect(second.plays).toBe(2);
    expect(second.completions).toBe(2);
    expect(second.streak).toBe(1);
    expect(second.xp - first.xp).toBe(8);
    expect(second.coins - first.coins).toBe(1);
  });

  test("shows the rotating Grade 2 arcade card in School Mode without phone overflow", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const card = page.getByRole("region", { name: "Daily adventure remix" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: "Dino Dash Rescue" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Play today’s remix →" })).toHaveAttribute("href", "/games/daily-adventure-remix");
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("opens TK Critter Parade directly on large read-aloud tap gates", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Critter Parade Trail" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Join the parade →" })).toHaveAttribute("href", "/games/daily-adventure-remix");

    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });
    const play = page.locator('[data-remix-stage="play"]');
    await expect(play).toBeVisible();
    await expect(play).toHaveAttribute("data-remix-gate", "1");
    await expect(page.getByRole("button", { name: "🔊 Read it aloud" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start today’s remix/ })).toHaveCount(0);

    const choiceBox = await page.locator('button[data-correct="true"]').boundingBox();
    expect(choiceBox).not.toBeNull();
    expect(choiceBox?.height ?? 0).toBeGreaterThanOrEqual(88);
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
