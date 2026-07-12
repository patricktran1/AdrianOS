"use client";

import GameFrame from "@/components/GameFrame";
import { elementaryGradeLabel, type ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { storyPackForGrade, type StoryChoice } from "@/lib/adrian-story-expedition";
import { useGameSession } from "@/lib/game-session";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const GAME_SLUG = "story-expedition";
type Stage = "intro" | "read" | "question" | "choice" | "finish";
type CompanionId = "owl" | "fox" | "dragon";

const COMPANIONS: Array<{
  id: CompanionId;
  emoji: string;
  name: string;
  power: string;
}> = [
  { id: "owl", emoji: "🦉", name: "Evidence Owl", power: "Carries two evidence lenses instead of one." },
  { id: "fox", emoji: "🦊", name: "Clever Fox", power: "Protects one heart after the first tricky answer." },
  { id: "dragon", emoji: "🐉", name: "Story Dragon", power: "Earns one extra evidence gem on every first-try answer." },
];

function speak(text: string, age: number, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = age <= 5 ? 0.78 : age <= 7 ? 0.88 : 0.96;
  utterance.pitch = 1.03;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

export default function StoryExpeditionPage() {
  const { activeProfile, hydrated } = useFamilyProfiles();
  const { completeGame, restartGame } = useGameSession(GAME_SLUG);
  const [grade, setGrade] = useState<ElementaryGrade | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [companion, setCompanion] = useState<CompanionId>("owl");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [stars, setStars] = useState(0);
  const [evidenceGems, setEvidenceGems] = useState(0);
  const [fluencyRibbons, setFluencyRibbons] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [selected, setSelected] = useState("");
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("Choose a story companion.");
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const [lenses, setLenses] = useState(2);
  const [foxShieldUsed, setFoxShieldUsed] = useState(false);
  const [echoIndex, setEchoIndex] = useState<number | null>(null);
  const [fluencyChapters, setFluencyChapters] = useState<string[]>([]);
  const [routeOutcome, setRouteOutcome] = useState("");
  const [routeTrail, setRouteTrail] = useState<string[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    setGrade(readProfileGrade(activeProfile));
  }, [activeProfile, hydrated]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const pack = useMemo(() => grade === null ? null : storyPackForGrade(grade), [grade]);
  const chapter = pack?.chapters[chapterIndex] ?? null;
  const companionInfo = COMPANIONS.find((item) => item.id === companion) ?? COMPANIONS[0];
  const echoComplete = chapter ? fluencyChapters.includes(chapter.id) : false;
  const score = stars * 100 + evidenceGems * 25 + fluencyRibbons * 35 + hearts * 20;

  function resetChapter() {
    setWrongCount(0);
    setSelected("");
    setLocked(false);
    setEvidenceVisible(false);
    setEchoIndex(null);
    setRouteOutcome("");
  }

  function startRun() {
    setChapterIndex(0);
    setHearts(3);
    setStars(0);
    setEvidenceGems(0);
    setFluencyRibbons(0);
    setFluencyChapters([]);
    setFoxShieldUsed(false);
    setLenses(companion === "owl" ? 2 : 1);
    setRouteTrail([]);
    resetChapter();
    setMessage("Read or listen to the chapter, then hunt for evidence.");
    setStage("read");
  }

  function listenToChapter() {
    if (!chapter) return;
    const played = speak(`${chapter.title}. ${chapter.sentences.join(" ")}`, activeProfile.age);
    setMessage(played ? "Listening mode is on. Follow the words while the chapter is read." : "Read aloud is not available in this browser.");
  }

  function startEchoReading() {
    if (!chapter || echoComplete) return;
    setEchoIndex(0);
    speak(chapter.sentences[0], activeProfile.age);
    setMessage("Listen to the sentence, then read the same sentence aloud yourself.");
  }

  function advanceEchoReading() {
    if (!chapter || echoIndex === null) return;
    if (echoIndex >= chapter.sentences.length - 1) {
      setEchoIndex(null);
      setFluencyChapters((items) => [...items, chapter.id]);
      setFluencyRibbons((value) => value + 1);
      recordLearningAttempt({
        gameSlug: GAME_SLUG,
        subject: "Reading",
        skillId: "reading-fluency-practice",
        skillLabel: "Oral reading practice",
        prompt: `Echo reading practice: ${chapter.title}`,
        correctAnswer: "Practice completed",
        correct: true,
        data: {
          grade: grade ?? 0,
          standardCode: chapter.standardCode,
          practiceOnly: true,
          measuredFluency: false,
          chapterId: chapter.id,
        },
      }, activeProfile.id);
      setMessage("Fluency ribbon earned. AdrianOS records the practice, not a microphone-measured reading score.");
      return;
    }
    const next = echoIndex + 1;
    setEchoIndex(next);
    speak(chapter.sentences[next], activeProfile.age);
  }

  function openQuestion() {
    window.speechSynthesis?.cancel();
    setEchoIndex(null);
    setMessage("Choose the answer supported by the chapter.");
    setStage("question");
  }

  function saveAttempt(correct: boolean) {
    if (!chapter) return;
    recordLearningAttempt({
      gameSlug: GAME_SLUG,
      subject: "Reading",
      skillId: chapter.skillId,
      skillLabel: chapter.skillLabel,
      prompt: `${chapter.title}: ${chapter.question}`,
      correctAnswer: chapter.answer,
      correct,
      data: {
        grade: grade ?? 0,
        standardCode: chapter.standardCode,
        chapterId: chapter.id,
        supportUsed: wrongCount > 0 || evidenceVisible,
        routeTrail: routeTrail.join(" > "),
      },
    }, activeProfile.id);
  }

  function chooseAnswer(label: string) {
    if (!chapter || locked) return;
    setSelected(label);
    if (label === chapter.answer) {
      saveAttempt(true);
      setLocked(true);
      setStars((value) => value + 1);
      const firstTryBonus = wrongCount === 0 && companion === "dragon" ? 1 : 0;
      setEvidenceGems((value) => value + (wrongCount === 0 ? 2 + firstTryBonus : 1));
      setMessage(`Evidence found. ${chapter.explanation}`);
      return;
    }

    if (wrongCount === 0) saveAttempt(false);
    const nextWrong = wrongCount + 1;
    setWrongCount(nextWrong);
    setSelected("");

    if (companion === "fox" && !foxShieldUsed) {
      setFoxShieldUsed(true);
      setMessage(`Clever Fox protected your heart. Story clue: ${chapter.hint}`);
    } else {
      setHearts((value) => Math.max(0, value - 1));
      setMessage(nextWrong === 1 ? `Story clue: ${chapter.hint}` : `Evidence revealed: ${chapter.evidence}`);
    }
    if (nextWrong >= 2) setEvidenceVisible(true);
  }

  function useEvidenceLens() {
    if (!chapter || lenses <= 0 || evidenceVisible || locked) return;
    setLenses((value) => value - 1);
    setEvidenceVisible(true);
    setMessage(`Evidence lens: ${chapter.evidence}`);
  }

  function openRouteChoice() {
    setStage("choice");
    setMessage(chapter?.routePrompt ?? "Choose the next path.");
  }

  function chooseRoute(choice: StoryChoice) {
    setRouteOutcome(choice.outcome);
    setRouteTrail((items) => [...items, choice.label]);
    setMessage(choice.outcome);
  }

  function advanceChapter() {
    if (!pack || !chapter || !routeOutcome) return;
    if (chapterIndex >= pack.chapters.length - 1) {
      completeGame({
        xp: 50 + stars * 6 + fluencyRibbons * 3,
        coins: 8 + evidenceGems + fluencyRibbons,
        score,
      });
      window.speechSynthesis?.cancel();
      setStage("finish");
      return;
    }
    setChapterIndex((value) => value + 1);
    resetChapter();
    setMessage("A new chapter is ready. Read closely and keep your evidence trail alive.");
    setStage("read");
  }

  function replay() {
    restartGame();
    setStage("intro");
    setMessage("Choose a companion and create a new evidence trail.");
    setChapterIndex(0);
    setRouteTrail([]);
  }

  if (!hydrated || grade === null || !pack || !chapter) {
    return (
      <GameFrame title="Story Expedition">
        <section style={loadingCard} aria-busy="true">
          <span style={eyebrow}>OPENING THE STORY PORTAL</span>
          <h1 style={heroTitle}>Finding the right reading world…</h1>
        </section>
      </GameFrame>
    );
  }

  if (stage === "intro") {
    return (
      <GameFrame title="Story Expedition">
        <section style={{ ...heroCard, background: pack.backdrop }}>
          <div style={heroEmoji}>{pack.emoji}</div>
          <span style={{ ...eyebrow, color: pack.accent }}>{pack.eyebrow}</span>
          <h1 style={heroTitle}>{pack.title}</h1>
          <p style={heroCopy}>{pack.description}</p>
          <div style={gradeChip}>{elementaryGradeLabel(grade)} · 4 chapters · read, reason, choose</div>

          <h2 style={sectionTitle}>Choose a story companion</h2>
          <div style={companionGrid}>
            {COMPANIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCompanion(item.id)}
                style={{ ...companionCard, ...(companion === item.id ? { borderColor: pack.accent, transform: "translateY(-3px)" } : {}) }}
                aria-pressed={companion === item.id}
              >
                <span style={{ fontSize: 44 }}>{item.emoji}</span>
                <strong>{item.name}</strong>
                <small>{item.power}</small>
              </button>
            ))}
          </div>

          <div style={noticeCard}>
            <strong>Fluency practice is optional and honest.</strong>
            <span>Echo reading earns a practice ribbon, but AdrianOS does not claim to measure oral accuracy without a teacher or microphone assessment.</span>
          </div>

          <button type="button" onClick={startRun} style={{ ...primaryButton, background: pack.accent }}>
            Enter with {companionInfo.emoji} {companionInfo.name} →
          </button>
        </section>
      </GameFrame>
    );
  }

  if (stage === "finish") {
    const explorerTitle = routeTrail.filter((item) => /evidence|inspect|study|chart|map|journal|account/i.test(item)).length >= 2
      ? "Evidence Pathfinder"
      : "Story Trailblazer";
    return (
      <GameFrame title="Story Expedition">
        <section style={{ ...heroCard, background: pack.backdrop }}>
          <div style={heroEmoji}>🏆{pack.emoji}</div>
          <span style={{ ...eyebrow, color: pack.accent }}>EXPEDITION COMPLETE</span>
          <h1 style={heroTitle}>{activeProfile.name} is an {explorerTitle}!</h1>
          <p style={heroCopy}>Four chapters cleared with evidence, reasoning, and choices that created a unique story trail.</p>
          <div style={finishGrid}>
            <div style={finishStat}><strong>{stars}/4</strong><span>chapter stars</span></div>
            <div style={finishStat}><strong>{evidenceGems}</strong><span>evidence gems</span></div>
            <div style={finishStat}><strong>{fluencyRibbons}</strong><span>fluency ribbons</span></div>
            <div style={finishStat}><strong>{score}</strong><span>expedition score</span></div>
          </div>
          <div style={trailCard}>
            <span style={eyebrow}>YOUR STORY TRAIL</span>
            <strong>{routeTrail.join(" → ")}</strong>
          </div>
          <div style={actionRow}>
            <button type="button" onClick={replay} style={{ ...primaryButton, background: pack.accent }}>Create another trail →</button>
            <Link href="/school" style={secondaryLink}>Return to School</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Story Expedition">
      <section style={{ ...gameShell, background: pack.backdrop }} aria-label={`${pack.title} chapter ${chapterIndex + 1}`}>
        <div style={topStats}>
          <span>Chapter {chapterIndex + 1}/{pack.chapters.length}</span>
          <span>❤️ {hearts}</span>
          <span>⭐ {stars}</span>
          <span>💎 {evidenceGems}</span>
          <span>🎗️ {fluencyRibbons}</span>
        </div>

        <div style={chapterHeader}>
          <div style={{ fontSize: 60 }}>{chapter.emoji}</div>
          <div>
            <span style={{ ...eyebrow, color: pack.accent }}>{chapter.standardCode} · {chapter.standardGoal}</span>
            <h1 style={chapterTitle}>{chapter.title}</h1>
          </div>
        </div>

        {stage === "read" && (
          <div style={readingLayout}>
            <article style={passageCard} aria-label="Story passage">
              {chapter.sentences.map((sentence, index) => (
                <p key={sentence} style={{ ...passageLine, ...(echoIndex === index ? { background: `${pack.accent}22`, borderColor: pack.accent } : {}) }}>
                  {sentence}
                </p>
              ))}
              <div style={wordCard}><strong>Word lantern: {chapter.focusWord.word}</strong><span>{chapter.focusWord.meaning}</span></div>
            </article>

            <aside style={readingTools}>
              <button type="button" onClick={listenToChapter} style={toolButton}>🔊 Listen to chapter</button>
              {!echoComplete && echoIndex === null && <button type="button" onClick={startEchoReading} style={toolButton}>🎗️ Start echo reading</button>}
              {echoComplete && <div style={earnedBadge}>✓ Fluency practice ribbon earned</div>}
              {echoIndex !== null && (
                <div style={echoCard}>
                  <span style={eyebrow}>ECHO LINE {echoIndex + 1}/{chapter.sentences.length}</span>
                  <strong>{chapter.sentences[echoIndex]}</strong>
                  <button type="button" onClick={advanceEchoReading} style={{ ...primaryButton, background: pack.accent }}>
                    I read it too →
                  </button>
                </div>
              )}
              <button type="button" onClick={openQuestion} style={{ ...primaryButton, background: pack.accent }}>Hunt for evidence →</button>
            </aside>
          </div>
        )}

        {stage === "question" && (
          <div style={questionCard}>
            <span style={{ ...eyebrow, color: pack.accent }}>{chapter.skillLabel.toUpperCase()}</span>
            <h2 style={questionTitle}>{chapter.question}</h2>
            <div style={answerGrid}>
              {chapter.answers.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => chooseAnswer(item.label)}
                  disabled={locked}
                  data-correct={item.label === chapter.answer ? "true" : "false"}
                  style={{ ...answerButton, ...(selected === item.label ? { borderColor: pack.accent } : {}) }}
                >
                  <span style={{ fontSize: 34 }}>{item.emoji}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            {!locked && (
              <button type="button" onClick={useEvidenceLens} disabled={lenses <= 0 || evidenceVisible} style={lensButton}>
                🔎 Evidence lens ({lenses} left)
              </button>
            )}
            {evidenceVisible && <div style={evidenceCard}><strong>Evidence from the text</strong><span>{chapter.evidence}</span></div>}
            <div role="status" style={messageCard}>{message}</div>
            {locked && <button type="button" onClick={openRouteChoice} style={{ ...primaryButton, background: pack.accent }}>Choose the story path →</button>}
          </div>
        )}

        {stage === "choice" && (
          <div style={questionCard}>
            <span style={{ ...eyebrow, color: pack.accent }}>YOUR CHOICE CHANGES THE TRAIL</span>
            <h2 style={questionTitle}>{chapter.routePrompt}</h2>
            {!routeOutcome ? (
              <div style={routeGrid}>
                {chapter.routes.map((choice) => (
                  <button key={choice.label} type="button" onClick={() => chooseRoute(choice)} style={routeButton}>
                    <span style={{ fontSize: 44 }}>{choice.emoji}</span>
                    <strong>{choice.label}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <div style={outcomeCard}>
                <strong>{routeOutcome}</strong>
                <button type="button" onClick={advanceChapter} style={{ ...primaryButton, background: pack.accent }}>
                  {chapterIndex >= pack.chapters.length - 1 ? "Open the final story vault →" : "Continue the expedition →"}
                </button>
              </div>
            )}
          </div>
        )}

        <div role="status" style={bottomMessage}>{message}</div>
      </section>
    </GameFrame>
  );
}

const loadingCard: React.CSSProperties = { minHeight: 420, display: "grid", alignContent: "center", padding: "clamp(28px,7vw,70px)", borderRadius: 34, background: "#181d28", color: "#fff" };
const heroCard: React.CSSProperties = { width: "min(1000px,100%)", margin: "0 auto", padding: "clamp(24px,6vw,60px)", borderRadius: 36, color: "#fff", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 32px 80px rgba(0,0,0,.32)" };
const heroEmoji: React.CSSProperties = { fontSize: "clamp(5rem,14vw,9rem)", lineHeight: 1, marginBottom: 16 };
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 950, letterSpacing: ".14em" };
const heroTitle: React.CSSProperties = { maxWidth: 880, margin: "10px 0 16px", fontSize: "clamp(3rem,9vw,7rem)", lineHeight: .86, letterSpacing: "-.075em" };
const heroCopy: React.CSSProperties = { maxWidth: 720, margin: 0, color: "#c2cad5", fontSize: "clamp(1rem,2.4vw,1.25rem)", lineHeight: 1.6, fontWeight: 650 };
const gradeChip: React.CSSProperties = { display: "inline-flex", marginTop: 18, padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,.09)", color: "#fff", fontWeight: 850, fontSize: 12 };
const sectionTitle: React.CSSProperties = { margin: "30px 0 12px", fontSize: "clamp(1.5rem,4vw,2.2rem)" };
const companionGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 12 };
const companionCard: React.CSSProperties = { minHeight: 180, display: "grid", placeItems: "center", alignContent: "center", gap: 8, padding: 18, borderRadius: 24, border: "2px solid rgba(255,255,255,.12)", background: "rgba(16,19,27,.72)", color: "#fff", textAlign: "center", cursor: "pointer", transition: "transform .2s ease,border-color .2s ease" };
const noticeCard: React.CSSProperties = { display: "grid", gap: 5, margin: "18px 0", padding: 16, borderRadius: 20, background: "rgba(127,220,255,.09)", border: "1px solid rgba(127,220,255,.24)", color: "#cbd3dd", lineHeight: 1.45 };
const primaryButton: React.CSSProperties = { minHeight: 54, border: 0, borderRadius: 999, padding: "13px 22px", color: "#10131b", fontWeight: 950, fontSize: 15, cursor: "pointer" };
const secondaryLink: React.CSSProperties = { minHeight: 54, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", color: "#fff", textDecoration: "none", fontWeight: 900 };
const gameShell: React.CSSProperties = { width: "min(1080px,100%)", margin: "0 auto", padding: "clamp(18px,4vw,34px)", borderRadius: 34, color: "#fff", border: "1px solid rgba(255,255,255,.14)", overflow: "hidden" };
const topStats: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", padding: "10px 12px", borderRadius: 18, background: "rgba(16,19,27,.65)", color: "#d7dde6", fontSize: 12, fontWeight: 900 };
const chapterHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, margin: "22px 0" };
const chapterTitle: React.CSSProperties = { margin: "6px 0 0", fontSize: "clamp(2rem,7vw,4.5rem)", lineHeight: .92, letterSpacing: "-.055em" };
const readingLayout: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 16, alignItems: "start" };
const passageCard: React.CSSProperties = { padding: "clamp(18px,4vw,28px)", borderRadius: 26, background: "#f8f2df", color: "#1e2430", boxShadow: "0 20px 50px rgba(0,0,0,.24)" };
const passageLine: React.CSSProperties = { margin: "0 0 12px", padding: "9px 10px", borderRadius: 12, border: "1px solid transparent", fontSize: "clamp(1.08rem,3vw,1.45rem)", lineHeight: 1.65, fontWeight: 680 };
const wordCard: React.CSSProperties = { display: "grid", gap: 4, marginTop: 18, padding: 14, borderRadius: 16, background: "#fff8ca", border: "1px solid #eadb73" };
const readingTools: React.CSSProperties = { display: "grid", gap: 10 };
const toolButton: React.CSSProperties = { minHeight: 52, borderRadius: 18, border: "1px solid rgba(255,255,255,.15)", background: "rgba(16,19,27,.72)", color: "#fff", fontWeight: 900, cursor: "pointer" };
const echoCard: React.CSSProperties = { display: "grid", gap: 12, padding: 18, borderRadius: 22, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", lineHeight: 1.55 };
const earnedBadge: React.CSSProperties = { padding: 13, borderRadius: 18, background: "rgba(217,255,91,.12)", border: "1px solid rgba(217,255,91,.25)", color: "#d9ff5b", fontWeight: 900 };
const questionCard: React.CSSProperties = { display: "grid", gap: 16, padding: "clamp(18px,4vw,30px)", borderRadius: 28, background: "rgba(16,19,27,.72)", border: "1px solid rgba(255,255,255,.13)" };
const questionTitle: React.CSSProperties = { margin: 0, fontSize: "clamp(1.7rem,5vw,3rem)", lineHeight: 1.05, letterSpacing: "-.035em" };
const answerGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 11 };
const answerButton: React.CSSProperties = { minHeight: 110, display: "grid", placeItems: "center", alignContent: "center", gap: 7, padding: 16, borderRadius: 22, border: "2px solid rgba(255,255,255,.13)", background: "#222936", color: "#fff", fontSize: 15, cursor: "pointer" };
const lensButton: React.CSSProperties = { minHeight: 48, borderRadius: 18, border: "1px solid rgba(127,220,255,.3)", background: "rgba(127,220,255,.1)", color: "#bceeff", fontWeight: 900, cursor: "pointer" };
const evidenceCard: React.CSSProperties = { display: "grid", gap: 5, padding: 15, borderRadius: 18, background: "#f8f2df", color: "#1d2430", lineHeight: 1.5 };
const messageCard: React.CSSProperties = { padding: 14, borderRadius: 18, background: "rgba(255,255,255,.07)", color: "#c8d0dc", lineHeight: 1.5, fontWeight: 750 };
const routeGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 };
const routeButton: React.CSSProperties = { minHeight: 150, display: "grid", placeItems: "center", alignContent: "center", gap: 9, padding: 18, borderRadius: 24, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", cursor: "pointer" };
const outcomeCard: React.CSSProperties = { display: "grid", gap: 18, padding: 22, borderRadius: 22, background: "rgba(217,255,91,.1)", border: "1px solid rgba(217,255,91,.24)", color: "#edfbb7", lineHeight: 1.55 };
const bottomMessage: React.CSSProperties = { marginTop: 14, padding: "11px 13px", borderRadius: 16, background: "rgba(16,19,27,.55)", color: "#aeb8c6", fontSize: 13, fontWeight: 750 };
const finishGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, margin: "24px 0" };
const finishStat: React.CSSProperties = { display: "grid", placeItems: "center", gap: 3, padding: 18, borderRadius: 22, background: "rgba(255,255,255,.08)", textAlign: "center" };
const trailCard: React.CSSProperties = { display: "grid", gap: 7, padding: 18, borderRadius: 22, background: "rgba(16,19,27,.65)", color: "#dbe1e9" };
const actionRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 };
