/**
 * The AdrianOS world map.
 *
 * This is the single model behind the child's home screen. It composes the
 * existing adventure-world theme system with the learner model so that the
 * map is both a place and a teaching decision:
 *
 * - Landmarks keep a fixed position per portal id, so the geography is
 *   learnable. "The peak is always top right" is a real navigation aid for a
 *   child who cannot yet read the labels.
 * - Exactly one landmark is the beacon. It is larger, it glows, and the guide
 *   stands next to it. A non-reader can find the next thing to do without
 *   any text at all.
 * - Which landmark becomes the beacon is decided by evidence, not novelty.
 *
 * Pure and synchronous so it can be unit tested without a browser.
 */

import type {
  AdventureWorldModel,
  AdventureWorldPortal,
  AdventureWorldPortalId,
} from "@/lib/adventure-world";
import type { LearnerModel, NextActivity, WorldIntent } from "@/lib/adrian-learner-model";
import { KERNEL_GAMES } from "./kernels/kernel-registry.ts";

export type WorldPoint = { x: number; y: number };


export type WorldLandmark = {
  portal: AdventureWorldPortal;
  /** Position on a wide (landscape) map, in percent. */
  wide: WorldPoint;
  /** Position on a tall (portrait) map, in percent. */
  tall: WorldPoint;
  /** Rendering weight: the beacon is the single primary target. */
  beacon: boolean;
  /** True once the child has cleared this landmark's game at least once. */
  cleared: boolean;
  /** The activity currently waiting at this place. */
  status: string;
  /** What tapping this landmark opens. Usually the portal's own game. */
  href: string;
  /** The place name. Stable across sessions, which is what makes it a map. */
  label: string;
  /** The icon shown in the orb. */
  emoji: string;
};

export type WorldStructure = {
  emoji: string;
  label: string;
  wide: WorldPoint;
  tall: WorldPoint;
  /** Render scale. Distant structures are smaller, which reads as depth. */
  scale: number;
};

export type WorldMap = {
  themeId: AdventureWorldModel["themeId"];
  title: string;
  sky: AdventureWorldModel["sky"];
  guideEmoji: string;
  stageTitle: string;
  clears: number;
  /** Clears still needed for the next structure, or null at full growth. */
  nextStructureIn: number | null;
  landmarks: WorldLandmark[];
  beacon: WorldLandmark;
  structures: WorldStructure[];
  /** One short line the guide says. Child language, never assessment language. */
  guideLine: string;
  intent: WorldIntent;
  /** Adult-facing explanation of the beacon choice, for the parent surface. */
  rationale: string;
  /** Hidden glints the child can find on the map, worth a few coins. */
  glints: Array<{ emoji: string; wide: WorldPoint; tall: WorldPoint }>;
};

/**
 * Fixed geography. Keyed by portal id so a landmark never moves between
 * sessions, even though the game behind it rotates.
 */
const LANDMARK_POSITIONS: Record<
  AdventureWorldPortalId,
  { wide: WorldPoint; tall: WorldPoint }
> = {
  build: { wide: { x: 15, y: 32 }, tall: { x: 22, y: 24 } },
  action: { wide: { x: 24, y: 71 }, tall: { x: 24, y: 62 } },
  mystery: { wide: { x: 50, y: 50 }, tall: { x: 52, y: 43 } },
  discover: { wide: { x: 78, y: 30 }, tall: { x: 76, y: 22 } },
  boss: { wide: { x: 86, y: 70 }, tall: { x: 74, y: 66 } },
};

/**
 * Where built structures appear as the world grows. Ordered and stable, so a
 * structure never moves once it has been earned.
 *
 * Every position sits on terrain rather than in open sky, and distant rows
 * render smaller: a world where the child's landmarks float in mid-air stops
 * reading as a place.
 */
const STRUCTURE_POSITIONS: Array<{
  wide: WorldPoint;
  tall: WorldPoint;
  scale: number;
}> = [
  { wide: { x: 9, y: 88 }, tall: { x: 12, y: 90 }, scale: 1 },
  { wide: { x: 41, y: 92 }, tall: { x: 44, y: 94 }, scale: 1 },
  { wide: { x: 68, y: 89 }, tall: { x: 72, y: 91 }, scale: 1 },
  { wide: { x: 92, y: 93 }, tall: { x: 88, y: 96 }, scale: 1 },
  { wide: { x: 20, y: 80 }, tall: { x: 24, y: 82 }, scale: .92 },
  { wide: { x: 55, y: 79 }, tall: { x: 60, y: 81 }, scale: .92 },
  { wide: { x: 80, y: 82 }, tall: { x: 84, y: 84 }, scale: .92 },
  { wide: { x: 6, y: 68 }, tall: { x: 8, y: 72 }, scale: .8 },
  { wide: { x: 33, y: 63 }, tall: { x: 38, y: 70 }, scale: .8 },
  { wide: { x: 62, y: 66 }, tall: { x: 66, y: 72 }, scale: .8 },
  { wide: { x: 94, y: 62 }, tall: { x: 92, y: 68 }, scale: .8 },
  { wide: { x: 46, y: 44 }, tall: { x: 50, y: 56 }, scale: .62 },
];

const GLINT_POSITIONS: Array<{ wide: WorldPoint; tall: WorldPoint }> = [
  { wide: { x: 5, y: 40 }, tall: { x: 6, y: 36 } },
  { wide: { x: 96, y: 55 }, tall: { x: 94, y: 52 } },
  { wide: { x: 38, y: 86 }, tall: { x: 34, y: 86 } },
];

/**
 * The world's sky follows the child's real clock.
 *
 * A world that is bright in the morning and starlit in the evening reads as a
 * place that exists whether or not the child is in it, which a randomly
 * assigned sky never does.
 */
export function skyForHour(hour: number): AdventureWorldModel["sky"] {
  if (hour < 5) return "night";
  if (hour < 9) return "sunrise";
  if (hour < 17) return "day";
  if (hour < 20) return "sunset";
  return "night";
}

/**
 * The order a walking route visits the landmarks in. Drawing the trail in a
 * fixed order is what turns five buttons into one connected map.
 */
export const TRAIL_ORDER: AdventureWorldPortalId[] = [
  "action",
  "build",
  "mystery",
  "discover",
  "boss",
];

/** The trail as an SVG polyline point list, in map percentage units. */
export function trailPoints(
  landmarks: WorldLandmark[],
  orientation: "wide" | "tall"
): string {
  return TRAIL_ORDER
    .map((id) => landmarks.find((landmark) => landmark.portal.id === id))
    .filter((landmark): landmark is WorldLandmark => landmark !== undefined)
    .map((landmark) => `${landmark[orientation].x},${landmark[orientation].y}`)
    .join(" ");
}

/**
 * Place names come from the portal, not the game.
 *
 * A map labels places; the activity waiting there is secondary. Keeping the
 * place name fixed while the game behind it rotates is what lets a child
 * navigate by memory instead of by reading.
 */
function placeName(portal: AdventureWorldPortal): string {
  return portal.eyebrow
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Picks which landmark the world should point at.
 *
 * Preference order, strongest first:
 * 1. A landmark whose game the child already met the focus skill in.
 * 2. A landmark whose subject matches the focus skill.
 * 3. For a stretch, the boss peak; for exploring, the least-played landmark.
 */
function chooseBeaconId(
  portals: AdventureWorldPortal[],
  next: NextActivity,
  heroId: AdventureWorldPortalId
): AdventureWorldPortalId {
  if (next.preferredSlugs.length > 0) {
    const bySlug = portals.find((portal) =>
      next.preferredSlugs.includes(portal.game.slug)
    );
    if (bySlug) return bySlug.id;
  }

  if (next.subject) {
    const bySubject = portals.find((portal) => portal.game.subject === next.subject);
    if (bySubject) return bySubject.id;
  }

  if (next.intent === "stretch") {
    const boss = portals.find((portal) => portal.id === "boss");
    if (boss) return boss.id;
  }

  if (next.intent === "explore") {
    // Novelty is the right default only while evidence is thin: send the child
    // somewhere they have not been rather than repeating a familiar route.
    const freshest = [...portals].sort(
      (a, b) => a.plays - b.plays || a.completions - b.completions
    )[0];
    if (freshest) return freshest.id;
  }

  return heroId;
}

/**
 * What the beacon should say it leads to when the model routed past the
 * portal's own game. Falls back to the hosted game rather than inventing a
 * name for a destination this module does not recognise.
 */
function destinationTitle(
  next: NextActivity,
  portal: AdventureWorldPortal,
  resolve: TitleResolver
): string | null {
  const slug = next.preferredSlugs[0];
  if (!slug || slug === portal.game.slug) return null;
  const kernel = Object.values(KERNEL_GAMES).find((game) => game.slug === slug);
  return kernel ? kernel.title : resolve(slug);
}

/**
 * Names a destination the map does not host itself.
 *
 * This module knows the kernel games because it routes to them; it does not
 * know the catalogue, and importing it here would put every game's content
 * behind the world screen. The caller, which already has the catalogue,
 * supplies the lookup — without it a child taps a landmark labelled with the
 * game the place happens to be hosting and lands somewhere else.
 */
export type TitleResolver = (slug: string) => string | null;

function guideLineFor(
  next: NextActivity,
  beacon: AdventureWorldPortal,
  clears: number
): string {
  if (next.intent === "explore") {
    return clears === 0
      ? "Tap the glowing one. I'll come with you!"
      : `${beacon.title} is open. Want to go?`;
  }
  return next.childReason;
}

export function buildWorldMap(
  world: AdventureWorldModel,
  learner: LearnerModel,
  next: NextActivity,
  foundGlints: number[] = [],
  now = new Date(),
  resolveTitle: TitleResolver = () => null
): WorldMap {
  // A landmark is a place, not a fixed game: the game behind each portal
  // already rotates, so a place can host whatever the session needs today
  // without the geography moving.
  //
  // There used to be a second input here — a stored playlist that could take
  // the beacon over. There is now one planner, and `next` is its current
  // step, so the world has nothing to arbitrate between.
  const beaconId = chooseBeaconId(world.portals, next, world.heroPortal.id);

  const landmarks: WorldLandmark[] = world.portals.map((portal) => {
    const beacon = portal.id === beaconId;
    const position = LANDMARK_POSITIONS[portal.id];
    // A model decision that names a specific destination (a kernel run for a
    // particular skill) carries it through the beacon; the landmark still
    // shows the place, only the door leads deeper.
    //
    // The destination applies even when the portal is currently rotating a
    // different game. A place hosts whatever the child needs today, and a
    // teaching decision that could only be honoured when the right game
    // happened to be on the map would be silently dropped most of the time.
    const modelHref = beacon ? next.preferredHref : null;
    const modelTitle = modelHref ? destinationTitle(next, portal, resolveTitle) : null;
    return {
      portal,
      wide: position.wide,
      tall: position.tall,
      beacon,
      cleared: portal.completions > 0,
      status: modelTitle ?? portal.game.title,
      href: modelHref ?? portal.href,
      label: placeName(portal),
      emoji: portal.emoji,
    };
  });

  // The beacon must always exist: if the chosen id somehow has no portal the
  // world still needs one primary target rather than none.
  const beacon =
    landmarks.find((landmark) => landmark.beacon)
    ?? { ...landmarks[0], beacon: true, status: "Go here" };
  if (!landmarks.some((landmark) => landmark.beacon)) landmarks[0] = beacon;

  const structures: WorldStructure[] = world.growthPieces.map((piece, index) => {
    const slot = STRUCTURE_POSITIONS[index % STRUCTURE_POSITIONS.length];
    return {
      emoji: piece.emoji,
      label: piece.label,
      wide: slot.wide,
      tall: slot.tall,
      scale: slot.scale,
    };
  });

  const glints = world.secretIcons
    .map((emoji, index) => ({
      emoji,
      wide: GLINT_POSITIONS[index].wide,
      tall: GLINT_POSITIONS[index].tall,
      index,
    }))
    .filter((glint) => !foundGlints.includes(glint.index))
    .map(({ emoji, wide, tall }) => ({ emoji, wide, tall }));

  return {
    themeId: world.themeId,
    title: world.title,
    sky: skyForHour(now.getHours()),
    guideEmoji: world.guideEmoji,
    stageTitle: world.stage.title,
    clears: world.clears,
    nextStructureIn: world.nextGrowthPiece ? 1 : null,
    landmarks,
    beacon,
    structures,
    guideLine: guideLineFor(next, beacon.portal, world.clears),
    intent: next.intent,
    rationale: next.adultReason,
    glints,
  };
}

/**
 * A short, readable summary of why the world looks the way it does.
 * Used by the parent surface, never shown to the child.
 */
export function describeWorldDecision(map: WorldMap, learner: LearnerModel): string {
  const evidence = learner.sampleSize === 0
    ? "no recorded answers yet"
    : `${learner.sampleSize} recorded answer${learner.sampleSize === 1 ? "" : "s"}`;
  return `${map.beacon.label} is highlighted (${map.intent}) from ${evidence}. ${map.rationale}`;
}
