"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MASTERY_LOOP_EVENT,
  masteryLabHref,
  readMasteryInterventions,
  type MasteryIntervention,
} from "@/lib/adrian-mastery-loop";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

const EVENTS = [MASTERY_LOOP_EVENT, "adrianos-learning-updated", "adrianos-family-updated"];

function phaseLabel(phase: MasteryIntervention["phase"]): string {
  if (phase === "reteach") return "New explanation ready";
  if (phase === "verify") return "Understanding check";
  if (phase === "retention") return "Memory check scheduled";
  if (phase === "resolved") return "Recovered";
  return "Watching";
}

function phaseColor(phase: MasteryIntervention["phase"]): string {
  if (phase === "resolved") return "#d9ff5b";
  if (phase === "retention") return "#c6b8ff";
  if (phase === "monitoring") return "#7f8898";
  return "#7fdcff";
}

function ParentMasteryLoop() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    for (const eventName of EVENTS) window.addEventListener(eventName, refresh);
    return () => {
      for (const eventName of EVENTS) window.removeEventListener(eventName, refresh);
    };
  }, []);

  const rows = useMemo(
    () => hydrated ? readMasteryInterventions(activeProfile.id) : [],
    [activeProfile.id, hydrated, revision],
  );
  const active = rows.filter((row) => row.phase === "reteach" || row.phase === "verify");
  const retention = rows.filter((row) => row.phase === "retention");
  const recovered = rows.filter((row) => row.phase === "resolved");
  const monitoring = rows.filter((row) => row.phase === "monitoring");
  const visible = [...active, ...retention, ...recovered.slice(0, 2), ...monitoring.slice(0, 1)].slice(0, 6);

  if (!hydrated) return null;

  return (
    <section style={shell} aria-label="Mastery recovery loops">
      <div style={headingRow}>
        <div>
          <span style={eyebrow}>MASTERY RECOVERY</span>
          <h2 style={title}>When a skill gets sticky, change the path.</h2>
          <p style={muted}>Two friction signals open a focused reteach. AdrianOS then checks understanding now and memory later instead of counting repetition as mastery.</p>
        </div>
        <div style={metrics}>
          <Metric label="Active" value={active.length} />
          <Metric label="Retention" value={retention.length} />
          <Metric label="Recovered" value={recovered.length} />
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={clearBox}>
          <strong>No recovery loop is active for {activeProfile.name}.</strong>
          <span>AdrianOS is still watching mistakes, supported solves, and delayed review evidence.</span>
        </div>
      ) : (
        <div style={grid}>
          {visible.map((row) => (
            <article style={card} key={row.id}>
              <div style={cardTop}>
                <span style={{ ...phaseChip, borderColor: phaseColor(row.phase), color: phaseColor(row.phase) }}>{phaseLabel(row.phase)}</span>
                <small>{row.evidenceCount} friction signal{row.evidenceCount === 1 ? "" : "s"}</small>
              </div>
              <h3 style={cardTitle}>{row.skillLabel}</h3>
              <p style={cardCopy}>{row.triggerPrompt || "AdrianOS detected repeated friction in this skill."}</p>
              <div style={cardFooter}>
                <span>{row.subject} · {row.verificationSuccesses} successful check{row.verificationSuccesses === 1 ? "" : "s"}</span>
                {(row.phase === "reteach" || row.phase === "verify" || row.phase === "retention") && (
                  <Link href={masteryLabHref(row.id)} style={openLink}>Open lab →</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ParentMasteryLoopPortal() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem("adrianos-parent-unlocked") !== "yes") return;
    let mounted: HTMLDivElement | null = null;

    const mount = () => {
      const main = document.querySelector("main");
      if (!main) return false;
      const existing = main.querySelector<HTMLDivElement>("[data-parent-mastery-loop-host]");
      if (existing) {
        setHost(existing);
        return true;
      }
      const commandHost = main.querySelector("[data-parent-command-center-host]");
      const anchor = commandHost ?? main.querySelector("header");
      if (!anchor) return false;

      const node = document.createElement("div");
      node.dataset.parentMasteryLoopHost = "true";
      anchor.insertAdjacentElement("afterend", node);
      mounted = node;
      setHost(node);
      return true;
    };

    if (mount()) return () => mounted?.remove();
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mounted?.remove();
    };
  }, []);

  return host ? createPortal(<ParentMasteryLoop />, host) : null;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={metric}><small>{label}</small><strong>{value}</strong></div>;
}

const shell: React.CSSProperties = { display: "grid", gap: 18, marginBottom: 20, padding: "clamp(22px,4vw,34px)", borderRadius: 30, border: "1px solid rgba(198,184,255,.28)", background: "linear-gradient(145deg,rgba(198,184,255,.09),rgba(127,220,255,.05),#181d28)", boxShadow: "0 25px 65px rgba(0,0,0,.23)" };
const headingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, flexWrap: "wrap" };
const eyebrow: React.CSSProperties = { color: "#c6b8ff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "7px 0", maxWidth: 760, fontSize: "clamp(2rem,5vw,3.7rem)", lineHeight: .95, letterSpacing: "-.055em" };
const muted: React.CSSProperties = { maxWidth: 760, margin: 0, color: "#aab1bf", lineHeight: 1.58 };
const metrics: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(78px,1fr))", gap: 8 };
const metric: React.CSSProperties = { display: "grid", gap: 4, minWidth: 82, padding: 12, borderRadius: 17, background: "#222936", textAlign: "center" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 11 };
const card: React.CSSProperties = { display: "grid", gap: 10, padding: 17, borderRadius: 22, border: "1px solid rgba(255,255,255,.09)", background: "#222936" };
const cardTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, color: "#aab1bf" };
const phaseChip: React.CSSProperties = { padding: "6px 9px", borderRadius: 999, border: "1px solid", fontSize: 10, fontWeight: 950, letterSpacing: ".06em" };
const cardTitle: React.CSSProperties = { margin: 0, fontSize: 24, letterSpacing: "-.035em" };
const cardCopy: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5, fontSize: 13 };
const cardFooter: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#aab1bf", fontSize: 11 };
const openLink: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const clearBox: React.CSSProperties = { display: "grid", gap: 5, padding: 18, borderRadius: 20, background: "#222936", color: "#aab1bf" };
