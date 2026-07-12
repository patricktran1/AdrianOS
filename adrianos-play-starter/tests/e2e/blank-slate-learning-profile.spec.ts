import { expect, test } from "@playwright/test";

async function clearStorage(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test.describe("privacy-first family onboarding", () => {
  test("a new device starts with no sample children or game tracking", async ({ page }) => {
    await clearStorage(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Start with your learner." })).toBeVisible();
    await expect(page.getByText("Adrian", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Elliot", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Choose your next mission" })).toHaveCount(0);

    const family = await page.evaluate(() => JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}"));
    expect(family.profiles).toEqual([]);
    expect(family.activeProfileId).toBe("");
    expect(await page.evaluate(() => window.localStorage.getItem("adrianos-progress-v2:unconfigured-learner"))).toBeNull();
  });

  test("removes untouched Adrian and Elliot starter data from older devices", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("adrianos-family-v1", JSON.stringify({
        activeProfileId: "adrian",
        profiles: [
          { id: "adrian", name: "Adrian", age: 7, emoji: "🚀", createdAt: "2026-07-10T00:00:00.000Z" },
          { id: "elliot", name: "Elliot", age: 3, emoji: "🦖", createdAt: "2026-07-10T00:00:00.000Z" },
        ],
        parentPinHash: null,
      }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Start with your learner." })).toBeVisible();
    const family = await page.evaluate(() => JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}"));
    expect(family.profiles).toEqual([]);
  });

  test("keeps direct game routes behind parent setup", async ({ page }) => {
    await clearStorage(page);
    await page.goto("/games/math-blast", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/family\/setup\?first=1/);
    await expect(page.getByRole("heading", { name: "Who is learning?" })).toBeVisible();
  });

  test("creates a learner profile that changes the first School Mode route", async ({ page }) => {
    await clearStorage(page);
    await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Child 1 name").fill("Maya");
    await page.getByRole("button", { name: "Space", exact: true }).click();
    await page.getByRole("button", { name: "Science", exact: true }).click();
    await page.getByLabel("Child 1 daily session length").selectOption("18");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create family and personalize School Mode" }).click();

    await expect(page).toHaveURL(/\/school$/);
    await expect(page.getByRole("heading", { name: "Built around Maya." })).toBeVisible();
    await expect(page.getByText("Space", { exact: true })).toBeVisible();
    await expect(page.getByText("Science", { exact: true })).toBeVisible();
    await expect(page.getByText("18").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find the right starting point" })).toBeVisible();
    await expect(page.getByText(/about 18 minutes/)).toBeVisible();

    const saved = await page.evaluate(() => {
      const family = JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}");
      const profileId = family.profiles?.[0]?.id;
      const learning = JSON.parse(window.localStorage.getItem(`adrianos-learning-v1:${profileId}`) ?? "{}");
      const profile = learning.reviewQueue?.find((row: { id?: string }) => row.id === "learner-profile-settings");
      const session = learning.reviewQueue?.find((row: { id?: string }) => String(row.id ?? "").startsWith("daily-session:"));
      return { family, profile, session };
    });

    expect(saved.family.profiles).toHaveLength(1);
    expect(saved.family.profiles[0].name).toBe("Maya");
    expect(JSON.parse(saved.profile.data.interestsJson)).toContain("Space");
    expect(JSON.parse(saved.profile.data.prioritiesJson)).toEqual(expect.arrayContaining(["Reading", "Science"]));
    expect(saved.profile.data.sessionMinutes).toBe(18);
    expect(JSON.parse(saved.session.data.sessionJson).missions[0].gameSlug).toBe("placement-adventure");
  });
});
