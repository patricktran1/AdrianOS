"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import {
  ELEMENTARY_GRADE_OPTIONS,
  elementaryGradeLabel,
  elementaryGradeTypicalAge,
  type ElementaryGrade,
} from "@/lib/adrian-elementary-scope";
import {
  elementaryGradeReadiness,
  elementaryMilestoneProgress,
  nextElementaryMilestone,
} from "@/lib/adrian-elementary-path";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { getSkillGraph, skillHref } from "@/lib/adrian-skill-graph";

function readinessLabel(value: number): string {
  if (value >= 80) return "Strong foundation";
  if (value >= 55) return "Growing steadily";
  if (value > 0) return "Early evidence";
  return "Ready to begin";
}

export default function ElementaryJourneyPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const grade = profilesReady ? readProfileGrade(activeProfile) : 2;
  const nodes = useMemo(
    () => profilesReady && progressReady ? getSkillGraph(activeProfile, progress) : [],
    [activeProfile.id, activeProfile.age, profilesReady, progressReady, progress],
  );
  const milestones = useMemo(
    () => elementaryMilestoneProgress(grade, nodes),
    [grade, nodes],
  );
  const readiness = useMemo(
    () => elementaryGradeReadiness(grade, nodes),
    [grade, nodes],
  );
  const next = useMemo(
    () => nextElementaryMilestone(grade, nodes),
    [grade, nodes],
  );

  if (!profilesReady || !progressReady) {
    return <main style={page}><section style={hero}><h1>Building the Elementary Journey…</h1></section></main>;
  }

  const mastered = milestones.filter((milestone) => milestone.mastered).length;
  const nextGrade = grade < 5 ? (grade + 1) as ElementaryGrade : null;
  const nextGradeReadiness = nextGrade === null ? null : elementaryGradeReadiness(nextGrade, nodes);

  return (
    <main style={page}>
      <header style={topbar}>
        <Link href="/school" style={backLink}>← School Mode</Link>
        <div style={topActions}>
          <Link href="/curriculum" style={secondaryLink}>California standards map</Link>
          <Link href="/parent" style={parentLink}>Parent access 🔒</Link>
        </div>
      </header>

      <section style={hero}>
        <div>
          <span style={eyebrow}>TK–5 ELEMENTARY JOURNEY</span>
          <h1 style={heroTitle}>{activeProfile.name}’s grade path</h1>
          <p style={lead}>
            AdrianOS now has one honest boundary: Transitional Kindergarten through Grade 5.
            The selected grade drives learning priorities; age only helps keep the presentation developmentally comfortable.
          </p>
        </div>
        <div style={readinessOrb} aria-label={`${readiness}% current grade readiness`}>
          <strong>{readiness}%</strong>
          <span>{readinessLabel(readiness)}</span>
        </div>
      </section>

      <div style={profileRow} aria-label="Choose learner">
        {family.profiles.map((profile) => {
          const selected = profile.id === activeProfile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => switchProfile(profile.id)}
              style={{ ...profileButton, ...(selected ? profileButtonActive : {}) }}
            >
              <span style={{ fontSize: 30 }}>{profile.emoji}</span>
              <span>
                <strong style={{ display: "block" }}>{profile.name}</strong>
                <small style={{ opacity: .68 }}>Age {profile.age} · {elementaryGradeLabel(readProfileGrade(profile))}</small>
              </span>
            </button>
          );
        })}
      </div>

      <section style={scopeCard} aria-label="Elementary product scope">
        <div>
          <span style={eyebrow}>CURRENT GRADE</span>
          <h2 style={scopeTitle}>{elementaryGradeLabel(grade)}</h2>
          <p style={lead}>Typical age {elementaryGradeTypicalAge(grade)} · {mastered} of {milestones.length} milestones currently strong.</p>
        </div>
        <div style={scopeNote}>
          <strong>Parent-controlled placement</strong>
          <span>Readiness is a signal, not an automatic promotion. A parent chooses when the learning grade changes.</span>
        </div>
      </section>

      <section style={ladderSection} aria-label="TK through Grade 5 ladder">
        <div style={sectionHeader}>
          <div>
            <span style={eyebrow}>THE COMPLETE PRODUCT RANGE</span>
            <h2 style={sectionTitle}>Seven elementary stops. No phantom hallways.</h2>
          </div>
          <p style={legend}>The percentage shows evidence already collected in skills used by each grade’s AdrianOS milestones.</p>
        </div>
        <div style={gradeLadder}>
          {ELEMENTARY_GRADE_OPTIONS.map((option) => {
            const optionReadiness = elementaryGradeReadiness(option.value, nodes);
            const current = option.value === grade;
            const completedGrade = option.value < grade;
            return (
              <article
                key={option.value}
                style={{
                  ...gradeStop,
                  ...(current ? gradeStopCurrent : {}),
                  opacity: option.value > grade + 1 ? .56 : 1,
                }}
              >
                <span style={gradeDot}>{completedGrade ? "✓" : option.shortLabel}</span>
                <strong>{option.value === -1 ? "TK" : option.label}</strong>
                <small>{current ? "Current grade" : completedGrade ? "Earlier foundation" : option.value === grade + 1 ? "Next-grade preview" : "Later elementary"}</small>
                <div style={miniTrack}><div style={{ ...miniFill, width: `${optionReadiness}%` }} /></div>
                <span>{optionReadiness}% evidence</span>
              </article>
            );
          })}
        </div>
      </section>

      {next && (
        <section style={nextCard}>
          <div>
            <span style={eyebrow}>NEXT ELEMENTARY MILESTONE</span>
            <h2 style={nextTitle}>{next.title}</h2>
            <p style={lead}>{next.childGoal}</p>
            <div style={chips}>
              <span style={areaChip}>{next.area}</span>
              <span style={masteryChip}>{next.mastery}% evidence</span>
              {!next.available && <span style={lockedChip}>Prerequisite work first</span>}
            </div>
          </div>
          {next.lowestSkill ? (
            <Link href={skillHref(next.lowestSkill)} style={startLink}>Practice {next.lowestSkill.label} →</Link>
          ) : (
            <Link href="/school" style={secondaryAction}>Return to today’s route</Link>
          )}
        </section>
      )}

      <section style={milestoneSection}>
        <div style={sectionHeader}>
          <div>
            <span style={eyebrow}>{elementaryGradeLabel(grade).toUpperCase()} MILESTONES</span>
            <h2 style={sectionTitle}>What this grade is building</h2>
          </div>
          <p style={legend}>These are AdrianOS progression milestones. They do not claim complete state-standards coverage.</p>
        </div>
        <div style={milestoneGrid}>
          {milestones.map((milestone) => (
            <article key={milestone.id} style={milestoneCard}>
              <div style={milestoneTop}>
                <span style={areaChip}>{milestone.area}</span>
                <span style={milestone.mastered ? masteredChip : masteryChip}>
                  {milestone.mastered ? "Strong" : `${milestone.mastery}%`}
                </span>
              </div>
              <h3 style={milestoneTitle}>{milestone.title}</h3>
              <p style={goalText}>{milestone.childGoal}</p>
              <div style={meterTrack}><div style={{ ...meterFill, width: `${milestone.mastery}%` }} /></div>
              <div style={meterLabel}>
                <span>{milestone.available ? readinessLabel(milestone.mastery) : "Build prerequisites first"}</span>
                <span>{milestone.skillIds.length} linked skills</span>
              </div>
              {milestone.lowestSkill && (
                <Link href={skillHref(milestone.lowestSkill)} style={practiceLink}>
                  Practice {milestone.lowestSkill.label} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      <section style={boundaryCard}>
        <div>
          <span style={eyebrow}>{grade === 5 ? "ELEMENTARY FINISH LINE" : "NEXT-GRADE PREVIEW"}</span>
          <h2 style={boundaryTitle}>
            {grade === 5
              ? "Grade 5 is the current AdrianOS ceiling."
              : `${nextGradeReadiness}% of the ${elementaryGradeLabel(nextGrade!)} milestone foundation is already visible.`}
          </h2>
        </div>
        <p style={lead}>
          {grade === 5
            ? "AdrianOS does not currently claim a Grade 6, middle-school, or high-school curriculum. Future expansion should be built as a real curriculum release, not unlocked by changing an age number."
            : "This preview helps a parent see continuity across grades. It does not change the learner’s selected grade or skip unfinished foundations."}
        </p>
      </section>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "0 18px 84px", background: "#10131b", color: "#fff", overflowX: "hidden" };
const topbar: React.CSSProperties = { maxWidth: 1120, minHeight: 76, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const topActions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const backLink: React.CSSProperties = { color: "#d9ff5b", textDecoration: "none", fontWeight: 950 };
const secondaryLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(127,220,255,.28)", color: "#7fdcff", textDecoration: "none", fontWeight: 900 };
const parentLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", textDecoration: "none", fontWeight: 900 };
const hero: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(28px,6vw,62px)", borderRadius: 36, display: "grid", gridTemplateColumns: "minmax(0,1.6fr) auto", gap: 28, alignItems: "center", background: "linear-gradient(145deg,rgba(217,255,91,.11),rgba(127,220,255,.09),rgba(198,184,255,.07),#181d28)", border: "1px solid rgba(217,255,91,.28)" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "10px 0 15px", fontSize: "clamp(3.2rem,8vw,6.7rem)", lineHeight: .88, letterSpacing: "-.075em" };
const lead: React.CSSProperties = { margin: 0, color: "#b7bdc8", lineHeight: 1.6, fontWeight: 700 };
const readinessOrb: React.CSSProperties = { width: 170, height: 170, display: "grid", placeContent: "center", gap: 4, textAlign: "center", borderRadius: 999, background: "#d9ff5b", color: "#10131b", boxShadow: "0 22px 60px rgba(217,255,91,.2)" };
const profileRow: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", display: "flex", gap: 10, flexWrap: "wrap" };
const profileButton: React.CSSProperties = { minWidth: 180, display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderRadius: 20, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.09)" };
const scopeCard: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: 25, borderRadius: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 20, alignItems: "center", background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const scopeTitle: React.CSSProperties = { margin: "7px 0", fontSize: "clamp(2.4rem,6vw,4.4rem)", letterSpacing: "-.06em" };
const scopeNote: React.CSSProperties = { display: "grid", gap: 6, padding: 17, borderRadius: 20, background: "#222936", color: "#aab1bf" };
const ladderSection: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(22px,4vw,34px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(127,220,255,.2)" };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap", marginBottom: 20 };
const sectionTitle: React.CSSProperties = { margin: "7px 0 0", fontSize: "clamp(2rem,5vw,3.7rem)", lineHeight: .96, letterSpacing: "-.055em" };
const legend: React.CSSProperties = { maxWidth: 470, margin: 0, color: "#8f98a8", lineHeight: 1.5, fontSize: 13 };
const gradeLadder: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9 };
const gradeStop: React.CSSProperties = { display: "grid", gap: 7, padding: 14, borderRadius: 19, border: "1px solid rgba(255,255,255,.09)", background: "#222936" };
const gradeStopCurrent: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const gradeDot: React.CSSProperties = { width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontWeight: 950 };
const miniTrack: React.CSSProperties = { height: 6, borderRadius: 999, overflow: "hidden", background: "#10131b" };
const miniFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#d9ff5b)" };
const nextCard: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(24px,5vw,40px)", borderRadius: 31, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: 24, alignItems: "end", border: "1px solid rgba(217,255,91,.32)", background: "rgba(217,255,91,.07)" };
const nextTitle: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(2.8rem,7vw,5rem)", lineHeight: .94, letterSpacing: "-.067em" };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 };
const areaChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontSize: 11, fontWeight: 950 };
const masteryChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#fff", fontSize: 11, fontWeight: 900 };
const masteredChip: React.CSSProperties = { ...masteryChip, background: "rgba(217,255,91,.14)", color: "#d9ff5b" };
const lockedChip: React.CSSProperties = { ...masteryChip, color: "#ffcf8b" };
const startLink: React.CSSProperties = { padding: "15px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textAlign: "center", textDecoration: "none", fontWeight: 950 };
const secondaryAction: React.CSSProperties = { ...startLink, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const milestoneSection: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(22px,4vw,34px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const milestoneGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 };
const milestoneCard: React.CSSProperties = { display: "grid", alignContent: "start", gap: 11, padding: 18, borderRadius: 22, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const milestoneTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const milestoneTitle: React.CSSProperties = { margin: 0, fontSize: 23, lineHeight: 1.02, letterSpacing: "-.035em" };
const goalText: React.CSSProperties = { margin: 0, color: "#c2c8d2", lineHeight: 1.5 };
const meterTrack: React.CSSProperties = { height: 9, borderRadius: 999, overflow: "hidden", background: "#10131b" };
const meterFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const meterLabel: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, color: "#8f98a8", fontSize: 11 };
const practiceLink: React.CSSProperties = { marginTop: 2, color: "#d9ff5b", textDecoration: "none", fontWeight: 900 };
const boundaryCard: React.CSSProperties = { maxWidth: 1120, margin: "0 auto", padding: "clamp(24px,5vw,42px)", borderRadius: 31, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 22, alignItems: "center", border: "1px solid rgba(198,184,255,.28)", background: "linear-gradient(145deg,rgba(198,184,255,.09),#181d28)" };
const boundaryTitle: React.CSSProperties = { margin: "8px 0 0", fontSize: "clamp(2.1rem,5vw,3.8rem)", lineHeight: .98, letterSpacing: "-.055em" };
