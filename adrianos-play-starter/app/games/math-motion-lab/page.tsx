"use client";

import GameFrame from "@/components/GameFrame";
import { recordLearningAttempt } from "@/lib/adrian-learning";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { useFamilyProfiles } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { useGameSession } from "@/lib/game-session";
import { useEffect, useState } from "react";

const SLUG = "math-motion-lab";
type Mission = { prompt:string; start:number; target:number; min:number; max:number; step:number; clue:string; explanation:string; standard:string; skillId:string };
type World = { title:string; emoji:string; accent:string; intro:string; missions:Mission[] };

const WORLDS: Record<ElementaryGrade, World> = {
  [-1]: { title:"Critter Hop Path", emoji:"🐸🌼", accent:"#ffd45c", intro:"Hop a frog to the right counting spot.", missions:[
    {prompt:"Hop to 3.",start:0,target:3,min:0,max:5,step:1,clue:"Count one flower each hop.",explanation:"Three hops land on 3.",standard:"TK.CC.1",skillId:"math-counting"},
    {prompt:"Start at 1. Hop to 4.",start:1,target:4,min:0,max:5,step:1,clue:"Say 2, 3, 4 as you hop.",explanation:"Three forward hops reach 4.",standard:"TK.CC.2",skillId:"math-counting"},
    {prompt:"Hop back to 2.",start:5,target:2,min:0,max:5,step:1,clue:"Move left and count backward.",explanation:"5, 4, 3, 2 lands on 2.",standard:"TK.CC.3",skillId:"math-counting"},
  ]},
  0: { title:"Rainbow Number Road", emoji:"🌈🛴", accent:"#ff9bd2", intro:"Ride a scooter along a bright number road.", missions:[
    {prompt:"Show 4 + 3.",start:4,target:7,min:0,max:10,step:1,clue:"Move forward three spaces.",explanation:"4 + 3 = 7.",standard:"K.OA.A.1",skillId:"math-addition"},
    {prompt:"Show 8 − 2.",start:8,target:6,min:0,max:10,step:1,clue:"Move left two spaces.",explanation:"8 − 2 = 6.",standard:"K.OA.A.1",skillId:"math-subtraction"},
    {prompt:"Find the number after 6.",start:6,target:7,min:0,max:10,step:1,clue:"Take one step forward.",explanation:"The number after 6 is 7.",standard:"K.CC.A.2",skillId:"math-counting"},
  ]},
  1: { title:"Robot Rail Runner", emoji:"🤖🚝", accent:"#8dd7ff", intro:"Program a robot train with efficient jumps.", missions:[
    {prompt:"Solve 8 + 7.",start:8,target:15,min:0,max:20,step:1,clue:"Jump 2 to make 10, then 5 more.",explanation:"8 + 7 = 15.",standard:"1.OA.C.6",skillId:"math-addition"},
    {prompt:"Solve 17 − 9.",start:17,target:8,min:0,max:20,step:1,clue:"Jump back 7 to 10, then 2 more.",explanation:"17 − 9 = 8.",standard:"1.OA.C.6",skillId:"math-subtraction"},
    {prompt:"Count by 2s to 12.",start:4,target:12,min:0,max:20,step:2,clue:"Use four jumps of 2.",explanation:"4, 6, 8, 10, 12.",standard:"1.NBT.A.1",skillId:"math-place-value"},
  ]},
  2: { title:"Dino Canyon Dash", emoji:"🦖🛹", accent:"#d9ff5b", intro:"Skate a dinosaur across canyon checkpoints.", missions:[
    {prompt:"Solve 27 + 18.",start:27,target:45,min:20,max:50,step:1,clue:"Jump 3 to 30, then 15 more.",explanation:"27 + 18 = 45.",standard:"2.NBT.B.5",skillId:"math-word-problems"},
    {prompt:"Solve 52 − 17.",start:52,target:35,min:30,max:60,step:1,clue:"Jump back 2 to 50, then 15 more.",explanation:"52 − 17 = 35.",standard:"2.NBT.B.5",skillId:"math-subtraction"},
    {prompt:"Count by 5s to 50.",start:25,target:50,min:20,max:55,step:5,clue:"Use five jumps of 5.",explanation:"25, 30, 35, 40, 45, 50.",standard:"2.NBT.A.2",skillId:"math-place-value"},
  ]},
  3: { title:"Orbit Jump Grid", emoji:"🛰️🪐", accent:"#c6b8ff", intro:"Pilot a satellite with multiplication and division jumps.", missions:[
    {prompt:"Model 6 × 4.",start:0,target:24,min:0,max:30,step:4,clue:"Make six equal jumps of 4.",explanation:"Six jumps of 4 land on 24.",standard:"3.OA.A.1",skillId:"math-multiplication"},
    {prompt:"Model 28 ÷ 7.",start:0,target:28,min:0,max:35,step:7,clue:"Count jumps of 7 to 28.",explanation:"Four jumps show 28 ÷ 7 = 4.",standard:"3.OA.A.2",skillId:"math-division"},
    {prompt:"Solve 36 + 27.",start:36,target:63,min:30,max:70,step:1,clue:"Jump 4 to 40, then 23 more.",explanation:"36 + 27 = 63.",standard:"3.NBT.A.2",skillId:"math-word-problems"},
  ]},
  4: { title:"Temple Fraction Trail", emoji:"🏛️🧭", accent:"#ffcb66", intro:"Unlock doors by moving across fractions.", missions:[
    {prompt:"Move to 3/4.",start:0,target:.75,min:0,max:1,step:.25,clue:"Take three one-fourth jumps.",explanation:"1/4 + 1/4 + 1/4 = 3/4.",standard:"4.NF.B.3",skillId:"math-fractions"},
    {prompt:"Show 2/4 = 1/2.",start:0,target:.5,min:0,max:1,step:.25,clue:"Take two one-fourth jumps.",explanation:"2/4 and 1/2 share a point.",standard:"4.NF.A.1",skillId:"math-fractions"},
    {prompt:"Move from 1 to 1 1/2.",start:1,target:1.5,min:0,max:2,step:.25,clue:"Two quarter jumps equal one half.",explanation:"1 + 1/2 = 1 1/2.",standard:"4.NF.B.3",skillId:"math-fractions"},
  ]},
  5: { title:"Cyber Decimal Rail", emoji:"🌐⚡", accent:"#77f1d0", intro:"Route a data runner through decimals and fractions.", missions:[
    {prompt:"Move from 0.4 to 0.72.",start:.4,target:.72,min:.4,max:.8,step:.01,clue:"Move forward 32 hundredths.",explanation:"0.40 + 0.32 = 0.72.",standard:"5.NBT.B.7",skillId:"math-decimals"},
    {prompt:"Solve 1/2 + 1/4.",start:.5,target:.75,min:0,max:1,step:.25,clue:"One quarter more than one half is three fourths.",explanation:"1/2 + 1/4 = 3/4.",standard:"5.NF.A.1",skillId:"math-fractions"},
    {prompt:"Move from 1.25 to 1.8.",start:1.25,target:1.8,min:1.2,max:1.9,step:.05,clue:"Move eleven jumps of five hundredths.",explanation:"1.25 + 0.55 = 1.80.",standard:"5.NBT.B.7",skillId:"math-decimals"},
  ]},
};

const round=(n:number)=>Math.round(n*100)/100;
const label=(n:number,g:ElementaryGrade)=> g===4&&n===.25?"1/4":g===4&&n===.5?"1/2":g>=4&&n===.75?"3/4":g===4&&n===1.5?"1 1/2":String(round(n));
function ping(ok:boolean){ if(typeof window==="undefined"||!("AudioContext" in window)) return; const c=new AudioContext(),o=c.createOscillator(),v=c.createGain();o.connect(v);v.connect(c.destination);o.frequency.value=ok?760:180;v.gain.value=.04;o.start();v.gain.exponentialRampToValueAtTime(.001,c.currentTime+.16);o.stop(c.currentTime+.17);o.onended=()=>void c.close(); }

export default function MathMotionLab(){
  const {activeProfile,hydrated}=useFamilyProfiles(); const {completeGame,restartGame}=useGameSession(SLUG);
  const [grade,setGrade]=useState<ElementaryGrade|null>(null),[started,setStarted]=useState(false),[done,setDone]=useState(false),[index,setIndex]=useState(0),[position,setPosition]=useState(0),[misses,setMisses]=useState(0),[combo,setCombo]=useState(0),[best,setBest]=useState(0),[stars,setStars]=useState(0),[locked,setLocked]=useState(false),[message,setMessage]=useState("Move the hero, then lock in your answer.");
  useEffect(()=>{if(hydrated){const g=readProfileGrade(activeProfile);setGrade(g);setPosition(WORLDS[g].missions[0].start)}},[activeProfile,hydrated]);
  if(grade===null) return <GameFrame title="Math Motion Lab"><main style={load}>Calibrating the track…</main></GameFrame>;
  const world=WORLDS[grade], mission=world.missions[index], pct=((position-mission.min)/(mission.max-mission.min))*100;
  const move=(dir:-1|1,m=1)=>!locked&&setPosition(round(Math.min(mission.max,Math.max(mission.min,position+mission.step*m*dir))));
  const check=()=>{if(locked)return;const ok=Math.abs(position-mission.target)<.001;recordLearningAttempt({gameSlug:SLUG,subject:"Math",skillId:mission.skillId,skillLabel:"Number-line reasoning",prompt:mission.prompt,correctAnswer:label(mission.target,grade),correct:ok,data:{grade,standardCode:mission.standard,supportUsed:misses>0}},activeProfile.id);ping(ok);if(!ok){const n=misses+1;setMisses(n);setCombo(0);setMessage(n===1?`Coach clue: ${mission.clue}`:`Target beacon: ${label(mission.target,grade)}. ${mission.explanation}`);return}const c=misses===0?combo+1:0;setCombo(c);setBest(Math.max(best,c));setStars(stars+(misses===0?3:1));setLocked(true);setMessage(`${misses===0?"Perfect landing":"Route repaired"}! ${mission.explanation}`)};
  const next=()=>{if(index===2){completeGame({xp:34+stars*4+best*3,coins:8+stars,score:stars*150+best*60});setDone(true);return}const i=index+1;setIndex(i);setPosition(world.missions[i].start);setMisses(0);setLocked(false);setMessage("New route loaded.")};
  const replay=()=>{restartGame();setDone(false);setStarted(true);setIndex(0);setPosition(world.missions[0].start);setMisses(0);setCombo(0);setBest(0);setStars(0);setLocked(false)};
  if(!started) return <GameFrame title={world.title}><main style={{...page,background:`radial-gradient(circle at top,${world.accent}35,#10131b 60%)`}}><section style={hero}><div className="motion-float" style={big}>{world.emoji}</div><span style={{...eyebrow,color:world.accent}}>HANDS-ON NUMBER LINE</span><h1 style={title}>{world.title}</h1><p>{world.intro} This is movement math, not multiple choice.</p><button style={{...primary,background:world.accent}} onClick={()=>setStarted(true)}>Start moving →</button><style>{css}</style></section></main></GameFrame>;
  if(done) return <GameFrame title={world.title}><main style={page}><section style={hero}><div style={big}>🏆{world.emoji}</div><h1 style={title}>{activeProfile.name} cleared every route!</h1><p>⭐ {stars} stars · 🔥 {best}× best combo</p><button style={{...primary,background:world.accent}} onClick={replay}>Run new routes →</button></section></main></GameFrame>;
  return <GameFrame title={world.title}><main style={page}><header style={hud}><strong>{world.emoji} Route {index+1}/3</strong><span>⭐ {stars} · 🔥 {combo}×</span></header><section style={card}><span style={{...eyebrow,color:world.accent}}>{mission.standard}</span><h1 style={question}>{mission.prompt}</h1><p>Current position: <strong>{label(position,grade)}</strong></p><div aria-label={`Number line from ${label(mission.min,grade)} to ${label(mission.max,grade)}`} style={track}><span className="motion-runner" style={{left:`${Math.max(0,Math.min(100,pct))}%`}}>{world.emoji.split("")[0]}</span></div><div style={controls}><button onClick={()=>move(-1,5)} disabled={locked}>⏪ 5 jumps</button><button onClick={()=>move(-1)} disabled={locked}>← Back</button><button onClick={()=>move(1)} disabled={locked}>Forward →</button><button onClick={()=>move(1,5)} disabled={locked}>5 jumps ⏩</button></div><button onClick={check} disabled={locked} style={{...primary,background:world.accent}}>Lock in {label(position,grade)}</button><section role="status" style={coach}><strong>{misses?"ADAPTIVE COACH":"MOTION COACH"}</strong><p>{message}</p>{locked&&<button onClick={next} style={{...primary,background:world.accent}}>{index===2?"Open the motion vault →":"Next route →"}</button>}</section><style>{css}</style></section></main></GameFrame>;
}

const css=`@keyframes mf{50%{transform:translateY(-9px)}}@keyframes mr{50%{transform:translate(-50%,-58%) rotate(2deg)}}.motion-float{animation:mf 2s ease-in-out infinite}.motion-runner{position:absolute;top:50%;transform:translate(-50%,-50%);font-size:46px;transition:left .25s;animation:mr .7s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.motion-float,.motion-runner{animation:none}}`;
const load:React.CSSProperties={minHeight:500,display:"grid",placeItems:"center",background:"#10131b",color:"#fff"};const page:React.CSSProperties={minHeight:"100vh",padding:"20px 14px 80px",color:"#fff",background:"#10131b"};const hero:React.CSSProperties={maxWidth:920,margin:"0 auto",padding:"clamp(28px,7vw,64px)",borderRadius:34,textAlign:"center",background:"#181e2a"};const big:React.CSSProperties={fontSize:"clamp(5rem,16vw,9rem)"};const eyebrow:React.CSSProperties={fontSize:11,fontWeight:950,letterSpacing:".15em"};const title:React.CSSProperties={fontSize:"clamp(3rem,8vw,6rem)",lineHeight:.9};const primary:React.CSSProperties={minHeight:58,padding:"14px 22px",border:0,borderRadius:999,fontWeight:950};const hud:React.CSSProperties={maxWidth:920,margin:"0 auto 12px",display:"flex",justifyContent:"space-between",padding:14,borderRadius:20,background:"#181e2a",fontWeight:900};const card:React.CSSProperties={maxWidth:920,margin:"0 auto",padding:"clamp(22px,5vw,42px)",borderRadius:30,background:"#181e2a",textAlign:"center"};const question:React.CSSProperties={fontSize:"clamp(2rem,6vw,4rem)"};const track:React.CSSProperties={position:"relative",height:16,margin:"48px 8px",borderRadius:999,background:"linear-gradient(90deg,#334155,#64748b)"};const controls:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:18};const coach:React.CSSProperties={marginTop:18,padding:18,borderRadius:20,background:"#10131b"};
