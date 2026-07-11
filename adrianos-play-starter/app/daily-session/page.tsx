"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  claimDailySessionReward,
  DAILY_SESSION_EVENT,
  dailySessionStreak,
  ensureDailySession,
  guidedMissionHref,
  readDailySession,
  startDailySessionMission,
  type DailySession,
  type DailySessionMission,
} from "@/lib/adrian-daily-session";
import { games } from "@/lib/generated-games";

function kindLabel(kind: DailySessionMission["kind"]): string {
  if (kind === "review") return "REVIEW";
  if (kind === "explore") return "FUN FINISH";
  return "NEXT SKILL";
}

function missionEmoji(slug: string): string {
  return games.find((game) => game.slug === slug)?.emoji ?? "🎯";
}

export default function DailySessionPage() {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady, award } = useAdrianProgress();
  const [session, setSession] = useState<DailySession | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profilesReady || !progressReady) return;
    const refresh = () => {
      setSession(ensureDailySession(activeProfile, games, progress));
    };
    refresh();
    const events = [
      DAILY_SESSION_EVENT,
      "adrianos-learning-updated",
      "adrianos-progress-updated",
      "adrianos-family-updated",
    ];
    for (const eventName of events) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, refresh);
    };
  }, [activeProfile.id, activeProfile.age, profilesReady, progressReady, progress]);

  const completedCount = session?.missions.filter((mission) => mission.status === "complete").length ?? 0;
  const allComplete = Boolean(session && completedCount === session.missions.length);
  const streak = useMemo(
    () => profilesReady ? dailySessionStreak(activeProfile.id) : 0,
    [activeProfile.id, profilesReady, session?.completedAt]
  );

  function launchMission(index: number) {
    if (!session) return;
    const mission = session.missions[index];
    if (!mission || mission.status === "complete") return;
    const updated = startDailySessionMission(activeProfile.id, index);
    if (!updated) return;
    const href = guidedMissionHref(updated.missions[index], activeProfile.id, index, updated.missions.length);
    window.location.href = href;
  }

  function claimReward() {
    if (!session || !allComplete || session.rewardClaimed) return;
    const updated = claimDailySessionReward(activeProfile.id);
    if (!updated?.rewardClaimed) return;
    award("daily-session", { xp: 30, coins: 10, score: 3, completed: true });
    setSession(updated);
    setMessage("Daily session complete. +30 XP and +10 coins!");
  }

  if (!profilesReady || !progressReady || !session) {
    return (
      <main style={page}>
        <section style={heroCard}>
          <span style={eyebrow}>GUIDED DAILY SESSION</span>
          <h1 style={heroTitle}>Building today’s route…</h1>
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      <header style={topbar}>
        <Link href="/" style={homeLink}>← Home</Link>
        <strong>AdrianOS School</strong>
        <span>{activeProfile.emoji} {activeProfile.name}</span>
      </header>

      <section style={heroCard}>
        <div style={heroGrid}>
          <div>
            <span style={eyebrow}>TODAY’S GUIDED SESSION</span>
            <h1 style={heroTitle}>Three missions.<br />Then you’re done.</h1>
            <p style={muted}>
              AdrianOS arranged a review, the next useful skill, and a fun finish. Work through them in order and collect the daily reward.
            </p>
          </div>
          <div style={timeOrb}>
            <strong>{session.recommendedMinutes}</strong>
            <span>MINUTES</span>
          </div>
        </div>

        <div style={sessionStats}>
          <div><small>PROGRESS</small><strong>{completedCount}/{session.missions.length} missions</strong></div>
          <div><small>SESSION STREAK</small><strong>{streak} day{streak === 1 ? "" : "s"}</strong></div>
          <div><small>REWARD</small><strong>30 XP · 10 coins</strong></div>
        </div>
      </section>

      <section style={routeCard}>
        <div style={routeLine} aria-hidden="true" />
        {session.missions.map((mission, index) => {
          const complete = mission.status === "complete";
          const active = !allComplete && index === session.currentIndex;
          const locked = !complete && !active;
          return (
            <article
              key={mission.id}
              style={{
                ...missionCard,
                opacity: locked ? 0.52 : 1,
                borderColor: complete ? "rgba(217,255,91,.5)" : active ? "rgba(127,220,255,.55)" : "rgba(255,255,255,.1)",
              }}
            >
              <div style={stepMarker}>{complete ? "✓" : index + 1}</div>
              <div style={missionBody}>
                <div style={missionHeading}>
                  <span style={kindPill}>{kindLabel(mission.kind)}</span>
                  <span style={difficultyPill}>{mission.difficulty}</span>
                </div>
                <div style={{ fontSize: 48 }}>{missionEmoji(mission.gameSlug)}</div>
                <h2 style={missionTitle}>{mission.title}</h2>
                <p style={{ ...muted, margin: 0 }}>{mission.reason}</p>
                <div style={missionActionRow}>
                  {complete ? (
                    <strong style={{ color: "#d9ff5b" }}>MISSION COMPLETE</strong>
                  ) : active ? (
                    <button onClick={() => launchMission(index)} style={primaryButton} type="button">
                      {mission.status === "active" ? "Resume mission →" : "Start mission →"}
                    </button>
                  ) : (
                    <span style={{ color: "#7f8898", fontWeight: 850 }}>Finish mission {session.currentIndex + 1} first</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {allComplete && (
        <section style={finishCard}>
          <div style={{ fontSize: 72 }}>{session.rewardClaimed ? "🏆" : "🎁"}</div>
          <span style={eyebrow}>SESSION COMPLETE</span>
          <h2 style={finishTitle}>{activeProfile.name} cleared today’s route.</h2>
          <p style={muted}>
            {session.rewardClaimed
              ? "The reward is collected and today’s learning evidence is safely saved."
              : "Collect the daily reward and enjoy the rest of the day."}
          </p>
          {!session.rewardClaimed && (
            <button onClick={claimReward} style={rewardButton} type="button">Collect 30 XP + 10 coins</button>
          )}
          {message && <p style={notice}>{message}</p>}
          <Link href="/" style={secondaryLink}>Return home</Link>
        </section>
      )}

      {!allComplete && (
        <div style={pauseRow}>
          <Link href="/" style={secondaryLink}>Pause for now</Link>
          <span style={muted}>Your place is saved automatically.</span>
        </div>
      )}
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "0 18px 70px", background: "#10131b", color: "#fff" };
const topbar: React.CSSProperties = { minHeight: 72, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, maxWidth: 1080, margin: "0 auto", color: "#aab1bf", fontWeight: 850 };
const homeLink: React.CSSProperties = { color: "#fff", textDecoration: "none", padding: "9px 13px", borderRadius: 999, background: "#222936" };
const heroCard: React.CSSProperties = { maxWidth: 1080, margin: "12px auto 18px", padding: "clamp(25px,5vw,52px)", borderRadius: 32, border: "1px solid rgba(217,255,91,.25)", background: "linear-gradient(145deg,rgba(217,255,91,.11),rgba(127,220,255,.08) 50%,#181d28)", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 28, alignItems: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".17em" };
const heroTitle: React.CSSProperties = { margin: "12px 0 15px", fontSize: "clamp(3rem,8vw,6.5rem)", lineHeight: .9, letterSpacing: "-.075em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const timeOrb: React.CSSProperties = { width: 132, height: 132, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b", boxShadow: "0 18px 50px rgba(217,255,91,.2)" };
const sessionStats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 26 };
const routeCard: React.CSSProperties = { position: "relative", maxWidth: 900, margin: "0 auto", display: "grid", gap: 14 };
const routeLine: React.CSSProperties = { position: "absolute", left: 28, top: 50, bottom: 50, width: 3, borderRadius: 999, background: "linear-gradient(#7fdcff,#c6b8ff,#d9ff5b)", opacity: .55 };
const missionCard: React.CSSProperties = { position: "relative", display: "grid", gridTemplateColumns: "58px 1fr", gap: 16, padding: 20, borderRadius: 26, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", transition: "opacity .2s ease,border-color .2s ease" };
const stepMarker: React.CSSProperties = { position: "relative", zIndex: 2, width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", background: "#d9ff5b", color: "#10131b", fontSize: 20, fontWeight: 950 };
const missionBody: React.CSSProperties = { minWidth: 0, display: "grid", gap: 11 };
const missionHeading: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 9, flexWrap: "wrap" };
const kindPill: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "rgba(127,220,255,.12)", color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".12em" };
const difficultyPill: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 11, fontWeight: 900 };
const missionTitle: React.CSSProperties = { margin: 0, fontSize: "clamp(1.8rem,5vw,3rem)", letterSpacing: "-.045em" };
const missionActionRow: React.CSSProperties = { minHeight: 46, display: "flex", alignItems: "center", marginTop: 3 };
const primaryButton: React.CSSProperties = { padding: "12px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const finishCard: React.CSSProperties = { maxWidth: 800, margin: "22px auto 0", padding: "clamp(28px,6vw,60px)", borderRadius: 32, border: "1px solid rgba(217,255,91,.38)", background: "rgba(217,255,91,.08)", textAlign: "center" };
const finishTitle: React.CSSProperties = { margin: "12px 0", fontSize: "clamp(2.6rem,7vw,5rem)", lineHeight: .94, letterSpacing: "-.065em" };
const rewardButton: React.CSSProperties = { margin: "14px 0", padding: "14px 22px", borderRadius: 999, border: "2px solid #d9ff5b", background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryLink: React.CSSProperties = { display: "inline-block", padding: "11px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", textDecoration: "none", fontWeight: 900 };
const notice: React.CSSProperties = { color: "#d9ff5b", fontWeight: 900 };
const pauseRow: React.CSSProperties = { maxWidth: 900, margin: "20px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
