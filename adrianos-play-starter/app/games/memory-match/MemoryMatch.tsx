"use client";

import { useEffect, useMemo, useState } from "react";

const SYMBOLS = ["🦖", "🚀", "🍕", "🦊", "⚡", "🌙", "🎸", "🐙"];

type Card = {
  id: number;
  symbol: string;
  matched: boolean;
};

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function makeDeck(): Card[] {
  return shuffle(
    [...SYMBOLS, ...SYMBOLS].map((symbol, id) => ({
      id,
      symbol,
      matched: false,
    }))
  );
}

export default function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setCards(makeDeck());
  }, []);

  useEffect(() => {
    if (!started || cards.every((card) => card.matched)) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, cards]);

  const won = cards.length > 0 && cards.every((card) => card.matched);

  function choose(index: number) {
    if (!started) setStarted(true);
    if (open.length === 2 || open.includes(index) || cards[index]?.matched) return;

    const next = [...open, index];
    setOpen(next);

    if (next.length === 2) {
      setMoves((value) => value + 1);
      const [a, b] = next;
      if (cards[a].symbol === cards[b].symbol) {
        window.setTimeout(() => {
          setCards((current) =>
            current.map((card, cardIndex) =>
              cardIndex === a || cardIndex === b ? { ...card, matched: true } : card
            )
          );
          setOpen([]);
        }, 350);
      } else {
        window.setTimeout(() => setOpen([]), 750);
      }
    }
  }

  function restart() {
    setCards(makeDeck());
    setOpen([]);
    setMoves(0);
    setSeconds(0);
    setStarted(false);
  }

  const stars = useMemo(() => {
    if (moves <= 10) return 3;
    if (moves <= 16) return 2;
    return 1;
  }, [moves]);

  return (
    <div className="memory-wrap">
      <div className="score-strip">
        <div><span>Moves</span><strong>{moves}</strong></div>
        <div><span>Time</span><strong>{seconds}s</strong></div>
        <button onClick={restart}>New game</button>
      </div>

      <div className="memory-grid" aria-label="Memory cards">
        {cards.map((card, index) => {
          const visible = open.includes(index) || card.matched;
          return (
            <button
              key={card.id}
              className={`memory-card ${visible ? "flipped" : ""} ${card.matched ? "matched" : ""}`}
              onClick={() => choose(index)}
              aria-label={visible ? card.symbol : "Hidden card"}
            >
              <span>{visible ? card.symbol : "?"}</span>
            </button>
          );
        })}
      </div>

      {won && (
        <div className="win-panel" role="status">
          <span className="eyebrow">MISSION COMPLETE</span>
          <h2>You found every pair.</h2>
          <div className="stars" aria-label={`${stars} stars`}>
            {"★".repeat(stars)}{"☆".repeat(3 - stars)}
          </div>
          <p>{moves} moves in {seconds} seconds.</p>
          <button onClick={restart}>Play again</button>
        </div>
      )}
    </div>
  );
}
