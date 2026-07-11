"use client";

import GameFrame from "@/components/GameFrame";
import { pickFreshItems } from "@/lib/adrian-content-rotation";
import { getDueReviewItems, readLearningForProfile, recordLearningAttempt } from "@/lib/adrian-learning";
import { getActiveProfile } from "@/lib/adrian-profiles";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { ENVIRONMENT_MISSIONS, ENVIRONMENT_SKILLS, environmentMissionById, type EnvironmentLevel, type EnvironmentMission, type EnvironmentSkill } from "@/lib/adrian-environment-bank";
import { addEnvironmentTools, readEnvironmentToolkit, type EnvironmentTool } from "@/lib/adrian-environment-toolkit";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const LEVELS: EnvironmentLevel[] = ["Nature Helper", "Eco Explorer", "Systems Steward"];
const SKILLS = Object.entries(ENVIRONMENT_SKILLS) as Array<[EnvironmentSkill, (typeof ENVIRONMENT_SKILLS)[EnvironmentSkill]]>;

function recommendedLevel(profileId: string, age: number): EnvironmentLevel {
  const learning = readLearningForProfile(profileId);
  const evidence = Object.values(ENVIRONMENT_SKILLS).map((skill) => learning.skills[skill.id]).filter(Boolean);
  const attempts = evidence.reduce((sum, skill) => sum + skill.attempts, 0);
  const mastery = evidence.length ? evidence.reduce((sum, skill) => sum + skill.mastery, 0) / evidence.length : 0;
  if (age <= 5) return "Nature Helper";
  if (age <= 7) return mastery >= 72 && attempts >= 12 ? "Systems Steward" : "Eco Explorer";
  return mastery >= 48 || attempts >= 8 ? "Systems Steward" : "Eco Explorer";
}

function levelBlurb(level: EnvironmentLevel): string {
  if (level === "Nature Helper") return "Habitats, pollinators, water, reuse, and simple energy-saving choices.";
  if (level === "Eco Explorer") return "Food webs, groundwater, compost, efficiency, and weather versus climate.";
  return "Keystone species, sustainable resources, life cycles, energy systems, and layered climate adaptation.";
}

function focusFromParam(value: string | null): EnvironmentSkill | null {
  if (!value) return null;
  return SKILLS.find(([, skill]) => skill.id === value)?.[0] ?? null;
}

export default function NatureEnvironmentLabPage() {
  const profile = getActiveProfile();
  const profileId = profile.id;
  const suggested = recommendedLevel(profileId, profile.age);
  const { recordPlay, award, progress } = useAdrianProgress();
  const [level, setLevel] = useState<EnvironmentLevel>(suggested);
  const [focus, setFocus] = useState<EnvironmentSkill | null>(null);
  const [session, setSession] = useState<EnvironmentMission[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [recordedMiss, setRecordedMiss] = useState(false);
  const [message, setMessage] = useState("Choose an environment level.");
  const [toolkit, setToolkit] = useState(() => readEnvironmentToolkit(profileId));
  const [newTools, setNewTools] = useState<EnvironmentTool[]>([]);
  const [solvedToolIds, setSolvedToolIds] = useState<string[]>([]);
  const autoStarted = useRef(false);

  const dueReviews = getDueReviewItems(profileId, "nature-environment-lab");
  const current = session[index] ?? null;
  const bestScore = progress.games["nature-environment-lab"]?.bestScore ?? 0;
  const knownToolIds = useMemo(() => new Set(toolkit.cards.map((card) => card.id)), [toolkit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedLevel = params.get("level");
    if (LEVELS.includes(requestedLevel as EnvironmentLevel)) setLevel(requestedLevel as EnvironmentLevel);
    setFocus(focusFromParam(params.get("focus")));
    if (params.get("review") === "1" && dueReviews.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      window.setTimeout(() => startGame(true), 0);
    }
  }, []);

  function reviewItems(): EnvironmentMission[] {
    const seen = new Set<string>();
    return getDueReviewItems(profileId, "nature-environment-lab")
      .map((item) => {
        const id = typeof item.data?.missionId === "string" ? item.data.missionId : "";
        if (!id || seen.has(id)) return null;
        const mission = environmentMissionById(id);
        if (!mission) return null;
        seen.add(id);
        return mission;
      })
      .filter((mission): mission is EnvironmentMission => Boolean(mission))
      .slice(0, 8);
  }

  function normalItems(): EnvironmentMission[] {
    const focused = ENVIRONMENT_MISSIONS.filter((mission) => mission.level === level && (!focus || mission.skill === focus));
    const pool = focused.length ? focused : ENVIRONMENT_MISSIONS.filter((mission) => mission.level === level);
    return pickFreshItems(pool, Math.min(5, pool.length), `adrianos-content:environment:${profileId}:${level}:${focus ?? "mixed"}`, (mission) => mission.id);
  }

  function startGame(useReview = false) {
    const reviews = reviewItems();
    const next = useReview && reviews.length ? reviews : normalItems();
    if (!next.length) return;
    setSession(next); setIndex(0); setSelected(""); setScore(0); setPlaying(true); setFinished(false); setLocked(false);
    setReviewMode(useReview && reviews.length > 0); setRecordedMiss(false); setMessage("Trace the relationships and choose the action supported by the evidence.");
    setNewTools([]); setSolvedToolIds([]); recordPlay("nature-environment-lab");
  }

  function saveAttempt(correct: boolean) {
    if (!current) return;
    const skill = ENVIRONMENT_SKILLS[current.skill];
    recordLearningAttempt({ gameSlug: "nature-environment-lab", subject: "Environment", skillId: skill.id, skillLabel: skill.label, prompt: `${current.title}: ${current.prompt}`, correctAnswer: current.answer, correct, review: reviewMode, data: { missionId: current.id, level: current.level, toolId: current.toolId } }, profileId);
  }

  function checkAnswer() {
    if (!current || !selected || locked) return;
    if (selected !== current.answer) {
      if (!recordedMiss) { saveAttempt(false); setRecordedMiss(true); }
      setSelected(""); setMessage(`Nature clue: ${current.hint}`); return;
    }
    saveAttempt(true); setLocked(true);
    setSolvedToolIds((ids) => ids.includes(current.toolId) ? ids : [...ids, current.toolId]);
    setScore((value) => value + (recordedMiss ? 6 : 10));
    setMessage(`Supported. ${current.explanation}`);
  }

  function finishMission() {
    if (!reviewMode) {
      const solved = new Set(solvedToolIds);
      const unique = new Map<string, Omit<EnvironmentTool, "earnedAt">>();
      for (const mission of session) if (solved.has(mission.toolId) && !unique.has(mission.toolId)) unique.set(mission.toolId, { id: mission.toolId, label: mission.toolLabel, emoji: mission.emoji });
      const result = addEnvironmentTools(profileId, [...unique.values()].slice(0, 3));
      setToolkit(result.toolkit); setNewTools(result.added);
    }
    award("nature-environment-lab", { xp: reviewMode ? 16 + score : 30 + score, coins: reviewMode ? 3 : Math.max(6, Math.floor(score / 6)), score, completed: !reviewMode });
    setPlaying(false); setFinished(true);
  }

  function advance() {
    if (!locked) return;
    if (index >= session.length - 1) return finishMission();
    setIndex((value) => value + 1); setSelected(""); setLocked(false); setRecordedMiss(false);
    setMessage("New environment case. Look for connections, trade-offs, and the scale of the problem.");
  }

  if (!playing && !finished) return <GameFrame title="Nature & Environment Lab"><section style={panel}>
    <div style={{fontSize:74}}>🌿</div><span style={eyebrow}>15 SYSTEMS CASES · 5 ENVIRONMENT SKILLS</span><h1 style={hero}>Nature is a web, not a pile of trivia.</h1>
    <p style={muted}>Explore habitats, resources, waste cycles, energy, climate, and practical stewardship without treating one child as responsible for fixing the whole planet.</p>
    <div style={recommendation}><span style={small}>ADAPTIVE RECOMMENDATION</span><strong>{suggested}</strong><span>{levelBlurb(suggested)}</span></div>
    <div style={row}>{LEVELS.map((item)=><button key={item} type="button" onClick={()=>setLevel(item)} style={pill(level===item)}>{item}{item===suggested?" · Suggested":""}</button>)}</div><p style={muted}>{levelBlurb(level)}</p>
    {focus&&<div style={focusCard}>Focus: <strong>{ENVIRONMENT_SKILLS[focus].label}</strong> <button type="button" onClick={()=>setFocus(null)} style={clearButton}>Use mixed cases</button></div>}
    <div style={actions}><button type="button" onClick={()=>startGame(false)} style={primary}>Start nature mission</button>{dueReviews.length>0&&<button type="button" onClick={()=>startGame(true)} style={review}>Review {dueReviews.length} due</button>}</div>
    <div style={summary}><span>🌱 {toolkit.cards.length} tools</span><span>🌎 {toolkit.missions} missions</span><span>🏆 Best {bestScore}</span></div>
  </section></GameFrame>;

  if (finished) return <GameFrame title="Nature & Environment Lab"><section style={panel}>
    <div style={{fontSize:76}}>{reviewMode?"🧠":"🌱"}</div><span style={eyebrow}>{reviewMode?"SYSTEMS REVIEW COMPLETE":"NATURE MISSION COMPLETE"}</span><h1 style={hero}>{score} points</h1>
    <p style={muted}>{reviewMode?"The exact case will return only if more evidence is needed.":`You investigated ${session.length} environmental relationships and added demonstrated tools to your toolkit.`}</p>
    {!reviewMode&&newTools.length>0&&<div style={toolGrid}>{newTools.map((tool)=><div key={tool.id} style={toolCard}><span style={{fontSize:34}}>{tool.emoji}</span><strong>{tool.label}</strong><span>NEW TOOL</span></div>)}</div>}
    <div style={actions}><button type="button" onClick={()=>startGame(reviewMode)} style={primary}>Explore another set</button><Link href="/school" style={secondary}>Return to School</Link></div>
  </section></GameFrame>;

  if (!current) return null;
  const skill = ENVIRONMENT_SKILLS[current.skill];
  return <GameFrame title="Nature & Environment Lab"><div style={{width:"min(980px,100%)",margin:"0 auto"}}><div style={stats}><span>{reviewMode?"Spaced review":`Case ${index+1} of ${session.length}`}</span><span>{current.level}</span><span>Score {score}</span></div>
    <section style={caseCard}><div style={caseHeader}><div><span style={small}>{skill.label.toUpperCase()}</span><h2 style={caseTitle}>{current.emoji} {current.title}</h2></div><div style={toolTag}>{knownToolIds.has(current.toolId)?"IN TOOLKIT":"SYSTEMS TOOL"}<br/><strong>{current.toolLabel}</strong></div></div>
    <div style={scene}><span style={small}>ENVIRONMENT CASE</span><p>{current.scene}</p></div><span style={eyebrow}>WHAT DOES THE EVIDENCE SUPPORT?</span><h1 style={question}>{current.prompt}</h1>
    <div style={answerGrid}>{current.options.map((option)=><button key={option} type="button" disabled={locked} onClick={()=>!locked&&setSelected(option)} style={answerButton(selected===option,locked&&option===current.answer)}>{option}</button>)}</div>
    <p style={{...messageStyle,color:locked?"#d9ff5b":recordedMiss?"#ffcf83":"#aab1bf"}}>{message}</p><div style={actions}>{!locked?<button type="button" disabled={!selected} onClick={checkAnswer} style={{...primary,opacity:selected?1:.45}}>Check the evidence</button>:<button type="button" onClick={advance} style={primary}>{index===session.length-1?"Finish mission":"Next case →"}</button>}</div>
    </section></div></GameFrame>;
}

const panel:React.CSSProperties={width:"min(920px,100%)",margin:"0 auto",padding:"clamp(26px,5vw,54px)",borderRadius:32,background:"#181d28",border:"1px solid rgba(255,255,255,.11)",textAlign:"center"};
const eyebrow:React.CSSProperties={color:"#8ee6a7",fontSize:11,fontWeight:950,letterSpacing:".17em"}; const small:React.CSSProperties={color:"#7fdcff",fontSize:10,fontWeight:950,letterSpacing:".14em"}; const hero:React.CSSProperties={margin:"12px 0",fontSize:"clamp(2.8rem,7vw,5.7rem)",lineHeight:.92,letterSpacing:"-.068em"}; const muted:React.CSSProperties={color:"#aab1bf",lineHeight:1.6};
const recommendation:React.CSSProperties={maxWidth:650,margin:"22px auto",display:"grid",gap:5,padding:17,borderRadius:21,background:"rgba(142,230,167,.08)",border:"1px solid rgba(142,230,167,.25)",color:"#e0ffea"}; const row:React.CSSProperties={display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}; const pill=(active:boolean):React.CSSProperties=>({padding:"11px 15px",borderRadius:999,border:`1px solid ${active?"#8ee6a7":"rgba(255,255,255,.14)"}`,background:active?"rgba(142,230,167,.12)":"#222936",color:active?"#8ee6a7":"#fff",fontWeight:900,cursor:"pointer"});
const focusCard:React.CSSProperties={maxWidth:600,margin:"18px auto 0",padding:13,borderRadius:17,background:"rgba(127,220,255,.08)",color:"#d9f5ff"}; const clearButton:React.CSSProperties={marginLeft:10,padding:"7px 10px",borderRadius:999,border:"1px solid rgba(255,255,255,.18)",background:"transparent",color:"#fff",fontWeight:850,cursor:"pointer"}; const actions:React.CSSProperties={display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",marginTop:23}; const primary:React.CSSProperties={minHeight:48,padding:"13px 20px",borderRadius:999,border:0,background:"#8ee6a7",color:"#10131b",fontSize:16,fontWeight:950,cursor:"pointer"}; const review:React.CSSProperties={...primary,background:"#c6b8ff"}; const secondary:React.CSSProperties={minHeight:48,padding:"13px 19px",borderRadius:999,border:"1px solid rgba(127,220,255,.35)",background:"rgba(127,220,255,.1)",color:"#7fdcff",fontWeight:950,textDecoration:"none",display:"inline-grid",placeItems:"center"};
const summary:React.CSSProperties={display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap",marginTop:22,color:"#aab1bf",fontSize:13,fontWeight:850}; const stats:React.CSSProperties={display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:10,padding:"10px 14px",borderRadius:17,background:"#181d28",color:"#aab1bf",fontSize:12,fontWeight:850}; const caseCard:React.CSSProperties={padding:"clamp(22px,4vw,42px)",borderRadius:30,background:"#181d28",border:"1px solid rgba(142,230,167,.18)",textAlign:"center"}; const caseHeader:React.CSSProperties={display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",textAlign:"left",flexWrap:"wrap",marginBottom:18}; const caseTitle:React.CSSProperties={margin:"6px 0 0",fontSize:"clamp(1.65rem,4vw,2.7rem)",lineHeight:1,letterSpacing:"-.045em"}; const toolTag:React.CSSProperties={padding:"10px 13px",borderRadius:16,background:"rgba(198,184,255,.1)",border:"1px solid rgba(198,184,255,.24)",color:"#dcd5ff",fontSize:10,lineHeight:1.45,letterSpacing:".08em",textAlign:"right"}; const scene:React.CSSProperties={marginBottom:20,padding:"clamp(19px,4vw,30px)",borderRadius:23,background:"#edf5e9",color:"#20291f",fontSize:"clamp(1.15rem,2.7vw,1.55rem)",lineHeight:1.65,textAlign:"left"}; const question:React.CSSProperties={margin:"12px 0 22px",fontSize:"clamp(2rem,5vw,3.8rem)",lineHeight:1,letterSpacing:"-.052em"}; const answerGrid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:11}; const answerButton=(selected:boolean,correct:boolean):React.CSSProperties=>({minHeight:92,padding:16,borderRadius:22,border:`2px solid ${correct?"#d9ff5b":selected?"#7fdcff":"rgba(255,255,255,.12)"}`,background:correct?"rgba(217,255,91,.13)":selected?"rgba(127,220,255,.12)":"#222936",color:"#fff",fontSize:16,lineHeight:1.35,fontWeight:900,cursor:"pointer"}); const messageStyle:React.CSSProperties={minHeight:26,margin:"18px 0 0",lineHeight:1.5,fontWeight:850}; const toolGrid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginTop:20}; const toolCard:React.CSSProperties={display:"grid",gap:6,padding:17,borderRadius:20,background:"rgba(142,230,167,.09)",border:"1px solid rgba(142,230,167,.24)",color:"#e0ffea",fontSize:10,letterSpacing:".08em"};
