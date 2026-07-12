import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

async function answerCurrentGate(page: Page, missFirst = false) {
  if (missFirst) {
    await page.locator('button[data-correct="false"]').first().click();
    await expect(page.getByText("CLUE UNLOCKED", { exact: true })).toBeVisible();
  }
  await page.locator('button[data-correct="true"]').click();
  await expect(page.getByText("GATE REPORT", { exact: true })).toBeVisible();
}

async function finishFiveGateRun(page: Page, missFirst = false) {
  for (let gate = 1; gate <= 5; gate += 1) {
    await answerCurrentGate(page, missFirst && gate === 1);
    const label = gate === 5
      ? "Finish today’s remix →"
      : gate === 3
        ? "Open checkpoint →"
        : "Next gate →";
    await page.getByRole("button", { name: label, exact: true }).click();
    if (gate === 3) {
      await expect(page.getByRole("heading", { name: "Three gates cleared!" })).toBeVisible();
      await page.getByRole("button", { name: "Continue the remix →", exact: true }).click();
    }
  }
}

test.describe("Daily Adventure Remix", () => {
  test("runs a Grade 2 Dino Dash with teaching, synced streak state, and one daily reward", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dino Dash Rescue" })).toBeVisible();
    await page.getByRole("button", { name: /Treasure Magnet/ }).click();
    await page.getByRole("button", { name: "Start today’s remix →", exact: true }).click();
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

    await page.getByRole("button", { name: "Replay today’s route", exact: true }).click();
    await page.getByRole("button", { name: /Extra Shield/ }).click();
    await page.getByRole("button", { name: "Start today’s remix →", exact: true }).click();
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

  test("fills the TK flagship gap with read-aloud Critter Parade and large tap gates", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const spotlight = page.getByRole("region", { name: "Featured grade adventure" });
    await expect(spotlight.getByRole("heading", { name: "Critter Parade Trail" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Join the parade →" })).toHaveAttribute("href", "/games/daily-adventure-remix");

    await page.goto("/games/daily-adventure-remix", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Critter Parade Trail" })).toBeVisible();
    await page.getByRole("button", { name: /Clue Compass/ }).click();
    await page.getByRole("button", { name: "Start today’s remix →", exact: true }).click();
    await expect(page.getByRole("button", { name: "🔊 Read it aloud" })).toBeVisible();

    const choiceBox = await page.locator('button[data-correct="true"]').boundingBox();
    expect(choiceBox).not.toBeNull();
    expect(choiceBox?.height ?? 0).toBeGreaterThanOrEqual(88);
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
