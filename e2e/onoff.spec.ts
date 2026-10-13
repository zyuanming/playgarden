// SPDX-License-Identifier: GPL-3.0-only
// One bounded desktop/mobile journey; no whole-campaign proof and no state injection.
import {expect,test,type Frame,type Page,type CDPSession} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {captureErrors} from './helpers';
const FRAME='iframe[title="ONOFF 原版游戏"]';
type Snapshot={level:number;total:number;ready:boolean;paused:boolean;disposed:boolean;won:boolean;frames:number;time:number;deaths:number;on:boolean;phase:string;guy:{x:number;y:number;vx:number;vy:number;hidden:boolean};held:string[];audio:{state:string;muted:boolean;gesture:boolean;started:boolean}};
async function frame(page:Page):Promise<Frame>{const handle=await page.locator(FRAME).elementHandle();const value=await handle?.contentFrame();if(!value)throw Error('Missing ONOFF iframe');return value;}
async function read(page:Page):Promise<Snapshot>{return (await frame(page)).evaluate(()=>(window as unknown as {__onoffSnapshot:()=>Snapshot}).__onoffSnapshot());}
async function ready(page:Page,level=0){await expect(page.locator('.onoff-host')).toHaveAttribute('data-onoff-ready','true');await expect.poll(async()=>(await read(page)).level).toBe(level);}
async function select(page:Page,level:number){await page.getByLabel('选择关卡',{exact:true}).selectOption(String(level));await ready(page,level);}
async function credits(page:Page):Promise<number[]>{return page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')??'{}').completed?.onoff??[]);}
async function open(page:Page){await page.goto('/');await page.getByRole('textbox',{name:'搜索游戏'}).fill('ONOFF');await page.locator('.game-card').filter({hasText:'ONOFF'}).getByRole('button',{name:/开始玩/}).click();}
const keyNames:Record<string,string>={left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',toggle:'Space'};
function controls(page:Page,mobile:boolean,cdp:CDPSession){
 let held:string[]=[];
 async function release(){if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else for(const action of held)await page.keyboard.up(keyNames[action]);held=[];}
 async function hold(actions:string[]){
  await release();await page.locator(FRAME).scrollIntoViewIfNeeded();
  if(mobile){const points=[];for(const [id,action]of actions.entries()){
   const bounds=await (await frame(page)).locator(`[data-action="${action}"]`).boundingBox();if(!bounds)throw Error('Missing touch control');
   points.push({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,id:id+1});
  }await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});}
  else{await (await frame(page)).locator('#status').click();for(const action of actions)await page.keyboard.down(keyNames[action]);}
  held=actions;
 }
 async function tapToggle(){if(mobile)await (await frame(page)).getByRole('button',{name:'切换明暗',exact:true}).tap();else{await (await frame(page)).locator('#status').click();await page.keyboard.press('Space');}}
 return {hold,release,tapToggle};
}
async function until(page:Page,predicate:string,timeout=10000){await (await frame(page)).waitForFunction(`(() => {const s=window.__onoffSnapshot(); return ${predicate};})()`,undefined,{polling:'raf',timeout});}

test('ONOFF: earned jumps, layer changes, touch controls and owned lifecycle',async({page},info)=>{
 test.setTimeout(120000);
 const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[],receipts:unknown[]=[];
 page.on('request',request=>{if(!['localhost','127.0.0.1'].includes(new URL(request.url()).hostname))outside.push(request.url());});
 const cdp=await page.context().newCDPSession(page),input=controls(page,mobile,cdp);
 try{
  await page.route('**/games/onoff/runtime.js',route=>route.abort('failed'));
  await open(page);await expect(page.getByRole('alert')).toContainText('游戏资源未能启动',{timeout:15000});
  await page.screenshot({path:info.outputPath('onoff-startup-failure.png'),fullPage:true});
  await page.unroute('**/games/onoff/runtime.js');await page.getByRole('button',{name:'重试载入 ONOFF',exact:true}).click();await ready(page);
  expect(await credits(page)).toEqual([]);
  expect(await (await frame(page)).evaluate(()=>{try{void parent.document;return false;}catch{return true;}})).toBe(true);
  // Real native failure and retry, earned only by walking into the gap.
  await input.hold(['right']);await until(page,'s.deaths >= 1');await input.release();await until(page,"s.phase === 'playing'");
  expect(await credits(page)).toEqual([]);await page.getByRole('button',{name:'重试本关',exact:true}).click();
  // Level 1: approach gap, jump, release jump after crossing, walk to star.
  await input.hold(['right']);await until(page,'s.guy.x >= 270');
  await input.hold(['right','jump']);await until(page,'s.guy.x >= 456');
  await input.hold(['right']);await until(page,'s.won');await input.release();
  expect(await credits(page)).toEqual([0]);receipts.push({case:'earned first gap',state:await read(page)});
  await page.screenshot({path:info.outputPath('onoff-earned-first-gap.png'),fullPage:true});
  // Level 2: three real layer switches and drops.
  await select(page,1);await until(page,'s.guy.y >= 51 && s.guy.vy === 0');
  await input.tapToggle();await until(page,'s.guy.y >= 168 && s.guy.vy === 0');expect((await read(page)).on).toBe(false);
  await input.tapToggle();await until(page,'s.guy.y >= 284 && s.guy.vy === 0');expect((await read(page)).on).toBe(true);
  await input.tapToggle();await until(page,'s.guy.y >= 400 && s.guy.vy === 0');
  await input.hold(['right']);await until(page,'s.won');await input.release();
  expect(await credits(page)).toEqual([0,1]);receipts.push({case:'earned three layer drops',state:await read(page)});
  await page.screenshot({path:info.outputPath('onoff-earned-layer-drops.png'),fullPage:true});
  // Level 3: light-platform jump, midair switch, dark-platform landing.
  await select(page,2);await input.hold(['right']);await until(page,'s.guy.x >= 270');
  await input.hold(['right','jump']);await until(page,'s.guy.x >= 330');
  if(mobile)await input.hold(['right','jump','toggle']);else await page.keyboard.press('Space');
  await until(page,'s.guy.x >= 456');await input.hold(['right']);await until(page,'s.won');await input.release();
  expect(await credits(page)).toEqual([0,1,2]);receipts.push({case:'earned midair layer switch',state:await read(page)});
  await page.screenshot({path:info.outputPath('onoff-earned-midair-switch.png'),fullPage:true});
  await select(page,24);expect((await read(page)).won).toBe(false);expect(await credits(page)).toEqual([0,1,2]);
  await page.screenshot({path:info.outputPath('onoff-final-spike-layout-unearned.png'),fullPage:true});
  // Safe floor for interruption and audio checks.
  await select(page,1);await until(page,'s.guy.vy === 0');
  const enable=page.getByRole('button',{name:'开启声音',exact:true});if(await enable.count())await enable.click();
  await input.hold(['left']);await page.waitForTimeout(100);await input.release();
  await expect.poll(async()=>(await read(page)).audio.state).toBe('running');
  await page.locator('.game-toolbar').getByRole('button',{name:'暂停',exact:true}).click();
  await expect.poll(async()=>(await read(page)).paused).toBe(true);await expect.poll(async()=>(await read(page)).audio.state).toBe('suspended');
  const frozen=await read(page);await page.waitForTimeout(250);const still=await read(page);
  expect(still.frames).toBe(frozen.frames);expect(still.time).toBe(frozen.time);expect(still.held).toEqual([]);
  await page.getByRole('button',{name:'继续游戏',exact:true}).click();await until(page,'!s.paused');
  await page.getByRole('button',{name:'静音',exact:true}).click();await expect.poll(async()=>(await read(page)).audio.state).toBe('suspended');
  await input.hold(['left']);await page.waitForTimeout(100);
  if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else await page.keyboard.up('ArrowLeft');
  await input.release();await expect.poll(async()=>(await read(page)).held.length).toBe(0);
  const cancelled=(await read(page)).guy.x;await page.waitForTimeout(150);expect((await read(page)).guy.x).toBe(cancelled);
  await (await frame(page)).evaluate(()=>{parent.postMessage({source:'playgarden-onoff',revision:'onoff-cb1e2e4-playgarden-1',session:'stale',type:'complete',level:24},'*');window.postMessage({source:'playgarden-host',session:'stale',type:'command',action:'reset'},'*');});
  expect(await credits(page)).toEqual([0,1,2]);
  await page.screenshot({path:info.outputPath('onoff-controls-and-lifecycle.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();await expect(page.locator(FRAME)).toHaveCount(0);
  await page.getByRole('textbox',{name:'搜索游戏'}).fill('ONOFF');await page.locator('.game-card').filter({hasText:'ONOFF'}).getByRole('button',{name:/开始玩/}).click();
  await expect(page.locator('.onoff-host')).toHaveAttribute('data-onoff-ready','true');expect((await read(page)).deaths).toBe(0);
  expect(await credits(page)).toEqual([0,1,2]);expect(outside).toEqual([]);expect(errors).toEqual([]);
  writeFileSync(info.outputPath('onoff-earned-receipts.json'),JSON.stringify({project:info.project.name,upstream:'cb1e2e4615af6195aeb0dade06c08738511dd3b6',receipts,final:await read(page)},null,2));
 }finally{await input.release().catch(()=>{});await cdp.detach();}
});
