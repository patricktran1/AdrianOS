import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Quick Play launchpad", () => {
  test("puts one-tap fun choices before the full arcade and launches a game directly", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const launchpad = page.getByRole("region", { name: "Quick play launchpad" });
    await expect(launchpad).toHaveAttribute("data-quick-play-ready", "true");
    await expect(launchpad.getByRole("heading", { name: "What sounds fun?" })).toBeVisible();

    const arcade = page.getByRole("region", { name: "Adventure Arcade" });
    const launchpadBox = await launchpad.boundingBox();
    const arcadeBox = await arcade.boundingBox();
    expect(launchpadBox).not.toBeNull();
    expect(arcadeBox).not.toBeNull();
    expect(launchpadBox?.y ?? Infinity).toBeLessThan(arcadeBox?.y ?? 0);

    const surprise = launchpad.locator("[data-quick-surprise]");
    await expect(surprise).toHaveCount(1);
    await expect(surprise).toHaveAttribute("href", /\/games\/[^?]+\?from=quick-play&mood=surprise/);

    const choices = launchpad.locator("[data-quick-game]");
    await expect(choices).toHaveCount(4);
    const slugs = await choices.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-quick-game") ?? ""),
    );
    expect(new Set(slugs).size).toBe(4);
    expect(slugs).not.toContain("mastery-rescue-lab");
    expect(slugs).not.toContain("mastery-lab");
    expect(slugs).not.toContain("cyber-city-five");

    const first = choices.first();
    const firstSlug = await first.getAttribute("data-quick-game");
    expect(firstSlug).toBeTruthy();
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/games/${firstSlug}\\?from=quick-play`));

    await expect.poll(async () => page.evaluate((learningKey) => {
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const item = learning.reviewQueue?.find((row: { gameSlug?: string; id?: string }) =>
        row.gameSlug === "adrianos-adventure-arcade" && row.id === "arcade-library-state"
      );
      return item?.data?.recent ?? "";
    }, LEARNING_KEY)).toContain(firstSlug);
  });

  test("rotates the surprise after play and stays phone-safe", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const launchpad = page.getByRole("region", { name: "Quick play launchpad" });
    const surprise = launchpad.locator("[data-quick-surprise]");
    const firstSurprise = await surprise.getAttribute("data-quick-surprise");
    expect(firstSurprise).toBeTruthy();

    await surprise.click();
    await expect(page).toHaveURL(new RegExp(`/games/${firstSurprise}\\?from=quick-play`));
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nextSurprise = await page
      .getByRole("region", { name: "Quick play launchpad" })
      .locator("[data-quick-surprise]")
      .getAttribute("data-quick-surprise");
    expect(nextSurprise).toBeTruthy();
    expect(nextSurprise).not.toBe(firstSurprise);

    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
