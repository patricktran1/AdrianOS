import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_EMAIL = "parent@example.com";
const FAMILY_KEY = "adrianos-family-v1";
const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const PARENT_KEYS = [
  "adrianos-parent-unlocked",
  "adrianos-weekly-report-unlocked",
  "adrianos-placement-report-unlocked",
  "adrianos-coach-report-unlocked",
  "adrianos-skill-goals-unlocked",
];

async function seedFamilyOnce(page: Page, options: { progress?: boolean; parentUnlocked?: boolean } = {}) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ familyKey, progressKey, parentKeys, progress, parentUnlocked }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("adrianos-family-customized-v1", "yes");
    window.localStorage.setItem(familyKey, JSON.stringify({
      activeProfileId: "qa-learner",
      profiles: [{
        id: "qa-learner",
        name: "QA Learner",
        age: 7,
        emoji: "⭐",
        createdAt: "2026-07-12T00:00:00.000Z",
      }],
      parentPinHash: null,
    }));
    if (progress) {
      window.localStorage.setItem(progressKey, JSON.stringify({ xp: 140, coins: 20, level: 1, games: {}, activity: [] }));
    }
    if (parentUnlocked) {
      for (const key of parentKeys) window.sessionStorage.setItem(key, "yes");
    }
  }, {
    familyKey: FAMILY_KEY,
    progressKey: PROGRESS_KEY,
    parentKeys: PARENT_KEYS,
    progress: options.progress === true,
    parentUnlocked: options.parentUnlocked === true,
  });
}

async function publishSignedInAccount(page: Page) {
  await expect(page.getByTestId("family-account-control-ready")).toBeAttached();
  await page.evaluate((email) => {
    window.dispatchEvent(new CustomEvent("adrianos-cloud-status", {
      detail: {
        phase: "synced",
        message: "Cloud sync is up to date.",
        userEmail: email,
        lastSyncedAt: new Date().toISOString(),
      },
    }));
  }, ACCOUNT_EMAIL);
  await expect(page.getByRole("button", { name: `Family account ${ACCOUNT_EMAIL}` })).toBeVisible();
}

test.describe("public device account security", () => {
  test("normal sign out keeps local learning but locks parent tools", async ({ page }) => {
    await seedFamilyOnce(page, { parentUnlocked: true });
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    await publishSignedInAccount(page);

    await page.getByRole("button", { name: `Family account ${ACCOUNT_EMAIL}` }).click();
    await page.getByRole("button", { name: "Sign out on this device", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    const state = await page.evaluate(({ familyKey, parentKeys }) => ({
      family: JSON.parse(window.localStorage.getItem(familyKey) ?? "{}"),
      parentUnlocks: parentKeys.map((key) => window.sessionStorage.getItem(key)),
    }), { familyKey: FAMILY_KEY, parentKeys: PARENT_KEYS });
    expect(state.family.profiles).toHaveLength(1);
    expect(state.parentUnlocks.every((value: string | null) => value === null)).toBe(true);
  });

  test("shared-computer exit refuses an unconfirmed wipe, then erases only AdrianOS data", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedFamilyOnce(page, { progress: true, parentUnlocked: true });
    await page.evaluate(() => window.localStorage.setItem("unrelated-app-key", "keep-me"));
    await page.goto("/school", { waitUntil: "domcontentloaded" });
    await publishSignedInAccount(page);

    await page.getByRole("button", { name: `Family account ${ACCOUNT_EMAIL}` }).click();
    await page.getByRole("button", { name: "Shared computer: sign out + erase", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Remove this family from the browser?", exact: true })).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Sync, sign out, and erase", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nothing has been erased.", exact: true })).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), FAMILY_KEY)).not.toBeNull();

    await context.setOffline(false);
    await page.getByRole("button", { name: "Erase this device anyway", exact: true }).click();
    await expect(page).toHaveURL(/\/family\/setup\?public=1/);

    const state = await page.evaluate(({ familyKey, progressKey, parentKeys }) => {
      const family = JSON.parse(window.localStorage.getItem(familyKey) ?? "{\"profiles\":[]}");
      return {
        profiles: family.profiles ?? [],
        progress: window.localStorage.getItem(progressKey),
        customized: window.localStorage.getItem("adrianos-family-customized-v1"),
        unrelated: window.localStorage.getItem("unrelated-app-key"),
        parentUnlocks: parentKeys.map((key) => window.sessionStorage.getItem(key)),
        width: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      };
    }, { familyKey: FAMILY_KEY, progressKey: PROGRESS_KEY, parentKeys: PARENT_KEYS });
    expect(state.profiles).toHaveLength(0);
    expect(state.progress).toBeNull();
    expect(state.customized).toBeNull();
    expect(state.unrelated).toBe("keep-me");
    expect(state.parentUnlocks.every((value: string | null) => value === null)).toBe(true);
    expect(state.width).toBeLessThanOrEqual(state.viewport + 1);
  });

  test("Parent Mode automatically locks after inactivity", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __ADRIANOS_PARENT_IDLE_TIMEOUT_MS?: number }).__ADRIANOS_PARENT_IDLE_TIMEOUT_MS = 800;
    });
    await seedFamilyOnce(page, { parentUnlocked: true });

    await page.goto("/parent", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Learning cockpit", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create a parent PIN", exact: true })).toBeVisible({ timeout: 5_000 });

    const unlocks = await page.evaluate((keys) => keys.map((key) => window.sessionStorage.getItem(key)), PARENT_KEYS);
    expect(unlocks.every((value: string | null) => value === null)).toBe(true);
  });
});
