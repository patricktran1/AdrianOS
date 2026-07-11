export type MusicLevel = "Beat Starter" | "Melody Maker" | "Music Detective";
export type MusicSkill = "beat" | "rhythm" | "pitch" | "listening" | "composition";

export type MusicMission = {
  id: string;
  level: MusicLevel;
  skill: MusicSkill;
  title: string;
  emoji: string;
  prompt: string;
  pattern: number[];
  options: string[];
  answer: string;
  hint: string;
  explanation: string;
  cardId: string;
  cardLabel: string;
};

export const MUSIC_SKILLS: Record<MusicSkill, { id: string; label: string }> = {
  beat: { id: "music-steady-beat", label: "Steady beat" },
  rhythm: { id: "music-rhythm-patterns", label: "Rhythm patterns" },
  pitch: { id: "music-pitch-direction", label: "Pitch direction" },
  listening: { id: "music-listening-form", label: "Musical listening" },
  composition: { id: "music-composition", label: "Simple composition" },
};

export const MUSIC_MISSIONS: MusicMission[] = [
  { id:"beat-1", level:"Beat Starter", skill:"beat", title:"Marching Heartbeat", emoji:"🥁", prompt:"Which choice describes the sound?", pattern:[60,60,60,60], options:["A steady beat","A beat that speeds up","No repeating beat"], answer:"A steady beat", hint:"Listen for equal spaces between every sound.", explanation:"Each sound arrives after the same amount of time, creating a steady beat.", cardId:"steady-beat-keeper", cardLabel:"Steady Beat Keeper" },
  { id:"rhythm-1", level:"Beat Starter", skill:"rhythm", title:"Clap Echo", emoji:"👏", prompt:"Which rhythm matches what you heard?", pattern:[1,1,2,1], options:["Clap clap, hold, clap","Hold, clap, clap, hold","Four long sounds"], answer:"Clap clap, hold, clap", hint:"The third sound lasts longer.", explanation:"The pattern has two short sounds, one long sound, then one short sound.", cardId:"rhythm-echo", cardLabel:"Rhythm Echo" },
  { id:"pitch-1", level:"Beat Starter", skill:"pitch", title:"Elevator Melody", emoji:"🛗", prompt:"What happens to the notes?", pattern:[60,64,67], options:["They go higher","They go lower","They stay the same"], answer:"They go higher", hint:"Imagine the melody moving upward like an elevator.", explanation:"Each note has a higher pitch than the one before it.", cardId:"pitch-arrow", cardLabel:"Pitch Arrow" },
  { id:"listen-1", level:"Beat Starter", skill:"listening", title:"Same or Different", emoji:"👂", prompt:"How are the two short phrases related?", pattern:[60,64,60,64], options:["The phrase repeats","The second phrase is lower","There is only one sound"], answer:"The phrase repeats", hint:"Compare the first two notes with the last two.", explanation:"The same two-note idea appears twice.", cardId:"repeat-listener", cardLabel:"Repeat Listener" },
  { id:"compose-1", level:"Beat Starter", skill:"composition", title:"Ending Note", emoji:"🎵", prompt:"Which final note makes the melody feel finished?", pattern:[60,64,67], options:["C","F sharp","A very high B"], answer:"C", hint:"A melody often feels settled when it returns home.", explanation:"Returning to C gives this simple melody a clear home-note ending.", cardId:"home-note", cardLabel:"Home Note Finder" },

  { id:"beat-2", level:"Melody Maker", skill:"beat", title:"Tempo Shift", emoji:"⏱️", prompt:"What changes halfway through?", pattern:[60,60,60,60,67,67,67,67], options:["The beat becomes faster","The pitch disappears","The rhythm stops"], answer:"The beat becomes faster", hint:"Compare the spacing of the first four sounds and the last four.", explanation:"The pulse continues but the second half uses shorter spaces, so the tempo increases.", cardId:"tempo-tracker", cardLabel:"Tempo Tracker" },
  { id:"rhythm-2", level:"Melody Maker", skill:"rhythm", title:"Rhythm Twins", emoji:"🪘", prompt:"Which description fits the pattern?", pattern:[1,2,1,1,2,1], options:["A three-part rhythm repeated","Six equal notes","One long note only"], answer:"A three-part rhythm repeated", hint:"Split the rhythm into two groups of three.", explanation:"Short-long-short appears twice, making a repeated rhythm cell.", cardId:"rhythm-cell", cardLabel:"Rhythm Cell Builder" },
  { id:"pitch-2", level:"Melody Maker", skill:"pitch", title:"Mountain Shape", emoji:"⛰️", prompt:"What shape does the melody make?", pattern:[60,64,67,64,60], options:["Up then down","Down then up","Only upward"], answer:"Up then down", hint:"Listen for the highest note in the middle.", explanation:"The melody climbs to a peak and then returns downward.", cardId:"melody-shape", cardLabel:"Melody Shape Mapper" },
  { id:"listen-2", level:"Melody Maker", skill:"listening", title:"Question and Answer", emoji:"💬", prompt:"How does the second phrase relate to the first?", pattern:[60,62,67,67,65,60], options:["It answers and settles","It copies exactly","It becomes silence"], answer:"It answers and settles", hint:"Notice whether the final note feels more finished.", explanation:"The first phrase feels open; the second moves back toward the home note and sounds settled.", cardId:"phrase-listener", cardLabel:"Phrase Listener" },
  { id:"compose-2", level:"Melody Maker", skill:"composition", title:"Build a Motif", emoji:"🧱", prompt:"Which idea is easiest to develop into a melody?", pattern:[60,62,64], options:["A short memorable pattern","Ten random notes at once","Only silence"], answer:"A short memorable pattern", hint:"Composers often begin with a small musical seed.", explanation:"A short motif can be repeated, changed, and combined to build a longer piece.", cardId:"motif-maker", cardLabel:"Motif Maker" },

  { id:"beat-3", level:"Music Detective", skill:"beat", title:"Hidden Pulse", emoji:"🕵️", prompt:"What helps a listener keep time through the pauses?", pattern:[60,0,60,0,60,60,0,60], options:["An imagined steady pulse","Changing the key","Ignoring the spacing"], answer:"An imagined steady pulse", hint:"The beat can continue even when no note sounds.", explanation:"Musicians maintain an internal pulse through rests and syncopated patterns.", cardId:"inner-pulse", cardLabel:"Inner Pulse Keeper" },
  { id:"rhythm-3", level:"Music Detective", skill:"rhythm", title:"Syncopation Clue", emoji:"⚡", prompt:"Why does the rhythm feel surprising?", pattern:[0,1,0,1,1,0,1,0], options:["Some sounds fall between strong beats","Every sound is on the same beat","The notes have no duration"], answer:"Some sounds fall between strong beats", hint:"Listen for sounds that arrive where you might expect a gap.", explanation:"Syncopation emphasizes off-beats or unexpected parts of the pulse.", cardId:"syncopation-spotter", cardLabel:"Syncopation Spotter" },
  { id:"pitch-3", level:"Music Detective", skill:"pitch", title:"Interval Distance", emoji:"📐", prompt:"Which pair sounds farther apart?", pattern:[60,62,60,72], options:["The second pair","The first pair","They are equal"], answer:"The second pair", hint:"Compare C to D with C to the higher C.", explanation:"C to the next C spans an octave, much farther than the step from C to D.", cardId:"interval-ear", cardLabel:"Interval Ear" },
  { id:"listen-3", level:"Music Detective", skill:"listening", title:"A B A Form", emoji:"🧩", prompt:"Which form matches the three phrases?", pattern:[60,64,67,65,62,60,64,67], options:["A-B-A","A-A-A","A-B-C"], answer:"A-B-A", hint:"The ending returns to the same notes as the opening.", explanation:"The first musical idea returns after a contrasting middle, creating A-B-A form.", cardId:"form-detector", cardLabel:"Form Detector" },
  { id:"compose-3", level:"Music Detective", skill:"composition", title:"Variation Workshop", emoji:"🎼", prompt:"Which change creates a variation while keeping the idea recognizable?", pattern:[60,62,64,62], options:["Keep the contour but change the rhythm","Replace every note with unrelated noise","Delete the entire motif"], answer:"Keep the contour but change the rhythm", hint:"A variation changes part of an idea while preserving something listeners can recognize.", explanation:"Keeping the melodic contour while changing rhythm creates contrast and connection.", cardId:"variation-designer", cardLabel:"Variation Designer" },
];

export function musicMissionById(id: string): MusicMission | null {
  return MUSIC_MISSIONS.find((mission) => mission.id === id) ?? null;
}
