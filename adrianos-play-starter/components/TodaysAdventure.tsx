"use client";

import Link from "next/link";
import type { Game } from "@/lib/games";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useLearningState, type LearningStage } from "@/lib/adrian-learning";

function stageColor(stage: LearningStage): string {
  if (stage === "Mastered") return "#d9ff5b";
  if (stage === "Practicing") return "#c6b8ff";
  return "#7fdcff";
}

export default function TodaysAdventure({ games }: { games: Game[] }) {
  const { progress, hydrated } = useAdrianProgress();
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { state, mastery, dueReviews, hydrated: learningReady } = useLearningState(games, progress);

  if (!hydrated || !profilesReady || !learningReady || !state.dailyAdventure) {
    return (
      <section style={{ ...shell, minHeight: 220 }}>
        <span className="eyebrow">TODAY’S ADVENTURE</span>
        <h2 style={title}>Building today’s path…</h2>
      </section>
    );
  }

  const items = state.dailyAdventure.items;
  const completed = items.filter(
    (item) => (progress.games[item.gameSlug]?.plays ?? 0) > item.baselinePlays
  ).length;
  const stages = {
    Learning: mastery.filter((row) => row.stage === "Learning").length,
    Practicing: mastery.filter((row) => row.stage === "Practicing").length,
    Mastered: mastery.filter((row) => row.stage === "Mastered").length,
  };

  return (
    <section style={shell}>
      <div style={header}>
        <div>
          <span className="eyebrow">TODAY’S ADVENTURE</span>
          <h2 style={title}>{activeProfile.name}’s three missions</h2>
          <p style={muted}>
            AdrianOS picks a review, a skill builder, and a fun finish from each child’s own progress.
          </p>
        </div>
        <div style={progressOrb} aria-label={`${completed} of ${items.length} missions complete`}>
          <strong>{completed}/{items.length}</strong>
          <span>DONE</span>
        </div>
      </div>

      <div style={missionGrid}>
        {items.map((item, index) => {
          const game = games.find((entry) => entry.slug === item.gameSlug);
          if (!game) return null;
          const isComplete = (progress.games[item.gameSlug]?.plays ?? 0) > item.baselinePlays;
          return (
            <Link key={item.id} href={item.href} style={missionCard}>
              <div style={missionTop}>
                <span style={missionNumber}>{isComplete ? "✓" : index + 1}</span>
                <span style={kindPill}>
                  {item.kind === "review" ? "REVIEW" : item.kind === "skill" ? "BUILD" : "EXPLORE"}
                </span>
              </div>
              <div style={{ fontSize: 46 }}>{game.emoji}</div>
              <h3 style={missionTitle}>{game.title}</h3>
              <p style={{ ...muted, margin: 0 }}>{item.reason}</p>
              <div style={missionFooter}>
                <span>{item.difficulty}</span>
                <strong>{isComplete ? "COMPLETE" : "START →"}</strong>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={learningStrip}>
        <div>
          <small style={stripLabel}>LEARNING MAP</small>
          <strong>{dueReviews.length > 0 ? `${dueReviews.length} review${dueReviews.length === 1 ? "" : "s"} ready` : "No reviews due"}</strong>
        </div>
        {(["Learning", "Practicing", "Mastered"] as LearningStage[]).map((stage) => (
          <div key={stage} style={stageStat}>
            <span style={{ ...stageDot, background: stageColor(stage) }} />
            <strong>{stages[stage]}</strong>
            <small>{stage}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

const shell: React.CSSProperties = {
  marginTop: 42,
  padding: "clamp(22px,4vw,36px)",
  borderRadius: 32,
  border: "1px solid rgba(217,255,91,.24)",
  background: "linear-gradient(145deg,rgba(217,255,91,.08),rgba(198,184,255,.08) 55%,#181d28)",
  boxShadow: "0 28px 70px rgba(0,0,0,.25)",
};
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap" };
const title: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(2.2rem,6vw,4.5rem)", lineHeight: .94, letterSpacing: "-.06em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55, maxWidth: 760 };
const progressOrb: React.CSSProperties = { width: 104, height: 104, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b", boxShadow: "0 14px 40px rgba(217,255,91,.18)" };
const missionGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginTop: 24 };
const missionCard: React.CSSProperties = { minHeight: 270, display: "flex", flexDirection: "column", gap: 12, padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.1)", background: "rgba(16,19,27,.78)", color: "#fff", textDecoration: "none", boxShadow: "0 18px 40px rgba(0,0,0,.2)" };
const missionTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const missionNumber: React.CSSProperties = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950 };
const kindPill: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 11, fontWeight: 950, letterSpacing: ".12em" };
const missionTitle: React.CSSProperties = { margin: 0, fontSize: 25, letterSpacing: "-.035em" };
const missionFooter: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)", color: "#d9ff5b", fontSize: 12, fontWeight: 900 };
const learningStrip: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginTop: 18, padding: "15px 17px", borderRadius: 20, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.08)" };
const stripLabel: React.CSSProperties = { display: "block", color: "#aab1bf", fontWeight: 900, letterSpacing: ".12em", marginBottom: 4 };
const stageStat: React.CSSProperties = { display: "grid", gridTemplateColumns: "10px auto", columnGap: 8, alignItems: "center" };
const stageDot: React.CSSProperties = { width: 9, height: 9, borderRadius: 999, gridRow: "1 / span 2" };
