import Link from "next/link";

export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#10131b", color: "#fff" }}>
      <section style={{ width: "min(560px,100%)", padding: 30, borderRadius: 28, background: "#181d28", border: "1px solid rgba(255,255,255,.12)", textAlign: "center" }}>
        <div style={{ width: 76, height: 76, margin: "0 auto 18px", borderRadius: 23, display: "grid", placeItems: "center", background: "#d9ff5b", color: "#10131b", fontSize: 42, fontWeight: 1000 }}>A</div>
        <span style={{ color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" }}>OFFLINE FOR A MOMENT</span>
        <h1 style={{ margin: "8px 0 12px", fontSize: 38, letterSpacing: "-.045em" }}>The learning trail is reconnecting.</h1>
        <p style={{ margin: "0 auto 22px", maxWidth: 430, color: "#aab1bf", lineHeight: 1.55 }}>
          Previously opened AdrianOS pages may still work offline. Connect to the internet before signing in, syncing family progress, or opening a game that has not been visited on this device.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 9 }}>
          <Link href="/school" style={{ minHeight: 46, display: "inline-flex", alignItems: "center", padding: "10px 17px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" }}>Try School Mode</Link>
          <Link href="/" style={{ minHeight: 46, display: "inline-flex", alignItems: "center", padding: "10px 17px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", color: "#fff", fontWeight: 900, textDecoration: "none" }}>Open game shelf</Link>
        </div>
      </section>
    </main>
  );
}
