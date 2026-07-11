"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  skillHref,
  useSkillGraph,
  type SkillNode,
} from "@/lib/adrian-skill-graph";
import type { Game } from "@/lib/games";

function stageColor(node: SkillNode): string {
  if (node.locked) return "#5d6573";
  if (node.stage === "Mastered") return "#d9ff5b";
  if (node.stage === "Practicing") return "#c6b8ff";
  return "#7fdcff";
}

export default function SkillMap({ games }: { games: Game[] }) {
  const { progress, hydrated } = useAdrianProgress();
  const { activeProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { nodes, recommended } = useSkillGraph(activeProfile, progress);
  const subjects = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.subject))),
    [nodes]
  );
  const [subject, setSubject] = useState<string>("");

  useEffect(() => {
    if (recommended?.subject) {
      setSubject(recommended.subject);
      return;
    }
    if (subjects.length > 0 && !subjects.includes(subject as never)) {
      setSubject(subjects[0]);
    }
  }, [activeProfile.id, recommended?.subject, subjects]);

  if (!hydrated || !profilesReady) return null;

  const visible = nodes
    .filter((node) => node.subject === subject)
    .sort((a, b) => a.order - b.order);

  return (
    <section style={shell}>
      <div style={header}>
        <div>
          <span className="eyebrow">SKILL GRAPH</span>
          <h2 style={title}>{activeProfile.name}’s learning map</h2>
          <p style={muted}>
            Each skill unlocks the next step. Practice raises mastery, while missed questions return for review.
          </p>
        </div>
        {recommended && (
          <Link href={skillHref(recommended)} style={nextButton}>
            <small style={{ display: "block", opacity: 0.72 }}>BEST NEXT STEP</small>
            {recommended.label} →
          </Link>
        )}
      </div>

      <div style={tabs} aria-label="Choose a skill subject">
        {subjects.map((item) => (
          <button
            key={item}
            onClick={() => setSubject(item)}
            style={{
              ...tab,
              background: subject === item ? "#d9ff5b" : "#222936",
              color: subject === item ? "#10131b" : "#fff",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div style={path}>
        {visible.map((node, index) => {
          const game = games.find((item) => item.slug === node.gameSlug);
          const isRecommended = recommended?.id === node.id;
          const card = (
            <article
              style={{
                ...nodeCard,
                opacity: node.locked ? 0.58 : 1,
                borderColor: isRecommended
                  ? "rgba(217,255,91,.72)"
                  : "rgba(255,255,255,.1)",
              }}
            >
              <div style={nodeTop}>
                <span style={{ ...nodeOrb, background: stageColor(node) }}>
                  {node.locked ? "🔒" : node.stage === "Mastered" ? "✓" : index + 1}
                </span>
                <span style={stagePill}>
                  {node.locked ? "LOCKED" : node.stage.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 36 }}>{game?.emoji ?? "⭐"}</div>
              <h3 style={nodeTitle}>{node.label}</h3>
              <p style={{ ...muted, margin: 0 }}>{node.description}</p>
              <div style={masteryTrack}>
                <div
                  style={{
                    ...masteryFill,
                    width: `${node.mastery}%`,
                    background: stageColor(node),
                  }}
                />
              </div>
              <div style={nodeFooter}>
                <span>{node.mastery}% mastery</span>
                {node.goal && !node.goalComplete && <strong>PARENT GOAL</strong>}
                {node.dueReviews > 0 && <strong>{node.dueReviews} REVIEW</strong>}
              </div>
            </article>
          );

          return (
            <div key={node.id} style={pathStep}>
              {node.locked ? card : (
                <Link href={skillHref(node)} style={{ textDecoration: "none", color: "inherit" }}>
                  {card}
                </Link>
              )}
              {index < visible.length - 1 && <div style={connector}>→</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const shell: React.CSSProperties = {
  marginTop: 42,
  padding: "clamp(22px,4vw,34px)",
  borderRadius: 32,
  border: "1px solid rgba(127,220,255,.22)",
  background: "linear-gradient(145deg,rgba(127,220,255,.07),#181d28 58%)",
  boxShadow: "0 26px 65px rgba(0,0,0,.24)",
};
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" };
const title: React.CSSProperties = { margin: "8px 0", fontSize: "clamp(2rem,5vw,4rem)", lineHeight: .96, letterSpacing: "-.055em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5, maxWidth: 720 };
const nextButton: React.CSSProperties = { padding: "13px 17px", borderRadius: 18, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none", boxShadow: "0 12px 32px rgba(217,255,91,.14)" };
const tabs: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, margin: "22px 0" };
const tab: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const path: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18, alignItems: "stretch" };
const pathStep: React.CSSProperties = { position: "relative", minWidth: 0 };
const nodeCard: React.CSSProperties = { minHeight: 255, height: "100%", display: "flex", flexDirection: "column", gap: 11, padding: 19, borderRadius: 22, border: "1px solid rgba(255,255,255,.1)", background: "rgba(16,19,27,.76)", boxShadow: "0 16px 38px rgba(0,0,0,.2)" };
const nodeTop: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const nodeOrb: React.CSSProperties = { width: 35, height: 35, display: "grid", placeItems: "center", borderRadius: 999, color: "#10131b", fontWeight: 950 };
const stagePill: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#aab1bf", fontSize: 10, fontWeight: 950, letterSpacing: ".1em" };
const nodeTitle: React.CSSProperties = { margin: 0, fontSize: 23, letterSpacing: "-.035em" };
const masteryTrack: React.CSSProperties = { height: 8, marginTop: "auto", borderRadius: 999, background: "#222936", overflow: "hidden" };
const masteryFill: React.CSSProperties = { height: "100%", borderRadius: 999 };
const nodeFooter: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", color: "#aab1bf", fontSize: 11, fontWeight: 900 };
const connector: React.CSSProperties = { position: "absolute", right: -14, top: "48%", color: "#7fdcff", fontWeight: 950, zIndex: 2 };
