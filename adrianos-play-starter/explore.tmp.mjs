import { chromium } from '@playwright/test';
const OUT='/tmp/claude-0/-home-user-AdrianOS/036e4a33-8353-57a3-aac1-9014b70b8d8f/scratchpad/shots';
const seed=(grade)=>{
  window.localStorage.setItem("adrianos-family-v1", JSON.stringify({activeProfileId:"qa-learner",profiles:[{id:"qa-learner",name:"Adrian",age:7,emoji:"⭐",createdAt:"2026-07-12T00:00:00.000Z"}],parentPinHash:null}));
  window.localStorage.setItem("adrianos-family-customized-v1","yes");
  window.localStorage.setItem("adrianos-learning-v1:qa-learner", JSON.stringify({reviewQueue:[{id:"profile-grade",gameSlug:"adrianos-grade-profile",skillId:"profile-grade",subject:"Learning Skills",prompt:"grade",correctAnswer:"",dueAt:"9999-12-31T23:59:59.999Z",updatedAt:"2026-07-12T00:00:00.000Z",successes:0,status:"resolved",data:{grade,profileSetting:true,elementaryScope:true}}]}));
};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const [name,vp] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  for(const grade of [0,2,5]){
    const ctx=await b.newContext({viewport:vp});
    await ctx.addInitScript(seed,grade);
    const p=await ctx.newPage();
    const errs=[];
    p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await p.goto('http://localhost:3000/',{waitUntil:'networkidle'});
    await p.waitForTimeout(1500);
    await p.screenshot({path:`${OUT}/home-${name}-g${grade}.png`,fullPage:true});
    const h=await p.evaluate(()=>document.body.scrollHeight);
    const buttons=await p.evaluate(()=>document.querySelectorAll('button,a').length);
    console.log(name,'grade',grade,'scrollHeight',h,'interactive elements',buttons,'errors',errs.length, errs.slice(0,3));
    await ctx.close();
  }
}
await b.close();
