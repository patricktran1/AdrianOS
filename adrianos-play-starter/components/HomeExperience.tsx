"use client";

import Link from "next/link";
import FamilyProfileBar from "@/components/FamilyProfileBar";
import GameShelf from "@/components/GameShelf";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import type { Game } from "@/lib/games";

export default function HomeExperience({ games }: { games: Game[] }) {
  const { hydrated, hasProfiles } = useFamilyProfiles();

  if (!hydrated) {
    return (
      <main className="shell" aria-busy="true">
        <section style={loadingCard}>
          <span className="eyebrow">ADRIANOS LEARNING</span>
          <h1 style={loadingTitle}>Opening your family learning space…</h1>
        </section>
      </main>
    );
  }

  if (!hasProfiles) {
    return (
      <main className="shell">
        <section style={blankSlate}>
          <div>
            <span className="eyebrow">PRIVATE FAMILY LEARNING</span>
            <h1 style={blankTitle}>Start with your learner.</h1>
            <p style={blankLead}>
              This device has no child profiles yet. A parent creates each learner,
              chooses the child’s age and grade, and decides what AdrianOS should
              strengthen and what the child already loves.
            </p>
            <div style={actions}>
              <Link href="/family/setup" style={primaryAction}>Create a learner profile →</Link>
              <Link href="/join" style={secondaryAction}>Sign in and sync family</Link>
            </div>
            <p style={privacyNote}>
              No sample children. No child email accounts. Nothing begins tracking until a parent creates a profile.
            </p>
          </div>

          <div style={setupPreview} aria-label="What setup includes">
            <span style={previewEyebrow}>FIRST-RUN SETUP</span>
            <div style={previewStep}><strong>1</strong><span>Name, age, and learning grade</span></div>
            <div style={previewStep}><strong>2</strong><span>Interests and curriculum priorities</span></div>
            <div style={previewStep}><strong>3</strong><span>A personalized first learning route</span></div>
          </div>
        </section>

        <section style={promiseGrid} aria-label="AdrianOS family principles">
          <article style={promiseCard}><span style={promiseIcon}>🧭</span><strong>Grade-aware</strong><p>Activities connect to the learner’s selected curriculum level.</p></article>
          <article style={promiseCard}><span style={promiseIcon}>🎯</span><strong>Goal-aware</strong><p>Parent priorities influence the child’s daily learning missions.</p></article>
          <article style={promiseCard}><span style={promiseIcon}>✨</span><strong>Interest-aware</strong><p>Favorite topics make practice more inviting without replacing core skills.</p></article>
        </section>
      </main>
    );
  }

  return (
    <>
      <FamilyProfileBar />
      <main className="shell">
        <GameShelf games={games} />
      </main>
    </>
  );
}

const loadingCard: React.CSSProperties = { minHeight: 420, display: "grid", alignContent: "center", padding: "clamp(30px,7vw,72px)", borderRadius: 34, border: "1px solid rgba(255,255,255,.11)", background: "#181d28" };
const loadingTitle: React.CSSProperties = { maxWidth: 760, margin: "15px 0 0", fontSize: "clamp(2.8rem,7vw,5.8rem)", lineHeight: .92, letterSpacing: "-.065em" };
const blankSlate: React.CSSProperties = { minHeight: 560, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", alignItems: "center", gap: "clamp(28px,6vw,70px)", padding: "clamp(30px,7vw,78px)", borderRadius: 38, border: "1px solid rgba(127,220,255,.24)", background: "linear-gradient(145deg,rgba(127,220,255,.1),rgba(198,184,255,.08) 46%,#181d28)", boxShadow: "0 34px 90px rgba(0,0,0,.28)" };
const blankTitle: React.CSSProperties = { maxWidth: 780, margin: "15px 0 20px", fontSize: "clamp(4rem,10vw,8rem)", lineHeight: .84, letterSpacing: "-.082em" };
const blankLead: React.CSSProperties = { maxWidth: 680, margin: 0, color: "#b4bdca", fontSize: "clamp(1.02rem,2vw,1.25rem)", lineHeight: 1.65, fontWeight: 650 };
const actions: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 };
const primaryAction: React.CSSProperties = { minHeight: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950 };
const secondaryAction: React.CSSProperties = { minHeight: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", fontWeight: 950 };
const privacyNote: React.CSSProperties = { maxWidth: 620, margin: "18px 0 0", color: "#7f8898", fontSize: 12, lineHeight: 1.55 };
const setupPreview: React.CSSProperties = { display: "grid", gap: 12, padding: "clamp(22px,5vw,38px)", borderRadius: 30, background: "rgba(16,19,27,.78)", border: "1px solid rgba(255,255,255,.1)" };
const previewEyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const previewStep: React.CSSProperties = { display: "grid", gridTemplateColumns: "44px 1fr", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, background: "#222936", color: "#cdd3dc", fontWeight: 850 };
const promiseGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 16 };
const promiseCard: React.CSSProperties = { display: "grid", gap: 8, padding: 22, borderRadius: 24, border: "1px solid rgba(255,255,255,.1)", background: "#181d28" };
const promiseIcon: React.CSSProperties = { fontSize: 32 };
