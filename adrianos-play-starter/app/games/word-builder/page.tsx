"use client";

import GameFrame from "@/components/GameFrame";
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
    if (built === current.word) {
      setScore((currentScore) => currentScore + 1);
      setMessage("Correct! New word unlocked.");

      window.setTimeout(() => {
        setIndex((currentIndex) => (currentIndex + 1) % WORDS.length);
        setPicked([]);
        setMessage("Tap letters to build the word.");
      }, 750);

      return;
    }

    setMessage("Almost. Try moving the letters around.");
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
