import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";
import { buildLocateRun, type LocateTask } from "../../lib/kernels/locate-tasks";

const PROFILE_ID = "qa-learner";
const EVIDENCE_KEY = `adrianos-evidence-v1:${PROFILE_ID}`;

function todayKey(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function readEvidence(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"),
    EVIDENCE_KEY
  );
}

function runFor(grade: number, skillId: string): LocateTask[] {
  return buildLocateRun({
    profileId: PROFILE_ID,
    grade: grade as never,
    skillId,
    dayKey: todayKey(),
  });
}

async function start(page: Page, query = "") {
  await page.goto(`/games/spyglass-bay${query}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Start looking/ }).click();
}

const mark = (page: Page, id: string) => page.locator(`[data-sentence-id="${id}"]`).click();
const pick = (page: Page, id: string) => page.locator(`[data-option-id="${id}"]`).click();

test.describe("Spyglass Bay", () => {
  test("marking the sentence and answering records a read, not a guess", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page, "?skill=reading-comprehension-detail");
    const task = runFor(2, "reading-comprehension-detail")[0];

    // Every sentence of the passage is on screen, in reading order.
    for (const sentence of task.sentences) {
      await expect(page.locator(`[data-sentence-id="${sentence.id}"]`)).toContainText(sentence.text);
    }
    await expect(page.getByTestId("locate-question")).toContainText(task.prompt);

    // Answering is impossible until something is marked.
    await pick(page, task.answerId);
    await expect(page.getByTestId("locate-answer")).toBeDisabled();

    for (const id of task.supportingIds) await mark(page, id);
    await expect(page.getByTestId("locate-answer")).toBeEnabled();
    await page.getByTestId("locate-answer").click();

    const rows = await readEvidence(page);
    expect(rows).toHaveLength(1);
    expect(rows[0].gameSlug).toBe("spyglass-bay");
    expect(rows[0].mechanic).toBe("locate");
    expect(rows[0].skillId).toBe("reading-comprehension-detail");
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(true);
    expect(rows[0].errorSignature).toBeNull();
    expect(rows[0].taskId).toBeTruthy();
  });

  test("a right answer without its evidence is correct but is not a read", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page, "?skill=reading-comprehension-detail");
    const task = runFor(2, "reading-comprehension-detail")[0];
    const elsewhere = task.sentences.find((s) => !task.supportingIds.includes(s.id));
    expect(elsewhere, "passage needs a non-supporting sentence").toBeTruthy();

    await mark(page, elsewhere!.id);
    await pick(page, task.answerId);
    await page.getByTestId("locate-answer").click();

    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(false);
    expect(rows[0].errorSignature).toBe("reading.answered-without-evidence");
  });

  test("marking the whole passage is not a strategy", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page, "?skill=reading-comprehension-detail");
    const task = runFor(2, "reading-comprehension-detail")[0];

    for (const sentence of task.sentences) await mark(page, sentence.id);
    await pick(page, task.answerId);
    await page.getByTestId("locate-answer").click();

    const rows = await readEvidence(page);
    // The supporting sentence was marked — by marking everything.
    expect(rows[0].correct).toBe(true);
    expect(rows[0].reasoned).toBe(false);
    expect(rows[0].errorSignature).toBe("reading.marked-the-whole-passage");
  });

  test("finding the sentence and misreading it is told apart from not finding it", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 4 });
    await start(page, "?skill=reading-inference");
    const task = runFor(4, "reading-inference")[0];
    const wrong = task.options.find((o) => o.id !== task.answerId)!;

    for (const id of task.supportingIds) await mark(page, id);
    await pick(page, wrong.id);
    await page.getByTestId("locate-answer").click();

    const rows = await readEvidence(page);
    expect(rows[0].correct).toBe(false);
    expect(rows[0].errorSignature).toBe("reading.evidence-found-but-misread");
    // A first miss coaches rather than reveals, and the child stays in.
    await expect(page.getByTestId("locate-guide")).toContainText(task.hint);
    await expect(page.getByTestId("locate-answer")).toBeVisible();
  });

  test("a mark can be taken back, and the passage never disappears", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await start(page, "?skill=reading-comprehension-detail");
    const task = runFor(2, "reading-comprehension-detail")[0];
    const first = task.sentences[0];

    await mark(page, first.id);
    await expect(page.locator(`[data-sentence-id="${first.id}"]`)).toHaveAttribute("data-marked", "true");
    await mark(page, first.id);
    await expect(page.locator(`[data-sentence-id="${first.id}"]`)).toHaveAttribute("data-marked", "false");
    await expect(page.getByTestId("locate-answer")).toBeDisabled();
    await expect(page.getByTestId("passage")).toBeVisible();
  });

  test("a whole run can be played with the keyboard alone", async ({ page }) => {
    await seedQaFamily(page, { clear: true, grade: 2 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await start(page, "?skill=reading-comprehension-detail");
    const task = runFor(2, "reading-comprehension-detail")[0];

    const sentence = page.locator(`[data-sentence-id="${task.supportingIds[0]}"]`);
    await sentence.focus();
    await page.keyboard.press("Enter");
    await expect(sentence).toHaveAttribute("data-marked", "true");

    const option = page.locator(`[data-option-id="${task.answerId}"]`);
    await option.focus();
    await page.keyboard.press("Enter");
    const submit = page.getByTestId("locate-answer");
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("locate-advance")).toBeVisible();
  });
});
