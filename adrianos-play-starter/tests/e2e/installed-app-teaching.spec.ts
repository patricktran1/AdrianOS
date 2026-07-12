import { expect, test } from "@playwright/test";

async function clearStorage(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test.describe("installed app reachability", () => {
  test("keeps Home and feedback actions reachable on an iPhone viewport", async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games/math-blast", { waitUntil: "domcontentloaded" });

    const dock = page.getByRole("navigation", { name: "AdrianOS navigation" });
    await expect(dock).toBeVisible();
    const home = dock.getByRole("link", { name: "Home" });
    await expect(home).toBeVisible();

    const homeBox = await home.boundingBox();
    expect(homeBox).not.toBeNull();
    expect((homeBox?.y ?? 0) + (homeBox?.height ?? 0)).toBeLessThanOrEqual(844);

    await page.getByRole("button", { name: "Parent feedback" }).click();
    const dialog = page.getByRole("dialog", { name: "Parent beta feedback" });
    await expect(dialog).toBeVisible();

    const sendAction = page.getByRole("button", { name: "Send feedback" });
    const signInAction = page.getByRole("link", { name: "Sign in or connect family" });
    const visibleAction = await sendAction.isVisible().catch(() => false) ? sendAction : signInAction;
    await expect(visibleAction).toBeVisible();

    const actionBox = await visibleAction.boundingBox();
    expect(actionBox).not.toBeNull();
    expect((actionBox?.y ?? 0) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(844);

    await page.getByRole("button", { name: "Close feedback" }).click();
    await home.click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("teach-during-play loop", () => {
  test("Math Blast gives a strategy hint, retry, and worked explanation", async ({ page }) => {
    await clearStorage(page);
    await page.goto("/games/math-blast?topic=addition&difficulty=1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /10-Question Mission/ }).click();

    await expect(page.getByRole("button", { name: "Show a hint" })).toBeVisible();
    const problemHeading = page.getByRole("heading", { level: 1 }).filter({ hasText: /\d+\s*\+\s*\d+/ }).first();
    const prompt = (await problemHeading.textContent()) ?? "";
    const match = prompt.match(/(\d+)\s*\+\s*(\d+)/);
    expect(match).not.toBeNull();
    const answer = Number(match?.[1]) + Number(match?.[2]);

    await page.getByRole("button", { name: "Show a hint" }).click();
    await expect(page.getByText("TRY THIS", { exact: true })).toBeVisible();
    await expect(page.getByText(/Choose again|hint does not end/i)).toBeVisible();

    await page.getByRole("button", { name: String(answer), exact: true }).click();
    await expect(page.getByText(/Solved with support/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Next Question" })).toBeVisible();

    const learning = await page.evaluate(() => JSON.parse(window.localStorage.getItem("adrianos-learning-v1:adrian") ?? "{}"));
    expect(Number(learning?.skills?.["math-addition"]?.attempts ?? 0)).toBeGreaterThan(0);
  });

  test("Science Quest starts from profile evidence and offers a retry clue", async ({ page }) => {
    await clearStorage(page);
    await page.goto("/games/science-quest", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("ADAPTIVE SCIENCE MISSIONS", { exact: true })).toBeVisible();
    await expect(page.getByText(/Level 1/).first()).toBeVisible();
    await page.getByRole("button", { name: "Launch Quest" }).click();
    await expect(page.getByRole("button", { name: "Show a clue" })).toBeVisible();
    await page.getByRole("button", { name: "Show a clue" }).click();
    await expect(page.getByText("CLUE", { exact: true })).toBeVisible();
    await expect(page.getByText("Use the clue and choose again.", { exact: true })).toBeVisible();
  });
});
