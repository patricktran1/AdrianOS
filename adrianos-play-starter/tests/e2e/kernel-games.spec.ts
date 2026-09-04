import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import {
  buildKernelRun,
  type KernelTask,
} from "../../lib/kernels/kernel-tasks";
import { buildLearnerModel } from "../../lib/adrian-learner-model";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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
  for (const id of ids) {
    await page.locator(`[data-part-id="${id}"]`).click();
  }
}

async function solveRound(page: Page, task: KernelTask, last: boolean) {
  await tapParts(page, correctPartIds(task));
  await page.getByTestId("kernel-check").click();
  const advance = page.getByTestId("kernel-advance");
  await expect(advance).toBeVisible();
  await advance.click();
  if (!last) {
    // The next round begins with an empty selection, so Check is disabled.
    await expect(page.getByTestId("kernel-check")).toBeDisabled();
  }
}

async function readEvidence(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"),
    EVIDENCE_KEY
  );
}

test.describe("interaction kernels", () => {
  test("Maker Workshop records build-mechanic evidence for a full run", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/maker-workshop", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start building/ }).click();

    const run = buildKernelRun({
      verb: "build",
      profileId: PROFILE_ID,
      grade: 2,
      dayKey: todayKey(),
    });

    // Round 1 also proves spam-tapping Check cannot double-record: two click
    // events in quick succession must produce exactly one evidence row.
    await tapParts(page, correctPartIds(run[0]));
    const check = page.getByTestId("kernel-check");
    await check.dispatchEvent("click");
    await check.dispatchEvent("click");
    await expect(page.getByTestId("kernel-advance")).toBeVisible();
    expect((await readEvidence(page)).length).toBe(1);
    await page.getByTestId("kernel-advance").click();

    for (let index = 1; index < run.length; index += 1) {
      await solveRound(page, run[index], index === run.length - 1);
    }
    await expect(page.getByRole("button", { name: /Play again/ })).toBeVisible();

    const rows = await readEvidence(page);
    expect(rows.length).toBe(run.length);
    for (const row of rows) {
      expect(row.gameSlug).toBe("maker-workshop");
      expect(row.mechanic).toBe("build");
      expect(row.correct).toBe(true);
      expect(typeof row.givenAnswer).toBe("string");
      expect(row.givenAnswer.length).toBeGreaterThan(0);
      expect(row.skillId).toBe("math-place-value");
    }

    const completions = await page.evaluate(() => {
      const progress = JSON.parse(window.localStorage.getItem("adrianos-progress-v2:qa-learner") ?? "{}");
      return progress?.games?.["maker-workshop"]?.completions ?? 0;
    });
    expect(completions).toBeGreaterThanOrEqual(1);
  });

  test("Stepping Stones coaches a miss, reveals after two, and records what was made", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/stepping-stones", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Start crossing/ }).click();

    const run = buildKernelRun({
      verb: "place",
      profileId: PROFILE_ID,
      grade: 2,
      dayKey: todayKey(),
    });
    const first = run[0];
    const rightIds = correctPartIds(first);
    const wrongIds = [...rightIds].reverse();

    // First miss: the strategy hint appears and the selection clears.
    await tapParts(page, wrongIds);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByText(first.hint)).toBeVisible();
    await expect(page.getByTestId("kernel-advance")).not.toBeVisible();

    // Second miss: the worked answer appears and the round can move on, so a
    // child is never trapped.
    await tapParts(page, wrongIds);
    await page.getByTestId("kernel-check").click();
    await expect(page.getByText(first.explanation)).toBeVisible();
    await page.getByTestId("kernel-advance").click();

    for (let index = 1; index < run.length; index += 1) {
      await solveRound(page, run[index], index === run.length - 1);
    }
    await expect(page.getByRole("button", { name: /Play again/ })).toBeVisible();

    const rows = await readEvidence(page);
    // Two recorded misses on round one, then four solved rounds.
    expect(rows.length).toBe(run.length + 1);
    const misses = rows.filter((row: { correct: boolean }) => !row.correct);
    expect(misses.length).toBe(2);
    for (const miss of misses) {
      expect(miss.mechanic).toBe("place");
      // The canonical answer is the sequence actually laid, so the same
      // mistake clusters as the same misconception.
      expect(miss.givenAnswer).toBe(
        wrongIds
          .map((id) => first.tray.find((part) => part.id === id)?.label)
          .join(", ")
      );
    }
    expect(misses[1].hintsUsed).toBe(1);
  });

  test("a keyboard-only child can play with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await seedQaFamily(page, { clear: true, grade: 0 });
    await page.goto("/games/maker-workshop", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Start building/ }).focus();
    await page.keyboard.press("Enter");

    const run = buildKernelRun({
      verb: "build",
      profileId: PROFILE_ID,
      grade: 0,
      dayKey: todayKey(),
    });
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
    await context.close();
  });

  test("the transfer loop closes: fluent choosing routes to building, and breadth flips", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.addInitScript(() => {
      // Sixteen fluent place-value answers, all chosen from options: reliable
      // in exactly one interaction form.
      const rows = Array.from({ length: 16 }, (_, index) => ({
        at: new Date(Date.now() - (16 - index) * 60_000).toISOString(),
        gameSlug: "number-quest",
        subject: "Math",
        skillId: "math-place-value",
        skillLabel: "Place value",
        prompt: "In 147, what digit is in the tens place?",
        correctAnswer: "4",
        givenAnswer: "4",
        correct: true,
        responseMs: 2600,
        hintsUsed: 0,
        wrongAttempts: 0,
        standardCode: "2.NBT.B.5",
      }));
      window.localStorage.setItem("adrianos-evidence-v1:qa-learner", JSON.stringify(rows));

      // School Mode off leaves the learner model in charge of the beacon.
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
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
    await expect(beacon).toBeVisible();
    await beacon.click();
    await page.waitForURL(/\/games\/maker-workshop\?skill=math-place-value&from=transfer/);

    // The invitation is a game, not an assessment.
    await expect(page.getByText(/brand-new way/i)).toBeVisible();
    // A planner destination starts itself; the click races that and either
    // outcome leaves the tray on screen.
    await page.getByRole("button", { name: /Start building/ })
      .click({ timeout: 3_000 })
      .catch(() => {});
    await page.locator("[data-part-id]").first().waitFor({ timeout: 15_000 });

    const run = buildKernelRun({
      verb: "build",
      profileId: PROFILE_ID,
      grade: 2,
      skillId: "math-place-value",
      dayKey: todayKey(),
    });
    for (let index = 0; index < run.length; index += 1) {
      expect(run[index].skillId).toBe("math-place-value");
      await solveRound(page, run[index], index === run.length - 1);
    }

    // The exact evidence the browser recorded, judged by the same model the
    // app ships: the skill is now demonstrated in two interaction forms.
    const rows = await readEvidence(page);
    const model = buildLearnerModel(PROFILE_ID, rows);
    const skill = model.skills.find((row) => row.skillId === "math-place-value");
    expect(skill?.grasp).toBe("cross-context");
    expect([...(skill?.secureMechanics ?? [])].sort()).toEqual(["build", "choose"]);
  });
});
