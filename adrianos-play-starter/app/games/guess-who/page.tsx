import Link from "next/link";

const GUESS_WHO_URL = "PASTE-YOUR-GUESS-WHO-LIVE-URL-HERE";

export default function GuessWhoPage() {
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#10131b",
      }}
    >
      <header
        style={{
          height: "64px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "#10131b",
          color: "white",
        }}
      >
        <Link
          href="/"
          style={{
            padding: "10px 15px",
            borderRadius: "999px",
            background: "#222936",
            color: "white",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          ← Games
        </Link>

        <strong>Guess Who</strong>

        <a
          href={GUESS_WHO_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#d9ff5b",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          Full screen ↗
        </a>
      </header>

      <iframe
        src={GUESS_WHO_URL}
        title="Guess Who"
        allow="fullscreen"
        allowFullScreen
        style={{
          width: "100%",
          flex: 1,
          border: 0,
          background: "white",
        }}
      />
    </main>
  );
}
