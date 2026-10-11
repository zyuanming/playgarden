// SPDX-License-Identifier: GPL-3.0-only
// Draft for review: ordinary pointer inputs only; observe snapshots without modifying game state.
import {test,expect,type Frame,type Locator} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import {writeFileSync} from 'node:fs';
type Tile={row:number;col:number;type:string};
type Live={started:boolean;day:number;night:boolean;level:number;xp:number;health:number;maxHealth:number;gem:number;mana:number;canMove:boolean;finished:boolean;casual:boolean;rows:number;columns:number;tiles:Tile[];items:Record<string,number>;counts:Record<string,number>;stores:{type:string;quantity:number}[];buildings:{type:string;built:boolean;obsolete:boolean;required:Record<string,number>}[];hero:{x:number;hp:number;shield:number;sword:number}|null;clock:{paused:boolean;now:number;timers:number};initCount:number};
async function read(frame:Frame):Promise<Live>{return frame.evaluate(()=> (window as unknown as Window&{__gridlandRead:()=>Live}).__gridlandRead());}
function moves(s:Live){
 const map=new Map(s.tiles.map(t=>[`${t.row},${t.col}`,t.type])),out:{a:Tile;b:Tile;gains:Record<string,number>}[]=[];
 for(const a of s.tiles)for(const [dr,dc] of [[0,1],[1,0]]){const b=s.tiles.find(t=>t.row===a.row+dr&&t.col===a.col+dc);if(!b||a.type===b.type)continue;
 const board=new Map(map);board.set(`${a.row},${a.col}`,b.type);board.set(`${b.row},${b.col}`,a.type);const matched=new Map<string,string>();
 for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++){const key=`${row},${col}`,type=board.get(key);if(!type)continue;for(const [vr,vc] of [[0,1],[1,0]]){const line:string[]=[];for(let n=0;board.get(`${row+n*vr},${col+n*vc}`)===type;n++)line.push(`${row+n*vr},${col+n*vc}`);if(line.length>=3)line.forEach(k=>matched.set(k,type));}}
 if(matched.size){const gains:Record<string,number>={};for(const type of matched.values())gains[type]=(gains[type]||0)+1;out.push({a,b,gains});}
 }return out;
}
function rank(s:Live,m:ReturnType<typeof moves>[number],enemy:boolean){
 let score=0;const wanted:Record<string,number>={};for(const b of s.buildings)if(!b.built&&!b.obsolete)for(const[k,n]of Object.entries(b.required))wanted[k]=(wanted[k]||0)+n;
 for(const[type,n]of Object.entries(m.gains)){
  if(!s.night){if(type==='grain')score+=n*(s.health<s.maxHealth-6?100:2);else if(type==='mana')score+=n*(s.mana<3?15:1);else{const stored=s.stores.filter(x=>x.type===type).reduce((a,b)=>a+b.quantity,0);score+=n*(wanted[type]?25:8)/(1+stored/30);}}
  else if(type==='wood')score+=n*(enemy&&s.hero!.shield<3?100:12);
  else if(type==='stone')score+=n*(enemy&&s.hero!.sword<3?110:12);
  else score+=n*(enemy?-50:type==='mana'&&s.level<7?-30:30);
 }return score;
}

test('Gridland original campaign: real matches, progression, original failure, saves, dragon and lifecycle',async({page},info)=>{
 // Exact full-run bound is assigned only after first observed gameplay; never inject a late-game save.
 test.setTimeout(9*60*1000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[],log:unknown[]=[];
 page.on('request',r=>{const u=new URL(r.url());if(/^https?:/.test(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname))outside.push(u.href);});
 const act=async(l:Locator)=>mobile?l.tap():l.click();
 await openGame(page,'格境求生');await expect(page.locator('.gridland-game')).toHaveAttribute('data-gridland-ready','true');
 const iframe=page.locator('iframe[title="格境求生 Gridland 完整战役"]');let frame=(await iframe.elementHandle())!;let game=(await frame.contentFrame())!;
 await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('gridland-slots.png'),fullPage:true});
 await act(game.locator('.saveSlot').first());await expect.poll(async()=> (await read(game)).started).toBe(true);
 await expect.poll(async()=> (await read(game)).canMove).toBe(true);await iframe.scrollIntoViewIfNeeded();
 const opening=await read(game);expect(opening.day).toBe(1);expect(opening.gem).toBe(0);expect(opening.counts.DRAGONS||0).toBe(0);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const frozen=await read(game);await page.waitForTimeout(1800);expect((await read(game)).clock.now).toBe(frozen.clock.now);
 await page.getByRole('button',{name:'继续',exact:true}).click();await expect.poll(async()=> (await read(game)).clock.paused).toBe(false);
 let screenshotDay=false,screenshotMagic=false,transitionChecked=false;const began=Date.now();
 try{
  while(Date.now()-began<8*60*1000){
   const s=await read(game);if(s.finished)break;
   if(!s.canMove){await page.waitForTimeout(120);continue;}
   if(s.health<s.maxHealth/2&&s.items.healthPotion){await act(game.locator('.inventory .healthPotion'));await page.waitForTimeout(150);continue;}
   if(s.night&&s.items.callDragon&&s.health>s.maxHealth*.8&&s.level>=7){await act(game.locator('.inventory .callDragon'));await page.waitForTimeout(500);continue;}
   const enemy=await game.evaluate(()=>{const w=(window as unknown as {require:(x:string)=>{findClosestMonster:()=>unknown}}).require('app/world');return !!w.findClosestMonster();});
   const choices=moves(s).sort((a,b)=>rank(s,b,enemy)-rank(s,a,enemy));if(!choices.length){await page.waitForTimeout(200);continue;}
   const m=choices[0];if(s.night&&enemy&&rank(s,m,true)<0){await page.waitForTimeout(250);continue;}
   log.push({elapsed:Date.now()-began,day:s.day,night:s.night,level:s.level,hp:s.health,gem:s.gem,items:s.items,a:m.a,b:m.b,gains:m.gains});
   for(const t of[m.a,m.b])await act(game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));
   if(!transitionChecked){
    const transitions=await game.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSTransition'&&a.playState==='running').length);
    if(transitions){await act(game.getByRole('button',{name:'暂停游戏',exact:true}));await expect(game.locator('#gridland-pause')).toBeVisible();
      const readVisuals=()=>game.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSTransition').map(a=>({time:a.currentTime,state:a.playState})));
      const before=await readVisuals();expect(before.length).toBeGreaterThan(0);await page.waitForTimeout(1800);expect(await readVisuals()).toEqual(before);await page.screenshot({path:info.outputPath('gridland-frozen-transition.png'),fullPage:false});
      await act(game.getByRole('button',{name:'继续游戏',exact:true}));await expect.poll(async()=> (await read(game)).clock.paused).toBe(false);transitionChecked=true;
    }
   }
   await page.waitForTimeout(500);
   if(s.day>=2&&!screenshotDay){await page.screenshot({path:info.outputPath('gridland-earned-second-day.png'),fullPage:false});screenshotDay=true;}
   if(s.gem===4&&!screenshotMagic){await page.screenshot({path:info.outputPath('gridland-earned-magic.png'),fullPage:false});screenshotMagic=true;}
  }
  expect(transitionChecked,'A real transition must be frozen/resumed').toBe(true);const ending=await read(game);expect(ending.finished,'Full dragon ending must be reached through ordinary play').toBe(true);
  await expect(game.locator('#endGame')).toContainText('屠龙成功');await page.screenshot({path:info.outputPath('gridland-dragon-clear.png'),fullPage:true});
  // Earned save is observed and archived exactly, never fabricated or altered.
  const saves=await game.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('playgarden:gridland:v1:'))));
  writeFileSync(info.outputPath('gridland-earned-saves.json'),JSON.stringify(saves,null,2));
  const beforePrestige=await read(game);await act(game.getByRole('button',{name:'新游戏＋',exact:true}));
  await expect.poll(async()=> (await read(game)).initCount).toBeGreaterThan(beforePrestige.initCount);
  await expect.poll(async()=> (await read(game)).canMove).toBe(true);
  const renewed=await read(game);expect((renewed as Live&{prestige:number}).prestige).toBe((beforePrestige as Live&{prestige:number}).prestige+1);
  const replay=moves(renewed)[0];for(const t of[replay.a,replay.b])await act(game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));
  await expect.poll(async()=> (await read(game)).counts.SWAPPED||0).toBeGreaterThan(renewed.counts.SWAPPED||0);
  await page.screenshot({path:info.outputPath('gridland-newgameplus-working.png'),fullPage:false});
  await page.getByRole('button',{name:'重来',exact:true}).click();await expect(page.locator('.gridland-game')).toHaveAttribute('data-gridland-ready','true');game=(await (await iframe.elementHandle())!.contentFrame())!;
  await expect(game.locator('.saveSlot').first()).toContainText('天');
  const earnedBefore=await game.evaluate(()=>localStorage.getItem('playgarden:gridland:v1:slot0'));
  await act(game.locator('.saveSlot').first().getByTitle('导出'));await expect(game.locator('textarea')).not.toBeEmpty();await act(game.getByTitle('确认'));
  await act(game.locator('.saveSlot').nth(1).getByTitle('导入'));await game.locator('textarea').fill('invalid-base64-save');await act(game.getByTitle('确认'));
  expect(await game.evaluate(()=>localStorage.getItem('playgarden:gridland:v1:slot0'))).toBe(earnedBefore);
  await act(game.locator('.saveSlot').nth(1));await expect.poll(async()=> (await read(game)).started).toBe(true);expect((await read(game)).day).toBe(1);
  await page.getByRole('button',{name:'重来',exact:true}).click();await expect(page.locator('.gridland-game')).toHaveAttribute('data-gridland-ready','true');game=(await (await iframe.elementHandle())!.contentFrame())!;
  await act(game.locator('.saveSlot').first());await expect.poll(async()=> (await read(game)).started).toBe(true);expect((await read(game)).counts.DRAGONS).toBeGreaterThan(0);
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();await expect(iframe).toHaveCount(0);

  expect(outside).toEqual([]);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{
  const earned=await game.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('playgarden:gridland:v1:')))).catch(()=>null);
  writeFileSync(info.outputPath('gridland-earned-checkpoint.json'),JSON.stringify({source:'Unmodified browser save earned by the ordinary inputs in this run',saves:earned},null,2));
  writeFileSync(info.outputPath('gridland-ordinary-inputs.json'),JSON.stringify({mobile,log,final:await read(game).catch(()=>null),errors,outside},null,2));
 }

});
