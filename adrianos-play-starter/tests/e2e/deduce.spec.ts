import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildDeduceRun, type DeduceTask } from "../../lib/kernels/deduce-tasks";
import { rulingConstraint, satisfies } from "../../lib/kernels/deduce-constraints";
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

/**
 * Crossing a card out is two taps: the card, then the clue that rules it out.
 * A tap on a card asks a question and answers nothing, which is what stops a
 * child reading the answer off the surface's replies.
 */
async function strike(page: Page, task: DeduceTask, candidateId: string, clueIndex: number) {
  await page.locator(`[data-candidate-id="${candidateId}"]`).click();
  await page.getByTestId(`deduce-clue-${clueIndex}`).click();
}

/** The clue that actually rules a card out, or -1. */
function rulingIndex(task: DeduceTask, candidate: DeduceTask["candidates"][number]) {
  return task.clues.findIndex((clue) => !satisfies(candidate, clue, task.candidates));
}

/** Reveals every clue, then crosses out each card under the clue that rules it out. */
async function reasonItOut(page: Page, task: DeduceTask) {
  const more = page.getByTestId("deduce-more-clues");
  while (await more.isVisible().catch(() => false)) await more.click();
  for (const candidate of task.candidates) {
    if (candidate.id === task.solutionId) continue;
    if (rulingConstraint(candidate, task.clues, task.candidates)) {
      await strike(page, task, candidate.id, rulingIndex(task, candidate));
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

    // No extra clues asked for; cross out everything but the answer, naming
    // clue 1 for all of them rather than reading which one actually rules
    // each card out.
    for (const candidate of task.candidates) {
      if (candidate.id === task.solutionId) continue;
      await strike(page, task, candidate.id, 0);
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
      await strike(page, task, candidate.id, 0);
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

    await strike(page, task, task.solutionId, 0);
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

  /*
   * The strategy that beat the shipped verb, played out.
   *
   * The old surface answered every tap: "Hmm — no clue says it can't be that
   * one yet" for a card nothing ruled out, "Good spot" for one that was. So a
   * child could reveal every clue, tap each card in turn, and read the answer
   * off the replies — 100% correct and 100% recorded as reasoning over 40,320
   * puzzles, against 26% for guessing. Tapping a card back also erased the
   * record of having tried it.
   *
   * A tap now asks a question instead of answering one, so the probe returns
   * nothing to learn from.
   */
  test("tapping every card tells the child nothing about which is the answer", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    const more = page.getByTestId("deduce-more-clues");
    while (await more.isVisible().catch(() => false)) await more.click();

    const said: string[] = [];
    for (const candidate of task.candidates) {
      const card = page.locator(`[data-candidate-id="${candidate.id}"]`);
      await card.click();
      said.push((await page.getByTestId("deduce-message").innerText()).trim());
      await card.click(); // take the question back
    }

    // Every card produced the same shape of reply — the child's own words
    // handed back. Nothing separates the answer from the rest.
    const shapes = said.map((line) => line.replace(/it can't be .*$/, "it can't be X"));
    expect(new Set(shapes).size).toBe(1);
    // And nothing was recorded, because nothing was claimed.
    expect((await readEvidence(page)).length).toBe(0);
  });

  /*
   * The other half: even with the answer known, a child who cannot say which
   * clue rules each card out is not recorded as having reasoned.
   */
  test("knowing the answer is not the same as being able to say why", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    const more = page.getByTestId("deduce-more-clues");
    while (await more.isVisible().catch(() => false)) await more.click();

    // Spare the right card — but name a clue that does not rule out the card
    // being crossed, wherever such a clue exists.
    for (const candidate of task.candidates) {
      if (candidate.id === task.solutionId) continue;
      const wrong = task.clues.findIndex((clue) => satisfies(candidate, clue, task.candidates));
      await strike(page, task, candidate.id, wrong >= 0 ? wrong : rulingIndex(task, candidate));
    }
    await page.getByTestId("deduce-claim").click();

    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(true);
    // The evidence log keeps a fixed set of fields and drops everything else,
    // so what the model sees of this is exactly one thing: not reasoned.
    expect(rows[0].reasoned).toBe(false);
  });

  test("a refresh mid-mystery does not leave a half-recorded attempt", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startHunt(page, "?skill=math-place-value");
    const task = deduceRun(2, "math-place-value")[0];
    await strike(page, task, task.candidates[0].id, 0);
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
    // Waiting for its clue, and the card says so rather than only glowing.
    await expect(first).toContainText(/which clue/i);
    await page.getByTestId("deduce-clue-0").click();
    // Text, ARIA state and a data attribute all carry it — not just a tint.
    // The card wears the clue the child named, so a wrong reason stays visible.
    await expect(first).toContainText(/clue 1/i);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveAttribute("data-struck-by", "0");
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
        await page.getByTestId(`deduce-clue-${rulingIndex(task, candidate)}`).focus();
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
