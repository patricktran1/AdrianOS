"use client";

import GameFrame from "@/components/GameFrame";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { useGameSession } from "@/lib/game-session";
import { useMemo, useState } from "react";

const GAME_SLUG = "family-quest-party";
type Card = { prompt: string; choices: string[]; answer: string; clue: string; celebration: string };

const CARDS: Record<ElementaryGrade, Card[]> = {
  [-1]: [
    { prompt: "How many party balloons? 🎈🎈🎈", choices: ["2", "3", "4"], answer: "3", clue: "Touch each balloon once.", celebration: "Counting star!" },
    { prompt: "Which begins like moon? 🌙", choices: ["map", "sun", "fish"], answer: "map", clue: "Listen for /m/.", celebration: "Sound detective!" },
    { prompt: "What comes next? 🔵🟡🔵🟡", choices: ["🔵", "🟡", "🟢"], answer: "🔵", clue: "The two-color pattern repeats.", celebration: "Pattern power!" },
  ],
  0: [
    { prompt: "How many stars? ⭐⭐⭐⭐⭐", choices: ["4", "5", "6"], answer: "5", clue: "Count each star once.", celebration: "Star counter!" },
    { prompt: "Which word rhymes with cat?", choices: ["hat", "dog", "sun"], answer: "hat", clue: "Listen to the ending sound.", celebration: "Rhyme time!" },
    { prompt: "Which shape has 3 sides?", choices: ["triangle", "square", "circle"], answer: "triangle", clue: "Count the sides.", celebration: "Shape scout!" },
  ],
  1: [
    { prompt: "8 + 5 = ?", choices: ["12", "13", "14"], answer: "13", clue: "Make ten, then add three.", celebration: "Math boost!" },
    { prompt: "Which word has long a?", choices: ["cake", "cat", "cap"], answer: "cake", clue: "Silent e helps a say its name.", celebration: "Word wizard!" },
    { prompt: "Which material lets light through?", choices: ["clear glass", "wood", "cardboard"], answer: "clear glass", clue: "Choose what you can see through.", celebration: "Science spark!" },
  ],
  2: [
    { prompt: "27 + 18 = ?", choices: ["35", "45", "55"], answer: "45", clue: "Add ones, regroup, then add tens.", celebration: "Number hero!" },
    { prompt: "Which detail proves the cave was dark?", choices: ["No sunlight reached inside", "It was near a hill", "A bird flew past"], answer: "No sunlight reached inside", clue: "Choose evidence about light.", celebration: "Evidence expert!" },
    { prompt: "Which material best cushions an egg?", choices: ["soft foam", "thin paper", "metal spoon"], answer: "soft foam", clue: "Pick the material that absorbs impact.", celebration: "Engineer move!" },
  ],
  3: [
    { prompt: "7 × 6 = ?", choices: ["36", "42", "48"], answer: "42", clue: "Add six seven times.", celebration: "Combo captain!" },
    { prompt: "What do roots absorb?", choices: ["water", "sunlight", "wind"], answer: "water", clue: "Roots are underground.", celebration: "Science save!" },
    { prompt: "Which detail best shows the bridge was strong?", choices: ["It held 50 crates", "It was blue", "It crossed a river"], answer: "It held 50 crates", clue: "Choose evidence about strength.", celebration: "Proof found!" },
  ],
  4: [
    { prompt: "Which equals 3/4?", choices: ["6/8", "4/8", "3/8"], answer: "6/8", clue: "Multiply top and bottom by two.", celebration: "Fraction force!" },
    { prompt: "26 × 5 = ?", choices: ["120", "130", "140"], answer: "130", clue: "Five groups of 20 plus five groups of 6.", celebration: "Power product!" },
    { prompt: "What most directly causes erosion?", choices: ["moving water", "moonlight", "shadows"], answer: "moving water", clue: "Look for what carries soil away.", celebration: "Earth expert!" },
  ],
  5: [
    { prompt: "Which is greater: 0.72 or 0.7?", choices: ["0.72", "0.7", "equal"], answer: "0.72", clue: "Write 0.7 as 0.70.", celebration: "Decimal defender!" },
    { prompt: "1/3 + 1/6 = ?", choices: ["1/2", "2/9", "1/9"], answer: "1/2", clue: "Rename thirds as sixths.", celebration: "Fraction finisher!" },
    { prompt: "Why do some stars look brighter?", choices: ["They may be closer", "They are always larger", "They make more planets"], answer: "They may be closer", clue: "Apparent brightness depends partly on distance.", celebration: "Cosmic thinker!" },
  ],
};

export default function FamilyQuestParty() {
  const { family, activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [started, setStarted] = useState(false);
  const [turn, setTurn] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [message, setMessage] = useState("");
  const [stars, setStars] = useState(0);
  const [finished, setFinished] = useState(false);

  const players = useMemo(() => {
    if (!hydrated) return [activeProfile];
    return family.profiles.length > 1
      ? family.profiles.slice(0, 2)
      : [activeProfile, { ...activeProfile, id: "grown-up-buddy", name: "Grown-up Buddy", emoji: "🦸" }];
  }, [activeProfile, family.profiles, hydrated]);

  const player = players[turn % players.length];
  const grade = player.id === "grown-up-buddy" ? readProfileGrade(activeProfile) : readProfileGrade(player);
  const round = Math.floor(turn / players.length);
  const card = CARDS[grade][round % CARDS[grade].length];
  const totalTurns = players.length * 3;

  function answer(choice: string) {
    if (choice !== card.answer) {
      setWrong(true);
      setMessage(card.clue);
      return;
    }
    const earned = wrong ? 1 : 2;
    setStars((value) => value + earned);
    setMessage(`${card.celebration} +${earned} team star${earned === 1 ? "" : "s"}!`);
    setWrong(false);
    if (turn + 1 >= totalTurns) {
      completeGame({ xp: 90, coins: 45, score: stars + earned });
      setFinished(true);
    } else {
      window.setTimeout(() => {
        setTurn((value) => value + 1);
        setMessage("");
      }, 550);
    }
  }

  function replay() {
    restartGame();
    setTurn(0);
    setWrong(false);
    setMessage("");
    setStars(0);
    setFinished(false);
    setStarted(true);
  }

  return (
    <GameFrame title="Family Quest Party">
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: "18px" }}>
        {!started ? (
          <section>
            <div style={{ fontSize: 72 }}>🎲✨</div>
            <h1>Family Quest Party</h1>
            <p>Pass the device. Every hero gets a challenge matched to their own grade.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", margin: "24px 0" }}>
              {players.map((hero) => <div key={hero.id} style={{ padding: 18, borderRadius: 22, background: "rgba(255,255,255,.12)", minWidth: 150 }}><div style={{ fontSize: 44 }}>{hero.emoji}</div><strong>{hero.name}</strong></div>)}
            </div>
            <button onClick={() => setStarted(true)} style={{ minHeight: 76, padding: "0 30px", fontSize: 22, borderRadius: 22 }}>Start the party →</button>
          </section>
        ) : finished ? (
          <section>
            <div style={{ fontSize: 76 }}>🏆</div>
            <h1>Team treasure unlocked!</h1>
            <p style={{ fontSize: 24 }}>You earned {stars} team stars together.</p>
            <p>Everyone helped. Everyone learned. That is a party win.</p>
            <button onClick={replay} style={{ minHeight: 76, padding: "0 30px", fontSize: 22, borderRadius: 22 }}>Play another party →</button>
          </section>
        ) : (
          <section>
            <div aria-label="team progress" style={{ fontWeight: 800, marginBottom: 14 }}>Round {round + 1} of 3 · ⭐ {stars}</div>
            <div style={{ padding: 18, borderRadius: 24, background: "rgba(255,255,255,.12)", marginBottom: 18 }}>
              <div style={{ fontSize: 48 }}>{player.emoji}</div>
              <h2>{player.name}&apos;s turn!</h2>
              <p>Pass the device to {player.name}.</p>
            </div>
            <h1>{card.prompt}</h1>
            <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
              {card.choices.map((choice) => (
                <button key={choice} data-correct={choice === card.answer} onClick={() => answer(choice)} style={{ minHeight: 76, padding: 14, fontSize: 20, borderRadius: 20 }}>{choice}</button>
              ))}
            </div>
            {message && <div role="status" style={{ marginTop: 18, padding: 16, borderRadius: 18, background: wrong ? "#fff3b0" : "#d9ffbf", color: "#1a1a1a", fontWeight: 800 }}>{wrong ? `Coach clue: ${message}` : message}</div>}
          </section>
        )}
      </div>
    </GameFrame>
  );
}
