import Link from "next/link";
import ProgressPill from "@/components/ProgressPill";
import UniversalCoach from "@/components/UniversalCoach";

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
        <div className="topbar-spacer">
          <ProgressPill />
        </div>
      </header>
      <section className="game-stage">{children}</section>
      <UniversalCoach />
    </main>
  );
}
