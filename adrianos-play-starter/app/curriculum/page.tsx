"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  curriculumPackLabel,
  curriculumProgress,
  primaryStandardForSkill,
} from "@/lib/adrian-curriculum";
import { getCurriculumRecommendedSkill } from "@/lib/adrian-curriculum-recommendation";
import {
  GRADE_OPTIONS,
  gradeLabel,
  inferredGradeForAge,
  readProfileGrade,
  writeProfileGrade,
} from "@/lib/adrian-profile-grade";
import { getSkillGraph, skillHref } from "@/lib/adrian-skill-graph";

export default function CurriculumPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const [revision, setRevision] = useState(0);

  const grade = profilesReady ? readProfileGrade(activeProfile) : 2;
  const nodes = useMemo(
    () => profilesReady && progressReady ? getSkillGraph(activeProfile, progress) : [],
    [activeProfile.id, activeProfile.age, profilesReady, progressReady, progress, revision]
  );
  const standards = useMemo(() => curriculumProgress(grade, nodes), [grade, nodes]);
  const next = useMemo(
    () => profilesReady ? getCurriculumRecommendedSkill(activeProfile, nodes) : null,
    [activeProfile.id, activeProfile.age, nodes, profilesReady, revision]
  );
  const nextStandard = next ? primaryStandardForSkill(next.id, grade) : null;

  if (!profilesReady || !progressReady) {
    return <main style={page}><section style={hero}><h1>Building the learning map…</h1></section></main>;
  }

  function changeGrade(value: number) {
    writeProfileGrade(activeProfile.id, value);
    setRevision((current) => current + 1);
  }

  const mastered = standards.filter((standard) => standard.mastered).length;
  const direct = standards.filter((standard) => standard.strength === "direct");
  const subjectGroups = ["Math", "Reading", "Science"] as const;

  return (
    <main style={page}>
      <header style={topbar}>
        <Link href="/school" style={backLink}>← School Mode</Link>
        <Link href="/parent" style={parentLink}>Parent access 🔒</Link>
      </header>

      <section style={hero}>
        <div>
          <span style={eyebrow}>CURRICULUM-AWARE LEARNING</span>
          <h1 style={heroTitle}>{activeProfile.name}’s learning map</h1>
          <p style={lead}>
            Games are connected to explicit learning goals. Direct alignments can contribute skill evidence; supporting activities build background without pretending to prove mastery.
          </p>
        </div>
        <div style={heroControls}>
          <label style={controlLabel} htmlFor="curriculum-grade">Learning grade</label>
          <select
            id="curriculum-grade"
            value={grade}
            onChange={(event) => changeGrade(Number(event.target.value))}
            style={gradeSelect}
          >
            {GRADE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <small style={fineprint}>Age {activeProfile.age} suggests {gradeLabel(inferredGradeForAge(activeProfile.age))}. A parent override syncs with the family learning record.</small>
        </div>
      </section>

      <div style={profileRow} aria-label="Choose student">
        {family.profiles.map((profile) => (
          <button
            type="button"
            key={profile.id}
            onClick={() => switchProfile(profile.id)}
            style={{ ...profileButton, ...(profile.id === activeProfile.id ? profileButtonActive : {}) }}
          >
            <span style={{ fontSize: 28 }}>{profile.emoji}</span>
            <span><strong>{profile.name}</strong><small style={{ display: "block", opacity: .65 }}>Age {profile.age}</small></span>
          </button>
        ))}
      </div>

      <section style={overview}>
        <div>
          <span style={eyebrow}>CURRENT PATH</span>
          <h2 style={sectionTitle}>{curriculumPackLabel(activeProfile)}</h2>
        </div>
        <div style={statGrid}>
          <div style={stat}><strong>{mastered}/{standards.length || nodes.length}</strong><span>{standards.length ? "standards mastered" : "skills available"}</span></div>
          <div style={stat}><strong>{direct.length || nodes.filter((node) => !node.locked).length}</strong><span>{standards.length ? "direct evidence targets" : "unlocked skills"}</span></div>
          <div style={stat}><strong>{next?.mastery ?? 0}%</strong><span>next skill mastery</span></div>
        </div>
      </section>

      {next && (
        <section style={nextCard}>
          <div>
            <span style={eyebrow}>NEXT BEST LESSON</span>
            <h2 style={nextTitle}>{next.label}</h2>
            <p style={lead}>{nextStandard?.childGoal ?? next.description}</p>
            <div style={chips}>
              {nextStandard && <span style={codeChip}>{nextStandard.code}</span>}
              <span style={stageChip}>{next.stage} · {next.mastery}%</span>
              {nextStandard?.strength === "supporting" && <span style={supportChip}>Supporting, not mastery proof</span>}
            </div>
          </div>
          <Link href={skillHref(next)} style={startButton}>Start this lesson →</Link>
        </section>
      )}

      {standards.length > 0 ? (
        <section style={mapSection}>
          <div style={sectionHeader}>
            <div>
              <span style={eyebrow}>CALIFORNIA GRADE 2</span>
              <h2 style={sectionTitle}>Standards coverage</h2>
            </div>
            <p style={legend}>Direct = practice can collect evidence. Supporting = conceptually related enrichment.</p>
          </div>

          {subjectGroups.map((subject) => {
            const rows = standards.filter((standard) => standard.subject === subject);
            if (rows.length === 0) return null;
            return (
              <div key={subject} style={subjectBlock}>
                <h3 style={subjectTitle}>{subject}</h3>
                <div style={standardsGrid}>
                  {rows.map((standard) => {
                    const candidates = standard.skillIds.flatMap((id) => {
                      const node = nodes.find((item) => item.id === id);
                      return node ? [node] : [];
                    });
                    const target = [...candidates].sort((a, b) => a.mastery - b.mastery)[0];
                    return (
                      <article key={standard.code} style={standardCard}>
                        <div style={standardTop}>
                          <span style={codeChip}>{standard.code}</span>
                          <span style={standard.strength === "direct" ? directChip : supportChip}>
                            {standard.strength === "direct" ? "Direct evidence" : "Supporting"}
                          </span>
                        </div>
                        <h4 style={standardTitle}>{standard.title}</h4>
                        <p style={goalText}>{standard.childGoal}</p>
                        <div style={meterTrack}><div style={{ ...meterFill, width: `${standard.mastery}%` }} /></div>
                        <div style={meterLabel}><span>{standard.mastery}%</span><span>{standard.mastered ? "Mastered" : standard.available ? "In progress" : "Not unlocked"}</span></div>
                        {target && <Link href={skillHref(target)} style={practiceLink}>Practice {target.label} →</Link>}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section style={mapSection}>
          <span style={eyebrow}>AGE-ADAPTIVE FOUNDATIONS</span>
          <h2 style={sectionTitle}>{gradeLabel(grade)} skill progression</h2>
          <p style={lead}>The detailed California standards pack currently centers the second-grade cohort. Other grades still use age gates, prerequisites, mastery, missed-item review, and parent goals to choose an appropriate next skill.</p>
          <div style={standardsGrid}>
            {nodes.filter((node) => !node.locked).slice(0, 18).map((node) => (
              <article key={node.id} style={standardCard}>
                <span style={stageChip}>{node.subject}</span>
                <h4 style={standardTitle}>{node.label}</h4>
                <p style={goalText}>{node.description}</p>
                <div style={meterTrack}><div style={{ ...meterFill, width: `${node.mastery}%` }} /></div>
                <div style={meterLabel}><span>{node.mastery}%</span><span>{node.stage}</span></div>
                <Link href={skillHref(node)} style={practiceLink}>Practice →</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: "0 18px 80px", background: "#10131b", color: "#fff", overflowX: "hidden" };
const topbar: React.CSSProperties = { maxWidth: 1120, minHeight: 74, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const backLink: React.CSSProperties = { color: "#d9ff5b", textDecoration: "none", fontWeight: 950 };
const parentLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", textDecoration: "none", fontWeight: 900 };
const hero: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(25px,6vw,58px)", borderRadius: 34, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 28, alignItems: "end", background: "linear-gradient(145deg,rgba(127,220,255,.12),rgba(198,184,255,.08),#181d28)", border: "1px solid rgba(127,220,255,.28)" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const heroTitle: React.CSSProperties = { margin: "10px 0 14px", fontSize: "clamp(3rem,8vw,6.6rem)", lineHeight: .9, letterSpacing: "-.075em" };
const lead: React.CSSProperties = { color: "#b7bdc8", lineHeight: 1.6, fontWeight: 700 };
const heroControls: React.CSSProperties = { display: "grid", gap: 8, padding: 18, borderRadius: 22, background: "rgba(16,19,27,.65)", border: "1px solid rgba(255,255,255,.08)", minWidth: 0 };
const controlLabel: React.CSSProperties = { color: "#aab1bf", fontSize: 11, fontWeight: 950, letterSpacing: ".12em" };
const gradeSelect: React.CSSProperties = { width: "100%", padding: "13px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", font: "inherit", fontWeight: 900 };
const fineprint: React.CSSProperties = { color: "#818a99", lineHeight: 1.45 };
const profileRow: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", display: "flex", gap: 10, flexWrap: "wrap" };
const profileButton: React.CSSProperties = { minWidth: 160, maxWidth: "100%", display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.08)" };
const overview: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: 24, borderRadius: 28, background: "#181d28", border: "1px solid rgba(255,255,255,.1)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 24, alignItems: "center" };
const sectionTitle: React.CSSProperties = { margin: "7px 0", fontSize: "clamp(2rem,5vw,3.6rem)", letterSpacing: "-.055em" };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8 };
const stat: React.CSSProperties = { display: "grid", gap: 5, padding: 13, borderRadius: 16, background: "#10131b", textAlign: "center" };
const nextCard: React.CSSProperties = { maxWidth: 1120, margin: "0 auto 16px", padding: "clamp(23px,5vw,38px)", borderRadius: 30, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 26, alignItems: "end", background: "rgba(217,255,91,.07)", border: "1px solid rgba(217,255,91,.3)" };
const nextTitle: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(2.8rem,7vw,5rem)", letterSpacing: "-.07em" };
const chips: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 };
const codeChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontSize: 12, fontWeight: 950 };
const stageChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "#222936", color: "#fff", fontSize: 12, fontWeight: 900 };
const directChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(217,255,91,.12)", color: "#d9ff5b", fontSize: 11, fontWeight: 950 };
const supportChip: React.CSSProperties = { padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#aab1bf", fontSize: 11, fontWeight: 900 };
const startButton: React.CSSProperties = { padding: "15px 21px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
const mapSection: React.CSSProperties = { maxWidth: 1120, margin: "0 auto", padding: "clamp(22px,5vw,38px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "end", flexWrap: "wrap" };
const legend: React.CSSProperties = { maxWidth: 430, color: "#8992a1", lineHeight: 1.5, fontSize: 13 };
const subjectBlock: React.CSSProperties = { marginTop: 30 };
const subjectTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 24 };
const standardsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 12 };
const standardCard: React.CSSProperties = { minWidth: 0, padding: 18, borderRadius: 21, background: "#10131b", border: "1px solid rgba(255,255,255,.09)", display: "grid", alignContent: "start" };
const standardTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" };
const standardTitle: React.CSSProperties = { margin: "14px 0 8px", fontSize: 20, letterSpacing: "-.03em" };
const goalText: React.CSSProperties = { margin: 0, color: "#aeb5c1", lineHeight: 1.5 };
const meterTrack: React.CSSProperties = { height: 8, marginTop: 18, borderRadius: 999, background: "#252b38", overflow: "hidden" };
const meterFill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "#d9ff5b" };
const meterLabel: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 7, color: "#858e9d", fontSize: 11, fontWeight: 900 };
const practiceLink: React.CSSProperties = { marginTop: 15, color: "#7fdcff", textDecoration: "none", fontWeight: 950 };
