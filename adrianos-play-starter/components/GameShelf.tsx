"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "@/lib/games";
import ProgressPill from "@/components/ProgressPill";
import HomeHub from "@/components/HomeHub";
import { useAdrianProgress } from "@/lib/adrian-progress";

const RECENT_KEY = "adrianos-recent-games";

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function GameShelf({ games }: { games: Game[] }) {
  const [recent, setRecent] = useState<string[]>([]);
  const [filter, setFilter] = useState("All");
  const { progress } = useAdrianProgress();

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(games.map((game) => game.subject)))],
    [games]
  );

  const visibleGames =
    filter === "All" ? games : games.filter((game) => game.subject === filter);

  function remember(slug: string) {
    const updated = [slug, ...getRecent().filter((item) => item !== slug)].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    setRecent(updated);
  }

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">ADRIANOS PLAY</span>
          <h1>Pick a game.<br />Grow a superpower.</h1>
          <p>
            A private game shelf for logic, memory, curiosity, and whatever we
            dream up next.
          </p>
          <div style={{ marginTop: 22 }}>
            <ProgressPill large />
          </div>
        </div>
        <div className="hero-orb" aria-hidden="true">
          <span>PLAY</span>
        </div>
      </section>

      <HomeHub games={games} />

      {recent.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">JUMP BACK IN</span>
              <h2>Recently played</h2>
            </div>
          </div>
          <div className="recent-row">
            {recent.map((slug) => {
              const game = games.find((item) => item.slug === slug);
              if (!game || game.status !== "playable") return null;
              return (
                <Link
                  key={slug}
                  href={`/games/${slug}`}
                  onClick={() => remember(slug)}
                  className="recent-pill"
                >
                  <span>{game.emoji}</span>
                  {game.title}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GAME LIBRARY</span>
            <h2>Choose your next mission</h2>
          </div>
          <div className="filters" aria-label="Filter games">
            {subjects.map((subject) => (
              <button
                key={subject}
                className={filter === subject ? "filter active" : "filter"}
                onClick={() => setFilter(subject)}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>

        <div className="game-grid">
          {visibleGames.map((game) => {
            const playable = game.status === "playable";
            const bestScore = progress.games[game.slug]?.bestScore ?? 0;
            const card = (
              <article className={`game-card ${!playable ? "disabled" : ""}`}>
                <div className="game-icon" aria-hidden="true">{game.emoji}</div>
                <div className="game-meta">
                  <span>{game.subject}</span>
                  <span>{game.age}</span>
                </div>
                <h3>{game.title}</h3>
                <p>{game.description}</p>
                {bestScore > 0 && (
                  <div style={{ marginTop: 14, color: "#c6b8ff", fontWeight: 850, fontSize: 13 }}>
                    Personal best: {bestScore}
                  </div>
                )}
                <div className="card-footer">
                  <span className="play-label">
                    {playable ? "PLAY NOW" : "ADD EXISTING GAME"}
                  </span>
                  <span className="arrow" aria-hidden="true">↗</span>
                </div>
              </article>
            );

            return playable ? (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                onClick={() => remember(game.slug)}
                className="card-link"
              >
                {card}
              </Link>
            ) : (
              <Link key={game.slug} href={`/games/${game.slug}`} className="card-link">
                {card}
              </Link>
            );
          })}
        </div>
      </section>

      <footer>
        <span>Built for Adrian.</span>
        <span>No ads. No feeds. Just play.</span>
      </footer>
    </>
  );
}
