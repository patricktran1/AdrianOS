import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function gameProgress(page: import("@playwright/test").Page) {
  return page.evaluate((key) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return progress.games?.["treasure-map-math"] ?? { plays: 0, completions: 0, bestScore: 0 };
  }, PROGRESS_KEY);
}

async function chooseAndWait(
  page: import("@playwright/test").Page,
  answer: string,
  nextRound: number | "complete",
) {
  await page.getByRole("button", { name: answer, exact: true }).click();
  if (nextRound === "complete") {
    await expect(page.locator('[data-treasure-complete="true"]')).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(page.locator('[data-treasure-expedition="active"]')).toHaveAttribute("data-round", String(nextRound), { timeout: 5_000 });
  }
}

test.describe("Treasure Island Expedition", () => {
  test("starts on the ship and turns verified math into map movement", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/treasure-map-math", { waitUntil: "domcontentloaded" });

    const expedition = page.locator('[data-treasure-expedition="active"]');
    const map = page.locator('[data-treasure-map="active"]');
    await expect(expedition).toHaveAttribute("data-round", "1");
    await expect(expedition).toHaveAttribute("data-mechanic", "sail");
    await expect(page.getByRole("heading", { name: "You found 4 gold coins, then 3 more. How many coins?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);
    await expect(map).toHaveAttribute("data-landmarks-complete", "0");
    await expect.poll(async () => (await gameProgress(page)).completions ?? 0).toBe(0);

    await page.getByRole("button", { name: "6", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Compass clue: Count on three from 4");
    await expect(expedition).toHaveAttribute("data-round", "1");

    const correctRoute = page.getByRole("button", { name: "7", exact: true });
    await expect(correctRoute).toHaveAttribute("draggable", "true");
    await correctRoute.click();
    await expect(page.getByRole("heading", { name: "A pirate had 10 gems and gave away 4. How many remain?" })).toBeVisible({ timeout: 5_000 });
    await expect(map).toHaveAttribute("data-landmarks-complete", "1");

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["math-addition"]?.attempts).toBe(2);
    expect(learning.skills?.["math-addition"]?.correct).toBe(1);
  });

  test("remixes steering, cannon, and cargo into one verified six-island run", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/treasure-map-math", { waitUntil: "domcontentloaded" });

    const map = page.locator('[data-treasure-map="active"]');
    const firstBiome = await map.getAttribute("data-biome");

    await chooseAndWait(page, "7", 2);
    await expect(page.locator('[data-treasure-expedition="active"]')).toHaveAttribute("data-mechanic", "cannon");
    await chooseAndWait(page, "6", 3);
    await expect(page.locator('[data-treasure-expedition="active"]')).toHaveAttribute("data-mechanic", "cargo");

    const cargo = page.getByRole("button", { name: "6", exact: true });
    await expect(cargo).toHaveAttribute("draggable", "true");
    await cargo.dragTo(page.getByLabel("Ship cargo drop"));
    await expect(page.locator('[data-treasure-expedition="active"]')).toHaveAttribute("data-round", "4", { timeout: 5_000 });

    await chooseAndWait(page, "10", 5);
    await chooseAndWait(page, "7", 6);
    await chooseAndWait(page, "4", "complete");

    await expect(page.getByRole("heading", { name: "QA Learner conquered Dino Treasure Archipelago." })).toBeVisible();
    await expect(page.locator('[data-treasure-complete="true"]')).toContainText("6 islands reached");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 1, completions: 1, bestScore: 6 });

    await page.getByRole("button", { name: "Play again", exact: true }).click();
    const replay = page.locator('[data-treasure-expedition="active"]');
    await expect(replay).toHaveAttribute("data-run-seed", "1");
    await expect(page.getByRole("heading", { name: "A pirate had 10 gems and gave away 4. How many remain?" })).toBeVisible();
    await expect(page.locator('[data-treasure-map="active"]')).not.toHaveAttribute("data-biome", firstBiome ?? "");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 2, completions: 1, bestScore: 6 });
  });

  test("adapts the expedition to Grade 5 without adding setup friction", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/treasure-map-math", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-treasure-expedition="active"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "The safe route is 0.72 of a mile. Which marker matches?" })).toBeVisible();
    await expect(page.getByText("5.NBT.A.3", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "0.72", exact: true })).toHaveAttribute("data-correct", "true");
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
  });

  test("stays phone-safe and removes ship motion when reduced motion is requested", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/treasure-map-math", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-treasure-expedition="active"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });

    await expect.poll(async () => page.locator('[data-ship-stop="0"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
