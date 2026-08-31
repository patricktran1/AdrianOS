/**
 * The interaction-mechanic registry.
 *
 * Single authority for two questions the rest of AdrianOS asks:
 *
 * 1. "What cognitive action does this game ask for?" — so every learning
 *    attempt can carry a mechanic without editing 47 games. A game's
 *    classification here is the default; an attempt that reports its own
 *    mechanic (the kernel routes do) always wins.
 *
 * 2. "Where can this skill be expressed through a different verb?" — so the
 *    learner model can route a child who is fluent in one interaction form
 *    toward the same skill in another, which is what turns "answers this
 *    reliably" into evidence of understanding that survives a change of
 *    representation.
 *
 * Classification is deliberately conservative: a game whose rounds are
 * mostly tap-the-right-option is "choose" even if one round adds a drag
 * skin, because the cognitive action — recognise the right answer among
 * offered ones — is the same.
 */

// Relative with extension so the module loads under node type stripping
// (unit tests) as well as the bundler.
import {
  KERNEL_SKILLS,
  type KernelVerb,
} from "./kernel-tasks.ts";
import { DEDUCE_SKILLS } from "./deduce-tasks.ts";

/** Every interaction verb AdrianOS can currently distinguish. */
export type InteractionMechanic = KernelVerb | "deduce" | "choose" | "recall";

export const KERNEL_GAMES: Record<KernelVerb, {
  slug: string;
  title: string;
  emoji: string;
}> = {
  build: { slug: "maker-workshop", title: "Maker Workshop", emoji: "🧱" },
  place: { slug: "stepping-stones", title: "Stepping Stones", emoji: "🪨" },
};

/** Where DEDUCE lives. Not a KernelVerb: it has its own task engine. */
export const DEDUCE_GAME = {
  slug: "clue-hollow",
  title: "Clue Hollow",
  emoji: "🔦",
} as const;

/**
 * Games whose primary interaction is not tap-the-right-option.
 * Everything absent from this map defaults to "choose".
 */
const MECHANIC_BY_GAME: Record<string, InteractionMechanic> = {
  [KERNEL_GAMES.build.slug]: "build",
  [KERNEL_GAMES.place.slug]: "place",
  [DEDUCE_GAME.slug]: "deduce",
  // Compose a word letter by letter: genuine construction.
  "word-forge-studio": "build",
  // Move a runner to a position on a number line: genuine positioning.
  "math-motion-lab": "place",
  // Find pairs from memory.
  "memory-match": "recall",
};

export function mechanicForGame(gameSlug: string): InteractionMechanic {
  return MECHANIC_BY_GAME[gameSlug] ?? "choose";
}

export function normalizeMechanic(value: unknown): InteractionMechanic | null {
  return value === "build" || value === "place" || value === "deduce"
    || value === "choose" || value === "recall"
    ? value
    : null;
}

/** The verbs the kernel routes can express a skill through. */
export function kernelVerbsForSkill(skillId: string): KernelVerb[] {
  const verbs: KernelVerb[] = [];
  if (KERNEL_SKILLS.build.includes(skillId)) verbs.push("build");
  if (KERNEL_SKILLS.place.includes(skillId)) verbs.push("place");
  return verbs;
}

/**
 * The kind of thinking a mechanic asks for.
 *
 * Not all mechanic variety is equally informative. Four visually different
 * games that all ask a child to pick the right option are still one kind of
 * demand; recognising, constructing, positioning and inferring are four.
 * Breadth is counted in these categories so a themed reskin can never look
 * like a new way of knowing something.
 */
export type MechanicCategory = "recognition" | "construction" | "position" | "inference";

const MECHANIC_CATEGORIES = new Map<InteractionMechanic, MechanicCategory>([
  ["choose", "recognition"],
  ["recall", "recognition"],
  ["build", "construction"],
  ["place", "position"],
  ["deduce", "inference"],
]);

export function mechanicCategory(mechanic: InteractionMechanic): MechanicCategory {
  return MECHANIC_CATEGORIES.get(mechanic) ?? "recognition";
}

/** Distinct kinds of thinking represented in a set of mechanics. */
export function distinctCategories(
  mechanics: readonly InteractionMechanic[]
): MechanicCategory[] {
  return [...new Set(mechanics.map(mechanicCategory))];
}

/** True when DEDUCE can express this skill. */
export function deduceSupportsSkill(skillId: string): boolean {
  return DEDUCE_SKILLS.includes(skillId);
}

/** The Clue Hollow route for a skill, parameterised for the teaching engine. */
export function deduceRouteForSkill(
  skillId: string,
  from: string
): { slug: string; title: string; emoji: string; href: string } | null {
  if (!deduceSupportsSkill(skillId)) return null;
  return {
    ...DEDUCE_GAME,
    href: `/games/${DEDUCE_GAME.slug}?${new URLSearchParams({ skill: skillId, from })}`,
  };
}

/**
 * A route that expresses `skillId` through a mechanic the learner has not
 * yet shown it in, or null when no such route exists. `usedMechanics` is
 * whatever the learner model has observed for the skill so far.
 */
export function alternateMechanicRoute(
  skillId: string,
  usedMechanics: readonly string[]
): { verb: KernelVerb | "deduce"; slug: string; title: string; emoji: string; href: string } | null {
  for (const verb of kernelVerbsForSkill(skillId)) {
    if (usedMechanics.includes(verb)) continue;
    const game = KERNEL_GAMES[verb];
    return {
      verb,
      ...game,
      href: `/games/${game.slug}?${new URLSearchParams({ skill: skillId, from: "transfer" })}`,
    };
  }
  // Inference is offered last: a child meeting an idea in a new form is
  // usually better served by handling it or placing it before being asked
  // to work it out from relationships.
  if (!usedMechanics.includes("deduce")) {
    const route = deduceRouteForSkill(skillId, "transfer");
    if (route) return { verb: "deduce", ...route };
  }
  return null;
}
