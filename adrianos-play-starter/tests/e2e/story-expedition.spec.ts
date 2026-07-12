import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("TK-5 Story Expedition", () => {
  test("turns Adrian's Grade 2 reading standards into a branching dinosaur mystery", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dino Library Detectives" })).toBeVisible();
    await page.getByRole("button", { name: /Story Dragon/ }).click();
    await page.getByRole("button", { name: /Enter with.*Story Dragon/ }).click();

    await expect(page.getByText("RL.2.1", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Start echo reading" }).click();
    for (let sentence = 0; sentence < 3; sentence += 1) {
      await page.getByRole("button", { name: "I read it too →" }).click();
    }
    await expect(page.getByText("✓ Fluency practice ribbon earned", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Hunt for evidence →" }).click();
    await page.getByRole("button", { name: /A moon/ }).click();
    await expect(page.getByText(/Story clue:/).first()).toBeVisible();
    await page.getByRole("button", { name: /A fern/ }).click();
    await page.getByRole("button", { name: "Choose the story path →" }).click();
    await page.getByRole("button", { name: /The muddy footprints/ }).click();
    await page.getByRole("button", { name: "Continue the expedition →" }).click();

    const remainingRoutes = [
      "Through the cracked window",
      "Use soft museum gloves",
      "Help finish the project",
    ];
    for (let chapter = 0; chapter < remainingRoutes.length; chapter += 1) {
      await page.getByRole("button", { name: "Hunt for evidence →" }).click();
      await page.locator('button[data-correct="true"]').click();
      await page.getByRole("button", { name: "Choose the story path →" }).click();
      await page.getByRole("button", { name: new RegExp(remainingRoutes[chapter]) }).click();
      await page.getByRole("button", {
        name: chapter === remainingRoutes.length - 1 ? "Open the final story vault →" : "Continue the expedition →",
      }).click();
    }

    await expect(page.getByRole("heading", { name: /QA Learner .*Story Trailblazer|QA Learner .*Evidence Pathfinder/ })).toBeVisible();
    await expect.poll(async () => page.evaluate(({ progressKey, learningKey }) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      return {
        plays: progress.games?.["story-expedition"]?.plays ?? 0,
        completions: progress.games?.["story-expedition"]?.completions ?? 0,
        detailAttempts: learning.skills?.["reading-comprehension-detail"]?.attempts ?? 0,
        sequenceRecorded: Boolean(learning.skills?.["reading-sequencing"]),
        vocabularyRecorded: Boolean(learning.skills?.["reading-vocabulary"]),
        inferenceRecorded: Boolean(learning.skills?.["reading-inference"]),
        fluencyPractice: learning.skills?.["reading-fluency-practice"]?.attempts ?? 0,
      };
    }, { progressKey: PROGRESS_KEY, learningKey: LEARNING_KEY })).toEqual({
      plays: 1,
      completions: 1,
      detailAttempts: 2,
      sequenceRecorded: true,
      vocabularyRecorded: true,
      inferenceRecorded: true,
      fluencyPractice: 1,
    });
  });

  test("gives TK a listening-first story world with large phone-safe choices", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: -1 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Critter Story Trail" })).toBeVisible();
    await page.getByRole("button", { name: /Enter with.*Evidence Owl/ }).click();
    await expect(page.getByText("TK.ELA.2", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "🔊 Listen to chapter" })).toBeVisible();
    await page.getByRole("button", { name: "Hunt for evidence →" }).click();

    const firstAnswer = page.locator('button[data-correct="true"]');
    const box = await firstAnswer.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(100);
    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("shows distinct Grade 5 evidence journalism and features reading in School Mode", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 5 });
    await page.goto("/games/story-expedition", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cipher Chronicle" })).toBeVisible();
    await page.getByRole("button", { name: /Enter with.*Evidence Owl/ }).click();
    await expect(page.getByText("RI.5.8", { exact: false })).toBeVisible();
    await expect(page.getByText("The Viral Claim", { exact: true })).toBeVisible();

    await page.goto("/school", { waitUntil: "domcontentloaded" });
    const spotlight = page.getByRole("region", { name: "Grade reading expedition" });
    await expect(spotlight.getByRole("heading", { name: "Cipher Chronicle" })).toBeVisible();
    await expect(spotlight.getByRole("link", { name: "Enter the story portal →" })).toHaveAttribute("href", "/games/story-expedition");
  });

  test("places Story Expedition inside the Story Worlds arcade portal", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const arcade = page.getByRole("region", { name: "Adventure Arcade" });
    await arcade.getByRole("button", { name: "Story worlds" }).click();
    await expect(arcade.getByRole("heading", { name: "Story Expedition" })).toBeVisible();
  });
});
