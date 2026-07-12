import { expect, test, type Page } from "@playwright/test";

const PROFILE_ID = "quest-learner";
const FAMILY_KEY = "adrianos-family-v1";
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;

async function seedGradeFiveLearner(page: Page, skills: Record<string, { mastery: number; attempts: number; correct: number }> = {}) {
  await page.addInitScript(({ familyKey, learningKey, profileId, skills }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("adrianos-family-customized-v1", "yes");
    window.localStorage.setItem(familyKey, JSON.stringify({
      activeProfileId: profileId,
      profiles: [{
        id: profileId,
        name: "Quest Learner",
        age: 10,
        emoji: "🧭",
        createdAt: "2026-07-12T00:00:00.000Z",
      }],
      parentPinHash: null,
    }));
    window.localStorage.setItem(learningKey, JSON.stringify({
      version: 1,
      updatedAt: "2026-07-12T00:00:00.000Z",
      skills: Object.fromEntries(Object.entries(skills).map(([id, row]) => [id, {
        id,
        label: id,
        subject: "Math",
        attempts: row.attempts,
        correct: row.correct,
        streak: row.correct,
        mastery: row.mastery,
        lastPracticed: "2026-07-12T00:00:00.000Z",
      }])),
      reviewQueue: [{
        id: "profile-grade",
        gameSlug: "adrianos-grade-profile",
        skillId: "profile-grade",
        subject: "Learning Skills",
        prompt: "Parent-selected elementary curriculum grade",
        correctAnswer: "",
        dueAt: "9999-12-31T23:59:59.999Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
        successes: 0,
        status: "resolved",
        data: { grade: 5, profileSetting: true, elementaryScope: true },
      }],
      dailyAdventure: null,
    }));
  }, { familyKey: FAMILY_KEY, learningKey: LEARNING_KEY, profileId: PROFILE_ID, skills });
}

async function chooseCorrectAndAdvance(page: Page, final: boolean) {
  await page.locator('button[data-correct="true"]').click();
  await expect(page.getByText("GATE CLEARED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: final ? "Open the treasure →" : "Next gate →", exact: true }).click();
}

test.describe("TK-5 standards quests", () => {
  test("Grade 5 opens three standards-aligned quest worlds", async ({ page }) => {
    await seedGradeFiveLearner(page);
    await page.goto("/quests", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Quest Learner’s Quest Worlds", exact: true })).toBeVisible();
    await expect(page.getByText("Grade 5", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Number Kingdom", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Story Realm", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discovery Lab", exact: true })).toBeVisible();
    await expect(page.getByText("5.NBT.A.3", { exact: true })).toBeVisible();
    await expect(page.getByText("RL.5.1", { exact: true })).toBeVisible();
    await expect(page.getByText("5-PS1-1", { exact: true })).toBeVisible();
    await expect(page.getByText("Grade 6", { exact: true })).toHaveCount(0);
  });

  test("Number Quest teaches after a miss and records a six-gate completion", async ({ page }) => {
    await seedGradeFiveLearner(page);
    await page.goto("/games/number-quest?focus=math-decimals", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Cross six math gates.", exact: true })).toBeVisible();
    await page.locator('button[data-correct="false"]').first().click();
    await expect(page.getByText("CLUE UNLOCKED", { exact: true })).toBeVisible();
    await page.locator('button[data-correct="true"]').click();
    await expect(page.getByText("GATE CLEARED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next gate →", exact: true }).click();

    for (let gate = 2; gate <= 6; gate += 1) {
      await chooseCorrectAndAdvance(page, gate === 6);
    }

    await expect(page.getByRole("heading", { name: "The number gate is open.", exact: true })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        plays: progress.games?.["number-quest"]?.plays ?? 0,
        completions: progress.games?.["number-quest"]?.completions ?? 0,
        decimalAttempts: learning.skills?.["math-decimals"]?.attempts ?? 0,
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toMatchObject({
      plays: 1,
      completions: 1,
      decimalAttempts: 1,
    });
  });

  test("mastery treasure can be claimed only once", async ({ page }) => {
    await seedGradeFiveLearner(page, {
      "math-decimals": { mastery: 92, attempts: 6, correct: 6 },
    });
    await page.goto("/quests", { waitUntil: "domcontentloaded" });

    const claim = page.getByRole("button", { name: /Claim 20 XP \+ 6 coins/ }).first();
    await expect(claim).toBeVisible();
    await claim.click();
    await expect(page.getByRole("status")).toContainText("5.NBT.A.3 mastered");

    const firstReward = await page.evaluate(({ progressKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      return { xp: progress.xp ?? 0, coins: progress.coins ?? 0 };
    }, { progressKey: PROGRESS_KEY });
    expect(firstReward).toEqual({ xp: 20, coins: 6 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("TREASURE CLAIMED", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Claim 20 XP \+ 6 coins/ })).toHaveCount(0);
    const secondReward = await page.evaluate(({ progressKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      return { xp: progress.xp ?? 0, coins: progress.coins ?? 0 };
    }, { progressKey: PROGRESS_KEY });
    expect(secondReward).toEqual(firstReward);
  });

  test("School Mode quest map fits an iPhone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedGradeFiveLearner(page);
    await page.goto("/school", { waitUntil: "domcontentloaded" });

    const worlds = page.getByLabel("Curriculum quest worlds");
    await expect(worlds).toBeVisible();
    await expect(worlds.getByText("Number Kingdom", { exact: true })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => ({
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
