"use client";

import { useMemo, useState } from "react";
import styles from "./word-builder.module.css";

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

export default function WordBuilder() {
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

  function resetWord() {
    setPicked([]);
    setMessage("Tap letters to build the word.");
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.topline}>
          <span>Word {index + 1} of {WORDS.length}</span>
          <span>Score {score}</span>
        </div>

        <span className={styles.eyebrow}>WORD BUILDER</span>
        <h1>{current.hint}</h1>

        <div className={styles.answer}>
          {current.word.split("").map((_, answerIndex) => (
            <div key={answerIndex}>{built[answerIndex] ?? ""}</div>
          ))}
        </div>

        <div className={styles.letters}>
          {scrambled.map((letter, letterIndex) => (
            <button
              key={`${letter}-${letterIndex}`}
              onClick={() => pickLetter(letterIndex)}
              disabled={picked.includes(letterIndex)}
            >
              {letter}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button onClick={removeLast}>Undo</button>
          <button onClick={resetWord}>Reset</button>
          <button className={styles.primary} onClick={checkWord}>Check</button>
        </div>

        <p>{message}</p>
      </section>
    </div>
  );
}
