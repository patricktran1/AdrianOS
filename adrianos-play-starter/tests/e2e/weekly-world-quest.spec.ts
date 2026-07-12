import { expect, test } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROFILE_ID = "qa-learner";
const PROGRESS_KEY = `adrianos-progress-v2:${PROFILE_ID}`;
const LEARNING_KEY = `adrianos-learning-v1:${PROFILE_ID}`;

test.describe("Weekly World Quest", () => {
  test("connects three distinct Grade 2 games to a locked boss without fabricating progress", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const homeQuest = page.getByRole("region", { name: "Weekly world quest" });
    await expect(homeQuest).toBeVisible();
    await expect(homeQuest.getByRole("heading", { name: "Dino Isles Expedition" })).toBeVisible();
    await expect(homeQuest.getByRole("link")).toHaveAttribute("href", "/world-quest");

    await page.goto("/world-quest", { waitUntil: "domcontentloaded" });
    const quest = page.locator('[data-world-quest="active"]');
    await expect(quest).toBeVisible();
    await expect(quest.getByRole("heading", { name: "Dino Isles Expedition" })).toBeVisible();
    await expect(quest).toHaveAttribute("data-quest-progress", "0");
    await expect(quest).toHaveAttribute("data-boss-unlocked", "false");

    const missions = quest.locator("[data-mission-game]");
    await expect(missions).toHaveCount(3);
    const slugs = await missions.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-mission-game") ?? ""),
    );
    expect(new Set(slugs).size).toBe(3);
    expect(slugs).not.toContain("adaptive-boss-arena");

    await expect(quest.locator('[data-quest-boss="active"]')).toHaveAttribute("data-locked", "true");
    await expect.poll(async () => page.evaluate((key) => {
      const progress = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return progress.games?.["world-quest"] ?? null;
    }, PROGRESS_KEY)).toBeNull();

    await expect.poll(async () => page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))).toEqual({ viewport: 390, scroll: 390 });
  });

  test("unlocks the boss after three verified weekly clears and records conquest only after the boss", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/world-quest", { waitUntil: "domcontentloaded" });

    const quest = page.locator('[data-world-quest="active"]');
    const missionSlugs = await quest.locator("[data-mission-game]").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-mission-game") ?? ""),
    );
    expect(missionSlugs).toHaveLength(3);

    await page.evaluate(({ progressKey, slugs }) => {
      const now = new Date().toISOString();
      const games = Object.fromEntries(slugs.map((slug) => [slug, {
        plays: 1,
        completions: 1,
        bestScore: 500,
        lastPlayed: now,
        lastCompleted: now,
      }]));
      window.localStorage.setItem(progressKey, JSON.stringify({
        xp: 0,
        coins: 0,
        level: 1,
        games,
        activity: [],
      }));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, { progressKey: PROGRESS_KEY, slugs: missionSlugs });

    await expect(quest).toHaveAttribute("data-quest-progress", "3");
    await expect(quest).toHaveAttribute("data-boss-unlocked", "true");
    await expect(quest).toHaveAttribute("data-boss-complete", "false");
    await expect(quest.getByRole("link", { name: "FACE BOSS →", exact: true })).toHaveAttribute(
      "href",
      "/games/adaptive-boss-arena?from=world-quest&gate=boss",
    );

    await page.evaluate((progressKey) => {
      const progress = JSON.parse(window.localStorage.getItem(progressKey) ?? "{}");
      const now = new Date(Date.now() + 2_000).toISOString();
      progress.games["adaptive-boss-arena"] = {
        plays: 1,
        completions: 1,
        bestScore: 900,
        lastPlayed: now,
        lastCompleted: now,
      };
      window.localStorage.setItem(progressKey, JSON.stringify(progress));
      window.dispatchEvent(new Event("adrianos-progress-updated"));
    }, PROGRESS_KEY);

    await expect(quest).toHaveAttribute("data-boss-complete", "true");
    await expect(page.getByRole("region", { name: "World quest conquered" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "QA Learner restored the entire realm!" })).toBeVisible();
  });

  test("uses parent priorities and learner interests while keeping the weekly lineup stable", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.goto("/world-quest", { waitUntil: "domcontentloaded" });

    await page.evaluate((learningKey) => {
      const learning = JSON.parse(window.localStorage.getItem(learningKey) ?? "{}");
      const queue = Array.isArray(learning.reviewQueue) ? learning.reviewQueue : [];
      const filtered = queue.filter((row: { id?: string }) => row.id !== "learner-profile-settings");
      window.localStorage.setItem(learningKey, JSON.stringify({
        ...learning,
        reviewQueue: [...filtered, {
          id: "learner-profile-settings",
          gameSlug: "adrianos-learning-profile",
          skillId: "learner-profile",
          subject: "Learning Skills",
          prompt: "Parent-selected learner interests and priorities",
          correctAnswer: "",
          dueAt: "9999-12-31T23:59:59.999Z",
          updatedAt: new Date().toISOString(),
          successes: 0,
          status: "resolved",
          data: {
            learnerProfile: true,
            interestsJson: JSON.stringify(["Music"]),
            prioritiesJson: JSON.stringify(["Reading"]),
            sessionMinutes: 12,
            updatedAt: new Date().toISOString(),
          },
        }],
      }));
    }, LEARNING_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });

    const quest = page.locator('[data-world-quest="active"]');
    const powerGate = quest.locator('[data-mission-kind="power"]');
    const wonderGate = quest.locator('[data-mission-kind="wonder"]');
    await expect(powerGate.getByText("Reading", { exact: true })).toBeVisible();
    await expect(wonderGate).toContainText("Music is one of QA Learner's curiosity signals");

    const firstLineup = await quest.locator("[data-mission-game]").evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-mission-game") ?? ""),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    const secondLineup = await page.locator('[data-world-quest="active"] [data-mission-game]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-mission-game") ?? ""),
    );
    expect(secondLineup).toEqual(firstLineup);
  });
});
