import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";
const LEARNING_KEY = "adrianos-learning-v1:qa-learner";

async function tapTrackValue(page: import("@playwright/test").Page, value: number, min: number, max: number) {
  const track = page.getByTestId("motion-track");
  const box = await track.boundingBox();
  if (!box) throw new Error("Motion track is not visible.");
  const ratio = (value - min) / (max - min);
  await track.click({ position: { x: Math.max(2, Math.min(box.width - 2, box.width * ratio)), y: box.height / 2 } });
}

function channel(value: number) {
  const next = value / 255;
  return next <= 0.04045 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
}

function contrast(foreground: number[], background: number[]) {
  const luminance = (rgb: number[]) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function rgb(value: string) {
  return value.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
}

test.describe("Math Motion Lab route remix", () => {
  test("starts immediately and lets Grade 2 solve by directly moving the dinosaur", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Dino Canyon Dash", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start moving →" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Solve 27 + 18." })).toBeVisible();
    await expect(page.locator('[data-route-mode="tap"]')).toBeVisible();

    const progressBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PROGRESS_KEY);
    expect(progressBefore.games?.["math-motion-lab"]?.completions ?? 0).toBe(0);

    await tapTrackValue(page, 45, 20, 50);
    await expect(page.getByText("Current position:")).toContainText("45");
    await page.getByRole("button", { name: "Lock in 45" }).click();
    await expect(page.getByRole("status")).toContainText("27 + 18 = 45");

    const learning = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), LEARNING_KEY);
    expect(learning.skills?.["math-word-problems"]?.attempts).toBe(1);
  });

  test("remixes tap, strategy-gate, and turbo controls in one verified run", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });

    await tapTrackValue(page, 45, 20, 50);
    await page.getByRole("button", { name: "Lock in 45" }).click();

    await expect(page.getByRole("heading", { name: "Solve 52 − 17." })).toBeVisible();
    await expect(page.locator('[data-route-mode="power-gate"]')).toBeVisible();
    await tapTrackValue(page, 50, 30, 60);
    await expect(page.locator('[data-gate-cleared="true"]')).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Power gate 50 charged");
    await tapTrackValue(page, 35, 30, 60);
    await page.getByRole("button", { name: "Lock in 35" }).click();

    await expect(page.getByRole("heading", { name: "Count by 5s to 50." })).toBeVisible();
    await expect(page.locator('[data-route-mode="turbo"]')).toBeVisible();
    await page.getByRole("button", { name: "Move forward 25" }).click();
    await page.getByRole("button", { name: "Lock in 50" }).click();

    await expect(page.getByRole("heading", { name: "QA Learner cleared every route!" })).toBeVisible();
    const progress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PROGRESS_KEY);
    expect(progress.games?.["math-motion-lab"]?.completions).toBe(1);

    await page.getByRole("button", { name: "Run a new remix →" }).click();
    await expect(page.locator('[data-route-mode="power-gate"]')).toBeVisible();
  });

  test("keeps movement controls high-contrast, phone-safe, and readable when disabled", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });

    const control = page.getByRole("button", { name: "Move forward 1" });
    await expect(control).toBeVisible();
    const enabledStyle = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, borderColor: style.borderColor, backgroundImage: style.backgroundImage };
    });
    expect(enabledStyle.backgroundImage).toContain("linear-gradient");
    expect(enabledStyle.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(contrast(rgb(enabledStyle.color), [53, 66, 90])).toBeGreaterThan(7);

    await tapTrackValue(page, 45, 20, 50);
    await page.getByRole("button", { name: "Lock in 45" }).click();
    await expect(control).toBeDisabled();
    const disabledStyle = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    expect(contrast(rgb(disabledStyle.color), rgb(disabledStyle.backgroundColor))).toBeGreaterThan(4.5);

    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("keeps motion still when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/math-motion-lab", { waitUntil: "domcontentloaded" });

    const runnerAnimation = await page.locator(".motion-runner").evaluate((element) => getComputedStyle(element).animationName);
    expect(runnerAnimation).toBe("none");
  });
});
