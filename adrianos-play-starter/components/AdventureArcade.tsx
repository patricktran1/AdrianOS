"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProgressPill from "@/components/ProgressPill";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { elementaryGradeLabel } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import type { Game } from "@/lib/games";
import {
  FEATURED_GAME_BY_GRADE,
  dueReviewCount,
  gamesForPortal,
  isGameAgeFit,
  readArcadeState,
  recommendedGameSlug,
  rememberArcadeGame,
  toggleArcadeFavorite,
  type ArcadePortalId,
  type ArcadeState,
} from "@/lib/adventure-arcade";

const PORTALS: Array<{
  id: ArcadePortalId;
  emoji: string;
  label: string;
  description: string;
}> = [
  { id: "for-you", emoji: "✨", label: "For you", description: "Best next picks" },
  { id: "story", emoji: "🗺️", label: "Story worlds", description: "Longer adventures" },
  { id: "quick", emoji: "⚡", label: "Quick play", description: "Fast skill runs" },
  { id: "boss", emoji: "👾", label: "Boss battles", description: "Adaptive challenge" },
  { id: "together", emoji: "🤝", label: "Play together", description: "Pass-and-play" },
  { id: "rescue", emoji: "🛟", label: "Rescue a skill", description: "Fix tricky ideas" },
  { id: "all", emoji: "🕹️", label: "All games", description: "Browse the arcade" },
];

function uniqueGames(games: Array<Game | undefined>): Game[] {
  const seen = new Set<string>();
  return games.filter((game): game is Game => {
    if (!game || seen.has(game.slug)) return false;
    seen.add(game.slug);
    return true;
  });
}

function bySlug(games: Game[], slug: string): Game | undefined {
  return games.find((game) => game.slug === slug && game.status === "playable");
}

function gameAction(progress: ReturnType<typeof useAdrianProgress>["progress"], game: Game): string {
  const row = progress.games[game.slug];
  if ((row?.completions ?? 0) > 0) return "Play again";
  if ((row?.plays ?? 0) > 0) return "Continue";
  return "Start";
}

export default function AdventureArcade({ games }: { games: Game[] }) {
  const { activeProfile } = useFamilyProfiles();
  const { progress } = useAdrianProgress();
  const [portal, setPortal] = useState<ArcadePortalId>("for-you");
  const [subject, setSubject] = useState("All");
  const [query, setQuery] = useState("");
  const [showAllAges, setShowAllAges] = useState(false);
  const [arcade, setArcade] = useState<ArcadeState>({ favorites: [], recent: [] });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setArcade(readArcadeState(activeProfile.id));
      setRevision((value) => value + 1);
    };
    refresh();
    window.addEventListener("adrianos-learning-updated", refresh);
    return () => window.removeEventListener("adrianos-learning-updated", refresh);
  }, [activeProfile.id]);

  const grade = readProfileGrade(activeProfile);
  const gradeName = elementaryGradeLabel(grade);
  const recommendation = recommendedGameSlug({
    profileId: activeProfile.id,
    grade,
    games,
    progress,
  });
  const recommendedGame = bySlug(games, recommendation.slug)
    ?? games.find((game) => game.status === "playable");
  const reviews = dueReviewCount(activeProfile.id);
  void revision;

  const favoriteGames = arcade.favorites
    .map((slug) => bySlug(games, slug))
    .filter((game): game is Game => Boolean(game));
  const recentGames = arcade.recent
    .map((slug) => bySlug(games, slug))
    .filter((game): game is Game => Boolean(game));

  const forYouGames = uniqueGames([
    recommendedGame,
    bySlug(games, FEATURED_GAME_BY_GRADE[grade]),
    bySlug(games, "daily-adventure-remix"),
    reviews > 0 ? bySlug(games, "mastery-rescue-lab") : undefined,
    bySlug(games, "adaptive-boss-arena"),
    bySlug(games, "family-quest-party"),
    ...favoriteGames,
    ...recentGames,
  ]);

  const portalGames = portal === "for-you" ? forYouGames : gamesForPortal(games, portal);
  const ageFitGames = showAllAges
    ? portalGames
    : portalGames.filter((game) => isGameAgeFit(game, activeProfile.age));
  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(ageFitGames.map((game) => game.subject)))],
    [ageFitGames]
  );
  const visibleGames = ageFitGames.filter((game) => {
    if (subject !== "All" && game.subject !== subject) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${game.title} ${game.description} ${game.subject}`.toLowerCase().includes(needle);
  });

  function remember(slug: string) {
    setArcade(rememberArcadeGame(activeProfile.id, slug));
  }

  function favorite(slug: string) {
    setArcade(toggleArcadeFavorite(activeProfile.id, slug));
  }

  function choosePortal(next: ArcadePortalId) {
    setPortal(next);
    setSubject("All");
    setQuery("");
  }

  return (
    <section aria-label="Adventure Arcade" style={arcadeShell}>
      {recommendedGame && (
        <section style={hero} aria-label="Play next recommendation">
          <div style={heroCopy}>
            <span style={eyebrow}>{recommendation.eyebrow}</span>
            <h1 style={heroTitle}>{activeProfile.name}, your next quest is ready.</h1>
            <p style={heroLead}>{recommendation.reason}</p>
            <div style={heroGameRow}>
              <div style={heroEmoji} aria-hidden="true">{recommendedGame.emoji}</div>
              <div>
                <span style={gradeChip}>{gradeName} · {recommendedGame.subject}</span>
                <h2 style={heroGameTitle}>{recommendedGame.title}</h2>
                <p style={gameDescription}>{recommendedGame.description}</p>
              </div>
            </div>
            <div style={heroActions}>
              <Link
                href={`/games/${recommendedGame.slug}`}
                onClick={() => remember(recommendedGame.slug)}
                style={playNextButton}
              >
                {gameAction(progress, recommendedGame)} now →
              </Link>
              <button
                type="button"
                onClick={() => favorite(recommendedGame.slug)}
                style={favoriteButton}
                aria-pressed={arcade.favorites.includes(recommendedGame.slug)}
              >
                {arcade.favorites.includes(recommendedGame.slug) ? "★ Saved" : "☆ Save favorite"}
              </button>
            </div>
          </div>
          <div style={heroStats}>
            <ProgressPill large />
            <div style={statGrid}>
              <div style={stat}><small>MY GRADE</small><strong>{gradeName}</strong></div>
              <div style={stat}><small>SKILL RESCUES</small><strong>{reviews}</strong></div>
              <div style={stat}><small>FAVORITES</small><strong>{arcade.favorites.length}</strong></div>
            </div>
          </div>
        </section>
      )}

      <section style={portalSection} aria-label="Choose an arcade portal">
        <div style={sectionHeading}>
          <div>
            <span style={eyebrow}>CHOOSE A PORTAL</span>
            <h2 style={sectionTitle}>What sounds fun?</h2>
          </div>
          <span style={fitNote}>Showing games that fit age {activeProfile.age}</span>
        </div>
        <div style={portalGrid}>
          {PORTALS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choosePortal(item.id)}
              aria-pressed={portal === item.id}
              style={{ ...portalButton, ...(portal === item.id ? portalButtonActive : {}) }}
            >
              <span style={portalEmoji} aria-hidden="true">{item.emoji}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </section>

      {(favoriteGames.length > 0 || recentGames.length > 0) && (
        <section style={collectionSection} aria-label="My arcade collection">
          {favoriteGames.length > 0 && (
            <div>
              <span style={eyebrow}>MY FAVORITES</span>
              <div style={pillRow}>
                {favoriteGames.map((game) => (
                  <Link key={game.slug} href={`/games/${game.slug}`} onClick={() => remember(game.slug)} style={gamePill}>
                    <span>{game.emoji}</span>{game.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {recentGames.length > 0 && (
            <div>
              <span style={eyebrow}>JUMP BACK IN</span>
              <div style={pillRow}>
                {recentGames.map((game) => (
                  <Link key={game.slug} href={`/games/${game.slug}`} onClick={() => remember(game.slug)} style={gamePill}>
                    <span>{game.emoji}</span>{game.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section style={librarySection} aria-label="Arcade games">
        <div style={libraryHeader}>
          <div>
            <span style={eyebrow}>{PORTALS.find((item) => item.id === portal)?.label.toUpperCase()}</span>
            <h2 style={sectionTitle}>Pick your mission</h2>
            <p style={gameDescription}>{visibleGames.length} game{visibleGames.length === 1 ? "" : "s"} ready for {activeProfile.name}.</p>
          </div>
          <div style={libraryTools}>
            <label style={searchLabel}>
              <span>Search games</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Dinosaurs, math, music…"
                style={searchInput}
              />
            </label>
            <button type="button" onClick={() => setShowAllAges((value) => !value)} style={ageToggle} aria-pressed={showAllAges}>
              {showAllAges ? "✓ All TK–5 games" : `Age ${activeProfile.age} fit`}
            </button>
          </div>
        </div>

        {subjects.length > 1 && (
          <div style={filterRow} aria-label="Filter arcade games by subject">
            {subjects.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSubject(item)}
                style={{ ...filterButton, ...(subject === item ? filterButtonActive : {}) }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {visibleGames.length > 0 ? (
          <div style={gameGrid}>
            {visibleGames.map((game) => {
              const row = progress.games[game.slug];
              const favoriteGame = arcade.favorites.includes(game.slug);
              return (
                <article key={game.slug} style={gameCard}>
                  <div style={cardTop}>
                    <div style={gameIcon} aria-hidden="true">{game.emoji}</div>
                    <button
                      type="button"
                      onClick={() => favorite(game.slug)}
                      style={{ ...cardFavorite, ...(favoriteGame ? cardFavoriteActive : {}) }}
                      aria-label={favoriteGame ? `Remove ${game.title} from favorites` : `Save ${game.title} as a favorite`}
                      aria-pressed={favoriteGame}
                    >
                      {favoriteGame ? "★" : "☆"}
                    </button>
                  </div>
                  <div style={metaRow}><span>{game.subject}</span><span>{game.age}</span></div>
                  <h3 style={gameTitle}>{game.title}</h3>
                  <p style={gameDescription}>{game.description}</p>
                  <div style={progressRow}>
                    {(row?.completions ?? 0) > 0 && <span>🏆 {row.completions} clear{row.completions === 1 ? "" : "s"}</span>}
                    {(row?.bestScore ?? 0) > 0 && <span>⭐ Best {row.bestScore}</span>}
                    {!row && <span>✨ New adventure</span>}
                  </div>
                  <Link href={`/games/${game.slug}`} onClick={() => remember(game.slug)} style={cardPlayButton}>
                    {gameAction(progress, game)} →
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={emptyState}>
            <span style={{ fontSize: 50 }}>🔭</span>
            <strong>No games match those filters.</strong>
            <button type="button" onClick={() => { setSubject("All"); setQuery(""); setShowAllAges(true); }} style={ageToggle}>Show the whole arcade</button>
          </div>
        )}
      </section>
    </section>
  );
}

const arcadeShell: React.CSSProperties = { display: "grid", gap: 18 };
const hero: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: "clamp(24px,5vw,64px)", alignItems: "center", padding: "clamp(28px,6vw,70px)", borderRadius: 38, background: "radial-gradient(circle at 85% 10%,rgba(217,255,91,.19),transparent 30%),linear-gradient(145deg,rgba(127,220,255,.13),rgba(198,184,255,.1) 48%,#181d28)", border: "1px solid rgba(127,220,255,.28)", boxShadow: "0 34px 90px rgba(0,0,0,.3)", overflow: "hidden" };
const heroCopy: React.CSSProperties = { minWidth: 0 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { maxWidth: 820, margin: "12px 0 16px", fontSize: "clamp(3.5rem,9vw,7.2rem)", lineHeight: .86, letterSpacing: "-.08em" };
const heroLead: React.CSSProperties = { maxWidth: 680, margin: 0, color: "#c1c8d3", fontSize: "clamp(1rem,2vw,1.22rem)", lineHeight: 1.55, fontWeight: 750 };
const heroGameRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 16, alignItems: "center", marginTop: 24, padding: 17, borderRadius: 24, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.1)" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(3.8rem,9vw,6rem)", filter: "drop-shadow(0 12px 24px rgba(0,0,0,.35))" };
const gradeChip: React.CSSProperties = { display: "inline-block", padding: "5px 8px", borderRadius: 999, background: "rgba(217,255,91,.12)", color: "#d9ff5b", fontSize: 10, fontWeight: 950, letterSpacing: ".08em" };
const heroGameTitle: React.CSSProperties = { margin: "8px 0 5px", fontSize: "clamp(1.8rem,4vw,3rem)", lineHeight: .95, letterSpacing: "-.05em" };
const heroActions: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 };
const playNextButton: React.CSSProperties = { minHeight: 52, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 21px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, textDecoration: "none" };
const favoriteButton: React.CSSProperties = { minHeight: 52, padding: "12px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const heroStats: React.CSSProperties = { display: "grid", gap: 18, justifyItems: "center" };
const statGrid: React.CSSProperties = { width: "100%", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 };
const stat: React.CSSProperties = { display: "grid", gap: 5, minWidth: 0, padding: 13, borderRadius: 18, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.08)", textAlign: "center" };
const portalSection: React.CSSProperties = { padding: "clamp(20px,4vw,34px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const sectionHeading: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "end", gap: 14, flexWrap: "wrap", marginBottom: 16 };
const sectionTitle: React.CSSProperties = { margin: "7px 0 0", fontSize: "clamp(2.3rem,6vw,4.6rem)", lineHeight: .9, letterSpacing: "-.065em" };
const fitNote: React.CSSProperties = { padding: "8px 11px", borderRadius: 999, background: "#222936", color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const portalGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 9 };
const portalButton: React.CSSProperties = { minHeight: 128, display: "grid", alignContent: "center", justifyItems: "start", gap: 5, padding: 16, borderRadius: 22, border: "1px solid rgba(255,255,255,.1)", background: "#222936", color: "#fff", textAlign: "left", cursor: "pointer" };
const portalButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)", boxShadow: "0 12px 34px rgba(217,255,91,.08)" };
const portalEmoji: React.CSSProperties = { fontSize: 30 };
const collectionSection: React.CSSProperties = { display: "grid", gap: 18, padding: "clamp(20px,4vw,30px)", borderRadius: 28, background: "rgba(198,184,255,.07)", border: "1px solid rgba(198,184,255,.18)" };
const pillRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 };
const gamePill: React.CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: 999, background: "#222936", color: "#fff", textDecoration: "none", fontWeight: 850 };
const librarySection: React.CSSProperties = { padding: "clamp(22px,4vw,38px)", borderRadius: 32, background: "#181d28", border: "1px solid rgba(255,255,255,.1)" };
const libraryHeader: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 18, alignItems: "end" };
const libraryTools: React.CSSProperties = { display: "grid", gap: 9 };
const searchLabel: React.CSSProperties = { display: "grid", gap: 6, color: "#aab1bf", fontSize: 11, fontWeight: 900 };
const searchInput: React.CSSProperties = { width: "100%", minHeight: 48, padding: "11px 14px", borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 16 };
const ageToggle: React.CSSProperties = { minHeight: 44, padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(127,220,255,.25)", background: "rgba(127,220,255,.08)", color: "#7fdcff", fontWeight: 900, cursor: "pointer" };
const filterRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7, margin: "18px 0" };
const filterButton: React.CSSProperties = { minHeight: 40, padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.1)", background: "#222936", color: "#aab1bf", fontWeight: 850, cursor: "pointer" };
const filterButtonActive: React.CSSProperties = { background: "#d9ff5b", color: "#10131b", borderColor: "#d9ff5b" };
const gameGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 12 };
const gameCard: React.CSSProperties = { minWidth: 0, display: "grid", gridTemplateRows: "auto auto auto 1fr auto auto", padding: 19, borderRadius: 25, background: "#222936", border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 16px 35px rgba(0,0,0,.18)" };
const cardTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 };
const gameIcon: React.CSSProperties = { fontSize: 48 };
const cardFavorite: React.CSSProperties = { width: 42, height: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "#10131b", color: "#aab1bf", fontSize: 21, cursor: "pointer" };
const cardFavoriteActive: React.CSSProperties = { color: "#ffd45c", borderColor: "rgba(255,212,92,.4)", background: "rgba(255,212,92,.08)" };
const metaRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, color: "#7fdcff", fontSize: 10, fontWeight: 900, letterSpacing: ".06em" };
const gameTitle: React.CSSProperties = { margin: "9px 0 7px", fontSize: "clamp(1.5rem,4vw,2.2rem)", lineHeight: .96, letterSpacing: "-.04em" };
const gameDescription: React.CSSProperties = { margin: 0, color: "#aab1bf", lineHeight: 1.5, fontWeight: 650 };
const progressRow: React.CSSProperties = { minHeight: 28, display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13, color: "#c6b8ff", fontSize: 11, fontWeight: 850 };
const cardPlayButton: React.CSSProperties = { minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14, padding: "10px 14px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const emptyState: React.CSSProperties = { minHeight: 260, display: "grid", placeItems: "center", alignContent: "center", gap: 12, textAlign: "center", color: "#aab1bf" };
