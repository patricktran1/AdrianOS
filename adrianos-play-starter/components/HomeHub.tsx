"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import { useAdrianProgress } from "@/lib/adrian-progress";

const HUB_KEY = "adrianos-home-hub-v1";

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

function makeHubState(totalPlays: number, totalCompletions: number): HubState {
  return {
    day: localDateKey(),
    baselinePlays: totalPlays,
    baselineCompletions: totalCompletions,
    claimedMissions: [],
    unlockedAvatars: ["rocket"],
    avatarId: "rocket",
  };
}

function normalizeHubState(
  value: unknown,
  totalPlays: number,
  totalCompletions: number
): HubState {
  if (!value || typeof value !== "object") {
    return makeHubState(totalPlays, totalCompletions);
  }

  const raw = value as Partial<HubState>;
  const unlocked = Array.isArray(raw.unlockedAvatars)
    ? raw.unlockedAvatars.filter((item): item is string => typeof item === "string")
    : ["rocket"];
  const unlockedAvatars = Array.from(new Set(["rocket", ...unlocked]));
  const avatarId =
    typeof raw.avatarId === "string" && unlockedAvatars.includes(raw.avatarId)
      ? raw.avatarId
      : "rocket";

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

function readHubState(totalPlays: number, totalCompletions: number): HubState {
  try {
    const raw = window.localStorage.getItem(HUB_KEY);
    const parsed = raw ? normalizeHubState(JSON.parse(raw), totalPlays, totalCompletions) : makeHubState(totalPlays, totalCompletions);

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
    return makeHubState(totalPlays, totalCompletions);
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
    if (!hydrated) return;
    const next = readHubState(totalPlays, totalCompletions);
    window.localStorage.setItem(HUB_KEY, JSON.stringify(next));
    setHub(next);
    setReady(true);
  }, [hydrated, totalPlays, totalCompletions]);

  function saveHub(next: HubState) {
    window.localStorage.setItem(HUB_KEY, JSON.stringify(next));
    setHub(next);
  }

  const latestGame = useMemo(() => {
    return gameEntries
      .filter(([, game]) => game.lastPlayed)
      .sort((a, b) =>
        String(b[1].lastPlayed).localeCompare(String(a[1].lastPlayed))
      )
      .map(([slug]) => games.find((game) => game.slug === slug))
      .find((game): game is Game => Boolean(game));
  }, [gameEntries, games]);

  const topGame = useMemo(() => {
    return gameEntries
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

    award("adrianos-hub", {
      xp: mission.xp,
      coins: mission.coins,
    });
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
    setNotice(`${item.name} unlocked and equipped.`);
  }

  const avatar =
    SHOP_ITEMS.find((item) => item.id === hub.avatarId) ?? SHOP_ITEMS[0];

  const badges = [
    {
      emoji: "🚀",
      name: "First Launch",
      description: "Play your first game.",
      unlocked: totalPlays >= 1,
    },
    {
      emoji: "🗺️",
      name: "Game Explorer",
      description: "Try three different games.",
      unlocked: gamesPlayed >= 3,
    },
    {
      emoji: "🏆",
      name: "Mission Master",
      description: "Complete five games.",
      unlocked: totalCompletions >= 5,
    },
    {
      emoji: "💯",
      name: "High Scorer",
      description: "Score at least 100 in one game.",
      unlocked: bestScore >= 100,
    },
    {
      emoji: "⭐",
      name: "Level Three",
      description: "Reach AdrianOS level 3.",
      unlocked: progress.level >= 3,
    },
    {
      emoji: "👑",
      name: "Arcade Hero",
      description: "Complete twenty games.",
      unlocked: totalCompletions >= 20,
    },
  ];

  const week = lastSevenDays();
  const weeklyValues = week.map((day) => {
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
      <section style={{ ...panel, marginTop: 42, minHeight: 260 }}>
        <span className="eyebrow">ADRIANOS HOME HUB</span>
        <h2 style={{ margin: "10px 0 0" }}>Loading mission control…</h2>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 42 }}>
      <div style={hubHeader}>
        <div style={profileAvatar} aria-label={`${avatar.name} avatar`}>
          {avatar.emoji}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="eyebrow">ADRIANOS HOME HUB</span>
          <h2 style={profileTitle}>Adrian</h2>
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
          <button onClick={() => setNotice("")} style={noticeClose}>
            ×
          </button>
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{mission.title}</strong>
                    <div style={{ color: "#aab1bf", fontSize: 13, marginTop: 3 }}>
                      {mission.description}
                    </div>
                    <div style={miniTrack}>
                      <div
                        style={{
                          ...miniFill,
                          width: `${Math.min(100, (mission.value / mission.goal) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => claimMission(mission)}
                    disabled={!complete || claimed}
                    style={{
                      ...missionButton,
                      opacity: !complete || claimed ? 0.55 : 1,
                    }}
                  >
                    {claimed ? "Claimed" : complete ? "Claim" : `${Math.min(mission.value, mission.goal)}/${mission.goal}`}
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article style={panel}>
          <span className="eyebrow">WEEKLY PROGRESS</span>
          <h3 style={sectionTitle}>Seven-day pulse</h3>
          <div style={weekChart}>
            {weeklyValues.map((day) => {
              const value = day.plays + day.completions;
              return (
                <div key={day.key} style={weekColumn} title={`${day.plays} plays, ${day.completions} completions, ${day.xp} XP`}>
                  <div style={barWell}>
                    <div
                      style={{
                        ...weekBar,
                        height: `${Math.max(8, (value / maxWeekly) * 100)}%`,
                        opacity: value === 0 ? 0.2 : 1,
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: 12 }}>{day.label}</strong>
                  <span style={{ color: "#aab1bf", fontSize: 11 }}>{value}</span>
                </div>
              );
            })}
          </div>
          <div style={statGrid}>
            <div style={statBox}><span>Plays</span><strong>{totalPlays}</strong></div>
            <div style={statBox}><span>Wins</span><strong>{totalCompletions}</strong></div>
            <div style={statBox}><span>Games tried</span><strong>{gamesPlayed}</strong></div>
            <div style={statBox}><span>Top game</span><strong style={{ fontSize: 16 }}>{topGame?.title ?? "None yet"}</strong></div>
          </div>
        </article>
      </div>

      <div style={dashboardGrid}>
        <article style={panel}>
          <span className="eyebrow">BADGE CABINET</span>
          <h3 style={sectionTitle}>Achievements</h3>
          <div style={badgeGrid}>
            {badges.map((badge) => (
              <div
                key={badge.name}
                style={{
                  ...badgeCard,
                  opacity: badge.unlocked ? 1 : 0.38,
                  borderColor: badge.unlocked
                    ? "rgba(217,255,91,.38)"
                    : "rgba(255,255,255,.1)",
                }}
                title={badge.description}
              >
                <span style={{ fontSize: 31 }}>{badge.unlocked ? badge.emoji : "🔒"}</span>
                <strong style={{ fontSize: 13 }}>{badge.name}</strong>
              </div>
            ))}
          </div>
        </article>

        <article style={panel}>
          <span className="eyebrow">COIN SHOP</span>
          <h3 style={sectionTitle}>Choose your avatar</h3>
          <div style={shopGrid}>
            {SHOP_ITEMS.map((item) => {
              const unlocked = hub.unlockedAvatars.includes(item.id);
              const equipped = hub.avatarId === item.id;
              const canBuy = progress.coins >= item.cost;
              return (
                <button
                  key={item.id}
                  onClick={() => buyOrEquip(item)}
                  style={{
                    ...shopCard,
                    borderColor: equipped
                      ? "#d9ff5b"
                      : "rgba(255,255,255,.11)",
                    opacity: unlocked || canBuy ? 1 : 0.55,
                  }}
                >
                  <span style={{ fontSize: 36 }}>{item.emoji}</span>
                  <strong>{item.name}</strong>
                  <small style={{ color: equipped ? "#d9ff5b" : "#aab1bf" }}>
                    {equipped
                      ? "EQUIPPED"
                      : unlocked
                        ? "EQUIP"
                        : item.cost === 0
                          ? "FREE"
                          : `🪙 ${item.cost}`}
                  </small>
                </button>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

const hubHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 22,
  padding: "clamp(22px,4vw,36px)",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,.11)",
  background: "linear-gradient(135deg, rgba(198,184,255,.13), rgba(217,255,91,.055))",
  boxShadow: "0 24px 60px rgba(0,0,0,.24)",
};

const profileAvatar: React.CSSProperties = {
  width: 106,
  height: 106,
  flex: "0 0 auto",
  display: "grid",
  placeItems: "center",
  borderRadius: 30,
  background: "#222936",
  border: "2px solid rgba(217,255,91,.45)",
  fontSize: 58,
  boxShadow: "0 15px 35px rgba(0,0,0,.22)",
};

const profileTitle: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: "clamp(2.2rem,5vw,4.2rem)",
  lineHeight: 0.95,
  letterSpacing: "-.055em",
};

const xpTrack: React.CSSProperties = {
  width: "min(470px,100%)",
  height: 10,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(255,255,255,.09)",
};

const xpFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#d9ff5b",
  transition: "width .25s ease",
};

const xpLabels: React.CSSProperties = {
  width: "min(470px,100%)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 8,
  color: "#aab1bf",
  fontSize: 12,
  fontWeight: 850,
};

const continueButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  marginLeft: "auto",
  padding: "14px 17px",
  borderRadius: 20,
  background: "#d9ff5b",
  color: "#10131b",
  fontWeight: 950,
  boxShadow: "0 12px 28px rgba(0,0,0,.2)",
};

const dashboardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 18,
  marginTop: 18,
};

const panel: React.CSSProperties = {
  padding: "clamp(20px,3vw,28px)",
  borderRadius: 26,
  border: "1px solid rgba(255,255,255,.11)",
  background: "#181d28",
  boxShadow: "0 18px 45px rgba(0,0,0,.2)",
};

const sectionTitle: React.CSSProperties = {
  margin: "8px 0 20px",
  fontSize: "clamp(1.5rem,3vw,2.2rem)",
  letterSpacing: "-.04em",
};

const missionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 13,
  borderRadius: 18,
  background: "#222936",
  border: "1px solid rgba(255,255,255,.08)",
};

const miniTrack: React.CSSProperties = {
  height: 5,
  marginTop: 8,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(255,255,255,.08)",
};

const miniFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#c6b8ff",
};

const missionButton: React.CSSProperties = {
  minWidth: 70,
  padding: "9px 11px",
  border: 0,
  borderRadius: 999,
  background: "#d9ff5b",
  color: "#10131b",
  fontWeight: 950,
  cursor: "pointer",
};

const weekChart: React.CSSProperties = {
  height: 190,
  display: "grid",
  gridTemplateColumns: "repeat(7,1fr)",
  alignItems: "end",
  gap: 8,
  padding: "16px 8px 4px",
  borderRadius: 20,
  background: "#11161f",
};

const weekColumn: React.CSSProperties = {
  height: "100%",
  display: "grid",
  gridTemplateRows: "1fr auto auto",
  alignItems: "end",
  justifyItems: "center",
  gap: 5,
};

const barWell: React.CSSProperties = {
  width: "min(34px,100%)",
  height: "100%",
  display: "flex",
  alignItems: "end",
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,.045)",
};

const weekBar: React.CSSProperties = {
  width: "100%",
  minHeight: 8,
  borderRadius: 999,
  background: "linear-gradient(#d9ff5b,#c6b8ff)",
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,1fr)",
  gap: 9,
  marginTop: 14,
};

const statBox: React.CSSProperties = {
  minHeight: 72,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  borderRadius: 16,
  background: "#222936",
};

const badgeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 10,
};

const badgeCard: React.CSSProperties = {
  minHeight: 105,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textAlign: "center",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.1)",
  background: "#222936",
};

const shopGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 10,
};

const shopCard: React.CSSProperties = {
  minHeight: 132,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 18,
  border: "2px solid rgba(255,255,255,.11)",
  background: "#222936",
  color: "#f6f5f2",
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginTop: 14,
  padding: "12px 15px",
  borderRadius: 16,
  background: "rgba(217,255,91,.12)",
  border: "1px solid rgba(217,255,91,.3)",
  fontWeight: 850,
};

const noticeClose: React.CSSProperties = {
  border: 0,
  background: "transparent",
  fontSize: 22,
  cursor: "pointer",
};
