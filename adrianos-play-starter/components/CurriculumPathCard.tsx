"use client";

import Link from "next/link";
import { useAdrianProgress } from "@/lib/adrian-progress";
import {
  elementaryGradeReadiness,
  nextElementaryMilestone,
} from "@/lib/adrian-elementary-path";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { getCurriculumRecommendedSkill } from "@/lib/adrian-curriculum-recommendation";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { getSkillGraph, skillHref } from "@/lib/adrian-skill-graph";

export default function CurriculumPathCard() {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();

  if (!profilesReady || !progressReady) return null;

  const grade = readProfileGrade(activeProfile);
  const nodes = getSkillGraph(activeProfile, progress);
  const readiness = elementaryGradeReadiness(grade, nodes);
  const milestone = nextElementaryMilestone(grade, nodes);
  const next = getCurriculumRecommendedSkill(activeProfile, nodes);
  const pathTitle = grade === 2 ? "California Grade 2 learning path" : `${gradeLabel(grade)} elementary learning path`;

  return (
    <section style={card} aria-label="Curriculum learning path">
      <div style={header}>
        <div style={{ minWidth: 0 }}>
          <span style={eyebrow}>TK–5 ELEMENTARY JOURNEY</span>
          <h2 style={title}>{pathTitle}</h2>
          <p style={scopeCopy}>AdrianOS intentionally ends at Grade 5. Grade drives the learning sequence; age adjusts developmental presentation.</p>
        </div>
        <div style={readinessBadge}>
          <strong>{readiness}%</strong>
          <span>grade foundation</span>
        </div>
      </div>

      {milestone ? (
        <div style={nextGrid}>
          <div style={{ minWidth: 0 }}>
            <small style={label}>NEXT BEST SKILL · {milestone.area.toUpperCase()}</small>
            <h3 style={skillTitle}>{milestone.title}</h3>
            <p style={muted}>{milestone.childGoal}</p>
            <div style={tags}>
              <span style={gradeChip}>{gradeLabel(grade)}</span>
              <span style={stageChip}>{milestone.mastery}% evidence</span>
              {!milestone.available && <span style={supportChip}>Prerequisites first</span>}
            </div>
          </div>
          <div style={actions}>
            {next && <Link href={skillHref(next)} style={startLink}>Practice {next.label} →</Link>}
            <Link href="/curriculum/elementary" style={mapLink}>Open the full Elementary Journey</Link>
            {grade === 2 && <Link href="/curriculum" style={standardsLink}>See the full learning map</Link>}
          </div>
        </div>
      ) : (
        <div style={empty}>
          <div>
            <strong>Current grade milestones are strong.</strong>
            <p style={{ ...muted, margin: "5px 0 0" }}>A parent decides when to change the selected learning grade.</p>
          </div>
          <Link href="/curriculum/elementary" style={mapLink}>Review the Elementary Journey</Link>
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = { maxWidth: 1040, margin: "16px auto", padding: "clamp(20px,4vw,30px)", borderRadius: 30, border: "1px solid rgba(217,255,91,.26)", background: "linear-gradient(145deg,rgba(217,255,91,.09),rgba(127,220,255,.08),#181d28)", color: "#fff", overflow: "hidden" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 8px", fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-.05em" };
const scopeCopy: React.CSSProperties = { maxWidth: 690, margin: 0, color: "#9fa7b5", lineHeight: 1.5, fontWeight: 700, fontSize: 13 };
const readinessBadge: React.CSSProperties = { minWidth: 132, display: "grid", gap: 3, padding: 15, borderRadius: 20, background: "#d9ff5b", color: "#10131b", textAlign: "center" };
const gradeChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(217,255,91,.12)", border: "1px solid rgba(217,255,91,.3)", color: "#d9ff5b", fontSize: 12, fontWeight: 950 };
const nextGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 24, alignItems: "end", marginTop: 22 };
const label: React.CSSProperties = { color: "#aab1bf", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const skillTitle: React.CSSProperties = { margin: "6px 0 8px", fontSize: "clamp(2rem,5vw,3.6rem)", lineHeight: .98, letterSpacing: "-.06em" };
const muted: React.CSSProperties = { maxWidth: 700, margin: 0, color: "#c5cad3", lineHeight: 1.55, fontWeight: 700 };
const tags: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 };
const stageChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#fff", fontSize: 12, fontWeight: 900 };
const supportChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#ffcf8b", fontSize: 12, fontWeight: 900 };
const actions: React.CSSProperties = { display: "grid", gap: 9, justifyItems: "stretch", minWidth: 0 };
const startLink: React.CSSProperties = { padding: "14px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
const mapLink: React.CSSProperties = { padding: "12px 16px", borderRadius: 999, border: "1px solid rgba(127,220,255,.28)", color: "#7fdcff", textDecoration: "none", textAlign: "center", fontWeight: 900 };
const standardsLink: React.CSSProperties = { ...mapLink, borderColor: "rgba(198,184,255,.3)", color: "#c6b8ff" };
const empty: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 20 };
