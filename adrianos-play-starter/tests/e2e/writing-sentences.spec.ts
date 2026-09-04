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

function runFor(grade: number, skillId: string): KernelTask[] {
  return buildKernelRun({
    verb: "place",
    profileId: PROFILE_ID,
    grade: grade as never,
    skillId,
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

async function tap(page: Page, ids: string[]) {
  for (const id of ids) await page.locator(`[data-part-id="${id}"]`).click();
}

/** `from=transfer` is an instant-start source: the world already pressed Start. */
async function arrive(page: Page, href: string) {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("kernel-check")).toBeVisible({ timeout: 15_000 });
}

test.describe("rebuilding a sentence", () => {
  test("a child builds the sentence and it is recorded as writing", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await arrive(page, "/games/stepping-stones?skill=writing-sentences&from=transfer");
    const task = runFor(2, "writing-sentences")[0];
    expect(task.skillId).toBe("writing-sentences");

    // Every word and the ending mark are on screen as their own tile.
    for (const part of task.tray) {
      await expect(page.locator(`[data-part-id="${part.id}"]`)).toContainText(part.label);
    }

    await tap(page, task.targetIds);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByTestId("kernel-advance")).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].skillId).toBe("writing-sentences");
    expect(rows[0].mechanic).toBe("place");
    expect(rows[0].correct).toBe(true);
    expect(rows[0].correctAnswer).toBe(task.targetLabel);
  });

  test("the ending mark in the wrong place is a miss, and coaching names the rule", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await arrive(page, "/games/stepping-stones?skill=writing-conventions&from=transfer");
    const task = runFor(2, "writing-conventions")[0];
    expect(task.skillId).toBe("writing-conventions");

    // Put the full stop first — the conventions error this task exists for.
    const mark = task.targetIds[task.targetIds.length - 1];
    const rest = task.targetIds.slice(0, -1);
    await tap(page, [mark, ...rest]);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByText(task.hint)).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].skillId).toBe("writing-conventions");
    expect(rows[0].correct).toBe(false);

    // Then build it properly; the same skill is credited.
    await tap(page, task.targetIds);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByTestId("kernel-advance")).toBeVisible();
    const after = await readEvidence(page);
    expect(after[1].correct).toBe(true);
    expect(after[1].skillId).toBe("writing-conventions");
  });

  test("a whole run can be built with the keyboard alone", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 1 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await arrive(page, "/games/stepping-stones?skill=writing-sentences&from=transfer");
    const task = runFor(1, "writing-sentences")[0];

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
