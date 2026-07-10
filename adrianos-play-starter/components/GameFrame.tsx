import Link from "next/link";

export default function GameFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="game-page">
      <header className="game-topbar">
        <Link href="/" className="home-button" aria-label="Back to game library">
          ← Home
        </Link>
        <div className="game-title">{title}</div>
        <div className="topbar-spacer" />
      </header>
      <section className="game-stage">{children}</section>
    </main>
  );
}
