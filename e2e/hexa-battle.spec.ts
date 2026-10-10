// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type Locator} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
const key='playgarden.hexa-battle.v1';
async function snapshot(page:Page):Promise<any>{return page.evaluate(()=>(window as unknown as {__hbRead:()=>unknown}).__hbRead());}
async function act(locator:Locator,mobile:boolean){if(mobile)await locator.tap();else await locator.click();}
async function idle(page:Page){await expect.poll(async()=>(await snapshot(page)).busy).toBe(false);}
async function cell(page:Page,q:number,r:number,mobile:boolean){await act(page.locator(`[data-hex="${q},${r}"]`),mobile);await idle(page);}
async function loadCheckpoint(page:Page,data:unknown,mobile:boolean){await act(page.getByRole('button',{name:'存档与导入',exact:true}),mobile);await page.getByLabel('远征存档内容').fill(typeof data==='string'?data:JSON.stringify(data));await act(page.getByRole('button',{name:'导入存档',exact:true}),mobile);await idle(page);}
const distance=(a:any,b:any)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
// Decisions are computed from the read-only board view. Every move and skill
// is performed with the same native mouse/touch controls as a player.
async function fightFirstBattle(page:Page,mobile:boolean){
 for(let turn=0;turn<35;turn++){
  let s=await snapshot(page);if(s.result)return s;
  const allies=s.units.filter((u:any)=>u.side===s.player);
  for(const initial of allies){
   for(let attempt=0;attempt<3;attempt++){
    s=await snapshot(page);if(s.result)return s;const u=s.units.find((u:any)=>u.id===initial.id);if(!u||u.acted)break;
    const enemies=s.units.filter((u:any)=>u.side!==s.player);const choices:any[]=[];
    for(const a of u.actions.filter((a:any)=>a.available))for(const target of a.targets){let score=0;for(const effect of target.result.targets){const victim=s.units.find((v:any)=>v.id===effect.unitId);if(!victim)continue;score+=(victim.side===s.player?-2:1)*Math.max(0,effect.damage||0);}if(score>0)choices.push({a,target,score});}
    choices.sort((a,b)=>b.score-a.score);
    await cell(page,u.q,u.r,mobile);
    if(choices.length){const c=choices[0];await act(page.locator(`[data-action="${c.a.i}"]`),mobile);await cell(page,c.target.q,c.target.r,mobile);break;}
    const nearest=(p:any)=>Math.min(...enemies.map((e:any)=>distance(p,e)));
    const moves=u.moves.map(([q,r]:number[])=>({q,r})).sort((a:any,b:any)=>nearest(a)-nearest(b));
    if(moves.length&&nearest(moves[0])<nearest(u)){await cell(page,moves[0].q,moves[0].r,mobile);continue;}
    break;
   }
  }
  s=await snapshot(page);if(s.result)return s;await act(page.getByRole('button',{name:'结束回合',exact:true}),mobile);await idle(page);
 }
 throw Error('Native first-battle strategy did not finish within35 turns');
}
const campaign={depth:5,money:16,party:['warrior','cleric','mage','horseman'],wins:5};
const unit=(type:string,side:number,q:number,r:number,hp:number,mp:number,mana=0)=>({type,side,q,r,hp,mp,mana,acted:false,status:[]});

test('complete tactical rules: earned battle, recruit, skills, defeat, pause and isolated saves',async({page},info)=>{
 test.setTimeout(360000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 await page.addInitScript(()=>{let seed=1572026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await openGame(page,'六角远征');await expect(page.locator('[data-hb-ready]')).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('playgarden.hb-unrelated','keep'));
 expect((await snapshot(page)).campaign).toEqual({depth:0,money:0,party:['archer','warrior','warrior','warrior'],wins:0});
 await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
 await act(page.getByRole('button',{name:'开始战斗',exact:true}),mobile);let s=await snapshot(page);expect(s.units.length).toBeGreaterThanOrEqual(5);expect(s.units.length).toBeLessThanOrEqual(6);
 const enemy=s.units.find((u:any)=>u.side!==s.player),before=s.units.filter((u:any)=>u.side===s.player).map((u:any)=>[u.q,u.r]);
 await cell(page,enemy.q,enemy.r,mobile);expect((await snapshot(page)).units.filter((u:any)=>u.side===s.player).map((u:any)=>[u.q,u.r])).toEqual(before);
 await page.screenshot({path:info.outputPath('hb-first-real-battle.png'),fullPage:true});
 s=await fightFirstBattle(page,mobile);expect(s.result).toBe('win');
 await page.screenshot({path:info.outputPath('hb-earned-battle-victory.png'),fullPage:true});
 await act(page.getByRole('button',{name:'返回营地',exact:true}),mobile);s=await snapshot(page);expect(s.campaign.depth).toBe(1);expect(s.campaign.money).toBe(2);expect(s.campaign.wins).toBe(1);expect(s.campaign.party.length).toBeLessThanOrEqual(4);
 const earned=s.campaign;await page.reload();await openGame(page,'六角远征');await expect(page.locator('[data-hb-ready]')).toBeVisible();expect((await snapshot(page)).campaign).toEqual(earned);
 // An explicit later-depth camp fixture checks the original recruitment prices.
 await loadCheckpoint(page,{version:1,campaign,battle:null},mobile);await act(page.getByRole('button',{name:'招募队员',exact:true}),mobile);
 const knight=page.locator('.hb-shop button').filter({has:page.locator('b').filter({hasText:/^骑士$/})});await act(knight,mobile);await expect(page.getByRole('button',{name:'确认招募',exact:true})).toBeEnabled();
 await act(page.getByRole('button',{name:'取消',exact:true}),mobile);expect((await snapshot(page)).campaign.money).toBe(16);
 await act(page.getByRole('button',{name:'招募队员',exact:true}),mobile);await act(knight,mobile);await act(page.getByRole('button',{name:'确认招募',exact:true}),mobile);expect((await snapshot(page)).campaign.money).toBe(3);expect((await snapshot(page)).campaign.party.at(-1)).toBe('knight');
 await page.screenshot({path:info.outputPath('hb-original-recruitment-budget.png'),fullPage:true});
 const checkpoint={version:1,campaign,battle:{size:5,epoch:0,terrain:[[1,0,4]],units:[unit('warrior',0,0,0,2,3),unit('cleric',0,0,1,6,2,6),unit('mage',0,-1,-1,6,2,6),unit('horseman',0,-2,0,12,4),unit('orc',1,3,-1,5,3),unit('troll',1,3,0,12,2)]}};
 await loadCheckpoint(page,checkpoint,mobile);await cell(page,0,1,mobile);await act(page.getByRole('button',{name:/2\. 治疗/}),mobile);await cell(page,0,0,mobile);s=await snapshot(page);expect(s.units.find((u:any)=>u.type==='warrior').hp).toBe(5);expect(s.units.find((u:any)=>u.type==='cleric').mana).toBe(5);
 await cell(page,-1,-1,mobile);await act(page.getByRole('button',{name:/3\. 火球/}),mobile);await cell(page,3,-1,mobile);s=await snapshot(page);expect(s.units.find((u:any)=>u.type==='orc').hp).toBe(2);expect(s.units.find((u:any)=>u.type==='troll').hp).toBe(9);expect(s.units.find((u:any)=>u.type==='mage').mana).toBe(5);
 await page.screenshot({path:info.outputPath('hb-heal-and-area-skill-checkpoint.png'),fullPage:true});
 const stored=await page.evaluate(k=>localStorage.getItem(k),key);await loadCheckpoint(page,'{"version":1,"campaign":{"depth":-1}}',mobile);expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(stored);await expect(page.locator('.hb-status')).toContainText('未导入');
 await act(page.getByRole('button',{name:'结束回合',exact:true}),mobile);await act(page.getByRole('button',{name:'暂停',exact:true}),mobile);s=await snapshot(page);expect(s.paused).toBe(true);expect(s.busy).toBe(true);await page.waitForTimeout(600);expect((await snapshot(page)).units).toEqual(s.units);await act(page.getByRole('button',{name:'继续游戏',exact:true}),mobile);await idle(page);
 // A fragile imported party loses by the original enemy action, then can retry.
 await act(page.getByRole('button',{name:'撤回营地',exact:true}),mobile);await act(page.getByRole('button',{name:'确认',exact:true}),mobile);
 await loadCheckpoint(page,{version:1,campaign,battle:{size:5,epoch:0,terrain:[],units:[unit('warrior',0,0,0,1,3),unit('dragon',1,1,0,20,4)]}},mobile);
 await act(page.getByRole('button',{name:'结束回合',exact:true}),mobile);await idle(page);expect((await snapshot(page)).result).toBe('loss');await page.screenshot({path:info.outputPath('hb-real-defeat-and-retry.png'),fullPage:true});await act(page.getByRole('button',{name:'返回营地',exact:true}),mobile);expect((await snapshot(page)).campaign).toEqual(campaign);
 await act(page.getByRole('button',{name:'开始战斗',exact:true}),mobile);await act(page.getByRole('button',{name:'结束回合',exact:true}),mobile);
 const readHandle=await page.evaluateHandle(()=>(window as unknown as {__hbRead:()=>unknown}).__hbRead);
 await act(page.getByRole('button',{name:'返回游戏大厅',exact:true}),mobile);expect(await readHandle.evaluate(fn=>(fn as ()=>any)())).toMatchObject({disposed:true,timers:0});
 await openGame(page,'六角远征');await expect(page.locator('[data-hb-ready]')).toBeVisible();expect((await snapshot(page)).campaign).toEqual(campaign);
 expect(await page.evaluate(()=>localStorage.getItem('playgarden.hb-unrelated'))).toBe('keep');
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('hb-320px-resumed-battle.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(outside).toEqual([]);expect(errors).toEqual([]);
});
