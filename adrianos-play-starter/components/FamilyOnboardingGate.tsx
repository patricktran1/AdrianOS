"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

const PROFILE_REQUIRED_PREFIXES = [
  "/games/",
  "/school",
  "/parent",
  "/curriculum",
  "/portfolio",
  "/daily-session",
  "/mastery-lab",
  "/coach",
];

function requiresLearner(pathname: string): boolean {
  return PROFILE_REQUIRED_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function FamilyOnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, hasProfiles } = useFamilyProfiles();
  const blocked = hydrated && !hasProfiles && requiresLearner(pathname);

  useEffect(() => {
    if (!blocked) return;
    const destination = encodeURIComponent(pathname);
    router.replace(`/family/setup?first=1&from=${destination}`);
  }, [blocked, pathname, router]);

  if (blocked) {
    return (
      <main style={page} aria-live="polite">
        <section style={card}>
          <span style={eyebrow}>PARENT SETUP REQUIRED</span>
          <h1 style={title}>Create a learner before play begins.</h1>
          <p style={copy}>AdrianOS does not create sample children or record learning under a shared demo profile.</p>
        </section>
      </main>
    );
  }

  return children;
}

const page: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#10131b", color: "#fff" };
const card: React.CSSProperties = { width: "min(720px,100%)", padding: "clamp(28px,7vw,64px)", borderRadius: 32, border: "1px solid rgba(127,220,255,.25)", background: "#181d28", textAlign: "center" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "13px 0 16px", fontSize: "clamp(3rem,8vw,5.5rem)", lineHeight: .9, letterSpacing: "-.07em" };
const copy: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.6 };
