import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

async function waitForRecordedPlay(page: import("@playwright/test").Page) {
  await expect.poll(async () => page.evaluate((progressKey) => {
    const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
    return progress.games?.["dinosaur-detective"]?.plays ?? 0;
  }, PROGRESS_KEY)).toBe(1);
}

test.describe("AdrianOS Surprise Event Engine", () => {
  test("turns two real correct answers into a no-click world event", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dinosaur-detective", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-surprise-director="active"]');
    await expect(director).toHaveAttribute("data-surprise-ready", "true");
    await expect(director).toHaveAttribute("data-surprise-threshold", "2");
    await waitForRecordedPlay(page);

    const before = await page.evaluate((progressKey) => window.localStorage.getItem(progressKey), PROGRESS_KEY);

    await page.getByRole("button", { name: /Tyrannosaurus rex$/ }).click();
    await expect(director).toHaveAttribute("data-surprise-charge", "1");
    await expect(page.getByText("Case 2 of 6", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Triceratops$/ }).click();
    await expect(director).toHaveAttribute("data-surprise-count", "1");
    await expect(director).toHaveAttribute("data-surprise-charge", "0");
    await expect(director).toHaveAttribute("data-surprise-threshold", "3");
    await expect(director).toHaveAttribute("data-surprise-visible", "true");
    await expect(director).toHaveAttribute("data-surprise-event", /meteor|treasure|turbo|portal|rainbow|dino|robot|ocean/);

    const overlay = page.locator('[data-surprise-overlay="active"]');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText(/WORLD EVENT|SECRET FOUND|POWER SURGE|SECRET WORLD|COLOR POWER|WILD EVENT|SYSTEM BOOST|DEEP-SEA EVENT/)).toBeVisible();
    await expect.poll(async () => overlay.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

    const after = await page.evaluate((progressKey) => window.localStorage.getItem(progressKey), PROGRESS_KEY);
    expect(after).toBe(before);
  });

  test("keeps the meter after a miss and turns the next event into a comeback", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/dinosaur-detective", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-surprise-director="active"]');
    await expect(director).toHaveAttribute("data-surprise-ready", "true");

    await page.getByRole("button", { name: /Tyrannosaurus rex$/ }).click();
    await expect(director).toHaveAttribute("data-surprise-charge", "1");
    await expect(page.getByText("Case 2 of 6", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.locator('[data-correct="false"]').first().click();
    await expect(director).toHaveAttribute("data-surprise-charge", "1");
    await expect(page.getByText("Case 3 of 6", { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Stegosaurus$/ }).click();
    await expect(director).toHaveAttribute("data-surprise-visible", "true");
    await expect(director).toHaveAttribute("data-surprise-event", "comeback");
    await expect(director).toHaveAttribute("data-surprise-comeback", "true");
    await expect(page.getByText("ROCKET RECOVERY!", { exact: true })).toBeVisible();
  });

  test("stays phone-safe and removes motion when reduced motion is requested", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/games/dinosaur-detective", { waitUntil: "domcontentloaded" });

    const director = page.locator('[data-game-surprise-director="active"]');
    await expect(director).toHaveAttribute("data-surprise-ready", "true");
    await page.getByRole("button", { name: /Tyrannosaurus rex$/ }).click();
    await expect(page.getByText("Case 2 of 6", { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Triceratops$/ }).click();

    const card = page.locator(".game-surprise-card");
    await expect(card).toBeVisible();
    await expect.poll(async () => card.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
