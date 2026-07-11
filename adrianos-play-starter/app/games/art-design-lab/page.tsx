"use client";

import GameFrame from "@/components/GameFrame";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { readLearningForProfile, recordLearningAttempt, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";
import { addArtTools, readArtToolkit } from "@/lib/adrian-art-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Level = "Color Explorer" | "Picture Maker" | "Design Detective";
type Skill = "color" | "shape" | "composition" | "observation" | "story";
type Mission = { id: string; level: Level; skill: Skill; emoji: string; prompt: string; options: string[]; answer: string; hint: string; explanation: string; toolId: string; toolLabel: string };

const SKILLS: Record<Skill, { id: string; label: string }> = {
  color: { id: "art-color-relationships", label: "Color relationships" },
  shape: { id: "art-shape-form", label: "Shape and form" },
  composition: { id: "art-composition", label: "Composition and balance" },
  observation: { id: "art-observation", label: "Visual observation" },
  story: { id: "art-visual-storytelling", label: "Visual storytelling" },
};

const MISSIONS: Mission[] = [
  { id: "ce-warm", level: "Color Explorer", skill: "color", emoji: "🔥", prompt: "Which group feels warmest?", options: ["Red, orange, yellow", "Blue, green, violet", "Black, white, gray"], answer: "Red, orange, yellow", hint: "Think of sunlight and fire.", explanation: "Red, orange, and yellow are commonly grouped as warm colors.", toolId: "warm-cool", toolLabel: "Warm & Cool Color Finder" },
  { id: "ce-shapes", level: "Color Explorer", skill: "shape", emoji: "🔺", prompt: "Which shape has three straight sides?", options: ["Triangle", "Circle", "Oval"], answer: "Triangle", hint: "Count the sides.", explanation: "A triangle has three straight sides.", toolId: "shape-spotter", toolLabel: "Shape Spotter" },
  { id: "ce-center", level: "Color Explorer", skill: "composition", emoji: "🎯", prompt: "To make one object feel most important, where could you place it?", options: ["Near the center with space around it", "Hidden behind everything", "Cut into tiny pieces"], answer: "Near the center with space around it", hint: "Give the eye one clear place to land.", explanation: "Position and empty space can create a focal point.", toolId: "focal-point", toolLabel: "Focal Point Maker" },
  { id: "ce-detail", level: "Color Explorer", skill: "observation", emoji: "👀", prompt: "What is the best first step when drawing a leaf?", options: ["Look carefully at its outline and veins", "Guess without looking", "Draw only a square"], answer: "Look carefully at its outline and veins", hint: "Artists collect visual evidence first.", explanation: "Observation helps artists notice shape, texture, and small details.", toolId: "slow-looking", toolLabel: "Slow Looking Lens" },
  { id: "ce-story", level: "Color Explorer", skill: "story", emoji: "🌧️", prompt: "Which detail best shows that a picture happens during a storm?", options: ["Bent trees and dark clouds", "A bright birthday cake", "A sleeping cat indoors"], answer: "Bent trees and dark clouds", hint: "Choose visual clues connected to weather.", explanation: "Dark clouds and bent trees communicate wind and rain without words.", toolId: "story-clue", toolLabel: "Visual Story Clue" },
  { id: "pm-complement", level: "Picture Maker", skill: "color", emoji: "🟠", prompt: "Which pair creates strong color contrast?", options: ["Orange and blue", "Blue and slightly darker blue", "White and off-white"], answer: "Orange and blue", hint: "Look for colors opposite each other on a color wheel.", explanation: "Orange and blue are complementary colors and create strong contrast.", toolId: "contrast-pair", toolLabel: "Color Contrast Pair" },
  { id: "pm-overlap", level: "Picture Maker", skill: "shape", emoji: "🏔️", prompt: "What can overlapping shapes suggest?", options: ["One object is in front of another", "Every object is equally far away", "The page has no depth"], answer: "One object is in front of another", hint: "Think about what covers part of something else.", explanation: "Overlap is a visual depth cue.", toolId: "depth-builder", toolLabel: "Depth Builder" },
  { id: "pm-balance", level: "Picture Maker", skill: "composition", emoji: "⚖️", prompt: "A large dark shape sits on the left. What could balance it?", options: ["Several smaller shapes on the right", "Nothing anywhere else", "Another shape directly on top"], answer: "Several smaller shapes on the right", hint: "Visual weight can be balanced without copying exactly.", explanation: "Several smaller elements can balance one large element asymmetrically.", toolId: "balance-builder", toolLabel: "Balance Builder" },
  { id: "pm-negative", level: "Picture Maker", skill: "observation", emoji: "🕊️", prompt: "What is negative space?", options: ["The empty area around and between objects", "A mistake that must be erased", "Only the darkest color"], answer: "The empty area around and between objects", hint: "Look at the shapes made by the background.", explanation: "Negative space is the unoccupied area that helps define the subject.", toolId: "negative-space", toolLabel: "Negative Space Finder" },
  { id: "pm-sequence", level: "Picture Maker", skill: "story", emoji: "📚", prompt: "Which three-picture sequence tells the clearest story?", options: ["Seed, sprout, flower", "Flower, moon, shoe", "Three identical blank pages"], answer: "Seed, sprout, flower", hint: "Look for a beginning, change, and result.", explanation: "The sequence communicates growth over time.", toolId: "sequence-story", toolLabel: "Picture Sequence Builder" },
  { id: "dd-value", level: "Design Detective", skill: "color", emoji: "🌗", prompt: "What does value mean in art?", options: ["How light or dark a color is", "How expensive a painting is", "How many colors exist"], answer: "How light or dark a color is", hint: "Imagine turning a color image into grayscale.", explanation: "Value describes lightness and darkness and helps create contrast and form.", toolId: "value-map", toolLabel: "Value Map" },
  { id: "dd-form", level: "Design Detective", skill: "shape", emoji: "🧊", prompt: "What changes a flat square into the illusion of a cube?", options: ["Adding connected planes with light and shadow", "Making it smaller", "Changing it into a circle"], answer: "Adding connected planes with light and shadow", hint: "Form needs depth cues.", explanation: "Planes, perspective, and shading create the illusion of three-dimensional form.", toolId: "form-builder", toolLabel: "Form Builder" },
  { id: "dd-hierarchy", level: "Design Detective", skill: "composition", emoji: "📰", prompt: "Which design creates the clearest hierarchy?", options: ["Large title, medium heading, smaller body text", "Everything identical in size", "Random sizes with no pattern"], answer: "Large title, medium heading, smaller body text", hint: "Hierarchy guides the eye from most important to least important.", explanation: "Consistent size differences create visual hierarchy.", toolId: "hierarchy-guide", toolLabel: "Visual Hierarchy Guide" },
  { id: "dd-evidence", level: "Design Detective", skill: "observation", emoji: "🖼️", prompt: "Which critique uses visual evidence?", options: ["The diagonal lines make the scene feel energetic", "I just do not like it", "It is good because I said so"], answer: "The diagonal lines make the scene feel energetic", hint: "A strong critique names something visible and its effect.", explanation: "Evidence-based critique connects a visual choice to the viewer's experience.", toolId: "critique-lens", toolLabel: "Evidence Critique Lens" },
  { id: "dd-symbol", level: "Design Detective", skill: "story", emoji: "🕯️", prompt: "A tiny lit window appears in a dark city. What could it symbolize?", options: ["Hope or safety", "Only the exact size of the building", "That color has no meaning"], answer: "Hope or safety", hint: "Symbols carry ideas beyond the literal object.", explanation: "A light in darkness can symbolize hope, safety, or persistence depending on context.", toolId: "symbol-reader", toolLabel: "Symbol Reader" },
];

const LEVELS: Level[] = ["Color Explorer", "Picture Maker", "Design Detective"];
const PALETTES = [
  { name: "Sunset", colors: ["#ff7a59", "#ffd166", "#7b2cbf", "#231942"] },
  { name: "Ocean", colors: ["#0077b6", "#00b4d8", "#90e0ef", "#023e8a"] },
  { name: "Forest", colors: ["#2d6a4f", "#52b788", "#d8f3dc", "#1b4332"] },
];
const SHAPES = ["circle", "square", "triangle"] as const;

type ShapeName = typeof SHAPES[number];

type ArtArtifact = { id: string; title: string; palette: string; shapes: ShapeName[]; story: string; createdAt: string };

function adaptiveLevel(age: number): Level { return age <= 5 ? "Color Explorer" : age <= 7 ? "Picture Maker" : "Design Detective"; }

function saveArtwork(profileId: string, artifact: ArtArtifact) {
  const state = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const item: ReviewItem = {
    id: `artwork:${artifact.id}`,
    gameSlug: "adrianos-artwork",
    skillId: "art-visual-storytelling",
    subject: "Art",
    prompt: artifact.title,
    correctAnswer: "",
    dueAt: "2999-12-31T23:59:59.999Z",
    updatedAt: now,
    successes: artifact.shapes.length,
    status: "resolved",
    data: { artArtifact: true, artifactJson: JSON.stringify(artifact) },
  };
  writeLearningForProfile(profileId, { ...state, reviewQueue: [...state.reviewQueue.filter((row) => row.id !== item.id), item].slice(-100) });
}

export default function ArtDesignLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const { recordPlay, award, progress } = useAdrianProgress();
  const suggested = adaptiveLevel(profile.age);
  const [level, setLevel] = useState<Level>(suggested);
  const [session, setSession] = useState<Mission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [missed, setMissed] = useState(false);
  const [stage, setStage] = useState<"menu" | "quiz" | "create" | "done">("menu");
  const [message, setMessage] = useState("Choose a studio level.");
  const [toolkit, setToolkit] = useState(() => readArtToolkit(profileId));
  const [newTools, setNewTools] = useState<string[]>([]);
  const [title, setTitle] = useState(`${profile.name}'s Picture`);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [shapes, setShapes] = useState<ShapeName[]>(["circle", "triangle", "square"]);
  const [story, setStory] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("level") as Level | null;
    if (requested && LEVELS.includes(requested)) setLevel(requested);
  }, []);

  const current = session[index] ?? null;
  const palette = PALETTES[paletteIndex];
  const best = progress.games["art-design-lab"]?.bestScore ?? 0;
  const previewShapes = useMemo(() => shapes.slice(0, 6), [shapes]);

  function start() {
    const pool = MISSIONS.filter((mission) => mission.level === level);
    setSession([...pool].sort(() => Math.random() - .5));
    setIndex(0); setSelected(""); setScore(0); setLocked(false); setMissed(false); setStage("quiz");
    setMessage("Look carefully. Choose the answer supported by the visual idea.");
    recordPlay("art-design-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = SKILLS[current.skill];
    recordLearningAttempt({ gameSlug: "art-design-lab", subject: "Art", skillId: skill.id, skillLabel: skill.label, prompt: current.prompt, correctAnswer: current.answer, correct, data: { missionId: current.id, level: current.level } }, profileId);
  }

  function check() {
    if (!current || !selected || locked) return;
    if (selected !== current.answer) {
      if (!missed) saveAttempt(false);
      setMissed(true); setSelected(""); setMessage(`Studio clue: ${current.hint}`); return;
    }
    saveAttempt(true); setLocked(true); setScore((value) => value + (missed ? 6 : 10)); setMessage(`Yes. ${current.explanation}`);
  }

  function next() {
    if (!locked) return;
    if (index >= session.length - 1) { setStage("create"); return; }
    setIndex((value) => value + 1); setSelected(""); setLocked(false); setMissed(false); setMessage("New visual problem. Look before deciding.");
  }

  function toggleShape(shape: ShapeName) {
    setShapes((currentShapes) => currentShapes.includes(shape) ? currentShapes.filter((item) => item !== shape) : [...currentShapes, shape]);
  }

  function publish() {
    const artifact: ArtArtifact = { id: `${Date.now()}`, title: title.trim() || `${profile.name}'s Picture`, palette: palette.name, shapes, story: story.trim(), createdAt: new Date().toISOString() };
    saveArtwork(profileId, artifact);
    const solvedTools = session.filter((mission) => true).map((mission) => ({ id: mission.toolId, label: mission.toolLabel, emoji: mission.emoji })).slice(0, 3);
    const result = addArtTools(profileId, solvedTools, true);
    setToolkit(result.toolkit); setNewTools(result.added.map((tool) => tool.label));
    award("art-design-lab", { xp: 35 + score, coins: 12, score, completed: true });
    setStage("done");
  }

  if (stage === "menu") return (
    <GameFrame title="Art & Design Lab">
      <section style={panel}>
        <div style={{ fontSize: 76 }}>🎨</div><span style={eyebrow}>15 VISUAL MISSIONS · ORIGINAL ARTWORK</span>
        <h1 style={hero}>Look closely. Design on purpose.</h1>
        <p style={muted}>Explore color, shape, composition, observation, and visual storytelling, then publish a browser-made artwork.</p>
        <div style={recommendation}><strong>{suggested}</strong><span>Suggested for age {profile.age}</span></div>
        <div style={row}>{LEVELS.map((item) => <button key={item} type="button" onClick={() => setLevel(item)} style={pill(level === item)}>{item}</button>)}</div>
        <div style={row}><button type="button" onClick={start} style={primary}>Enter the studio</button></div>
        <p style={muted}>🧰 {toolkit.cards.length} tools · 🖼️ {toolkit.artworks} artworks · Best {best}</p>
      </section>
    </GameFrame>
  );

  if (stage === "quiz" && current) return (
    <GameFrame title="Art & Design Lab">
      <section style={panel}>
        <div style={topline}><span>Mission {index + 1} of {session.length}</span><span>{SKILLS[current.skill].label}</span><span>{score} pts</span></div>
        <div style={{ fontSize: 66 }}>{current.emoji}</div><span style={eyebrow}>{current.level.toUpperCase()}</span><h1 style={question}>{current.prompt}</h1>
        <div style={answers}>{current.options.map((option) => <button key={option} type="button" disabled={locked} onClick={() => setSelected(option)} style={answer(selected === option, locked && option === current.answer)}>{option}</button>)}</div>
        <p style={{ ...muted, color: locked ? "#d9ff5b" : missed ? "#ffcf83" : "#aab1bf" }}>{message}</p>
        <div style={row}>{locked ? <button type="button" onClick={next} style={primary}>{index === session.length - 1 ? "Make an artwork →" : "Next visual mission →"}</button> : <button type="button" onClick={check} disabled={!selected} style={{ ...primary, opacity: selected ? 1 : .45 }}>Check the design idea</button>}</div>
      </section>
    </GameFrame>
  );

  if (stage === "create") return (
    <GameFrame title="Art & Design Lab">
      <div style={studioGrid}>
        <section style={panel}>
          <span style={eyebrow}>CREATE & PUBLISH</span><h1 style={question}>Build a visual story</h1>
          <label style={label}>Artwork title<input value={title} onChange={(event) => setTitle(event.target.value)} style={input} /></label>
          <h3>Palette</h3><div style={row}>{PALETTES.map((item, i) => <button key={item.name} type="button" onClick={() => setPaletteIndex(i)} style={pill(i === paletteIndex)}>{item.name}</button>)}</div>
          <h3>Shapes</h3><div style={row}>{SHAPES.map((shape) => <button key={shape} type="button" onClick={() => toggleShape(shape)} style={pill(shapes.includes(shape))}>{shape}</button>)}</div>
          <label style={label}>What is happening in your picture?<textarea value={story} onChange={(event) => setStory(event.target.value)} rows={4} style={input} placeholder="A quiet planet wakes up..." /></label>
          <button type="button" onClick={publish} disabled={shapes.length === 0} style={{ ...primary, opacity: shapes.length ? 1 : .45 }}>Publish artwork</button>
        </section>
        <section style={canvas}>
          <div style={{ color: palette.colors[3], fontWeight: 950 }}>{title}</div>
          {previewShapes.map((shape, i) => {
            const common: React.CSSProperties = { position: "absolute", left: `${12 + (i * 15) % 70}%`, top: `${18 + (i * 23) % 58}%`, width: 70 + (i % 3) * 18, height: 70 + (i % 2) * 22, background: palette.colors[i % palette.colors.length], opacity: .88, transform: `rotate(${i * 17}deg)` };
            if (shape === "circle") return <div key={`${shape}-${i}`} style={{ ...common, borderRadius: "50%" }} />;
            if (shape === "triangle") return <div key={`${shape}-${i}`} style={{ ...common, width: 0, height: 0, background: "transparent", borderLeft: "45px solid transparent", borderRight: "45px solid transparent", borderBottom: `85px solid ${palette.colors[i % palette.colors.length]}` }} />;
            return <div key={`${shape}-${i}`} style={common} />;
          })}
          <div style={caption}>{story || "Your visual story will appear here."}</div>
        </section>
      </div>
    </GameFrame>
  );

  return (
    <GameFrame title="Art & Design Lab">
      <section style={panel}>
        <div style={{ fontSize: 78 }}>🖼️</div><span style={eyebrow}>ARTWORK PUBLISHED</span><h1 style={hero}>{title}</h1>
        <p style={muted}>Your artwork is saved in the learning snapshot and now counts as portfolio evidence.</p>
        {newTools.length > 0 && <div style={recommendation}><strong>New tools earned</strong><span>{newTools.join(" · ")}</span></div>}
        <div style={row}><button type="button" onClick={() => setStage("menu")} style={primary}>Make another</button><Link href="/portfolio" style={secondary}>Open portfolio</Link></div>
      </section>
    </GameFrame>
  );
}

const panel: React.CSSProperties = { width: "min(900px,100%)", margin: "0 auto", padding: "clamp(24px,5vw,50px)", borderRadius: 30, background: "#181d28", border: "1px solid rgba(255,255,255,.11)", textAlign: "center" };
const hero: React.CSSProperties = { margin: "12px 0", fontSize: "clamp(2.8rem,7vw,5.5rem)", lineHeight: .92, letterSpacing: "-.065em" };
const question: React.CSSProperties = { margin: "12px 0 22px", fontSize: "clamp(2rem,5vw,3.7rem)", lineHeight: 1, letterSpacing: "-.05em" };
const eyebrow: React.CSSProperties = { color: "#ff9ad5", fontSize: 11, fontWeight: 950, letterSpacing: ".17em" };
const muted: React.CSSProperties = { color: "#aab1bf", lineHeight: 1.6 };
const recommendation: React.CSSProperties = { maxWidth: 620, margin: "20px auto", display: "grid", gap: 5, padding: 16, borderRadius: 20, background: "rgba(255,154,213,.08)", border: "1px solid rgba(255,154,213,.25)" };
const row: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 9, flexWrap: "wrap", marginTop: 18 };
const pill = (active: boolean): React.CSSProperties => ({ padding: "10px 14px", borderRadius: 999, border: `1px solid ${active ? "#ff9ad5" : "rgba(255,255,255,.14)"}`, background: active ? "rgba(255,154,213,.12)" : "#222936", color: active ? "#ffb9df" : "#fff", fontWeight: 900, cursor: "pointer" });
const primary: React.CSSProperties = { minHeight: 48, padding: "13px 20px", borderRadius: 999, border: 0, background: "#ff9ad5", color: "#17121a", fontSize: 16, fontWeight: 950, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, background: "rgba(127,220,255,.1)", color: "#7fdcff", border: "1px solid rgba(127,220,255,.35)", textDecoration: "none", display: "inline-grid", placeItems: "center" };
const topline: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 18, color: "#aab1bf", fontSize: 12, fontWeight: 850 };
const answers: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 11 };
const answer = (selected: boolean, correct: boolean): React.CSSProperties => ({ minHeight: 88, padding: 16, borderRadius: 22, border: `2px solid ${correct ? "#d9ff5b" : selected ? "#7fdcff" : "rgba(255,255,255,.12)"}`, background: correct ? "rgba(217,255,91,.13)" : selected ? "rgba(127,220,255,.12)" : "#222936", color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer" });
const studioGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, alignItems: "stretch" };
const label: React.CSSProperties = { display: "grid", gap: 7, textAlign: "left", margin: "18px 0", fontWeight: 900 };
const input: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 14, border: "1px solid rgba(255,255,255,.16)", background: "#222936", color: "#fff", font: "inherit" };
const canvas: React.CSSProperties = { position: "relative", minHeight: 540, overflow: "hidden", padding: 24, borderRadius: 30, background: "#f6f1df", color: "#222", border: "10px solid #c9a56b" };
const caption: React.CSSProperties = { position: "absolute", left: 20, right: 20, bottom: 20, padding: 12, borderRadius: 12, background: "rgba(255,255,255,.82)", color: "#222", fontFamily: "Georgia,serif" };
