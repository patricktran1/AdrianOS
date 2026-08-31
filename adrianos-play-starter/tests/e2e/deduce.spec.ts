import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildDeduceRun, type DeduceTask } from "../../lib/kernels/deduce-tasks";
import { rulingConstraint } from "../../lib/kernels/deduce-constraints";
import { buildLearnerModel, chooseLearningIntent } from "../../lib/adrian-learner-model";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function readEvidence(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), EVIDENCE_KEY);
}

async function startHunt(page: Page, query = "") {
  await page.goto(`/games/clue-hollow${query}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start the hunt/ }).click();
}

/** Reveals every clue, then crosses out exactly what the clues exclude. */
async function reasonItOut(page: Page, task: DeduceTask) {
  const more = page.getByTestId("deduce-more-clues");
  while (await more.isVisible().catch(() => false)) await more.click();
  for (const candidate of task.candidates) {
    if (candidate.id === task.solutionId) continue;
    if (rulingConstraint(candidate, task.clues, task.candidates)) {
      await page.locator(`[data-candidate-id="${candidate.id}"]`).click();
    }
  }
}

function deduceRun(grade: number, skillId: string) {
  return buildDeduceRun({
    profileId: PROFILE_ID,
    grade: grade as never,
    skillId,
    dayKey: todayKey(),
  });
}

/** Model-led world: School Mode off so the beacon follows the evidence. */
async function seedModelLedWorld(page: Page, rows: unknown[]) {
  await page.addInitScript((evidence) => {
    window.localStorage.setItem("adrianos-evidence-v1:qa-learner", JSON.stringify(evidence));
    const key = "adrianos-learning-v1:qa-learner";
    const learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    const queue = Array.isArray(learning.reviewQueue) ? learning.reviewQueue : [];
    queue.push({
      id: "learning-schedule",
      gameSlug: "adrianos-learning-schedule",
      skillId: "learning-schedule",
      subject: "Learning Skills",
      prompt: "Weekly learning schedule",
      correctAnswer: "",
      dueAt: "9999-12-31T23:59:59.999Z",
      updatedAt: new Date().toISOString(),
      successes: 0,
      status: "resolved",
      data: {
        scheduleJson: JSON.stringify({
          version: 1,
          days: {
            monday: "full", tuesday: "full", wednesday: "full", thursday: "full",
            friday: "full", saturday: "full", sunday: "full",
          },
          fullMinutes: 12,
          lightMinutes: 6,
          schoolMode: false,
          libraryAfterSession: true,
          updatedAt: new Date().toISOString(),
        }),
      },
    });
    window.localStorage.setItem(key, JSON.stringify({ ...learning, reviewQueue: queue }));
  }, rows);
}

function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    at: new Date(Date.now() - (40 - index) * 60_000).toISOString(),
    gameSlug: "maker-workshop",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "Build the number 47.",
    correctAnswer: "47",
    givenAnswer: "47",
    correct: true,
    responseMs: 2600,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "1.NBT.B.3",
    mechanic: "build",
    taskId: `task-${index}`,
    errorSignature: null,
    reasoned: null,
    ...overrides,
  };
}

test.describe("Clue Hollow", () => {
  test("working the clues records a reasoned solve", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];

    // Claiming is impossible until the child has narrowed the field.
    await expect(page.getByTestId("deduce-claim")).toBeDisabled();
    await reasonItOut(page, task);
    await expect(page.getByTestId("deduce-claim")).toBeEnabled();
    await page.getByTestId("deduce-claim").click();

    const rows = await readEvidence(page);
    expect(rows.length).toBe(1);
    expect(rows[0].mechanic).toBe("deduce");
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(true);
    expect(rows[0].errorSignature).toBeNull();
    expect(rows[0].taskId).toBeTruthy();
  });

  test("a lucky sweep is correct but is not recorded as reasoning", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];

    // No extra clues asked for; simply cross out everything but the answer.
    for (const candidate of task.candidates) {
      if (candidate.id === task.solutionId) continue;
      await page.locator(`[data-candidate-id="${candidate.id}"]`).click();
    }
    await page.getByTestId("deduce-claim").click();

    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(false);
  });

  test("crossing everything out is not a route to an answer", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];

    for (const candidate of task.candidates) {
      await page.locator(`[data-candidate-id="${candidate.id}"]`).click();
    }
    await expect(page.getByTestId("deduce-claim")).toBeDisabled();
    await expect(page.getByTestId("deduce-claim")).toContainText("0 could still be it");
    expect((await readEvidence(page)).length).toBe(0);
  });

  test("a card crossed out too early can be brought back", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    const answer = page.locator(`[data-candidate-id="${task.solutionId}"]`);

    await answer.click();
    await expect(answer).toHaveAttribute("data-ruled-out", "true");
    await answer.click();
    await expect(answer).toHaveAttribute("data-ruled-out", "false");
    // Recovering is not punished: a clean solve is still available.
    await reasonItOut(page, task);
    await page.getByTestId("deduce-claim").click();
    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(true);
  });

  test("spamming the claim button records exactly one attempt", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    await reasonItOut(page, task);

    const claim = page.getByTestId("deduce-claim");
    await claim.dispatchEvent("click");
    await claim.dispatchEvent("click");
    await claim.dispatchEvent("click");
    await expect(page.getByTestId("deduce-advance")).toBeVisible();
    expect((await readEvidence(page)).length).toBe(1);
  });

  test("a refresh mid-mystery does not leave a half-recorded attempt", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    await page.locator(`[data-candidate-id="${task.candidates[0].id}"]`).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    // Nothing was claimed, so nothing was recorded.
    expect((await readEvidence(page)).length).toBe(0);
  });

  test("card state is readable without relying on colour", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    const first = page.locator(`[data-candidate-id="${task.candidates[0].id}"]`);

    await expect(first).toContainText(/could be/i);
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await first.click();
    // Text, ARIA state and a data attribute all carry it — not just a tint.
    await expect(first).toContainText(/ruled out/i);
    await expect(first).toHaveAttribute("aria-pressed", "true");
  });

  test("a keyboard-only child under reduced motion can solve a mystery", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/clue-hollow?skill=math-place-value", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start the hunt/ }).focus();
    await page.keyboard.press("Enter");

    const task = deduceRun(2, "math-place-value")[0];
    const more = page.getByTestId("deduce-more-clues");
    while (await more.isVisible().catch(() => false)) {
      await more.focus();
      await page.keyboard.press("Enter");
    }
    for (const candidate of task.candidates) {
      if (candidate.id === task.solutionId) continue;
      if (rulingConstraint(candidate, task.clues, task.candidates)) {
        await page.locator(`[data-candidate-id="${candidate.id}"]`).focus();
        await page.keyboard.press("Enter");
      }
    }
    await page.getByTestId("deduce-claim").focus();
    await page.keyboard.press("Enter");

    const rows = await readEvidence(page);
    expect(rows[0].reasoned).toBe(true);
    await context.close();
  });

  test("the whole hunt fits a phone in landscape", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 740, height: 360 } });
    const page = await context.newPage();
    await seedQaFamily(page, { clear: true, grade: 0 });
    await startHunt(page);
    await expect(page.getByTestId("deduce-candidates")).toBeVisible();
    await expect(page.getByTestId("clue-list")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });

  test("the world routes a build-and-place learner into inference", async ({ page }) => {
    // Secure constructing and positioning, never asked to infer.
    const evidence = [
      ...Array.from({ length: 8 }, (_, index) => row(index, { taskId: `b-${index}` })),
      ...Array.from({ length: 8 }, (_, index) =>
        row(8 + index, {
          mechanic: "place",
          gameSlug: "stepping-stones",
          taskId: `p-${index}`,
        })
      ),
    ];
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedModelLedWorld(page, evidence);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const decision = chooseLearningIntent(buildLearnerModel(PROFILE_ID, evidence as never));
    expect(decision.intent).toBe("transfer");
    expect(decision.preferredHref).toContain("clue-hollow");

    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toBeVisible();
    await expect(beacon).toContainText("Clue Hollow");
    await beacon.click();
    await page.waitForURL(/\/games\//);
    expect(page.url()).toContain("clue-hollow");
    expect(page.url()).toContain("skill=math-place-value");

    // And the child is invited, not assessed.
    await expect(page.getByText(/find it from clues/i)).toBeVisible();
  });
});
