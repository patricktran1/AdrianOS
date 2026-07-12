import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

async function seedTwoLearners(page: import("@playwright/test").Page) {
  await seedQaFamily(page, { clear: true, grade: 2 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const family = JSON.parse(window.localStorage.getItem("adrianos-family-v1") ?? "{}");
    family.profiles.push({ id: "tk-buddy", name: "Elliot", age: 4, emoji: "🐣", createdAt: new Date().toISOString() });
    window.localStorage.setItem("adrianos-family-v1", JSON.stringify(family));
    window.localStorage.setItem("adrianos-learning-v1:tk-buddy", JSON.stringify({
      skills: {},
      reviewQueue: [{ id: "profile-grade", gameSlug: "adrianos-grade-profile", skillId: "profile-grade", subject: "Learning Skills", prompt: "grade", correctAnswer: "", dueAt: "9999-12-31T23:59:59.999Z", updatedAt: new Date().toISOString(), successes: 0, status: "resolved", data: { grade: -1 } }]
    }));
  });
}

test.describe("Family Quest Party", () => {
  test("alternates between grade-matched learners and gives a coach clue after a miss", async ({ page }) => {
    await seedTwoLearners(page);
    await page.goto("/games/family-quest-party", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Family Quest Party" })).toBeVisible();
    await page.getByRole("button", { name: "Start the party →", exact: true }).click();

    await expect(page.getByRole("heading", { name: "27 + 18 = ?" })).toBeVisible();
    await page.locator('button[data-correct="false"]').first().click();
    await expect(page.getByRole("status")).toContainText("Coach clue:");
    await page.locator('button[data-correct="true"]').click();

    await expect(page.getByRole("heading", { name: /Elliot.*turn!/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How many party balloons? 🎈🎈🎈" })).toBeVisible();
  });

  test("completes a six-turn team run, awards progress, and stays phone safe", async ({ page }) => {
    await seedTwoLearners(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/family-quest-party", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Start the party →", exact: true }).click();

    for (let turn = 0; turn < 6; turn += 1) {
      await page.locator('button[data-correct="true"]').click();
      if (turn < 5) await page.waitForTimeout(650);
    }

    await expect(page.getByRole("heading", { name: "Team treasure unlocked!" })).toBeVisible();
    const progress = await page.evaluate(() => JSON.parse(window.localStorage.getItem("adrianos-progress-v2:qa-learner") ?? "{}"));
    expect(progress.games?.["family-quest-party"]?.completions).toBe(1);
    await expect.poll(async () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ viewport: 390, scroll: 390 });
  });
});
