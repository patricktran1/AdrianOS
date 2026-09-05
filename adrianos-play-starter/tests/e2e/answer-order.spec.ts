import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { optionSeed, presentOptions } from "../../lib/learning/answer-order";
import { CIVIC_MISSIONS } from "../../lib/adrian-civic-bank";
import { HEALTH_MISSIONS } from "../../lib/adrian-health-bank";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

/*
 * Every subject lab names its own opening button — "Start civic mission",
 * "Open the safety scenarios", "Open the case files" — and in each it is the
 * last control on the landing screen, below the level pickers. Same for the
 * one action button while a question is up.
 */
async function lastButton(page: Page) {
  return page.locator("button").last();
}

async function enter(page: Page, slug: string) {
  await seedQaFamily(page, { clear: true, grade: 3 });
  await page.goto(`/games/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1").last()).toBeVisible({ timeout: 15_000 });
  await (await lastButton(page)).click();
  await expect(page.getByRole("button", { name: /Read .* aloud|Stop reading/i }).first())
    .toBeVisible({ timeout: 15_000 });
}

/** The option buttons on screen, in the order a child sees them. */
async function shownOptions(page: Page, options: string[]): Promise<string[]> {
  const texts = await page.locator("button").allInnerTexts();
  return texts.map((text) => text.trim()).filter((text) => options.includes(text));
}

/** The bank row currently on screen, found by its own prompt. */
async function currentMission<T extends { prompt: string }>(page: Page, bank: T[]): Promise<T> {
  const prompt = (await page.locator("h1").last().innerText()).trim();
  const mission = bank.find((row) => row.prompt === prompt);
  expect(mission, `no bank row matches the prompt "${prompt}"`).toBeTruthy();
  return mission!;
}

async function readEvidence(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), EVIDENCE_KEY);
}

test.describe("where the answer sits", () => {
  /*
   * The finding, played rather than described. The banks author the correct
   * option first — 373 of 374 rows — and every lab rendered them in that
   * order, so "tap the top button" finished civics, health, history,
   * economics, wellbeing and geography without a miss. Those subjects have no
   * verb and no error signature: accuracy is the only signal they produce, so
   * this was the whole of what the model knew about them.
   */
  test("tapping the top button is no longer a way through civics", async ({ page }) => {
    await enter(page, "civic-lab");

    let asked = 0;
    let topButtonRight = 0;

    for (let round = 0; round < 5; round += 1) {
      const mission = await currentMission(page, CIVIC_MISSIONS);
      const options = await shownOptions(page, mission.options);
      expect(options.length, "the lab is not showing its options").toBe(3);
      asked += 1;
      if (options[0] === mission.answer) topButtonRight += 1;

      await page.locator("button").filter({ hasText: options[0] }).first().click();
      await (await lastButton(page)).click();
      await page.waitForTimeout(700);

      const next = page.getByRole("button", { name: /Next (case|situation)|Complete the mission/i }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(600);
    }

    expect(asked, "the lab never asked anything").toBeGreaterThan(0);
    expect(
      topButtonRight,
      "the top button was right every time, which is what this change removes"
    ).toBeLessThan(asked);
  });

  /*
   * The property that replaces "always first". Presentation is a pure function
   * of (profile, game, item), so the order a child will see is knowable from
   * the bank alone — which is why the test above can assert an outcome rather
   * than a probability.
   */
  test("the order on screen is the one the seeded module predicts", async ({ page }) => {
    await enter(page, "health-safety-lab");
    const mission = await currentMission(page, HEALTH_MISSIONS);

    const expected = presentOptions(
      mission.options,
      mission.answer,
      optionSeed(PROFILE_ID, "health-safety-lab", mission.id)
    );
    expect(await shownOptions(page, mission.options)).toEqual(expected);
  });

  /* And it is genuinely a different order, not the bank's order renamed. */
  test("at least one lab question is not shown in its authored order", async ({ page }) => {
    await enter(page, "civic-lab");
    let moved = 0;
    for (let round = 0; round < 5; round += 1) {
      const mission = await currentMission(page, CIVIC_MISSIONS);
      const options = await shownOptions(page, mission.options);
      if (options.join("|") !== mission.options.join("|")) moved += 1;
      await page.locator("button").filter({ hasText: mission.answer }).first().click();
      await (await lastButton(page)).click();
      await page.waitForTimeout(700);
      const next = page.getByRole("button", { name: /Next (case|situation)|Complete the mission/i }).first();
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
      await page.waitForTimeout(600);
    }
    expect(moved, "no question was reordered at all").toBeGreaterThan(0);
  });

  /*
   * Seeded, not random. Buttons that move between renders shift under a
   * child's finger, and the retry after a miss must show the layout they just
   * studied — otherwise the second miss is about the shuffle, not the question.
   */
  test("a wrong answer leaves the buttons exactly where they were", async ({ page }) => {
    await enter(page, "civic-lab");
    const mission = await currentMission(page, CIVIC_MISSIONS);
    const before = await shownOptions(page, mission.options);

    const wrong = before.find((option) => option !== mission.answer);
    expect(wrong, "no wrong option on screen").toBeTruthy();
    await page.locator("button").filter({ hasText: wrong! }).first().click();
    await (await lastButton(page)).click();
    await page.waitForTimeout(900);

    expect(await shownOptions(page, mission.options), "the options moved after a miss").toEqual(before);
  });

  /*
   * A reload is a new render. Content rotation deliberately serves a
   * different case, so the thing that must survive is not the question but
   * the rule: whatever comes up is ordered by its own seed, never afresh.
   */
  test("a reloaded question is ordered by its seed, not by chance", async ({ page }) => {
    await enter(page, "civic-lab");
    await page.reload({ waitUntil: "domcontentloaded" });
    await (await lastButton(page)).click();
    await expect(page.getByRole("button", { name: /Read .* aloud|Stop reading/i }).first())
      .toBeVisible({ timeout: 15_000 });

    const mission = await currentMission(page, CIVIC_MISSIONS);
    expect(await shownOptions(page, mission.options)).toEqual(
      presentOptions(mission.options, mission.answer, optionSeed(PROFILE_ID, "civic-lab", mission.id))
    );
  });

  /*
   * Nothing about scoring moved. A child who reads the brief and picks the
   * right words is still right, and the row still says so.
   */
  test("answering by reading still scores and still records", async ({ page }) => {
    await enter(page, "civic-lab");
    const mission = await currentMission(page, CIVIC_MISSIONS);

    await page.locator("button").filter({ hasText: mission.answer }).first().click();
    await (await lastButton(page)).click();
    await page.waitForTimeout(900);

    const rows = await readEvidence(page);
    const row = rows.find((entry: { skillId?: string }) => entry.skillId?.startsWith("civics-"));
    expect(row, "a correct answer recorded nothing").toBeTruthy();
    expect(row.correct).toBe(true);
    expect(row.correctAnswer).toBe(mission.answer);
  });
});
