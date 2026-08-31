import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildKernelRun, type KernelTask } from "../../lib/kernels/kernel-tasks";
import { buildLearnerModel, chooseLearningIntent } from "../../lib/adrian-learner-model";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Composes the target exactly, greedily; kernel trays are canonical. */
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

/** Builds only the ones digit: the tens-omitted structural error. */
function tensOmittedPartIds(task: KernelTask): string[] {
  const ones = task.tray.filter((part) => part.value === 1);
  return ones.slice(0, task.targetValue % 10).map((part) => part.id);
}

async function readEvidence(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), EVIDENCE_KEY);
}

/** Turns School Mode off so the learner model owns the beacon. */
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
    gameSlug: "number-quest",
    subject: "Math",
    skillId: "math-place-value",
    skillLabel: "Place value",
    prompt: "In 268, what digit is in the tens place?",
    correctAnswer: "47",
    givenAnswer: "47",
    correct: true,
    responseMs: 4200,
    hintsUsed: 0,
    wrongAttempts: 0,
    standardCode: "2.NBT.B.5",
    mechanic: "choose",
    taskId: `task-${index}`,
    errorSignature: null,
    ...overrides,
  };
}

test.describe("teaching decisions in the world", () => {
  test("a repeated structural error is recorded with its signature while playing", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/maker-workshop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start building/ }).click();

    const run = buildKernelRun({ verb: "build", profileId: PROFILE_ID, grade: 2, dayKey: todayKey() });

    // Leave the tens out of three different numbers, exactly as a child
    // working only with the ones digit would.
    for (let index = 0; index < 3; index += 1) {
      const task = run[index];
      for (const id of tensOmittedPartIds(task)) {
        await page.locator(`[data-part-id="${id}"]`).click();
      }
      await page.getByTestId("kernel-check").click();
      // First miss coaches; miss the same way again to reach the reveal.
      if (!(await page.getByTestId("kernel-advance").isVisible().catch(() => false))) {
        for (const id of tensOmittedPartIds(task)) {
          await page.locator(`[data-part-id="${id}"]`).click();
        }
        await page.getByTestId("kernel-check").click();
      }
      await page.getByTestId("kernel-advance").click();
    }

    const rows = await readEvidence(page);
    const signed = rows.filter(
      (entry: { errorSignature: string | null }) => entry.errorSignature === "place-value.tens-omitted"
    );
    expect(signed.length).toBeGreaterThanOrEqual(3);
    // Three distinct tasks, so this is independent evidence rather than one
    // question retried.
    const tasks = new Set(signed.map((entry: { taskId: string }) => entry.taskId));
    expect(tasks.size).toBe(3);
    for (const entry of signed) {
      expect(entry.mechanic).toBe("build");
      expect(entry.correct).toBe(false);
    }
  });

  test("a lone slip leaves the world where it was, a pattern moves it", async ({ page, browser }) => {
    // Learner A: twelve wins and one odd miss.
    const slip = [
      ...Array.from({ length: 12 }, (_, index) => row(index)),
      row(12, { correct: false, givenAnswer: "3", errorSignature: "place-value.tens-omitted", taskId: "odd" }),
    ];
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedModelLedWorld(page, slip);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const slipBeacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(slipBeacon).toBeVisible();
    // Landmarks navigate through the router, so the destination is the URL
    // the beacon actually travels to.
    await slipBeacon.click();
    await page.waitForURL(/\/games\//);
    const slipUrl = page.url();

    // The model itself must agree this is not remediation.
    const slipIntent = chooseLearningIntent(buildLearnerModel(PROFILE_ID, slip as never));
    expect(["reteach", "prerequisite", "scaffold"]).not.toContain(slipIntent.intent);

    // Learner B: the same structural error across five different tasks.
    const pattern = [
      ...Array.from({ length: 6 }, (_, index) => row(index)),
      ...Array.from({ length: 5 }, (_, index) =>
        row(6 + index, {
          correct: false,
          givenAnswer: String(index + 2),
          errorSignature: "place-value.tens-omitted",
          taskId: `pv-${index}`,
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        row(11 + index, { correct: false, givenAnswer: "1", taskId: `misc-${index}` })
      ),
    ];
    // A separate context, not just a second page: pages in one context share
    // localStorage, so the two learners' evidence would overwrite each other.
    const secondContext = await browser.newContext();
    const second = await secondContext.newPage();
    await seedQaFamily(second, { clear: true, grade: 2 });
    await seedModelLedWorld(second, pattern);
    await second.goto("/", { waitUntil: "domcontentloaded" });
    const patternBeacon = second.locator('[data-world-landmark][data-beacon="true"]');
    await expect(patternBeacon).toBeVisible();
    // The invitation stays a game, never an assessment.
    const guide = await second.locator("body").innerText();
    await patternBeacon.click();
    await second.waitForURL(/\/games\//);
    const patternUrl = second.url();

    // The repeated pattern must send the child somewhere they can build the
    // idea by hand, and that must differ from the untouched slip route.
    expect(patternUrl).toContain("maker-workshop");
    expect(patternUrl).toContain("skill=math-place-value");
    expect(patternUrl).not.toBe(slipUrl);

    expect(guide).not.toMatch(/misconception|error pattern|weak|behind|struggl/i);
    await secondContext.close();
  });

  test("a reteach run arrives smaller and already showing the strategy", async ({ page }) => {
    const pattern = [
      ...Array.from({ length: 6 }, (_, index) => row(index)),
      ...Array.from({ length: 5 }, (_, index) =>
        row(6 + index, {
          correct: false,
          givenAnswer: String(index + 2),
          errorSignature: "place-value.tens-omitted",
          taskId: `pv-${index}`,
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        row(11 + index, { correct: false, givenAnswer: "1", taskId: `misc-${index}` })
      ),
    ];
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedModelLedWorld(page, pattern);
    await page.goto("/games/maker-workshop?skill=math-place-value&from=teaching", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: /Start building/ }).click();

    // The coaching line is on screen before anything has gone wrong, which
    // is what "reteach" means for the child: help first, not help after.
    const easier = buildKernelRun({
      verb: "build", profileId: PROFILE_ID, grade: 2,
      skillId: "math-place-value", difficultyShift: -1, dayKey: todayKey(),
    });
    await expect(page.getByText(easier[0].hint)).toBeVisible();
    await expect(page.locator('[data-part-id]').first()).toBeVisible();
  });

  test("BUILD secure and PLACE weak sends the child to the weaker form", async ({ page }) => {
    const mixed = [
      ...Array.from({ length: 8 }, (_, index) =>
        row(index, { mechanic: "build", gameSlug: "maker-workshop", taskId: `b-${index}` })
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        row(8 + index, {
          mechanic: "place",
          gameSlug: "stepping-stones",
          correct: false,
          givenAnswer: "74",
          taskId: `p-${index}`,
        })
      ),
    ];
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedModelLedWorld(page, mixed);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toBeVisible();
    await expect(beacon).toContainText("Stepping Stones");
    await beacon.click();
    await page.waitForURL(/\/games\//);
    expect(page.url()).toContain("stepping-stones");
    expect(page.url()).toContain("skill=math-place-value");

    const decision = chooseLearningIntent(buildLearnerModel(PROFILE_ID, mixed as never));
    expect(decision.intent).toBe("represent");
    // The skill is fine; only this form is new, so the level must hold.
    expect(decision.difficultyShift).toBe(0);
  });

  test("the parent panel explains the observation and the action in plain words", async ({ page }) => {
    const pattern = [
      ...Array.from({ length: 6 }, (_, index) => row(index)),
      ...Array.from({ length: 5 }, (_, index) =>
        row(6 + index, {
          correct: false,
          givenAnswer: String(index + 2),
          errorSignature: "place-value.tens-omitted",
          taskId: `pv-${index}`,
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        row(11 + index, { correct: false, givenAnswer: "1", taskId: `misc-${index}` })
      ),
    ];
    await seedQaFamily(page, { clear: true, grade: 2 });
    await seedModelLedWorld(page, pattern);
    await page.goto("/parent", { waitUntil: "domcontentloaded" });

    const notes = page.locator('[data-teaching-notes="present"]');
    await expect(notes).toBeVisible();
    const text = await notes.innerText();
    expect(text).toMatch(/left the tens out/);
    expect(text).toMatch(/different/);
    // Never a probability, a deficit, or a claim about the child's mind.
    expect(text).not.toMatch(/probability|deficit|disorder|does not understand|AI detected/i);
  });

  test("keyboard play with reduced motion still records structured evidence", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/maker-workshop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start building/ }).focus();
    await page.keyboard.press("Enter");

    const run = buildKernelRun({ verb: "build", profileId: PROFILE_ID, grade: 2, dayKey: todayKey() });
    for (const id of correctPartIds(run[0])) {
      await page.locator(`[data-part-id="${id}"]`).focus();
      await page.keyboard.press("Enter");
    }
    await page.getByTestId("kernel-check").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("kernel-advance")).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows.length).toBe(1);
    expect(rows[0].correct).toBe(true);
    expect(rows[0].taskId).toBeTruthy();
    expect(rows[0].errorSignature).toBeNull();
    await context.close();
  });

  test("phone landscape keeps the whole kernel usable", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 740, height: 360 } });
    const page = await context.newPage();
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/maker-workshop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start building/ }).click();
    await expect(page.getByTestId("kernel-tray")).toBeVisible();
    await expect(page.getByTestId("kernel-check")).toBeVisible();
    // No horizontal scroll: the tray wraps rather than running off-screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });
});
