"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import {
  dailyRemixDateKey,
  dailyRemixMissions,
  REMIX_THEMES,
  type RemixMission,
} from "@/lib/daily-adventure-remix";
import {
  claimDailyRemix,
  readDailyRemixState,
} from "@/lib/daily-adventure-remix-state";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "daily-adventure-remix";
type Stage = "loading" | "intro" | "play" | "checkpoint" | "finish";
type Feedback = "question" | "hint" | "explanation";
type PowerId = "compass" | "shield" | "magnet";

const POWERS: Array<{ id: PowerId; emoji: string; title: string; description: string }> = [
  { id: "compass", emoji: "🧭", title: "Clue Compass", description: "Reveal one clue before choosing, with no heart lost." },
  { id: "shield", emoji: "🛡️", title: "Extra Shield", description: "Begin the run with one extra heart." },
  { id: "magnet", emoji: "✨", title: "Treasure Magnet", description: "First-try answers earn one extra treasure." },
];

function tone(enabled: boolean, correct: boolean) {
  if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.value = correct ? 780 : 220;
  gain.gain.setValueAtTime(.055, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .18);
  oscillator.start();
  oscillator.stop(context.currentTime + .19);
  oscillator.addEventListener("ended", () => void context.close());
}

function heartRow(count: number) {
  return count > 0 ? Array.from({ length: count }, () => "❤️").join(" ") : "💫";
}

export default function DailyAdventureRemixPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [day, setDay] = useState("");
  const [stage, setStage] = useState<Stage>("loading");
  const [power, setPower] = useState<PowerId | null>(null);
  const [powerUsed, setPowerUsed] = useState(false);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("question");
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hearts, setHearts] = useState(3);
  const [treasure, setTreasure] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [firstToday, setFirstToday] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const nextDay = dailyRemixDateKey();
    const nextGrade = readProfileGrade(activeProfile);
    const daily = readDailyRemixState(activeProfile.id, nextDay);
    setDay(nextDay);
    setGrade(nextGrade);
    setStreak(daily.streak);
    setBestStreak(daily.bestStreak);
    setCompletedToday(daily.completedToday);
    setStage("intro");
  }, [activeProfile.id, activeProfile.age, hydrated]);

  const theme = grade === null ? null : REMIX_THEMES[grade];
  const missions = useMemo(
    () => grade === null || !day ? [] : dailyRemixMissions(grade, activeProfile.id, day),
    [activeProfile.id, day, grade]
  );
  const mission = missions[index] as RemixMission | undefined;
  const baseHearts = power === "shield" ? 4 : 3;

  function saveAttempt(correct: boolean) {
    if (!mission) return;
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: mission.subject,
      skillId: mission.skillId,
      skillLabel: mission.skillLabel,
      prompt: mission.prompt,
      correctAnswer: mission.answer,
      correct,
      data: {
        standardCode: mission.standard,
        dailyRemix: true,
        remixDate: day,
        grade: grade ?? 0,
        adaptiveSupport: wrongAttempts > 0 || usedHint,
      },
    }, activeProfile.id);
  }

  function beginRun() {
    if (!power) return;
    setHearts(power === "shield" ? 4 : 3);
    setStage("play");
  }

  function useCompass() {
    if (power !== "compass" || powerUsed || feedback !== "question") return;
    setPowerUsed(true);
    setUsedHint(true);
    setFeedback("hint");
  }

  function choose(choice: string) {
    if (!mission || feedback === "explanation") return;
    setSelected(choice);
    const correct = choice === mission.answer;

    if (!correct && wrongAttempts === 0) {
      saveAttempt(false);
      setWrongAttempts(1);
      setUsedHint(true);
      setFeedback("hint");
      setHearts((value) => Math.max(0, value - 1));
      setCombo(0);
      tone(soundOn, false);
      return;
    }

    if (!correct) {
      setWrongAttempts((value) => value + 1);
      setFeedback("explanation");
      setCombo(0);
      tone(soundOn, false);
      return;
    }

    saveAttempt(true);
    const independent = wrongAttempts === 0 && !usedHint;
    const nextCombo = independent ? combo + 1 : 0;
    const baseTreasure = independent ? 2 : 1;
    const magnetBonus = independent && power === "magnet" ? 1 : 0;
    setTreasure((value) => value + baseTreasure + magnetBonus);
    setCombo(nextCombo);
    setBestCombo((value) => Math.max(value, nextCombo));
    setFeedback("explanation");
    tone(soundOn, true);
  }

  function resetQuestion() {
    setFeedback("question");
    setSelected(null);
    setWrongAttempts(0);
    setUsedHint(false);
  }

  function advance() {
    if (index === missions.length - 1) {
      finishRun();
      return;
    }
    if (index === 2) {
      setStage("checkpoint");
      return;
    }
    setIndex((value) => value + 1);
    resetQuestion();
  }

  function continueCheckpoint() {
    setHearts((value) => Math.min(baseHearts, value + 1));
    setIndex((value) => value + 1);
    resetQuestion();
    setStage("play");
  }

  function finishRun() {
    const claim = claimDailyRemix(activeProfile.id, day);
    const xp = claim.firstToday ? 36 + treasure + bestCombo * 2 : 8;
    const coins = claim.firstToday ? 8 + Math.floor(treasure / 2) : 1;
    completeGame({ xp, coins, score: treasure * 100 + bestCombo * 35 + hearts * 20 });
    setFirstToday(claim.firstToday);
    setCompletedToday(true);
    setStreak(claim.streak);
    setBestStreak(claim.bestStreak);
    setStage("finish");
  }

  function replay() {
    restartGame();
    setStage("intro");
    setPower(null);
    setPowerUsed(false);
    setIndex(0);
    resetQuestion();
    setHearts(3);
    setTreasure(0);
    setCombo(0);
    setBestCombo(0);
    setFirstToday(false);
  }

  function speakMission() {
    if (!mission || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${mission.prompt}. ${mission.visual}`);
    utterance.rate = grade !== null && grade <= 0 ? .78 : .9;
    window.speechSynthesis.speak(utterance);
  }

  if (stage === "loading" || !theme || !mission) {
    return <GameFrame title="Daily Adventure Remix"><main style={loadingPage}>Building today’s adventure…</main></GameFrame>;
  }

  if (stage === "intro") {
    return (
      <GameFrame title={theme.title}>
        <style>{css}</style>
        <main style={{ ...page, background: theme.background }}>
          <section style={hero}>
            <div className="remix-float" style={heroEmoji}>{theme.emoji}</div>
            <span style={{ ...eyebrow, color: theme.accent }}>{theme.eyebrow}</span>
            <h1 style={heroTitle}>{theme.title}</h1>
            <p style={lead}>{theme.description}</p>
            <div style={dailyBadge}>{completedToday ? "✓ Today’s treasure collected" : `NEW DAILY RUN · ${day}`}</div>
            <div style={streakRow}><strong>🔥 {streak} day streak</strong><span>Best {bestStreak}</span></div>
            <h2 style={chooseTitle}>Choose one run power</h2>
            <div style={powerGrid}>
              {POWERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPower(item.id)}
                  aria-pressed={power === item.id}
                  style={{ ...powerButton, ...(power === item.id ? { borderColor: theme.accent, background: `${theme.accent}18` } : {}) }}
                >
                  <span style={{ fontSize: 36 }}>{item.emoji}</span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
            <button type="button" onClick={beginRun} disabled={!power} style={{ ...primary, background: theme.accent, opacity: power ? 1 : .45 }}>
              Start today’s remix →
            </button>
            <button type="button" onClick={() => setSoundOn((value) => !value)} style={secondary}>{soundOn ? "🔊 Sound on" : "🔇 Sound off"}</button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (stage === "checkpoint") {
    return (
      <GameFrame title={theme.title}>
        <style>{css}</style>
        <main style={{ ...page, background: theme.background }}>
          <section style={hero}>
            <div className="remix-pop" style={heroEmoji}>🏁{theme.emoji}</div>
            <span style={{ ...eyebrow, color: theme.accent }}>MID-RUN CHECKPOINT</span>
            <h1 style={sectionTitle}>Three gates cleared!</h1>
            <p style={lead}>{theme.hero} found a heart refill. Two surprise gates remain.</p>
            <div style={stats}><strong>{heartRow(hearts)}</strong><strong>🔥 {bestCombo}×</strong><strong>💎 {treasure}</strong></div>
            <button type="button" onClick={continueCheckpoint} style={{ ...primary, background: theme.accent }}>Continue the remix →</button>
          </section>
        </main>
      </GameFrame>
    );
  }

  if (stage === "finish") {
    return (
      <GameFrame title={theme.title}>
        <style>{css}</style>
        <main style={{ ...page, background: theme.background }}>
          <section style={hero}>
            <div className="remix-pop" style={heroEmoji}>{theme.emoji}🏆</div>
            <span style={{ ...eyebrow, color: theme.accent }}>DAILY REMIX COMPLETE</span>
            <h1 style={sectionTitle}>{activeProfile.name} cleared {theme.shortTitle}!</h1>
            <p style={lead}>{firstToday ? `Today’s ${theme.treasure} are saved. Come back tomorrow for a different five-gate run.` : "Practice replay complete. The large daily reward can only be collected once each day."}</p>
            <div style={stats}><strong>💎 {treasure} {theme.treasure}</strong><strong>🔥 {bestCombo}× combo</strong><strong>📆 {streak} day streak</strong></div>
            <button type="button" onClick={replay} style={{ ...primary, background: theme.accent }}>Replay today’s route</button>
            <Link href="/school" style={link}>Return to School Mode</Link>
          </section>
        </main>
      </GameFrame>
    );
  }

  const revealCorrect = feedback === "explanation";
  return (
    <GameFrame title={theme.title}>
      <style>{css}</style>
      <main style={{ ...page, background: theme.background }}>
        <header style={hud}>
          <div><strong>{theme.emoji} {theme.hero}</strong><small>Gate {index + 1} of {missions.length}</small></div>
          <div style={hudStats}><span>{heartRow(hearts)}</span><span>🔥 {combo}×</span><span>💎 {treasure}</span><button type="button" onClick={() => setSoundOn((value) => !value)} style={soundButton}>{soundOn ? "🔊" : "🔇"}</button></div>
        </header>
        <section style={track}><div className="remix-run" style={{ ...trackFill, width: `${((index + (feedback === "explanation" ? 1 : 0)) / missions.length) * 100}%`, background: theme.accent }}><span>{theme.emoji}</span></div></section>
        <section style={{ ...card, borderColor: `${theme.accent}88` }}>
          <div style={topRow}><span style={{ ...subjectChip, background: theme.accent }}>{mission.subject}</span><span style={standard}>{mission.standard}</span></div>
          <div className="remix-float" style={visual}>{mission.visual}</div>
          <h1 style={question}>{mission.prompt}</h1>
          {(grade <= 0 || mission.prompt.length > 70) && <button type="button" onClick={speakMission} style={listenButton}>🔊 Read it aloud</button>}
          <div style={choiceGrid}>
            {mission.choices.map((choice) => {
              const right = choice === mission.answer;
              const wrong = selected === choice && !right;
              return (
                <button
                  key={choice}
                  type="button"
                  data-correct={right ? "true" : "false"}
                  onClick={() => choose(choice)}
                  disabled={feedback === "explanation" || wrong}
                  style={{ ...choiceButton, minHeight: grade <= 0 ? 92 : 76, ...(revealCorrect && right ? correctStyle : wrong ? wrongStyle : {}) }}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          <section role="status" style={teaching}>
            <div>
              <strong style={{ color: theme.accent }}>{feedback === "question" ? "CHOOSE A GATE" : feedback === "hint" ? "CLUE UNLOCKED" : "GATE REPORT"}</strong>
              <p>{feedback === "question" ? "Pick the best answer. A first miss opens a clue instead of ending the run." : feedback === "hint" ? mission.hint : selected === mission.answer ? mission.explanation : `The answer is ${mission.answer}. ${mission.explanation}`}</p>
            </div>
            {feedback === "question" && power === "compass" && !powerUsed ? (
              <button type="button" onClick={useCompass} style={hintButton}>🧭 Use Clue Compass</button>
            ) : feedback === "hint" ? (
              <span style={retry}>Try another gate. The run continues.</span>
            ) : feedback === "explanation" ? (
              <button type="button" onClick={advance} style={{ ...primary, background: theme.accent }}>
                {index === missions.length - 1 ? "Finish today’s remix →" : index === 2 ? "Open checkpoint →" : "Next gate →"}
              </button>
            ) : null}
          </section>
        </section>
      </main>
    </GameFrame>
  );
}

const css = `@keyframes remixFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}@keyframes remixPop{0%{transform:scale(.72);opacity:0}75%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}@keyframes remixRun{0%,100%{transform:translateX(-2px)}50%{transform:translateX(5px)}}.remix-float{animation:remixFloat 2s ease-in-out infinite}.remix-pop{animation:remixPop .48s ease-out both}.remix-run span{display:block;animation:remixRun .55s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.remix-float,.remix-pop,.remix-run span{animation:none}}`;
const loadingPage: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#10131b", color: "#fff", fontSize: 24, fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 82px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.91)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 28px 80px rgba(0,0,0,.32)" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(5rem,17vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const heroTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(3rem,9vw,6.4rem)", lineHeight: .88, letterSpacing: "-.07em" };
const sectionTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.7rem,8vw,5.2rem)", lineHeight: .91, letterSpacing: "-.06em" };
const lead: React.CSSProperties = { maxWidth: 720, margin: "13px auto 22px", color: "#c6ceda", lineHeight: 1.6, fontWeight: 700 };
const dailyBadge: React.CSSProperties = { display: "inline-block", padding: "8px 12px", borderRadius: 999, background: "#10131b", color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".08em" };
const streakRow: React.CSSProperties = { margin: "14px auto", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", color: "#fff" };
const chooseTitle: React.CSSProperties = { margin: "28px 0 12px", fontSize: 22 };
const powerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, margin: "0 auto 18px" };
const powerButton: React.CSSProperties = { minHeight: 150, display: "grid", placeItems: "center", gap: 6, padding: 16, borderRadius: 20, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", cursor: "pointer" };
const primary: React.CSSProperties = { margin: 6, padding: "14px 20px", borderRadius: 999, border: 0, color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const link: React.CSSProperties = { ...secondary, display: "inline-block", textDecoration: "none" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 13, flexWrap: "wrap", margin: "20px 0" };
const hud: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 14, borderRadius: 22, background: "rgba(16,19,27,.92)", border: "1px solid rgba(255,255,255,.12)" };
const hudStats: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const soundButton: React.CSSProperties = { border: 0, background: "transparent", fontSize: 19, cursor: "pointer" };
const track: React.CSSProperties = { width: "min(920px,100%)", height: 18, margin: "0 auto 12px", borderRadius: 999, background: "rgba(16,19,27,.78)", overflow: "hidden" };
const trackFill: React.CSSProperties = { height: "100%", display: "flex", justifyContent: "flex-end", alignItems: "center", borderRadius: 999, transition: "width .35s ease", color: "#10131b" };
const card: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto", padding: "clamp(22px,5vw,46px)", borderRadius: 30, background: "rgba(18,24,36,.94)", border: "1px solid rgba(255,255,255,.14)", textAlign: "center" };
const topRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const subjectChip: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, color: "#10131b", fontSize: 11, fontWeight: 950 };
const standard: React.CSSProperties = { color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const visual: React.CSSProperties = { margin: "22px auto 8px", fontSize: "clamp(2.1rem,8vw,4.2rem)", lineHeight: 1.3 };
const question: React.CSSProperties = { maxWidth: 800, margin: "10px auto 20px", fontSize: "clamp(2rem,6vw,4rem)", lineHeight: 1.02, letterSpacing: "-.045em" };
const listenButton: React.CSSProperties = { margin: "-6px auto 18px", padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 11 };
const choiceButton: React.CSSProperties = { padding: "14px", borderRadius: 20, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: "clamp(1.05rem,3vw,1.4rem)", fontWeight: 900, cursor: "pointer" };
const correctStyle: React.CSSProperties = { background: "#d9ff5b", color: "#10131b", borderColor: "#d9ff5b" };
const wrongStyle: React.CSSProperties = { background: "#ffb5bf", color: "#10131b", borderColor: "#ffb5bf" };
const teaching: React.CSSProperties = { marginTop: 18, padding: 17, borderRadius: 20, background: "#10131b", border: "1px solid rgba(255,255,255,.09)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 14, alignItems: "center", textAlign: "left" };
const hintButton: React.CSSProperties = { padding: "11px 14px", borderRadius: 999, border: "1px solid rgba(127,220,255,.3)", background: "rgba(127,220,255,.1)", color: "#7fdcff", fontWeight: 950, cursor: "pointer" };
const retry: React.CSSProperties = { color: "#c6b8ff", fontWeight: 850 };
