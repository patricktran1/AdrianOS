import { expect, test, type Page } from "@playwright/test";
import { seedQaFamily } from "./helpers/seed-family";

const PROGRESS_KEY = "adrianos-progress-v2:qa-learner";

type GameProgress = {
  plays: number;
  completions: number;
  bestScore: number;
};

type CompletionRecipe = {
  slug: string;
  expectedScore: number;
  completionText: string | RegExp;
  playToCompletion: (page: Page) => Promise<void>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function accessibleNameEndingWith(value: string | number): RegExp {
  return new RegExp(`${escapeRegExp(String(value))}$`);
}

async function readGameProgress(page: Page, slug: string): Promise<GameProgress> {
  return page.evaluate(({ key, gameSlug }) => {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    const game = parsed?.games?.[gameSlug] ?? {};
    return {
      plays: Number(game.plays ?? 0),
      completions: Number(game.completions ?? 0),
      bestScore: Number(game.bestScore ?? 0),
    };
  }, { key: PROGRESS_KEY, gameSlug: slug });
}

async function completeButtonQuiz(
  page: Page,
  answers: Array<string | number>,
  nextLabel: string,
  finalLabel: string,
) {
  for (let index = 0; index < answers.length; index += 1) {
    await page.getByRole("button", { name: accessibleNameEndingWith(answers[index]) }).click();
    await page.getByRole("button", {
      name: index === answers.length - 1 ? finalLabel : nextLabel,
      exact: true,
    }).click();
  }
}

const recipes: CompletionRecipe[] = [
  {
    slug: "dinosaur-detective",
    expectedScore: 6,
    completionText: "Case Closed",
    playToCompletion: (page) => completeButtonQuiz(
      page,
      ["Tyrannosaurus rex", "Triceratops", "Stegosaurus", "Brachiosaurus", "Velociraptor", "Ankylosaurus"],
      "Next case",
      "See results",
    ),
  },
  {
    slug: "human-body-explorer",
    expectedScore: 6,
    completionText: "Body Mission Complete",
    playToCompletion: (page) => completeButtonQuiz(
      page,
      ["Heart", "Lungs", "Brain", "Skull", "Stomach", "Nerves"],
      "Next question",
      "See results",
    ),
  },
  {
    slug: "money-math",
    expectedScore: 8,
    completionText: "Money Mission Complete",
    playToCompletion: (page) => completeButtonQuiz(
      page,
      ["Two nickels", "$3", "One quarter", "$3", "4", "$6", "$4 book", "$3.50"],
      "Next question",
      "See results",
    ),
  },
  {
    slug: "question-quest",
    expectedScore: 4,
    completionText: "QUEST COMPLETE",
    playToCompletion: (page) => completeButtonQuiz(
      page,
      [
        "They are finding and arranging the information",
        "Electric charge building up in clouds",
        "Pressure and a little melting help crystals bond",
        "To cool the body",
      ],
      "Next question",
      "See results",
    ),
  },
  {
    slug: "solar-system-explorer",
    expectedScore: 8,
    completionText: "Mission Complete",
    playToCompletion: (page) => completeButtonQuiz(
      page,
      ["Mercury", "Earth", "Saturn", "Jupiter", "Mars", "The Moon", "A star", "Neptune"],
      "Next mission",
      "See results",
    ),
  },
  {
    slug: "treasure-map-math",
    expectedScore: 6,
    completionText: "Treasure Found",
    playToCompletion: async (page) => {
      const answers = [7, 6, 6, 10, 7, 4];
      for (let index = 0; index < answers.length; index += 1) {
        await page.getByRole("button", { name: accessibleNameEndingWith(answers[index]) }).click();
        if (index === answers.length - 1) {
          await expect(page.locator('[data-treasure-complete="true"]')).toBeVisible({ timeout: 5_000 });
        } else {
          await expect(page.locator('[data-treasure-expedition="active"]')).toHaveAttribute(
            "data-round",
            String(index + 2),
            { timeout: 5_000 },
          );
        }
      }
    },
  },
  {
    slug: "music-maker",
    expectedScore: 5,
    completionText: "Music Maker Complete",
    playToCompletion: async (page) => {
      const melodies = [
        { label: "C E G", notes: ["C", "E", "G"] },
        { label: "G E C", notes: ["G", "E", "C"] },
        { label: "C D E F", notes: ["C", "D", "E", "F"] },
        { label: "E E F G", notes: ["E", "E", "F", "G"] },
        { label: "G F E D C", notes: ["G", "F", "E", "D", "C"] },
      ];

      for (let melodyIndex = 0; melodyIndex < melodies.length; melodyIndex += 1) {
        for (const note of melodies[melodyIndex].notes) {
          await page.getByRole("button", { name: note, exact: true }).click();
        }
        await page.getByRole("button", { name: "Check", exact: true }).click();
        if (melodyIndex < melodies.length - 1) {
          await expect(page.getByRole("heading", {
            name: `Copy: ${melodies[melodyIndex + 1].label}`,
            exact: true,
          })).toBeVisible();
        }
      }
    },
  },
];

test.describe("shared game completion contract", () => {
  for (const recipe of recipes) {
    test(`${recipe.slug} records one completion and a clean replay`, async ({ page }) => {
      await seedQaFamily(page, { clear: true });

      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(`/games/${recipe.slug}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);

      await expect.poll(async () => (await readGameProgress(page, recipe.slug)).plays).toBe(1);
      await recipe.playToCompletion(page);
      await expect(page.getByText(recipe.completionText, { exact: typeof recipe.completionText === "string" }).first()).toBeVisible();

      await expect.poll(async () => readGameProgress(page, recipe.slug)).toMatchObject({
        plays: 1,
        completions: 1,
        bestScore: recipe.expectedScore,
      });

      await page.getByRole("button", { name: "Play again", exact: true }).click();
      await expect.poll(async () => readGameProgress(page, recipe.slug)).toMatchObject({
        plays: 2,
        completions: 1,
        bestScore: recipe.expectedScore,
      });

      expect(pageErrors).toEqual([]);
    });
  }
});
