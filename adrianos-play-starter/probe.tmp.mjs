import { chromium } from '@playwright/test';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1440,height:1000}});
await ctx.addInitScript(()=>{
  window.localStorage.clear(); window.sessionStorage.clear();
  window.localStorage.setItem("adrianos-family-v1", JSON.stringify({activeProfileId:"qa-learner",profiles:[{id:"qa-learner",name:"QA Learner",age:7,emoji:"⭐",createdAt:"2026-07-12T00:00:00.000Z"}],parentPinHash:null}));
  window.localStorage.setItem("adrianos-family-customized-v1","yes");
});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
await p.goto('http://localhost:3000/games/civic-lab',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
console.log('ready=',await p.getAttribute('[data-game-power-loop="active"]','data-power-ready'));
console.log(errs.slice(0,6));
await b.close();
