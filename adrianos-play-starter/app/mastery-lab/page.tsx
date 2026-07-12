"use client";

import GameFrame from "@/components/GameFrame";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { masteryLessonFor } from "@/lib/adrian-mastery-lessons";
import {
  MASTERY_LOOP_EVENT,
  getDueMasteryInterventions,
  markMasteryLessonViewed,
  readMasteryInterventions,
  recordMasteryCheck,
  type MasteryIntervention,
} from "@/lib/adrian-mastery-loop";
import { useFamilyProfiles } from "@/lib/adrian-profiles";

const GAME_SLUG = "mastery-lab";
type Screen = "intro" | "lesson" | "check" | "result";

function requestedInterventionId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("intervention");
}

function chooseIntervention(profileId: string): MasteryIntervention | null {
  const requested = requestedInterventionId();
  const all = readMasteryInterventions(profileId);
  const requestedRow = requested ? all.find((item) => item.id === requested) : null;
  if (requestedRow && requestedRow.phase !== "resolved" && requestedRow.phase !== "monitoring") return requestedRow;
  return getDueMasteryInterventions(profileId)[0] ?? null;
}

export default function MasteryLabPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { recordPlay, award } = useAdrianProgress();
  const [intervention, setIntervention] = useState<MasteryIntervention | null>(null);
  const [screen, setScreen] = useState<Screen>("intro");
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const started = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => setIntervention(chooseIntervention(activeProfile.id));
    refresh();
    window.addEventListener(MASTERY_LOOP_EVENT, refresh);
    window.addEventListener("adrianos-learning-updated", refresh);
    return () => {
      window.removeEventListener(MASTERY_LOOP_EVENT, refresh);
      window.removeEventListener("adrianos-learning-updated", refresh);
    };
  }, [activeProfile.id, hydrated]);

  const lesson = useMemo(
    () => intervention ? masteryLessonFor(intervention) : null,
    [intervention],
  );

  function begin() {
    if (!intervention) return;
    if (!started.current) {
      started.current = true;
      recordPlay(GAME_SLUG);
    }
    setSelected(null);
    setCorrect(null);
    setMessage("");
    if (intervention.phase === "retention") {
      setScreen("check");
      return;
    }
    const updated = markMasteryLessonViewed(activeProfile.id, intervention.id);
    if (updated) setIntervention(updated);
    setScreen("lesson");
  }

  function openCheck() {
    setSelected(null);
    setCorrect(null);
    setMessage("");
    setScreen("check");
  }

  function choose(index: number) {
    if (!intervention || !lesson || selected !== null) return;
    const isCorrect = index === lesson.answerIndex;
    setSelected(index);
    setCorrect(isCorrect);
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: intervention.subject,
      skillId: intervention.skillId,
      skillLabel: intervention.skillLabel,
      prompt: lesson.checkPrompt,
      correctAnswer: lesson.choices[lesson.answerIndex],
      correct: isCorrect,
      review: true,
      data: {
        masteryLab: true,
        interventionId: intervention.id,
        phase: intervention.phase,
      },
    }, activeProfile.id);
    const updated = recordMasteryCheck(activeProfile.id, intervention.id, isCorrect);
    if (updated) setIntervention(updated);

    if (isCorrect) {
      if (!completed.current) {
        completed.current = true;
        award(GAME_SLUG, {
          xp: intervention.phase === "retention" ? 24 : 18,
          coins: intervention.phase === "retention" ? 8 : 5,
          score: intervention.phase === "retention" ? 100 : 80,
          completed: true,
        });
      }
      setMessage(intervention.phase === "retention"
        ? "The skill stayed strong without reteaching. Recovery complete."
        : "That explanation worked. AdrianOS will bring back one short memory check tomorrow.");
    } else {
      setMessage(`Not yet. ${lesson.explanation} AdrianOS will switch back to the lesson instead of pushing ahead.`);
    }
    setScreen("result");
  }

  function tryAgain() {
    completed.current = false;
    setSelected(null);
    setCorrect(null);
    setMessage("");
    setScreen("lesson");
  }

  if (!hydrated) {
    return (
      <GameFrame title="Mastery Lab">
        <section style={card}><span style={eyebrow}>PREPARING A NEW PATH</span><h1 style={heroTitle}>Opening the lab…</h1></section>
      </GameFrame>
    );
  }

  if (!intervention || !lesson) {
    return (
      <GameFrame title="Mastery Lab">
        <section style={card}>
          <div style={bigEmoji}>✨</div>
          <span style={eyebrow}>MASTERY LOOP CLEAR</span>
          <h1 style={heroTitle}>No skill needs a new path right now.</h1>
          <p style={muted}>AdrianOS opens this lab only after repeated learning friction or when a retention check becomes due.</p>
          <div style={actions}>
            <Link href="/school" style={primaryLink}>Return to School Mode</Link>
            <Link href="/curriculum" style={secondaryLink}>Open the learning map</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  if (screen === "intro") {
    const retention = intervention.phase === "retention";
    return (
      <GameFrame title="Mastery Lab">
        <section style={card}>
          <div style={bigEmoji}>{retention ? "🧠" : "🔬"}</div>
          <span style={eyebrow}>{retention ? "RETENTION CHECK" : "A DIFFERENT EXPLANATION"}</span>
          <h1 style={heroTitle}>{intervention.skillLabel}</h1>
          <p style={muted}>
            {retention
              ? "This skill is returning after a delay. No hints first, so AdrianOS can see whether the learning stayed available."
              : `This skill became sticky ${intervention.evidenceCount} times. Instead of repeating the same task, AdrianOS is changing the representation and checking understanding.`}
          </p>
          {!retention && (
            <div style={signalBox}>
              <small>WHY THE LAB OPENED</small>
              <strong>{intervention.triggerPrompt || "Repeated attempts showed that this skill needs another teaching path."}</strong>
            </div>
          )}
          <button type="button" onClick={begin} style={primaryButton}>
            {retention ? "Take the memory check →" : "Try a new path →"}
          </button>
        </section>
      </GameFrame>
    );
  }

  if (screen === "lesson") {
    return (
      <GameFrame title="Mastery Lab">
        <section style={lessonShell}>
          <div>
            <span style={eyebrow}>RETEACH · {intervention.skillLabel.toUpperCase()}</span>
            <h1 style={lessonTitle}>{lesson.title}</h1>
            <p style={principle}>{lesson.principle}</p>
          </div>
          <div style={stepGrid}>
            {lesson.steps.map((step, index) => (
              <article style={stepCard} key={step}>
                <span style={stepNumber}>{index + 1}</span>
                <strong>{step}</strong>
              </article>
            ))}
          </div>
          <div style={exampleBox}>
            <small>WORKED EXAMPLE</small>
            <strong>{lesson.workedExample}</strong>
          </div>
          <button type="button" onClick={openCheck} style={primaryButton}>I’m ready to check →</button>
        </section>
      </GameFrame>
    );
  }

  if (screen === "check") {
    return (
      <GameFrame title="Mastery Lab">
        <section style={checkCard}>
          <span style={eyebrow}>{intervention.phase === "retention" ? "MEMORY CHECK" : "UNDERSTANDING CHECK"}</span>
          <h1 style={checkTitle}>{lesson.checkPrompt}</h1>
          <div style={choiceGrid}>
            {lesson.choices.map((choice, index) => (
              <button key={choice} type="button" onClick={() => choose(index)} style={choiceButton}>{choice}</button>
            ))}
          </div>
          <p style={muted}>This check is brief on purpose. AdrianOS is testing whether the new representation changed understanding.</p>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Mastery Lab">
      <section style={{ ...card, borderColor: correct ? "rgba(217,255,91,.42)" : "rgba(255,181,191,.36)" }}>
        <div style={bigEmoji}>{correct ? intervention.phase === "resolved" ? "🏆" : "🌱" : "🧭"}</div>
        <span style={eyebrow}>{correct ? intervention.phase === "resolved" ? "RECOVERY VERIFIED" : "NEW PATH FOUND" : "ANOTHER PATH NEEDED"}</span>
        <h1 style={heroTitle}>{correct ? intervention.phase === "resolved" ? "It stayed strong." : "Understanding changed." : "Not yet is useful data."}</h1>
        <p style={muted}>{message}</p>
        {correct && <div style={exampleBox}><small>WHY IT WORKS</small><strong>{lesson.explanation}</strong></div>}
        <div style={actions}>
          {correct ? (
            <Link href="/daily-session?school=1" style={primaryLink}>Return to today’s route →</Link>
          ) : (
            <button type="button" onClick={tryAgain} style={primaryButton}>Try the new explanation again</button>
          )}
          <Link href="/school" style={secondaryLink}>School Mode</Link>
        </div>
      </section>
    </GameFrame>
  );
}

const card: React.CSSProperties = { width: "min(880px,100%)", margin: "0 auto", padding: "clamp(26px,6vw,58px)", borderRadius: 34, border: "1px solid rgba(127,220,255,.32)", background: "linear-gradient(145deg,rgba(127,220,255,.1),rgba(198,184,255,.08) 50%,#181d28)", textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.28)" };
const lessonShell: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto", display: "grid", gap: 20, padding: "clamp(24px,5vw,46px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.28)", background: "#181d28" };
const checkCard: React.CSSProperties = { width: "min(820px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,46px)", borderRadius: 34, border: "1px solid rgba(198,184,255,.32)", background: "#181d28" };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "12px 0 16px", fontSize: "clamp(3.2rem,9vw,6.7rem)", lineHeight: .88, letterSpacing: "-.075em" };
const lessonTitle: React.CSSProperties = { margin: "10px 0 13px", fontSize: "clamp(2.8rem,8vw,5.7rem)", lineHeight: .9, letterSpacing: "-.065em" };
const checkTitle: React.CSSProperties = { margin: "12px 0 24px", fontSize: "clamp(2.4rem,7vw,4.8rem)", lineHeight: .98, letterSpacing: "-.055em" };
const muted: React.CSSProperties = { maxWidth: 720, margin: "0 auto", color: "#aab1bf", lineHeight: 1.62, fontWeight: 700 };
const principle: React.CSSProperties = { maxWidth: 820, color: "#c8cfda", fontSize: "clamp(1.05rem,2vw,1.25rem)", lineHeight: 1.6, fontWeight: 750 };
const bigEmoji: React.CSSProperties = { fontSize: 78 };
const signalBox: React.CSSProperties = { display: "grid", gap: 7, margin: "24px auto", padding: 17, maxWidth: 720, borderRadius: 20, background: "rgba(198,184,255,.1)", border: "1px solid rgba(198,184,255,.22)", textAlign: "left" };
const stepGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 11 };
const stepCard: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px 1fr", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, background: "#222936", border: "1px solid rgba(255,255,255,.08)" };
const stepNumber: React.CSSProperties = { width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 999, background: "#7fdcff", color: "#10131b", fontWeight: 950 };
const exampleBox: React.CSSProperties = { display: "grid", gap: 8, padding: 18, borderRadius: 21, background: "rgba(217,255,91,.08)", border: "1px solid rgba(217,255,91,.24)", textAlign: "left", lineHeight: 1.55 };
const choiceGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 11 };
const choiceButton: React.CSSProperties = { minHeight: 76, padding: 16, borderRadius: 20, border: "1px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: 17, fontWeight: 900, cursor: "pointer" };
const primaryButton: React.CSSProperties = { display: "inline-flex", justifyContent: "center", alignItems: "center", minHeight: 52, marginTop: 24, padding: "13px 20px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, fontSize: 16, cursor: "pointer" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 24 };
const primaryLink: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 50, padding: "12px 19px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const secondaryLink: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 50, padding: "12px 19px", borderRadius: 999, background: "#222936", color: "#fff", border: "1px solid rgba(255,255,255,.14)", textDecoration: "none", fontWeight: 900 };
