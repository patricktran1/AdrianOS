"use client";

import { getSubjectMastery, readLearningForProfile } from "@/lib/adrian-learning";
import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import type { Game } from "@/lib/games";

export type AdventureChainKind = "stretch" | "rescue" | "explore";

export type AdventureChainChoice = {
  kind: AdventureChainKind;
  gameSlug: string;
  title: string;
  eyebrow: string;
  reason: string;
  href: string;
  emoji: string;
  subject: Game["subject"];
};

type BuildAdventureChainInput = {
  currentGame: Game;
  games: Game[];
  progress: AdrianProgress;
  profile: ChildProfile;
};

function minimumAge(ageLabel: string): number {
  const match = ageLabel.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function ageAppropriate(game: Game, age: number): boolean {
  if (age <= 4) {
    return ["memory-match", "pattern-master", "guess-who"].includes(game.slug)
      || game.subject === "Creativity"
      || game.subject === "Memory";
  }
  return age + 1 >= minimumAge(game.age);
}

function completionCount(progress: AdrianProgress, slug: string): number {
  return progress.games[slug]?.completions ?? 0;
}

function playCount(progress: AdrianProgress, slug: string): number {
  return progress.games[slug]?.plays ?? 0;
}

function leastPlayed(
  candidates: Game[],
  progress: AdrianProgress,
  subjectMastery: Map<Game["subject"], number>
): Game | undefined {
  return [...candidates].sort((a, b) => {
    const completionGap = completionCount(progress, a.slug) - completionCount(progress, b.slug);
    if (completionGap !== 0) return completionGap;
    const playGap = playCount(progress, a.slug) - playCount(progress, b.slug);
    if (playGap !== 0) return playGap;
    const masteryGap = (subjectMastery.get(a.subject) ?? 0) - (subjectMastery.get(b.subject) ?? 0);
    if (masteryGap !== 0) return masteryGap;
    return a.title.localeCompare(b.title);
  })[0];
}

function hrefFor(game: Game, kind: AdventureChainKind): string {
  const params = new URLSearchParams({ from: "adventure-chain", path: kind });
  return `/games/${game.slug}?${params.toString()}`;
}

function stretchReason(subject: Game["subject"], mastery: number): string {
  if (mastery >= 78) return `Use strong ${subject} power in a fresh challenge.`;
  if (mastery >= 38) return `Build the same ${subject} skill in a new world.`;
  return `Practice ${subject} again while the idea is still warm.`;
}

export function buildAdventureChain({
  currentGame,
  games,
  progress,
  profile,
}: BuildAdventureChainInput): AdventureChainChoice[] {
  const allPlayable = games.filter((game) => game.status === "playable");
  const ageMatched = allPlayable.filter((game) => ageAppropriate(game, profile.age));
  const pool = ageMatched.length >= 3 ? ageMatched : allPlayable;
  const learning = readLearningForProfile(profile.id);
  const masteryRows = getSubjectMastery(profile.id, games, progress);
  const subjectMastery = new Map(masteryRows.map((row) => [row.subject, row.mastery]));
  const due = learning.reviewQueue
    .filter((item) => item.status === "due" && item.dueAt <= new Date().toISOString())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const selected = new Set<string>([currentGame.slug]);
  const choices: AdventureChainChoice[] = [];

  const add = (
    game: Game | undefined,
    kind: AdventureChainKind,
    eyebrow: string,
    reason: string
  ) => {
    if (!game || selected.has(game.slug)) return;
    selected.add(game.slug);
    choices.push({
      kind,
      gameSlug: game.slug,
      title: game.title,
      eyebrow,
      reason,
      href: hrefFor(game, kind),
      emoji: game.emoji,
      subject: game.subject,
    });
  };

  const sameSubject = pool.filter((game) =>
    game.subject === currentGame.subject
    && game.slug !== "mastery-rescue-lab"
    && !selected.has(game.slug)
  );
  const currentMastery = subjectMastery.get(currentGame.subject) ?? 0;
  add(
    leastPlayed(sameSubject, progress, subjectMastery),
    "stretch",
    "KEEP THE POWER",
    stretchReason(currentGame.subject, currentMastery)
  );

  if (due.length > 0) {
    const rescueLab = pool.find((game) => game.slug === "mastery-rescue-lab")
      ?? allPlayable.find((game) => game.slug === "mastery-rescue-lab");
    if (currentGame.slug !== "mastery-rescue-lab") {
      add(
        rescueLab,
        "rescue",
        "MASTERY RESCUE",
        `${due.length} ${due.length === 1 ? "skill is" : "skills are"} ready for a comeback.`
      );
    } else {
      const repairedSubject = due[0]?.subject;
      const repairedGame = leastPlayed(
        pool.filter((game) => game.subject === repairedSubject && !selected.has(game.slug)),
        progress,
        subjectMastery
      );
      add(repairedGame, "rescue", "USE THE REPAIR", `Take the repaired ${repairedSubject} skill back into a full game.`);
    }
  } else {
    const weakestSubject = masteryRows.find((row) => row.subject !== currentGame.subject)?.subject;
    const skillBuilder = leastPlayed(
      pool.filter((game) =>
        game.subject === weakestSubject
        && game.slug !== "mastery-rescue-lab"
        && !selected.has(game.slug)
      ),
      progress,
      subjectMastery
    );
    add(
      skillBuilder,
      "rescue",
      "BUILD A NEW POWER",
      weakestSubject
        ? `${weakestSubject} has the most room to grow next.`
        : "Strengthen a less-practiced skill next."
    );
  }

  const exploreGame = leastPlayed(
    pool.filter((game) =>
      game.subject !== currentGame.subject
      && game.slug !== "mastery-rescue-lab"
      && !selected.has(game.slug)
    ),
    progress,
    subjectMastery
  );
  add(
    exploreGame,
    "explore",
    "CHANGE WORLDS",
    exploreGame ? `Switch to ${exploreGame.subject} and unlock a different kind of thinking.` : "Try a different kind of challenge."
  );

  for (const game of pool) {
    if (choices.length >= 3) break;
    add(
      game,
      choices.length === 0 ? "stretch" : choices.length === 1 ? "rescue" : "explore",
      choices.length === 0 ? "KEEP GOING" : choices.length === 1 ? "GROW A SKILL" : "CHANGE WORLDS",
      "A grade-matched next mission based on real play history."
    );
  }

  return choices.slice(0, 3);
}
