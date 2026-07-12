import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";

export type AdrianPrize = {
  emoji: string;
  name: string;
};

export type AdrianPrizeCollection = {
  title: string;
  intro: string;
  prizes: AdrianPrize[];
};

export type AdrianPrizeProgress = {
  clears: number;
  unlocked: number;
  prestige: number;
  latestPrize: AdrianPrize | null;
  nextPrize: AdrianPrize | null;
};

function prizes(items: string[]): AdrianPrize[] {
  return items.map((item) => {
    const [emoji, ...name] = item.split(" ");
    return { emoji, name: name.join(" ") };
  });
}

export const ADRIAN_PRIZE_COLLECTIONS: Record<ElementaryGrade, AdrianPrizeCollection> = {
  [-1]: {
    title: "Critter Parade",
    intro: "Every finished game invites a new parade friend.",
    prizes: prizes(["🐛 Wiggle Bug", "🐸 Hop Frog", "🐞 Dot Beetle", "🦋 Sky Flutter", "🐌 Turbo Snail", "🐝 Buzz Buddy", "🐢 Tiny Turtle", "🦀 Clap Crab", "🐙 Wavy Octopus", "🦖 Baby Dino", "🦄 Cloud Unicorn", "🐉 Mini Dragon"]),
  },
  0: {
    title: "Rainbow Rocket Crew",
    intro: "Finish adventures to fill the rocket with a colorful crew.",
    prizes: prizes(["🌈 Rainbow Fuel", "🚀 Pocket Rocket", "⭐ Wish Star", "🌙 Moon Pal", "🪐 Ring Planet", "☄️ Comet Dash", "👽 Friendly Alien", "🛸 Mini Saucer", "🌞 Sunny Captain", "🔭 Star Finder", "🛰️ Space Scout", "🌌 Galaxy Gem"]),
  },
  1: {
    title: "Robot Upgrade Deck",
    intro: "Each clear installs a new robot upgrade.",
    prizes: prizes(["🤖 Helper Bot", "⚙️ Mega Gear", "🔋 Power Cell", "🦾 Strong Arm", "🛞 Turbo Wheels", "📡 Signal Dish", "💡 Idea Bulb", "🧲 Magnet Grip", "🛡️ Shield Plate", "🔧 Fix-It Tool", "🎛️ Control Board", "🏆 Golden Core"]),
  },
  2: {
    title: "Dragon Treasure Hoard",
    intro: "Every completed quest adds treasure to the hoard.",
    prizes: prizes(["🥚 Dragon Egg", "🔥 Fire Spark", "🗝️ Castle Key", "💎 Blue Gem", "👑 Tiny Crown", "🧭 Quest Compass", "🗡️ Hero Sword", "🛡️ Knight Shield", "🏰 Pocket Castle", "📜 Secret Map", "🐲 Dragon Friend", "🏆 Royal Trophy"]),
  },
  3: {
    title: "Space Station Specimens",
    intro: "Successful missions recover rare objects from deep space.",
    prizes: prizes(["🧪 Meteor Sample", "🛰️ Scout Satellite", "🪐 Gas Giant", "🌑 Dark Moon", "☄️ Ice Comet", "👾 Pixel Alien", "🔭 Deep Lens", "🧬 Alien Helix", "🚀 Research Shuttle", "🌟 Supernova", "🕳️ Black Hole", "🌌 Sigma Galaxy"]),
  },
  4: {
    title: "Temple Relic Gallery",
    intro: "Each victory restores one relic to the gallery.",
    prizes: prizes(["🗿 Stone Guardian", "🏺 Ancient Vase", "🪬 Oracle Eye", "🧿 Blue Talisman", "📜 Rune Scroll", "🗝️ Vault Key", "💎 Sun Gem", "🧭 Lost Compass", "⚱️ Golden Urn", "🪶 Scribe Feather", "☀️ Sun Dial", "👑 Temple Crown"]),
  },
  5: {
    title: "Cyber City Artifact Grid",
    intro: "Completed runs decrypt one artifact at a time.",
    prizes: prizes(["💾 Data Disk", "🧩 Code Fragment", "🔐 Cipher Lock", "🛡️ Firewall Badge", "🧠 Neural Chip", "📡 Quantum Relay", "🎮 Arcade Core", "⚡ Power Node", "🤖 City Drone", "🕶️ Holo Visor", "🌐 Network Globe", "💠 Master Crystal"]),
  },
};

export function totalGameCompletions(progress: AdrianProgress): number {
  return Object.values(progress.games).reduce((sum, game) => sum + game.completions, 0);
}

export function prizeProgressForGrade(
  progress: AdrianProgress,
  grade: ElementaryGrade
): AdrianPrizeProgress {
  const collection = ADRIAN_PRIZE_COLLECTIONS[grade];
  const clears = totalGameCompletions(progress);
  const unlocked = Math.min(collection.prizes.length, clears);
  return {
    clears,
    unlocked,
    prestige: Math.max(0, clears - collection.prizes.length),
    latestPrize: unlocked > 0 ? collection.prizes[unlocked - 1] : null,
    nextPrize: collection.prizes[unlocked] ?? null,
  };
}
