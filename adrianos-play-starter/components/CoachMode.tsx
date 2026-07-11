"use client";

import { useEffect, useRef, useState } from "react";
import {
  beginCoachInteraction,
  recordCoachCheck,
  recordCoachHelpful,
  recordCoachHint,
  recordCoachVoice,
} from "@/lib/adrian-coach";
import { getActiveProfile } from "@/lib/adrian-profiles";

export type CoachCheck = {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

type CoachModeProps = {
  gameSlug: string;
  skillId: string;
  skillLabel: string;
  prompt: string;
  hints: string[];
  explanation: string;
  check: CoachCheck;
};

export default function CoachMode({
  gameSlug,
  skillId,
  skillLabel,
  prompt,
  hints,
  explanation,
  check,
}: CoachModeProps) {
  const profile = getActiveProfile();
  const [open, setOpen] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [checkChoice, setCheckChoice] = useState<number | null>(null);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [voiceMessage, setVoiceMessage] = useState("");
  const interactionId = useRef<string | null>(null);
  const contextKey = `${gameSlug}:${skillId}:${prompt}`;

  useEffect(() => {
    setOpen(false);
    setHintCount(0);
    setCheckChoice(null);
    setHelpful(null);
    setVoiceMessage("");
    interactionId.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [contextKey]);

  function ensureInteraction(): string {
    if (interactionId.current) return interactionId.current;
    const id = beginCoachInteraction(
      { gameSlug, skillId, skillLabel, prompt },
      profile.id
    );
    interactionId.current = id;
    return id;
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) ensureInteraction();
  }

  function revealHint() {
    const nextCount = Math.min(hints.length, hintCount + 1);
    setHintCount(nextCount);
    recordCoachHint(profile.id, ensureInteraction(), nextCount);
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceMessage("Read-aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
    recordCoachVoice(profile.id, ensureInteraction());
    setVoiceMessage("Reading aloud…");
    utterance.onend = () => setVoiceMessage("");
  }

  function chooseCheck(index: number) {
    if (checkChoice !== null) return;
    setCheckChoice(index);
    recordCoachCheck(profile.id, ensureInteraction(), index === check.answerIndex);
  }

  function voteHelpful(value: boolean) {
    setHelpful(value);
    recordCoachHelpful(profile.id, ensureInteraction(), value);
  }

  const currentText = hintCount > 0
    ? hints[Math.min(hintCount - 1, hints.length - 1)]
    : `Let’s slow this down, ${profile.name}. We will take one small step at a time.`;
  const checkCorrect = checkChoice === check.answerIndex;
  const showExplanation = checkChoice !== null || hintCount >= hints.length;

  return (
    <section style={shell} aria-label="Coach Mode">
      <button onClick={toggleOpen} style={coachButton} type="button">
        <span style={{ fontSize: 22 }}>🧭</span>
        <span>{open ? "Close Coach" : "Ask Coach"}</span>
      </button>

      {open && (
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <span style={eyebrow}>COACH MODE</span>
              <h3 style={title}>{skillLabel}</h3>
            </div>
            <button onClick={() => setOpen(false)} style={closeButton} aria-label="Close Coach Mode">×</button>
          </div>

          <div style={coachBubble}>
            <div style={{ fontSize: 34 }}>🧑‍🚀</div>
            <p style={coachText}>{currentText}</p>
          </div>

          <div style={buttonRow}>
            <button onClick={() => speak(currentText)} style={secondaryButton} type="button">
              🔊 Read aloud
            </button>
            {hintCount < hints.length && (
              <button onClick={revealHint} style={primaryButton} type="button">
                {hintCount === 0 ? "Give me a hint" : "Next hint"}
              </button>
            )}
          </div>
          {voiceMessage && <p style={statusText}>{voiceMessage}</p>}

          {hintCount > 0 && (
            <div style={checkBox}>
              <span style={eyebrow}>QUICK CHECK</span>
              <h4 style={checkTitle}>{check.prompt}</h4>
              <div style={{ display: "grid", gap: 8 }}>
                {check.choices.map((choice, index) => {
                  const selected = checkChoice === index;
                  const correct = checkChoice !== null && index === check.answerIndex;
                  const wrong = selected && !correct;
                  return (
                    <button
                      key={`${choice}-${index}`}
                      onClick={() => chooseCheck(index)}
                      disabled={checkChoice !== null}
                      style={{
                        ...choiceButton,
                        background: correct ? "#d9ff5b" : wrong ? "#ffb5bf" : "#222936",
                        color: correct || wrong ? "#10131b" : "#fff",
                      }}
                      type="button"
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {checkChoice !== null && (
                <div style={feedbackBox}>
                  <strong style={{ color: checkCorrect ? "#d9ff5b" : "#ffb5bf" }}>
                    {checkCorrect ? "You’ve got the idea." : "Good try. Let’s connect the pieces."}
                  </strong>
                  <p style={muted}>{check.explanation}</p>
                  <button onClick={() => speak(check.explanation)} style={secondaryButton} type="button">
                    🔊 Read this explanation
                  </button>
                </div>
              )}
            </div>
          )}

          {showExplanation && (
            <div style={explanationBox}>
              <span style={eyebrow}>BRING IT BACK TO THE PROBLEM</span>
              <p style={{ ...coachText, margin: "8px 0 0" }}>{explanation}</p>
            </div>
          )}

          {showExplanation && helpful === null && (
            <div style={helpfulRow}>
              <span style={muted}>Did Coach Mode help?</span>
              <button onClick={() => voteHelpful(true)} style={tinyButton} type="button">Yes</button>
              <button onClick={() => voteHelpful(false)} style={tinyButton} type="button">Not yet</button>
            </div>
          )}
          {helpful !== null && (
            <p style={statusText}>{helpful ? "Great. Try the original problem now." : "That’s useful feedback. We’ll try a different path next time."}</p>
          )}
        </div>
      )}
    </section>
  );
}

const shell: React.CSSProperties = { marginTop: 18, textAlign: "left" };
const coachButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: 999, border: "1px solid rgba(127,220,255,.45)", background: "rgba(127,220,255,.1)", color: "#fff", fontWeight: 950, cursor: "pointer" };
const panel: React.CSSProperties = { marginTop: 12, padding: "clamp(18px,4vw,26px)", borderRadius: 24, border: "1px solid rgba(127,220,255,.35)", background: "#10131b", boxShadow: "0 20px 50px rgba(0,0,0,.28)" };
const panelHeader: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { color: "#7fdcff", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const title: React.CSSProperties = { margin: "5px 0 0", fontSize: 24, letterSpacing: "-.035em" };
const closeButton: React.CSSProperties = { width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontSize: 22, cursor: "pointer" };
const coachBubble: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px 1fr", gap: 12, alignItems: "start", marginTop: 18, padding: 15, borderRadius: 18, background: "rgba(127,220,255,.08)" };
const coachText: React.CSSProperties = { margin: 0, color: "#fff", lineHeight: 1.55, fontWeight: 800 };
const buttonRow: React.CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 };
const primaryButton: React.CSSProperties = { padding: "11px 15px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const statusText: React.CSSProperties = { margin: "10px 0 0", color: "#c6b8ff", fontSize: 13, fontWeight: 850 };
const checkBox: React.CSSProperties = { marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)" };
const checkTitle: React.CSSProperties = { margin: "8px 0 13px", fontSize: 20, lineHeight: 1.25 };
const choiceButton: React.CSSProperties = { minHeight: 48, padding: "10px 13px", borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", textAlign: "left", fontWeight: 850, cursor: "pointer" };
const feedbackBox: React.CSSProperties = { marginTop: 13, padding: 14, borderRadius: 16, background: "#181d28" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.5 };
const explanationBox: React.CSSProperties = { marginTop: 16, padding: 15, borderRadius: 17, border: "1px solid rgba(217,255,91,.22)", background: "rgba(217,255,91,.06)" };
const helpfulRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 };
const tinyButton: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#222936", color: "#fff", fontWeight: 850, cursor: "pointer" };
