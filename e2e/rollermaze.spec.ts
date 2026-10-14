import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {openGame,chooseLevel} from './helpers';
const TITLE='滚动迷宫 · Rollermaze',FRAME='iframe[title="Rollermaze 原版游戏"]',KEY='playgarden.rollermaze.native.v1';
type Snapshot={level:number;title:string;state:number;ready:boolean;paused:boolean;frames:number;time:number;remaining:number|null;position:number[];target:number[];moving:number;keys:number;touch:boolean;cleared:number[];moves:number;safeSpots:number;collisions:number;failures:number;saved:boolean;blocks:{blocked:boolean}[];npcs:{deadly:boolean}[];ending:boolean;audio:{context:string;enabled:boolean;oscillators:number};map:{width:number;height:number;tiles:(number|null)[]}};
async function frame(page:Page){const result=page.frame({url:/\/games\/rollermaze\/index\.html(?:\?|$)/});if(!result)throw Error('Missing game frame');return result;}
async function read(page:Page):Promise<Snapshot>{return (await frame(page)).evaluate(()=>(window as unknown as {__rollermazeSnapshot:()=>Snapshot}).__rollermazeSnapshot());}
async function ready(page:Page,level?:number){await expect(page.locator('.rollermaze-host')).toHaveAttribute('data-rollermaze-ready','true');await expect.poll(async()=>{const s=await read(page);return s.ready&&s.position[1]<=0&&(level===undefined||s.level===level);},{timeout:10000}).toBe(true);return read(page);}
async function stop(page:Page){await expect.poll(async()=>(await read(page)).moving).toBe(0);return read(page);}
async function credits(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')||'{}').completed?.rollermaze||[]);}
function denyWrites(key:string){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Focused storage failure','QuotaExceededError');return set.call(this,k,v);};}
async function driver(page:Page,mobile:boolean){
 const cdp=mobile?await page.context().newCDPSession(page):null;let held:string|null=null;
 return {down:async(code:string)=>{if(held)throw Error('Release previous input first');
  if(cdp){const control=page.locator(`[data-rollermaze-key="${code}"]`);await expect(control).toBeEnabled();await control.scrollIntoViewIfNeeded();const b=await control.boundingBox();if(!b)throw Error('Missing control');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});}
  else{await page.locator(FRAME).click({position:{x:8,y:8}});await expect((await frame(page)).locator('#osd')).toBeFocused();await page.keyboard.down(code);}held=code;
 },tap:async(code:string)=>{if(!cdp||held)throw Error('Touch tap requires an idle mobile driver');
  const control=page.locator(`[data-rollermaze-key="${code}"]`);await expect(control).toBeEnabled();await control.scrollIntoViewIfNeeded();const b=await control.boundingBox();if(!b)throw Error('Missing control');held=code;
  // A real short gesture: schedule release independently of a slow CDP/RAF receipt.
  await Promise.all([cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]}),(async()=>{await new Promise(resolve=>setTimeout(resolve,40));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});})()]);held=null;
 },up:async(cancel=false)=>{if(!held)return;if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else await page.keyboard.up(held);held=null;},dispose:async()=>{if(held){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up(held);}await cdp?.detach();}};
}
// One focused desktop+touch journey. All outcomes use real keyboard/touch events;
// the engine observer is read-only. No state, success, RNG or clock is injected.
test('Rollermaze original routes, lifecycle and offline host',async({page},info)=>{
 test.setTimeout(120000);const mobile=info.project.name==='mobile',errors:string[]=[],outside:string[]=[],evidence:unknown[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(['http:','https:'].includes(u.protocol)&&u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')outside.push(r.url());});
 const input=await driver(page,mobile);
 const capture=async(name:string)=>{const s=await read(page);evidence.push({case:name,snapshot:s});await page.screenshot({path:info.outputPath(`rollermaze-${name}.png`),fullPage:true});};
 try{
  // Deliberately invalid storage is an environment-fault probe, never progress.
  await page.addInitScript(key=>{if(window===top&&!sessionStorage.getItem('rollermaze-corrupt-probe')){localStorage.setItem(key,'{"version":1,"cleared":[999]}');sessionStorage.setItem('rollermaze-corrupt-probe','1');}},KEY);
  await openGame(page,TITLE);const initial=await ready(page,0);expect(initial.cleared).toEqual([]);expect(initial.saved).toBe(false);expect(initial.remaining).toBe(null);
  expect(await (await frame(page)).evaluate(()=>{try{void parent.document;return false;}catch{return true;}})).toBe(true);
  await expect(page.getByLabel('选择关卡',{exact:true}).locator('option')).toHaveCount(25);
  await capture('original-start');
  // Accessible host buttons must retain a tap until native logic consumes it,
  // even when its keydown and keyup both fall between simulation steps.
  if(!mobile){
   const right=page.getByRole('button',{name:'向右滚动',exact:true});
   await right.focus();await right.press('Space');await expect.poll(async()=>(await read(page)).moves).toBe(1);await stop(page);expect((await read(page)).position[0]).toBe(-4);expect((await read(page)).keys).toBe(0);
   await right.press('Enter');await expect.poll(async()=>(await read(page)).moves).toBe(2);await stop(page);expect((await read(page)).position[0]).toBe(-2);expect((await read(page)).keys).toBe(0);
   await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();await ready(page,0);
  }
  // Native canvas touch-drag and cancellation, separate from host direction controls.
  if(mobile){const cdp=await page.context().newCDPSession(page);await page.locator(FRAME).scrollIntoViewIfNeeded();const b=await page.locator(FRAME).boundingBox();if(!b)throw Error('Missing frame bounds');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width/2+60,y:b.y+b.height/2,id:1}]});
   await expect.poll(async()=>(await read(page)).position[0]).toBeGreaterThan(initial.position[0]);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();await stop(page);expect((await read(page)).keys).toBe(0);expect((await read(page)).touch).toBe(false);
   await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();await ready(page,0);
  }
  // Wrong nonce/source cannot move the game or award a host completion.
  await (await frame(page)).evaluate(()=>{parent.postMessage({source:'playgarden-rollermaze',revision:'rollermaze-2a08f83-playgarden-1',session:'wrong',type:'complete',level:0,moves:1},'*');window.postMessage({source:'playgarden-host',session:'wrong',type:'key',code:'ArrowRight',down:true},'*');});
  expect(await credits(page)).toEqual([]);expect((await read(page)).moves).toBe(0);
  await input.down('ArrowRight');await expect.poll(async()=>(await read(page)).moves,{intervals:[20]}).toBeGreaterThan(0);await input.up(true);
  await page.locator('.game-toolbar').getByRole('button',{name:'暂停',exact:true}).click();await expect.poll(async()=>(await read(page)).paused).toBe(true);
  const paused=await read(page);await page.waitForTimeout(350);const frozen=await read(page);
  expect(frozen.frames).toBe(paused.frames);expect(frozen.time).toBe(paused.time);expect(frozen.position).toEqual(paused.position);expect(frozen.keys).toBe(0);expect(frozen.audio.oscillators).toBe(0);
  await page.getByRole('button',{name:'继续游戏',exact:true}).click();await stop(page);
  const beforeReset=await frame(page);await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();await ready(page,0);expect(beforeReset.isDetached()).toBe(true);
  expect((await read(page)).position).toEqual(initial.position);expect((await read(page)).remaining).toBe(null);
  // A genuine first-level finish: roll to the eastern edge, then into the woods.
  await input.down('ArrowRight');await expect.poll(async()=>(await read(page)).position[0],{intervals:[20]}).toBe(8);await input.up();await stop(page);
  await input.down('ArrowUp');await expect.poll(()=>credits(page),{intervals:[20]}).toEqual([0]);await input.up();
  expect((await read(page)).cleared).toEqual([0]);expect((await read(page)).state).toBe(3);await capture('earned-first-forest');
  await expect(page.locator('.game-main')).toHaveAttribute('data-level','1',{timeout:10000});await ready(page,1);
  expect((await read(page)).cleared).toEqual([0]);
  const persisted=await page.evaluate(key=>localStorage.getItem(key),KEY);expect(JSON.parse(persisted!)).toEqual({version:1,cleared:[0]});
  // Real timeout and retry; no patched Date/RAF or shortened countdown.
  await input.down('ArrowRight');await expect.poll(async()=>(await read(page)).moves).toBeGreaterThan(0);await input.up();
  await expect.poll(async()=>(await read(page)).state,{timeout:16000,intervals:[100]}).toBe(2);expect(await credits(page)).toEqual([0]);await capture('real-thirteen-second-failure');
  await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();await ready(page,1);
  // Button level: the closed bridge blocks real movement, the nearest switch opens it.
  await chooseLevel(page,2);await ready(page,2);expect((await read(page)).blocks.every(b=>b.blocked)).toBe(true);
  await input.down('ArrowRight');await page.waitForTimeout(600);await input.up();await stop(page);expect((await read(page)).position[0]).toBe(-4);expect((await read(page)).blocks.every(b=>b.blocked)).toBe(true);
  await input.down('ArrowUp');await expect.poll(async()=>(await read(page)).blocks.every(b=>!b.blocked),{intervals:[20]}).toBe(true);await input.up();await stop(page);await capture('nearest-button-opened');
  // Deny only native save writes before another real win; the host still tracks earns.
  await page.evaluate(denyWrites,KEY);
  await input.down('ArrowDown');await expect.poll(async()=>(await read(page)).position[2],{intervals:[20]}).toBe(8);await input.up();await stop(page);
  await input.down('ArrowRight');await expect.poll(()=>credits(page),{intervals:[20]}).toEqual([0,2]);await input.up();await expect.poll(async()=>(await read(page)).saved).toBe(false);await capture('earned-button-route-unsaved');
  // Original safe spot on map four refreshes the genuine running clock.
  await chooseLevel(page,3);await ready(page,3);
  await input.down('ArrowDown');await expect.poll(async()=>(await read(page)).position[2],{intervals:[20]}).toBe(-4);await input.up();await stop(page);
  const safeFrame=await frame(page);await input.down('ArrowRight');
  await safeFrame.waitForFunction(()=>(window as unknown as {__rollermazeSnapshot:()=>Snapshot}).__rollermazeSnapshot().target[0]===-6,undefined,{polling:'raf'});
  await input.up();await stop(page);expect((await read(page)).position[0]).toBe(-6);
  await input.down('ArrowDown');await expect.poll(async()=>(await read(page)).safeSpots,{intervals:[20]}).toBeGreaterThan(0);await input.up();await stop(page);expect((await read(page)).remaining).toBeGreaterThan(11);await capture('safe-spot-refills-clock');
  // Wake one original sentinel through a real collision, observing its chase flag.
  await chooseLevel(page,4);await ready(page,4);
  await input.down('ArrowUp');await expect.poll(async()=>(await read(page)).position[2],{intervals:[20]}).toBe(-20);await input.up();await stop(page);
  const sentinelFrame=await frame(page);
  if(mobile)await input.tap('ArrowDown');
  else{await Promise.all([sentinelFrame.waitForFunction(()=>(window as unknown as {__rollermazeSnapshot:()=>Snapshot}).__rollermazeSnapshot().target[2]===-18,undefined,{polling:'raf'}),input.down('ArrowDown')]);await input.up();}
  await stop(page);expect((await read(page)).position[2]).toBe(-18);
  await input.down('ArrowLeft');await expect.poll(async()=>(await read(page)).collisions,{intervals:[20]}).toBeGreaterThan(0);await input.up();expect((await read(page)).npcs.some(n=>n.deadly)).toBe(true);expect(await credits(page)).toEqual([0,2]);await capture('sentinel-wakes-and-returns-player');
  await chooseLevel(page,24);const last=await ready(page,24);expect(last.title).toBe('Quarter C');expect(last.cleared).toEqual([0,2]);expect(last.ending).toBe(false);expect(await credits(page)).toEqual([0,2]);await capture('original-map-25-no-credit');
  if(mobile){await page.setViewportSize({width:320,height:760});await capture('320px-controls');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:390,height:844});}
  // Reload discards the unsaved native clear and mid-run world; real host badges remain.
  await page.reload();await openGame(page,TITLE);await ready(page,24);expect((await read(page)).cleared).toEqual([0]);expect(await credits(page)).toEqual([0,2]);
  await chooseLevel(page,0);await ready(page,0);expect((await read(page)).moves).toBe(0);expect((await read(page)).remaining).toBe(null);
  // Mute and exit while a real action is active; the frame is detached with its loop.
  await page.getByRole('button',{name:'静音',exact:true}).click();await expect.poll(async()=>(await read(page)).audio.enabled).toBe(false);
  const exitFrame=await frame(page);
  await Promise.all([exitFrame.waitForFunction(()=>(window as unknown as {__rollermazeSnapshot:()=>Snapshot}).__rollermazeSnapshot().moving!==0,undefined,{polling:'raf'}),input.down('ArrowRight')]);await input.up();
  const leaving=await frame(page);await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();expect(leaving.isDetached()).toBe(true);await expect(page.locator(FRAME)).toHaveCount(0);
  expect(errors).toEqual([]);expect(outside).toEqual([]);
 }finally{await input.dispose();const data=JSON.stringify({upstreamCommit:'2a08f83fa3935fc981ac6efce26e2b9d6d34a5ed',project:info.project.name,evidence,errors,outside},null,2);writeFileSync(info.outputPath('rollermaze-real-input-evidence.json'),data);await info.attach('rollermaze-real-input-evidence',{body:data,contentType:'application/json'});}
});
