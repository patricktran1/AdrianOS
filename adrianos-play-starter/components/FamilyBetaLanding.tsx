"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { beginGoogleFamilySignIn } from "@/lib/family-beta-account";
import { betaCohortLabel, rememberBetaCohort, type BetaCohort } from "@/lib/beta-cohort";
import { isSupabaseConfigured } from "@/lib/supabase-browser";
import "@/app/family-beta.css";

const BENEFITS = [
  ["👨‍👩‍👧‍👦", "One parent account", "A parent signs in once and creates a separate learning profile for each child."],
  ["📱", "Install on family devices", "Add AdrianOS to an iPhone, tablet, or computer so School Mode is one tap away."],
  ["🧭", "Guided learning", "School Mode builds a short route while Parent Mode shows progress and the next growth area."],
  ["🛡️", "Children do not sign in", "No child email or Google account is required. Profiles remain controlled by the parent."],
] as const;

export default function FamilyBetaLanding() {
  const configured = isSupabaseConfigured();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cohort, setCohort] = useState<BetaCohort>("general");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCohort(rememberBetaCohort(params.get("cohort")));
  }, []);

  async function signIn() {
    setBusy(true);
    const result = await beginGoogleFamilySignIn();
    setMessage(result.message);
    if (!result.ok) setBusy(false);
  }

  const localHref = `/family/setup?local=1&cohort=${encodeURIComponent(cohort)}`;
  const installHref = `/install?cohort=${encodeURIComponent(cohort)}`;

  return (
    <main className="family-beta-page">
      <header className="family-beta-nav">
        <Link href="/" className="family-beta-brand">ADRIANOS</Link>
        <span className="family-beta-chip">{betaCohortLabel(cohort).toUpperCase()}</span>
      </header>

      <section className="family-beta-hero">
        <div>
          <span className="family-beta-eyebrow">A PERSONAL LEARNING PLAYGROUND</span>
          <h1>Every child gets their own route.</h1>
          <p className="family-beta-lead">
            AdrianOS combines short educational games, a guided daily School Mode, and a parent dashboard. This beta is opening to Adrian’s classmates and local families for practical feedback.
          </p>
          <div className="family-beta-actions">
            <button className="family-beta-google" onClick={() => void signIn()} disabled={busy || !configured} type="button">
              <span className="family-beta-google-mark">G</span>
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
            <Link href={localHref} className="family-beta-secondary">Try it on this device</Link>
            <Link href={installHref} className="family-beta-secondary">Install AdrianOS</Link>
          </div>
          {!configured && (
            <p className="family-beta-message">Google family accounts are not configured on this deployment yet. The local-device preview is available.</p>
          )}
          {message && <p className="family-beta-message">{message}</p>}
          <p className="family-beta-fineprint">
            Parent-managed beta. No child email is requested. Parents can remove profiles or sign out from Parent Mode.
          </p>
        </div>
        <div className="family-beta-orbit" aria-hidden="true">
          <div className="family-beta-orbit-core">LEARN</div>
          <span className="orbit-one">🔢</span>
          <span className="orbit-two">🦖</span>
          <span className="orbit-three">🎨</span>
          <span className="orbit-four">🪐</span>
        </div>
      </section>

      <section className="family-beta-benefits" aria-label="Family beta features">
        {BENEFITS.map(([emoji, title, description]) => (
          <article key={title}>
            <span>{emoji}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="family-beta-how">
        <span className="family-beta-eyebrow">SETUP TAKES ABOUT A MINUTE</span>
        <h2>Parent signs in. Parent adds children. Kids play.</h2>
        <div className="family-beta-steps">
          <div><strong>1</strong><span>Use the parent’s Google account.</span></div>
          <div><strong>2</strong><span>Add one or more child profiles.</span></div>
          <div><strong>3</strong><span>Choose a child and open School Mode.</span></div>
        </div>
      </section>
    </main>
  );
}
