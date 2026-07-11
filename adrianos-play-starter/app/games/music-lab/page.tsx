"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { MUSIC_MISSIONS, MUSIC_SKILLS, musicMissionById, type MusicLevel, type MusicMission, type MusicSkill } from "@/lib/adrian-music-bank";
import { addMusicToolCards, readMusicToolkit, type MusicToolCard } from "@/lib/adrian-music-toolkit";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LEVELS: MusicLevel[] = ["Beat Starter", "Melody Maker", "Music Detective"];
const SKILLS = Object.entries(MUSIC_SKILLS) as Array<[MusicSkill, (typeof MUSIC_SKILLS)[MusicSkill]]>;

function midiToHz(note: number): number { return 440 * Math.pow(2, (note - 69) / 12); }
function adaptiveLevel(profileId: string, age: number): MusicLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(MUSIC_SKILLS).map((skill) => learning.skills[skill.id]).filter(Boolean);
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length ? evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length : 0;
  if (age <= 5) return "Beat Starter";
  if (mastery >= 72 && attempts >= 12) return "Music Detective";
  return "Melody Maker";
}
function focusFrom(value: string | null): MusicSkill | null { return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null; }

export default function MusicLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggested = adaptiveLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<MusicLevel>(suggested);
  const [focus, setFocus] = useState<MusicSkill | null>(null);
  const [session, setSession] = useState<MusicMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [locked, setLocked] = useState(false);
  const [missed, setMissed] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Choose a music level and press play.");
  const [toolkit, setToolkit] = useState(() => readMusicToolkit(profileId));
  const [newCards, setNewCards] = useState<MusicToolCard[]>([]);
  const [solvedCards, setSolvedCards] = useState<string[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const current = session[index] ?? null;
  const dueReviews = getDueReviewItems(profileId, "music-lab");
  const bestScore = progress.games["music-lab"]?.bestScore ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    if (LEVELS.includes(requestedLevel as MusicLevel)) setLevel(requestedLevel as MusicLevel);
    setFocus(focusFrom(params.get("focus")));
    return () => { audioRef.current?.close(); };
  }, []);

  function getAudio(): AudioContext {
    if (!audioRef.current) audioRef.current = new AudioContext();
    return audioRef.current;
  }

  function tone(ctx: AudioContext, when: number, frequency: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.18, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  function playMission() {
    if (!current) return;
    const ctx = getAudio();
    const start = ctx.currentTime + 0.08;
    if (current.skill === "rhythm" || current.skill === "beat") {
      let cursor = start;
      current.pattern.forEach((value, i) => {
        const isRest = value === 0;
        const duration = value === 2 ? 0.52 : 0.22;
        const gap = current.id === "beat-2" && i >= 4 ? 0.28 : 0.48;
        if (!isRest) tone(ctx, cursor, i % 4 === 0 ? 520 : 400, duration);
        cursor += gap;
      });
    } else {
      current.pattern.forEach((note, i) => {
        if (note > 0) tone(ctx, start + i * 0.42, midiToHz(note), 0.32);
      });
    }
    setMessage("Listen again as many times as you need.");
  }

  function reviewItems(): MusicMission[] {
    return getDueReviewItems(profileId, "music-lab")
      .map((item) => typeof item.data?.missionId === "string" ? musicMissionById(item.data.missionId) : null)
      .filter((item): item is MusicMission => Boolean(item))
      .slice(0, 6);
  }

  function normalItems(): MusicMission[] {
    const pool = MUSIC_MISSIONS.filter((mission) => mission.level === level && (!focus || mission.skill === focus));
    const fallback = MUSIC_MISSIONS.filter((mission) => mission.level === level);
    return pickFreshItems(pool.length ? pool : fallback, Math.min(5, (pool.length ? pool : fallback).length), `adrianos-content:music:${profileId}:${level}:${focus ?? "mixed"}`, (mission) => mission.id);
  }

  function startGame(review = false) {
    const reviews = reviewItems();
    const next = review && reviews.length ? reviews : normalItems();
    if (!next.length) return;
    setSession(next); setIndex(0); setSelected(""); setLocked(false); setMissed(false); setReviewMode(review && reviews.length > 0); setPlaying(true); setFinished(false); setScore(0); setSolvedCards([]); setNewCards([]); setMessage("Press Hear it, then choose the best musical explanation.");
    recordPlay("music-lab");
  }

  function save(correct: boolean) {
    if (!current) return;
    const skill = MUSIC_SKILLS[current.skill];
    recordLearningAttempt({ gameSlug: "music-lab", subject: "Music", skillId: skill.id, skillLabel: skill.label, prompt: `${current.title}: ${current.prompt}`, correctAnswer: current.answer, correct, review: reviewMode, data: { missionId: current.id, level: current.level, cardId: current.cardId } }, profileId);
  }

  function check() {
    if (!current || !selected || locked) return;
    if (selected !== current.answer) {
      if (!missed) save(false);
      setMissed(true); setSelected(""); setMessage(`Listening clue: ${current.hint}`); return;
    }
    save(true); setLocked(true); setSolvedCards((cards) => cards.includes(current.cardId) ? cards : [...cards, current.cardId]); setScore((value) => value + (missed ? 6 : 10)); setMessage(`Exactly. ${current.explanation}`);
  }

  function finish() {
    if (!reviewMode) {
      const solved = new Set(solvedCards);
      const cards = session.filter((mission) => solved.has(mission.cardId)).map((mission) => ({ id: mission.cardId, label: mission.cardLabel, emoji: mission.emoji }));
      const result = addMusicToolCards(profileId, cards.slice(0, 3));
      setToolkit(result.toolkit); setNewCards(result.added);
    }
    award("music-lab", { xp: (reviewMode ? 18 : 34) + score, coins: reviewMode ? 3 : Math.max(7, Math.floor(score / 6)), score, completed: !reviewMode });
    setPlaying(false); setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) { finish(); return; }
    setIndex((value) => value + 1); setSelected(""); setLocked(false); setMissed(false); setMessage("New sound clue. Press Hear it when you are ready.");
  }

  if (!playing && !finished) return <GameFrame title="Music Lab"><section style={panel}><div style={{fontSize:76}}>🎶</div><span style={eyebrow}>LISTEN · TAP · COMPARE · CREATE</span><h1 style={hero}>Music is a pattern you can hear.</h1><p style={muted}>Train the ear for beat, rhythm, pitch, form, and composition using sounds made directly in the browser.</p><div style={recommend}><b>{suggested}</b><span>Adaptive recommendation</span></div><div style={row}>{LEVELS.map((item)=><button key={item} onClick={()=>setLevel(item)} style={pill(level===item)}>{item}</button>)}</div>{focus&&<p style={muted}>Focused skill: <b>{MUSIC_SKILLS[focus].label}</b> <button onClick={()=>setFocus(null)} style={tiny}>Use mixed skills</button></p>}<div style={actions}><button onClick={()=>startGame(false)} style={primary}>Start listening mission</button>{dueReviews.length>0&&<button onClick={()=>startGame(true)} style={secondary}>Review {dueReviews.length} due</button>}</div><p style={muted}>🎼 {toolkit.cards.length} music tools · {toolkit.missions} missions · best {bestScore}</p></section></GameFrame>;

  if (finished) return <GameFrame title="Music Lab"><section style={panel}><div style={{fontSize:76}}>🎼</div><span style={eyebrow}>{reviewMode?"LISTENING REVIEW COMPLETE":"MUSIC MISSION COMPLETE"}</span><h1 style={hero}>{score} points</h1>{newCards.length>0&&<div style={cardGrid}>{newCards.map((card)=><div key={card.id} style={toolCard}><span style={{fontSize:34}}>{card.emoji}</span><b>{card.label}</b><small>NEW MUSIC TOOL</small></div>)}</div>}<div style={actions}><button onClick={()=>startGame(reviewMode)} style={primary}>Play another set</button><Link href="/school" style={link}>Return to School</Link></div></section></GameFrame>;

  if (!current) return null;
  return <GameFrame title="Music Lab"><div style={shell}><div style={stats}><span>{reviewMode?"Spaced review":`Sound ${index+1} of ${session.length}`}</span><span>{current.level}</span><span>Score {score}</span></div><section style={caseCard}><span style={eyebrow}>{MUSIC_SKILLS[current.skill].label.toUpperCase()}</span><h1 style={question}>{current.emoji} {current.title}</h1><button onClick={playMission} style={hear}>▶ Hear it</button><h2>{current.prompt}</h2><div style={answers}>{current.options.map((option)=><button key={option} disabled={locked} onClick={()=>!locked&&setSelected(option)} style={answer(selected===option,locked&&option===current.answer)}>{option}</button>)}</div><p style={{...muted,color:locked?"#d9ff5b":missed?"#ffcf83":"#aab1bf"}}>{message}</p><div style={actions}>{!locked?<button disabled={!selected} onClick={check} style={{...primary,opacity:selected?1:.45}}>Check my ears</button>:<button onClick={advance} style={primary}>{index===session.length-1?"Finish mission":"Next sound →"}</button>}</div></section></div></GameFrame>;
}

const panel: React.CSSProperties={width:"min(900px,100%)",margin:"0 auto",padding:"clamp(26px,5vw,52px)",borderRadius:32,background:"#181d28",border:"1px solid rgba(255,255,255,.11)",textAlign:"center"};
const shell: React.CSSProperties={width:"min(940px,100%)",margin:"0 auto"};
const eyebrow: React.CSSProperties={color:"#ff9fd8",fontSize:11,fontWeight:950,letterSpacing:".17em"};
const hero: React.CSSProperties={fontSize:"clamp(2.8rem,7vw,5.5rem)",lineHeight:.92,letterSpacing:"-.065em",margin:"12px 0"};
const question: React.CSSProperties={fontSize:"clamp(2.3rem,6vw,4.3rem)",lineHeight:.95,letterSpacing:"-.055em"};
const muted: React.CSSProperties={color:"#aab1bf",lineHeight:1.6};
const recommend: React.CSSProperties={display:"grid",gap:4,maxWidth:520,margin:"20px auto",padding:16,borderRadius:20,background:"rgba(255,159,216,.09)",border:"1px solid rgba(255,159,216,.25)"};
const row: React.CSSProperties={display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"};
const pill=(active:boolean):React.CSSProperties=>({padding:"11px 15px",borderRadius:999,border:`1px solid ${active?"#ff9fd8":"rgba(255,255,255,.14)"}`,background:active?"rgba(255,159,216,.12)":"#222936",color:active?"#ff9fd8":"#fff",fontWeight:900,cursor:"pointer"});
const tiny:React.CSSProperties={marginLeft:8,padding:"6px 9px",borderRadius:999,border:"1px solid rgba(255,255,255,.18)",background:"transparent",color:"#fff",cursor:"pointer"};
const actions:React.CSSProperties={display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",marginTop:22};
const primary:React.CSSProperties={minHeight:48,padding:"13px 20px",borderRadius:999,border:0,background:"#ff9fd8",color:"#111",fontWeight:950,cursor:"pointer"};
const secondary:React.CSSProperties={...primary,background:"#c6b8ff"};
const link:React.CSSProperties={minHeight:48,padding:"13px 20px",borderRadius:999,border:"1px solid rgba(255,255,255,.18)",color:"#fff",textDecoration:"none",display:"grid",placeItems:"center"};
const stats:React.CSSProperties={display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10,padding:"10px 14px",borderRadius:17,background:"#181d28",color:"#aab1bf",fontSize:12,fontWeight:850};
const caseCard:React.CSSProperties={padding:"clamp(24px,5vw,44px)",borderRadius:30,background:"#181d28",border:"1px solid rgba(255,159,216,.2)",textAlign:"center"};
const hear:React.CSSProperties={padding:"16px 28px",borderRadius:999,border:0,background:"#7fdcff",color:"#10131b",fontSize:18,fontWeight:950,cursor:"pointer"};
const answers:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:11,marginTop:18};
const answer=(selected:boolean,correct:boolean):React.CSSProperties=>({minHeight:88,padding:16,borderRadius:22,border:`2px solid ${correct?"#d9ff5b":selected?"#7fdcff":"rgba(255,255,255,.12)"}`,background:correct?"rgba(217,255,91,.13)":selected?"rgba(127,220,255,.12)":"#222936",color:"#fff",fontWeight:900,cursor:"pointer"});
const cardGrid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginTop:18};
const toolCard:React.CSSProperties={display:"grid",gap:6,padding:16,borderRadius:20,background:"rgba(255,159,216,.09)",border:"1px solid rgba(255,159,216,.25)"};
