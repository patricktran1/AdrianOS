import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Math Motion Lab", () => {
  test("gives Grade 2 a hands-on dinosaur number-line strategy game", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dino Canyon Dash" })).toBeVisible();
    await page.getByRole("button", { name: "Start moving →" }).click();
    await expect(page.getByRole("heading", { name: "Solve 27 + 18." })).toBeVisible();
    await expect(page.getByLabel("Number line from 20 to 50")).toBeVisible();

    await page.getByRole("button", { name: "Lock in 27" }).click();
    await expect(page.getByRole("status")).toContainText("Coach clue: Jump 3 to 30, then 15 more.");

    await page.getByRole("button", { name: "5 jumps ⏩" }).click();
    await page.getByRole("button", { name: "5 jumps ⏩" }).click();
    await page.getByRole("button", { name: "5 jumps ⏩" }).click();
    await page.getByRole("button", { name: "Forward →" }).click();
    await page.getByRole("button", { name: "Forward →" }).click();
    await page.getByRole("button", { name: "Forward →" }).click();
    await page.getByRole("button", { name: "Lock in 45" }).click();
    await expect(page.getByRole("status")).toContainText("27 + 18 = 45");

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["math-word-problems"]?.attempts).toBe(2);
  });

  test("completes all three Grade 2 routes and records rewards", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start moving →" }).click();

    const routes = [
      { forward5: 3, forward: 3, back5: 0, back: 0 },
      { forward5: 0, forward: 0, back5: 3, back: 2 },
      { forward5: 1, forward: 0, back5: 0, back: 0 },
    ];

    for (let index = 0; index < routes.length; index += 1) {
      for (let n = 0; n < routes[index].forward5; n += 1) await page.getByRole("button", { name: "5 jumps ⏩" }).click();
      for (let n = 0; n < routes[index].forward; n += 1) await page.getByRole("button", { name: "Forward →" }).click();
      for (let n = 0; n < routes[index].back5; n += 1) await page.getByRole("button", { name: "⏪ 5 jumps" }).click();
      for (let n = 0; n < routes[index].back; n += 1) await page.getByRole("button", { name: "← Back" }).click();
      await page.getByRole("button", { name: /^Lock in/ }).click();
      await page.getByRole("button", { name: index === 2 ? "Open the motion vault →" : "Next route →" }).click();
    }

    await expect(page.getByRole("heading", { name: "QA Learner cleared every route!" })).toBeVisible();
    const progress = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), PROGRESS_KEY);
    expect(progress.games?.["math-motion-lab"]?.completions).toBe(1);
  });

  test("renders distinct TK and Grade 5 mechanics and stays phone safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Critter Hop Path" })).toBeVisible();
    await page.getByRole("button", { name: "Start moving →" }).click();
    const control = page.getByRole("button", { name: "Forward →" });
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(68);
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });

    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cyber Decimal Rail" })).toBeVisible();
    await page.getByRole("button", { name: "Start moving →" }).click();
    await expect(page.getByText("5.NBT.B.7", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Move from 0.4 to 0.72." })).toBeVisible();
  });
});
