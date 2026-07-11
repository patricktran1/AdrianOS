"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import {
  assignProject,
  claimProjectReward,
  completeProject,
  ensureWeeklyProject,
  getProjectTemplate,
  PROJECT_STUDIO_EVENT,
  projectArtifactSummary,
  projectTemplatesForAge,
  readProjectHistory,
  updateProject,
  type ProjectTemplate,
  type ProjectWork,
} from "@/lib/adrian-projects";

function formatDate(value: string | null): string {
  if (!value) return "In progress";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function subjectsLabel(template: ProjectTemplate): string {
  return template.subjects.join(" · ");
}

export default function ProjectsPage() {
  const { family, activeProfile, switchProfile, hydrated: profilesReady } = useFamilyProfiles();
  const { hydrated: progressReady, award } = useAdrianProgress();
  const [parentMode, setParentMode] = useState(false);
  const [parentAuthorized, setParentAuthorized] = useState(true);
  const [project, setProject] = useState<ProjectWork | null>(null);
  const [history, setHistory] = useState<ProjectWork[]>([]);
  const [answer, setAnswer] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);
  const [makeText, setMakeText] = useState("");
  const [explainText, setExplainText] = useState("");
  const [parentNote, setParentNote] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("parent") === "1";
    setParentMode(requested);
    setParentAuthorized(!requested || window.sessionStorage.getItem("adrianos-parent-unlocked") === "yes");
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(PROJECT_STUDIO_EVENT, refresh);
    window.addEventListener("adrianos-family-updated", refresh);
    return () => {
      window.removeEventListener(PROJECT_STUDIO_EVENT, refresh);
      window.removeEventListener("adrianos-family-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (!profilesReady || !progressReady) return;
    const rows = readProjectHistory(activeProfile.id);
    const next = parentMode
      ? rows[0] ?? ensureWeeklyProject(activeProfile)
      : ensureWeeklyProject(activeProfile);
    setHistory(readProjectHistory(activeProfile.id));
    setProject(next);
    setAnswer(next.discoverAnswer);
    setProjectName(next.projectName);
    setSelectedIdeas(next.selectedIdeas);
    setMakeText(next.makeText);
    setExplainText(next.explainText);
    setParentNote(next.parentNote);
    setMessage("");
  }, [activeProfile.id, activeProfile.age, profilesReady, progressReady, parentMode, revision]);

  const template = useMemo(
    () => project ? getProjectTemplate(project.templateId) : null,
    [project?.templateId]
  );

  if (!profilesReady || !progressReady || !project || !template) {
    return (
      <main style={page}>
        <section style={heroCard}>
          <span style={eyebrow}>PROJECT STUDIO</span>
          <h1 style={heroTitle}>Opening the workshop…</h1>
        </section>
      </main>
    );
  }

  if (parentMode && !parentAuthorized) {
    return (
      <main style={page}>
        <section style={{ ...heroCard, maxWidth: 700, textAlign: "center" }}>
          <div style={{ fontSize: 70 }}>🔐</div>
          <span style={eyebrow}>PARENT PROJECTS</span>
          <h1 style={{ ...heroTitle, fontSize: "clamp(3rem,8vw,5rem)" }}>Unlock the Parent Dashboard first.</h1>
          <p style={muted}>Project assignment and the full artifact history use the shared parent session.</p>
          <Link href="/parent" style={primaryLink}>Open Parent Dashboard</Link>
        </section>
      </main>
    );
  }

  function selectProject(next: ProjectWork) {
    setProject(next);
    setAnswer(next.discoverAnswer);
    setProjectName(next.projectName);
    setSelectedIdeas(next.selectedIdeas);
    setMakeText(next.makeText);
    setExplainText(next.explainText);
    setParentNote(next.parentNote);
    setMessage("");
  }

  function answerDiscovery(option: string) {
    const correct = option === template.answer;
    setAnswer(option);
    const updated = updateProject(activeProfile.id, project.id, {
      discoverAnswer: option,
      discoverCorrect: correct,
      currentStep: correct ? 1 : 0,
    });
    if (updated) setProject(updated);
    setMessage(correct ? "Discovery unlocked. Now build your idea." : "Not quite. Read the fact and try another answer.");
  }

  function toggleIdea(idea: string) {
    setSelectedIdeas((current) => current.includes(idea)
      ? current.filter((item) => item !== idea)
      : [...current, idea].slice(0, 6));
  }

  function saveMakeStep() {
    if (!projectName.trim()) {
      setMessage("Give the project a name first.");
      return;
    }
    if (selectedIdeas.length === 0 && !makeText.trim()) {
      setMessage("Choose at least one building block or describe your design.");
      return;
    }
    const updated = updateProject(activeProfile.id, project.id, {
      projectName: projectName.trim(),
      selectedIdeas,
      makeText: makeText.trim(),
      currentStep: 2,
    });
    if (updated) setProject(updated);
    setMessage("Design saved. One last step: explain your thinking.");
  }

  function finishProject() {
    const younger = activeProfile.age <= 5;
    if (!younger && explainText.trim().length < 12) {
      setMessage("Add one or two sentences explaining your thinking.");
      return;
    }
    const saved = updateProject(activeProfile.id, project.id, {
      projectName: projectName.trim() || template.title,
      selectedIdeas,
      makeText: makeText.trim(),
      explainText: explainText.trim(),
      currentStep: 2,
    });
    if (!saved) return;
    const completed = completeProject(activeProfile.id, project.id);
    if (!completed) return;
    if (!completed.rewardClaimed) {
      award("project-studio", { xp: 40, coins: 12, score: 100, completed: true });
      claimProjectReward(activeProfile.id, project.id);
    }
    setProject({ ...completed, rewardClaimed: true });
    setMessage("Project complete. Your artifact is now part of the learning portfolio.");
  }

  function assign(templateId: string) {
    const created = assignProject(activeProfile.id, templateId);
    selectProject(created);
    setHistory(readProjectHistory(activeProfile.id));
    setMessage("New project assigned.");
  }

  function saveParentNote() {
    const updated = updateProject(activeProfile.id, project.id, { parentNote: parentNote.trim() });
    if (updated) setProject(updated);
    setMessage("Parent note saved with this project.");
  }

  if (parentMode) {
    return (
      <main style={page}>
        <header style={topbar}>
          <Link href="/parent" style={secondaryLink}>← Parent Dashboard</Link>
          <strong>Project Studio</strong>
          <Link href="/projects" style={secondaryLink}>Child view</Link>
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
          <span style={eyebrow}>PARENT PROJECT BOARD</span>
          <h1 style={heroTitle}>{activeProfile.name}’s real work.</h1>
          <p style={muted}>Assign a cross-subject project, inspect the saved artifact, and leave a note that becomes part of the project record.</p>
        </section>

        {message && <div style={notice}>{message}</div>}

        <section style={section}>
          <span style={eyebrow}>ASSIGN A PROJECT</span>
          <h2 style={sectionTitle}>Choose the next workshop</h2>
          <div style={templateGrid}>
            {projectTemplatesForAge(activeProfile.age).map((row) => (
              <article key={row.id} style={templateCard}>
                <div style={{ fontSize: 46 }}>{row.emoji}</div>
                <span style={subjectPill}>{subjectsLabel(row)}</span>
                <h3 style={cardTitle}>{row.title}</h3>
                <p style={muted}>{row.summary}</p>
                <small style={muted}>About {row.minutes} minutes</small>
                <button onClick={() => assign(row.id)} style={smallPrimaryButton} type="button">Assign project</button>
              </article>
            ))}
          </div>
        </section>

        <section style={section}>
          <div style={sectionHeadingRow}>
            <div>
              <span style={eyebrow}>CURRENT ARTIFACT</span>
              <h2 style={sectionTitle}>{template.emoji} {project.projectName || template.title}</h2>
            </div>
            <span style={projectStatus}>{project.completedAt ? "COMPLETE" : `STEP ${project.currentStep + 1} OF 3`}</span>
          </div>
          <div style={artifactGrid}>
            <div style={artifactCard}>
              <strong>Discovery answer</strong>
              <p style={muted}>{project.discoverAnswer || "Not answered yet"} {project.discoverCorrect === true ? "✓" : ""}</p>
            </div>
            <div style={artifactCard}>
              <strong>Building blocks</strong>
              <p style={muted}>{project.selectedIdeas.join(", ") || "None chosen yet"}</p>
            </div>
            <div style={artifactCard}>
              <strong>Design notes</strong>
              <p style={muted}>{project.makeText || "No design notes yet"}</p>
            </div>
            <div style={artifactCard}>
              <strong>Child explanation</strong>
              <p style={muted}>{project.explainText || "No explanation yet"}</p>
            </div>
          </div>
          <label style={noteCard}>
            <strong>Parent note</strong>
            <textarea value={parentNote} onChange={(event) => setParentNote(event.target.value)} style={textarea} rows={3} placeholder="What did you notice about the child’s thinking?" />
            <button onClick={saveParentNote} style={smallPrimaryButton} type="button">Save note</button>
          </label>
        </section>

        <section style={section}>
          <span style={eyebrow}>PROJECT HISTORY</span>
          <h2 style={sectionTitle}>Artifacts over time</h2>
          <div style={historyList}>
            {history.map((row) => {
              const rowTemplate = getProjectTemplate(row.templateId);
              if (!rowTemplate) return null;
              return (
                <button key={row.id} onClick={() => selectProject(row)} style={historyButton} type="button">
                  <span style={{ fontSize: 34 }}>{rowTemplate.emoji}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{row.projectName || rowTemplate.title}</strong>
                    <small style={muted}>{row.completedAt ? `Completed ${formatDate(row.completedAt)}` : `In progress · step ${row.currentStep + 1}`}</small>
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

  const step = project.completedAt ? 3 : project.currentStep;

  return (
    <main style={page}>
      <header style={topbar}>
        <Link href="/school" style={secondaryLink}>← School</Link>
        <strong>Project Studio</strong>
        <Link href="/parent" style={secondaryLink}>Parent access 🔒</Link>
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
        <div style={heroGrid}>
          <div>
            <span style={eyebrow}>THIS WEEK’S PROJECT · {subjectsLabel(template).toUpperCase()}</span>
            <h1 style={heroTitle}>{template.emoji} {template.title}</h1>
            <p style={muted}>{template.summary} About {template.minutes} minutes, with your work saved after every stage.</p>
          </div>
          <div style={progressOrb}><strong>{Math.min(step, 3)}/3</strong><span>STAGES</span></div>
        </div>
        <div style={stepper}>
          {["1 · LEARN", "2 · MAKE", "3 · EXPLAIN"].map((label, index) => (
            <div key={label} style={{ ...stepChip, opacity: step >= index ? 1 : .42, background: step === index ? "#d9ff5b" : "#222936", color: step === index ? "#10131b" : "#fff" }}>{label}</div>
          ))}
        </div>
      </section>

      {message && <div style={notice}>{message}</div>}

      {project.completedAt ? (
        <section style={doneCard}>
          <div style={{ fontSize: 82 }}>🏆</div>
          <span style={eyebrow}>PROJECT COMPLETE</span>
          <h2 style={doneTitle}>{project.projectName || template.title}</h2>
          <p style={artifactSummary}>{projectArtifactSummary(project)}</p>
          {project.parentNote && <p style={parentNoteView}>Parent note: “{project.parentNote}”</p>}
          <div style={rewardPill}>+40 XP · +12 coins</div>
          <div style={actionRow}>
            <Link href="/portfolio" style={primaryLink}>See it in my portfolio</Link>
            <Link href="/school" style={secondaryLink}>Done for now</Link>
          </div>
        </section>
      ) : project.currentStep === 0 ? (
        <section style={workCard}>
          <span style={eyebrow}>LEARN</span>
          <h2 style={workTitle}>Discover one useful idea</h2>
          <div style={factCard}>{template.discover.fact}</div>
          <h3 style={questionTitle}>{template.discover.question}</h3>
          <div style={optionGrid}>
            {template.discover.options.map((option) => (
              <button
                key={option}
                onClick={() => answerDiscovery(option)}
                style={{ ...optionButton, borderColor: answer === option ? "#d9ff5b" : "rgba(255,255,255,.12)" }}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : project.currentStep === 1 ? (
        <section style={workCard}>
          <span style={eyebrow}>MAKE</span>
          <h2 style={workTitle}>Build your version</h2>
          <p style={muted}>{template.makePrompt}</p>
          <label style={fieldLabel}>
            <span>Project name</span>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} style={textInput} placeholder="Give your creation a name" />
          </label>
          <div style={ideaGrid}>
            {template.ideaChoices.map((idea) => {
              const selected = selectedIdeas.includes(idea);
              return (
                <button key={idea} onClick={() => toggleIdea(idea)} style={{ ...ideaButton, background: selected ? "#c6b8ff" : "#222936", color: selected ? "#10131b" : "#fff" }} type="button">
                  {selected ? "✓ " : ""}{idea}
                </button>
              );
            })}
          </div>
          <label style={fieldLabel}>
            <span>My design notes</span>
            <textarea value={makeText} onChange={(event) => setMakeText(event.target.value)} style={textarea} rows={4} placeholder={activeProfile.age <= 5 ? "A grown-up can help type what you made." : "Describe how the pieces work together."} />
          </label>
          <button onClick={saveMakeStep} style={largePrimaryButton} type="button">Save my design and explain →</button>
        </section>
      ) : (
        <section style={workCard}>
          <span style={eyebrow}>EXPLAIN</span>
          <h2 style={workTitle}>Tell the story of your thinking</h2>
          <div style={promptGrid}>
            {template.explainPrompts.map((prompt) => <div key={prompt} style={promptCard}>{prompt}</div>)}
          </div>
          <label style={fieldLabel}>
            <span>My explanation</span>
            <textarea value={explainText} onChange={(event) => setExplainText(event.target.value)} style={textarea} rows={6} placeholder={activeProfile.age <= 5 ? "Say your answer to a grown-up, or add a few words here." : "Use the prompts above to explain your choices."} />
          </label>
          <button onClick={finishProject} style={largePrimaryButton} type="button">Finish project and add to portfolio</button>
        </section>
      )}
    </main>
  );
}

const page: React.CSSProperties = { width: "min(1120px,calc(100% - 28px))", minHeight: "100vh", margin: "0 auto", padding: "18px 0 70px", color: "#fff" };
const topbar: React.CSSProperties = { minHeight: 64, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const secondaryLink: React.CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "#181d28", color: "#fff", textDecoration: "none", fontWeight: 900 };
const primaryLink: React.CSSProperties = { display: "inline-block", padding: "14px 20px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", textDecoration: "none", fontWeight: 950 };
const profileRow: React.CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", margin: "10px 0 16px" };
const profileButton: React.CSSProperties = { minWidth: 160, display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.12)", background: "#181d28", color: "#fff", textAlign: "left", cursor: "pointer" };
const profileButtonActive: React.CSSProperties = { borderColor: "#d9ff5b", background: "rgba(217,255,91,.1)" };
const heroCard: React.CSSProperties = { padding: "clamp(25px,5vw,52px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.24)", background: "linear-gradient(145deg,rgba(217,255,91,.09),rgba(127,220,255,.07) 50%,#181d28)", boxShadow: "0 28px 70px rgba(0,0,0,.25)" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 26, alignItems: "center" };
const eyebrow: React.CSSProperties = { color: "#d9ff5b", fontSize: 11, fontWeight: 950, letterSpacing: ".16em" };
const heroTitle: React.CSSProperties = { margin: "11px 0 14px", fontSize: "clamp(3.1rem,8vw,6.7rem)", lineHeight: .88, letterSpacing: "-.075em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.55 };
const progressOrb: React.CSSProperties = { width: 138, height: 138, borderRadius: 999, display: "grid", placeContent: "center", textAlign: "center", background: "#d9ff5b", color: "#10131b", boxShadow: "0 20px 55px rgba(217,255,91,.18)" };
const stepper: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 24 };
const stepChip: React.CSSProperties = { padding: "11px 12px", borderRadius: 999, textAlign: "center", fontSize: 11, fontWeight: 950, letterSpacing: ".1em" };
const notice: React.CSSProperties = { margin: "14px 0", padding: 13, borderRadius: 16, background: "rgba(198,184,255,.14)", border: "1px solid rgba(198,184,255,.28)", color: "#c6b8ff", fontWeight: 850 };
const workCard: React.CSSProperties = { marginTop: 18, padding: "clamp(24px,5vw,44px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const workTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(2.5rem,6vw,4.7rem)", letterSpacing: "-.06em" };
const factCard: React.CSSProperties = { padding: "clamp(18px,4vw,28px)", borderRadius: 22, background: "rgba(127,220,255,.1)", border: "1px solid rgba(127,220,255,.25)", color: "#d9f5ff", fontSize: "clamp(1.2rem,3vw,1.65rem)", lineHeight: 1.55, fontWeight: 800 };
const questionTitle: React.CSSProperties = { margin: "24px 0 14px", fontSize: "clamp(1.5rem,4vw,2.4rem)" };
const optionGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 };
const optionButton: React.CSSProperties = { minHeight: 82, padding: 16, borderRadius: 22, border: "2px solid", background: "#222936", color: "#fff", fontSize: 18, fontWeight: 950, cursor: "pointer" };
const fieldLabel: React.CSSProperties = { display: "grid", gap: 8, marginTop: 18, color: "#d9f5ff", fontWeight: 900 };
const textInput: React.CSSProperties = { width: "100%", padding: 15, borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 18, fontWeight: 850 };
const textarea: React.CSSProperties = { width: "100%", resize: "vertical", padding: 15, borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#10131b", color: "#fff", fontSize: 16, lineHeight: 1.5, fontFamily: "inherit" };
const ideaGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9, marginTop: 18 };
const ideaButton: React.CSSProperties = { minHeight: 58, padding: "12px 14px", borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", fontWeight: 900, cursor: "pointer" };
const largePrimaryButton: React.CSSProperties = { width: "100%", marginTop: 22, padding: "17px 20px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontSize: 17, fontWeight: 950, cursor: "pointer" };
const promptGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 };
const promptCard: React.CSSProperties = { padding: 17, borderRadius: 18, background: "rgba(198,184,255,.12)", border: "1px solid rgba(198,184,255,.22)", color: "#e7e0ff", fontWeight: 850 };
const doneCard: React.CSSProperties = { marginTop: 18, padding: "clamp(30px,6vw,64px)", borderRadius: 34, border: "1px solid rgba(217,255,91,.32)", background: "rgba(217,255,91,.07)", textAlign: "center" };
const doneTitle: React.CSSProperties = { margin: "10px 0 18px", fontSize: "clamp(3rem,8vw,6rem)", lineHeight: .9, letterSpacing: "-.07em" };
const artifactSummary: React.CSSProperties = { maxWidth: 760, margin: "0 auto", color: "#d9f5ff", fontSize: 18, lineHeight: 1.65 };
const parentNoteView: React.CSSProperties = { maxWidth: 680, margin: "18px auto 0", padding: 15, borderRadius: 18, background: "rgba(198,184,255,.12)", color: "#e7e0ff", fontWeight: 800 };
const rewardPill: React.CSSProperties = { display: "inline-block", marginTop: 20, padding: "10px 14px", borderRadius: 999, background: "#d9ff5b", color: "#10131b", fontWeight: 950 };
const actionRow: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 22 };
const section: React.CSSProperties = { marginTop: 18, padding: "clamp(22px,4vw,34px)", borderRadius: 30, border: "1px solid rgba(255,255,255,.1)", background: "#181d28", boxShadow: "0 24px 58px rgba(0,0,0,.22)" };
const sectionTitle: React.CSSProperties = { margin: "8px 0 18px", fontSize: "clamp(2rem,5vw,3.8rem)", letterSpacing: "-.052em" };
const sectionHeadingRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" };
const templateGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(235px,1fr))", gap: 12 };
const templateCard: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 9, padding: 18, borderRadius: 22, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const subjectPill: React.CSSProperties = { alignSelf: "flex-start", padding: "6px 9px", borderRadius: 999, background: "rgba(127,220,255,.12)", color: "#7fdcff", fontSize: 10, fontWeight: 950 };
const cardTitle: React.CSSProperties = { margin: 0, fontSize: 23, letterSpacing: "-.035em" };
const smallPrimaryButton: React.CSSProperties = { marginTop: "auto", padding: "11px 15px", borderRadius: 999, border: 0, background: "#d9ff5b", color: "#10131b", fontWeight: 950, cursor: "pointer" };
const projectStatus: React.CSSProperties = { padding: "9px 12px", borderRadius: 999, background: "#c6b8ff", color: "#10131b", fontSize: 11, fontWeight: 950 };
const artifactGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 };
const artifactCard: React.CSSProperties = { padding: 16, borderRadius: 18, background: "#10131b", border: "1px solid rgba(255,255,255,.08)" };
const noteCard: React.CSSProperties = { display: "grid", gap: 9, marginTop: 14, padding: 16, borderRadius: 20, background: "rgba(198,184,255,.08)", border: "1px solid rgba(198,184,255,.2)" };
const historyList: React.CSSProperties = { display: "grid", gap: 9 };
const historyButton: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: 15, borderRadius: 19, border: "1px solid rgba(255,255,255,.1)", background: "#10131b", color: "#fff", textAlign: "left", cursor: "pointer" };
