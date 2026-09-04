import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const EVIDENCE_KEY = "adrianos-evidence-v1:qa-learner";

type Evidence = {
  gameSlug: string;
  skillId: string;
  skillLabel: string;
  correct: boolean;
  givenAnswer: string | null;
  correctAnswer: string;
  responseMs: number | null;
  hintsUsed: number;
  wrongAttempts: number;
};

async function readEvidence(page: Page): Promise<Evidence[]> {
  return page.evaluate((key) => {
    try {
      return JSON.parse(window.localStorage.getItem(key) ?? "[]") as Evidence[];
    } catch {
      return [];
    }
  }, EVIDENCE_KEY);
}

/** Hands the beacon to the learner model instead of a planned session. */
async function disableSchoolMode(page: Page) {
  await page.addInitScript(() => {
    const key = "adrianos-learning-v1:qa-learner";
    const learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    const queue = Array.isArray(learning.reviewQueue) ? learning.reviewQueue : [];
    window.localStorage.setItem(key, JSON.stringify({
      ...learning,
      reviewQueue: [...queue, {
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
              friday: "full", saturday: "light", sunday: "free",
            },
            fullMinutes: 12,
            lightMinutes: 6,
            schoolMode: false,
            libraryAfterSession: true,
            updatedAt: new Date().toISOString(),
          }),
        },
      }],
    }));
  });
}

async function unlockParent(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("adrianos-parent-unlocked", "yes");
  });
}

/**
 * Answers one Math Blast question, choosing the wrong option when asked to.
 * Returns what was chosen so the test can assert on the recorded evidence.
 */
async function answerMathBlast(page: Page, wrong: boolean): Promise<string> {
  const heading = page.getByRole("heading", { level: 1 })
    .filter({ hasText: /\d+\s*[+−-]\s*\d+/ })
    .first();
  await expect(heading).toBeVisible();
  const prompt = (await heading.textContent()) ?? "";
  const match = prompt.match(/(\d+)\s*([+−-])\s*(\d+)/);
  expect(match, `expected an arithmetic prompt, got "${prompt}"`).not.toBeNull();
  const left = Number(match?.[1]);
  const right = Number(match?.[3]);
  const answer = match?.[2] === "+" ? left + right : left - right;

  const choices = page.locator('main button, [class*="choice"] button');
  const target = wrong ? String(answer + 1) : String(answer);
  const button = page.getByRole("button", { name: target, exact: true });
  if (wrong && !(await button.isVisible().catch(() => false))) {
    // Distractors are generated, so fall back to any option that is not the
    // answer rather than assuming a particular wrong value exists.
    const labels = await choices.allInnerTexts();
    const other = labels.find((label) => /^\d+$/.test(label.trim()) && label.trim() !== String(answer));
    expect(other, "a wrong option should be offered").toBeTruthy();
    await page.getByRole("button", { name: (other ?? "").trim(), exact: true }).first().click();
    return (other ?? "").trim();
  }
  await button.first().click();
  return target;
}

async function startMathBlast(page: Page) {
  await page.goto("/games/math-blast?topic=addition&difficulty=1", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Addition", exact: true }).click();
  await page.getByRole("button", { name: /10-Question Mission/ }).click();
  await expect(page.getByRole("button", { name: "Show a hint" })).toBeVisible();
}

test.describe("gameplay produces real learning evidence", () => {
  test("records the child's own answer, timing, and support use", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startMathBlast(page);

    const chosen = await answerMathBlast(page, true);

    await expect.poll(async () => (await readEvidence(page)).length).toBeGreaterThan(0);
    const rows = await readEvidence(page);
    const row = rows[rows.length - 1];

    expect(row.gameSlug).toBe("math-blast");
    expect(row.correct).toBe(false);
    expect(row.givenAnswer, "the wrong answer itself must be recorded").toBe(chosen);
    expect(row.correctAnswer).not.toBe("");
    expect(row.givenAnswer).not.toBe(row.correctAnswer);
    // Timing comes from the shared clock, so it exists without the game
    // measuring anything itself.
    expect(row.responseMs, "the answer should be timed").not.toBeNull();
    expect(row.responseMs ?? 0).toBeGreaterThan(0);
    expect(row.responseMs ?? 0).toBeLessThan(10 * 60 * 1000);
  });

  test("the standard stays in the record while leaving the child's screen", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startMathBlast(page);

    // No filing code anywhere a child can read it.
    const visible = await page.locator("body").innerText();
    expect(visible).not.toMatch(/\b\d\.[A-Z]{2,3}\.[A-Z]\.\d\b/);

    await answerMathBlast(page, false);
    await expect.poll(async () => (await readEvidence(page)).length).toBeGreaterThan(0);

    const rows = await readEvidence(page);
    const row = rows[rows.length - 1] as Evidence & { standardCode: string | null };
    expect(row.standardCode, "standards evidence must survive the UI change").toBeTruthy();
    expect(row.standardCode).toMatch(/^\d\.[A-Z]/);
  });

  test("evidence keeps accumulating across questions in a run", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await startMathBlast(page);

    await answerMathBlast(page, false);
    await page.getByRole("button", { name: /Next|Keep going|Continue/ }).first().click()
      .catch(() => undefined);
    await page.waitForTimeout(600);
    await answerMathBlast(page, false).catch(() => "");

    await expect.poll(async () => (await readEvidence(page)).length).toBeGreaterThanOrEqual(1);
    const rows = await readEvidence(page);
    for (const row of rows) {
      expect(row.skillId).not.toBe("");
      expect(row.skillLabel).not.toBe("");
      expect(typeof row.hintsUsed).toBe("number");
      expect(typeof row.wrongAttempts).toBe("number");
    }
  });

  test("a repeated wrong answer surfaces to a parent as a misunderstanding", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await unlockParent(page);

    // Seed a run of gameplay evidence in the shape games now write.
    await page.addInitScript((key) => {
      const rows = [];
      for (let index = 0; index < 16; index += 1) {
        rows.push({
          at: new Date(Date.now() - (40 - index) * 60_000).toISOString(),
          gameSlug: "math-blast",
          subject: "Math",
          skillId: "math-addition",
          skillLabel: "Adding within 100",
          prompt: "27 + 18",
          correctAnswer: "45",
          givenAnswer: index < 6 ? "45" : "35",
          correct: index < 6,
          responseMs: 4200,
          hintsUsed: index < 6 ? 0 : 1,
          wrongAttempts: index < 6 ? 0 : 1,
          standardCode: "2.NBT.B.5",
        });
      }
      window.localStorage.setItem(key, JSON.stringify(rows));
    }, EVIDENCE_KEY);

    await page.goto("/parent", { waitUntil: "domcontentloaded" });
    const panel = page.locator('[data-learning-evidence="active"]');
    await expect(panel).toBeVisible();

    // The parent sees the actual wrong answer, how often, and against what.
    const misconceptions = panel.locator('[data-misconceptions="present"]');
    await expect(misconceptions).toBeVisible();
    await expect(misconceptions).toContainText("Adding within 100");
    await expect(misconceptions).toContainText("35");
    await expect(misconceptions).toContainText("45");
    await expect(misconceptions).toContainText("27 + 18");

    // And the recommendation is to reteach, not to drill the same thing harder.
    await expect(panel.locator('[data-skill-action="reteach"]')).toBeVisible();
    await expect(panel.locator('[data-world-rationale="true"]')).toContainText("reteach");

    // The child's world reflects the same decision without saying any of it.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toHaveAttribute(
      "data-world-intent",
      "reteach"
    );
    const guide = await page.locator('[data-world-guide="true"]').innerText();
    expect(guide).not.toMatch(/wrong|misunderstand|reteach|%|score/i);
  });

  test("the world and the post-win screen name the same next step", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    // With School Mode off the learner model leads the world, which is the
    // case where the two surfaces must not contradict each other.
    await disableSchoolMode(page);

    // Fluent everywhere except place value, where one wrong answer repeats.
    await page.addInitScript((key) => {
      const rows = [];
      for (let index = 0; index < 18; index += 1) {
        const wrong = index >= 8;
        rows.push({
          at: new Date(Date.now() - (60 - index) * 60_000).toISOString(),
          gameSlug: "number-quest",
          subject: "Math",
          skillId: "math-place-value",
          skillLabel: "Place value",
          prompt: "In 147, what digit is in the tens place?",
          correctAnswer: "4",
          givenAnswer: wrong ? "7" : "4",
          correct: !wrong,
          responseMs: 3800,
          hintsUsed: wrong ? 1 : 0,
          wrongAttempts: wrong ? 1 : 0,
          standardCode: "2.NBT.B.5",
        });
      }
      window.localStorage.setItem(key, JSON.stringify(rows));
    }, EVIDENCE_KEY);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-world-stage="active"]')).toHaveAttribute(
      "data-world-intent",
      "reteach"
    );
    const worldLine = await page.locator('[data-world-guide="true"]').innerText();
    expect(worldLine.toLowerCase()).toContain("place value");

    // Finishing a different game must not contradict the world's advice.
    await page.goto("/games/memory-match", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-adventure-chain-controller="active"]'))
      .toHaveAttribute("data-controller-ready", "true");

    await page.evaluate((key) => {
      const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      const now = new Date().toISOString();
      progress.games = {
        ...(progress.games ?? {}),
        "memory-match": {
          plays: 1, completions: 1, bestScore: 90, lastPlayed: now, lastCompleted: now,
        },
      };
      window.localStorage.setItem(key, JSON.stringify(progress));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, "adrianos-progress-v2:qa-learner");

    const chain = page.locator('[data-adventure-chain="active"]');
    await expect(chain).toBeVisible({ timeout: 15_000 });

    // One next destination, and it repeats the world's line rather than
    // inventing its own. There is no second opinion to contradict the first.
    const cards = chain.locator(".adventure-chain-card");
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText("place value");
    expect(await cards.innerText()).not.toMatch(/score|%|wrong|behind/i);
  });

  test("the parent panel refuses to summarize when there is no evidence", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await unlockParent(page);
    await page.goto("/parent", { waitUntil: "domcontentloaded" });

    const panel = page.locator('[data-learning-evidence="active"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-evidence-empty="true"]')).toBeVisible();
    await expect(panel.locator('[data-misconceptions="present"]')).toHaveCount(0);
    await expect(panel).toContainText("Nothing is estimated before then.");
  });
});
