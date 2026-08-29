import { chromium } from '@playwright/test';
const OUT='/tmp/claude-0/-home-user-AdrianOS/036e4a33-8353-57a3-aac1-9014b70b8d8f/scratchpad/shots';
const seed=(grade)=>{
  window.localStorage.setItem("adrianos-family-v1", JSON.stringify({activeProfileId:"qa-learner",profiles:[{id:"qa-learner",name:"Adrian",age:7,emoji:"⭐",createdAt:"2026-07-12T00:00:00.000Z"}],parentPinHash:null}));
  window.localStorage.setItem("adrianos-family-customized-v1","yes");
  window.localStorage.setItem("adrianos-learning-v1:qa-learner", JSON.stringify({reviewQueue:[{id:"profile-grade",gameSlug:"adrianos-grade-profile",skillId:"profile-grade",subject:"Learning Skills",prompt:"grade",correctAnswer:"",dueAt:"9999-12-31T23:59:59.999Z",updatedAt:"2026-07-12T00:00:00.000Z",successes:0,status:"resolved",data:{grade,profileSetting:true,elementaryScope:true}}]}));
};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const routes=process.argv.slice(2);
for(const r of routes){
  const ctx=await b.newContext({viewport:{width:900,height:820}});
  await ctx.addInitScript(seed,2);
  const p=await ctx.newPage();
  const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('http://localhost:3000'+r,{waitUntil:'networkidle'});
  await p.waitForTimeout(1200);
  const slug=r.replace(/\//g,'_');
  await p.screenshot({path:`${OUT}/route${slug}.png`,fullPage:true});
  const h=await p.evaluate(()=>document.body.scrollHeight);
  console.log(r,'h='+h,'errs='+errs.length,errs.slice(0,2));
  await ctx.close();
}
await b.close();
