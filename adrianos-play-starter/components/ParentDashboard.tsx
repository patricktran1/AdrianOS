"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import {
  readProgressForProfile,
  type AdrianProgress,
} from "@/lib/adrian-progress";
import {
  exportFamilyBackup,
  importFamilyBackup,
  useFamilyProfiles,
  type ChildProfile,
} from "@/lib/adrian-profiles";

type ProfileReport = {
  profile: ChildProfile;
  progress: AdrianProgress;
  totalPlays: number;
  totalCompletions: number;
  gamesTried: number;
  favoriteSlug: string | null;
};

function totalFor(progress: AdrianProgress, field: "plays" | "completions"): number {
  return Object.values(progress.games).reduce((sum, game) => sum + game[field], 0);
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

export default function ParentDashboard({ games }: { games: Game[] }) {
  const {
    family,
    hydrated,
    updateProfile,
    setParentPin,
    verifyPin,
  } = useFamilyProfiles();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [backupText, setBackupText] = useState("");

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("adrianos-progress-updated", refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener("adrianos-progress-updated", refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  const reports = useMemo<ProfileReport[]>(() => {
    return family.profiles.map((profile) => {
      const progress = readProgressForProfile(profile.id);
      const entries = Object.entries(progress.games);
      const favoriteSlug = [...entries]
        .sort((a, b) => b[1].plays - a[1].plays)
        .find(([, game]) => game.plays > 0)?.[0] ?? null;
      return {
        profile,
        progress,
        totalPlays: totalFor(progress, "plays"),
        totalCompletions: totalFor(progress, "completions"),
        gamesTried: entries.filter(([, game]) => game.plays > 0).length,
        favoriteSlug,
      };
    });
  }, [family.profiles, refreshKey]);

  function unlockDashboard() {
    if (!verifyPin(pin)) {
      setMessage("That PIN did not match.");
      return;
    }
    setUnlocked(true);
    setPin("");
    setMessage("");
  }

  function createPin() {
    if (!/^\d{4,6}$/.test(pin)) {
      setMessage("Use a 4 to 6 digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setMessage("The two PIN entries do not match.");
      return;
    }
    if (!setParentPin(pin)) {
      setMessage("The PIN could not be saved.");
      return;
    }
    setUnlocked(true);
    setPin("");
    setConfirmPin("");
    setMessage("Parent PIN created.");
  }

  function downloadBackup() {
    const backup = exportFamilyBackup();
    const text = JSON.stringify(backup, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adrianos-family-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupText(text);
    setMessage("Family backup downloaded.");
  }

  function importBackup() {
    try {
      const parsed = JSON.parse(backupText);
      if (!importFamilyBackup(parsed)) {
        setMessage("That does not look like a valid AdrianOS backup.");
        return;
      }
      setMessage("Backup restored. Reloading profiles…");
      window.setTimeout(() => window.location.reload(), 400);
    } catch {
      setMessage("The backup text is not valid JSON.");
    }
  }

  if (!hydrated) {
    return <main style={page}><section style={card}>Loading parent dashboard…</section></main>;
  }

  if (!unlocked) {
    const creating = !family.parentPinHash;
    return (
      <main style={page}>
        <section style={{ ...card, width: "min(520px,100%)", margin: "0 auto" }}>
          <Link href="/" style={backLink}>← Back to AdrianOS</Link>
          <div style={{ fontSize: 54, marginTop: 24 }}>🔐</div>
          <span style={eyebrow}>PARENT ACCESS</span>
          <h1 style={lockTitle}>{creating ? "Create a parent PIN" : "Enter parent PIN"}</h1>
          <p style={muted}>
            {creating
              ? "Choose a 4 to 6 digit PIN for reports, profile settings, and backups."
              : "This keeps settings and reports out of the game area."}
          </p>
          <input
            inputMode="numeric"
            type="password"
            value={pin}
            maxLength={6}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            placeholder="PIN"
            style={pinInput}
          />
          {creating && (
            <input
              inputMode="numeric"
              type="password"
              value={confirmPin}
              maxLength={6}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
              placeholder="Confirm PIN"
              style={pinInput}
            />
          )}
          <button onClick={creating ? createPin : unlockDashboard} style={primaryButton}>
            {creating ? "Create PIN" : "Unlock dashboard"}
          </button>
          {message && <p style={{ ...muted, color: "#ffb5bf" }}>{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      <header style={topbar}>
        <div>
          <Link href="/" style={backLink}>← Back to AdrianOS</Link>
          <span style={{ ...eyebrow, display: "block", marginTop: 18 }}>PARENT DASHBOARD</span>
          <h1 style={title}>Learning cockpit</h1>
          <p style={muted}>Private, local reports for Adrian and Elliot.</p>
        </div>
        <button onClick={() => setUnlocked(false)} style={secondaryButton}>Lock dashboard</button>
      </header>

      {message && <div style={notice}>{message}</div>}

      <section style={reportGrid}>
        {reports.map((report) => (
          <ProfileReportCard key={report.profile.id} report={report} games={games} />
        ))}
      </section>

      <section style={card}>
        <span style={eyebrow}>PROFILE SETTINGS</span>
        <h2 style={sectionTitle}>Children</h2>
        <div style={reportGrid}>
          {family.profiles.map((profile) => (
            <ProfileEditor
              key={profile.id}
              profile={profile}
              onSave={(change) => {
                updateProfile(profile.id, change);
                setMessage(`${profile.name}’s profile was updated.`);
              }}
            />
          ))}
        </div>
      </section>

      <section style={{ ...card, marginTop: 18 }}>
        <span style={eyebrow}>DEVICE TRANSFER</span>
        <h2 style={sectionTitle}>Backup and restore</h2>
        <p style={muted}>
          Download one family backup and import it on another device. It contains profiles,
          progress, coins, badges, and avatar purchases. Keep it private.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={downloadBackup} style={primaryButton}>Download family backup</button>
          <button onClick={importBackup} style={secondaryButton}>Restore pasted backup</button>
        </div>
        <textarea
          value={backupText}
          onChange={(event) => setBackupText(event.target.value)}
          placeholder="Paste an AdrianOS family backup here to restore it."
          style={backupArea}
        />
        <p style={{ ...muted, marginBottom: 0 }}>
          Automatic cloud sync is not connected yet. This transfer tool works now without
          sending the children’s data to an outside service.
        </p>
      </section>
    </main>
  );
}

function ProfileReportCard({
  report,
  games,
}: {
  report: ProfileReport;
  games: Game[];
}) {
  const favorite = games.find((game) => game.slug === report.favoriteSlug);
  const subjectRows = useMemo(() => {
    const subjects = new Map<string, { plays: number; completions: number; best: number }>();
    for (const [slug, gameProgress] of Object.entries(report.progress.games)) {
      const game = games.find((item) => item.slug === slug);
      if (!game || gameProgress.plays === 0) continue;
      const row = subjects.get(game.subject) ?? { plays: 0, completions: 0, best: 0 };
      row.plays += gameProgress.plays;
      row.completions += gameProgress.completions;
      row.best = Math.max(row.best, gameProgress.bestScore);
      subjects.set(game.subject, row);
    }
    return [...subjects.entries()].sort((a, b) => b[1].plays - a[1].plays).slice(0, 4);
  }, [games, report.progress.games]);

  const week = lastSevenDays().map((date) => {
    const activity = report.progress.activity.find((item) => item.date === date);
    return activity?.plays ?? 0;
  });
  const maxWeek = Math.max(1, ...week);

  return (
    <article style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={avatar}>{report.profile.emoji}</div>
        <div>
          <span style={eyebrow}>AGE {report.profile.age}</span>
          <h2 style={{ ...sectionTitle, margin: "4px 0" }}>{report.profile.name}</h2>
          <p style={{ ...muted, margin: 0 }}>Level {report.progress.level} · {report.progress.xp} XP</p>
        </div>
      </div>

      <div style={statsGrid}>
        <Metric label="Plays" value={report.totalPlays} />
        <Metric label="Completed" value={report.totalCompletions} />
        <Metric label="Games tried" value={report.gamesTried} />
        <Metric label="Coins" value={report.progress.coins} />
      </div>

      <div style={{ marginTop: 20 }}>
        <strong>Favorite game</strong>
        <p style={muted}>{favorite ? `${favorite.emoji} ${favorite.title}` : "Not enough play data yet."}</p>
      </div>

      <strong>Activity-based strengths</strong>
      {subjectRows.length === 0 ? (
        <p style={muted}>Strength patterns will appear after a few games.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {subjectRows.map(([subject, row]) => (
            <div key={subject} style={subjectRow}>
              <span>{subject}</span>
              <span>{row.plays} plays · {row.completions} completed</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <strong>Last seven days</strong>
        <div style={miniChart}>
          {week.map((value, index) => (
            <div key={index} style={{ ...miniBar, height: `${Math.max(6, value / maxWeek * 100)}%` }} />
          ))}
        </div>
      </div>
    </article>
  );
}

function ProfileEditor({
  profile,
  onSave,
}: {
  profile: ChildProfile;
  onSave: (change: Partial<Pick<ChildProfile, "name" | "age" | "emoji">>) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(String(profile.age));
  const [emoji, setEmoji] = useState(profile.emoji);

  useEffect(() => {
    setName(profile.name);
    setAge(String(profile.age));
    setEmoji(profile.emoji);
  }, [profile]);

  return (
    <div style={editorCard}>
      <input value={emoji} onChange={(event) => setEmoji(event.target.value)} style={emojiInput} aria-label="Profile emoji" />
      <input value={name} onChange={(event) => setName(event.target.value)} style={textInput} aria-label="Child name" />
      <input inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value.replace(/\D/g, ""))} style={ageInput} aria-label="Child age" />
      <button
        onClick={() => onSave({ name, age: Number(age), emoji })}
        style={secondaryButton}
      >
        Save
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metric}><small>{label}</small><strong>{value}</strong></div>;
}

const page: React.CSSProperties = { width: "min(1180px,calc(100% - 28px))", margin: "0 auto", padding: "28px 0 60px", minHeight: "100vh" };
const topbar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 24 };
const title: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .9, letterSpacing: "-.07em" };
const lockTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.3rem,7vw,4rem)", lineHeight: .95, letterSpacing: "-.055em" };
const sectionTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(1.7rem,4vw,2.8rem)", letterSpacing: "-.045em" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, fontSize: 12, letterSpacing: ".16em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const backLink: React.CSSProperties = { display: "inline-block", padding: "10px 13px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", fontWeight: 900 };
const card: React.CSSProperties = { padding: "clamp(22px,4vw,32px)", borderRadius: 28, border: "1px solid rgba(255,255,255,.11)", background: "#181d28", boxShadow: "0 26px 60px rgba(0,0,0,.25)" };
const reportGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 18, marginBottom: 18 };
const avatar: React.CSSProperties = { width: 76, height: 76, display: "grid", placeItems: "center", borderRadius: 22, background: "#d9ff5b", fontSize: 40 };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 20 };
const metric: React.CSSProperties = { display: "grid", gap: 5, padding: 14, borderRadius: 17, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const subjectRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 14, background: "#222936", color: "#aab1bf", fontSize: 13, fontWeight: 800 };
const miniChart: React.CSSProperties = { height: 90, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, alignItems: "end", marginTop: 12 };
const miniBar: React.CSSProperties = { minHeight: 6, borderRadius: "7px 7px 2px 2px", background: "#d9ff5b" };
const editorCard: React.CSSProperties = { display: "grid", gridTemplateColumns: "66px 1fr 80px auto", gap: 9, alignItems: "center", padding: 14, borderRadius: 18, background: "#222936" };
const textInput: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 13, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontWeight: 850 };
const ageInput: React.CSSProperties = { ...textInput, textAlign: "center" };
const emojiInput: React.CSSProperties = { ...textInput, textAlign: "center", fontSize: 24 };
const pinInput: React.CSSProperties = { ...textInput, marginTop: 10, fontSize: 24, letterSpacing: ".28em", textAlign: "center" };
const primaryButton: React.CSSProperties = { marginTop: 14, padding: "13px 18px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const notice: React.CSSProperties = { marginBottom: 16, padding: "12px 15px", borderRadius: 15, background: "rgba(198,184,255,.14)", border: "1px solid rgba(198,184,255,.3)", fontWeight: 850 };
const backupArea: React.CSSProperties = { width: "100%", minHeight: 180, resize: "vertical", padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,.12)", background: "#10131b", color: "#fff", fontFamily: "monospace", fontSize: 12 };
