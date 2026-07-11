"use client";
import { useMemo, useState } from "react";
import GameFrame from "@/components/GameFrame";

function makeProblem(level:number){
  const max=Math.min(10+level*4,50); const sub=Math.random()>.55;
  if(sub){const a=Math.floor(Math.random()*max)+1; const b=Math.floor(Math.random()*(a+1)); return {a,b,op:"−",answer:a-b};}
  const a=Math.floor(Math.random()*max); const b=Math.floor(Math.random()*max); return {a,b,op:"+",answer:a+b};
}
function choices(answer:number){const s=new Set<number>([answer]); while(s.size<4){const d=Math.floor(Math.random()*9)-4; s.add(Math.max(0,answer+(d===0?5:d)));} return Array.from(s).sort(()=>Math.random()-.5);}

export default function MathBlastPage(){
  const [level,setLevel]=useState(1),[score,setScore]=useState(0),[streak,setStreak]=useState(0),[locked,setLocked]=useState(false);
  const [problem,setProblem]=useState(()=>makeProblem(1)); const [message,setMessage]=useState("Choose the correct answer.");
  const options=useMemo(()=>choices(problem.answer),[problem]);
  function pick(v:number){if(locked)return; setLocked(true); if(v===problem.answer){const ns=streak+1,nl=ns%5===0?level+1:level; setScore(score+10+level*2);setStreak(ns);setLevel(nl);setMessage(nl>level?"Correct. Level up!":"Correct!");setTimeout(()=>{setProblem(makeProblem(nl));setMessage("Choose the correct answer.");setLocked(false);},600);}else{setStreak(0);setMessage(`Not quite. The answer was ${problem.answer}.`);setTimeout(()=>{setProblem(makeProblem(level));setMessage("Choose the correct answer.");setLocked(false);},900);}}
  return <GameFrame title="Math Blast"><main style={{width:"min(760px,100%)",margin:"0 auto"}}>
    <section style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>{[["Level",level],["Score",score],["Streak",streak]].map(([l,v])=><div key={String(l)} style={{padding:14,border:"1px solid rgba(255,255,255,.11)",borderRadius:17,background:"#181d28",textAlign:"center"}}><small>{l}</small><strong style={{display:"block",fontSize:26}}>{v}</strong></div>)}</section>
    <section style={{padding:"clamp(26px,6vw,58px)",border:"1px solid rgba(255,255,255,.11)",borderRadius:30,background:"#181d28",textAlign:"center"}}><small style={{color:"#d9ff5b",fontWeight:900,letterSpacing:2}}>MATH MISSION</small><h1 style={{fontSize:"clamp(4rem,15vw,8rem)",margin:"20px 0 30px",lineHeight:.9}}>{problem.a} {problem.op} {problem.b}</h1><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{options.map(v=><button key={v} disabled={locked} onClick={()=>pick(v)} style={{minHeight:88,border:"1px solid rgba(255,255,255,.11)",borderRadius:21,color:"white",background:"#222936",fontSize:"clamp(1.8rem,5vw,3rem)",fontWeight:900}}>{v}</button>)}</div><p style={{minHeight:28,color:"#c6b8ff",fontWeight:800}}>{message}</p></section>
  </main></GameFrame>;
}
