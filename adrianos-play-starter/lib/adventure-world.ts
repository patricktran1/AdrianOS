import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ArcadeState } from "@/lib/adventure-arcade";
import { isGameAgeFit } from "@/lib/adventure-arcade";
import { interestMatch, type LearnerInterest } from "@/lib/adrian-learning-profile";
import { totalGameCompletions } from "@/lib/adrian-prize-collections";
import type { Game } from "@/lib/games";

export type AdventureWorldThemeId =
  | "jurassic"
  | "space"
  | "robot"
  | "wildwood"
  | "storylight"
  | "rainbow"
  | "temple"
  | "cyber";

export type AdventureWorldSky = "sunrise" | "day" | "sunset" | "night";
export type AdventureWorldPortalId = "action" | "build" | "mystery" | "discover" | "boss";

export type AdventureWorldGrowthPiece = {
  emoji: string;
  label: string;
};

export type AdventureWorldPortal = {
  id: AdventureWorldPortalId;
  eyebrow: string;
  title: string;
  description: string;
  emoji: string;
  game: Game;
  href: string;
  plays: number;
  completions: number;
  interest: LearnerInterest | null;
};

export type AdventureWorldStage = {
  index: number;
  title: string;
  copy: string;
  nextAt: number | null;
};

export type AdventureWorldModel = {
  themeId: AdventureWorldThemeId;
  title: string;
  tagline: string;
  guideEmoji: string;
  sky: AdventureWorldSky;
  weatherLabel: string;
  clears: number;
  stage: AdventureWorldStage;
  growthPieces: AdventureWorldGrowthPiece[];
  nextGrowthPiece: AdventureWorldGrowthPiece | null;
  portals: AdventureWorldPortal[];
  heroPortal: AdventureWorldPortal;
  secretIcons: [string, string, string];
};

type BuildAdventureWorldInput = {
  profileId: string;
  age: number;
  grade: ElementaryGrade;
  interests: LearnerInterest[];
  games: Game[];
  progress: AdrianProgress;
  arcade: ArcadeState;
  now?: Date;
};

type WorldTheme = {
  id: AdventureWorldThemeId;
  title: string;
  tagline: string;
  guideEmoji: string;
  growth: AdventureWorldGrowthPiece[];
  secrets: [string, string, string];
};

type PortalDefinition = {
  id: AdventureWorldPortalId;
  eyebrow: string;
  title: string;
  description: string;
  emoji: string;
  slugs: string[];
  subjects: Game["subject"][];
};

const THEMES: Record<AdventureWorldThemeId, WorldTheme> = {
  jurassic: {
    id: "jurassic",
    title: "Jurassic Junction",
    tagline: "A living dinosaur world powered by real adventures.",
    guideEmoji: "🦖",
    growth: [
      { emoji: "🪺", label: "Hatchling nest" },
      { emoji: "🌿", label: "Fern meadow" },
      { emoji: "💦", label: "Watering pond" },
      { emoji: "🌉", label: "Canyon bridge" },
      { emoji: "⛺", label: "Explorer shelter" },
      { emoji: "🗼", label: "Lookout tower" },
      { emoji: "🌋", label: "Roaring volcano" },
      { emoji: "🦕", label: "Long-neck herd" },
      { emoji: "💎", label: "Crystal cave" },
      { emoji: "🏰", label: "Dino citadel" },
      { emoji: "☄️", label: "Meteor monument" },
      { emoji: "👑", label: "Jurassic crown" },
    ],
    secrets: ["🥚", "🦴", "💎"],
  },
  space: {
    id: "space",
    title: "Star Harbor",
    tagline: "Build a bright spaceport and launch into new worlds.",
    guideEmoji: "🚀",
    growth: [
      { emoji: "⭐", label: "Wish star" },
      { emoji: "🔭", label: "Sky telescope" },
      { emoji: "🌙", label: "Moon dock" },
      { emoji: "🛰️", label: "Scout satellite" },
      { emoji: "🪐", label: "Ring planet" },
      { emoji: "🚀", label: "Launch tower" },
      { emoji: "🛸", label: "Saucer port" },
      { emoji: "☄️", label: "Comet trail" },
      { emoji: "👽", label: "Alien garden" },
      { emoji: "🌌", label: "Galaxy gate" },
      { emoji: "🌟", label: "Supernova beacon" },
      { emoji: "🏆", label: "Star captain trophy" },
    ],
    secrets: ["🪐", "👽", "☄️"],
  },
  robot: {
    id: "robot",
    title: "Robo Foundry",
    tagline: "Every cleared game adds another invention to the city.",
    guideEmoji: "🤖",
    growth: [
      { emoji: "⚙️", label: "Mega gear" },
      { emoji: "🔋", label: "Power cell" },
      { emoji: "🧲", label: "Magnet crane" },
      { emoji: "🛞", label: "Turbo road" },
      { emoji: "🦾", label: "Builder arm" },
      { emoji: "📡", label: "Signal tower" },
      { emoji: "💡", label: "Idea lab" },
      { emoji: "🛡️", label: "City shield" },
      { emoji: "🎛️", label: "Control deck" },
      { emoji: "🏭", label: "Robot factory" },
      { emoji: "🚄", label: "Lightning train" },
      { emoji: "🏆", label: "Golden core" },
    ],
    secrets: ["🔩", "🔋", "💡"],
  },
  wildwood: {
    id: "wildwood",
    title: "Wildwood Reserve",
    tagline: "Grow a playful animal kingdom from every finished quest.",
    guideEmoji: "🐢",
    growth: [
      { emoji: "🌱", label: "First sprout" },
      { emoji: "🐞", label: "Beetle garden" },
      { emoji: "🌼", label: "Flower field" },
      { emoji: "🐸", label: "Frog pond" },
      { emoji: "🌳", label: "Great tree" },
      { emoji: "🦋", label: "Butterfly bridge" },
      { emoji: "🐝", label: "Honey tower" },
      { emoji: "🦉", label: "Owl library" },
      { emoji: "🦌", label: "Forest herd" },
      { emoji: "🌈", label: "Rainbow falls" },
      { emoji: "🐉", label: "Dragon hollow" },
      { emoji: "👑", label: "Wildwood crown" },
    ],
    secrets: ["🐛", "🍄", "🦋"],
  },
  storylight: {
    id: "storylight",
    title: "Storylight Kingdom",
    tagline: "Stories, art, music, and imagination make the kingdom glow.",
    guideEmoji: "📚",
    growth: [
      { emoji: "📖", label: "Storybook gate" },
      { emoji: "🎨", label: "Color studio" },
      { emoji: "🎵", label: "Melody fountain" },
      { emoji: "🪶", label: "Writer perch" },
      { emoji: "🧩", label: "Puzzle path" },
      { emoji: "🏰", label: "Story castle" },
      { emoji: "🐉", label: "Friendly dragon" },
      { emoji: "🪄", label: "Wonder tower" },
      { emoji: "🌙", label: "Moon theater" },
      { emoji: "🌈", label: "Rainbow bridge" },
      { emoji: "✨", label: "Idea constellation" },
      { emoji: "👑", label: "Creator crown" },
    ],
    secrets: ["🪶", "🎵", "🪄"],
  },
  rainbow: {
    id: "rainbow",
    title: "Rainbow Rocket Park",
    tagline: "A colorful first world that grows with every real game clear.",
    guideEmoji: "🌈",
    growth: [
      { emoji: "⭐", label: "Bright star" },
      { emoji: "🌻", label: "Sunny garden" },
      { emoji: "🎠", label: "Rocket carousel" },
      { emoji: "🌙", label: "Moon swing" },
      { emoji: "🚀", label: "Pocket rocket" },
      { emoji: "🪐", label: "Planet playground" },
      { emoji: "☄️", label: "Comet slide" },
      { emoji: "🦄", label: "Cloud unicorn" },
      { emoji: "🛸", label: "Mini saucer" },
      { emoji: "🌌", label: "Galaxy tunnel" },
      { emoji: "🌈", label: "Rainbow falls" },
      { emoji: "🏆", label: "Park trophy" },
    ],
    secrets: ["⭐", "🌈", "🦄"],
  },
  temple: {
    id: "temple",
    title: "Mystery Temple Realm",
    tagline: "Restore a legendary realm one verified adventure at a time.",
    guideEmoji: "🗿",
    growth: [
      { emoji: "🗝️", label: "Stone key" },
      { emoji: "🏺", label: "Relic garden" },
      { emoji: "🧭", label: "Explorer compass" },
      { emoji: "📜", label: "Rune wall" },
      { emoji: "🪬", label: "Oracle gate" },
      { emoji: "🌉", label: "Sun bridge" },
      { emoji: "🗿", label: "Guardian tower" },
      { emoji: "💎", label: "Temple gem" },
      { emoji: "☀️", label: "Sun dial" },
      { emoji: "🏛️", label: "Grand temple" },
      { emoji: "🐲", label: "Relic dragon" },
      { emoji: "👑", label: "Temple crown" },
    ],
    secrets: ["🗝️", "🪶", "💎"],
  },
  cyber: {
    id: "cyber",
    title: "Cyber City Grid",
    tagline: "Power a futuristic city with strategy, code, and real clears.",
    guideEmoji: "🎮",
    growth: [
      { emoji: "💾", label: "Data dock" },
      { emoji: "🧩", label: "Code bridge" },
      { emoji: "🔐", label: "Cipher gate" },
      { emoji: "⚡", label: "Power node" },
      { emoji: "📡", label: "Quantum relay" },
      { emoji: "🛡️", label: "Firewall tower" },
      { emoji: "🤖", label: "City drone" },
      { emoji: "🧠", label: "Neural lab" },
      { emoji: "🌐", label: "Network globe" },
      { emoji: "🏙️", label: "Holo skyline" },
      { emoji: "💠", label: "Master crystal" },
      { emoji: "🏆", label: "Arcade core" },
    ],
    secrets: ["💾", "⚡", "💠"],
  },
};

const PORTALS: PortalDefinition[] = [
  {
    id: "action",
    eyebrow: "ACTION TRAIL",
    title: "Dash, dodge, and move",
    description: "Fast games with motion, timing, or a world in danger.",
    emoji: "⚡",
    slugs: [
      "dino-dash-volcano-escape",
      "daily-adventure-remix",
      "rainbow-rocket-park",
      "robot-rescue-city",
      "space-station-sigma",
    ],
    subjects: ["Math", "Movement", "Science"],
  },
  {
    id: "build",
    eyebrow: "MAKER BAY",
    title: "Build something amazing",
    description: "Create a habitat, word, rhythm, machine, or new design.",
    emoji: "🛠️",
    slugs: [
      "dino-habitat-builder",
      "word-forge-studio",
      "music-maker",
      "pattern-master",
      "robot-rescue-city",
    ],
    subjects: ["Creativity", "Engineering", "Music", "Art"],
  },
  {
    id: "mystery",
    eyebrow: "MYSTERY GROVE",
    title: "Find clues and secrets",
    description: "Investigate stories, memories, patterns, and hidden answers.",
    emoji: "🔎",
    slugs: [
      "dinosaur-detective",
      "story-expedition",
      "memory-match",
      "question-quest",
      "mystery-temple",
    ],
    subjects: ["Reading", "Logic", "Memory"],
  },
  {
    id: "discover",
    eyebrow: "DISCOVERY DOCK",
    title: "Explore a wild world",
    description: "Travel through science, space, nature, and the human body.",
    emoji: "🔭",
    slugs: [
      "solar-system-explorer",
      "science-quest",
      "human-body-explorer",
      "dino-time-rescue",
      "treasure-map-math",
    ],
    subjects: ["Science", "Geography", "Health", "Environment"],
  },
  {
    id: "boss",
    eyebrow: "POWER PEAK",
    title: "Take on a boss",
    description: "A bigger challenge that adapts as the run unfolds.",
    emoji: "👾",
    slugs: [
      "adaptive-boss-arena",
      "dino-time-rescue",
      "mystery-temple",
      "cyber-city-five",
      "space-station-sigma",
    ],
    subjects: ["Logic", "Math", "Reading", "Science"],
  },
];

const FUN_EXCLUSIONS = new Set([
  "placement-adventure",
  "mastery-lab",
  "mastery-rescue-lab",
]);

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function themeFor(grade: ElementaryGrade, interests: LearnerInterest[]): WorldTheme {
  if (interests.includes("Dinosaurs")) return THEMES.jurassic;
  if (interests.includes("Space")) return THEMES.space;
  if (interests.includes("Technology") || interests.includes("Building")) return THEMES.robot;
  if (interests.includes("Animals") || interests.includes("Nature")) return THEMES.wildwood;
  if (interests.includes("Stories") || interests.includes("Art") || interests.includes("Music")) return THEMES.storylight;
  const defaults: Record<ElementaryGrade, AdventureWorldThemeId> = {
    [-1]: "wildwood",
    0: "rainbow",
    1: "robot",
    2: "jurassic",
    3: "space",
    4: "temple",
    5: "cyber",
  };
  return THEMES[defaults[grade]];
}

function stageFor(clears: number): AdventureWorldStage {
  const stages = [
    { at: 0, title: "Base Camp", copy: "Your world is awake and every portal is ready." },
    { at: 1, title: "Trailblazer World", copy: "The first real game clear added a new landmark." },
    { at: 3, title: "Growing Realm", copy: "New routes, creatures, and structures are appearing." },
    { at: 6, title: "Power Harbor", copy: "The world is buzzing with adventure energy." },
    { at: 10, title: "Legendary World", copy: "A full adventure realm has risen from verified clears." },
    { at: 16, title: "Champion Universe", copy: "The world keeps evolving with champion-level play." },
  ];
  const index = stages.reduce((best, stage, stageIndex) => clears >= stage.at ? stageIndex : best, 0);
  const current = stages[index];
  const next = stages[index + 1];
  return {
    index,
    title: current.title,
    copy: current.copy,
    nextAt: next?.at ?? null,
  };
}

function skyFor(profileId: string, date: Date): { sky: AdventureWorldSky; weatherLabel: string } {
  const options: Array<{ sky: AdventureWorldSky; weatherLabel: string }> = [
    { sky: "sunrise", weatherLabel: "Golden sunrise" },
    { sky: "day", weatherLabel: "Adventure blue" },
    { sky: "sunset", weatherLabel: "Meteor sunset" },
    { sky: "night", weatherLabel: "Starlight night" },
  ];
  return options[Math.floor(hash01(`${profileId}:${localDayKey(date)}:sky`) * options.length) % options.length];
}

function rankedGames(
  candidates: Game[],
  definition: PortalDefinition,
  input: BuildAdventureWorldInput,
  seed: string,
): Game[] {
  return [...candidates].sort((left, right) => {
    const score = (game: Game) => {
      const preferredIndex = definition.slugs.indexOf(game.slug);
      const preferredCost = preferredIndex < 0 ? 45 : preferredIndex * 5;
      const row = input.progress.games[game.slug];
      const recentIndex = input.arcade.recent.indexOf(game.slug);
      const recentCost = recentIndex === 0 ? 42 : recentIndex > 0 ? Math.max(3, 18 - recentIndex * 3) : 0;
      const favoriteBonus = input.arcade.favorites.includes(game.slug) ? -13 : 0;
      const interestBonus = interestMatch(game, input.interests) ? -22 : 0;
      const subjectBonus = definition.subjects.includes(game.subject) ? -8 : 0;
      const historyCost = (row?.completions ?? 0) * 8 + (row?.plays ?? 0) * 1.5;
      return preferredCost + recentCost + favoriteBonus + interestBonus + subjectBonus + historyCost
        + hash01(`${seed}:${game.slug}`) * 4;
    };
    return score(left) - score(right) || left.title.localeCompare(right.title);
  });
}

function portalFor(
  definition: PortalDefinition,
  pool: Game[],
  selected: Set<string>,
  input: BuildAdventureWorldInput,
  seed: string,
): AdventureWorldPortal | null {
  const preferred = pool.filter((game) => definition.slugs.includes(game.slug) && !selected.has(game.slug));
  const subjectFit = pool.filter((game) => definition.subjects.includes(game.subject) && !selected.has(game.slug));
  const fallback = pool.filter((game) => !selected.has(game.slug));
  const candidates = preferred.length > 0 ? preferred : subjectFit.length > 0 ? subjectFit : fallback;
  const game = rankedGames(candidates, definition, input, seed)[0];
  if (!game) return null;
  selected.add(game.slug);
  const row = input.progress.games[game.slug];
  return {
    id: definition.id,
    eyebrow: definition.eyebrow,
    title: definition.title,
    description: definition.description,
    emoji: definition.emoji,
    game,
    href: `/games/${game.slug}?${new URLSearchParams({ from: "adventure-world", portal: definition.id }).toString()}`,
    plays: row?.plays ?? 0,
    completions: row?.completions ?? 0,
    interest: interestMatch(game, input.interests),
  };
}

export function buildAdventureWorld(input: BuildAdventureWorldInput): AdventureWorldModel | null {
  const now = input.now ?? new Date();
  const playable = input.games.filter((game) => game.status === "playable" && !FUN_EXCLUSIONS.has(game.slug));
  const ageFit = playable.filter((game) => isGameAgeFit(game, input.age));
  const pool = ageFit.length >= 5 ? ageFit : playable;
  if (pool.length === 0) return null;

  const theme = themeFor(input.grade, input.interests);
  const selected = new Set<string>();
  const seed = `${input.profileId}:${localDayKey(now)}:${theme.id}`;
  const portals = PORTALS
    .map((definition) => portalFor(definition, pool, selected, input, `${seed}:${definition.id}`))
    .filter((portal): portal is AdventureWorldPortal => Boolean(portal));
  if (portals.length === 0) return null;

  const heroPortal = [...portals].sort((left, right) => {
    const leftScore = left.completions * 9 + left.plays * 2 + (left.interest ? -16 : 0)
      + hash01(`${seed}:hero:${left.game.slug}`) * 3;
    const rightScore = right.completions * 9 + right.plays * 2 + (right.interest ? -16 : 0)
      + hash01(`${seed}:hero:${right.game.slug}`) * 3;
    return leftScore - rightScore;
  })[0];

  const clears = totalGameCompletions(input.progress);
  const growthCount = Math.min(theme.growth.length, clears);
  const weather = skyFor(input.profileId, now);
  return {
    themeId: theme.id,
    title: theme.title,
    tagline: theme.tagline,
    guideEmoji: theme.guideEmoji,
    sky: weather.sky,
    weatherLabel: weather.weatherLabel,
    clears,
    stage: stageFor(clears),
    growthPieces: theme.growth.slice(0, growthCount),
    nextGrowthPiece: theme.growth[growthCount] ?? null,
    portals,
    heroPortal,
    secretIcons: theme.secrets,
  };
}
