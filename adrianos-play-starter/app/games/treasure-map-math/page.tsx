"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useEffect, useMemo, useRef, useState } from "react";

const GAME_SLUG = "treasure-map-math";
const LEVELS = [
  { q: "You found 4 gold coins, then 3 more. How many coins?", a: 7 },
  { q: "A pirate had 10 gems and gave away 4. How many remain?", a: 6 },
  { q: "There are 3 treasure chests with 2 coins each. How many coins?", a: 6 },
  { q: "You walked 5 steps north and 5 more east. How many steps total?", a: 10 },
  { q: "A map has 12 marks. You crossed off 5. How many remain?", a: 7 },
  { q: "You split 8 coins equally between 2 pirates. How many each?", a: 4 },
];

function options(answer: number) {
  const values = new Set<number>([answer]);
  while (values.size < 4) values.add(Math.max(0, answer + Math.floor(Math.random() * 7) - 3));
  return Array.from(values).sort(() => Math.random() - 0.5);
}

export default function Page() {
  const { recordPlay, award } = useAdrianProgress();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const awarded = useRef(false);
  const current = LEVELS[index];
  const choices = useMemo(() => options(current.a), [current.a]);

  useEffect(() => { recordPlay(GAME_SLUG); }, [recordPlay]);
  useEffect(() => {
    if (!done || awarded.current) return;
    awarded.current = true;
    award(GAME_SLUG, { xp: 16 + score * 4, coins: 4 + score, score, completed: true });
  }, [done, score, award]);

  function pick(value: number) {
    if (choice !== null) return;
    setChoice(value);
    if (value === current.a) setScore((value) => value + 1);
  }

  function next() {
    if (index === LEVELS.length - 1) return setDone(true);
    setIndex((value) => value + 1);
    setChoice(null);
  }

  function replay() {
    awarded.current = false;
    setIndex(0);
    setScore(0);
    setChoice(null);
    setDone(false);
    recordPlay(GAME_SLUG);
  }

  if (done) return <GameFrame title="Treasure Map Math"><section style={finish}><div style={{fontSize:64}}>🏴‍☠️</div><h1>Treasure Found</h1><p>Score: {score} out of {LEVELS.length}</p><button onClick={replay} style={home}>Play again</button></section></GameFrame>;

  return <GameFrame title="Treasure Map Math"><main style={{width:"min(820px,100%)",margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",color:"#aab1bf",fontWeight:800,marginBottom:14}}><span>Clue {index + 1} of {LEVELS.length}</span><span>Score {score}</span></div><section style={card}><div style={{fontSize:72}}>🗺️</div><small style={eyebrow}>TREASURE CLUE</small><h1 style={{fontSize:"clamp(2rem,6vw,4rem)",lineHeight:1,margin:"14px 0 28px"}}>{current.q}</h1><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>{choices.map((value) => {const good=choice!==null&&value===current.a,bad=choice===value&&value!==current.a;return <button key={value} onClick={()=>pick(value)} style={{minHeight:84,borderRadius:20,border:"1px solid rgba(255,255,255,.15)",background:good?"#d9ff5b":bad?"#ffb5bf":"#222936",color:good||bad?"#10131b":"#fff",fontSize:30,fontWeight:950}}>{value}</button>;})}</div>{choice!==null&&<div style={{marginTop:22,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><strong>{choice===current.a?"Correct. The map glows!":"Good try. The answer is "+current.a+"."}</strong><button onClick={next} style={primary}>{index===LEVELS.length-1?"See treasure":"Next clue"}</button></div>}</section></main></GameFrame>;
}

const card:React.CSSProperties={padding:"clamp(24px,5vw,50px)",borderRadius:30,background:"#181d28",border:"1px solid rgba(255,255,255,.11)",textAlign:"center"};
const eyebrow:React.CSSProperties={color:"#d9ff5b",fontWeight:950,letterSpacing:".18em"};
const primary:React.CSSProperties={padding:"12px 18px",borderRadius:999,border:0,background:"#d9ff5b",color:"#10131b",fontWeight:950};
const finish:React.CSSProperties={width:"min(700px,100%)",margin:"0 auto",padding:"clamp(30px,7vw,70px)",borderRadius:30,background:"#181d28",textAlign:"center"};
const home:React.CSSProperties={display:"inline-block",padding:"13px 20px",borderRadius:999,border:0,background:"#d9ff5b",color:"#10131b",fontWeight:950,cursor:"pointer"};
