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
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "daily-adventure-remix";
type Stage = "loading" | "play" | "finish";
type Feedback = "question" | "hint" | "explanation";
type PowerId = "compass" | "shield" | "magnet";

const POWERS: Array<{ id: PowerId; emoji: string; title: string; description: string }> = [
  { id: "compass", emoji: "🧭", title: "Clue Compass", description: "The first gate opens with a free clue." },
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

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function powerForRun(profileId: string, day: string, runNumber: number): PowerId {
  return POWERS[(hashText(`${profileId}:${day}`) + runNumber) % POWERS.length].id;
}

export default function DailyAdventureRemixPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [day, setDay] = useState("");
  const [stage, setStage] = useState<Stage>("loading");
  const [power, setPower] = useState<PowerId | null>(null);
  const [runNumber, setRunNumber] = useState(0);
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
  const [firstToday, setFirstToday] = useState(false);
  const [checkpointFlash, setCheckpointFlash] = useState(false);
  const checkpointTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const nextDay = dailyRemixDateKey();
    const nextGrade = readProfileGrade(activeProfile);
    const daily = readDailyRemixState(activeProfile.id, nextDay);
    const nextPower = powerForRun(activeProfile.id, nextDay, 0);
    setDay(nextDay);
    setGrade(nextGrade);
    setStreak(daily.streak);
    setBestStreak(daily.bestStreak);
    setRunNumber(0);
    setPower(nextPower);
    setHearts(nextPower === "shield" ? 4 : 3);
    setFeedback(nextPower === "compass" ? "hint" : "question");
    setUsedHint(nextPower === "compass");
    setStage("play");
  }, [activeProfile.id, activeProfile.age, hydrated]);

  useEffect(() => () => {
    if (checkpointTimerRef.current !== null) window.clearTimeout(checkpointTimerRef.current);
  }, []);

  const theme = grade === null ? null : REMIX_THEMES[grade];
  const missions = useMemo(
    () => grade === null || !day ? [] : dailyRemixMissions(grade, activeProfile.id, day),
    [activeProfile.id, day, grade]
  );
  const mission = missions[index] as RemixMission | undefined;
  const powerInfo = POWERS.find((item) => item.id === power);
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

  function showCheckpointFlash() {
    setCheckpointFlash(true);
    if (checkpointTimerRef.current !== null) window.clearTimeout(checkpointTimerRef.current);
    checkpointTimerRef.current = window.setTimeout(() => setCheckpointFlash(false), 1400);
  }

  function advance() {
    if (index === missions.length - 1) {
      finishRun();
      return;
    }
    if (index === 2) {
      setHearts((value) => Math.min(baseHearts, value + 1));
      showCheckpointFlash();
    }
    setIndex((value) => value + 1);
    resetQuestion();
  }

  function finishRun() {
    const claim = claimDailyRemix(activeProfile.id, day);
    const xp = claim.firstToday ? 36 + treasure + bestCombo * 2 : 8;
    const coins = claim.firstToday ? 8 + Math.floor(treasure / 2) : 1;
    completeGame({ xp, coins, score: treasure * 100 + bestCombo * 35 + hearts * 20 });
    setFirstToday(claim.firstToday);
    setStreak(claim.streak);
    setBestStreak(claim.bestStreak);
    setStage("finish");
  }

  function replay() {
    restartGame();
    const nextRun = runNumber + 1;
    const nextPower = powerForRun(activeProfile.id, day, nextRun);
    setRunNumber(nextRun);
    setPower(nextPower);
    setStage("play");
    setIndex(0);
    setSelected(null);
    setWrongAttempts(0);
    setFeedback(nextPower === "compass" ? "hint" : "question");
    setUsedHint(nextPower === "compass");
    setHearts(nextPower === "shield" ? 4 : 3);
    setTreasure(0);
    setCombo(0);
    setBestCombo(0);
    setFirstToday(false);
    setCheckpointFlash(false);
  }

  function speakMission() {
    if (!mission || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${mission.prompt}. ${mission.visual}`);
    utterance.rate = grade !== null && grade <= 0 ? .78 : .9;
    window.speechSynthesis.speak(utterance);
  }

  if (stage === "loading" || !theme || !mission || !powerInfo) {
    return <GameFrame title="Daily Adventure Remix"><main style={loadingPage}>Building today’s adventure…</main></GameFrame>;
  }

  if (stage === "finish") {
    return (
      <GameFrame title={theme.title}>
        <style>{css}</style>
        <main style={{ ...page, background: theme.background }} data-remix-stage="finish">
          <section style={hero}>
            <div className="remix-pop" style={heroEmoji}>{theme.emoji}🏆</div>
            <span style={{ ...eyebrow, color: theme.accent }}>DAILY REMIX COMPLETE</span>
            <h1 style={sectionTitle}>{activeProfile.name} cleared {theme.shortTitle}!</h1>
            <p style={lead}>{firstToday ? `Today’s ${theme.treasure} are saved. Come back tomorrow for a different five-gate run.` : "Practice replay complete. The large daily reward can only be collected once each day."}</p>
            <div style={stats}><strong>💎 {treasure} {theme.treasure}</strong><strong>🔥 {bestCombo}× combo</strong><strong>📆 {streak} day streak</strong></div>
            <button type="button" onClick={replay} style={{ ...primary, background: theme.accent }}>Replay instantly</button>
            <Link href="/school" style={link}>Return to School Mode</Link>
          </section>
        </main>
      </GameFrame>
    );
  }

  const revealCorrect = feedback === "explanation";
  const youngLearner = (grade ?? 0) <= 0;
  return (
    <GameFrame title={theme.title}>
      <style>{css}</style>
      <main
        style={{ ...page, background: theme.background }}
        data-remix-stage="play"
        data-remix-gate={index + 1}
        data-remix-power={power}
      >
        {checkpointFlash && (
          <div className="remix-checkpoint" style={{ ...checkpointToast, borderColor: theme.accent }} aria-hidden="true">
            <span>🏁</span><strong>Checkpoint boost!</strong><small>Heart refilled · Gate 4 unlocked</small>
          </div>
        )}
        <header style={hud}>
          <div><strong>{theme.emoji} {theme.title}</strong><small>Gate {index + 1} of {missions.length}</small></div>
          <div style={hudStats}>
            <span>{heartRow(hearts)}</span>
            <span>🔥 {combo}×</span>
            <span>💎 {treasure}</span>
            <span style={{ ...powerBadge, borderColor: `${theme.accent}66` }} data-remix-power-badge={power} title={powerInfo.description}>
              {powerInfo.emoji} {powerInfo.title}
            </span>
            <button type="button" onClick={() => setSoundOn((value) => !value)} style={soundButton} aria-label={soundOn ? "Turn remix sound off" : "Turn remix sound on"}>{soundOn ? "🔊" : "🔇"}</button>
          </div>
        </header>
        <section style={track}><div className="remix-run" style={{ ...trackFill, width: `${((index + (feedback === "explanation" ? 1 : 0)) / missions.length) * 100}%`, background: theme.accent }}><span>{theme.emoji}</span></div></section>
        <section style={{ ...card, borderColor: `${theme.accent}88` }}>
          <div style={topRow}><span style={{ ...subjectChip, background: theme.accent }}>{mission.subject}</span><span style={standard}>{mission.standard}</span></div>
          <div className="remix-float" style={visual}>{mission.visual}</div>
          <h1 style={question}>{mission.prompt}</h1>
          {(youngLearner || mission.prompt.length > 70) && <button type="button" onClick={speakMission} style={listenButton}>🔊 Read it aloud</button>}
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
                  style={{ ...choiceButton, minHeight: youngLearner ? 92 : 76, ...(revealCorrect && right ? correctStyle : wrong ? wrongStyle : {}) }}
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
            {feedback === "hint" ? (
              <span style={retry}>{power === "compass" && index === 0 && wrongAttempts === 0 ? "Your daily Clue Compass opened this clue automatically." : "Try another gate. The run continues."}</span>
            ) : feedback === "explanation" ? (
              <button
                type="button"
                onClick={advance}
                data-auto-advance="true"
                data-auto-advance-delay="850"
                style={{ ...primary, background: theme.accent }}
              >
                {index === missions.length - 1 ? "Finish today’s remix →" : "Next gate →"}
              </button>
            ) : null}
          </section>
        </section>
      </main>
    </GameFrame>
  );
}

const css = `@keyframes remixFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}@keyframes remixPop{0%{transform:scale(.72);opacity:0}75%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}@keyframes remixRun{0%,100%{transform:translateX(-2px)}50%{transform:translateX(5px)}}@keyframes remixCheckpoint{0%{opacity:0;transform:translate(-50%,16px) scale(.88)}20%,78%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-10px) scale(.96)}}.remix-float{animation:remixFloat 2s ease-in-out infinite}.remix-pop{animation:remixPop .48s ease-out both}.remix-run span{display:block;animation:remixRun .55s ease-in-out infinite}.remix-checkpoint{animation:remixCheckpoint 1.4s ease-out both}@media(prefers-reduced-motion:reduce){.remix-float,.remix-pop,.remix-run span,.remix-checkpoint{animation:none}}`;
const loadingPage: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#10131b", color: "#fff", fontSize: 24, fontWeight: 900 };
const page: React.CSSProperties = { minHeight: "100vh", padding: "20px 14px 82px", color: "#fff" };
const hero: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,7vw,64px)", borderRadius: 34, textAlign: "center", background: "rgba(18,24,36,.91)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 28px 80px rgba(0,0,0,.32)" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(5rem,17vw,9rem)" };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".15em" };
const sectionTitle: React.CSSProperties = { margin: "10px 0", fontSize: "clamp(2.7rem,8vw,5.2rem)", lineHeight: .91, letterSpacing: "-.06em" };
const lead: React.CSSProperties = { maxWidth: 720, margin: "13px auto 22px", color: "#c6ceda", lineHeight: 1.6, fontWeight: 700 };
const primary: React.CSSProperties = { margin: 6, padding: "14px 20px", borderRadius: 999, border: 0, color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)" };
const link: React.CSSProperties = { ...secondary, display: "inline-block", textDecoration: "none" };
const stats: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 13, flexWrap: "wrap", margin: "20px 0" };
const hud: React.CSSProperties = { width: "min(920px,100%)", margin: "0 auto 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 14, borderRadius: 22, background: "rgba(16,19,27,.92)", border: "1px solid rgba(255,255,255,.12)" };
const hudStats: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" };
const powerBadge: React.CSSProperties = { maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "7px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 11, fontWeight: 950 };
const soundButton: React.CSSProperties = { border: 0, background: "transparent", color: "#fff", fontSize: 19, cursor: "pointer" };
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
const retry: React.CSSProperties = { color: "#c6b8ff", fontWeight: 850 };
const checkpointToast: React.CSSProperties = { position: "fixed", left: "50%", top: 92, zIndex: 150, width: "min(360px,calc(100vw - 28px))", display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", alignItems: "center", padding: "13px 16px", borderRadius: 20, border: "1px solid", background: "rgba(16,19,27,.96)", color: "#fff", boxShadow: "0 18px 55px rgba(0,0,0,.42)", transform: "translateX(-50%)" };
