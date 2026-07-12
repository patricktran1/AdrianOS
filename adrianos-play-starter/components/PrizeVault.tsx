"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { elementaryGradeLabel, type ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";

type Prize = { emoji: string; name: string };
type Collection = { title: string; intro: string; prizes: Prize[] };

function prizes(items: string[]): Prize[] {
  return items.map((item) => {
    const [emoji, ...name] = item.split(" ");
    return { emoji, name: name.join(" ") };
  });
}

const COLLECTIONS: Record<ElementaryGrade, Collection> = {
  [-1]: { title: "Critter Parade", intro: "Every finished game invites a new parade friend.", prizes: prizes(["🐛 Wiggle Bug", "🐸 Hop Frog", "🐞 Dot Beetle", "🦋 Sky Flutter", "🐌 Turbo Snail", "🐝 Buzz Buddy", "🐢 Tiny Turtle", "🦀 Clap Crab", "🐙 Wavy Octopus", "🦖 Baby Dino", "🦄 Cloud Unicorn", "🐉 Mini Dragon"]) },
  0: { title: "Rainbow Rocket Crew", intro: "Finish adventures to fill the rocket with a colorful crew.", prizes: prizes(["🌈 Rainbow Fuel", "🚀 Pocket Rocket", "⭐ Wish Star", "🌙 Moon Pal", "🪐 Ring Planet", "☄️ Comet Dash", "👽 Friendly Alien", "🛸 Mini Saucer", "🌞 Sunny Captain", "🔭 Star Finder", "🛰️ Space Scout", "🌌 Galaxy Gem"]) },
  1: { title: "Robot Upgrade Deck", intro: "Each clear installs a new robot upgrade.", prizes: prizes(["🤖 Helper Bot", "⚙️ Mega Gear", "🔋 Power Cell", "🦾 Strong Arm", "🛞 Turbo Wheels", "📡 Signal Dish", "💡 Idea Bulb", "🧲 Magnet Grip", "🛡️ Shield Plate", "🔧 Fix-It Tool", "🎛️ Control Board", "🏆 Golden Core"]) },
  2: { title: "Dragon Treasure Hoard", intro: "Every completed quest adds treasure to the hoard.", prizes: prizes(["🥚 Dragon Egg", "🔥 Fire Spark", "🗝️ Castle Key", "💎 Blue Gem", "👑 Tiny Crown", "🧭 Quest Compass", "🗡️ Hero Sword", "🛡️ Knight Shield", "🏰 Pocket Castle", "📜 Secret Map", "🐲 Dragon Friend", "🏆 Royal Trophy"]) },
  3: { title: "Space Station Specimens", intro: "Successful missions recover rare objects from deep space.", prizes: prizes(["🧪 Meteor Sample", "🛰️ Scout Satellite", "🪐 Gas Giant", "🌑 Dark Moon", "☄️ Ice Comet", "👾 Pixel Alien", "🔭 Deep Lens", "🧬 Alien Helix", "🚀 Research Shuttle", "🌟 Supernova", "🕳️ Black Hole", "🌌 Sigma Galaxy"]) },
  4: { title: "Temple Relic Gallery", intro: "Each victory restores one relic to the gallery.", prizes: prizes(["🗿 Stone Guardian", "🏺 Ancient Vase", "🪬 Oracle Eye", "🧿 Blue Talisman", "📜 Rune Scroll", "🗝️ Vault Key", "💎 Sun Gem", "🧭 Lost Compass", "⚱️ Golden Urn", "🪶 Scribe Feather", "☀️ Sun Dial", "👑 Temple Crown"]) },
  5: { title: "Cyber City Artifact Grid", intro: "Completed runs decrypt one artifact at a time.", prizes: prizes(["💾 Data Disk", "🧩 Code Fragment", "🔐 Cipher Lock", "🛡️ Firewall Badge", "🧠 Neural Chip", "📡 Quantum Relay", "🎮 Arcade Core", "⚡ Power Node", "🤖 City Drone", "🕶️ Holo Visor", "🌐 Network Globe", "💠 Master Crystal"]) },
};

export default function PrizeVault() {
  const { activeProfile } = useFamilyProfiles();
  const { progress, hydrated } = useAdrianProgress();
  const [celebrate, setCelebrate] = useState(false);
  const grade = readProfileGrade(activeProfile);
  const collection = COLLECTIONS[grade];
  const clears = Object.values(progress.games).reduce((sum, game) => sum + game.completions, 0);
  const unlocked = Math.min(collection.prizes.length, clears);
  const prestige = Math.max(0, clears - collection.prizes.length);
  const seenKey = `adrianos-prize-vault-seen-v1:${activeProfile.id}`;

  useEffect(() => {
    if (!hydrated) return;
    const seen = Number(window.localStorage.getItem(seenKey) ?? "0");
    if (unlocked <= seen) return;
    setCelebrate(true);
    window.localStorage.setItem(seenKey, String(unlocked));
    const timer = window.setTimeout(() => setCelebrate(false), 4200);
    return () => window.clearTimeout(timer);
  }, [hydrated, seenKey, unlocked]);

  const nextPrize = collection.prizes[unlocked];
  const message = useMemo(() => {
    if (unlocked === 0) return "Finish any game to open your first prize.";
    if (unlocked < collection.prizes.length) return `${collection.prizes.length - unlocked} prizes still hidden.`;
    return prestige > 0 ? `Collection complete · ${prestige} champion stars earned.` : "Collection complete. Replays now earn champion stars.";
  }, [collection.prizes.length, prestige, unlocked]);

  return (
    <section aria-label="Prize Vault" style={{ ...shell, ...(celebrate ? celebration : {}) }}>
      <div style={headingRow}>
        <div><span style={eyebrow}>PRIZE VAULT · {elementaryGradeLabel(grade)}</span><h2 style={title}>{collection.title}</h2><p style={copy}>{collection.intro}</p></div>
        <div style={counter} aria-label={`${unlocked} of ${collection.prizes.length} prizes unlocked`}><strong>{unlocked}/{collection.prizes.length}</strong><span>UNLOCKED</span></div>
      </div>

      {celebrate && unlocked > 0 && <div role="status" style={newPrizeBanner}><span style={{ fontSize: 36 }}>{collection.prizes[unlocked - 1].emoji}</span><span><strong style={{ display: "block" }}>New prize unlocked!</strong><small>{collection.prizes[unlocked - 1].name} joined your collection.</small></span><span aria-hidden="true">✨</span></div>}

      <div style={grid}>{collection.prizes.map((prize, index) => {
        const open = index < unlocked;
        return <div key={prize.name} style={{ ...prizeCard, ...(open ? openCard : lockedCard) }} aria-label={open ? `${prize.name} unlocked` : "Locked prize"}><span style={prizeEmoji}>{open ? prize.emoji : "?"}</span><strong>{open ? prize.name : "Mystery prize"}</strong><small>{open ? `Clear ${index + 1}` : `Finish ${Math.max(1, index + 1 - clears)} more`}</small></div>;
      })}</div>

      <div style={footerRow}><span>{message}</span>{nextPrize && <strong>Next: {nextPrize.emoji} {nextPrize.name}</strong>}{prestige > 0 && <strong>⭐ {prestige} champion stars</strong>}</div>
    </section>
  );
}

const shell: React.CSSProperties = { margin: "18px 0", padding: "clamp(18px,4vw,30px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.14)", background: "radial-gradient(circle at top right,rgba(217,255,91,.16),transparent 32%),linear-gradient(145deg,#1a1e29,#222936)", color: "#fff", boxShadow: "0 20px 55px rgba(0,0,0,.22)", transition: "transform .25s ease,box-shadow .25s ease" };
const celebration: React.CSSProperties = { transform: "translateY(-3px)", boxShadow: "0 0 0 3px rgba(217,255,91,.3),0 26px 70px rgba(0,0,0,.3)" };
const headingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".13em" };
const title: React.CSSProperties = { margin: "7px 0 6px", fontSize: "clamp(1.8rem,5vw,3rem)", letterSpacing: "-.05em", lineHeight: .95 };
const copy: React.CSSProperties = { margin: 0, color: "#b7bfcc", fontWeight: 650, lineHeight: 1.45 };
const counter: React.CSSProperties = { minWidth: 96, display: "grid", placeItems: "center", padding: "12px 16px", borderRadius: 20, background: "#d9ff5b", color: "#11151d" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 10, marginTop: 20 };
const prizeCard: React.CSSProperties = { minHeight: 132, display: "grid", placeItems: "center", alignContent: "center", gap: 5, padding: 12, borderRadius: 20, textAlign: "center" };
const openCard: React.CSSProperties = { background: "linear-gradient(160deg,rgba(127,220,255,.18),rgba(198,184,255,.12))", border: "1px solid rgba(127,220,255,.35)" };
const lockedCard: React.CSSProperties = { background: "rgba(255,255,255,.035)", border: "1px dashed rgba(255,255,255,.14)", color: "#737b89" };
const prizeEmoji: React.CSSProperties = { fontSize: 35, filter: "drop-shadow(0 8px 12px rgba(0,0,0,.28))" };
const newPrizeBanner: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: "12px 16px", borderRadius: 18, background: "#d9ff5b", color: "#11151d", fontWeight: 900 };
const footerRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16, color: "#b7bfcc", fontSize: 13 };
