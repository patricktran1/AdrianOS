"use client";

import { useAdrianProgress } from "@/lib/adrian-progress";
import { getActiveProfile } from "@/lib/adrian-profiles";
import {
  getDueReviewItems,
  recordLearningAttempt,
} from "@/lib/adrian-learning";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Theme = "Mix" | "Animals" | "Space" | "Food";
type Difficulty = "Easy" | "Classic" | "Challenge";
type Card = { id: number; symbol: string; matched: boolean };

const GAME_SLUG = "memory-match";

const THEMES: Record<Theme, string[]> = {
  Mix: ["🦖", "🚀", "🍕", "🦊", "⚡", "🌙", "🎸", "🐙", "🤖", "🌈", "🏀", "🧁"],
  Animals: ["🦖", "🦊", "🐙", "🐼", "🦁", "🐸", "🐧", "🦈", "🦉", "🐢", "🐯", "🐝"],
  Space: ["🚀", "🌙", "⭐", "🪐", "☄️", "👽", "🛰️", "🌍", "☀️", "🌌", "🧑‍🚀", "🔭"],
  Food: ["🍕", "🧁", "🍎", "🍔", "🌮", "🍉", "🍪", "🥞", "🍓", "🥕", "🍩", "🥨"],
};

const PAIRS: Record<Difficulty, number> = { Easy: 6, Classic: 8, Challenge: 10 };
const PREVIEW_MS: Record<Difficulty, number> = { Easy: 2800, Classic: 2200, Challenge: 1600 };

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeDeck(theme: Theme, difficulty: Difficulty): Card[] {
  const symbols = shuffle(THEMES[theme]).slice(0, PAIRS[difficulty]);
  return shuffle([...symbols, ...symbols].map((symbol, id) => ({ id, symbol, matched: false })));
}

function validTheme(value: unknown): value is Theme {
  return value === "Mix" || value === "Animals" || value === "Space" || value === "Food";
}

function validDifficulty(value: unknown): value is Difficulty {
  return value === "Easy" || value === "Classic" || value === "Challenge";
}

export default function MemoryMatch() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const profileId = getActiveProfile().id;
  const dueReviews = getDueReviewItems(profileId, GAME_SLUG);
  const autoStarted = useRef(false);

  const [theme, setTheme] = useState<Theme>("Mix");
  const [difficulty, setDifficulty] = useState<Difficulty>("Classic");
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const won = playing && cards.length > 0 && cards.every((card) => card.matched);
  const pairCount = PAIRS[difficulty];
  const bestScore = progress.games[GAME_SLUG]?.bestScore ?? 0;

  const stars = useMemo(() => {
    if (moves <= pairCount + 2) return 3;
    if (moves <= Math.ceil(pairCount * 1.75)) return 2;
    return 1;
  }, [moves, pairCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startDueReview();
    }
  }, []);

  useEffect(() => {
    if (!playing || preview || won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing, preview, won]);

  useEffect(() => {
    if (!won || rewarded) return;
    const finalScore = score + Math.max(0, 300 - seconds * 3 - moves * 4) + stars * 100;
    const skillId = difficulty === "Easy" ? "memory-matching" : "memory-working-memory";
    const skillLabel = difficulty === "Easy" ? "Visual matching" : "Working memory";
    const prompt = `Memory ${difficulty} ${theme}: match ${pairCount} pairs`;

    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Memory",
      skillId,
      skillLabel,
      prompt,
      correctAnswer: "Find every pair with at least two stars",
      correct: stars >= 2,
      review: reviewMode,
      data: { theme, difficulty, pairs: pairCount, moves, seconds, stars },
    }, profileId);

    setScore(finalScore);
    award(GAME_SLUG, {
      xp: (reviewMode ? 15 : 35) + stars * 15,
      coins: reviewMode ? 2 : 4 + stars * 3,
      score: finalScore,
      completed: !reviewMode,
    });
    setRewarded(true);
  }, [won, rewarded, score, seconds, moves, stars, award, difficulty, theme, pairCount, profileId, reviewMode]);

  function startGame(
    nextTheme: Theme = theme,
    nextDifficulty: Difficulty = difficulty,
    useReview = false
  ) {
    setTheme(nextTheme);
    setDifficulty(nextDifficulty);
    setCards(makeDeck(nextTheme, nextDifficulty));
    setOpen([]);
    setMoves(0);
    setSeconds(0);
    setCombo(0);
    setScore(0);
    setRewarded(false);
    setReviewMode(useReview);
    setPlaying(true);
    setPreview(true);
    recordPlay(GAME_SLUG);
    window.setTimeout(() => setPreview(false), PREVIEW_MS[nextDifficulty]);
  }

  function startDueReview() {
    const item = getDueReviewItems(profileId, GAME_SLUG)[0];
    const nextTheme = validTheme(item?.data?.theme) ? item.data.theme : "Mix";
    const nextDifficulty = validDifficulty(item?.data?.difficulty) ? item.data.difficulty : "Classic";
    startGame(nextTheme, nextDifficulty, true);
  }

  function choose(index: number) {
    if (!playing || preview || won || open.length === 2 || open.includes(index) || cards[index]?.matched) return;

    const next = [...open, index];
    setOpen(next);

    if (next.length !== 2) return;

    setMoves((value) => value + 1);
    const [a, b] = next;

    if (cards[a].symbol === cards[b].symbol) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore((value) => value + 100 + nextCombo * 20);
      window.setTimeout(() => {
        setCards((current) => current.map((card, cardIndex) =>
          cardIndex === a || cardIndex === b ? { ...card, matched: true } : card
        ));
        setOpen([]);
      }, 350);
    } else {
      setCombo(0);
      window.setTimeout(() => setOpen([]), difficulty === "Easy" ? 950 : 700);
    }
  }

  if (!playing) {
    return (
      <section style={panelStyle}>
        <div style={{ fontSize: 68 }}>🧠</div>
        <span style={eyebrowStyle}>NEW MEMORY MISSION</span>
        <h1 style={titleStyle}>Pick a deck and board size.</h1>
        <p style={mutedStyle}>Cards appear briefly before they hide. Board difficulty now feeds the Skill Graph.</p>

        <h3>Deck</h3>
        <div style={optionRowStyle}>
          {(["Mix", "Animals", "Space", "Food"] as Theme[]).map((item) => (
            <button key={item} onClick={() => setTheme(item)} style={pillStyle(theme === item)}>{item}</button>
          ))}
        </div>

        <h3>Difficulty</h3>
        <div style={optionRowStyle}>
          {(["Easy", "Classic", "Challenge"] as Difficulty[]).map((item) => (
            <button key={item} onClick={() => setDifficulty(item)} style={pillStyle(difficulty === item)}>
              {item} · {PAIRS[item]} pairs
            </button>
          ))}
        </div>

        <button onClick={() => startGame()} style={primaryStyle}>Start Memory Mission</button>
        {dueReviews.length > 0 && (
          <button onClick={startDueReview} style={{ ...primaryStyle, marginLeft: 10, background: "#c6b8ff", borderColor: "#c6b8ff" }}>
            Review {dueReviews.length} Due
          </button>
        )}
        <p style={mutedStyle}>Personal best: {bestScore}</p>
      </section>
    );
  }

  return (
    <div style={{ width: "min(820px,100%)", margin: "0 auto" }}>
      <div style={statsStyle}>
        <div><span style={labelStyle}>Mode</span><strong>{reviewMode ? "Review" : difficulty}</strong></div>
        <div><span style={labelStyle}>Moves</span><strong>{moves}</strong></div>
        <div><span style={labelStyle}>Time</span><strong>{seconds}s</strong></div>
        <div><span style={labelStyle}>Combo</span><strong>{combo}×</strong></div>
        <div><span style={labelStyle}>Score</span><strong>{score}</strong></div>
        <button onClick={() => startGame(theme, difficulty, reviewMode)} style={smallButtonStyle}>New Board</button>
      </div>

      {preview && <div style={previewBannerStyle}>Memorize the cards...</div>}

      <div
        aria-label="Memory cards"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${pairCount === 10 ? 5 : 4}, minmax(0,1fr))`,
          gap: 10,
        }}
      >
        {cards.map((card, index) => {
          const visible = preview || open.includes(index) || card.matched;
          return (
            <button
              key={card.id}
              onClick={() => choose(index)}
              aria-label={visible ? card.symbol : "Hidden card"}
              style={{
                ...cardStyle,
                background: card.matched ? "#d9ff5b" : visible ? "#c6b8ff" : "linear-gradient(145deg,#252c39,#181d27)",
                color: visible ? "#10131b" : "#fff",
                transform: visible ? "rotateY(180deg)" : "none",
              }}
            >
              <span style={{ display: "inline-block", transform: visible ? "rotateY(180deg)" : "none" }}>{visible ? card.symbol : "?"}</span>
            </button>
          );
        })}
      </div>

      {won && (
        <section style={winStyle} role="status">
          <span style={eyebrowStyle}>{reviewMode ? "REVIEW COMPLETE" : "MISSION COMPLETE"}</span>
          <h2 style={{ fontSize: "clamp(2rem,6vw,3.8rem)", margin: "10px 0" }}>You found every pair.</h2>
          <div style={{ color: "#d9ff5b", fontSize: 34 }}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</div>
          <p style={mutedStyle}>
            {moves} moves in {seconds} seconds. {stars >= 2 ? "Strong memory evidence saved." : "This board will return for another look."}
          </p>
          <div style={optionRowStyle}>
            <button onClick={() => startGame(theme, difficulty, reviewMode)} style={primaryStyle}>Play Another Board</button>
            <button onClick={() => setPlaying(false)} style={secondaryStyle}>Change Setup</button>
            <Link href="/" style={secondaryLinkStyle}>Go Home</Link>
          </div>
        </section>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = { width: "min(760px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,52px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const eyebrowStyle: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const titleStyle: React.CSSProperties = { margin: "14px 0", fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .96, letterSpacing: "-.06em" };
const mutedStyle: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const optionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "18px 0" };
const primaryStyle: React.CSSProperties = { padding: "13px 20px", border: "2px solid #d9ff5b", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryStyle: React.CSSProperties = { padding: "13px 18px", border: "2px solid #fff", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { ...secondaryStyle, display: "inline-block" };
const pillStyle = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: active ? "2px solid #d9ff5b" : "1px solid rgba(255,255,255,.15)", background: active ? "rgba(217,255,91,.12)" : "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" });
const statsStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 };
const labelStyle: React.CSSProperties = { display: "block", color: "#aab1bf", fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" };
const smallButtonStyle: React.CSSProperties = { marginLeft: "auto", padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" };
const previewBannerStyle: React.CSSProperties = { marginBottom: 12, padding: 12, borderRadius: 16, background: "rgba(217,255,91,.12)", color: "#d9ff5b", textAlign: "center", fontWeight: 950 };
const cardStyle: React.CSSProperties = { aspectRatio: "1", minWidth: 0, border: "1px solid rgba(255,255,255,.12)", borderRadius: 20, fontSize: "clamp(1.7rem,6vw,3.7rem)", fontWeight: 950, cursor: "pointer", transition: "transform .18s ease, background .18s ease" };
const winStyle: React.CSSProperties = { marginTop: 18, padding: 26, borderRadius: 24, border: "1px solid rgba(217,255,91,.35)", background: "rgba(217,255,91,.08)", textAlign: "center" };