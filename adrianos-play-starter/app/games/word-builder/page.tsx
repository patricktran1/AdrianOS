"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useMemo, useState } from "react";

const WORDS = [
  { word: "PLANET", hint: "A world that travels around a star." },
  { word: "ROCKET", hint: "It blasts into space." },
  { word: "JUNGLE", hint: "A thick, wild forest." },
  { word: "PUZZLE", hint: "Something you solve." },
  { word: "THUNDER", hint: "The sound that follows lightning." },
  { word: "VOLCANO", hint: "A mountain that can erupt." },
  { word: "OCEAN", hint: "A giant body of salt water." },
  { word: "ROBOT", hint: "A machine that can follow instructions." },
];

function shuffleWord(word: string): string[] {
  let letters = word.split("");
  let attempts = 0;

  do {
    letters = [...letters].sort(() => Math.random() - 0.5);
    attempts += 1;
  } while (letters.join("") === word && attempts < 10);

  return letters;
}

export default function WordBuilderPage() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Tap letters to build the word.");
  const [finished, setFinished] = useState(false);

  const current = WORDS[index];
  const scrambled = useMemo(() => shuffleWord(current.word), [current.word]);
  const built = picked.map((letterIndex) => scrambled[letterIndex]).join("");

  function pickLetter(letterIndex: number) {
    if (picked.includes(letterIndex)) return;
    setPicked((currentPicked) => [...currentPicked, letterIndex]);
  }

  function removeLast() {
    setPicked((currentPicked) => currentPicked.slice(0, -1));
  }

  function resetWord() {
    setPicked([]);
    setMessage("Tap letters to build the word.");
  }

  function checkWord() {
    if (built !== current.word) {
      setMessage("Almost. Try moving the letters around.");
      return;
    }

    const nextScore = score + 1;
    setScore(nextScore);

    if (index === WORDS.length - 1) {
      setMessage("You completed every word.");
      window.setTimeout(() => {
        setFinished(true);
      }, 650);
      return;
    }

    setMessage("Correct! New word unlocked.");

    window.setTimeout(() => {
      setIndex((currentIndex) => currentIndex + 1);
      setPicked([]);
      setMessage("Tap letters to build the word.");
    }, 750);
  }

  const secondaryButtonStyle: React.CSSProperties = {
    minWidth: 120,
    padding: "13px 20px",
    border: "2px solid #ffffff",
    borderRadius: 999,
    color: "#10131b",
    background: "#ffffff",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(0,0,0,.28)",
  };

  const primaryButtonStyle: React.CSSProperties = {
    minWidth: 120,
    padding: "13px 20px",
    border: "2px solid #d9ff5b",
    borderRadius: 999,
    color: "#10131b",
    background: "#d9ff5b",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(0,0,0,.28)",
  };

  if (finished) {
    return (
      <GameFrame title="Word Builder">
        <div
          style={{
            width: "min(720px, 100%)",
            margin: "0 auto",
          }}
        >
          <section
            style={{
              padding: "clamp(30px, 7vw, 68px)",
              border: "1px solid rgba(255,255,255,.11)",
              borderRadius: 30,
              background: "#181d28",
              boxShadow: "0 30px 70px rgba(0,0,0,.28)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 18 }}>🏆</div>

            <span
              style={{
                color: "#d9ff5b",
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: "0.18em",
              }}
            >
              WORD BUILDER COMPLETE
            </span>

            <h1
              style={{
                margin: "14px 0 14px",
                fontSize: "clamp(2.8rem, 8vw, 5.5rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.065em",
              }}
            >
              You built every word.
            </h1>

            <p
              style={{
                margin: "0 auto 28px",
                color: "#aab1bf",
                fontSize: 18,
                lineHeight: 1.55,
              }}
            >
              Final score: {score} out of {WORDS.length}
            </p>

            <Link
              href="/"
              style={{
                display: "inline-block",
                minWidth: 150,
                padding: "14px 22px",
                borderRadius: 999,
                color: "#10131b",
                background: "#d9ff5b",
                fontWeight: 950,
                textDecoration: "none",
                boxShadow: "0 8px 22px rgba(0,0,0,.28)",
              }}
            >
              Go Home
            </Link>
          </section>
        </div>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Word Builder">
      <div
        style={{
          width: "min(820px, 100%)",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            padding: "clamp(24px, 5vw, 50px)",
            border: "1px solid rgba(255,255,255,.11)",
            borderRadius: 30,
            background: "#181d28",
            boxShadow: "0 30px 70px rgba(0,0,0,.28)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 22,
              color: "#aab1bf",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>Word {index + 1} of {WORDS.length}</span>
            <span>Score {score}</span>
          </div>

          <span
            style={{
              color: "#d9ff5b",
              fontSize: 12,
              fontWeight: 950,
              letterSpacing: "0.18em",
            }}
          >
            WORD BUILDER
          </span>

          <h1
            style={{
              margin: "12px auto 26px",
              maxWidth: 640,
              fontSize: "clamp(1.8rem, 5vw, 3.4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.05em",
            }}
          >
            {current.hint}
          </h1>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 28,
            }}
          >
            {current.word.split("").map((_, answerIndex) => (
              <div
                key={answerIndex}
                style={{
                  width: 46,
                  height: 56,
                  display: "grid",
                  placeItems: "center",
                  borderBottom: "4px solid #c6b8ff",
                  fontSize: 32,
                  fontWeight: 950,
                }}
              >
                {built[answerIndex] ?? ""}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {scrambled.map((letter, letterIndex) => (
              <button
                key={`${letter}-${letterIndex}`}
                onClick={() => pickLetter(letterIndex)}
                disabled={picked.includes(letterIndex)}
                style={{
                  width: 58,
                  height: 58,
                  border: "1px solid rgba(255,255,255,.24)",
                  borderRadius: 16,
                  color: "#ffffff",
                  background: "#2b3444",
                  fontSize: 26,
                  fontWeight: 950,
                  cursor: "pointer",
                  opacity: picked.includes(letterIndex) ? 0.2 : 1,
                }}
              >
                {letter}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 26,
            }}
          >
            <button onClick={removeLast} style={secondaryButtonStyle}>
              Undo
            </button>

            <button onClick={resetWord} style={secondaryButtonStyle}>
              Reset
            </button>

            <button onClick={checkWord} style={primaryButtonStyle}>
              Check
            </button>
          </div>

          <p
            style={{
              minHeight: 25,
              marginTop: 18,
              color: "#c6b8ff",
              fontWeight: 850,
            }}
          >
            {message}
          </p>
        </section>
      </div>
    </GameFrame>
  );
}
