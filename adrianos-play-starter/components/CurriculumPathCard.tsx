"use client";

import Link from "next/link";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { curriculumPackLabel, primaryStandardForSkill } from "@/lib/adrian-curriculum";
import { getCurriculumRecommendedSkill } from "@/lib/adrian-curriculum-recommendation";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import { getSkillGraph, skillHref } from "@/lib/adrian-skill-graph";

export default function CurriculumPathCard() {
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();

  if (!profilesReady || !progressReady) return null;

  const grade = readProfileGrade(activeProfile);
  const nodes = getSkillGraph(activeProfile, progress);
  const next = getCurriculumRecommendedSkill(activeProfile, nodes);
  const standard = next ? primaryStandardForSkill(next.id, grade) : null;

  return (
    <section style={card} aria-label="Curriculum learning path">
      <div style={header}>
        <div>
          <span style={eyebrow}>LEARNING PATH</span>
          <h2 style={title}>{curriculumPackLabel(activeProfile)}</h2>
        </div>
        <span style={gradeChip}>{gradeLabel(grade)}</span>
      </div>

      {next ? (
        <div style={nextGrid}>
          <div>
            <small style={label}>NEXT BEST SKILL</small>
            <h3 style={skillTitle}>{next.label}</h3>
            <p style={muted}>{standard?.childGoal ?? next.description}</p>
            <div style={tags}>
              {standard && <span style={standardChip}>{standard.code}</span>}
              <span style={stageChip}>{next.stage} · {next.mastery}%</span>
              {standard?.strength === "supporting" && <span style={supportChip}>Supporting practice</span>}
            </div>
          </div>
          <div style={actions}>
            <Link href={skillHref(next)} style={startLink}>Practice this skill →</Link>
            <Link href="/curriculum" style={mapLink}>See the full learning map</Link>
          </div>
        </div>
      ) : (
        <div style={empty}>
          <strong>Everything currently available is mastered.</strong>
          <Link href="/curriculum" style={mapLink}>Review the learning map</Link>
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = { maxWidth: 1040, margin: "16px auto", padding: "clamp(20px,4vw,30px)", borderRadius: 30, border: "1px solid rgba(127,220,255,.26)", background: "linear-gradient(145deg,rgba(127,220,255,.1),rgba(217,255,91,.05),#181d28)", color: "#fff" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 0", fontSize: "clamp(1.6rem,4vw,2.6rem)", letterSpacing: "-.045em" };
const gradeChip: React.CSSProperties = { padding: "9px 13px", borderRadius: 999, background: "rgba(217,255,91,.12)", border: "1px solid rgba(217,255,91,.3)", color: "#d9ff5b", fontWeight: 950 };
const nextGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 24, alignItems: "end", marginTop: 22 };
const label: React.CSSProperties = { color: "#aab1bf", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" };
const skillTitle: React.CSSProperties = { margin: "6px 0 8px", fontSize: "clamp(2rem,5vw,3.6rem)", letterSpacing: "-.06em" };
const muted: React.CSSProperties = { maxWidth: 700, margin: 0, color: "#c5cad3", lineHeight: 1.55, fontWeight: 700 };
const tags: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 };
const standardChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontSize: 12, fontWeight: 950 };
const stageChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#fff", fontSize: 12, fontWeight: 900 };
const supportChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#aab1bf", fontSize: 12, fontWeight: 900 };
const actions: React.CSSProperties = { display: "grid", gap: 9, justifyItems: "stretch", minWidth: 220 };
const startLink: React.CSSProperties = { padding: "14px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
const mapLink: React.CSSProperties = { padding: "12px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", color: "#fff", textDecoration: "none", textAlign: "center", fontWeight: 900 };
const empty: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap", marginTop: 20 };
