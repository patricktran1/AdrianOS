import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";

test("shows Grade 2 dragon prizes and unlocks one prize per completed game", async ({ page }) => {
  await seedQaFamily(page, { clear: true, grade: 2 });
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify({
      xp: 420,
      coins: 80,
      level: 3,
      games: {
        "number-quest": { plays: 3, completions: 2, bestScore: 900, lastPlayed: "2026-07-12T12:00:00.000Z" },
        "adaptive-boss-arena": { plays: 2, completions: 1, bestScore: 500, lastPlayed: "2026-07-12T12:30:00.000Z" },
      },
      activity: [],
    }));
  }, { key: PROGRESS_KEY });

  await page.goto("/");
  const vault = page.getByRole("region", { name: "Prize Vault" });
  await expect(vault).toBeVisible();
  await expect(vault.getByText("Dragon Treasure Hoard")).toBeVisible();
  await expect(vault.getByLabel("3 of 12 prizes unlocked")).toBeVisible();
  await expect(vault.getByLabel("Dragon Egg unlocked")).toBeVisible();
  await expect(vault.getByLabel("Fire Spark unlocked")).toBeVisible();
  await expect(vault.getByLabel("Castle Key unlocked")).toBeVisible();
  await expect(vault.getByText("Next: 💎 Blue Gem")).toBeVisible();
});

test("gives TK a distinct empty collection", async ({ page }) => {
  await seedQaFamily(page, { clear: true, grade: -1 });
  await page.goto("/");
  const vault = page.getByRole("region", { name: "Prize Vault" });
  await expect(vault.getByText("Critter Parade")).toBeVisible();
  await expect(vault.getByText("Finish any game to open your first prize.")).toBeVisible();
});

test("gives Grade 5 a cyber collection and stays phone safe", async ({ page }) => {
  await seedQaFamily(page, { clear: true, grade: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const vault = page.getByRole("region", { name: "Prize Vault" });
  await expect(vault.getByText("Cyber City Artifact Grid")).toBeVisible();
  await expect(vault.getByText("Next: 💾 Data Disk")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
});
