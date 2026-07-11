"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  DAILY_SESSION_EVENT,
  dailySessionStreak,
  ensureDailySession,
  type DailySession,
} from "@/lib/adrian-daily-session";
import {
  dayLabel,
  learningPlanForDate,
  readLearningSchedule,
  type LearningDayMode,
} from "@/lib/adrian-learning-schedule";
import { games } from "@/lib/generated-games";

function modeLabel(mode: LearningDayMode): string {
  if (mode === "light") return "Light review";
  if (mode === "free") return "Free explore";
  return "Full session";
}

export default function SchoolPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const [session, setSession] = useState<DailySession | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!profilesReady || !progressReady) return;
    const refresh = () => {
      setSession(ensureDailySession(activeProfile, games, progress));
      setRevision((value) => value + 1);
    };
    refresh();
    const events = [
      DAILY_SESSION_EVENT,
      "adrianos-progress-updated",
      "adrianos-learning-updated",
      "adrianos-learning-schedule-updated",
      "adrianos-family-updated",
      "adrianos-portfolio-updated",
    ];
    for (const eventName of events) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, refresh);
    };
  }, [activeProfile.id, activeProfile.age, profilesReady, progressReady, progress]);

  const streak = useMemo(
    () => profilesReady ? dailySessionStreak(activeProfile.id) : 0,
    [activeProfile.id, profilesReady, session?.completedAt]
  );

  if (!profilesReady || !progressReady || !session) {
    return (
      <main style={page}>
        <section style={heroCard}>
          <span style={eyebrow}>ADRIANOS SCHOOL MODE</span>
          <h1 style={heroTitle}>Getting today ready…</h1>
        </section>
      </main>
    );
  }

  const schedule = readLearningSchedule(activeProfile.id);
  const plan = learningPlanForDate(activeProfile.id);
  const completed = session.missions.filter((mission) => mission.status === "complete").length;
  const allComplete = completed === session.missions.length;
  const currentMission = session.missions[Math.min(session.currentIndex, session.missions.length - 1)];
  void revision;

  return (
    <main style={page}>
      <header style={topbar}>
        <div>
          <span style={brand}>ADRIANOS SCHOOL</span>
          <small style={subbrand}>Private learning mode</small>
        </div>
        <div style={topActions}>
          <Link href="/portfolio" style={portfolioLink}>📚 My portfolio</Link>
          <Link href="/parent" style={parentLink}>Parent access 🔒</Link>
        </div>
      </header>

      <div style={profileRow} aria-label="Choose student">
        {family.profiles.map((profile) => {
          const selected = profile.id === activeProfile.id;
          return (
            <button
              key={profile.id}
              onClick={() => switchProfile(profile.id)}
              style={{ ...profileButton, ...(selected ? profileButtonActive : {}) }}
              type="button"
            >
              <span style={{ fontSize: 36 }}>{profile.emoji}</span>
              <span>
                <strong style={{ display: "block", fontSize: 18 }}>{profile.name}</strong>
                <small style={{ opacity: .68 }}>Age {profile.age}</small>
              </span>
            </button>
          );
        })}
      </div>

      <section style={heroCard}>
        <div style={heroGrid}>
          <div>
            <span style={eyebrow}>{dayLabel(plan.day).toUpperCase()} · {modeLabel(plan.mode).toUpperCase()}</span>
            <h1 style={heroTitle}>
              {allComplete ? `${activeProfile.name} is done for today.` : `Ready, ${activeProfile.name}?`}
            </h1>
            <p style={muted}>
              {allComplete
                ? "Today’s learning is saved. The next route will be built automatically."
                : `${session.missions.length} mission${session.missions.length === 1 ? "" : "s"}, about ${session.recommendedMinutes} minutes, then the school day is complete.`}
            </p>
          </div>
          <div style={progressOrb}>
            <strong>{completed}/{session.missions.length}</strong>
            <span>DONE</span>
          </div>
        </div>

        <div style={statusGrid}>
          <div style={statusCard}><small>TODAY</small><strong>{modeLabel(session.scheduleMode)}</strong></div>
          <div style={statusCard}><small>STREAK</small><strong>{streak} day{streak === 1 ? "" : "s"}</strong></div>
          <div style={statusCard}><small>REWARD</small><strong>{session.scheduleMode === "full" ? "30 XP" : session.scheduleMode === "light" ? "15 XP" : "10 XP"}</strong></div>
        </div>
      </section>

      {!allComplete && currentMission && (
        <section style={missionCard}>
          <div style={missionNumber}>{session.currentIndex + 1}</div>
          <div style={{ minWidth: 0 }}>
            <span style={missionKind}>{currentMission.kind === "review" ? "REVIEW" : currentMission.kind === "explore" ? "EXPLORE" : "NEXT SKILL"}</span>
            <h2 style={missionTitle}>{currentMission.title}</h2>
            <p style={{ ...muted, margin: 0 }}>{currentMission.reason}</p>
          </div>
          <Link href="/daily-session?school=1" style={startButton}>
            {currentMission.status === "active" ? "Resume today →" : "Start today →"}
          </Link>
        </section>
      )}

      {allComplete && (
        <section style={doneCard}>
          <div style={{ fontSize: 78 }}>{session.rewardClaimed ? "🏆" : "🎁"}</div>
          <h2 style={doneTitle}>{session.rewardClaimed ? "School is finished." : "One reward is waiting."}</h2>
          <div style={doneActions}>
            {!session.rewardClaimed ? (
              <Link href="/daily-session?school=1" style={rewardButton}>Collect today’s reward →</Link>
            ) : schedule.libraryAfterSession ? (
              <Link href="/" style={freePlayButton}>Open free play</Link>
            ) : (
              <p style={lockedMessage}>Free play is closed after school today. Great work. Come back tomorrow.</p>
            )}
            <Link href="/portfolio" style={portfolioDoneButton}>See my learning portfolio →</Link>
          </div>
        </section>
      )}

      {!schedule.schoolMode && (
        <div style={notice}>
          School Mode is currently off for {activeProfile.name}. A parent can turn it back on from the Learning schedule tool.
        </div>
      )}
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "0 18px 70px", background: "#10131b", color: "#fff" };
const topbar: React.CSSProperties = { maxWidth: 1040, minHeight: 78, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" };
const topActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" };
const brand: React.CSSProperties = { display: "block", color: "#d9ff5b", fontWeight: 950, letterSpacing: ".14em" };
const subbrand: React.CSSProperties = { display: "block", marginTop: 3, color: "#7f8898" };
const parentLink: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", textDecoration: "none", fontWeight: 900 };
const portfolioLink: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(198,184,255,.3)", background: "rgba(198,184,255,.1)", color: "#c6b8ff", textDecoration: "none", fontWeight: 900 };
const profileRow: React.CSSProperties = { maxWidth: 1040, margin: "4px auto 16px", display: "flex", gap: 11, flexWrap: "wrap" };
const profileButton: React.CSSProperties = { minWidth: 180, display: "flex", alignItems: "center", gap: 12, padding: "13px 17px", borderRadius: 22, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const heroCard: React.CSSProperties = { maxWidth: 1040, margin: "0 auto 16px", padding: "clamp(26px,6vw,60px)", borderRadius: 34, border: "1px solid rgba(127,220,255,.3)", background: "linear-gradient(145deg,rgba(127,220,255,.11),rgba(198,184,255,.08) 50%,#181d28)", boxShadow: "0 30px 75px rgba(0,0,0,.27)" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 28, alignItems: "center" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 12, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "12px 0 15px", fontSize: "clamp(3.3rem,9vw,7rem)", lineHeight: .88, letterSpacing: "-.078em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55, fontWeight: 700 };
const progressOrb: React.CSSProperties = { width: 142, height: 142, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b", boxShadow: "0 20px 55px rgba(217,255,91,.19)" };
const statusGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 26 };
const statusCard: React.CSSProperties = { display: "grid", gap: 5, padding: 14, borderRadius: 18, background: "rgba(16,19,27,.68)", border: "1px solid rgba(255,255,255,.08)" };
const missionCard: React.CSSProperties = { maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "64px minmax(0,1fr) auto", gap: 18, alignItems: "center", padding: "clamp(20px,4vw,30px)", borderRadius: 30, border: "1px solid rgba(217,255,91,.28)", background: "#181d28", boxShadow: "0 24px 60px rgba(0,0,0,.24)" };
const missionNumber: React.CSSProperties = { width: 60, height: 60, borderRadius: 999, display: "grid", placeItems: "center", background: "#7fdcff", color: "#10131b", fontSize: 23, fontWeight: 950 };
const missionKind: React.CSSProperties = { color: "#7fdcff", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const missionTitle: React.CSSProperties = { margin: "6px 0", fontSize: "clamp(2rem,5vw,3.4rem)", letterSpacing: "-.05em" };
const startButton: React.CSSProperties = { padding: "16px 21px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontSize: 17, fontWeight: 950, whiteSpace: "nowrap" };
const doneCard: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "clamp(30px,6vw,64px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.32)", background: "rgba(217,255,91,.07)", textAlign: "center" };
const doneTitle: React.CSSProperties = { margin: "12px 0 20px", fontSize: "clamp(2.8rem,7vw,5.2rem)", lineHeight: .92, letterSpacing: "-.065em" };
const doneActions: React.CSSProperties = { display: "grid", justifyItems: "center", gap: 10 };
const rewardButton: React.CSSProperties = { display: "inline-block", padding: "15px 22px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const freePlayButton: React.CSSProperties = { display: "inline-block", padding: "14px 21px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", textDecoration: "none", fontWeight: 950 };
const portfolioDoneButton: React.CSSProperties = { display: "inline-block", padding: "13px 20px", borderRadius: 999, border: "1px solid rgba(198,184,255,.3)", background: "rgba(198,184,255,.1)", color: "#c6b8ff", textDecoration: "none", fontWeight: 950 };
const lockedMessage: React.CSSProperties = { maxWidth: 520, margin: "0 auto", color: "#aab1bf", lineHeight: 1.55, fontWeight: 800 };
const notice: React.CSSProperties = { maxWidth: 900, margin: "18px auto 0", padding: 14, borderRadius: 17, background: "rgba(255,181,191,.1)", border: "1px solid rgba(255,181,191,.25)", color: "#ffb5bf", fontWeight: 850 };
