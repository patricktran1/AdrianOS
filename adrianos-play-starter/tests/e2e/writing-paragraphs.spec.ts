import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildKernelRun, type KernelTask } from "../../lib/kernels/kernel-tasks";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function runFor(grade: number): KernelTask[] {
  return buildKernelRun({
    verb: "place",
    profileId: PROFILE_ID,
    grade: grade as never,
    skillId: "writing-organization",
    difficultyShift: 0,
    dayKey: todayKey(),
  });
}

async function readEvidence(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"),
    EVIDENCE_KEY
  );
}

async function arrive(page: Page, grade: number) {
  await seedQaFamily(page, { clear: true, grade });
  await page.goto("/games/stepping-stones?skill=writing-organization&from=transfer", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("kernel-check")).toBeVisible({ timeout: 15_000 });
}

test.describe("organising a paragraph", () => {
  test("whole sentences are readable, not squeezed into number tiles", async ({ page }) => {
    await arrive(page, 3);
    const task = runFor(3)[0];

    // The surface must have switched to the stacked layout for sentence pieces.
    await expect(page.getByTestId("kernel-tray")).toHaveAttribute("data-long-labels", "true");

    for (const part of task.tray) {
      const tile = page.locator(`[data-part-id="${part.id}"]`);
      await expect(tile).toContainText(part.label);
      // A sentence squeezed into a 64px square wraps into an unreadable
      // column. Full-width rows are what make this playable.
      const box = await tile.boundingBox();
      expect(box, `${part.id} has no box`).toBeTruthy();
      expect(box!.width).toBeGreaterThan(200);
    }
    // And nothing scrolls sideways off the phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("the written order is accepted and recorded as organising", async ({ page }) => {
    await arrive(page, 3);
    const task = runFor(3)[0];

    for (const id of task.targetIds) {
      await page.locator(`[data-part-id="${id}"]`).click();
    }
    await page.getByTestId("kernel-check").click();
    await expect(page.getByTestId("kernel-advance")).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].skillId).toBe("writing-organization");
    expect(rows[0].mechanic).toBe("place");
    expect(rows[0].correct).toBe(true);
    expect(rows[0].correctAnswer).toBe(task.targetLabel);
  });

  test("a wrong order coaches without giving the paragraph away", async ({ page }) => {
    await arrive(page, 3);
    const task = runFor(3)[0];
    const swapped = [...task.targetIds];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];

    for (const id of swapped) await page.locator(`[data-part-id="${id}"]`).click();
    await page.getByTestId("kernel-check").click();
    await expect(page.getByText(task.hint)).toBeVisible();
    // The first miss coaches; it must not print the finished paragraph.
    await expect(page.getByText(task.explanation)).not.toBeVisible();

    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(false);
    expect(rows[0].skillId).toBe("writing-organization");
  });

  test("a paragraph can be ordered with the keyboard alone", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await arrive(page, 1);
    const task = runFor(1)[0];

    for (const id of task.targetIds) {
      const tile = page.locator(`[data-part-id="${id}"]`);
      await tile.focus();
      await page.keyboard.press("Enter");
    }
    const check = page.getByTestId("kernel-check");
    await check.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("kernel-advance")).toBeVisible();
  });
});
