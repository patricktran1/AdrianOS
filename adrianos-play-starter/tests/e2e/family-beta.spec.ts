import { expect, test } from "@playwright/test";

test.describe("family beta onboarding", () => {
  test("shows a shareable parent-managed beta landing page", async ({ page }) => {
    await page.goto("/join", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Every child gets their own route." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try it on this device" })).toBeVisible();
    await expect(page.getByText("Children do not sign in")).toBeVisible();
  });

  test("creates multiple child profiles without keeping starter children", async ({ page }) => {
    await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Who is learning?" })).toBeVisible();
    await page.getByLabel("Child 1 name").fill("Maya");
    await page.getByLabel("Child 1 age").selectOption("8");
    await page.getByRole("button", { name: "+ Add another child" }).click();
    await page.getByLabel("Child 2 name").fill("Leo");
    await page.getByLabel("Child 2 age").selectOption("7");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create family and open School Mode" }).click();

    await expect(page).toHaveURL(/\/school$/);
    await expect(page.getByRole("button", { name: /Maya/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Leo/ })).toBeVisible();

    const family = await page.evaluate(() => JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}"));
    expect(family.profiles.map((profile: { name: string }) => profile.name)).toEqual(["Maya", "Leo"]);
    expect(family.profiles.some((profile: { id: string }) => profile.id === "adrian" || profile.id === "elliot")).toBe(false);
  });

  test("lets a parent manage the same family later", async ({ page }) => {
    await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Child 1 name").fill("Avery");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create family and open School Mode" }).click();
    await expect(page).toHaveURL(/\/school$/);

    await page.goto("/family/setup?manage=1&local=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Manage your learners." })).toBeVisible();
    await expect(page.getByLabel("Child 1 name")).toHaveValue("Avery");
    await page.getByLabel("Child 1 name").fill("Avery T.");
    await page.getByRole("button", { name: "Save child profiles" }).click();
    await expect(page).toHaveURL(/\/school$/);
    await expect(page.getByRole("button", { name: /Avery T\./ })).toBeVisible();
  });

  test("fits family setup on an iPhone-sized viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Who is learning?" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
