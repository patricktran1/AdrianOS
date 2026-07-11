"use client";

import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { useFamilyProfiles, verifyParentPin } from "@/lib/adrian-profiles";
import {
  buildWeeklyReport,
  readWeeklyReports,
  refreshWeeklyReport,
  WEEKLY_REPORT_EVENT,
  type WeeklyReport,
} from "@/lib/adrian-weekly-report";

const SESSION_KEY = "adrianos-weekly-report-unlocked";

function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, Math.max(0, month - 1), day || 1, 12, 0, 0, 0);
  return date.toLocaleDateString(undefined, options ?? { month: "short", day: "numeric" });
}

function weekLabel(report: WeeklyReport): string {
  return `${formatDate(report.weekStart)} – ${formatDate(report.weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;
}

function skillName(report: WeeklyReport, skillId: string | null): string {
  if (!skillId) return "Open exploration";
  return report.masterySnapshot[skillId]?.label ?? skillId;
}

function gameName(games: Game[], slug: string): string {
  return games.find((game) => game.slug === slug)?.title ?? slug.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function reportText(profileName: string, report: WeeklyReport): string {
  const wins = report.wins.map((item) => `• ${item}`).join("\n");
  const watch = report.watchItems.map((item) => `• ${item}`).join("\n");
  return `${profileName}’s AdrianOS weekly report\n${weekLabel(report)}\n\n${report.summary}\n\nWins\n${wins}\n\nKeep an eye on\n${watch}\n\nNext focus: ${skillName(report, report.nextFocusSkillId)} for about ${report.recommendedMinutes} minutes per learning day.`;
}

export default function WeeklyReportPanel({ games }: { games: Game[] }) {
  const { family, hydrated } = useFamilyProfiles();
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [profileId, setProfileId] = useState("adrian");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem(SESSION_KEY) === "yes");
    const refresh = () => setRevision((value) => value + 1);
    const events = [
      WEEKLY_REPORT_EVENT,
      "adrianos-progress-updated",
      "adrianos-learning-updated",
      "adrianos-coach-updated",
      "adrianos-placement-updated",
      "adrianos-family-updated",
    ];
    for (const eventName of events) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, refresh);
    };
  }, []);

  useEffect(() => {
    if (family.profiles.length > 0 && !family.profiles.some((profile) => profile.id === profileId)) {
      setProfileId(family.profiles[0].id);
    }
  }, [family.profiles, profileId]);

  const profile = family.profiles.find((item) => item.id === profileId) ?? family.profiles[0];
  const progress = profile ? readProgressForProfile(profile.id) : readProgressForProfile("adrian");
  const liveReport = useMemo(
    () => profile ? buildWeeklyReport(profile, progress, games) : null,
    [profile?.id, profile?.age, progress, games, revision]
  );
  const storedReports = useMemo(
    () => profile ? readWeeklyReports(profile.id) : [],
    [profile?.id, revision]
  );
  const reports = useMemo(() => {
    const byWeek = new Map<string, WeeklyReport>();
    if (liveReport) byWeek.set(liveReport.weekStart, liveReport);
    for (const report of storedReports) if (!byWeek.has(report.weekStart)) byWeek.set(report.weekStart, report);
    return [...byWeek.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 8);
  }, [liveReport, storedReports]);
  const report = reports.find((item) => item.weekStart === selectedWeek) ?? reports[0] ?? liveReport;

  useEffect(() => {
    if (!selectedWeek && reports[0]) setSelectedWeek(reports[0].weekStart);
    if (selectedWeek && !reports.some((item) => item.weekStart === selectedWeek) && reports[0]) {
      setSelectedWeek(reports[0].weekStart);
    }
  }, [reports, selectedWeek]);

  function unlock() {
    if (!verifyParentPin(pin)) {
      setMessage("That PIN did not match.");
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, "yes");
    setUnlocked(true);
    setPin("");
    setMessage("");
    if (profile && liveReport) refreshWeeklyReport(profile, progress, games);
  }

  function refreshReport() {
    if (!profile) return;
    const next = refreshWeeklyReport(profile, readProgressForProfile(profile.id), games);
    setSelectedWeek(next.weekStart);
    setRevision((value) => value + 1);
    setMessage("Weekly report refreshed.");
  }

  async function copyReport() {
    if (!profile || !report) return;
    try {
      await navigator.clipboard.writeText(reportText(profile.name, report));
      setMessage("Weekly summary copied.");
    } catch {
      setMessage("Copy was blocked by this browser.");
    }
  }

  if (!hydrated) return null;

  const checksAccuracy = report && report.coachChecks > 0
    ? Math.round((report.coachChecksCorrect / report.coachChecks) * 100)
    : 0;
  const positiveChanges = report?.masteryChanges.filter((change) => change.delta > 0).slice(0, 5) ?? [];
  const playDelta = report ? report.plays - report.previousPlays : 0;

  return (
    <aside style={shell}>
      <button onClick={() => setOpen((value) => !value)} style={toggleButton} type="button">
        <span>📅</span>
        <span>Weekly report</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={header}>
            <div>
              <span style={eyebrow}>PARENT WEEKLY BRIEF</span>
              <h2 style={title}>Learning week in review</h2>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close weekly report">×</button>
          </div>

          {!unlocked ? (
            <div style={lockBox}>
              <p style={muted}>Enter the parent PIN to view weekly learning patterns and recommendations.</p>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                maxLength={6}
                inputMode="numeric"
                type="password"
                placeholder="Parent PIN"
                style={pinInput}
              />
              <button onClick={unlock} style={primaryButton} type="button">Unlock weekly report</button>
              {message && <p style={errorText}>{message}</p>}
            </div>
          ) : (
            <>
              <div style={profileTabs}>
                {family.profiles.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      setProfileId(child.id);
                      setSelectedWeek(null);
                      setMessage("");
                    }}
                    style={{
                      ...profileButton,
                      background: profileId === child.id ? "#d9ff5b" : "#222936",
                      color: profileId === child.id ? "#10131b" : "#fff",
                    }}
                    type="button"
                  >
                    {child.emoji} {child.name}
                  </button>
                ))}
              </div>

              {reports.length > 1 && (
                <div style={weekTabs}>
                  {reports.map((item) => (
                    <button
                      key={item.weekStart}
                      onClick={() => setSelectedWeek(item.weekStart)}
                      style={{
                        ...weekButton,
                        background: report?.weekStart === item.weekStart ? "#c6b8ff" : "#10131b",
                        color: report?.weekStart === item.weekStart ? "#10131b" : "#fff",
                      }}
                      type="button"
                    >
                      Week of {formatDate(item.weekStart)}
                    </button>
                  ))}
                </div>
              )}

              {message && <div style={notice}>{message}</div>}

              {!report ? (
                <div style={emptyCard}>No weekly report is available yet.</div>
              ) : (
                <>
                  <div style={reportHeading}>
                    <div>
                      <span style={eyebrow}>{weekLabel(report).toUpperCase()}</span>
                      <h3 style={profileTitle}>{profile?.name ?? "Child"}’s week</h3>
                    </div>
                    <div style={actions}>
                      <button onClick={refreshReport} style={smallButton} type="button">Refresh</button>
                      <button onClick={copyReport} style={smallButton} type="button">Copy summary</button>
                    </div>
                  </div>

                  <p style={summaryText}>{report.summary}</p>

                  <div style={metricGrid}>
                    <Metric label="Active days" value={String(report.daysActive)} />
                    <Metric label="Missions" value={String(report.completions)} />
                    <Metric label="XP earned" value={String(report.xp)} />
                    <Metric label="Reviews due" value={String(report.reviewsDue)} />
                  </div>

                  <div style={trendCard}>
                    <strong>Week-over-week activity</strong>
                    <span style={{ color: playDelta > 0 ? "#d9ff5b" : playDelta < 0 ? "#ffb5bf" : "#aab1bf" }}>
                      {report.previousPlays === 0
                        ? "Baseline comparison week"
                        : playDelta > 0
                          ? `+${playDelta} plays`
                          : playDelta < 0
                            ? `${playDelta} plays`
                            : "No change"}
                    </span>
                  </div>

                  <div style={twoColumn}>
                    <ReportList title="Wins" items={report.wins} accent="#d9ff5b" />
                    <ReportList title="Keep an eye on" items={report.watchItems} accent="#ffcf70" />
                  </div>

                  <section style={sectionCard}>
                    <div style={sectionHeader}>
                      <strong>Mastery movement</strong>
                      <small style={muted}>{report.skillsPracticed.length} skill{report.skillsPracticed.length === 1 ? "" : "s"} practiced</small>
                    </div>
                    {positiveChanges.length === 0 ? (
                      <p style={muted}>This is a baseline week, or no skill changed enough to register yet.</p>
                    ) : (
                      <div style={changeList}>
                        {positiveChanges.map((change) => (
                          <div key={change.skillId} style={changeRow}>
                            <div>
                              <strong>{change.label}</strong>
                              <small style={small}>{change.subject} · now {change.mastery}%</small>
                            </div>
                            <span style={gainPill}>+{change.delta}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section style={sectionCard}>
                    <strong>Coach Mode this week</strong>
                    <div style={coachGrid}>
                      <Metric label="Sessions" value={String(report.coachSessions)} compact />
                      <Metric label="Hints" value={String(report.coachHints)} compact />
                      <Metric label="Check accuracy" value={`${checksAccuracy}%`} compact />
                      <Metric label="Helpful votes" value={String(report.coachHelpful)} compact />
                    </div>
                  </section>

                  <section style={nextCard}>
                    <span style={eyebrow}>NEXT WEEK’S FOCUS</span>
                    <strong style={{ fontSize: 24 }}>{skillName(report, report.nextFocusSkillId)}</strong>
                    <p style={{ ...muted, margin: 0 }}>
                      Aim for about {report.recommendedMinutes} minutes per learning day. {report.activeGoals} active goal{report.activeGoals === 1 ? "" : "s"}; {report.completedGoals} completed.
                    </p>
                  </section>

                  {report.activeGameSlugs.length > 0 && (
                    <div style={playedRow}>
                      <strong>Played:</strong>
                      {report.activeGameSlugs.map((slug) => <span key={slug} style={chip}>{gameName(games, slug)}</span>)}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={{ ...metric, padding: compact ? 10 : 12 }}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ReportList({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div style={listCard}>
      <strong style={{ color: accent }}>{title}</strong>
      <div style={bulletList}>
        {items.map((item, index) => <p key={`${title}-${index}`} style={bullet}>• {item}</p>)}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = { position: "fixed", left: 16, bottom: 78, zIndex: 107, display: "grid", justifyItems: "start", gap: 10 };
const toggleButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(198,184,255,.32)", background: "#181d28", color: "#fff", boxShadow: "0 15px 40px rgba(0,0,0,.35)", fontWeight: 900, cursor: "pointer" };
const panel: React.CSSProperties = { width: "min(700px,calc(100vw - 32px))", maxHeight: "78vh", overflowY: "auto", padding: 20, borderRadius: 24, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", boxShadow: "0 24px 70px rgba(0,0,0,.5)" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { color: "#c6b8ff", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 28, letterSpacing: "-.04em" };
const profileTitle: React.CSSProperties = { margin: "5px 0 0", fontSize: 30, letterSpacing: "-.045em" };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const lockBox: React.CSSProperties = { marginTop: 16, padding: 15, borderRadius: 17, background: "#222936" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5, fontSize: 13 };
const pinInput: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 850, letterSpacing: ".18em", textAlign: "center" };
const primaryButton: React.CSSProperties = { width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const errorText: React.CSSProperties = { color: "#ffb5bf", fontSize: 13, fontWeight: 850 };
const profileTabs: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 };
const profileButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const weekTabs: React.CSSProperties = { display: "flex", gap: 7, overflowX: "auto", marginTop: 12, paddingBottom: 3 };
const weekButton: React.CSSProperties = { flex: "0 0 auto", padding: "8px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.1)", fontWeight: 850, fontSize: 11, cursor: "pointer" };
const notice: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 13, background: "rgba(198,184,255,.13)", color: "#c6b8ff", fontSize: 12, fontWeight: 850 };
const emptyCard: React.CSSProperties = { marginTop: 16, padding: 22, borderRadius: 18, background: "#222936", color: "#aab1bf", textAlign: "center" };
const reportHeading: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 18 };
const actions: React.CSSProperties = { display: "flex", gap: 7, flexWrap: "wrap" };
const smallButton: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" };
const summaryText: React.CSSProperties = { margin: "14px 0", padding: 15, borderRadius: 17, background: "rgba(198,184,255,.08)", border: "1px solid rgba(198,184,255,.18)", color: "#e7e9ef", lineHeight: 1.6 };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 };
const metric: React.CSSProperties = { display: "grid", gap: 4, borderRadius: 15, background: "#222936" };
const trendCard: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10, padding: 13, borderRadius: 15, background: "#10131b", border: "1px solid rgba(255,255,255,.07)" };
const twoColumn: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginTop: 10 };
const listCard: React.CSSProperties = { padding: 15, borderRadius: 18, background: "#10131b", border: "1px solid rgba(255,255,255,.07)" };
const bulletList: React.CSSProperties = { display: "grid", gap: 7, marginTop: 10 };
const bullet: React.CSSProperties = { margin: 0, color: "#d7dae2", fontSize: 13, lineHeight: 1.45 };
const sectionCard: React.CSSProperties = { marginTop: 10, padding: 15, borderRadius: 18, background: "#222936" };
const sectionHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const changeList: React.CSSProperties = { display: "grid", gap: 8, marginTop: 10 };
const changeRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 11, borderRadius: 14, background: "#10131b" };
const small: React.CSSProperties = { display: "block", marginTop: 3, color: "#aab1bf", fontSize: 11 };
const gainPill: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontSize: 11, fontWeight: 950 };
const coachGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 10 };
const nextCard: React.CSSProperties = { display: "grid", gap: 7, marginTop: 10, padding: 16, borderRadius: 18, background: "rgba(217,255,91,.08)", border: "1px solid rgba(217,255,91,.22)" };
const playedRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 10, color: "#aab1bf", fontSize: 12 };
const chip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 11, fontWeight: 900 };
