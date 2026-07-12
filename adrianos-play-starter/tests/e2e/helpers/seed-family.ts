import type { Page } from "@playwright/test";

export async function seedQaFamily(page: Page, options: { clear?: boolean; grade?: number } = {}) {
  await page.addInitScript(({ clear, grade }) => {
    if (clear) {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
    const raw = window.localStorage.getItem("adrianos-family-v1");
    let hasProfiles = false;
    try {
      const family = raw ? JSON.parse(raw) : null;
      hasProfiles = Array.isArray(family?.profiles) && family.profiles.length > 0;
    } catch {
      hasProfiles = false;
    }
    if (!hasProfiles) {
      window.localStorage.setItem("adrianos-family-v1", JSON.stringify({
        activeProfileId: "qa-learner",
        profiles: [{
          id: "qa-learner",
          name: "QA Learner",
          age: 7,
          emoji: "⭐",
          createdAt: "2026-07-12T00:00:00.000Z",
        }],
        parentPinHash: null,
      }));
      window.localStorage.setItem("adrianos-family-customized-v1", "yes");
    }

    if (typeof grade === "number") {
      const key = "adrianos-learning-v1:qa-learner";
      let learning: Record<string, unknown> = {};
      try {
        learning = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      } catch {
        learning = {};
      }
      const queue = Array.isArray(learning.reviewQueue) ? learning.reviewQueue : [];
      const filtered = queue.filter((row) => !(row?.gameSlug === "adrianos-grade-profile" && row?.id === "profile-grade"));
      window.localStorage.setItem(key, JSON.stringify({
        ...learning,
        reviewQueue: [...filtered, {
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
          data: { grade, profileSetting: true, elementaryScope: true },
        }],
      }));
    }
  }, { clear: options.clear === true, grade: options.grade });
}
