"use client";

import { useAdrianProgress } from "@/lib/adrian-progress";
import { useEffect, useRef, useState } from "react";

const GAME_SLUG = "question-quest";
const QUESTIONS = [
  {
    question: "Why do computers need time to load?",
    answers: [
      "They are waking from a nap",
      "They are finding and arranging the information",
      "They are waiting for permission from the moon",
    ],
    correct: 1,
    fact: "Loading is the computer gathering instructions, images, and data so it can show the next thing correctly.",
  },
  {
    question: "What makes lightning?",
    answers: [
      "Electric charge building up in clouds",
      "Clouds bumping into airplanes",
      "The sun taking a photograph",
    ],
    correct: 0,
    fact: "Charges separate inside storm clouds. When the difference gets large enough, electricity jumps through the air.",
  },
  {
    question: "Why can snow stick into a snowball?",
    answers: [
      "The snow is magnetic",
      "Pressure and a little melting help crystals bond",
      "Snow is made of glue",
    ],
    correct: 1,
    fact: "Pressing snow together can melt a microscopic layer. It refreezes and helps the crystals lock together.",
  },
  {
    question: "Why do people sweat?",
    answers: [
      "To cool the body",
      "To make the skin shiny",
      "To store extra water",
    ],
    correct: 0,
    fact: "Sweat takes heat with it when it evaporates, helping keep body temperature in a safe range.",
  },
];

export default function QuestionQuest() {
  const { recordPlay, award } = useAdrianProgress();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const completionRecorded = useRef(false);
  const current = QUESTIONS[index];

  useEffect(() => {
    recordPlay(GAME_SLUG);
  }, [recordPlay]);

  useEffect(() => {
    if (!finished || completionRecorded.current) return;
    completionRecorded.current = true;
    award(GAME_SLUG, { xp: 16 + score * 5, coins: 5, score, completed: true });
  }, [finished, score, award]);

  function answer(answerIndex: number) {
    if (choice !== null) return;
    setChoice(answerIndex);
    if (answerIndex === current.correct) setScore((value) => value + 1);
  }

  function next() {
    if (index === QUESTIONS.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setChoice(null);
  }

  function restart() {
    completionRecorded.current = false;
    setIndex(0);
    setScore(0);
    setChoice(null);
    setFinished(false);
    recordPlay(GAME_SLUG);
  }

  if (finished) {
    return (
      <div className="quiz-card centered">
        <span className="eyebrow">QUEST COMPLETE</span>
        <h1>{score} / {QUESTIONS.length}</h1>
        <p>You collected four new pieces of world-knowledge.</p>
        <button className="primary-button" onClick={restart} type="button">Play again</button>
      </div>
    );
  }

  return (
    <div className="quiz-card">
      <div className="quiz-progress">
        <span>Question {index + 1} of {QUESTIONS.length}</span>
        <span>Score {score}</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }} />
      </div>

      <h1>{current.question}</h1>
      <div className="answer-stack">
        {current.answers.map((answerText, answerIndex) => {
          const isCorrect = answerIndex === current.correct;
          const selected = choice === answerIndex;
          let className = "answer-button";
          if (choice !== null && isCorrect) className += " correct";
          if (choice !== null && selected && !isCorrect) className += " wrong";

          return (
            <button
              key={answerText}
              className={className}
              onClick={() => answer(answerIndex)}
              type="button"
            >
              <span>{String.fromCharCode(65 + answerIndex)}</span>
              {answerText}
            </button>
          );
        })}
      </div>

      {choice !== null && (
        <div className="fact-panel">
          <strong>{choice === current.correct ? "Correct." : "Good try."}</strong>
          <p>{current.fact}</p>
          <button className="primary-button" onClick={next} type="button">
            {index === QUESTIONS.length - 1 ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
