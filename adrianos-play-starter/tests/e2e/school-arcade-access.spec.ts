import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";

async function totalCompletions(page: import("@playwright/test").Page) {
  return page.evaluate((key) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return Object.values(progress.games ?? {}).reduce((sum: number, row) => sum + Number((row as { completions?: number }).completions ?? 0), 0);
  }, PROGRESS_KEY);
}

test.describe("child Arcade access", () => {
  test("keeps Arcade one tap away throughout School Mode without inventing progress", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const before = await totalCompletions(page);
    const modeSwitch = page.getByRole("navigation", { name: "Choose child mode" });
    await expect(modeSwitch.getByRole("link", { name: /Arcade/ })).toBeVisible();
    await expect(modeSwitch.getByRole("link", { name: /Today's School/ })).toHaveAttribute("aria-current", "page");

    const arcadeBreak = page.getByRole("region", { name: "Arcade break" });
    await arcadeBreak.scrollIntoViewIfNeeded();
    await expect(arcadeBreak).toBeVisible();
    await expect(arcadeBreak.locator("[data-school-arcade-game]")).toHaveCount(3);
    await expect(arcadeBreak.getByRole("link", { name: "Open the full arcade →" })).toBeVisible();

    const switchBox = await modeSwitch.boundingBox();
    expect(switchBox).not.toBeNull();
    expect(switchBox?.y ?? Infinity).toBeLessThanOrEqual(30);
    expect(await totalCompletions(page)).toBe(before);

    await modeSwitch.getByRole("link", { name: /Arcade/ }).click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.getByRole("region", { name: "Quick play launchpad" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Choose child mode" }).getByRole("link", { name: /Arcade/ })).toHaveAttribute("aria-current", "page");
    expect(await totalCompletions(page)).toBe(before);
  });

  test("opens the full arcade from the School Mode game rail and stays phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const arcadeBreak = page.getByRole("region", { name: "Arcade break" });
    await arcadeBreak.scrollIntoViewIfNeeded();
    await arcadeBreak.getByRole("link", { name: "Open the full arcade →" }).click();
    await expect(page).toHaveURL(/\/?from=school#quick-play$/);
    await expect(page.locator("#quick-play")).toBeVisible();

    const dock = page.getByRole("navigation", { name: "AdrianOS navigation" });
    await expect(dock.getByRole("link", { name: "Arcade" })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
