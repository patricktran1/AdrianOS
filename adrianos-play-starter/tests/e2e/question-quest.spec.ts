import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function gameProgress(page: import("@playwright/test").Page) {
  return page.evaluate((key) => {
    const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return progress.games?.["question-quest"] ?? { plays: 0, completions: 0, bestScore: 0 };
  }, PROGRESS_KEY);
}

async function chooseAndWait(
  page: import("@playwright/test").Page,
  answer: string,
  nextRound: number | "complete",
) {
  await page.getByRole("button", { name: answer, exact: true }).click();
  if (nextRound === "complete") {
    await expect(page.locator('[data-wonder-complete="true"]')).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(page.locator('[data-wonder-lab="active"]')).toHaveAttribute("data-round", String(nextRound), { timeout: 5_000 });
  }
}

async function runGauge(
  page: import("@playwright/test").Page,
  label: string,
  value: number,
  nextRound: number | "complete",
) {
  const gauge = page.getByRole("slider", { name: label, exact: true });
  await gauge.focus();
  await gauge.press("Home");
  for (let index = 0; index < value; index += 1) await gauge.press("ArrowRight");
  await expect(gauge).toHaveValue(String(value));
  await page.getByRole("button", { name: "Run experiment", exact: true }).click();
  if (nextRound === "complete") {
    await expect(page.locator('[data-wonder-complete="true"]')).toBeVisible({ timeout: 5_000 });
  } else {
    await expect(page.locator('[data-wonder-lab="active"]')).toHaveAttribute("data-round", String(nextRound), { timeout: 5_000 });
  }
}

test.describe("Question Quest Wonder Lab", () => {
  test("starts inside a real experiment and records honest retry evidence", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/question-quest", { waitUntil: "domcontentloaded" });

    const lab = page.locator('[data-wonder-lab="active"]');
    await expect(lab).toHaveAttribute("data-round", "1");
    await expect(lab).toHaveAttribute("data-mechanic", "assemble");
    await expect(page.getByRole("heading", { name: "Why does a computer need loading time before a game appears?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /next/i })).toHaveCount(0);
    await expect.poll(async () => (await gameProgress(page)).completions ?? 0).toBe(0);

    await page.getByRole("button", { name: "A computer nap", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Wonder clue:");
    await expect(lab).toHaveAttribute("data-round", "1");

    await page.getByRole("button", { name: "It gathers instructions and data", exact: true }).click();
    await expect(lab).toHaveAttribute("data-round", "2", { timeout: 5_000 });

    const learning = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["science-computer-loading"]?.attempts).toBe(2);
    expect(learning.skills?.["science-computer-loading"]?.correct).toBe(1);
  });

  test("assembles, routes, calibrates, and remixes one verified six-chamber run", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/question-quest", { waitUntil: "domcontentloaded" });

    const engine = page.locator('[data-wonder-engine="active"]');
    const firstTheme = await engine.getAttribute("data-lab-theme");

    await chooseAndWait(page, "It gathers instructions and data", 2);
    await expect(page.locator('[data-wonder-lab="active"]')).toHaveAttribute("data-mechanic", "route");
    await chooseAndWait(page, "Cloud charge → air → ground", 3);
    await expect(page.locator('[data-wonder-lab="active"]')).toHaveAttribute("data-mechanic", "calibrate");
    await runGauge(page, "Snowball experiment level", 3, 4);
    await chooseAndWait(page, "Sweat → evaporation → cooling", 5);

    const oxygen = page.getByRole("button", { name: "Oxygen", exact: true });
    await expect(oxygen).toHaveAttribute("draggable", "true");
    await oxygen.dragTo(page.getByLabel("Wonder machine installation bay"));
    await expect(page.locator('[data-wonder-lab="active"]')).toHaveAttribute("data-round", "6", { timeout: 5_000 });

    await runGauge(page, "Energy use experiment level", 0, "complete");
    await expect(page.getByRole("heading", { name: "QA Learner powered the entire Why Lab." })).toBeVisible();
    await expect(engine).toHaveAttribute("data-pods-powered", "6");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 1, completions: 1, bestScore: 6 });

    await page.getByRole("button", { name: "Play again", exact: true }).click();
    const replay = page.locator('[data-wonder-lab="active"]');
    await expect(replay).toHaveAttribute("data-run-seed", "1");
    await expect(replay).toHaveAttribute("data-mechanic", "route");
    await expect(page.getByRole("heading", { name: "Which route best shows how lightning can reach the ground?" })).toBeVisible();
    await expect(page.locator('[data-wonder-engine="active"]')).not.toHaveAttribute("data-lab-theme", firstTheme ?? "");
    await expect.poll(async () => gameProgress(page)).toMatchObject({ plays: 2, completions: 1, bestScore: 6 });
  });

  test("adapts the first experiment through Grade 5 without setup friction", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/question-quest", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-wonder-lab="active"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Which process best explains why a complex program needs loading time?" })).toBeVisible();
    await expect(page.getByText("5-ETS1-1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "It fetches and arranges code, images, and data", exact: true })).toHaveAttribute("data-correct", "true");
    await expect(page.getByRole("button", { name: /start/i })).toHaveCount(0);
  });

  test("stays phone-safe and stops reactor motion for reduced-motion learners", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/question-quest", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-wonder-lab="active"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });

    await expect.poll(async () => page.locator('[data-wonder-reactor="active"]').evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  });
});
