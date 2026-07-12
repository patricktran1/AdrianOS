import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

async function unlockParentSession(page: import("@playwright/test").Page) {
  await seedQaFamily(page, { clear: true });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("adrianos-parent-unlocked", "yes");
    window.sessionStorage.setItem("adrianos-weekly-report-unlocked", "yes");
    window.sessionStorage.setItem("adrianos-skill-goals-unlocked", "yes");
  });
}

test.describe("parent command center", () => {
  test("shows the ten-second learning overview and opens parent tools", async ({ page }) => {
    await unlockParentSession(page);
    await page.goto("/parent", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
    await expect(page.getByLabel("Parent learning command center")).toBeVisible();
    await expect(page.getByText("PARENT ATTENTION")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open today’s route|View School Mode/ })).toBeVisible();

    await page.getByRole("button", { name: "Weekly report", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Learning week in review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close weekly report" })).toBeVisible();
  });

  test("fits the phone viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await unlockParentSession(page);
    await page.goto("/parent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
