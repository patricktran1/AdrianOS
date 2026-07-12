"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useAdrianProgress } from "@/lib/adrian-progress";

const FEATURED_BY_GRADE: Record<number, {
  eyebrow: string;
  title: string;
  description: string;
  emoji: string;
  href: string;
  slug: string;
  mechanics: string[];
}> = {
  2: {
    eyebrow: "GRADE 2 FEATURED ADVENTURE",
    title: "Dino Time Rescue",
    description: "Choose a dinosaur sidekick, cross three story worlds, beat boss gates, build a combo, and rescue the timeline with Grade 2 math, reading, and science.",
    emoji: "🌀🦖",
    href: "/games/dino-time-rescue",
    slug: "dino-time-rescue",
    mechanics: ["3 worlds", "Boss gates", "Clues + retries", "Fossil combos"],
  },
};

export default function GradeGameSpotlightBridge() {
  const pathname = usePathname();
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { progress, ready } = useAdrianProgress();
  if (pathname !== "/school" || !hydrated || !ready) return null;

  const grade = readProfileGrade(activeProfile);
  const featured = FEATURED_BY_GRADE[grade];
  if (!featured) return null;

  const game = progress.games[featured.slug];
  const completed = (game?.completions ?? 0) > 0;

  return (
    <section style={card} aria-label="Featured grade adventure">
      <div style={visual} aria-hidden="true">{featured.emoji}</div>
      <div style={copy}>
        <span style={eyebrow}>{featured.eyebrow}</span>
        <h2 style={title}>{featured.title}</h2>
        <p style={description}>{featured.description}</p>
        <div style={mechanics}>
          {featured.mechanics.map((mechanic) => <span key={mechanic} style={mechanicChip}>{mechanic}</span>)}
        </div>
      </div>
      <div style={actionStack}>
        {completed && <span style={completedBadge}>✓ Timeline rescued</span>}
        <Link href={featured.href} style={playButton}>{completed ? "Replay the adventure →" : "Start the rescue →"}</Link>
      </div>
    </section>
  );
}

const card: React.CSSProperties = { width: "min(1040px,calc(100% - 36px))", margin: "16px auto", padding: "clamp(20px,4vw,32px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 22, alignItems: "center", borderRadius: 30, background: "linear-gradient(135deg,rgba(127,220,255,.13),rgba(217,255,91,.08),#181d28 72%)", border: "1px solid rgba(127,220,255,.3)", color: "#fff", overflow: "hidden" };
const visual: React.CSSProperties = { justifySelf: "center", fontSize: "clamp(4rem,10vw,7rem)", filter: "drop-shadow(0 14px 25px rgba(0,0,0,.3))" };
const copy: React.CSSProperties = { minWidth: 0 };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 10, fontWeight: 950, letterSpacing: ".15em" };
const title: React.CSSProperties = { margin: "7px 0 8px", fontSize: "clamp(2rem,5vw,3.6rem)", lineHeight: .92, letterSpacing: "-.055em" };
const description: React.CSSProperties = { margin: 0, color: "#c1c8d3", lineHeight: 1.5, fontWeight: 700 };
const mechanics: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 };
const mechanicChip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#10131b", color: "#aab1bf", fontSize: 11, fontWeight: 850 };
const actionStack: React.CSSProperties = { display: "grid", gap: 9, minWidth: 0 };
const completedBadge: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "rgba(217,255,91,.1)", border: "1px solid rgba(217,255,91,.25)", color: "#d9ff5b", textAlign: "center", fontSize: 12, fontWeight: 950 };
const playButton: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", textAlign: "center", fontWeight: 950 };
