"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { type ElementaryGrade, elementaryGradeLabel } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { storyPackForGrade } from "@/lib/adrian-story-expedition";

export default function StoryExpeditionBridge() {
  const pathname = usePathname();
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { progress, hydrated: progressHydrated } = useAdrianProgress();
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setGrade(readProfileGrade(activeProfile));
  }, [activeProfile, hydrated]);

  if (pathname !== "/school" || !hydrated || !progressHydrated || grade === null) return null;
  const pack = storyPackForGrade(grade);
  const game = progress.games["story-expedition"];
  const completed = (game?.completions ?? 0) > 0;

  return (
    <section style={{ ...card, background: pack.backdrop }} aria-label="Grade reading expedition">
      <div style={visual} aria-hidden="true">{pack.emoji}</div>
      <div style={copy}>
        <span style={{ ...eyebrow, color: pack.accent }}>{elementaryGradeLabel(grade).toUpperCase()} READING WORLD</span>
        <h2 style={title}>{pack.title}</h2>
        <p style={description}>{pack.description}</p>
        <div style={chips}>
          <span style={chip}>📖 4 branching chapters</span>
          <span style={chip}>🔎 Text evidence</span>
          <span style={chip}>🎗️ Optional echo reading</span>
        </div>
      </div>
      <div style={actions}>
        {completed && <span style={complete}>✓ Expedition cleared {game?.completions ?? 0} time{(game?.completions ?? 0) === 1 ? "" : "s"}</span>}
        <Link href="/games/story-expedition" style={{ ...button, background: pack.accent }}>
          {completed ? "Create a new story trail →" : "Enter the story portal →"}
        </Link>
      </div>
    </section>
  );
}

const card: React.CSSProperties = { width: "min(1040px,calc(100% - 36px))", margin: "16px auto", padding: "clamp(20px,4vw,30px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 20, alignItems: "center", borderRadius: 30, border: "1px solid rgba(255,255,255,.14)", color: "#fff", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.25)" };
const visual: React.CSSProperties = { justifySelf: "center", fontSize: "clamp(4rem,10vw,7rem)", filter: "drop-shadow(0 14px 25px rgba(0,0,0,.3))" };
const copy: React.CSSProperties = { minWidth: 0 };
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 8px", fontSize: "clamp(2rem,5vw,3.5rem)", lineHeight: .93, letterSpacing: "-.055em" };
const description: React.CSSProperties = { margin: 0, color: "#c1c8d3", lineHeight: 1.5, fontWeight: 700 };
const chips: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 };
const chip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "rgba(16,19,27,.72)", color: "#c3cad4", fontSize: 11, fontWeight: 850 };
const actions: React.CSSProperties = { display: "grid", gap: 9, minWidth: 0 };
const complete: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "rgba(217,255,91,.1)", border: "1px solid rgba(217,255,91,.25)", color: "#d9ff5b", textAlign: "center", fontSize: 12, fontWeight: 950 };
const button: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
