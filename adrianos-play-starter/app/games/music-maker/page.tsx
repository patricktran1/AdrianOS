"use client";

import GameFrame from "@/components/GameFrame";
import { useAdrianProgress } from "@/lib/adrian-progress";
import { useEffect, useRef, useState } from "react";

const GAME_SLUG = "music-maker";
const NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const TONES: Record<string, number> = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392, A: 440, B: 493.88 };
const MELODIES = [
  { label: "C E G", notes: ["C", "E", "G"] },
  { label: "G E C", notes: ["G", "E", "C"] },
  { label: "C D E F", notes: ["C", "D", "E", "F"] },
  { label: "E E F G", notes: ["E", "E", "F", "G"] },
  { label: "G F E D C", notes: ["G", "F", "E", "D", "C"] },
];

function playTone(note: string) {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = TONES[note];
  oscillator.type = "sine";
  oscillator.connect(gain);
  gain.connect(context.destination);
  gain.gain.setValueAtTime(.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .45);
  oscillator.start();
  oscillator.stop(context.currentTime + .45);
}

export default function Page() {
  const { recordPlay, award } = useAdrianProgress();
  const [index, setIndex] = useState(0);
  const [made, setMade] = useState<string[]>([]);
  const [message, setMessage] = useState("Copy the melody.");
  const [done, setDone] = useState(false);
  const awarded = useRef(false);
  const current = MELODIES[index];

  useEffect(() => { recordPlay(GAME_SLUG); }, [recordPlay]);
  useEffect(() => {
    if (!done || awarded.current) return;
    awarded.current = true;
    award(GAME_SLUG, { xp: 35, coins: 10, score: MELODIES.length, completed: true });
  }, [done, award]);

  function add(note: string) {
    playTone(note);
    setMade((notes) => [...notes, note]);
  }

  function check() {
    const correct = made.length === current.notes.length && made.every((note, noteIndex) => note === current.notes[noteIndex]);
    if (!correct) {
      setMessage("Not quite. Reset and try again.");
      return;
    }
    if (index === MELODIES.length - 1) {
      setDone(true);
      return;
    }
    setMessage("Great melody!");
    window.setTimeout(() => {
      setIndex((value) => value + 1);
      setMade([]);
      setMessage("Copy the melody.");
    }, 600);
  }

  function replay() {
    awarded.current = false;
    setIndex(0);
    setMade([]);
    setMessage("Copy the melody.");
    setDone(false);
    recordPlay(GAME_SLUG);
  }

  if (done) return <GameFrame title="Music Maker"><section style={finish}><div style={{fontSize:64}}>🎵</div><h1>Music Maker Complete</h1><p>You copied every melody.</p><button onClick={replay} style={home}>Play again</button></section></GameFrame>;

  return <GameFrame title="Music Maker"><main style={{width:"min(820px,100%)",margin:"0 auto"}}><section style={card}><small style={eyebrow}>MELODY {index + 1} OF {MELODIES.length}</small><h1 style={{fontSize:"clamp(2.2rem,6vw,4rem)",margin:"14px 0"}}>Copy: {current.label}</h1><div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:10,margin:"22px 0"}}>{NOTES.map((note,noteIndex)=><button key={note} onClick={()=>add(note)} style={{width:64,height:64,borderRadius:18,border:"1px solid rgba(255,255,255,.15)",background:["#d9ff5b","#c6b8ff","#e392ff","#8fe3cf","#ffcf70","#8ec5ff","#ff9b85"][noteIndex],color:"#10131b",fontSize:24,fontWeight:950}}>{note}</button>)}</div><div style={{minHeight:60,padding:14,borderRadius:18,background:"#222936",display:"flex",justifyContent:"center",alignItems:"center",gap:8,flexWrap:"wrap"}}>{made.length?made.map((note,noteIndex)=><span key={`${note}-${noteIndex}`} style={{padding:"8px 11px",borderRadius:999,background:"#fff",color:"#10131b",fontWeight:900}}>{note}</span>):<span style={{color:"#7f8898"}}>Your notes appear here</span>}</div><div style={{display:"flex",justifyContent:"center",gap:10,marginTop:22,flexWrap:"wrap"}}><button onClick={()=>setMade((notes)=>notes.slice(0,-1))} style={secondary}>Undo</button><button onClick={()=>{setMade([]);setMessage("Copy the melody.");}} style={secondary}>Reset</button><button onClick={check} style={primary}>Check</button></div><p style={{color:"#c6b8ff",fontWeight:850}}>{message}</p></section></main></GameFrame>;
}

const card:React.CSSProperties={padding:"clamp(24px,5vw,50px)",borderRadius:30,background:"#181d28",border:"1px solid rgba(255,255,255,.11)",textAlign:"center"};
const eyebrow:React.CSSProperties={color:"#d9ff5b",fontWeight:950,letterSpacing:".18em"};
const secondary:React.CSSProperties={minWidth:110,padding:"12px 18px",borderRadius:999,border:"2px solid #fff",background:"#fff",color:"#10131b",fontWeight:950};
const primary:React.CSSProperties={...secondary,background:"#d9ff5b",border:"2px solid #d9ff5b"};
const finish:React.CSSProperties={width:"min(700px,100%)",margin:"0 auto",padding:"clamp(30px,7vw,70px)",borderRadius:30,background:"#181d28",textAlign:"center"};
const home:React.CSSProperties={display:"inline-block",padding:"13px 20px",borderRadius:999,border:0,background:"#d9ff5b",color:"#10131b",fontWeight:950,cursor:"pointer"};
