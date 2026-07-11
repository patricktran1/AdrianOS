"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { getDueReviewItems, recordLearningAttempt } from "@/lib/adrian-learning";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  analyzeWriting,
  assignWritingPrompt,
  claimWritingReward,
  completeWritingPiece,
  ensureWeeklyWriting,
  findWritingPiece,
  getWritingPrompt,
  readWritingHistory,
  updateWritingPiece,
  writingArtifactSummary,
  writingPromptsForAge,
  type WritingAnalysis,
  type WritingPiece,
  type WritingPrompt,
} from "@/lib/adrian-writing";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

function formatDate(value: string | null): string {
  if (!value) return "In progress";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function genreLabel(prompt: WritingPrompt): string {
  if (prompt.genre === "Story") return "NARRATIVE WRITING";
  if (prompt.genre === "Opinion") return "OPINION WRITING";
  return "INFORMATIONAL WRITING";
}

function evidenceRows(piece: WritingPiece, prompt: WritingPrompt, analysis: WritingAnalysis) {
  return [
    {
      skillId: "writing-ideas",
      skillLabel: "Planning writing ideas",
      prompt: `Writing piece ${piece.id}: organize ideas`,
      correctAnswer: "A clear plan connected to the prompt",
      correct: piece.selectedIdeas.length >= 2,
    },
    {
      skillId: "writing-sentences",
      skillLabel: "Sentence construction",
      prompt: `Writing piece ${piece.id}: build complete sentences`,
      correctAnswer: "Enough complete sentences for the writer's level",
      correct: analysis.enoughWords && analysis.enoughSentences,
    },
    {
      skillId: "writing-conventions",
      skillLabel: "Capitalization and punctuation",
      prompt: `Writing piece ${piece.id}: use writing conventions`,
      correctAnswer: "Capital letter and ending punctuation",
      correct: analysis.capitalStart && analysis.endingPunctuation,
    },
    {
      skillId: "writing-organization",
      skillLabel: "Organizing a paragraph",
      prompt: `Writing piece ${piece.id}: organize the ${prompt.genre.toLowerCase()}`,
      correctAnswer: "Ideas connected in a clear order",
      correct: analysis.organized,
    },
    {
      skillId: "writing-revision",
      skillLabel: "Revising a draft",
      prompt: `Writing piece ${piece.id}: revise the draft`,
      correctAnswer: "A meaningful change from draft to final writing",
      correct: analysis.revisionChanged,
    },
  ];
}

export default function WritingStudioPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { award, recordPlay, hydrated: progressReady } = useAdrianProgress();
  const [modeReady, setModeReady] = useState(false);
  const [parentMode, setParentMode] = useState(false);
  const [parentAuthorized, setParentAuthorized] = useState(true);
  const [reviewRequested, setReviewRequested] = useState(false);
  const [reviewSkillId, setReviewSkillId] = useState<string | null>(null);
  const [piece, setPiece] = useState<WritingPiece | null>(null);
  const [history, setHistory] = useState<WritingPiece[]>([]);
  const [title, setTitle] = useState("");
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [finalText, setFinalText] = useState("");
  const [parentNote, setParentNote] = useState("");
  const [message, setMessage] = useState("");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const playRecorded = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedParent = params.get("parent") === "1";
    setParentMode(requestedParent);
    setReviewRequested(params.get("review") === "1");
    setParentAuthorized(!requestedParent || window.sessionStorage.getItem("adrianos-parent-unlocked") === "yes");
    setModeReady(true);
    return () => window.speechSynthesis?.cancel();
  }, []);

  function loadPiece(next: WritingPiece, clearMessage = true) {
    setPiece(next);
    setTitle(next.title);
    setSelectedIdeas(next.selectedIdeas);
    setDraft(next.draft);
    setFinalText(next.finalText || next.draft);
    setParentNote(next.parentNote);
    if (clearMessage) setMessage("");
  }

  useEffect(() => {
    if (!modeReady || !profilesReady || !progressReady) return;
    const rows = readWritingHistory(activeProfile.id);
    let next: WritingPiece | null = null;
    let targetSkill: string | null = null;

    if (reviewRequested && !parentMode) {
      const due = getDueReviewItems(activeProfile.id, "writing-studio")[0];
      const writingId = typeof due?.data?.writingId === "string" ? due.data.writingId : "";
      next = writingId ? findWritingPiece(activeProfile.id, writingId) : null;
      targetSkill = due?.skillId ?? null;
    }

    if (!next) {
      next = parentMode
        ? rows[0] ?? ensureWeeklyWriting(activeProfile)
        : ensureWeeklyWriting(activeProfile);
    }

    setReviewSkillId(targetSkill);
    setHistory(readWritingHistory(activeProfile.id));
    loadPiece(next);
    playRecorded.current = false;
  }, [modeReady, parentMode, reviewRequested, profilesReady, progressReady, activeProfile.id, activeProfile.age]);

  useEffect(() => {
    if (!piece || parentMode || playRecorded.current) return;
    playRecorded.current = true;
    recordPlay("writing-studio");
  }, [piece?.id, parentMode]);

  const prompt = useMemo(() => piece ? getWritingPrompt(piece.promptId) : null, [piece?.promptId]);
  const analysis = useMemo(
    () => prompt
      ? analyzeWriting(finalText, activeProfile.age, prompt, selectedIdeas, draft)
      : null,
    [finalText, activeProfile.age, prompt?.id, selectedIdeas, draft]
  );

  if (!modeReady || !profilesReady || !progressReady || !piece || !prompt || !analysis) {
    return (
      <main style={page}>
        <section style={heroCard}>
          <span style={eyebrow}>WRITING STUDIO</span>
          <h1 style={heroTitle}>Sharpening the pencils…</h1>
        </section>
      </main>
    );
  }

  if (parentMode && !parentAuthorized) {
    return (
      <main style={page}>
        <section style={{ ...heroCard, maxWidth: 700, textAlign: "center" }}>
          <div style={{ fontSize: 70 }}>🔐</div>
          <span style={eyebrow}>PARENT WRITING REVIEW</span>
          <h1 style={{ ...heroTitle, fontSize: "clamp(3rem,8vw,5rem)" }}>Unlock the Parent Dashboard first.</h1>
          <p style={muted}>Writing assignments and child drafts use the shared parent session.</p>
          <Link href="/parent" style={primaryLink}>Open Parent Dashboard</Link>
        </section>
      </main>
    );
  }

  const currentPiece = piece;
  const currentPrompt = prompt;
  const currentAnalysis = analysis;
  const reviewMode = Boolean(reviewRequested && reviewSkillId);
  const step = reviewMode ? 2 : currentPiece.completedAt ? 3 : currentPiece.currentStep;

  function toggleIdea(idea: string) {
    setSelectedIdeas((current) => current.includes(idea)
      ? current.filter((item) => item !== idea)
      : [...current, idea].slice(0, 6));
  }

  function savePlan() {
    if (!title.trim()) {
      setMessage("Give the writing a title first.");
      return;
    }
    if (selectedIdeas.length < 2) {
      setMessage("Choose at least two ideas for the plan.");
      return;
    }
    const updated = updateWritingPiece(activeProfile.id, currentPiece.id, {
      title: title.trim(),
      selectedIdeas,
      currentStep: 1,
    });
    if (updated) loadPiece(updated, false);
    setMessage("Plan saved. Now turn the ideas into a first draft.");
  }

  function addStarter(starter: string) {
    setDraft((current) => `${current}${current.trim() ? "\n" : ""}${starter} `);
  }

  function saveDraft() {
    const draftAnalysis = analyzeWriting(draft, activeProfile.age, currentPrompt, selectedIdeas, "");
    const minimum = activeProfile.age <= 5 ? 3 : activeProfile.age <= 7 ? 10 : 20;
    if (draftAnalysis.wordCount < minimum) {
      setMessage(`Keep drafting until you have at least ${minimum} words. The first draft does not need to be perfect.`);
      return;
    }
    const updated = updateWritingPiece(activeProfile.id, currentPiece.id, {
      title: title.trim() || currentPrompt.title,
      selectedIdeas,
      draft: draft.trim(),
      finalText: draft.trim(),
      currentStep: 2,
    });
    if (updated) loadPiece(updated, false);
    setMessage("Draft saved. Use the checklist to revise and publish.");
  }

  function speakWriting() {
    if (!("speechSynthesis" in window)) {
      setMessage("Read aloud is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${title || currentPrompt.title}. ${finalText}`);
    utterance.rate = activeProfile.age <= 5 ? 0.82 : 0.92;
    utterance.onstart = () => setVoicePlaying(true);
    utterance.onend = () => setVoicePlaying(false);
    utterance.onerror = () => setVoicePlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function publish() {
    if (!currentAnalysis.readyToPublish) {
      const nextTip = currentAnalysis.checks.find((check) => !check.passed)?.tip;
      setMessage(nextTip ?? "Finish the revision checklist before publishing.");
      return;
    }

    const firstPublish = !currentPiece.completedAt;
    const saved = updateWritingPiece(activeProfile.id, currentPiece.id, {
      title: title.trim() || currentPrompt.title,
      selectedIdeas,
      draft: draft.trim(),
      finalText: finalText.trim(),
      currentStep: 2,
    });
    if (!saved) return;

    const evidence = evidenceRows(saved, currentPrompt, currentAnalysis);
    const rowsToRecord = reviewMode && reviewSkillId
      ? evidence.filter((row) => row.skillId === reviewSkillId)
      : firstPublish ? evidence : [];

    for (const row of rowsToRecord) {
      recordLearningAttempt({
        gameSlug: "writing-studio",
        subject: "Reading",
        skillId: row.skillId,
        skillLabel: row.skillLabel,
        prompt: row.prompt,
        correctAnswer: row.correctAnswer,
        correct: row.correct,
        review: reviewMode,
        data: {
          writingId: saved.id,
          promptId: saved.promptId,
          genre: currentPrompt.genre,
        },
      }, activeProfile.id);
    }

    const completed = completeWritingPiece(activeProfile.id, currentPiece.id);
    if (!completed) return;
    let finalPiece = completed;
    if (!completed.rewardClaimed) {
      award("writing-studio", {
        xp: activeProfile.age <= 5 ? 25 : 45,
        coins: activeProfile.age <= 5 ? 8 : 15,
        score: currentAnalysis.score * 25,
        completed: true,
      });
      finalPiece = claimWritingReward(activeProfile.id, currentPiece.id) ?? completed;
    }
    loadPiece(finalPiece, false);
    setHistory(readWritingHistory(activeProfile.id));
    setMessage(reviewMode
      ? "Revision saved. The learning engine recorded this focused writing review."
      : "Published. This writing is now part of the learning portfolio.");
  }

  function reopenRevision() {
    setReviewRequested(true);
    setReviewSkillId("writing-revision");
    setMessage("Make one meaningful improvement, then publish the revision again.");
  }

  function selectPiece(next: WritingPiece) {
    setReviewRequested(false);
    setReviewSkillId(null);
    loadPiece(next);
  }

  function assign(promptId: string) {
    const created = assignWritingPrompt(activeProfile.id, promptId);
    setReviewRequested(false);
    setReviewSkillId(null);
    loadPiece(created);
    setHistory(readWritingHistory(activeProfile.id));
    setMessage("New writing prompt assigned.");
  }

  function saveParentNote() {
    const updated = updateWritingPiece(activeProfile.id, currentPiece.id, { parentNote: parentNote.trim() });
    if (updated) loadPiece(updated, false);
    setMessage("Parent note saved with this writing piece.");
  }

  if (parentMode) {
    return (
      <main style={page}>
        <header style={topbar}>
          <Link href="/parent" style={secondaryLink}>← Parent Dashboard</Link>
          <strong>Writing Studio</strong>
          <Link href="/games/writing-studio" style={secondaryLink}>Child view</Link>
        </header>

        <div style={profileRow}>
          {family.profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => switchProfile(profile.id)}
              style={{ ...profileButton, ...(profile.id === activeProfile.id ? profileButtonActive : {}) }}
              type="button"
            >
              <span style={{ fontSize: 30 }}>{profile.emoji}</span>
              <span><strong>{profile.name}</strong><small style={{ display: "block", opacity: .65 }}>Age {profile.age}</small></span>
            </button>
          ))}
        </div>

        <section style={heroCard}>
          <span style={eyebrow}>PARENT WRITING BOARD</span>
          <h1 style={heroTitle}>{activeProfile.name}’s words, preserved.</h1>
          <p style={muted}>Assign a prompt, compare draft and final writing, inspect the revision checklist, and leave an observation without replacing the child’s voice.</p>
        </section>

        {message && <div style={notice}>{message}</div>}

        <section style={section}>
          <span style={eyebrow}>ASSIGN A PROMPT</span>
          <h2 style={sectionTitle}>Choose the next piece</h2>
          <div style={promptGrid}>
            {writingPromptsForAge(activeProfile.age).map((row) => (
              <article key={row.id} style={promptCard}>
                <div style={{ fontSize: 42 }}>{row.emoji}</div>
                <span style={genrePill}>{row.genre.toUpperCase()}</span>
                <h3 style={cardTitle}>{row.title}</h3>
                <p style={muted}>{row.prompt}</p>
                <button onClick={() => assign(row.id)} style={smallPrimaryButton} type="button">Assign prompt</button>
              </article>
            ))}
          </div>
        </section>

        <section style={section}>
          <div style={sectionHeadingRow}>
            <div>
              <span style={eyebrow}>CURRENT WRITING</span>
              <h2 style={sectionTitle}>{currentPrompt.emoji} {currentPiece.title || currentPrompt.title}</h2>
            </div>
            <span style={statusPill}>{currentPiece.completedAt ? "PUBLISHED" : `STEP ${currentPiece.currentStep + 1} OF 3`}</span>
          </div>
          <div style={artifactGrid}>
            <div style={artifactCard}><strong>Prompt</strong><p style={muted}>{currentPrompt.prompt}</p></div>
            <div style={artifactCard}><strong>Plan</strong><p style={muted}>{currentPiece.selectedIdeas.join(", ") || "No ideas selected yet"}</p></div>
            <div style={artifactCard}><strong>First draft</strong><p style={writingText}>{currentPiece.draft || "No draft yet"}</p></div>
            <div style={artifactCard}><strong>Published version</strong><p style={writingText}>{currentPiece.finalText || "Not published yet"}</p></div>
          </div>
          <div style={checkGrid}>
            {currentAnalysis.checks.map((check) => (
              <div key={check.id} style={{ ...checkCard, borderColor: check.passed ? "rgba(217,255,91,.35)" : "rgba(255,181,191,.3)" }}>
                <span>{check.passed ? "✓" : "○"}</span><strong>{check.label}</strong>
              </div>
            ))}
          </div>
          <label style={noteCard}>
            <strong>Parent observation</strong>
            <textarea value={parentNote} onChange={(event) => setParentNote(event.target.value)} style={textarea} rows={3} placeholder="What did you notice about the child’s ideas, effort, or revision?" />
            <button onClick={saveParentNote} style={smallPrimaryButton} type="button">Save observation</button>
          </label>
        </section>

        <section style={section}>
          <span style={eyebrow}>WRITING HISTORY</span>
          <h2 style={sectionTitle}>Drafts and published work</h2>
          <div style={historyList}>
            {history.map((row) => {
              const rowPrompt = getWritingPrompt(row.promptId);
              if (!rowPrompt) return null;
              return (
                <button key={row.id} onClick={() => selectPiece(row)} style={historyButton} type="button">
                  <span style={{ fontSize: 34 }}>{rowPrompt.emoji}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{row.title || rowPrompt.title}</strong>
                    <small style={muted}>{row.completedAt ? `Published ${formatDate(row.completedAt)}` : `In progress · step ${row.currentStep + 1}`}</small>
                  </span>
                  <span style={{ marginLeft: "auto" }}>→</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (step === 3 && !reviewMode) {
    return (
      <GameFrame title="Writing Studio">
        <section style={doneCard}>
          <div style={{ fontSize: 82 }}>📚</div>
          <span style={eyebrow}>PUBLISHED WRITING</span>
          <h1 style={doneTitle}>{currentPiece.title || currentPrompt.title}</h1>
          <div style={publishedPaper}>{currentPiece.finalText}</div>
          {currentPiece.parentNote && <p style={parentNoteView}>Parent note: “{currentPiece.parentNote}”</p>}
          <p style={muted}>{writingArtifactSummary(currentPiece)}</p>
          <div style={rewardPill}>+{activeProfile.age <= 5 ? 25 : 45} XP · +{activeProfile.age <= 5 ? 8 : 15} coins</div>
          <div style={actionRow}>
            <Link href="/portfolio" style={primaryLink}>See it in my portfolio</Link>
            <button onClick={reopenRevision} style={secondaryButton} type="button">Revise it again</button>
            <Link href="/school" style={secondaryLink}>Done for now</Link>
          </div>
        </section>
      </GameFrame>
    );
  }

  return (
    <GameFrame title="Writing Studio">
      <div style={childShell}>
        <section style={childHero}>
          <span style={eyebrow}>{reviewMode ? "FOCUSED WRITING REVIEW" : genreLabel(currentPrompt)}</span>
          <h1 style={childTitle}>{currentPrompt.emoji} {currentPrompt.title}</h1>
          <p style={muted}>{currentPrompt.prompt}</p>
          <div style={stepper}>
            {["1 · PLAN", "2 · DRAFT", "3 · REVISE"].map((label, index) => (
              <div key={label} style={{ ...stepChip, opacity: step >= index ? 1 : .42, background: step === index ? "#d9ff5b" : "#222936", color: step === index ? "#10131b" : "#fff" }}>{label}</div>
            ))}
          </div>
        </section>

        {message && <div style={notice}>{message}</div>}

        {step === 0 ? (
          <section style={workCard}>
            <span style={eyebrow}>PLAN</span>
            <h2 style={workTitle}>Gather the ideas before the sentences.</h2>
            <p style={promptText}>{currentPrompt.planQuestion}</p>
            <label style={fieldLabel}>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} style={textInput} placeholder="Name this piece of writing" />
            </label>
            <div style={ideaGrid}>
              {currentPrompt.ideaChoices.map((idea) => {
                const selected = selectedIdeas.includes(idea);
                return (
                  <button key={idea} onClick={() => toggleIdea(idea)} style={{ ...ideaButton, background: selected ? "#c6b8ff" : "#222936", color: selected ? "#10131b" : "#fff" }} type="button">
                    {selected ? "✓ " : ""}{idea}
                  </button>
                );
              })}
            </div>
            <button onClick={savePlan} style={largePrimaryButton} type="button">Save my plan and draft →</button>
          </section>
        ) : step === 1 ? (
          <section style={workCard}>
            <span style={eyebrow}>DRAFT</span>
            <h2 style={workTitle}>Write the first version.</h2>
            <p style={muted}>A first draft is allowed to be wobbly. Get the ideas onto the page before polishing them.</p>
            <div style={starterRow}>
              {currentPrompt.sentenceStarters.map((starter) => (
                <button key={starter} onClick={() => addStarter(starter)} style={starterButton} type="button">+ {starter}</button>
              ))}
            </div>
            <label style={fieldLabel}>
              <span>My first draft</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} style={writingArea} rows={12} placeholder={activeProfile.age <= 5 ? "A grown-up can help type the sentence you say." : "Use your plan and keep going until the whole idea is on the page."} />
            </label>
            <div style={wordMeter}>{(draft.match(/[A-Za-z0-9']+/g) ?? []).length} words</div>
            <button onClick={saveDraft} style={largePrimaryButton} type="button">Save first draft and revise →</button>
          </section>
        ) : (
          <section style={workCard}>
            <span style={eyebrow}>REVISE</span>
            <h2 style={workTitle}>{reviewMode ? "Repair this exact writing skill." : "Make the writing clearer and stronger."}</h2>
            {reviewMode && <p style={reviewNotice}>Today’s focus: {reviewSkillId?.replace("writing-", "").replaceAll("-", " ")}</p>}
            <div style={checkGrid}>
              {currentAnalysis.checks.map((check) => (
                <div key={check.id} style={{ ...checkCard, borderColor: check.passed ? "rgba(217,255,91,.4)" : "rgba(255,181,191,.35)" }}>
                  <span style={{ color: check.passed ? "#d9ff5b" : "#ffb5bf", fontSize: 22 }}>{check.passed ? "✓" : "○"}</span>
                  <div><strong>{check.label}</strong>{!check.passed && <small style={{ display: "block", color: "#aab1bf", marginTop: 4 }}>{check.tip}</small>}</div>
                </div>
              ))}
            </div>
            <div style={writingStats}>
              <span>{currentAnalysis.wordCount} words</span>
              <span>{currentAnalysis.sentenceCount} sentence{currentAnalysis.sentenceCount === 1 ? "" : "s"}</span>
              <span>{currentAnalysis.score}/4 checklist</span>
              <span>{currentAnalysis.revisionChanged ? "Revision changed" : "Make one improvement"}</span>
            </div>
            <label style={fieldLabel}>
              <span>My revised writing</span>
              <textarea value={finalText} onChange={(event) => setFinalText(event.target.value)} style={writingArea} rows={14} />
            </label>
            <div style={actionRow}>
              <button onClick={voicePlaying ? () => { window.speechSynthesis.cancel(); setVoicePlaying(false); } : speakWriting} style={secondaryButton} type="button">
                {voicePlaying ? "Stop reading" : "🔊 Read my writing aloud"}
              </button>
              <button onClick={publish} style={{ ...largePrimaryButton, opacity: currentAnalysis.readyToPublish ? 1 : .55 }} type="button">
                {reviewMode ? "Save focused revision" : "Publish to my portfolio"}
              </button>
            </div>
          </section>
        )}
      </div>
    </GameFrame>
  );
}

const page: React.CSSProperties = { width: "min(1120px,calc(100% - 28px))", minHeight: "100vh", margin: "0 auto", padding: "18px 0 70px", color: "#fff" };
const topbar: React.CSSProperties = { minHeight: 64, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const heroCard: React.CSSProperties = { padding: "clamp(25px,5vw,52px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.24)", background: "linear-gradient(145deg,rgba(217,255,91,.09),rgba(198,184,255,.07) 50%,#181d28)", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const heroTitle: React.CSSProperties = { margin: "11px 0 14px", fontSize: "clamp(3.1rem,8vw,6.5rem)", lineHeight: .88, letterSpacing: "-.075em" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const primaryLink: React.CSSProperties = { display: "inline-block", padding: "14px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const secondaryLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", textDecoration: "none", fontWeight: 900 };
const profileRow: React.CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", margin: "10px 0 16px" };
const profileButton: React.CSSProperties = { minWidth: 160, display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const notice: React.CSSProperties = { margin: "14px 0", padding: 13, borderRadius: 16, background: "rgba(198,184,255,.14)", border: "1px solid rgba(198,184,255,.28)", color: "#dcd5ff", fontWeight: 850 };
const section: React.CSSProperties = { marginTop: 18, padding: "clamp(22px,4vw,34px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const sectionTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(2rem,5vw,3.8rem)", letterSpacing: "-.052em" };
const sectionHeadingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" };
const promptGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 };
const promptCard: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minHeight: 260, padding: 18, borderRadius: 22, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const genrePill: React.CSSProperties = { alignSelf: "flex-start", padding: "6px 9px", borderRadius: 999, background: "#222936", color: "#7fdcff", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" };
const cardTitle: React.CSSProperties = { margin: "4px 0 0", fontSize: 22, letterSpacing: "-.035em" };
const smallPrimaryButton: React.CSSProperties = { marginTop: "auto", padding: "11px 14px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const statusPill: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, background: "#222936", color: "#c6b8ff", fontSize: 11, fontWeight: 950 };
const artifactGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 };
const artifactCard: React.CSSProperties = { padding: 16, borderRadius: 20, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const writingText: React.CSSProperties = { color: "#d8dde7", whiteSpace: "pre-wrap", lineHeight: 1.65, fontFamily: "Georgia,serif" };
const noteCard: React.CSSProperties = { display: "grid", gap: 9, marginTop: 15, padding: 16, borderRadius: 20, background: "rgba(127,220,255,.07)", border: "1px solid rgba(127,220,255,.2)" };
const historyList: React.CSSProperties = { display: "grid", gap: 9 };
const historyButton: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,.09)", background: "#10131b", color: "#fff", textAlign: "left", cursor: "pointer" };
const childShell: React.CSSProperties = { width: "min(980px,100%)", margin: "0 auto" };
const childHero: React.CSSProperties = { padding: "clamp(24px,5vw,44px)", borderRadius: 30, border: "1px solid rgba(217,255,91,.22)", background: "linear-gradient(145deg,rgba(217,255,91,.08),rgba(198,184,255,.08),#181d28)", textAlign: "center" };
const childTitle: React.CSSProperties = { margin: "10px 0 12px", fontSize: "clamp(2.8rem,7vw,5.8rem)", lineHeight: .91, letterSpacing: "-.07em" };
const stepper: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 22 };
const stepChip: React.CSSProperties = { padding: "11px 12px", borderRadius: 999, textAlign: "center", fontSize: 11, fontWeight: 950, letterSpacing: ".1em" };
const workCard: React.CSSProperties = { marginTop: 16, padding: "clamp(24px,5vw,44px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const workTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(2.4rem,6vw,4.5rem)", letterSpacing: "-.06em" };
const promptText: React.CSSProperties = { padding: 18, borderRadius: 20, background: "rgba(127,220,255,.09)", border: "1px solid rgba(127,220,255,.22)", color: "#d9f5ff", fontSize: 18, lineHeight: 1.55, fontWeight: 800 };
const fieldLabel: React.CSSProperties = { display: "grid", gap: 8, marginTop: 18, color: "#d9f5ff", fontWeight: 900 };
const textInput: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 18, fontWeight: 850 };
const textarea: React.CSSProperties = { width: "100%", resize: "vertical", padding: 15, borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 16, lineHeight: 1.55 };
const writingArea: React.CSSProperties = { ...textarea, minHeight: 260, fontFamily: "Georgia,serif", fontSize: 18, lineHeight: 1.7 };
const ideaGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9, marginTop: 18 };
const ideaButton: React.CSSProperties = { minHeight: 58, padding: 12, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const starterRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 15 };
const starterButton: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(198,184,255,.28)", background: "rgba(198,184,255,.09)", color: "#dcd5ff", fontWeight: 850, cursor: "pointer" };
const wordMeter: React.CSSProperties = { marginTop: 9, color: "#aab1bf", textAlign: "right", fontSize: 12, fontWeight: 850 };
const largePrimaryButton: React.CSSProperties = { marginTop: 20, padding: "15px 22px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { padding: "13px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.15)", background: "#222936", color: "#fff", fontWeight: 900, cursor: "pointer" };
const checkGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 9, marginTop: 16 };
const checkCard: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 18, background: "#10131b", border: "1px solid" };
const writingStats: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, color: "#c6b8ff", fontSize: 11, fontWeight: 850 };
const reviewNotice: React.CSSProperties = { padding: 13, borderRadius: 17, background: "rgba(255,207,131,.09)", border: "1px solid rgba(255,207,131,.25)", color: "#ffcf83", fontWeight: 850 };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 18 };
const doneCard: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(28px,6vw,58px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.3)", background: "#181d28", textAlign: "center" };
const doneTitle: React.CSSProperties = { margin: "10px 0 18px", fontSize: "clamp(3rem,7vw,5.6rem)", lineHeight: .92, letterSpacing: "-.07em" };
const publishedPaper: React.CSSProperties = { padding: "clamp(22px,5vw,38px)", borderRadius: 24, background: "#f5efd9", color: "#20231f", whiteSpace: "pre-wrap", textAlign: "left", fontFamily: "Georgia,serif", fontSize: "clamp(1.2rem,3vw,1.55rem)", lineHeight: 1.75 };
const parentNoteView: React.CSSProperties = { padding: 13, borderRadius: 17, background: "rgba(198,184,255,.09)", color: "#dcd5ff" };
const rewardPill: React.CSSProperties = { display: "inline-block", marginTop: 10, padding: "9px 13px", borderRadius: 999, background: "rgba(217,255,91,.12)", color: "#d9ff5b", fontWeight: 950 };
