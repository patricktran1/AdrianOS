import { expect, test, type Page } from "@playwright/test";

async function createSecondGradeLearner(page: Page, name = "Maya") {
  await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Child 1 name").fill(name);
  await page.getByLabel("Child 1 age").selectOption("7");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create family and open School Mode" }).click();
  await expect(page).toHaveURL(/\/school$/);
}

test.describe("curriculum-aware learning paths", () => {
  test("shows California Grade 2 standards and honest evidence labels", async ({ page }) => {
    await createSecondGradeLearner(page);
    await page.goto("/curriculum", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Maya’s learning map" })).toBeVisible();
    await expect(page.getByLabel("Learning grade")).toHaveValue("2");
    await expect(page.getByText("2.OA.A.1", { exact: true })).toBeVisible();
    await expect(page.getByText("RL.2.1", { exact: true })).toBeVisible();
    await expect(page.getByText("2-PS1-1", { exact: true })).toBeVisible();
    await expect(page.getByText("Direct evidence").first()).toBeVisible();
    await expect(page.getByText("Supporting").first()).toBeVisible();
    await expect(page.getByText("Supporting, not mastery proof").or(page.getByText("Supporting").first())).toBeVisible();
  });

  test("persists a parent grade override in the synced learning record", async ({ page }) => {
    await createSecondGradeLearner(page, "Avery");
    await page.goto("/curriculum", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Learning grade").selectOption("3");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Learning grade")).toHaveValue("3");
    await expect(page.getByRole("heading", { name: "California Grade 3 priority standards", exact: true })).toBeVisible();
    await expect(page.getByText("3.OA.A.1", { exact: true })).toBeVisible();

    const learning = await page.evaluate(() => {
      const family = JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}");
      return JSON.parse(window.localStorage.getItem(`adrianos-learning-v1:${family.activeProfileId}`) ?? "{}");
    });
    expect(learning.reviewQueue.some((row: { gameSlug: string; data?: { grade?: number } }) => (
      row.gameSlug === "adrianos-grade-profile" && row.data?.grade === 3
    ))).toBe(true);
  });

  test("surfaces the curriculum path and next skill inside School Mode", async ({ page }) => {
    await createSecondGradeLearner(page, "Jordan");

    await expect(page.getByRole("region", { name: "Curriculum learning path" })).toBeVisible();
    await expect(page.getByText("California Grade 2 learning path")).toBeVisible();
    await expect(page.getByText("NEXT BEST SKILL")).toBeVisible();
    await expect(page.getByRole("link", { name: "See the full learning map" })).toHaveAttribute("href", "/curriculum");
  });

  test("fits the curriculum map on an iPhone-sized viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createSecondGradeLearner(page, "Riley");
    await page.goto("/curriculum", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Riley’s learning map" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
