"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { gradeLabel, readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  QUEST_WORLDS,
  questWorldSummary,
  standardsQuestsForGrade,
} from "@/lib/adrian-quest-system";

export default function QuestWorldsBridge() {
  const pathname = usePathname();
  const { activeProfile, hydrated } = useFamilyProfiles();
  const grade = hydrated ? readProfileGrade(activeProfile) : 2;
  const quests = useMemo(
    () => hydrated ? standardsQuestsForGrade(activeProfile.id, grade) : [],
    [activeProfile.id, grade, hydrated],
  );

  if (pathname !== "/school" || !hydrated || quests.length === 0) return null;

  const mastered = quests.filter((quest) => quest.mastered).length;
  const next = quests
    .filter((quest) => !quest.mastered)
    .sort((a, b) => a.mastery - b.mastery)[0] ?? quests[0];

  return (
    <section style={card} aria-label="Curriculum quest worlds">
      <div style={header}>
        <div>
          <span style={eyebrow}>GRADE-LEVEL QUEST MAP</span>
          <h2 style={title}>{gradeLabel(grade)} has three worlds to conquer.</h2>
          <p style={muted}>Each world turns priority standards into visible quests, mastery treasure, and crowns.</p>
        </div>
        <div style={starBadge}><strong>{mastered}/{quests.length}</strong><span>STARS</span></div>
      </div>

      <div style={worldGrid}>
        {QUEST_WORLDS.map((world) => {
          const summary = questWorldSummary(quests, world.id);
          return (
            <div key={world.id} style={{ ...worldCard, ...(summary.complete ? completeWorld : {}) }}>
              <span style={worldEmoji}>{summary.complete ? "👑" : world.emoji}</span>
              <strong>{world.title}</strong>
              <small>{summary.mastered}/{summary.rows.length} quests · {summary.mastery}%</small>
              <div style={track}><div style={{ ...fill, width: `${summary.mastery}%` }} /></div>
            </div>
          );
        })}
      </div>

      <div style={actions}>
        <div>
          <small style={nextLabel}>NEXT QUEST · {next.code}</small>
          <strong style={{ display: "block", marginTop: 4 }}>{next.title}</strong>
        </div>
        <div style={linkStack}>
          <Link href={next.practiceHref} style={primaryLink}>Play next quest →</Link>
          <Link href="/quests" style={secondaryLink}>Open all quest worlds</Link>
        </div>
      </div>
    </section>
  );
}

const card: React.CSSProperties = { width: "min(1040px,calc(100% - 36px))", margin: "16px auto 90px", padding: "clamp(21px,4vw,32px)", borderRadius: 30, background: "linear-gradient(145deg,rgba(198,184,255,.1),rgba(217,255,91,.06),#181d28)", border: "1px solid rgba(198,184,255,.28)", color: "#fff" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#c6b8ff", fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 8px", fontSize: "clamp(2rem,5vw,3.7rem)", lineHeight: .95, letterSpacing: "-.055em" };
const muted: React.CSSProperties = { maxWidth: 700, margin: 0, color: "#aab1bf", lineHeight: 1.5, fontWeight: 700 };
const starBadge: React.CSSProperties = { minWidth: 112, padding: 15, borderRadius: 22, display: "grid", placeItems: "center", background: "#c6b8ff", color: "#10131b" };
const worldGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 9, marginTop: 22 };
const worldCard: React.CSSProperties = { minWidth: 0, display: "grid", gap: 6, padding: 14, borderRadius: 18, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const completeWorld: React.CSSProperties = { borderColor: "rgba(217,255,91,.35)", background: "rgba(217,255,91,.06)" };
const worldEmoji: React.CSSProperties = { fontSize: 30 };
const track: React.CSSProperties = { height: 7, borderRadius: 999, background: "#222936", overflow: "hidden" };
const fill: React.CSSProperties = { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#7fdcff,#c6b8ff,#d9ff5b)" };
const actions: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 18, alignItems: "center", marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.08)" };
const nextLabel: React.CSSProperties = { color: "#d9ff5b", fontWeight: 950, letterSpacing: ".12em" };
const linkStack: React.CSSProperties = { display: "grid", gap: 8 };
const primaryLink: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
const secondaryLink: React.CSSProperties = { padding: "11px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", textDecoration: "none", textAlign: "center", fontWeight: 900 };
