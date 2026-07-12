import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

async function seedRepeatedAdditionFriction(page: Page) {
  await seedQaFamily(page, { clear: true });
  await page.addInitScript(({ learningKey }) => {
    const now = "2026-07-12T00:00:00.000Z";
    window.localStorage.setItem(learningKey, JSON.stringify({
      version: 1,
      updatedAt: now,
      skills: {
        "math-addition": {
          id: "math-addition",
          label: "Addition",
          subject: "Math",
          attempts: 2,
          correct: 0,
          streak: 0,
          mastery: 13,
          lastPracticed: now,
        },
      },
      reviewQueue: [
        {
          id: "math-blast:math-addition:first",
          gameSlug: "math-blast",
          skillId: "math-addition",
          subject: "Math",
          prompt: "8 + 7",
          correctAnswer: "15",
          data: { left: 8, right: 7, operator: "+", answer: 15, kind: "equation" },
          dueAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-07-12T00:00:01.000Z",
          successes: 0,
          status: "due",
        },
        {
          id: "math-blast:math-addition:second",
          gameSlug: "math-blast",
          skillId: "math-addition",
          subject: "Math",
          prompt: "9 + 6",
          correctAnswer: "15",
          data: { left: 9, right: 6, operator: "+", answer: 15, kind: "equation" },
          dueAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-07-12T00:00:02.000Z",
          successes: 0,
          status: "due",
        },
      ],
      dailyAdventure: null,
    }));
  }, { learningKey: LEARNING_KEY });
}

async function readIntervention(page: Page) {
  return page.evaluate(({ learningKey }) => {
    const state = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
    const row = state.reviewQueue?.find((item: { data?: { masteryIntervention?: boolean } }) => item.data?.masteryIntervention === true);
    return row?.data?.interventionJson ? JSON.parse(row.data.interventionJson) : null;
  }, { learningKey: LEARNING_KEY });
}

test.describe("closed-loop mastery recovery", () => {
  test("changes the teaching path, verifies understanding, and checks retention later", async ({ page }) => {
    await seedRepeatedAdditionFriction(page);
    await page.clock.install({ time: new Date("2026-07-12T12:00:00.000Z") });
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    await expect.poll(async () => readIntervention(page)).toMatchObject({
      skillId: "math-addition",
      skillLabel: "Addition",
      phase: "reteach",
      evidenceCount: 2,
    });
    await expect(page.getByText("Addition Mastery Lab", { exact: true }).first()).toBeVisible();

    await page.goto("/mastery-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Addition", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Try a new path →", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Make a friendly number first", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "I’m ready to check →", exact: true }).click();
    await page.getByRole("button", { name: "Make 10: 8 + 2 + 5", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Understanding changed.", exact: true })).toBeVisible();

    await expect.poll(async () => readIntervention(page)).toMatchObject({
      phase: "retention",
      verificationSuccesses: 1,
      lastResult: "correct",
    });
    await expect.poll(async () => page.evaluate(({ progressKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      return progress.games?.["mastery-lab"]?.completions ?? 0;
    }, { progressKey: PROGRESS_KEY })).toBe(1);

    await page.clock.fastForward(25 * 60 * 60 * 1000);
    await page.goto("/mastery-lab", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("RETENTION CHECK", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Take the memory check →", exact: true }).click();
    await page.getByRole("button", { name: "Make 10: 8 + 2 + 5", exact: true }).click();
    await expect(page.getByRole("heading", { name: "It stayed strong.", exact: true })).toBeVisible();
    await expect.poll(async () => readIntervention(page)).toMatchObject({
      phase: "resolved",
      verificationSuccesses: 2,
      lastResult: "correct",
    });
  });

  test("shows recovery status to the parent without exposing internal skill slugs", async ({ page }) => {
    await seedRepeatedAdditionFriction(page);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("adrianos-parent-unlocked", "yes");
      window.sessionStorage.setItem("adrianos-weekly-report-unlocked", "yes");
      window.sessionStorage.setItem("adrianos-skill-goals-unlocked", "yes");
    });
    await page.goto("/parent", { waitUntil: "domcontentloaded" });

    const recovery = page.getByLabel("Mastery recovery loops");
    await expect(recovery).toBeVisible();
    await expect(recovery.getByRole("heading", { name: "When a skill gets sticky, change the path." })).toBeVisible();
    await expect(recovery.getByText("Addition", { exact: true })).toBeVisible();
    await expect(recovery.getByText("math-addition", { exact: true })).toHaveCount(0);
    await expect(recovery.getByRole("link", { name: "Open lab →" })).toBeVisible();
  });
});
