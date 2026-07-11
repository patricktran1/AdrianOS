"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { getDueReviewItems, recordLearningAttempt } from "@/lib/adrian-learning";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";
type Category = "All" | "Animals" | "Space" | "Science" | "Everyday";
type WordCard = { word: string; hint: string; category: Exclude<Category, "All"> };

const WORDS: WordCard[] = [
  { word: "BEAR", hint: "A large animal that can hibernate.", category: "Animals" },
  { word: "FROG", hint: "An animal that hops and says ribbit.", category: "Animals" },
  { word: "TIGER", hint: "A striped big cat.", category: "Animals" },
  { word: "WHALE", hint: "A giant mammal that lives in the ocean.", category: "Animals" },
  { word: "PENGUIN", hint: "A bird that waddles and swims.", category: "Animals" },
  { word: "ELEPHANT", hint: "A huge animal with a trunk.", category: "Animals" },
  { word: "MOON", hint: "It shines in the night sky.", category: "Space" },
  { word: "MARS", hint: "The red planet.", category: "Space" },
  { word: "COMET", hint: "An icy object with a glowing tail.", category: "Space" },
  { word: "PLANET", hint: "A world that travels around a star.", category: "Space" },
  { word: "ROCKET", hint: "It blasts into space.", category: "Space" },
  { word: "ASTRONAUT", hint: "A person trained to travel in space.", category: "Space" },
  { word: "ATOM", hint: "A tiny building block of matter.", category: "Science" },
  { word: "LIGHT", hint: "It helps your eyes see.", category: "Science" },
  { word: "ENERGY", hint: "It makes things move or change.", category: "Science" },
  { word: "THUNDER", hint: "The sound that follows lightning.", category: "Science" },
  { word: "VOLCANO", hint: "A mountain that can erupt.", category: "Science" },
  { word: "GRAVITY", hint: "It pulls objects toward Earth.", category: "Science" },
  { word: "CHAIR", hint: "You sit on it.", category: "Everyday" },
  { word: "PIZZA", hint: "A cheesy food cut into slices.", category: "Everyday" },
  { word: "SCHOOL", hint: "A place where students learn.", category: "Everyday" },
  { word: "PUZZLE", hint: "Something you solve piece by piece.", category: "Everyday" },
  { word: "KITCHEN", hint: "The room where food is prepared.", category: "Everyday" },
  { word: "COMPUTER", hint: "A machine that follows digital instructions.", category: "Everyday" },
];

const SESSION_LENGTH = 8;

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function scramble(word: string): string[] {
  let letters = word.split("");
  let attempts = 0;
  do {
    letters = shuffled(letters);
    attempts += 1;
  } while (letters.join("") === word && attempts < 12);
  return letters;
}

function matchesDifficulty(word: string, difficulty: Difficulty) {
  if (difficulty === "Easy") return word.length <= 5;
  if (difficulty === "Medium") return word.length >= 5 && word.length <= 7;
  return word.length >= 7;
}

function difficultyForWord(word: string): Difficulty {
  if (word.length <= 5) return "Easy";
  if (word.length <= 7) return "Medium";
  return "Hard";
}

export default function WordBuilderPage() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [category, setCategory] = useState<Category>("All");
  const [session, setSession] = useState<WordCard[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [message, setMessage] = useState("Choose a category and difficulty.");
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const autoStarted = useRef(false);
  const profileId = getActiveProfile().id;
  const dueReviews = getDueReviewItems(profileId, "word-builder");

  const current = session[index];
  const letters = useMemo(() => current ? scramble(current.word) : [], [current, index]);
  const built = picked.map((letterIndex) => letters[letterIndex]).join("");
  const bestScore = progress.games["word-builder"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("difficulty");
    if (["Easy", "Medium", "Hard"].includes(requested ?? "")) {
      setDifficulty(requested as Difficulty);
    }
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      startGame(true);
    }
  }, []);

  function reviewWords(): WordCard[] {
    return getDueReviewItems(profileId, "word-builder")
      .map((item) => {
        const word = typeof item.data?.word === "string" ? item.data.word : "";
        const hint = typeof item.data?.hint === "string" ? item.data.hint : item.prompt;
        const categoryValue = typeof item.data?.category === "string" ? item.data.category : "Everyday";
        const validCategory = ["Animals", "Space", "Science", "Everyday"].includes(categoryValue)
          ? categoryValue as Exclude<Category, "All">
          : "Everyday";
        return word ? { word, hint, category: validCategory } : null;
      })
      .filter((item): item is WordCard => Boolean(item));
  }

  function startGame(useReview = false) {
    const eligible = WORDS.filter((item) =>
      matchesDifficulty(item.word, difficulty) &&
      (category === "All" || item.category === category)
    );
    const fallback = WORDS.filter((item) => matchesDifficulty(item.word, difficulty));
    const normalPool = eligible.length >= 4 ? eligible : fallback;
    const reviewPool = reviewWords();
    const pool = useReview && reviewPool.length > 0 ? reviewPool : normalPool;
    const selected = useReview
      ? pool.slice(0, SESSION_LENGTH)
      : shuffled(pool).slice(0, Math.min(SESSION_LENGTH, pool.length));

    setSession(selected);
    setIndex(0);
    setPicked([]);
    setScore(0);
    setAttempts(0);
    setHintUsed(false);
    setMessage("Tap letters to build the word.");
    setPlaying(true);
    setFinished(false);
    setLocked(false);
    setReviewMode(useReview && reviewPool.length > 0);
    setRecordedMiss(false);
    recordPlay("word-builder");
  }

  function pickLetter(letterIndex: number) {
    if (locked || picked.includes(letterIndex)) return;
    setPicked((value) => [...value, letterIndex]);
  }

  function resetWord() {
    if (locked) return;
    setPicked([]);
    setMessage("Try a new letter order.");
  }

  function useHint() {
    if (!current || hintUsed || locked) return;
    setHintUsed(true);
    setMessage(`Hint: the word starts with ${current.word[0]}.`);
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const wordDifficulty = difficultyForWord(current.word);
    recordLearningAttempt({
      gameSlug: "word-builder",
      subject: "Reading",
      skillId: `reading-spelling-${wordDifficulty.toLowerCase()}`,
      skillLabel: `${wordDifficulty} spelling`,
      prompt: current.hint,
      correctAnswer: current.word,
      correct,
      review: reviewMode,
      data: {
        word: current.word,
        hint: current.hint,
        category: current.category,
        difficulty: wordDifficulty,
      },
    }, profileId);
  }

  function checkWord() {
    if (!current || locked) return;
    if (built !== current.word) {
      if (!recordedMiss) {
        saveAttempt(false);
        setRecordedMiss(true);
      }
      setAttempts((value) => value + 1);
      setMessage("Almost. Rearrange the letters and try again.");
      return;
    }

    saveAttempt(true);
    setLocked(true);
    const wordPoints = Math.max(4, 12 - attempts * 2 - (hintUsed ? 3 : 0));
    const nextScore = score + wordPoints;
    setScore(nextScore);
    setMessage(`Correct! +${wordPoints} points`);

    window.setTimeout(() => {
      if (index === session.length - 1) {
        const xp = reviewMode ? 12 + nextScore : 30 + nextScore;
        const coins = reviewMode ? 2 : Math.max(4, Math.floor(nextScore / 8));
        award("word-builder", { xp, coins, score: nextScore, completed: !reviewMode });
        setFinished(true);
        setPlaying(false);
        return;
      }

      setIndex((value) => value + 1);
      setPicked([]);
      setAttempts(0);
      setHintUsed(false);
      setRecordedMiss(false);
      setMessage("Tap letters to build the word.");
      setLocked(false);
    }, 650);
  }

  if (!playing && !finished) {
    return (
      <GameFrame title="Word Builder">
        <section style={panelStyle}>
          <div style={{ fontSize: 64 }}>🔤</div>
          <span style={eyebrowStyle}>BUILD A NEW MISSION</span>
          <h1 style={titleStyle}>Choose your word world.</h1>
          <p style={mutedStyle}>Every game draws a different set of words.</p>

          <h3>Category</h3>
          <div style={optionRowStyle}>
            {(["All", "Animals", "Space", "Science", "Everyday"] as Category[]).map((item) => (
              <button key={item} onClick={() => setCategory(item)} style={pillStyle(category === item)}>{item}</button>
            ))}
          </div>

          <h3>Difficulty</h3>
          <div style={optionRowStyle}>
            {(["Easy", "Medium", "Hard"] as Difficulty[]).map((item) => (
              <button key={item} onClick={() => setDifficulty(item)} style={pillStyle(difficulty === item)}>{item}</button>
            ))}
          </div>

          <button onClick={() => startGame(false)} style={primaryStyle}>Start Word Mission</button>
          {dueReviews.length > 0 && (
            <button onClick={() => startGame(true)} style={{ ...primaryStyle, marginLeft: 10, background: "#c6b8ff", borderColor: "#c6b8ff" }}>
              Review {dueReviews.length} Due
            </button>
          )}
          <p style={mutedStyle}>Personal best: {bestScore}</p>
        </section>
      </GameFrame>
    );
  }

  if (finished) {
    return (
      <GameFrame title="Word Builder">
        <section style={panelStyle}>
          <div style={{ fontSize: 70 }}>{reviewMode ? "🧠" : "🏆"}</div>
          <span style={eyebrowStyle}>{reviewMode ? "REVIEW COMPLETE" : "MISSION COMPLETE"}</span>
          <h1 style={titleStyle}>{score} points</h1>
          <p style={mutedStyle}>{reviewMode ? "Those words are now scheduled by the learning engine." : `You completed ${session.length} randomized words and earned XP and coins.`}</p>
          <div style={optionRowStyle}>
            <button onClick={() => startGame(reviewMode)} style={primaryStyle}>Play Another Round</button>
            <Link href="/" style={secondaryLinkStyle}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Word Builder">
      <div style={{ width: "min(860px,100%)", margin: "0 auto" }}>
        <div style={statsStyle}>
          <span>{reviewMode ? "Spaced Review" : `Word ${index + 1} of ${session.length}`}</span>
          <span>{current.category}</span>
          <span>Score {score}</span>
        </div>
        <section style={panelStyle}>
          <span style={eyebrowStyle}>{difficultyForWord(current.word).toUpperCase()} WORD</span>
          <h1 style={{ ...titleStyle, fontSize: "clamp(1.8rem,5vw,3.5rem)" }}>{current.hint}</h1>

          {hintUsed && <p style={{ color: "#d9ff5b", fontWeight: 900 }}>Starts with: {current.word[0]}</p>}

          <div style={answerRowStyle}>
            {current.word.split("").map((_, answerIndex) => (
              <div key={answerIndex} style={answerSlotStyle}>{built[answerIndex] ?? ""}</div>
            ))}
          </div>

          <div style={letterRowStyle}>
            {letters.map((letter, letterIndex) => (
              <button
                key={`${letter}-${letterIndex}`}
                disabled={picked.includes(letterIndex) || locked}
                onClick={() => pickLetter(letterIndex)}
                style={{ ...letterStyle, opacity: picked.includes(letterIndex) ? 0.2 : 1 }}
              >
                {letter}
              </button>
            ))}
          </div>

          <div style={optionRowStyle}>
            <button onClick={() => setPicked((value) => value.slice(0, -1))} style={secondaryStyle}>Undo</button>
            <button onClick={resetWord} style={secondaryStyle}>Reset</button>
            <button onClick={useHint} disabled={hintUsed} style={secondaryStyle}>Hint</button>
            <button onClick={checkWord} style={primaryStyle}>Check</button>
          </div>
          <p style={{ minHeight: 24, color: "#c6b8ff", fontWeight: 850 }}>{message}</p>
        </section>
      </div>
    </GameFrame>
  );
}

const panelStyle: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,52px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const eyebrowStyle: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const titleStyle: React.CSSProperties = { margin: "14px 0", fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .96, letterSpacing: "-.06em" };
const mutedStyle: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const statsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontWeight: 850 };
const optionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "18px 0" };
const primaryStyle: React.CSSProperties = { padding: "13px 20px", border: "2px solid #d9ff5b", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryStyle: React.CSSProperties = { padding: "13px 18px", border: "2px solid #fff", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { ...secondaryStyle, display: "inline-block" };
const pillStyle = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: active ? "2px solid #d9ff5b" : "1px solid rgba(255,255,255,.15)", background: active ? "rgba(217,255,91,.12)" : "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" });
const answerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, margin: "26px 0" };
const answerSlotStyle: React.CSSProperties = { width: 44, height: 56, display: "grid", placeItems: "center", borderBottom: "4px solid #d9ff5b", fontSize: 28, fontWeight: 950 };
const letterRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 9, marginBottom: 20 };
const letterStyle: React.CSSProperties = { width: 50, height: 50, borderRadius: 14, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontSize: 22, fontWeight: 950, cursor: "pointer" };
