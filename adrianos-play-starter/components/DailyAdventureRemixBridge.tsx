"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { readDailyRemixState, REMIX_THEMES } from "@/lib/daily-adventure-remix";

export default function DailyAdventureRemixBridge() {
  const pathname = usePathname();
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { progress, hydrated: progressHydrated } = useAdrianProgress();
  if (pathname !== "/school" || !hydrated || !progressHydrated) return null;

  const grade = readProfileGrade(activeProfile);
  if (grade === -1) return null;
  const theme = REMIX_THEMES[grade];
  const daily = readDailyRemixState(activeProfile.id);
  void progress;

  return (
    <section style={card} aria-label="Daily adventure remix">
      <div style={visual} aria-hidden="true">{theme.emoji}🎮</div>
      <div style={copy}>
        <span style={{ ...eyebrow, color: theme.accent }}>TODAY’S FIVE-GATE REMIX</span>
        <h2 style={title}>{theme.title}</h2>
        <p style={description}>{theme.description} Tomorrow brings a different mission order.</p>
        <div style={chips}>
          <span style={chip}>🔥 {daily.streak} day streak</span>
          <span style={chip}>🎲 Daily rotation</span>
          <span style={chip}>💎 One treasure claim</span>
        </div>
      </div>
      <div style={actions}>
        {daily.completedToday && <span style={complete}>✓ Today’s remix cleared</span>}
        <Link href="/games/daily-adventure-remix" style={{ ...button, background: theme.accent }}>
          {daily.completedToday ? "Replay today’s route →" : "Play today’s remix →"}
        </Link>
      </div>
    </section>
  );
}

const card: React.CSSProperties = { width: "min(1040px,calc(100% - 36px))", margin: "16px auto", padding: "clamp(20px,4vw,30px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 20, alignItems: "center", borderRadius: 30, background: "linear-gradient(135deg,rgba(255,155,210,.1),rgba(127,220,255,.08),#181d28 72%)", border: "1px solid rgba(255,255,255,.14)", color: "#fff", overflow: "hidden" };
const visual: React.CSSProperties = { justifySelf: "center", fontSize: "clamp(4rem,10vw,7rem)", filter: "drop-shadow(0 14px 25px rgba(0,0,0,.3))" };
const copy: React.CSSProperties = { minWidth: 0 };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 8px", fontSize: "clamp(2rem,5vw,3.5rem)", lineHeight: .93, letterSpacing: "-.055em" };
const description: React.CSSProperties = { margin: 0, color: "#c1c8d3", lineHeight: 1.5, fontWeight: 700 };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 };
const chip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#10131b", color: "#aab1bf", fontSize: 11, fontWeight: 850 };
const actions: React.CSSProperties = { display: "grid", gap: 9, minWidth: 0 };
const complete: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "rgba(217,255,91,.1)", border: "1px solid rgba(217,255,91,.25)", color: "#d9ff5b", textAlign: "center", fontSize: 12, fontWeight: 950 };
const button: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
