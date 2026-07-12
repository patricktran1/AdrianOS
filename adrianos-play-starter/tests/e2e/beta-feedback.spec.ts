import { expect, test } from "@playwright/test";

async function seedFamily(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("adrianos-beta-cohort-v1", "piedmont-families");
    window.localStorage.setItem("adrianos-family-v1", JSON.stringify({
      activeProfileId: "maya",
      profiles: [{ id: "maya", name: "Maya", age: 8, emoji: "🚀", createdAt: new Date().toISOString() }],
      parentPinHash: null,
    }));
  });
}

test.describe("family beta feedback", () => {
  test("remembers the cohort from a share link", async ({ page }) => {
    await page.goto("/join?cohort=piedmont-families", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("PIEDMONT FAMILIES", { exact: true })).toBeVisible();
    const cohort = await page.evaluate(() => window.localStorage.getItem("adrianos-beta-cohort-v1"));
    expect(cohort).toBe("piedmont-families");
  });

  test("opens parent feedback with child and cohort context", async ({ page }) => {
    await seedFamily(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Parent feedback" }).click();
    await expect(page.getByRole("dialog", { name: "Parent beta feedback" })).toBeVisible();
    await expect(page.getByText(/Maya · Piedmont families/)).toBeVisible();
    await expect(page.getByText("Parent sign-in required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in or connect family" })).toHaveAttribute("href", "/join");
  });

  test("keeps the feedback panel inside an iPhone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedFamily(page);
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Parent feedback" }).click();
    await expect(page.getByRole("dialog", { name: "Parent beta feedback" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
