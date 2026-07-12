import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function click(page: import("@playwright/test").Page, name: string, times: number) {
  for (let i = 0; i < times; i += 1) await page.getByRole("button", { name }).click();
}

test.describe("Math Motion Lab", () => {
  test("gives Grade 2 a hands-on dinosaur number-line game with coaching", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Dino Canyon Dash" })).toBeVisible();
    await page.getByRole("button", { name: "Start moving →" }).click();
    await expect(page.getByLabel("Number line from 20 to 50")).toBeVisible();
    await page.getByRole("button", { name: "Lock in 27" }).click();
    await expect(page.getByRole("status")).toContainText("Coach clue: Jump 3 to 30, then 15 more.");
    await click(page, "5 jumps ⏩", 3);
    await click(page, "Forward →", 3);
    await page.getByRole("button", { name: "Lock in 45" }).click();
    await expect(page.getByRole("status")).toContainText("27 + 18 = 45");
    const learning = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["math-word-problems"]?.attempts).toBe(2);
  });

  test("completes all Grade 2 routes and persists rewards", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start moving →" }).click();
    await click(page, "5 jumps ⏩", 3); await click(page, "Forward →", 3); await page.getByRole("button", { name: "Lock in 45" }).click(); await page.getByRole("button", { name: "Next route →" }).click();
    await click(page, "⏪ 5 jumps", 3); await click(page, "← Back", 2); await page.getByRole("button", { name: "Lock in 35" }).click(); await page.getByRole("button", { name: "Next route →" }).click();
    await page.getByRole("button", { name: "5 jumps ⏩" }).click(); await page.getByRole("button", { name: "Lock in 50" }).click(); await page.getByRole("button", { name: "Open the motion vault →" }).click();
    await expect(page.getByRole("heading", { name: "QA Learner cleared every route!" })).toBeVisible();
    const progress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PROGRESS_KEY);
    expect(progress.games?.["math-motion-lab"]?.completions).toBe(1);
  });

  test("renders distinct TK and Grade 5 worlds and stays phone safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Critter Hop Path" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cyber Decimal Rail" })).toBeVisible();
  });
});
