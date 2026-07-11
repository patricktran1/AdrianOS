"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ParentProjectLauncher() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(window.sessionStorage.getItem("adrianos-parent-unlocked") === "yes");
  }, []);

  if (!unlocked) return null;

  return (
    <section style={shell}>
      <div style={icon}>🧪</div>
      <div style={{ minWidth: 0 }}>
        <span style={eyebrow}>PROJECT STUDIO</span>
        <h2 style={title}>Assign projects and review real work</h2>
        <p style={muted}>Choose a cross-subject project, inspect the child’s saved artifact, and add a parent observation.</p>
      </div>
      <Link href="/projects?parent=1" style={button}>Open projects →</Link>
    </section>
  );
}

const shell: React.CSSProperties = { width: "min(1180px,calc(100% - 28px))", margin: "-42px auto 60px", display: "grid", gridTemplateColumns: "72px minmax(0,1fr) auto", gap: 18, alignItems: "center", padding: "clamp(22px,4vw,32px)", borderRadius: 28, border: "1px solid rgba(127,220,255,.3)", background: "linear-gradient(145deg,rgba(127,220,255,.1),rgba(217,255,91,.05),#181d28)", boxShadow: "0 26px 60px rgba(0,0,0,.25)" };
const icon: React.CSSProperties = { width: 68, height: 68, display: "grid", placeItems: "center", borderRadius: 20, background: "#7fdcff", fontSize: 36 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontWeight: 950, fontSize: 11, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "6px 0", fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-.045em" };
const muted: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5 };
const button: React.CSSProperties = { padding: "14px 19px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950, whiteSpace: "nowrap" };
