"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  buildLearningPortfolio,
  PORTFOLIO_EVENT,
  readPortfolioShowcase,
  togglePortfolioHighlight,
  type PortfolioHighlight,
  type PortfolioTranscriptRow,
} from "@/lib/adrian-portfolio";
import { games } from "@/lib/generated-games";

function formatDate(value: string | null): string {
  if (!value) return "Not recorded yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function kindLabel(kind: PortfolioHighlight["kind"]): string {
  if (kind === "mastery") return "MASTERED";
  if (kind === "growth") return "GROWTH";
  if (kind === "session") return "SCHOOL DAY";
  if (kind === "achievement") return "ACHIEVEMENT";
  return "PRACTICING";
}

function stageColor(stage: PortfolioTranscriptRow["stage"]): string {
  if (stage === "Mastered") return "#d9ff5b";
  if (stage === "Practicing") return "#c6b8ff";
  return "#7fdcff";
}

export default function PortfolioPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { progress, hydrated: progressReady } = useAdrianProgress();
  const [parentMode, setParentMode] = useState(false);
  const [parentAuthorized, setParentAuthorized] = useState(true);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("parent") === "1";
    setParentMode(requested);
    setParentAuthorized(!requested || window.sessionStorage.getItem("adrianos-parent-unlocked") === "yes");
    const refresh = () => setRevision((value) => value + 1);
    const events = [
      PORTFOLIO_EVENT,
      "adrianos-progress-updated",
      "adrianos-learning-updated",
      "adrianos-family-updated",
      "adrianos-weekly-report-updated",
    ];
    for (const eventName of events) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, refresh);
    };
  }, []);

  const portfolio = useMemo(
    () => profilesReady && progressReady
      ? buildLearningPortfolio(activeProfile, progress, games)
      : null,
    [activeProfile.id, activeProfile.age, progress, profilesReady, progressReady, revision]
  );

  if (!profilesReady || !progressReady || !portfolio) {
    return (
      <main style={page}>
        <section style={heroCard}>
          <span style={eyebrow}>LEARNING PORTFOLIO</span>
          <h1 style={heroTitle}>Gathering the evidence…</h1>
        </section>
      </main>
    );
  }

  if (parentMode && !parentAuthorized) {
    return (
      <main style={page}>
        <section style={{ ...heroCard, maxWidth: 680, textAlign: "center" }}>
          <div style={{ fontSize: 68 }}>🔐</div>
          <span style={eyebrow}>PARENT TRANSCRIPT</span>
          <h1 style={{ ...heroTitle, fontSize: "clamp(3rem,8vw,5rem)" }}>Unlock the Parent Dashboard first.</h1>
          <p style={muted}>The detailed mastery transcript is part of the shared parent session.</p>
          <Link href="/parent" style={primaryLink}>Open Parent Dashboard</Link>
        </section>
      </main>
    );
  }

  const currentPortfolio = portfolio;
  const selectedIds = readPortfolioShowcase(activeProfile.id)
    ?? currentPortfolio.showcase.map((item) => item.id);
  const transcriptBySubject = currentPortfolio.transcript.reduce<Record<string, PortfolioTranscriptRow[]>>(
    (groups, row) => {
      groups[row.subject] = [...(groups[row.subject] ?? []), row];
      return groups;
    },
    {}
  );

  function toggleShowcase(highlight: PortfolioHighlight) {
    togglePortfolioHighlight(
      activeProfile.id,
      highlight.id,
      currentPortfolio.showcase.map((item) => item.id)
    );
    setRevision((value) => value + 1);
    setMessage(selectedIds.includes(highlight.id)
      ? `${highlight.title} was removed from the child showcase.`
      : `${highlight.title} was added to the child showcase.`);
  }

  async function copySummary() {
    const rows = currentPortfolio.transcript
      .map((row) => `${row.subject}: ${row.label} — ${row.stage}, ${row.mastery}% mastery, ${row.attempts} attempts`)
      .join("\n");
    const text = `${activeProfile.name} Learning Portfolio\n${currentPortfolio.summary}\n\n${rows}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Transcript summary copied.");
    } catch {
      setMessage("Copy was blocked by this browser. Use Print transcript instead.");
    }
  }

  return (
    <main style={page} className="portfolio-page">
      <style>{`
        @media print {
          body { background: white !important; color: #111 !important; }
          .portfolio-page { width: 100% !important; padding: 0 !important; color: #111 !important; }
          .portfolio-controls, .portfolio-switcher, .showcase-toggle { display: none !important; }
          .portfolio-print-card { break-inside: avoid; box-shadow: none !important; color: #111 !important; background: white !important; border: 1px solid #bbb !important; }
          .portfolio-print-muted { color: #444 !important; }
        }
      `}</style>

      <header style={topbar} className="portfolio-controls">
        <Link href={parentMode ? "/parent" : "/school"} style={secondaryLink}>
          ← {parentMode ? "Parent Dashboard" : "School"}
        </Link>
        <strong>{parentMode ? "Mastery transcript" : "My learning portfolio"}</strong>
        {parentMode ? (
          <div style={actionRow}>
            <button onClick={() => void copySummary()} style={smallButton} type="button">Copy summary</button>
            <button onClick={() => window.print()} style={printButton} type="button">Print transcript</button>
          </div>
        ) : (
          <Link href="/parent" style={secondaryLink}>Parent access 🔒</Link>
        )}
      </header>

      <div style={profileRow} className="portfolio-switcher">
        {family.profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => switchProfile(profile.id)}
            style={{ ...profileButton, ...(profile.id === activeProfile.id ? profileButtonActive : {}) }}
            type="button"
          >
            <span style={{ fontSize: 30 }}>{profile.emoji}</span>
            <span><strong>{profile.name}</strong><small style={{ display: "block", opacity: .65 }}>Age {profile.age}</small></span>
          </button>
        ))}
      </div>

      <section style={heroCard} className="portfolio-print-card">
        <div style={heroGrid}>
          <div>
            <span style={eyebrow}>{parentMode ? "EVIDENCE-BASED MASTERY TRANSCRIPT" : "MY LEARNING STORY"}</span>
            <h1 style={heroTitle}>{activeProfile.emoji} {activeProfile.name}</h1>
            <p style={muted} className="portfolio-print-muted">{currentPortfolio.summary}</p>
            <small style={{ ...muted, display: "block", marginTop: 12 }} className="portfolio-print-muted">
              Updated {formatDate(currentPortfolio.generatedAt)}
            </small>
          </div>
          <div style={masteryOrb}>
            <strong>{currentPortfolio.masteredSkills}</strong>
            <span>MASTERED</span>
          </div>
        </div>

        <div style={metricGrid}>
          <Metric label="Active skills" value={currentPortfolio.activeSkills} />
          <Metric label="Practicing" value={currentPortfolio.practicingSkills} />
          <Metric label="School days" value={currentPortfolio.completedSessions} />
          <Metric label="Completed work" value={currentPortfolio.totalCompletions} />
          <Metric label="Subjects" value={currentPortfolio.subjectsWithEvidence} />
          <Metric label="Total XP" value={currentPortfolio.totalXp} />
        </div>
      </section>

      {message && <div style={notice} className="portfolio-controls">{message}</div>}

      <section style={section} className="portfolio-print-card">
        <div style={sectionHeader}>
          <div>
            <span style={eyebrow}>{parentMode ? "CHILD SHOWCASE" : "MY PROUDEST MOMENTS"}</span>
            <h2 style={sectionTitle}>{parentMode ? "Choose what the child sees" : "Look what I’ve built"}</h2>
          </div>
          {parentMode && <span style={countPill}>{selectedIds.length}/12 selected</span>}
        </div>

        {currentPortfolio.showcase.length === 0 && !parentMode ? (
          <EmptyPortfolio name={activeProfile.name} />
        ) : (
          <div style={highlightGrid}>
            {(parentMode ? currentPortfolio.highlights : currentPortfolio.showcase).map((highlight) => {
              const selected = selectedIds.includes(highlight.id);
              return (
                <article key={highlight.id} style={{ ...highlightCard, opacity: parentMode && !selected ? .68 : 1 }}>
                  <div style={highlightTop}>
                    <span style={{ fontSize: 38 }}>{highlight.emoji}</span>
                    <span style={kindPill}>{kindLabel(highlight.kind)}</span>
                  </div>
                  <h3 style={highlightTitle}>{highlight.title}</h3>
                  <p style={muted} className="portfolio-print-muted">{highlight.detail}</p>
                  <div style={highlightFooter}>
                    <span>{formatDate(highlight.date)}</span>
                    {highlight.value && <strong>{highlight.value}</strong>}
                  </div>
                  {parentMode && (
                    <button
                      onClick={() => toggleShowcase(highlight)}
                      style={{ ...showcaseButton, background: selected ? "#c6b8ff" : "#222936", color: selected ? "#10131b" : "#fff" }}
                      className="showcase-toggle"
                      type="button"
                    >
                      {selected ? "Remove from showcase" : "Add to showcase"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={section} className="portfolio-print-card">
        <span style={eyebrow}>{parentMode ? "MASTERY TRANSCRIPT" : "SKILLS I’M GROWING"}</span>
        <h2 style={sectionTitle}>{parentMode ? "Skill-by-skill evidence" : "My learning map"}</h2>

        {currentPortfolio.transcript.length === 0 ? (
          <p style={muted} className="portfolio-print-muted">Skill evidence will appear after the first learning activities.</p>
        ) : (
          <div style={subjectList}>
            {Object.entries(transcriptBySubject).map(([subject, rows]) => (
              <article key={subject} style={subjectCard}>
                <div style={subjectHeader}>
                  <h3 style={{ margin: 0 }}>{subject}</h3>
                  <span>{rows.filter((row) => row.stage === "Mastered").length} mastered</span>
                </div>
                <div style={skillList}>
                  {rows.map((row) => (
                    <div key={row.skillId} style={skillRow}>
                      <div style={{ minWidth: 0 }}>
                        <div style={skillLabels}>
                          <strong>{row.label}</strong>
                          <span style={{ color: stageColor(row.stage) }}>{row.stage} · {row.mastery}%</span>
                        </div>
                        <p style={{ ...muted, margin: "4px 0 8px", fontSize: 12 }} className="portfolio-print-muted">{row.description}</p>
                        <div style={track}><div style={{ ...fill, width: `${row.mastery}%`, background: stageColor(row.stage) }} /></div>
                        {parentMode && (
                          <div style={evidenceRow}>
                            <span>{row.attempts} attempts</span>
                            <span>{row.accuracy}% accuracy</span>
                            <span>Last practiced {formatDate(row.lastPracticed)}</span>
                            {row.dueReviews > 0 && <span style={{ color: "#ffb5bf" }}>{row.dueReviews} review{row.dueReviews === 1 ? "" : "s"} due</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {parentMode && (
        <section style={section} className="portfolio-print-card">
          <span style={eyebrow}>RECENT LEARNING HISTORY</span>
          <h2 style={sectionTitle}>Weekly evidence trail</h2>
          {currentPortfolio.recentWeeks.length === 0 ? (
            <p style={muted} className="portfolio-print-muted">Weekly snapshots will appear after the first report is generated.</p>
          ) : (
            <div style={weekList}>
              {currentPortfolio.recentWeeks.map((week) => (
                <article key={week.weekStart} style={weekCard}>
                  <div style={weekHeader}>
                    <strong>{week.weekStart} to {week.weekEnd}</strong>
                    <span>{week.daysActive} active day{week.daysActive === 1 ? "" : "s"}</span>
                  </div>
                  <p style={muted} className="portfolio-print-muted">{week.summary}</p>
                  <div style={weekStats}>
                    <span>{week.completions} completed</span>
                    <span>{week.xp} XP</span>
                    <span>{week.newlyMastered.length} newly mastered</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metric}><small>{label}</small><strong>{value}</strong></div>;
}

function EmptyPortfolio({ name }: { name: string }) {
  return (
    <div style={emptyCard}>
      <div style={{ fontSize: 64 }}>🌱</div>
      <strong>{name}’s portfolio is just beginning.</strong>
      <p style={muted}>Complete a few learning missions and the first proud moments will grow here automatically.</p>
    </div>
  );
}

const page: React.CSSProperties = { width: "min(1180px,calc(100% - 28px))", minHeight: "100vh", margin: "0 auto", padding: "22px 0 70px", color: "#fff" };
const topbar: React.CSSProperties = { minHeight: 64, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const actionRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const secondaryLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", textDecoration: "none", fontWeight: 900 };
const primaryLink: React.CSSProperties = { display: "inline-block", marginTop: 15, padding: "14px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const smallButton: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const printButton: React.CSSProperties = { ...smallButton, border: 0, background: "#d9ff5b", color: "#10131b" };
const profileRow: React.CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", margin: "10px 0 16px" };
const profileButton: React.CSSProperties = { minWidth: 160, display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const heroCard: React.CSSProperties = { padding: "clamp(25px,5vw,52px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.24)", background: "linear-gradient(145deg,rgba(217,255,91,.09),rgba(127,220,255,.07) 50%,#181d28)", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 26, alignItems: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "11px 0 14px", fontSize: "clamp(3.3rem,8vw,6.8rem)", lineHeight: .88, letterSpacing: "-.075em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const masteryOrb: React.CSSProperties = { width: 140, height: 140, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b", boxShadow: "0 20px 55px rgba(217,255,91,.18)" };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9, marginTop: 25 };
const metric: React.CSSProperties = { display: "grid", gap: 4, padding: 13, borderRadius: 17, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.08)" };
const notice: React.CSSProperties = { margin: "14px 0", padding: 13, borderRadius: 16, background: "rgba(198,184,255,.14)", border: "1px solid rgba(198,184,255,.28)", color: "#c6b8ff", fontWeight: 850 };
const section: React.CSSProperties = { marginTop: 18, padding: "clamp(22px,4vw,34px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" };
const sectionTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(2rem,5vw,3.8rem)", letterSpacing: "-.052em" };
const countPill: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 12, fontWeight: 900 };
const highlightGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 };
const highlightCard: React.CSSProperties = { display: "flex", flexDirection: "column", minHeight: 240, padding: 18, borderRadius: 22, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const highlightTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };
const kindPill: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#7fdcff", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const highlightTitle: React.CSSProperties = { margin: "13px 0 4px", fontSize: 23, letterSpacing: "-.035em" };
const highlightFooter: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", color: "#aab1bf", fontSize: 11 };
const showcaseButton: React.CSSProperties = { width: "100%", marginTop: 12, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const emptyCard: React.CSSProperties = { display: "grid", justifyItems: "center", gap: 8, padding: 32, borderRadius: 22, background: "#10131b", textAlign: "center" };
const subjectList: React.CSSProperties = { display: "grid", gap: 12 };
const subjectCard: React.CSSProperties = { padding: 16, borderRadius: 22, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const subjectHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, color: "#aab1bf" };
const skillList: React.CSSProperties = { display: "grid", gap: 9 };
const skillRow: React.CSSProperties = { padding: 13, borderRadius: 16, background: "#222936" };
const skillLabels: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const track: React.CSSProperties = { height: 7, borderRadius: 999, background: "#10131b", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999 };
const evidenceRow: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 9, color: "#aab1bf", fontSize: 11 };
const weekList: React.CSSProperties = { display: "grid", gap: 10 };
const weekCard: React.CSSProperties = { padding: 15, borderRadius: 18, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const weekHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const weekStats: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", color: "#c6b8ff", fontSize: 11, fontWeight: 850 };
