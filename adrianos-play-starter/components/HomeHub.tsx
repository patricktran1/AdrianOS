"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

const LEGACY_HUB_KEY = "adrianos-home-hub-v1";
const HUB_PREFIX = "adrianos-home-hub-v2:";

const SHOP_ITEMS = [
  { id: "rocket", emoji: "🚀", name: "Rocket Pilot", cost: 0 },
  { id: "robot", emoji: "🤖", name: "Robot Coder", cost: 20 },
  { id: "dinosaur", emoji: "🦖", name: "Dino Detective", cost: 30 },
  { id: "astronaut", emoji: "🧑‍🚀", name: "Space Explorer", cost: 40 },
  { id: "wizard", emoji: "🧙", name: "Puzzle Wizard", cost: 50 },
  { id: "dragon", emoji: "🐉", name: "Dragon Master", cost: 60 },
] as const;

type HubState = {
  day: string;
  baselinePlays: number;
  baselineCompletions: number;
  claimedMissions: string[];
  unlockedAvatars: string[];
  avatarId: string;
};

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hubKey(profileId: string): string {
  return `${HUB_PREFIX}${profileId}`;
}

function makeHubState(totalPlays: number, totalCompletions: number, avatarId = "rocket"): HubState {
  return {
    day: localDateKey(),
    baselinePlays: totalPlays,
    baselineCompletions: totalCompletions,
    claimedMissions: [],
    unlockedAvatars: Array.from(new Set(["rocket", avatarId])),
    avatarId,
  };
}

function normalizeHubState(
  value: unknown,
  totalPlays: number,
  totalCompletions: number,
  defaultAvatarId: string
): HubState {
  if (!value || typeof value !== "object") {
    return makeHubState(totalPlays, totalCompletions, defaultAvatarId);
  }
  const raw = value as Partial<HubState>;
  const unlocked = Array.isArray(raw.unlockedAvatars)
    ? raw.unlockedAvatars.filter((item): item is string => typeof item === "string")
    : ["rocket", defaultAvatarId];
  const unlockedAvatars = Array.from(new Set(["rocket", defaultAvatarId, ...unlocked]));
  const avatarId =
    typeof raw.avatarId === "string" && unlockedAvatars.includes(raw.avatarId)
      ? raw.avatarId
      : defaultAvatarId;
  return {
    day: typeof raw.day === "string" ? raw.day : localDateKey(),
    baselinePlays:
      typeof raw.baselinePlays === "number" ? raw.baselinePlays : totalPlays,
    baselineCompletions:
      typeof raw.baselineCompletions === "number"
        ? raw.baselineCompletions
        : totalCompletions,
    claimedMissions: Array.isArray(raw.claimedMissions)
      ? raw.claimedMissions.filter((item): item is string => typeof item === "string")
      : [],
    unlockedAvatars,
    avatarId,
  };
}

function avatarIdFromEmoji(emoji: string): string {
  return SHOP_ITEMS.find((item) => item.emoji === emoji)?.id ?? "rocket";
}

function readHubState(
  profileId: string,
  totalPlays: number,
  totalCompletions: number,
  defaultAvatarId: string
): HubState {
  try {
    const key = hubKey(profileId);
    if (profileId === "adrian" && !window.localStorage.getItem(key)) {
      const legacy = window.localStorage.getItem(LEGACY_HUB_KEY);
      if (legacy) window.localStorage.setItem(key, legacy);
    }
    const raw = window.localStorage.getItem(key);
    const parsed = raw
      ? normalizeHubState(JSON.parse(raw), totalPlays, totalCompletions, defaultAvatarId)
      : makeHubState(totalPlays, totalCompletions, defaultAvatarId);
    if (parsed.day !== localDateKey()) {
      return {
        ...parsed,
        day: localDateKey(),
        baselinePlays: totalPlays,
        baselineCompletions: totalCompletions,
        claimedMissions: [],
      };
    }
    return parsed;
  } catch {
    return makeHubState(totalPlays, totalCompletions, defaultAvatarId);
  }
}

function lastSevenDays(): { key: string; label: string }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: localDateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
    };
  });
}

function titleForLevel(level: number): string {
  if (level >= 8) return "Superpower Architect";
  if (level >= 6) return "Brain Captain";
  if (level >= 4) return "Puzzle Pilot";
  if (level >= 2) return "Skill Builder";
  return "Curious Explorer";
}

export default function HomeHub({ games }: { games: Game[] }) {
  const {
    progress,
    hydrated,
    award,
    spendCoins,
    xpIntoLevel,
    xpPerLevel,
  } = useAdrianProgress();
  const {
    family,
    activeProfile,
    hydrated: profilesHydrated,
    switchProfile,
    updateProfile,
  } = useFamilyProfiles();
  const [hub, setHub] = useState<HubState>(() => makeHubState(0, 0));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  const gameEntries = Object.entries(progress.games);
  const totalPlays = gameEntries.reduce((sum, [, game]) => sum + game.plays, 0);
  const totalCompletions = gameEntries.reduce(
    (sum, [, game]) => sum + game.completions,
    0
  );
  const gamesPlayed = gameEntries.filter(([, game]) => game.plays > 0).length;
  const bestScore = gameEntries.reduce(
    (best, [, game]) => Math.max(best, game.bestScore),
    0
  );

  useEffect(() => {
    if (!hydrated || !profilesHydrated) return;
    const defaultAvatarId = avatarIdFromEmoji(activeProfile.emoji);
    const next = readHubState(
      activeProfile.id,
      totalPlays,
      totalCompletions,
      defaultAvatarId
    );
    window.localStorage.setItem(hubKey(activeProfile.id), JSON.stringify(next));
    setHub(next);
    setNotice("");
    setReady(true);
  }, [
    hydrated,
    profilesHydrated,
    activeProfile.id,
    activeProfile.emoji,
    totalPlays,
    totalCompletions,
  ]);

  function saveHub(next: HubState) {
    window.localStorage.setItem(hubKey(activeProfile.id), JSON.stringify(next));
    setHub(next);
  }

  const latestGame = useMemo(() => {
    return [...gameEntries]
      .filter(([, game]) => game.lastPlayed)
      .sort((a, b) =>
        String(b[1].lastPlayed).localeCompare(String(a[1].lastPlayed))
      )
      .map(([slug]) => games.find((game) => game.slug === slug))
      .find((game): game is Game => Boolean(game));
  }, [gameEntries, games]);

  const topGame = useMemo(() => {
    return [...gameEntries]
      .sort((a, b) => b[1].plays - a[1].plays)
      .map(([slug]) => games.find((game) => game.slug === slug))
      .find((game): game is Game => Boolean(game));
  }, [gameEntries, games]);

  const playDelta = Math.max(0, totalPlays - hub.baselinePlays);
  const completionDelta = Math.max(
    0,
    totalCompletions - hub.baselineCompletions
  );

  const missions = [
    {
      id: "warm-up",
      emoji: "🎮",
      title: "Warm Up",
      description: "Play one game today.",
      value: playDelta,
      goal: 1,
      xp: 20,
      coins: 8,
    },
    {
      id: "double-play",
      emoji: "⚡",
      title: "Double Play",
      description: "Play two games today.",
      value: playDelta,
      goal: 2,
      xp: 25,
      coins: 10,
    },
    {
      id: "mission-finished",
      emoji: "🏁",
      title: "Mission Finished",
      description: "Complete one game today.",
      value: completionDelta,
      goal: 1,
      xp: 30,
      coins: 12,
    },
  ];

  function claimMission(mission: (typeof missions)[number]) {
    const complete = mission.value >= mission.goal;
    if (!complete || hub.claimedMissions.includes(mission.id)) return;
    award("adrianos-hub", { xp: mission.xp, coins: mission.coins });
    saveHub({
      ...hub,
      claimedMissions: [...hub.claimedMissions, mission.id],
    });
    setNotice(`Mission claimed: +${mission.xp} XP and +${mission.coins} coins.`);
  }

  function buyOrEquip(item: (typeof SHOP_ITEMS)[number]) {
    const unlocked = hub.unlockedAvatars.includes(item.id);
    if (unlocked) {
      saveHub({ ...hub, avatarId: item.id });
      updateProfile(activeProfile.id, { emoji: item.emoji });
      setNotice(`${item.name} equipped.`);
      return;
    }
    if (!spendCoins(item.cost)) {
      setNotice("Not enough coins yet. Complete missions and games to earn more.");
      return;
    }
    saveHub({
      ...hub,
      avatarId: item.id,
      unlockedAvatars: [...hub.unlockedAvatars, item.id],
    });
    updateProfile(activeProfile.id, { emoji: item.emoji });
    setNotice(`${item.name} unlocked and equipped.`);
  }

  const avatar = SHOP_ITEMS.find((item) => item.id === hub.avatarId) ?? SHOP_ITEMS[0];
  const badges = [
    { emoji: "🚀", name: "First Launch", description: "Play your first game.", unlocked: totalPlays >= 1 },
    { emoji: "🗺️", name: "Game Explorer", description: "Try three different games.", unlocked: gamesPlayed >= 3 },
    { emoji: "🏆", name: "Mission Master", description: "Complete five games.", unlocked: totalCompletions >= 5 },
    { emoji: "💯", name: "High Scorer", description: "Score at least 100 in one game.", unlocked: bestScore >= 100 },
    { emoji: "⭐", name: "Level Three", description: "Reach AdrianOS level 3.", unlocked: progress.level >= 3 },
    { emoji: "👑", name: "Arcade Hero", description: "Complete twenty games.", unlocked: totalCompletions >= 20 },
  ];

  const weeklyValues = lastSevenDays().map((day) => {
    const activity = progress.activity.find((item) => item.date === day.key);
    return {
      ...day,
      plays: activity?.plays ?? 0,
      completions: activity?.completions ?? 0,
      xp: activity?.xp ?? 0,
    };
  });
  const maxWeekly = Math.max(
    1,
    ...weeklyValues.map((day) => day.plays + day.completions)
  );

  if (!ready) {
    return (
      <section style={{ ...panel, marginTop: 42, minHeight: 220 }}>
        <span className="eyebrow">ADRIANOS HOME HUB</span>
        <h2 style={{ margin: "10px 0 0" }}>Loading mission control…</h2>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 42 }}>
      <div style={profileSwitcher} aria-label="Choose player">
        {family.profiles.map((profile) => {
          const active = profile.id === activeProfile.id;
          return (
            <button
              key={profile.id}
              onClick={() => switchProfile(profile.id)}
              style={{ ...profileButton, ...(active ? profileButtonActive : {}) }}
            >
              <span style={{ fontSize: 24 }}>{profile.emoji}</span>
              <span>{profile.name}</span>
              <small style={{ opacity: 0.65 }}>Age {profile.age}</small>
            </button>
          );
        })}
        <Link href="/parent" style={parentButton}>Parent dashboard</Link>
      </div>

      <div style={hubHeader}>
        <div style={profileAvatar} aria-label={`${avatar.name} avatar`}>
          {avatar.emoji}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="eyebrow">ADRIANOS HOME HUB</span>
          <h2 style={profileTitle}>{activeProfile.name}</h2>
          <p style={{ margin: "5px 0 14px", color: "#aab1bf", fontWeight: 800 }}>
            Level {progress.level} · {titleForLevel(progress.level)}
          </p>
          <div style={xpTrack}>
            <div
              style={{
                ...xpFill,
                width: `${Math.min(100, (xpIntoLevel / xpPerLevel) * 100)}%`,
              }}
            />
          </div>
          <div style={xpLabels}>
            <span>{xpIntoLevel}/{xpPerLevel} XP to next level</span>
            <span>🪙 {progress.coins} coins</span>
          </div>
        </div>
        {latestGame && (
          <Link href={`/games/${latestGame.slug}`} style={continueButton}>
            <span style={{ fontSize: 28 }}>{latestGame.emoji}</span>
            <span>
              <small style={{ display: "block", opacity: 0.7 }}>CONTINUE</small>
              {latestGame.title}
            </span>
          </Link>
        )}
      </div>

      {notice && (
        <div style={noticeStyle} role="status">
          {notice}
          <button onClick={() => setNotice("")} style={noticeClose}>×</button>
        </div>
      )}

      <div style={dashboardGrid}>
        <article style={panel}>
          <span className="eyebrow">DAILY MISSIONS</span>
          <h3 style={sectionTitle}>Today’s quests</h3>
          <div style={{ display: "grid", gap: 11 }}>
            {missions.map((mission) => {
              const complete = mission.value >= mission.goal;
              const claimed = hub.claimedMissions.includes(mission.id);
              return (
                <div key={mission.id} style={missionRow}>
                  <span style={{ fontSize: 28 }}>{mission.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{mission.title}</strong>
                    <p style={smallText}>{mission.description}</p>
                    <div style={miniTrack}>
                      <div style={{ ...miniFill, width: `${Math.min(100, mission.value / mission.goal * 100)}%` }} />
                    </div>
                  </div>
                  <button
                    onClick={() => claimMission(mission)}
                    disabled={!complete || claimed}
                    style={{ ...claimButton, opacity: !complete || claimed ? 0.45 : 1 }}
                  >
                    {claimed ? "Claimed" : complete ? "Claim" : `${Math.min(mission.value, mission.goal)}/${mission.goal}`}
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article style={panel}>
          <span className="eyebrow">PLAYER SNAPSHOT</span>
          <h3 style={sectionTitle}>{activeProfile.name}’s progress</h3>
          <div style={statGrid}>
            <Stat label="Games tried" value={gamesPlayed} />
            <Stat label="Total plays" value={totalPlays} />
            <Stat label="Completed" value={totalCompletions} />
            <Stat label="Best score" value={bestScore} />
          </div>
          <p style={{ ...smallText, marginTop: 16 }}>
            Favorite game: <strong style={{ color: "#fff" }}>{topGame?.title ?? "Not discovered yet"}</strong>
          </p>
        </article>
      </div>

      <div style={dashboardGrid}>
        <article style={panel}>
          <span className="eyebrow">LAST 7 DAYS</span>
          <h3 style={sectionTitle}>Learning activity</h3>
          <div style={chart}>
            {weeklyValues.map((day) => {
              const value = day.plays + day.completions;
              return (
                <div key={day.key} style={chartColumn} title={`${day.plays} plays, ${day.completions} completions, ${day.xp} XP`}>
                  <div style={{ ...chartBar, height: `${Math.max(7, value / maxWeekly * 100)}%` }} />
                  <small>{day.label}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article style={panel}>
          <span className="eyebrow">BADGE CABINET</span>
          <h3 style={sectionTitle}>Achievements</h3>
          <div style={badgeGrid}>
            {badges.map((badge) => (
              <div key={badge.name} style={{ ...badgeCard, opacity: badge.unlocked ? 1 : 0.35 }}>
                <span style={{ fontSize: 30 }}>{badge.unlocked ? badge.emoji : "🔒"}</span>
                <strong>{badge.name}</strong>
                <small style={{ color: "#aab1bf" }}>{badge.description}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article style={{ ...panel, marginTop: 16 }}>
        <span className="eyebrow">COIN SHOP</span>
        <h3 style={sectionTitle}>Choose an avatar</h3>
        <div style={shopGrid}>
          {SHOP_ITEMS.map((item) => {
            const unlocked = hub.unlockedAvatars.includes(item.id);
            const equipped = hub.avatarId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => buyOrEquip(item)}
                style={{ ...shopCard, ...(equipped ? shopCardEquipped : {}) }}
              >
                <span style={{ fontSize: 40 }}>{item.emoji}</span>
                <strong>{item.name}</strong>
                <small>{equipped ? "Equipped" : unlocked ? "Equip" : `🪙 ${item.cost}`}</small>
              </button>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <span style={{ color: "#aab1bf", fontSize: 12, fontWeight: 800 }}>{label}</span>
      <strong style={{ display: "block", fontSize: 30, marginTop: 6 }}>{value}</strong>
    </div>
  );
}

const panel: React.CSSProperties = { padding: "clamp(20px,4vw,30px)", border: "1px solid rgba(255,255,255,.11)", borderRadius: 26, background: "#181d28", boxShadow: "0 24px 55px rgba(0,0,0,.22)" };
const profileSwitcher: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 };
const profileButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", fontWeight: 900, cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { background: "#d9ff5b", color: "#10131b", borderColor: "#d9ff5b" };
const parentButton: React.CSSProperties = { marginLeft: "auto", padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", fontWeight: 900 };
const hubHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "clamp(22px,5vw,38px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.11)", background: "linear-gradient(135deg,#202735,#151a24)", boxShadow: "0 28px 65px rgba(0,0,0,.28)" };
const profileAvatar: React.CSSProperties = { width: 100, height: 100, display: "grid", placeItems: "center", borderRadius: 28, background: "#d9ff5b", fontSize: 54 };
const profileTitle: React.CSSProperties = { margin: "7px 0 0", fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .9, letterSpacing: "-.065em" };
const xpTrack: React.CSSProperties = { height: 10, maxWidth: 520, borderRadius: 999, background: "rgba(255,255,255,.09)", overflow: "hidden" };
const xpFill: React.CSSProperties = { height: "100%", background: "#d9ff5b", borderRadius: 999 };
const xpLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", maxWidth: 520, marginTop: 8, color: "#aab1bf", fontSize: 12, fontWeight: 800 };
const continueButton: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 18, background: "#d9ff5b", color: "#10131b", fontWeight: 950 };
const noticeStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, padding: "12px 16px", borderRadius: 16, background: "rgba(198,184,255,.14)", border: "1px solid rgba(198,184,255,.3)", fontWeight: 850 };
const noticeClose: React.CSSProperties = { border: 0, background: "transparent", color: "#fff", fontSize: 22, cursor: "pointer" };
const dashboardGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginTop: 16 };
const sectionTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(1.5rem,4vw,2.4rem)", letterSpacing: "-.04em" };
const missionRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const smallText: React.CSSProperties = { margin: "4px 0 8px", color: "#aab1bf", lineHeight: 1.4, fontSize: 13 };
const miniTrack: React.CSSProperties = { height: 5, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" };
const miniFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "#d9ff5b" };
const claimButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: "9px 12px", background: "#d9ff5b", color: "#10131b", fontWeight: 900, cursor: "pointer" };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 };
const statCard: React.CSSProperties = { padding: 15, borderRadius: 18, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const chart: React.CSSProperties = { height: 170, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, alignItems: "end" };
const chartColumn: React.CSSProperties = { height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 7, color: "#aab1bf" };
const chartBar: React.CSSProperties = { width: "100%", maxWidth: 34, minHeight: 7, borderRadius: "9px 9px 3px 3px", background: "linear-gradient(#d9ff5b,#9dbb31)" };
const badgeGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 };
const badgeCard: React.CSSProperties = { display: "grid", gap: 5, padding: 13, borderRadius: 18, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const shopGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 };
const shopCard: React.CSSProperties = { display: "grid", gap: 8, placeItems: "center", padding: 16, borderRadius: 20, border: "1px solid rgba(255,255,255,.1)", background: "#222936", color: "#fff", cursor: "pointer" };
const shopCardEquipped: React.CSSProperties = { borderColor: "#d9ff5b", boxShadow: "0 0 0 2px rgba(217,255,91,.16)" };
