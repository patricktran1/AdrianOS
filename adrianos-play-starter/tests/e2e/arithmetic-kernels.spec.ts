import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildKernelRun, type KernelTask } from "../../lib/kernels/kernel-tasks";
import { buildDeduceRun } from "../../lib/kernels/deduce-tasks";
import { rulingConstraint } from "../../lib/kernels/deduce-constraints";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function readEvidence(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"),
    EVIDENCE_KEY
  );
}

/** Greedy exact composition; kernel trays use canonical denominations. */
function correctPartIds(task: KernelTask): string[] {
  if (task.verb === "place") return [...task.targetIds];
  const parts = [...task.tray].sort((a, b) => b.value - a.value);
  const picks: string[] = [];
  let total = 0;
  for (const part of parts) {
    if (total + part.value <= task.targetValue + 1e-9) {
      picks.push(part.id);
      total += part.value;
      if (Math.abs(total - task.targetValue) < 1e-9) break;
    }
  }
  return picks;
}

async function tapParts(page: Page, ids: string[]) {
  for (const id of ids) await page.locator(`[data-part-id="${id}"]`).click();
}

/** Any selection totalling `value`, for deliberately wrong answers. */
function partsTotalling(task: KernelTask, value: number): string[] {
  const parts = [...task.tray].sort((a, b) => b.value - a.value);
  const picks: string[] = [];
  let total = 0;
  for (const part of parts) {
    if (total + part.value > value) continue;
    picks.push(part.id);
    total += part.value;
    if (total === value) return picks;
  }
  return total === value ? picks : [];
}

/**
 * Arrives the way a session step does.
 *
 * `from=transfer` is an instant-start source: the world already asked the
 * child to make this one choice, so GameStartDirector presses Start for them.
 * A test that presses it too races the director and clicks a detached button,
 * so this waits for the game to be playable instead.
 */
async function arriveFromSession(page: Page, href: string) {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("kernel-check")).toBeVisible({ timeout: 15_000 });
}

test.describe("arithmetic kernels", () => {
  test("a child can build a subtraction, and adding instead is recorded as such", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 3 });
    await arriveFromSession(page, "/games/maker-workshop?skill=math-subtraction&from=transfer");

    const run = buildKernelRun({
      verb: "build",
      profileId: PROFILE_ID,
      grade: 3,
      skillId: "math-subtraction",
      dayKey: todayKey(),
    });
    const first = run[0];
    expect(first.skillId).toBe("math-subtraction");
    await expect(page.getByRole("heading", { name: first.prompt })).toBeVisible();

    // Work the wrong operation: put in the sum rather than the difference.
    const { left, right } = first.operation!;
    const sum = left + right;
    const wrong = partsTotalling(first, sum);
    expect(wrong.length, `tray cannot compose ${sum}`).toBeGreaterThan(0);
    await tapParts(page, wrong);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByText(first.hint)).toBeVisible();

    const afterMiss = await readEvidence(page);
    expect(afterMiss).toHaveLength(1);
    expect(afterMiss[0].skillId).toBe("math-subtraction");
    expect(afterMiss[0].mechanic).toBe("build");
    expect(afterMiss[0].correct).toBe(false);
    // The observation a multiple-choice question could not have made.
    expect(afterMiss[0].errorSignature).toBe("operation.added-instead-of-subtracted");

    // Then get it right; the same skill is credited.
    await tapParts(page, correctPartIds(first));
    await page.getByTestId("kernel-check").click();
    await expect(page.getByTestId("kernel-advance")).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(2);
    expect(rows[1].correct).toBe(true);
    expect(rows[1].skillId).toBe("math-subtraction");
  });

  test("Stepping Stones orders multiplication expressions, not just numbers", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 4 });
    await arriveFromSession(page, "/games/stepping-stones?skill=math-multiplication&from=transfer");

    const run = buildKernelRun({
      verb: "place",
      profileId: PROFILE_ID,
      grade: 4,
      skillId: "math-multiplication",
      dayKey: todayKey(),
    });
    const first = run[0];
    expect(first.skillId).toBe("math-multiplication");

    // Every stone reads as working, never as its own answer.
    for (const part of first.tray) {
      expect(part.label).toMatch(/^\d+ x \d+$/);
      await expect(page.locator(`[data-part-id="${part.id}"]`)).toContainText(part.label);
    }

    await tapParts(page, correctPartIds(first));
    await page.getByTestId("kernel-check").click();
    await expect(page.getByTestId("kernel-advance")).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].skillId).toBe("math-multiplication");
    expect(rows[0].mechanic).toBe("place");
    expect(rows[0].correct).toBe(true);
  });

  test("Clue Hollow says whose answer a clue describes", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 3 });
    await page.goto("/games/clue-hollow?skill=logic-patterns&from=transfer", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("clue-list")).toBeVisible({ timeout: 15_000 });

    const [first] = buildDeduceRun({
      profileId: PROFILE_ID,
      grade: 3,
      skillId: "logic-patterns",
      dayKey: todayKey(),
    });
    expect(first.skillId).toBe("logic-patterns");
    expect(first.voice).toBe("next");

    // A card shows a pattern, so a clue has to say it is about what comes
    // next — "I am more than 10" on a card reading "2, 4, 6, ..." is a
    // different claim.
    const clues = page.getByTestId("clue-list");
    await expect(clues).toContainText("My next number");

    const more = page.getByTestId("deduce-more-clues");
    while (await more.isVisible().catch(() => false)) await more.click();
    for (const candidate of first.candidates) {
      if (candidate.id === first.solutionId) continue;
      if (rulingConstraint(candidate, first.clues, first.candidates)) {
        await page.locator(`[data-candidate-id="${candidate.id}"]`).click();
      }
    }
    // Crossing cards out is not answering: the child claims the one left.
    await expect(page.getByTestId("deduce-claim")).toBeEnabled();
    await page.getByTestId("deduce-claim").click();

    const rows = await readEvidence(page);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].skillId).toBe("logic-patterns");
    expect(rows[0].mechanic).toBe("deduce");
  });
});
