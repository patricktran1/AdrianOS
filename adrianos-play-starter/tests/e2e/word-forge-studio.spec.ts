import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Word Forge Studio", () => {
  test("gives Adrian a Grade 2 dinosaur word-building deck with adaptive coaching", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/word-forge-studio", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dino Word Forge" })).toBeVisible();
    await page.getByRole("button", { name: "Start forging →" }).click();
    await expect(page.getByRole("heading", { name: "When the sun goes down." })).toBeVisible();

    const letterButtons = page.locator("button").filter({ hasNotText: /Check word|Undo|Hear the word/ });
    for (const letter of ["s", "u", "n", "s", "e", "x"]) {
      await letterButtons.filter({ hasText: new RegExp(`^${letter}$`, "i") }).first().click();
    }
    await page.getByRole("button", { name: "Check word" }).click();
    await expect(page.getByRole("status")).toContainText("Coach clue: build it from sun + set");

    for (const letter of ["s", "u", "n", "s", "e", "t"]) {
      await letterButtons.filter({ hasText: new RegExp(`^${letter}$`, "i") }).first().click();
    }
    await page.getByRole("button", { name: "Check word" }).click();
    await expect(page.getByRole("status")).toContainText("Word repaired!");

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["spelling-grade-2"]?.attempts).toBe(2);
  });

  test("completes all five words, records rewards, and remains phone safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/word-forge-studio", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start forging →" }).click();

    const words = ["sunset", "playground", "careful", "ancient", "footprint"];
    for (let round = 0; round < words.length; round += 1) {
      for (const letter of words[round]) {
        await page.locator("button").filter({ hasText: new RegExp(`^${letter}$`, "i") }).first().click();
      }
      await page.getByRole("button", { name: "Check word" }).click();
      await page.getByRole("button", { name: round === words.length - 1 ? "Open the word vault →" : "Next word →" }).click();
    }

    await expect(page.getByRole("heading", { name: "QA Learner forged the full deck!" })).toBeVisible();
    const progress = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), PROGRESS_KEY);
    expect(progress.games?.["word-forge-studio"]?.completions).toBe(1);
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("renders a meaningfully different Grade 5 academic morphology world", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/word-forge-studio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cyber Lexicon Core" })).toBeVisible();
    await page.getByRole("button", { name: "Start forging →" }).click();
    await expect(page.getByText("L.5.4", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "To state the opposite of a claim." })).toBeVisible();
  });
});
