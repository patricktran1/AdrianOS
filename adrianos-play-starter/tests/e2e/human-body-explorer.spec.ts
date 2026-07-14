import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function gameProgress(page: import("@playwright/test").Page) {
  return page.evaluate((key) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return progress.games?.["human-body-explorer"] ?? { plays: 0, completions: 0, bestScore: 0 };
  }, PROGRESS_KEY);
}

async function chooseAndWait(
  page: import("@playwright/test").Page,
  answer: string,
  nextRound: number | "complete",
) {
  await page.getByRole("button", { name: answer, exact: true }).click();
  if (nextRound === "complete") {
    await expect(page.locator('[data-body-complete="true"]')).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(page.locator('[data-body-lab="active"]')).toHaveAttribute("data-round", String(nextRound), { timeout: 5_000 });
  }
}

test.describe("Human Body Rescue Lab", () => {
  test("starts inside the rescue and records honest coached attempts", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/human-body-explorer", { waitUntil: "domcontentloaded" });

    const lab = page.locator('[data-body-lab="active"]');
    const patient = page.locator('[data-body-patient="active"]');
    await expect(lab).toHaveAttribute("data-round", "1");
    await expect(lab).toHaveAttribute("data-mechanic", "scan");
    await expect(page.getByRole("heading", { name: "The patient needs blood moving to every body part. Which organ powers the trip?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);
    await expect(patient).toHaveAttribute("data-systems-online", "0");
    await expect.poll(async () => (await gameProgress(page)).completions ?? 0).toBe(0);

    await page.getByRole("button", { name: "Lungs", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Med-bot clue: Look for the muscular organ that beats in the chest");
    await expect(lab).toHaveAttribute("data-round", "1");

    const heart = page.getByRole("button", { name: "Heart", exact: true });
    await heart.focus();
    await page.keyboard.press("Enter");
    await expect(lab).toHaveAttribute("data-round", "2", { timeout: 5_000 });
    await expect(patient).toHaveAttribute("data-systems-online", "1");

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["health-circulatory-system"]?.attempts).toBe(2);
    expect(learning.skills?.["health-circulatory-system"]?.correct).toBe(1);
  });

  test("mixes scanning, organ placement, and signal routing into one verified rescue", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/human-body-explorer", { waitUntil: "domcontentloaded" });

    const patient = page.locator('[data-body-patient="active"]');
    const firstMode = await patient.getAttribute("data-lab-mode");

    await chooseAndWait(page, "Heart", 2);
    await expect(page.locator('[data-body-lab="active"]')).toHaveAttribute("data-mechanic", "place");

    const lungs = page.getByRole("button", { name: "Lungs", exact: true });
    await expect(lungs).toHaveAttribute("draggable", "true");
    await lungs.dragTo(page.getByLabel("Body repair dock"));
    await expect(page.locator('[data-body-lab="active"]')).toHaveAttribute("data-round", "3", { timeout: 5_000 });
    await expect(page.locator('[data-body-lab="active"]')).toHaveAttribute("data-mechanic", "route");

    await chooseAndWait(page, "Sense → brain → action", 4);
    await chooseAndWait(page, "Stomach", 5);
    await chooseAndWait(page, "Skull", 6);
    await chooseAndWait(page, "Brain → nerves → muscles", "complete");

    await expect(page.getByRole("heading", { name: "QA Learner restored every system." })).toBeVisible();
    await expect(page.locator('[data-body-complete="true"]')).toContainText("6 verified repairs");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 1, completions: 1, bestScore: 6 });

    await page.getByRole("button", { name: "Play again", exact: true }).click();
    const replay = page.locator('[data-body-lab="active"]');
    await expect(replay).toHaveAttribute("data-run-seed", "1");
    await expect(replay).toHaveAttribute("data-mechanic", "place");
    await expect(page.getByRole("heading", { name: "Oxygen must enter the body before the blood can deliver it. Which organ module goes in the chest?" })).toBeVisible();
    await expect(page.locator('[data-body-patient="active"]')).not.toHaveAttribute("data-lab-mode", firstMode ?? "");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 2, completions: 1, bestScore: 6 });
  });

  test("adapts the rescue to Grade 5 without adding setup friction", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/human-body-explorer", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-body-lab="active"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Which organ creates the pressure that drives blood through the circulatory system?" })).toBeVisible();
    await expect(page.getByText("5-LS1-1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Heart", exact: true })).toHaveAttribute("data-correct", "true");
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
  });

  test("stays phone-safe and removes scanner motion when reduced motion is requested", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/human-body-explorer", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-body-lab="active"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });

    await expect.poll(async () => page.locator('[data-repair-pulse="0"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
