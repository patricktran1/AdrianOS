import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildKernelRun, type KernelTask } from "../../lib/kernels/kernel-tasks";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;
const SESSION_KEY = `adrianos-session-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function row(index: number, overrides: Record<string, unknown> = {}) {
  return {
    at: new Date(Date.now() - (90 - index) * 60_000).toISOString(),
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

const SECURE_BUILD = Array.from({ length: 10 }, (_, index) => row(index, { taskId: `b-${index}` }));
const SECURE_BUILD_AND_PLACE = [
  ...SECURE_BUILD,
  ...Array.from({ length: 8 }, (_, index) =>
    row(20 + index, { mechanic: "place", gameSlug: "stepping-stones", taskId: `p-${index}` })
  ),
  // Counting, secure and independent. A warm start has to be a skill the
  // session is not about, or it is the same activity twice.
  ...Array.from({ length: 6 }, (_, index) =>
    row(40 + index, {
      skillId: "math-counting",
      skillLabel: "Counting",
      prompt: "Build the number 12.",
      correctAnswer: "12",
      givenAnswer: "12",
      taskId: `c-${index}`,
    })
  ),
];

/**
 * Writes once and survives navigation.
 *
 * An init script would re-run on every page load, which silently resets the
 * evidence a session is supposed to be accumulating.
 */
async function seedEvidence(page: Page, rows: unknown[]) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, evidence }) => window.localStorage.setItem(key, JSON.stringify(evidence)),
    { key: EVIDENCE_KEY, evidence: rows }
  );
}

async function storedPlan(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), SESSION_KEY);
}

/**
 * The plan is written by an effect, so a visible beacon does not guarantee it
 * has landed in storage yet. Reading it too early gave a runner-speed-
 * dependent failure rather than a real one.
 */
async function waitForPlan(page: Page) {
  await expect
    .poll(async () => (await storedPlan(page))?.goals?.length ?? 0, { timeout: 15_000 })
    .toBeGreaterThan(0);
  return storedPlan(page);
}

async function openWorld(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const beacon = page.locator('[data-world-landmark][data-beacon="true"]');
  await expect(beacon).toBeVisible();
  return beacon;
}

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

/** Plays whatever kernel run the current URL is showing, correctly. */
async function playKernelRun(page: Page, grade = 2) {
  const url = new URL(page.url());
  const slug = url.pathname.split("/")[2];
  const skillId = url.searchParams.get("skill") ?? "math-place-value";
  const verb = slug === "maker-workshop" ? "build" : "place";
  const firstPart = page.locator("[data-part-id]").first();
  // The click races the director's own auto-start; either way the tray is
  // what the run needs.
  await page.getByRole("button", { name: /Start/ }).first()
    .click({ timeout: 3_000 })
    .catch(() => {});
  await firstPart.waitFor({ timeout: 15_000 });
  const run = buildKernelRun({
    profileId: PROFILE_ID,
    verb,
    grade: grade as never,
    skillId,
    dayKey: todayKey(),
  });
  for (const task of run) {
    for (const id of correctPartIds(task)) await page.locator(`[data-part-id="${id}"]`).click();
    await page.getByTestId("kernel-check").click();
    const advance = page.getByTestId("kernel-advance");
    if (await advance.isVisible().catch(() => false)) await advance.click();
  }
}

test.describe("session planner", () => {
  /*
   * These play a whole activity and then wait out the pause the product puts
   * between a win and the next stop — 3.8s, plus a grace period if the
   * session is still working out where to go. Two of those plus a five-round
   * kernel run does not fit the suite's 30s default, on any runner.
   */
  test.describe.configure({ timeout: 90_000 });

  test("the world opens on something the child can already do", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    const beacon = await openWorld(page);

    await expect(page.locator('[data-world-guide="true"]')).toContainText(/you've got this one/i);
    await expect(beacon).toContainText("Maker Bay");
    const plan = await waitForPlan(page);
    expect(plan.goals[0].k).toBe("warm-start");
    expect(plan.status).toBe("active");
  });

  test("finishing an activity moves the world on to the next step", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    const beacon = await openWorld(page);
    await beacon.click();
    await page.waitForURL(/\/games\/maker-workshop/);
    expect(page.url()).toContain("from=warmup");

    await playKernelRun(page);

    // One destination, not a menu, and it is somewhere the child has not
    // just been. The panel waits for the session to say where it goes, so
    // the window allows for a slow runner working that out.
    const chain = page.locator('[data-adventure-chain="active"]');
    await expect(chain).toBeVisible({ timeout: 20_000 });
    const card = chain.locator(".adventure-chain-card");
    await expect(card).toHaveCount(1);
    const nextSlug = await card.getAttribute("data-chain-game");
    expect(nextSlug).not.toBe("maker-workshop");

    // ...and the world quietly agrees with it.
    const beaconAfter = await openWorld(page);
    const label = await beaconAfter.innerText();
    expect(label).not.toContain("Maker Bay");
    const plan = await waitForPlan(page);
    expect(plan.goals[0].st).toBe("done");
    expect(plan.visited).toContain("maker-workshop:math-place-value");
  });

  test("a child never sees the machinery", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    const beacon = await openWorld(page);
    const world = await page.locator("body").innerText();
    for (const jargon of [
      "session planner", "goal", "intent", "budget", "evidence", "step 1 of",
      "warm-start", "inference-transfer", "curriculum", "objective", "%",
    ]) {
      expect(world.toLowerCase()).not.toContain(jargon.toLowerCase());
    }
    await beacon.click();
    await page.waitForURL(/\/games\//);
    await playKernelRun(page);
    const after = await page.locator('[data-adventure-chain="active"]').innerText({ timeout: 20_000 });
    for (const jargon of ["goal", "intent", "planner", "evidence", "mastery", "%"]) {
      expect(after.toLowerCase()).not.toContain(jargon.toLowerCase());
    }
  });

  test("a refresh between activities resumes the same session", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    await openWorld(page);
    const before = await waitForPlan(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-landmark][data-beacon="true"]')).toBeVisible();
    const after = await waitForPlan(page);
    expect(after.goals.map((g: { k: string }) => g.k)).toEqual(before.goals.map((g: { k: string }) => g.k));
    expect(after.day).toBe(before.day);
  });

  test("a corrupt stored plan is thrown away and rebuilt", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    await page.evaluate((key) => {
      window.localStorage.setItem(key, '{"v":1,"day":"nope","goals":[{"k":"constructor"}]}');
    }, SESSION_KEY);
    await openWorld(page);
    const plan = await waitForPlan(page);
    expect(plan.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.goals.length).toBeGreaterThan(0);
    expect(plan.goals.every((g: { k: string }) => g.k !== "constructor")).toBe(true);
  });

  test("two tabs finishing the same activity advance the session once", async ({ browser }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    await seedQaFamily(first, { grade: 2 });
    await seedEvidence(first, SECURE_BUILD_AND_PLACE);
    await openWorld(first);
    await waitForPlan(first);

    const second = await context.newPage();
    await second.goto("/", { waitUntil: "domcontentloaded" });
    await expect(second.locator('[data-world-landmark][data-beacon="true"]')).toBeVisible();
    await waitForPlan(second);

    // The same activity is completed twice, once from each tab's point of view.
    for (const page of [first, second]) {
      await page.evaluate((key) => {
        const plan = JSON.parse(window.localStorage.getItem(key) ?? "{}");
        plan.goals[0].st = "done";
        plan.visited = ["maker-workshop:math-place-value"];
        window.localStorage.setItem(key, JSON.stringify(plan));
      }, SESSION_KEY);
    }
    await first.goto("/games/maker-workshop?skill=math-place-value", { waitUntil: "domcontentloaded" });
    await playKernelRun(first);

    await expect
      .poll(async () => {
        const plan = await storedPlan(first);
        return plan.goals.filter((g: { st: string }) => g.st === "done").length;
      }, { timeout: 15_000 })
      .toBe(1);
    // ...and it stays at one: the second tab's completion is refused, not
    // merely late.
    await first.waitForTimeout(3_000);
    const plan = await storedPlan(first);
    expect(plan.goals.filter((g: { st: string }) => g.st === "done").length).toBe(1);
    await context.close();
  });

  test("the parent panel explains the session in four plain sentences", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    await page.evaluate(() => {
      window.localStorage.setItem("adrianos-parent-unlocked-v1", "yes");
      window.sessionStorage.setItem("adrianos-parent-session-v1", "unlocked");
    });
    await page.goto("/parent", { waitUntil: "domcontentloaded" });
    const summary = page.locator('[data-session-summary="active"]');
    await expect(summary).toBeVisible();
    for (const field of ["workedOn", "observed", "responded", "next"]) {
      await expect(summary.locator(`[data-session-field="${field}"]`)).not.toBeEmpty();
    }
    const text = await summary.innerText();
    for (const banned of [
      "%", "score", "percentile", "probability", "cognitive", "deficit",
      "IQ", "weakness", "behind", "struggling", "index",
    ]) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  test("the session is one obvious next action, whatever the schedule says", async ({ page }) => {
    await seedQaFamily(page, { grade: 2 });
    await seedEvidence(page, SECURE_BUILD_AND_PLACE);
    // School Mode used to switch AdrianOS to a different planner entirely.
    await page.evaluate(() => {
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
            schoolMode: true,
            libraryAfterSession: true,
            updatedAt: new Date().toISOString(),
          }),
        },
      });
      window.localStorage.setItem(key, JSON.stringify({ ...learning, reviewQueue: queue }));
    });
    const beacon = await openWorld(page);
    // Same beacon as with School Mode off: one planner, not two.
    await expect(beacon).toContainText("Maker Bay");
    await expect(page.locator('[data-world-landmark][data-beacon="true"]')).toHaveCount(1);
  });
});
