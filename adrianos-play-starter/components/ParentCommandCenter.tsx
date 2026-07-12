"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dailySessionStreak, readDailySession } from "@/lib/adrian-daily-session";
import { getSubjectMastery, readLearningForProfile } from "@/lib/adrian-learning";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import type { Game } from "@/lib/games";
import "@/app/parent-command-center.css";

const EVENTS = [
  "adrianos-progress-updated",
  "adrianos-family-updated",
  "adrianos-learning-updated",
  "adrianos-daily-session-updated",
  "adrianos-learning-schedule-updated",
];

const TOOL_HINTS: Record<string, string> = {
  "Weekly report": "See progress, friction",
  "Skill goals": "Choose the exact skills",
};

function todayKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

function openParentTool(label: string) {
  const hint = TOOL_HINTS[label] ?? label;
  let attempts = 0;
  const open = () => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((item) => item.offsetParent !== null && item.textContent?.includes(hint));
    if (button) {
      button.click();
      return;
    }
    attempts += 1;
    if (attempts < 20) window.setTimeout(open, 50);
  };
  open();
}

export default function ParentCommandCenter({ games }: { games: Game[] }) {
  const { family, activeProfile, switchProfile, hydrated } = useFamilyProfiles();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    for (const eventName of EVENTS) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of EVENTS) window.removeEventListener(eventName, refresh);
    };
  }, []);

  const snapshot = useMemo(() => {
    if (!hydrated) return null;
    const progress = readProgressForProfile(activeProfile.id);
    const learning = readLearningForProfile(activeProfile.id);
    const session = readDailySession(activeProfile.id, todayKey());
    const mastery = getSubjectMastery(activeProfile.id, games, progress)
      .filter((row) => row.attempts > 0 || row.gamesPlayed > 0)
      .sort((a, b) => b.mastery - a.mastery);
    const dueReviews = learning.reviewQueue.filter(
      (item) => item.status === "due" && item.dueAt <= new Date().toISOString()
    ).length;
    const completedToday = session?.missions.filter((mission) => mission.status === "complete").length ?? 0;
    const totalToday = session?.missions.length ?? 0;
    const weeklyCompletions = lastSevenDays().reduce((sum, date) => {
      const activity = progress.activity.find((item) => item.date === date);
      return sum + (activity?.completions ?? 0);
    }, 0);
    const strongest = mastery[0] ?? null;
    const nextFocus = [...mastery]
      .filter((row) => row.gamesPlayed > 0)
      .sort((a, b) => a.mastery - b.mastery)[0] ?? null;
    const currentMission = session?.missions.find((mission) => mission.status !== "complete") ?? null;
    const allDone = totalToday > 0 && completedToday === totalToday;

    return {
      progress,
      session,
      dueReviews,
      completedToday,
      totalToday,
      weeklyCompletions,
      strongest,
      nextFocus,
      currentMission,
      allDone,
      streak: dailySessionStreak(activeProfile.id),
    };
  }, [activeProfile.id, games, hydrated, revision]);

  if (!hydrated || !snapshot) return null;

  const headline = snapshot.allDone
    ? `${activeProfile.name} finished today’s route.`
    : snapshot.session?.startedAt
      ? `${activeProfile.name} is partway through today.`
      : `${activeProfile.name} has not started today yet.`;

  const attention = snapshot.dueReviews > 0
    ? `${snapshot.dueReviews} review item${snapshot.dueReviews === 1 ? " is" : "s are"} due.`
    : snapshot.nextFocus
      ? `${snapshot.nextFocus.subject} is the clearest next growth area.`
      : "No urgent learning flags yet.";

  return (
    <section style={shell} aria-label="Parent learning command center">
      <div style={profileRail}>
        <div>
          <span style={eyebrow}>10-SECOND CHECK-IN</span>
          <h2 style={heading}>Today at a glance</h2>
        </div>
        <div style={profileButtons} aria-label="Choose child report">
          {family.profiles.map((profile) => {
            const selected = profile.id === activeProfile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => switchProfile(profile.id)}
                style={{ ...profileButton, ...(selected ? profileButtonActive : {}) }}
              >
                <span>{profile.emoji}</span>
                <strong>{profile.name}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="parent-command-hero" style={heroGrid}>
        <article style={statusCard}>
          <div style={statusTopline}>
            <span style={statusDot(snapshot.allDone)} />
            <span>{snapshot.allDone ? "DONE FOR TODAY" : snapshot.session?.startedAt ? "IN PROGRESS" : "NOT STARTED"}</span>
          </div>
          <h3 style={statusHeadline}>{headline}</h3>
          <p style={muted}>
            {snapshot.totalToday > 0
              ? `${snapshot.completedToday} of ${snapshot.totalToday} missions complete · about ${snapshot.session?.recommendedMinutes ?? 0} planned minutes.`
              : "Today’s guided route will appear when School Mode prepares the session."}
          </p>
          <div style={progressTrack}>
            <div
              style={{
                ...progressFill,
                width: `${snapshot.totalToday > 0 ? Math.round(snapshot.completedToday / snapshot.totalToday * 100) : 0}%`,
              }}
            />
          </div>
          <div style={actionRow}>
            <Link href="/school" style={primaryLink}>{snapshot.allDone ? "View School Mode" : "Open today’s route"}</Link>
            <button type="button" onClick={() => openParentTool("Weekly report")} style={secondaryButton}>Weekly report</button>
          </div>
        </article>

        <aside style={attentionCard}>
          <span style={eyebrow}>PARENT ATTENTION</span>
          <h3 style={attentionHeadline}>{attention}</h3>
          {snapshot.currentMission && !snapshot.allDone && (
            <div style={nextMissionBox}>
              <small>NEXT MISSION</small>
              <strong>{snapshot.currentMission.title}</strong>
              <span>{snapshot.currentMission.reason}</span>
            </div>
          )}
          <button type="button" onClick={() => openParentTool("Skill goals")} style={textButton}>Adjust learning goals →</button>
        </aside>
      </div>

      <div className="parent-command-metrics" style={metricGrid}>
        <Metric label="Today" value={`${snapshot.completedToday}/${snapshot.totalToday || 0}`} detail="missions" />
        <Metric label="Streak" value={String(snapshot.streak)} detail={snapshot.streak === 1 ? "day" : "days"} />
        <Metric label="This week" value={String(snapshot.weeklyCompletions)} detail="completed" />
        <Metric label="Level" value={String(snapshot.progress.level)} detail={`${snapshot.progress.xp} XP`} />
      </div>

      <div className="parent-command-insights" style={insightGrid}>
        <Insight
          label="STRONGEST AREA"
          title={snapshot.strongest ? snapshot.strongest.subject : "Still learning"}
          detail={snapshot.strongest ? `${snapshot.strongest.mastery}% mastery · ${snapshot.strongest.stage}` : "More play data will reveal strengths."}
        />
        <Insight
          label="NEXT GROWTH AREA"
          title={snapshot.nextFocus ? snapshot.nextFocus.subject : "Keep exploring"}
          detail={snapshot.nextFocus ? `${snapshot.nextFocus.mastery}% mastery · ${snapshot.nextFocus.stage}` : "No weak area is established yet."}
        />
        <Insight
          label="REVIEWS DUE"
          title={snapshot.dueReviews > 0 ? String(snapshot.dueReviews) : "None"}
          detail={snapshot.dueReviews > 0 ? "These should be prioritized in the next route." : "The review queue is clear."}
        />
      </div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div style={metricCard}><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>;
}

function Insight({ label, title, detail }: { label: string; title: string; detail: string }) {
  return <article style={insightCard}><small>{label}</small><strong>{title}</strong><p>{detail}</p></article>;
}

function statusDot(done: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: done ? "#d9ff5b" : "#7fdcff",
    boxShadow: done ? "0 0 0 6px rgba(217,255,91,.12)" : "0 0 0 6px rgba(127,220,255,.12)",
  };
}

const shell: React.CSSProperties = { display: "grid", gap: 16, marginBottom: 20 };
const profileRail: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heading: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(2rem,5vw,3.4rem)", letterSpacing: "-.055em" };
const profileButtons: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const profileButton: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1.65fr) minmax(280px,.85fr)", gap: 14 };
const statusCard: React.CSSProperties = { padding: "clamp(24px,5vw,42px)", borderRadius: 30, background: "linear-gradient(145deg,rgba(127,220,255,.12),rgba(198,184,255,.08) 52%,#181d28)", border: "1px solid rgba(127,220,255,.28)", boxShadow: "0 24px 60px rgba(0,0,0,.22)" };
const statusTopline: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, color: "#aab1bf", fontSize: 11, fontWeight: 950, letterSpacing: ".12em" };
const statusHeadline: React.CSSProperties = { margin: "18px 0 12px", maxWidth: 760, fontSize: "clamp(2.5rem,6vw,5rem)", lineHeight: .92, letterSpacing: "-.066em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55, fontWeight: 700 };
const progressTrack: React.CSSProperties = { height: 12, borderRadius: 999, background: "#10131b", overflow: "hidden", marginTop: 22 };
const progressFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)", transition: "width .25s ease" };
const actionRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 };
const primaryLink: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const secondaryButton: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, background: "#222936", color: "#fff", fontWeight: 900, border: "1px solid rgba(255,255,255,.12)", cursor: "pointer" };
const attentionCard: React.CSSProperties = { padding: 24, borderRadius: 28, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", display: "grid", alignContent: "start", gap: 14 };
const attentionHeadline: React.CSSProperties = { margin: 0, fontSize: "clamp(1.7rem,4vw,2.6rem)", lineHeight: 1, letterSpacing: "-.045em" };
const nextMissionBox: React.CSSProperties = { display: "grid", gap: 6, padding: 15, borderRadius: 18, background: "#222936", color: "#aab1bf" };
const textButton: React.CSSProperties = { width: "fit-content", padding: 0, border: 0, background: "transparent", color: "#d9ff5b", fontWeight: 900, cursor: "pointer" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 };
const metricCard: React.CSSProperties = { display: "grid", gap: 4, padding: 16, borderRadius: 19, background: "#181d28", border: "1px solid rgba(255,255,255,.09)" };
const insightGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 };
const insightCard: React.CSSProperties = { padding: 18, borderRadius: 20, background: "#181d28", border: "1px solid rgba(255,255,255,.09)" };
