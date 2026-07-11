"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import Link from "next/link";
import { useState } from "react";

type Topic = "All" | "Earth" | "Body" | "Space" | "Technology";
type Question = {
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  topic: Exclude<Topic, "All">;
  emoji: string;
};

const QUESTIONS: Question[] = [
  { prompt: "Why does lightning happen?", choices: ["Electric charge builds up in clouds", "The moon shakes the sky", "Clouds are made of fire"], answer: 0, explanation: "Positive and negative charges separate inside storm clouds. Electricity jumps when the difference becomes large enough.", topic: "Earth", emoji: "⚡" },
  { prompt: "Why can snow become a snowball?", choices: ["Snow is magnetic", "Pressure helps crystals stick together", "Snow contains glue"], answer: 1, explanation: "Pressing snow can melt a tiny layer of water. It refreezes and locks the crystals together.", topic: "Earth", emoji: "❄️" },
  { prompt: "What causes day and night?", choices: ["Earth spins", "The Sun turns off", "Clouds cover the sky"], answer: 0, explanation: "Earth rotates once about every 24 hours. The side facing the Sun has day.", topic: "Earth", emoji: "🌍" },
  { prompt: "Why do volcanoes erupt?", choices: ["Hot rock and gas push upward", "Mountains get angry", "Rain fills them up"], answer: 0, explanation: "Magma and gas build pressure below Earth’s surface until they escape.", topic: "Earth", emoji: "🌋" },
  { prompt: "Where does rain come from?", choices: ["Water vapor cools into droplets", "Stars melt", "Trees throw water upward"], answer: 0, explanation: "Water evaporates, rises, cools into cloud droplets, and falls when the droplets grow heavy.", topic: "Earth", emoji: "🌧️" },
  { prompt: "Why do people sweat?", choices: ["To make skin shiny", "To cool the body", "To store extra water"], answer: 1, explanation: "Sweat carries heat away when it evaporates from the skin.", topic: "Body", emoji: "💧" },
  { prompt: "What does the heart do?", choices: ["Pumps blood", "Stores memories", "Makes bones grow"], answer: 0, explanation: "The heart is a muscular pump that moves blood, oxygen, and nutrients through the body.", topic: "Body", emoji: "❤️" },
  { prompt: "Why do we need air?", choices: ["Cells use oxygen to release energy", "Air makes us taller", "Bones are filled with air"], answer: 0, explanation: "Your cells use oxygen to help release energy from food.", topic: "Body", emoji: "🫁" },
  { prompt: "What protects your brain?", choices: ["The skull", "The stomach", "The elbow"], answer: 0, explanation: "The skull is a strong bony case surrounding the brain.", topic: "Body", emoji: "🧠" },
  { prompt: "Why do muscles get tired?", choices: ["They use energy and need recovery", "They forget how to move", "They turn into bone"], answer: 0, explanation: "Working muscles use stored energy and may need oxygen, nutrients, and rest to recover.", topic: "Body", emoji: "💪" },
  { prompt: "What is the Sun?", choices: ["A planet", "A star", "A moon"], answer: 1, explanation: "The Sun is a star made mostly of extremely hot hydrogen and helium.", topic: "Space", emoji: "☀️" },
  { prompt: "Why does the Moon seem to change shape?", choices: ["We see different sunlit portions", "It loses pieces", "Clouds paint it"], answer: 0, explanation: "As the Moon orbits Earth, we see different amounts of its sunlit half.", topic: "Space", emoji: "🌙" },
  { prompt: "Which planet is called the red planet?", choices: ["Mars", "Venus", "Neptune"], answer: 0, explanation: "Iron minerals in Martian soil oxidize, giving Mars its rusty red color.", topic: "Space", emoji: "🔴" },
  { prompt: "What keeps planets moving around the Sun?", choices: ["Gravity", "Wind", "Magnets in space"], answer: 0, explanation: "The Sun’s gravity bends each planet’s forward motion into an orbit.", topic: "Space", emoji: "🪐" },
  { prompt: "Why do astronauts float in orbit?", choices: ["They are continuously falling around Earth", "Space has magic air", "Their suits lift them"], answer: 0, explanation: "Astronauts and their spacecraft fall together around Earth, creating microgravity.", topic: "Space", emoji: "🧑‍🚀" },
  { prompt: "Why do computers need time to load?", choices: ["They gather and process instructions", "They get tired", "They wait for permission from the Moon"], answer: 0, explanation: "A computer must find, process, and arrange information before showing the next screen.", topic: "Technology", emoji: "💻" },
  { prompt: "What does a battery store?", choices: ["Chemical energy", "Tiny robots", "Cold air"], answer: 0, explanation: "A battery stores chemical energy that can be changed into electrical energy.", topic: "Technology", emoji: "🔋" },
  { prompt: "What is a robot?", choices: ["A machine that follows instructions", "A metal animal", "A talking battery"], answer: 0, explanation: "Robots are machines designed to sense, compute, and perform actions.", topic: "Technology", emoji: "🤖" },
  { prompt: "What carries information through the internet?", choices: ["Data signals", "Paper airplanes", "Ocean waves only"], answer: 0, explanation: "Information is encoded into signals that travel through cables, fiber optics, and radio waves.", topic: "Technology", emoji: "🌐" },
  { prompt: "Why does a light bulb glow?", choices: ["Electrical energy becomes light and heat", "It stores sunlight", "Glass creates fire"], answer: 0, explanation: "A bulb converts electrical energy into light, with some energy also becoming heat.", topic: "Technology", emoji: "💡" },
];

const ROUND_SIZE = 8;

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function ScienceQuestPage() {
  const { recordPlay, award, progress } = useAdrianProgress();
  const [topic, setTopic] = useState<Topic>("All");
  const [session, setSession] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState<Question[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const current = session[index];
  const bestScore = progress.games["science-quest"]?.bestScore ?? 0;

  function startGame(useMissed = false) {
    const pool = useMissed
      ? missed
      : QUESTIONS.filter((question) => topic === "All" || question.topic === topic);
    const selected = useMissed ? [...pool] : shuffled(pool).slice(0, Math.min(ROUND_SIZE, pool.length));

    setSession(selected);
    setIndex(0);
    setChoice(null);
    setScore(0);
    setStreak(0);
    if (!useMissed) setMissed([]);
    setPlaying(true);
    setDone(false);
    setReviewMode(useMissed);
    recordPlay("science-quest");
  }

  function answer(value: number) {
    if (choice !== null || !current) return;
    setChoice(value);

    if (value === current.answer) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setScore((currentScore) => currentScore + 10 + Math.min(10, nextStreak * 2));
    } else {
      setStreak(0);
      setMissed((items) => items.some((item) => item.prompt === current.prompt) ? items : [...items, current]);
    }
  }

  function next() {
    if (index < session.length - 1) {
      setIndex((value) => value + 1);
      setChoice(null);
      return;
    }

    const xp = reviewMode ? 10 + Math.floor(score / 3) : 35 + Math.floor(score / 2);
    const coins = reviewMode ? 2 : Math.max(5, Math.floor(score / 18));
    award("science-quest", { xp, coins, score, completed: !reviewMode });
    setPlaying(false);
    setDone(true);
  }

  if (!playing && !done) {
    return (
      <GameFrame title="Science Quest">
        <section style={panelStyle}>
          <div style={{ fontSize: 68 }}>🔬</div>
          <span style={eyebrowStyle}>RANDOM SCIENCE MISSIONS</span>
          <h1 style={titleStyle}>Choose a science world.</h1>
          <p style={mutedStyle}>Each round pulls eight different questions from a larger question bank.</p>
          <div style={optionRowStyle}>
            {(["All", "Earth", "Body", "Space", "Technology"] as Topic[]).map((item) => (
              <button key={item} onClick={() => setTopic(item)} style={pillStyle(topic === item)}>{item}</button>
            ))}
          </div>
          <button onClick={() => startGame(false)} style={primaryStyle}>Launch Quest</button>
          <p style={mutedStyle}>Personal best: {bestScore}</p>
        </section>
      </GameFrame>
    );
  }

  if (done) {
    return (
      <GameFrame title="Science Quest">
        <section style={panelStyle}>
          <div style={{ fontSize: 68 }}>{missed.length === 0 ? "🏆" : "🧪"}</div>
          <span style={eyebrowStyle}>{reviewMode ? "REVIEW COMPLETE" : "QUEST COMPLETE"}</span>
          <h1 style={titleStyle}>{score} points</h1>
          <p style={mutedStyle}>
            {missed.length === 0 ? "Perfect expedition. Every answer was correct." : `${missed.length} question${missed.length === 1 ? "" : "s"} ready for another look.`}
          </p>
          <div style={optionRowStyle}>
            {missed.length > 0 && !reviewMode && <button onClick={() => startGame(true)} style={primaryStyle}>Review Missed Questions</button>}
            <button onClick={() => startGame(false)} style={primaryStyle}>New Random Quest</button>
            <Link href="/" style={secondaryLinkStyle}>Go Home</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  const correct = choice !== null && choice === current.answer;

  return (
    <GameFrame title="Science Quest">
      <div style={{ width: "min(840px,100%)", margin: "0 auto" }}>
        <div style={statsStyle}>
          <span>{reviewMode ? "Review" : current.topic}</span>
          <span>Question {index + 1} of {session.length}</span>
          <span>Score {score} · Streak {streak}</span>
        </div>
        <section style={panelStyle}>
          <div style={{ fontSize: 64 }}>{current.emoji}</div>
          <span style={eyebrowStyle}>SCIENCE QUEST</span>
          <h1 style={{ ...titleStyle, fontSize: "clamp(2rem,6vw,4rem)" }}>{current.prompt}</h1>
          <div style={{ display: "grid", gap: 11 }}>
            {current.choices.map((answerText, answerIndex) => {
              const showCorrect = choice !== null && answerIndex === current.answer;
              const showWrong = choice === answerIndex && answerIndex !== current.answer;
              return (
                <button
                  key={answerText}
                  onClick={() => answer(answerIndex)}
                  style={{
                    ...answerStyle,
                    background: showCorrect ? "#d9ff5b" : showWrong ? "#ffb5bf" : "#222936",
                    color: showCorrect || showWrong ? "#10131b" : "#fff",
                  }}
                >
                  <strong>{String.fromCharCode(65 + answerIndex)}.</strong> {answerText}
                </button>
              );
            })}
          </div>

          {choice !== null && (
            <div style={explanationStyle}>
              <strong style={{ color: correct ? "#d9ff5b" : "#ffb5bf" }}>{correct ? "Correct!" : "Good try."}</strong>
              <p style={mutedStyle}>{current.explanation}</p>
              <button onClick={next} style={primaryStyle}>{index === session.length - 1 ? "See Results" : "Next Question"}</button>
            </div>
          )}
        </section>
      </div>
    </GameFrame>
  );
}

const panelStyle: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,52px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const eyebrowStyle: React.CSSProperties = { color: "#d9ff5b", fontSize: 12, fontWeight: 950, letterSpacing: ".18em" };
const titleStyle: React.CSSProperties = { margin: "14px 0 26px", fontSize: "clamp(2.5rem,7vw,5rem)", lineHeight: .96, letterSpacing: "-.06em" };
const mutedStyle: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const optionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", margin: "22px 0" };
const statsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, color: "#aab1bf", fontWeight: 850 };
const primaryStyle: React.CSSProperties = { padding: "13px 20px", border: "2px solid #d9ff5b", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { padding: "13px 20px", border: "2px solid #fff", borderRadius: 999, background: "#fff", color: "#10131b", fontWeight: 950, display: "inline-block" };
const pillStyle = (active: boolean): React.CSSProperties => ({ padding: "11px 15px", borderRadius: 999, border: active ? "2px solid #d9ff5b" : "1px solid rgba(255,255,255,.15)", background: active ? "rgba(217,255,91,.12)" : "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" });
const answerStyle: React.CSSProperties = { minHeight: 66, padding: "14px 16px", border: "1px solid rgba(255,255,255,.13)", borderRadius: 18, textAlign: "left", fontSize: 16, fontWeight: 800, cursor: "pointer" };
const explanationStyle: React.CSSProperties = { marginTop: 22, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.11)" };