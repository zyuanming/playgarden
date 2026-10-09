// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Frame,type Locator,type Page} from '@playwright/test';
import {captureErrors,openGame} from './helpers';
// These are explicit import fixtures for a long campaign, never a claim that an
// entire campaign was played from zero. Original rules, map generation, combat,
// upgrade costs and the 60-second ascent execute normally in the browser.
const village={version:1.3,features:{location:{room:true,outside:true}},stores:{wood:500,fur:200,meat:100,leather:100,'cured meat':100,compass:1,'water tank':1,rucksack:1,'s armour':1,'iron sword':1,torch:5},game:{builder:{level:4},fire:{value:4,text:'roaring'},temperature:{value:4,text:'hot'},buildings:{hut:2,lodge:1,trap:1},workers:{hunter:0},population:4},outfit:{},previous:{},config:{}};
const ship=(hull:number)=>({...village,features:{location:{room:true,outside:true,spaceShip:true}},stores:{...village.stores,'alien alloy':2},game:{...village.game,spaceShip:{hull,thrusters:3,seenShip:true,seenWarning:false}}});
async function gameFrame(page:Page){const f=page.frames().find(f=>f.url().includes('/adr-original/index.html'));expect(f).toBeTruthy();return f!;}
async function read(frame:Frame):Promise<any>{return frame.evaluate(()=> (window as unknown as {__adrRead:()=>unknown}).__adrRead());}
const active=(frame:Frame,selector:string)=>frame.locator(selector).filter({visible:true});
async function act(control:Locator,mobile:boolean){await expect(control).toBeVisible();if(mobile)await control.tap();else await control.click();}
async function clock(page:Page,ms:number){await page.clock.runFor(ms);}
async function showSave(frame:Frame,mobile:boolean){await expect(frame.locator('#event')).toHaveCount(0);await act(frame.locator('.menu > .menuBtn').filter({hasText:/保存|save\./}).first(),mobile);}
async function importCode(page:Page,frame:Frame,code:string,mobile:boolean,valid=true){
  await showSave(frame,mobile);await act(frame.locator('#import'),mobile);await act(frame.locator('#yes'),mobile);
  const editor=frame.locator('#description textarea');await editor.fill(code);
  const module=(await read(frame)).module;await editor.press('ArrowLeft');await editor.press('ArrowRight');expect((await read(frame)).module).toBe(module);
  const navigation=valid?page.waitForEvent('framenavigated',{predicate:f=>f===frame}):undefined;
  await act(frame.locator('#okay'),mobile);if(navigation)await navigation;
  if(valid){await expect.poll(async()=>{try{return (await read(await gameFrame(page))).clock.disposed===false;}catch{return false;}}).toBe(true);await expect(page.locator('.adr-game')).toHaveAttribute('data-adr-ready','true');return gameFrame(page);}
  await expect(frame.locator('#adr-error')).toContainText('原进度已保留');
  await clock(page,500);await expect(frame.locator('#event')).toHaveCount(0);return frame;
}
const encode=(state:unknown)=>Buffer.from(JSON.stringify(state),'utf8').toString('base64');
async function settleEvent(page:Page,frame:Frame,mobile:boolean){
  for(let i=0;i<45;i++){
    if(!await frame.locator('#event').isVisible())return;
    const hp=(await read(frame)).health;
    if(hp<25&&await active(frame,'#eat:not(.disabled)').count())await act(active(frame,'#eat:not(.disabled)'),mobile);
    const attack=active(frame,'.weaponButton:not(.disabled)').first();
    if(await attack.count()){await act(attack,mobile);await clock(page,2200);continue;}
    const loot=active(frame,'#loot_takeEverything:not(.disabled)');if(await loot.count()){await act(loot,mobile);await clock(page,1200);continue;}
    let chosen:Locator|undefined;
    for(const selector of ['#enter','#continue','#leave','#leaveBtn','#exit','#end']){const b=active(frame,selector+':not(.disabled)');if(await b.count()){chosen=b.first();break;}}
    if(chosen)await act(chosen,mobile);
    await clock(page,1200);
  }
  throw Error('Original event did not resolve within the bounded journey');
}
async function step(page:Page,frame:Frame,dx:number,dy:number,mobile:boolean){
  const code=dx<0?37:dx>0?39:dy<0?38:40;
  await act(frame.locator(`#adr-directions button[data-key="${code}"]`),mobile);await clock(page,100);
}
async function travel(page:Page,frame:Frame,point:number[],mobile:boolean){
  for(let n=0;n<50;n++){
    await settleEvent(page,frame,mobile);const s=await read(frame);if(s.module!=='World')return;
    const [x,y]=s.position;if(x===point[0]&&y===point[1])return;
    await step(page,frame,Math.sign(point[0]-x),point[0]===x?Math.sign(point[1]-y):0,mobile);
  }
  throw Error('Destination was not reached');
}
async function hold(page:Page,frame:Frame,code:number,ms:number,mobile:boolean){
  const b=frame.locator(`#adr-directions button[data-key="${code}"]`);await b.scrollIntoViewIfNeeded();
  if(!mobile){await b.focus();await page.keyboard.down(' ');await clock(page,ms);await page.keyboard.up(' ');return;}
  const box=(await b.boundingBox())!,cdp=await page.context().newCDPSession(page);
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await clock(page,ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(400);}finally{await cdp.detach();}
}

test('full original campaign: opening, village, exploration, failure, flight ending and isolated saves',async({page},info)=>{
  test.setTimeout(360000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
  await page.clock.install({time:new Date('2026-10-09T12:00:00Z')});
  await page.addInitScript(()=>{let seed=1562020;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await openGame(page,'小黑屋远行');await expect(page.locator('.adr-game')).toHaveAttribute('data-adr-ready','true');let frame=await gameFrame(page);
  await page.evaluate(()=>localStorage.setItem('playgarden.adr-other-game-sentinel','keep'));
  await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
  await expect(page.locator('.game-toolbar')).toContainText('完整战役');
  await act(frame.locator('#lightButton'),mobile);expect((await read(frame)).game.fire.value).toBe(3);
  await clock(page,125000);expect((await read(frame)).game.builder.level).toBeGreaterThanOrEqual(3);
  expect(await frame.locator('#notifications .notification').count()).toBeGreaterThan(0);
  await act(frame.locator('#location_outside'),mobile);await act(frame.locator('#gatherButton'),mobile);
  await act(frame.locator('#location_room'),mobile);
  // The original crafting view refreshes after a normal resource-changing action.
  await act(frame.locator('#stokeButton'),mobile);const wood=(await read(frame)).stores.wood;expect(wood).toBeGreaterThanOrEqual(10);
  await act(frame.locator('[buildThing="trap"]'),mobile);
  expect((await read(frame)).game.buildings.trap).toBe(1);
  // A two-wood builder income may arrive while the native click waits for animation.
  expect([wood-10,wood-8]).toContain((await read(frame)).stores.wood);
  await page.screenshot({path:info.outputPath('adr-earned-opening-and-trap.png'),fullPage:true});
  await act(page.getByRole('button',{name:'暂停',exact:true}),mobile);const frozen=await read(frame);await clock(page,10000);
  expect((await read(frame)).clock.now).toBe(frozen.clock.now);expect((await read(frame)).stores).toEqual(frozen.stores);
  await frame.locator('#adr-resume').focus();await page.keyboard.press('ArrowRight');expect((await read(frame)).module).toBe(frozen.module);
  await act(page.getByRole('button',{name:'继续游戏',exact:true}),mobile);
  // Importing malformed data through the actual UI cannot destroy this earned save.
  const before=(await read(frame)).game.buildings.trap;
  await importCode(page,frame,Buffer.from('{"version":1.3,"stores":{"__proto__":{"polluted":true}}}').toString('base64'),mobile,false);
  expect((await read(frame)).game.buildings.trap).toBe(before);
  await importCode(page,frame,encode({version:1.3,wait:{initDelay:0}}),mobile,false);
  const badMap=Array.from({length:61},()=>Array.from({length:61},()=>null));badMap[30][30]='A' as never;badMap[0][0]='W' as never;
  await importCode(page,frame,encode({version:1.3,game:{world:{map:badMap,mask:Array.from({length:61},()=>Array(61).fill(null))}}}),mobile,false);
  expect((await read(frame)).game.buildings.trap).toBe(before);
  frame=await importCode(page,frame,encode(village),mobile);
  expect((await read(frame)).game.buildings.hut).toBe(2);expect((await read(frame)).stores.compass).toBe(1);
  await act(frame.locator('#location_outside'),mobile);
  const hunters=frame.locator('.workerRow').filter({has:frame.locator('.row_key').filter({hasText:/猎人|hunter/})});
  await act(hunters.locator('.upBtn'),mobile);const meat=(await read(frame)).stores.meat;await clock(page,11000);
  expect((await read(frame)).game.workers.hunter).toBe(1);expect((await read(frame)).stores.meat).toBeGreaterThan(meat);
  await page.screenshot({path:info.outputPath('adr-village-checkpoint-real-worker-income.png'),fullPage:true});
  await act(frame.locator('#location_path'),mobile);
  await act(frame.locator('#outfit_row_iron-sword .upBtn'),mobile);await act(frame.locator('#outfit_row_torch .upBtn'),mobile);
  await act(frame.locator('#outfit_row_cured-meat .upManyBtn'),mobile);await act(frame.locator('#outfit_row_cured-meat .upManyBtn'),mobile);
  expect((await read(frame)).outfit['iron sword']).toBe(1);expect((await read(frame)).outfit.torch).toBe(1);
  await act(frame.locator('#embarkButton'),mobile);let s=await read(frame);expect(s.mapSize).toBe(61);expect(s.module).toBe('World');
  const map=s.game.world.map as string[][],landmarks:number[][]=[];
  for(let x=0;x<61;x++)for(let y=0;y<61;y++)if(map[x][y]==='H')landmarks.push([x,y]);
  landmarks.sort((a,b)=>Math.abs(a[0]-30)+Math.abs(a[1]-30)-Math.abs(b[0]-30)-Math.abs(b[1]-30));
  await travel(page,frame,landmarks[0],mobile);await settleEvent(page,frame,mobile);
  // If the house branch was quiet, walk nearby until one real encounter occurs.
  for(let i=0;i<16&&(await read(frame)).counters.battles===0;i++){await step(page,frame,i%2?1:-1,0,mobile);await settleEvent(page,frame,mobile);}
  expect((await read(frame)).counters.battles).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('adr-original-world-and-earned-exploration.png'),fullPage:true});
  await travel(page,frame,[30,30],mobile);expect((await read(frame)).module).toBe('Path');expect((await read(frame)).counters.homecomings).toBeGreaterThan(0);
  await showSave(frame,mobile);await act(frame.locator('#export'),mobile);const exported=await frame.locator('#description textarea').inputValue();
  expect(JSON.parse(Buffer.from(exported,'base64').toString('utf8')).game.world.map).toHaveLength(61);
  await act(frame.locator('#done'),mobile);frame=await importCode(page,frame,exported,mobile);expect((await read(frame)).mapSize).toBe(61);
  // A separate under-equipped fixture verifies the original death-and-return path.
  const fragile={...village,stores:{wood:50,compass:1,'cured meat':1},outfit:{'cured meat':1}};
  frame=await importCode(page,frame,encode(fragile),mobile);await act(frame.locator('#location_path'),mobile);await act(frame.locator('#embarkButton'),mobile);
  for(let i=0;i<65&&(await read(frame)).module==='World';i++){
    if(await frame.locator('#event').isVisible())await clock(page,8000);
    else{const pos=(await read(frame)).position;await step(page,frame,pos[0]===30?1:0,pos[0]===30?0:pos[1]===30?1:-1,mobile);await clock(page,600);}
  }
  await clock(page,4000);expect((await read(frame)).counters.deaths).toBeGreaterThan(0);expect((await read(frame)).module).toBe('Room');expect((await read(frame)).game.buildings.hut).toBe(2);
  await page.screenshot({path:info.outputPath('adr-natural-death-and-permanent-village.png'),fullPage:true});
  // A one-hull ship must genuinely crash; no direct calls to crash/endGame.
  frame=await importCode(page,frame,encode(ship(1)),mobile);await act(frame.locator('#location_ship'),mobile);await act(frame.locator('#liftoffButton'),mobile);await act(frame.locator('#fly'),mobile);
  await hold(page,frame,39,250,mobile);expect((await read(frame)).flight.x).toBeGreaterThan(350);
  for(let i=0;i<30&&(await read(frame)).module==='Space';i++)await clock(page,2000);
  expect((await read(frame)).counters.crashes).toBeGreaterThan(0);expect((await read(frame)).module).toBe('Ship');
  await page.screenshot({path:info.outputPath('adr-real-asteroid-crash.png'),fullPage:true});
  frame=await importCode(page,frame,encode(ship(30)),mobile);await act(frame.locator('#location_ship'),mobile);
  await act(frame.locator('#reinforceButton'),mobile);await act(frame.locator('#engineButton'),mobile);s=await read(frame);
  expect(s.stores['alien alloy']).toBe(0);expect(s.game.spaceShip.hull).toBe(31);expect(s.game.spaceShip.thrusters).toBe(4);
  await act(frame.locator('#liftoffButton'),mobile);await act(frame.locator('#fly'),mobile);await hold(page,frame,39,500,mobile);await hold(page,frame,38,250,mobile);
  s=await read(frame);expect(s.flight.x).toBeGreaterThan(350);expect(s.flight.y).toBeLessThan(350);expect(s.flight.directions).toEqual([false,false,false,false]);
  await act(page.getByRole('button',{name:'暂停',exact:true}),mobile);const flightPause=await read(frame);await clock(page,5000);
  expect((await read(frame)).flight).toEqual(flightPause.flight);await act(page.getByRole('button',{name:'继续游戏',exact:true}),mobile);
  await page.screenshot({path:info.outputPath('adr-original-flight-and-touch-controls.png'),fullPage:true});
  for(let i=0;i<90&&!(await read(frame)).finished;i++)await clock(page,1000);
  s=await read(frame);expect(s.finished).toBe(true);expect(s.counters.endings).toBe(1);expect(s.ending.total).toBeGreaterThan(0);
  await expect(page.locator('.adr-victory')).toContainText('旅程完成');
  await page.screenshot({path:info.outputPath('adr-real-ending-and-prestige.png'),fullPage:true});
  await act(frame.locator('.endGameOption').first(),mobile);await act(frame.locator('#yes'),mobile);
  frame=await gameFrame(page);await expect.poll(async()=>{try{return (await read(frame)).module;}catch{return 'loading';}}).toBe('Room');
  s=await read(frame);expect(s.previous.score).toBeGreaterThan(0);expect(s.previous.stores.length).toBe(24);
  expect(await page.evaluate(()=>localStorage.getItem('playgarden.adr-other-game-sentinel'))).toBe('keep');
  await page.screenshot({path:info.outputPath('adr-next-journey-preserves-prestige.png'),fullPage:true});
  // Exit really unloads the iframe and cancels its clock, including repeated entry.
  const oldWindow=await page.locator('iframe').evaluateHandle((f:HTMLIFrameElement)=>f.contentWindow);
  await act(page.getByRole('button',{name:'返回游戏大厅',exact:true}),mobile);await expect(page.locator('iframe')).toHaveCount(0);
  expect(await oldWindow.evaluate(w=>(w as unknown as {ADRClock:{stats:()=>{disposed:boolean;timers:number}}}).ADRClock.stats())).toMatchObject({disposed:true,timers:0});
  await openGame(page,'小黑屋远行');frame=await gameFrame(page);await expect(page.locator('.adr-game')).toHaveAttribute('data-adr-ready','true');expect((await read(frame)).previous.score).toBeGreaterThan(0);
  if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('adr-320px-saved-campaign.png'),fullPage:true});}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(outside).toEqual([]);expect(errors).toEqual([]);
});
