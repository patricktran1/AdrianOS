import { chromium } from '@playwright/test';
const OUT='/tmp/claude-0/-home-user-AdrianOS/036e4a33-8353-57a3-aac1-9014b70b8d8f/scratchpad/shots';
const seed=({grade,age,clears})=>{
  window.localStorage.setItem("adrianos-family-v1", JSON.stringify({activeProfileId:"qa-learner",profiles:[{id:"qa-learner",name:"Adrian",age,emoji:"⭐",createdAt:"2026-07-12T00:00:00.000Z"}],parentPinHash:null}));
  window.localStorage.setItem("adrianos-family-customized-v1","yes");
  window.localStorage.setItem("adrianos-learning-v1:qa-learner", JSON.stringify({reviewQueue:[{id:"profile-grade",gameSlug:"adrianos-grade-profile",skillId:"profile-grade",subject:"Learning Skills",prompt:"grade",correctAnswer:"",dueAt:"9999-12-31T23:59:59.999Z",updatedAt:"2026-07-12T00:00:00.000Z",successes:0,status:"resolved",data:{grade,profileSetting:true,elementaryScope:true}}]}));
  if(clears){
    const games={};
    const slugs=["number-quest","memory-match","math-blast","science-quest","reading-lab","pattern-master","story-expedition","dinosaur-detective"];
    for(let i=0;i<clears;i++){const s=slugs[i%slugs.length];games[s]={plays:(games[s]?.plays??0)+2,completions:(games[s]?.completions??0)+1,bestScore:80,lastPlayed:new Date().toISOString(),lastCompleted:new Date().toISOString()};}
    window.localStorage.setItem("adrianos-progress-v2:qa-learner", JSON.stringify({xp:clears*60,coins:clears*12,level:Math.floor(clears*60/200)+1,games,activity:[]}));
  }
};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const cases=JSON.parse(process.argv[2]);
for(const c of cases){
  const ctx=await b.newContext({viewport:c.vp, reducedMotion: c.reduced?'reduce':'no-preference'});
  await ctx.addInitScript(seed,{grade:c.grade??2,age:c.age??7,clears:c.clears??0});
  if(c.hour!==undefined){
    await ctx.addInitScript((h)=>{
      const RealDate=Date;
      const base=new RealDate(); base.setHours(h,30,0,0);
      const fixed=base.getTime();
      class D extends RealDate{constructor(...a){if(a.length===0)super(fixed);else super(...a);} static now(){return fixed;}}
      window.Date=D;
    }, c.hour);
  }
  const p=await ctx.newPage();
  const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('http://localhost:3000'+(c.route??'/'),{waitUntil:'networkidle'});
  await p.waitForTimeout(1200);
  if(c.click) { for(const sel of [].concat(c.click)) { await p.click(sel); await p.waitForTimeout(500);} }
  await p.screenshot({path:`${OUT}/${c.name}.png`});
  const scrollable=await p.evaluate(()=>document.documentElement.scrollHeight>window.innerHeight+2);
  const count=await p.evaluate(()=>document.querySelectorAll('button,a').length);
  console.log(c.name,'scrollable='+scrollable,'controls='+count,'errs='+errs.length,errs.slice(0,2));
  await ctx.close();
}
await b.close();
