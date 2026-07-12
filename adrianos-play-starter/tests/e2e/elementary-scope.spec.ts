import { expect, test, type Page } from "@playwright/test";

const FAMILY_KEY = "adrianos-family-v1";
const LEARNING_KEY = "adrianos-learning-v1:legacy-learner";

async function seedOutOfScopeLegacyProfile(page: Page) {
  await page.addInitScript(({ familyKey, learningKey }) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("adrianos-family-customized-v1", "yes");
    window.localStorage.setItem(familyKey, JSON.stringify({
      activeProfileId: "legacy-learner",
      profiles: [{
        id: "legacy-learner",
        name: "Legacy Learner",
        age: 17,
        emoji: "🧭",
        createdAt: "2025-01-01T00:00:00.000Z",
      }],
      parentPinHash: null,
    }));
    window.localStorage.setItem(learningKey, JSON.stringify({
      version: 1,
      updatedAt: "2025-01-01T00:00:00.000Z",
      skills: {},
      reviewQueue: [{
        id: "profile-grade",
        gameSlug: "adrianos-grade-profile",
        skillId: "profile-grade",
        subject: "Learning Skills",
        prompt: "Parent-selected curriculum grade",
        correctAnswer: "",
        dueAt: "9999-12-31T23:59:59.999Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        successes: 0,
        status: "resolved",
        data: { grade: 12, profileSetting: true },
      }],
      dailyAdventure: null,
    }));
  }, { familyKey: FAMILY_KEY, learningKey: LEARNING_KEY });
}

test.describe("elementary TK-5 product scope", () => {
  test("family setup exposes only ages 4-11 and grades TK-5", async ({ page }) => {
    await page.goto("/family/setup?local=1", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/intentionally focused on elementary learning/i)).toBeVisible();
    const ageSelect = page.getByLabel("Child 1 age");
    const gradeSelect = page.getByLabel("Child 1 learning grade");
    await expect(ageSelect).toBeVisible();
    await expect(gradeSelect).toBeVisible();

    await expect.poll(async () => ageSelect.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    )).toEqual(["4", "5", "6", "7", "8", "9", "10", "11"]);

    expect(await gradeSelect.locator("option").evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        text: option.textContent,
      }))
    )).toEqual([
      { value: "-1", text: "TK (Transitional Kindergarten)" },
      { value: "0", text: "Kindergarten" },
      { value: "1", text: "Grade 1" },
      { value: "2", text: "Grade 2" },
      { value: "3", text: "Grade 3" },
      { value: "4", text: "Grade 4" },
      { value: "5", text: "Grade 5" },
    ]);
  });

  test("legacy middle or high school profiles migrate to the Grade 5 ceiling", async ({ page }) => {
    await seedOutOfScopeLegacyProfile(page);
    await page.goto("/curriculum/elementary", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Age 11 · Grade 5", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grade 5", exact: true })).toBeVisible();
    await expect(page.getByText("Grade 5 is the current AdrianOS ceiling.", { exact: true })).toBeVisible();
    await expect(page.getByText(/does not currently claim a Grade 6, middle-school, or high-school curriculum/i)).toBeVisible();
    await expect(page.getByText("Grade 6", { exact: true })).toHaveCount(0);

    await expect.poll(async () => page.evaluate(({ familyKey, learningKey }) => {
      const family = JSON.parse(window.localStorage.getItem(familyKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const gradeItem = learning.reviewQueue?.find((item: { id?: string }) => item.id === "profile-grade");
      return {
        age: family.profiles?.[0]?.age,
        grade: gradeItem?.data?.grade,
      };
    }, { familyKey: FAMILY_KEY, learningKey: LEARNING_KEY })).toEqual({ age: 11, grade: 5 });
  });

  test("the Elementary Journey shows exactly seven grade stops", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("adrianos-family-customized-v1", "yes");
      window.localStorage.setItem("adrianos-family-v1", JSON.stringify({
        activeProfileId: "elementary-learner",
        profiles: [{
          id: "elementary-learner",
          name: "Elementary Learner",
          age: 7,
          emoji: "⭐",
          createdAt: "2026-07-12T00:00:00.000Z",
        }],
        parentPinHash: null,
      }));
      window.localStorage.setItem("adrianos-learning-v1:elementary-learner", JSON.stringify({
        version: 1,
        updatedAt: "2026-07-12T00:00:00.000Z",
        skills: {},
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
          data: { grade: 2, profileSetting: true, elementaryScope: true },
        }],
        dailyAdventure: null,
      }));
    });
    await page.goto("/curriculum/elementary", { waitUntil: "domcontentloaded" });

    const ladder = page.getByLabel("TK through Grade 5 ladder");
    await expect(ladder).toBeVisible();
    await expect(ladder.locator("article")).toHaveCount(7);
    await expect(ladder.getByText("TK", { exact: true })).toBeVisible();
    await expect(ladder.getByText("Grade 5", { exact: true })).toBeVisible();
  });
});
