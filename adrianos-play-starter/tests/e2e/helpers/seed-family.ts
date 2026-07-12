import type { Page } from "@playwright/test";

export async function seedQaFamily(page: Page, options: { clear?: boolean } = {}) {
  await page.addInitScript(({ clear }) => {
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
  }, { clear: options.clear === true });
}
