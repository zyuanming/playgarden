// SPDX-License-Identifier: GPL-3.0-only
// Ordinary pointer inputs only; observe snapshots without modifying game state.
import {test,expect,type Frame,type Locator} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import checkpoints from './fixtures/gridland-earned-round24.json' with {type:'json'};
// Explicit key screenshots, failure screenshots, ordinary-input logs and authentic
// saves replace per-action DOM trace snapshots (round2 produced a 2.66 GB trace).
test.use({trace:'off'});
type Tile={row:number;col:number;type:string};
type Live={started:boolean;day:number;night:boolean;level:number;xp:number;health:number;maxHealth:number;gem:number;mana:number;canMove:boolean;finished:boolean;casual:boolean;rows:number;columns:number;tiles:Tile[];items:Record<string,number>;counts:Record<string,number>;stores:{type:string;quantity:number}[];buildings:{type:string;built:boolean;obsolete:boolean;required:Record<string,number>}[];hero:{x:number;hp:number;shield:number;sword:number}|null;clock:{paused:boolean;now:number;timers:number};initCount:number};
async function read(frame:Frame):Promise<Live>{return frame.evaluate(()=> (window as unknown as Window&{__gridlandRead:()=>Live}).__gridlandRead());}
function boardReady(s:Live){return s.canMove&&s.tiles.length===s.rows*s.columns&&new Set(s.tiles.map(t=>`${t.row},${t.col}`)).size===s.tiles.length;}
async function tileHitTesting(frame:Frame){
 return frame.evaluate(()=>{
  const inactive=[...document.querySelectorAll('.tile.hidden,.tile.pooled,.tile.hidden *,.tile.pooled *')];
  const active=[...document.querySelectorAll('.tile:not(.hidden):not(.pooled)')];
  const checked=active.filter(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>=0&&y>=0&&x<innerWidth&&y<innerHeight;});
  return {inactive:inactive.length,interceptingInactive:inactive.filter(el=>getComputedStyle(el).pointerEvents!=='none').length,checked:checked.length,
   blocked:checked.filter(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.tile')!==el;}).map(el=>el.getAttribute('aria-label'))};
 });
}
function moves(s:Live){
 const map=new Map(s.tiles.map(t=>[`${t.row},${t.col}`,t.type])),out:{a:Tile;b:Tile;gains:Record<string,number>;longest:number}[]=[];
 for(const a of s.tiles)for(const [dr,dc] of [[0,1],[1,0]]){const b=s.tiles.find(t=>t.row===a.row+dr&&t.col===a.col+dc);if(!b||a.type===b.type)continue;
 const board=new Map(map);board.set(`${a.row},${a.col}`,b.type);board.set(`${b.row},${b.col}`,a.type);const matched=new Map<string,string>();let longest=0;
 for(let row=0;row<s.rows;row++)for(let col=0;col<s.columns;col++){const key=`${row},${col}`,type=board.get(key);if(!type)continue;for(const [vr,vc] of [[0,1],[1,0]]){const line:string[]=[];for(let n=0;board.get(`${row+n*vr},${col+n*vc}`)===type;n++)line.push(`${row+n*vr},${col+n*vc}`);if(line.length>=3){longest=Math.max(longest,line.length);line.forEach(k=>matched.set(k,type));}}}
 if(matched.size){const gains:Record<string,number>={};for(const type of matched.values())gains[type]=(gains[type]||0)+1;out.push({a,b,gains,longest});}
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

type Tactics={combatReady:boolean;dragonPresent:boolean;lichPresent:boolean;priority:string|null;maxShield:number;maxSword:number;swordDamage:number;work:boolean;loot:boolean;monster:{kind:string;hp:number;damage:number}|null;monsterCount:number;frozen:boolean};
async function tactics(frame:Frame):Promise<Tactics>{
 return frame.evaluate(()=>{
  type Entity={hp:()=>number;getDamage:()=>number;options:{monsterClass:string};carrying:unknown;action:{block?:unknown;building?:unknown}|null};
  type Building={built:boolean;obsolete:boolean;requiredResources:Record<string,number>};
  type Store={gone:boolean;_quantity:number;options:{type:{className:string}}};
  const req=(window as unknown as {require:(name:string)=>unknown}).require;
  const w=req('app/world') as {canMove:()=>boolean;getDude:()=>Entity;findClosestMonster:()=>Entity|null;findClosestLoot:()=>unknown;hasEffect:(name:string)=>boolean};
  const state=req('app/gamestate') as {prioritizedBuilding:string|null;maxShield:()=>number;maxSword:()=>number;swordDamage:()=>number;buildings:Building[];stores:Store[]};
  const hero=w.getDude(),monster=w.findClosestMonster();
  // Read-only observation of the actual visible work/combat, never invoke actions.
  const pending=state.buildings.filter(b=>!b.built&&!b.obsolete);
  const work=!!hero?.carrying||!!hero?.action?.block||!!hero?.action?.building||pending.some(b=>Object.values(b.requiredResources).every(n=>n<=0)||state.stores.some(v=>!v.gone&&v._quantity>=30&&b.requiredResources[v.options.type.className]>0));
  return {combatReady:w.canMove(),dragonPresent:!!document.querySelector('.dragon'),lichPresent:!!document.querySelector('.monster.lich .healthBar:not(.hidden)'),priority:state.prioritizedBuilding,maxShield:state.maxShield(),maxSword:state.maxSword(),swordDamage:state.swordDamage(),work,loot:!!w.findClosestLoot(),monster:monster?{kind:monster.options.monsterClass,hp:monster.hp(),damage:monster.getDamage()}:null,monsterCount:document.querySelectorAll('.monster .healthBar:not(.hidden)').length,frozen:w.hasEffect('freezeTime')};
 });
}
function buildingTarget(s:Live){
 const order=['blacksmith','sawmill','bricklayer','weaver','blacksmith2','sawmill2','bricklayer2','weaver2','blacksmith3','sawmill3'];
 // Original gameboard.tileMap enables clay only after BrickLayer and cloth
 // after Weaver. A visible building outline alone does not make its cost reachable.
 const available=new Set(['wood','stone','grain']);
 if(s.buildings.some(b=>b.type==='bricklayer'&&b.built))available.add('clay');
 if(s.buildings.some(b=>b.type==='weaver'&&b.built))available.add('cloth');
 return s.buildings.filter(b=>!b.built&&!b.obsolete&&Object.values(b.required).some(n=>n>0)&&Object.entries(b.required).every(([k,n])=>n<=0||available.has(k))).sort((a,b)=>{
  const ai=order.indexOf(a.type),bi=order.indexOf(b.type);return (ai<0?100:ai)-(bi<0?100:bi);
 })[0];
}
function equipmentNeeded(s:Live,t:Tactics){
 const strength=s.level<7?1:Math.floor((s.level-1)/3),enemy=t.monster;
 // Account for remaining sword charges, rather than assuming two armed hits.
 // Dragon's original armour subtracts two from each actual hit.
 const hit=(armed:boolean)=>Math.max(0,strength+(armed?t.swordDamage:0)-(enemy?.kind==='dragon'?2:0));
 const twoHits=hit(s.hero!.sword>0)+hit(s.hero!.sword>1);
 const shortFight=!!enemy&&t.monsterCount<=2&&enemy.hp<=twoHits&&s.health>s.maxHealth*.6;
 // Round22 refilled at 7/24 shield against a 2HP warlock with 5 damage.
 // Observe combat again every250ms; keep ordinary potions/low-health retreat.
 return {shield:!!enemy&&!shortFight&&s.hero!.shield<enemy.damage,sword:!!enemy&&!shortFight&&s.hero!.sword===0&&enemy.hp>hit(false)};
}
function seekDragonRune(s:Live,t:Tactics){
 // A tactical choice, not a game unlock: these are the actually earned gear
 // values in round20. Lich loot is the original route to the dragon item.
 return s.gem===4&&!s.items.callDragon&&s.level>=6&&t.swordDamage>=5&&t.maxShield>=18;
}
function campaignRank(s:Live,m:ReturnType<typeof moves>[number],t:Tactics){
 const target=buildingTarget(s),gain=m.gains;let score=0;
 if(!s.night){
  for(const[k,n]of Object.entries(gain)){
   if(k==='grain')score+=n*(s.health<s.maxHealth-4?130:1);
   else if(k==='mana')score+=n*(s.gem===4&&s.mana<3?110:1);
   else {const stored=s.stores.filter(x=>x.type===k).reduce((v,x)=>v+x.quantity,0),needed=(target?.required[k]||0)*30-stored;score+=n*(needed>0?70:3);}
  }
  // Daytime lines of four create mana tiles even with a full mana meter.
  // Preserve those tiles for a night match: ordinary mana matches summon the
  // lich, whose original loot is the dragon item. The meter and board differ.
  if(seekDragonRune(s,t)&&s.mana===3&&gain.mana)score-=600;
  if(s.gem===4&&(s.mana<3||seekDragonRune(s,t))&&s.health>s.maxHealth*.75&&m.longest>=4)score+=500;
  return score;
 }
 const spawn=Object.keys(gain).filter(k=>!['wood','stone'].includes(k));
 // Keep one fight at a time. Mixed matches must not trade a gear refill for
 // multiple new enemies while the hero is already engaged.
 if(t.monster&&spawn.length)return -Infinity;
 const needed=equipmentNeeded(s,t);
 if(gain.wood)score+=(t.monster?needed.shield:s.hero!.shield<t.maxShield)?80:1;
 if(gain.stone)score+=(t.monster?needed.sword:s.hero!.sword<t.maxSword)?90:1;
 if(!t.monster&&spawn.length){
  score+=20-80*(spawn.length-1);
  if(gain.mana)score+=seekDragonRune(s,t)&&s.health>s.maxHealth*.8&&s.hero!.sword===t.maxSword&&s.hero!.shield>=t.maxShield*2/3?180:-1000;
  // House grain summons 7HP/1-damage haunted armour; upgraded clay/cloth
  // summon the stronger elementals observed in round12's two real deaths.
  const houseArmour=s.buildings.some(b=>b.type==='house'&&b.built)&&!s.buildings.some(b=>['fort','castle'].includes(b.type)&&b.built);
  if(gain.grain&&houseArmour)score+=40;
  if(gain.clay)score+=15;
  if(gain.cloth)score+=5;
 }
 return score;
}

function emergencyRefillRank(s:Live,m:ReturnType<typeof moves>[number],t:Tactics){
 const needed=equipmentNeeded(s,t),g=m.gains;
 // Only used when no safe refill exists. A mixed legal match may be risky,
 // but indefinite waiting with depleted gear exhausted all potions in round14.
 // Prefer the missing weapon/shield, then fewer and milder visible threats.
 const refill=(needed.sword&&g.stone?250:0)+(needed.shield&&g.wood?220:0);
 const threats=Object.entries(g).filter(([k])=>!['wood','stone'].includes(k));
 const risk=threats.reduce((v,[k,n])=>v+100+n*(k==='mana'?25:k==='cloth'?8:k==='clay'?6:3),0);
 return refill-risk-Math.max(m.a.row,m.b.row)/100;
}

test('Gridland natural defeat and ordinary rebirth restore tile and carrying animations',async({page},info)=>{
 test.setTimeout(4*60*1000);const mobile=info.project.name==='mobile',errors=captureErrors(page),log:unknown[]=[];
 const act=async(l:Locator)=>mobile?l.tap():l.click();
 await openGame(page,'格境求生');await expect(page.locator('.gridland-game')).toHaveAttribute('data-gridland-ready','true');
 const iframe=page.locator('iframe[title="格境求生 Gridland 完整战役"]'),game=(await (await iframe.elementHandle())!.contentFrame())!;
 await act(game.locator('.saveSlot').first());await expect.poll(async()=>boardReady(await read(game))).toBe(true);
 const first=await read(game),began=Date.now();let witnessedZero=false;
 try{
  while(Date.now()-began<3*60*1000){
   const s=await read(game);if(s.health===0&&!witnessedZero){witnessedZero=true;await page.screenshot({path:info.outputPath('gridland-natural-defeat.png'),fullPage:false});}
   if(s.initCount>first.initCount&&boardReady(s))break;
   if(!boardReady(s)||s.health===0){await page.waitForTimeout(100);continue;}
   const choices=moves(s).sort((a,b)=>{
    const score=(m:ReturnType<typeof moves>[number])=>s.night?Object.entries(m.gains).reduce((v,[k,n])=>v+n*(['wood','stone'].includes(k)?-100:100),0):rank(s,m,false);
    return score(b)-score(a);
   });
   if(!choices.length){await page.waitForTimeout(150);continue;}
   const m=choices[0]; // Use available swaps even if only equipment matches remain; waiting would never change a settled board.
   log.push({elapsed:Date.now()-began,day:s.day,night:s.night,hp:s.health,a:m.a,b:m.b,gains:m.gains});
   for(const t of[m.a,m.b])await act(game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));
   await page.waitForTimeout(200);
  }
  const renewed=await read(game);expect(witnessedZero,'Ordinary enemies must actually exhaust health').toBe(true);expect(renewed.initCount).toBeGreaterThan(first.initCount);expect(renewed.counts.DEATHS).toBeGreaterThan(0);expect(boardReady(renewed)).toBe(true);
  expect(await game.locator('.tile.hidden[role="button"],.tile.pooled[role="button"]').count()).toBe(0);
  // Original drawFillBoard staggers falling tiles for up to1800ms. Logical
  // readiness alone does not mean every cell has reached its final hit box.
  await expect.poll(()=>tileHitTesting(game),{timeout:6000}).toMatchObject({interceptingInactive:0,checked:renewed.rows*renewed.columns,blocked:[]});
  const hits=await tileHitTesting(game);log.push({kind:'rebirth-hit-testing',hits});expect(hits.inactive).toBeGreaterThan(0);
  const move=moves(renewed)[0];
  if(mobile){for(const t of[move.a,move.b])await act(game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));}
  else{
   const cells=[move.a,move.b].map(t=>game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));
   await cells[0].scrollIntoViewIfNeeded();const a=await cells[0].boundingBox(),b=await cells[1].boundingBox();expect(a).not.toBeNull();expect(b).not.toBeNull();
   await page.mouse.move(a!.x+a!.width/2,a!.y+a!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2,{steps:8});await page.mouse.up();
   log.push({kind:'rebirth-real-mouse-drag',a:move.a,b:move.b});
  }
  await expect.poll(async()=> (await read(game)).counts.SWAPPED||0).toBeGreaterThan(renewed.counts.SWAPPED||0);
  // Each original drawMatch takes 400ms and recursively checks new matches.
  // Real CHAIN31 already exceeds the default 5s assertion budget. Observe each
  // changing state, but require the same strict settled-board condition.
  const settlingStarted=Date.now();let lastSettling='';
  await expect.poll(async()=>{
   const state=await read(game),identity=JSON.stringify({ready:boardReady(state),tiles:state.tiles,swapped:state.counts.SWAPPED,chain:state.counts.CHAIN});
   if(identity!==lastSettling){log.push({kind:'rebirth-settling',elapsed:Date.now()-settlingStarted,state});lastSettling=identity;}
   return boardReady(state);
  },{timeout:30000,intervals:[100,200,400]}).toBe(true);
  await page.screenshot({path:info.outputPath('gridland-rebirth-match.png'),fullPage:false});expect(errors).toEqual([]);
 }finally{
  const saves=await game.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('playgarden:gridland:v1:')))).catch(()=>null);
  writeFileSync(info.outputPath('gridland-defeat-journey.json'),JSON.stringify({mobile,log,witnessedZero,final:await read(game).catch(()=>null),saves,errors},null,2));
 }
});

test('Gridland original campaign: real matches, progression, saves, dragon and lifecycle',async({page},info)=>{
 // A bounded continuation of each platform's own authentic earned checkpoint.
 // Failure to reach the dragon remains a campaign HOLD, never a completion PASS.
 test.setTimeout(9*60*1000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[],log:unknown[]=[];
 page.on('request',r=>{const u=new URL(r.url());if(/^https?:/.test(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname))outside.push(u.href);});
 const act=async(l:Locator)=>mobile?l.tap():l.click();
 await openGame(page,'格境求生');await expect(page.locator('.gridland-game')).toHaveAttribute('data-gridland-ready','true');
 const iframe=page.locator('iframe[title="格境求生 Gridland 完整战役"]');let frame=(await iframe.elementHandle())!;let game=(await frame.contentFrame())!;
 await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('gridland-slots.png'),fullPage:true});
 const earned=checkpoints.projects[mobile?'mobile':'desktop'];
 expect(createHash('sha256').update(earned.slot0).digest('hex')).toBe(earned.sha256);
 await act(game.locator('.saveSlot').first().getByTitle('导入'));
 await game.locator('textarea').fill(Buffer.from(earned.slot0,'utf8').toString('base64'));
 await act(game.getByTitle('确认'));
 await expect(game.locator('.saveSlot').first()).toContainText(String(earned.day));
 const imported=await game.evaluate(()=>localStorage.getItem('playgarden:gridland:v1:slot0'));
 // The game's normal importer strips non-state object properties. Compare every
 // progress value while preserving the input string byte-for-byte.
 const sourceSave=JSON.parse(earned.slot0),loadedSave=JSON.parse(imported!);
 for(const key of ['dayNumber','level','xp','health','gem','mana','prestige','items','counts'])expect(loadedSave[key]).toEqual(sourceSave[key]);
 expect(loadedSave.buildings.map((b:{options:{type:{className:string}};requiredResources:unknown;built:boolean})=>({type:b.options.type.className,required:b.requiredResources,built:b.built}))).toEqual(sourceSave.buildings.map((b:{options:{type:{className:string}};requiredResources:unknown;built:boolean})=>({type:b.options.type.className,required:b.requiredResources,built:b.built})));
 expect(loadedSave.stores.map((b:{options:{type:{className:string}};_quantity:number})=>({type:b.options.type.className,quantity:b._quantity}))).toEqual(sourceSave.stores.map((b:{options:{type:{className:string}};_quantity:number})=>({type:b.options.type.className,quantity:b._quantity})));
 log.push({kind:'ui-import',sourceRun:earned.sourceRun,sourceHead:earned.sourceHead,restoreReason:earned.restoreReason,slotSha256:earned.sha256,day:earned.day,level:earned.level});
 await act(game.locator('.saveSlot').first());await expect.poll(async()=> (await read(game)).started).toBe(true);
 await expect.poll(async()=> (await read(game)).canMove).toBe(true);await iframe.scrollIntoViewIfNeeded();
 const opening=await read(game);expect(opening.day).toBe(earned.day);expect(opening.level).toBe(earned.level);expect(opening.counts.DEATHS).toBe(earned.deaths);expect(opening.counts.DRAGONS||0).toBe(0);expect(opening.casual).toBe(false);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const frozen=await read(game);await page.waitForTimeout(1800);expect((await read(game)).clock.now).toBe(frozen.clock.now);
 await page.getByRole('button',{name:'继续',exact:true}).click();await expect.poll(async()=> (await read(game)).clock.paused).toBe(false);
 let screenshotDay=false,screenshotMagic=false,transitionChecked=false,lastPhase='',lastWait='',lastWaitAt=0;const began=Date.now();
 const note=(kind:string,s:Live,extra:Record<string,unknown>={})=>log.push({elapsed:Date.now()-began,kind,day:s.day,night:s.night,level:s.level,hp:s.health,gem:s.gem,mana:s.mana,items:s.items,hero:s.hero,...extra});
 const shot=async(name:string)=>{await page.locator('.gridland-game').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:info.outputPath(name),fullPage:false});};
 const waitForPlay=async(reason:string,s:Live,t:Tactics)=>{
  if(lastWait!==reason||Date.now()-lastWaitAt>5000){note('wait',s,{reason,tactics:t});lastWait=reason;lastWaitAt=Date.now();}
  await page.waitForTimeout(250);
 };
 try{
  while(Date.now()-began<8*60*1000){
   const s=await read(game);if(s.finished)break;
   if(!s.started||s.health<=0||!s.hero){await page.waitForTimeout(120);continue;}
   const t=await tactics(game);
   // The original inventory requires World.canMove(), not a settled board.
   // Do not withhold available potions/magic while cascading tiles animate.
   if(!t.combatReady){await page.waitForTimeout(120);continue;}
   const phase=`${s.day}-${s.night}-${s.initCount}`;
   if(phase!==lastPhase){note('phase',s,{tactics:t,buildings:s.buildings});await shot(`gridland-phase-${phase}.png`);lastPhase=phase;}
   const item=async(name:string)=>{note('item',s,{name,tactics:t});await act(game.locator(`.inventory .${name}`));await page.waitForTimeout(150);};
   if(s.night&&s.health<=s.maxHealth/2&&s.items.healthPotion){await item('healthPotion');continue;}
   if(!s.night){
    const target=buildingTarget(s);
    if(target&&t.priority!==target.type){
     const control=game.locator(`.building.${target.type} .resourceBars.show:not(.sunk)`);
     if(await control.isVisible()&&await control.evaluate(el=>Number(getComputedStyle(el).opacity)>.9)){
      note('prioritize-building',s,{building:target.type});await act(control);await page.waitForTimeout(150);continue;
     }
    }
    // A successful swap burns daylight; ordinary carrying/building does not.
    if(t.work){await waitForPlay('finish-real-carry-or-building',s,t);continue;}
   }else{
    if(t.monster&&s.items.bomb&&(t.monsterCount>=2||t.monster.hp>=20||s.health<t.monster.damage*3)){await item('bomb');continue;}
    const needed=equipmentNeeded(s,t);
    if(t.monster&&s.items.equipment&&(needed.shield||needed.sword)){await item('equipment');continue;}
    if(!t.monster&&t.loot){await waitForPlay('pick-up-earned-loot',s,t);continue;}
    // Keep earned mana for the original day/night spell when ordinary
    // enemies overwhelm depleted gear. This normal UI action saves the day's
    // real gains; it does not count as a kill or the required dragon ending.
    // A healthy lich fight is the original route to the dragon item. In
    // round21, changing to day discarded live liches (and any uncollected loot).
    // Use the visible 15-second freeze spell instead; low-health retreat stays.
    const freeze=!t.frozen&&(t.monster?.kind==='dragon'||(t.lichPresent&&s.health>s.maxHealth*.4));
    const retreat=!!t.monster&&!t.dragonPresent&&t.monster.kind!=='dragon'&&
     (s.health<=s.maxHealth*.4||(!t.lichPresent&&t.monsterCount>=2&&(needed.shield||needed.sword)));
    if(s.mana>=3&&(freeze||retreat)){
     const spell=freeze?'freezeTime':'phaseChange';
     note('spell',s,{name:spell,tactics:t});await act(game.locator('.magic > .button'));await act(game.locator(`.spell.${spell}`));
     if(spell==='phaseChange')await expect.poll(async()=>{const c=await read(game);return !c.night&&c.day>s.day;}).toBe(true);
     else await expect.poll(async()=> (await tactics(game)).frozen).toBe(true);
     const cast=await read(game);expect(cast.counts.CAST||0).toBe((s.counts.CAST||0)+1);
     // A retreat can turn an already-running mana cascade into daytime income.
     // Freeze stays at night, so its exact expenditure is also observable.
     if(spell==='freezeTime')expect(cast.mana).toBe(s.mana-3);
     note('spell-confirmed',cast,{name:spell});continue;
    }
    if(!t.monster&&s.items.callDragon&&s.health>s.maxHealth*.8&&s.level>=7){await item('callDragon');continue;}
    // Refilling after every single hit creates avoidable cascade spawns. Let
    // actual combat finish; replenish only exhausted weapon/low remaining shield.
    if(t.monster&&!needed.shield&&!needed.sword){await waitForPlay('fight-before-refilling-equipment',s,t);continue;}
   }
   if(!boardReady(s)){await page.waitForTimeout(120);continue;}
   const choices=moves(s).sort((a,b)=>campaignRank(s,b,t)-campaignRank(s,a,t));if(!choices.length){await page.waitForTimeout(200);continue;}
   let m=choices[0];if(!Number.isFinite(campaignRank(s,m,t))||(t.monster&&campaignRank(s,m,t)<50)){
    const needed=equipmentNeeded(s,t);
    if(t.monster&&(needed.shield||needed.sword)){
     const refills=choices.filter(c=>(needed.sword&&c.gains.stone)||(needed.shield&&c.gains.wood));
     const candidates=refills.length?refills:choices;
     m=[...candidates].sort((a,b)=>emergencyRefillRank(s,b,t)-emergencyRefillRank(s,a,t))[0];
     note(refills.length?'emergency-refill-choice':'break-deadlock',s,{tactics:t,needed,legalChoices:choices.length,refillChoices:refills.length,reason:refills.length?'match-missing-equipment':'no-visible-equipment-match-clear-a-legal-line',choices:choices.map(c=>({a:c.a,b:c.b,gains:c.gains,score:emergencyRefillRank(s,c,t)})),selected:{a:m.a,b:m.b,gains:m.gains}});
    }else{await waitForPlay('fight-without-spawning-more-enemies',s,t);continue;}
   }
   if(seekDragonRune(s,t)&&(!s.night&&m.longest>=4||s.night&&!t.monster))note('dragon-route-choice',s,{tactics:t,manaOnBoard:s.tiles.filter(v=>v.type==='mana').length,legalManaMatches:choices.filter(v=>v.gains.mana).length,longest:m.longest,selected:{a:m.a,b:m.b,gains:m.gains}});
   note('swap',s,{tactics:t,a:m.a,b:m.b,gains:m.gains});lastWait='';
   for(const t of[m.a,m.b])await act(game.getByRole('button',{name:`第${t.row+1}行第${t.col+1}列 ${t.type}`,exact:true}));
   if(!transitionChecked){
    const transitions=await game.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSTransition'&&a.playState==='running').length);
    if(transitions){await act(game.getByRole('button',{name:'暂停游戏',exact:true}));await expect(game.locator('#gridland-pause')).toBeVisible();
      const readVisuals=()=>game.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSTransition').map(a=>({time:a.currentTime,state:a.playState,pending:a.pending})));
      const requested=await readVisuals();note('pause-requested',s,{visuals:requested});
      // W3C Web Animations 4.4.9: pause queues an asynchronous pending task;
      // playState may already say paused before its ready promise resolves.
      // Observe completion; never seek, pause, or alter an animation in the test.
      await game.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.constructor.name==='CSSTransition').map(a=>a.ready));});
      await expect.poll(async()=>{const v=await readVisuals();return v.length>0&&v.every(a=>a.state==='paused'&&!a.pending);}).toBe(true);
      const before=await readVisuals();note('pause-settled',s,{visuals:before});await page.waitForTimeout(1800);const after=await readVisuals();note('pause-held',s,{visuals:after});expect(after).toEqual(before);await shot('gridland-frozen-transition.png');
      await act(game.getByRole('button',{name:'继续游戏',exact:true}));await expect.poll(async()=> (await read(game)).clock.paused).toBe(false);transitionChecked=true;
    }
   }
   await page.waitForTimeout(500);
   if(s.day>opening.day&&!screenshotDay){await shot('gridland-earned-next-day.png');screenshotDay=true;}
   if(s.gem===4&&!screenshotMagic){await shot('gridland-earned-magic.png');screenshotMagic=true;}
  }
  await shot('gridland-continuation-final.png');
  expect(transitionChecked,'A real transition must be frozen/resumed').toBe(true);const ending=await read(game);expect(ending.finished,'Full dragon ending must be reached through ordinary play').toBe(true);
  await expect(game.locator('#endGame')).toContainText('屠龙成功');await page.screenshot({path:info.outputPath('gridland-dragon-clear.png'),fullPage:true});
  // Earned save is observed and archived exactly, never fabricated or altered.
  const saves=await game.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('playgarden:gridland:v1:'))));
  writeFileSync(info.outputPath('gridland-earned-saves.json'),JSON.stringify(saves,null,2));
  const beforePrestige=await read(game);await act(game.getByRole('button',{name:'新游戏＋',exact:true}));
  await expect.poll(async()=> (await read(game)).initCount).toBeGreaterThan(beforePrestige.initCount);
  await expect(game.locator('body')).not.toHaveClass(/bigExplosion|fadeOut/);
  await expect.poll(async()=>boardReady(await read(game))).toBe(true);
  const renewed=await read(game);expect((renewed as Live&{prestige:number}).prestige).toBe((beforePrestige as Live&{prestige:number}).prestige+1);
  await expect.poll(()=>tileHitTesting(game),{timeout:6000}).toMatchObject({interceptingInactive:0,checked:renewed.rows*renewed.columns,blocked:[]});
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
