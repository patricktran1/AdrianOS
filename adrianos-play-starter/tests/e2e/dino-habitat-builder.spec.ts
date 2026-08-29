import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function completionCount(page: import("@playwright/test").Page) {
  return page.evaluate((key) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return progress.games?.["dino-habitat-builder"]?.completions ?? 0;
  }, PROGRESS_KEY);
}

/** Drags a tray piece onto the construction zone with explicit pointer steps. */
async function dragOntoZone(page: Page, piece: Locator) {
  const zone = page.getByRole("region", { name: "Dinosaur habitat construction zone" });
  const from = await piece.boundingBox();
  const to = await zone.boundingBox();
  expect(from, "the piece should be laid out").not.toBeNull();
  expect(to, "the construction zone should be laid out").not.toBeNull();

  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.describe("Dino Habitat Builder", () => {
  test("starts immediately and turns verified answers into a changing habitat", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dino-habitat-builder", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-habitat-game="active"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "The watering tank holds 27 liters. Add 18 more." })).toBeVisible();
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
    expect(await completionCount(page)).toBe(0);

    await page.locator('[data-piece-id="35"]').click();
    await expect(page.getByRole("status")).toContainText("Builder clue: Jump 3 to 30");
    expect(await completionCount(page)).toBe(0);

    const correctPiece = page.locator('[data-piece-id="45"]');
    await expect(correctPiece).toHaveAttribute("draggable", "true");
    // dragTo() occasionally drops the payload under parallel load; stepping the
    // pointer explicitly makes the drag deterministic without weakening it.
    await dragOntoZone(page, correctPiece);
    await expect(page.getByRole("region", { name: "Dinosaur habitat construction zone" })).toHaveAttribute("data-habitat-parts", "1");
    await expect(page.getByRole("heading", { name: "Which plant belongs in a Triceratops feeding zone?" })).toBeVisible({ timeout: 5_000 });

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["math-addition"]?.attempts).toBe(2);
    expect(learning.skills?.["math-addition"]?.correct).toBe(1);
  });

  test("builds all five parts, includes real design choices, and completes exactly once", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dino-habitat-builder", { waitUntil: "domcontentloaded" });

    await page.locator('[data-piece-id="45"]').click();
    await expect(page.getByRole("heading", { name: "Which plant belongs in a Triceratops feeding zone?" })).toBeVisible({ timeout: 5_000 });

    await page.locator('[data-piece-id="fern"]').click();
    const firstDesign = page.getByRole("region", { name: "Choose a habitat design" });
    await expect(firstDesign).toBeVisible();
    await firstDesign.getByRole("button", { name: /Volcano skyline/ }).click();
    await expect(page.getByRole("heading", { name: "A fence has 52 boards. Seventeen are used." })).toBeVisible({ timeout: 5_000 });

    await page.locator('[data-piece-id="35"]').click();
    await expect(page.getByRole("heading", { name: "Why should the shelter roof be wide?" })).toBeVisible({ timeout: 5_000 });

    await page.locator('[data-piece-id="shade"]').click();
    const secondDesign = page.getByRole("region", { name: "Choose a habitat design" });
    await expect(secondDesign).toBeVisible();
    await secondDesign.getByRole("button", { name: /Fossil gate/ }).click();
    await expect(page.getByRole("heading", { name: /Count by 5s/ })).toBeVisible({ timeout: 5_000 });

    await page.locator('[data-piece-id="50"]').click();
    await expect(page.getByRole("heading", { name: "QA Learner built a living dino world." })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-habitat-complete="true"]')).toContainText("5 verified build orders");
    await expect.poll(() => completionCount(page)).toBe(1);

    await page.getByRole("button", { name: "Remix the habitat →" }).click();
    await expect(page.locator('[data-habitat-game="active"]')).toHaveAttribute("data-run-seed", "1");
    await expect(page.getByRole("heading", { name: "Which plant belongs in a Triceratops feeding zone?" })).toBeVisible();
    expect(await completionCount(page)).toBe(1);
  });

  test("stays phone-safe and removes habitat motion when reduced motion is requested", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/dino-habitat-builder", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-habitat-game="active"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });

    const dinoAnimation = await page.locator('[aria-label="Dinosaur habitat construction zone"] > div').nth(2).evaluate((element) => getComputedStyle(element).animationName);
    expect(dinoAnimation).toBe("none");
  });
});
