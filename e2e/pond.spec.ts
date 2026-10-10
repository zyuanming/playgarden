// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type CDPSession} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import type {PondSnapshot,PondFishSnapshot} from '../src/vendor/pondCore';
type Read=PondSnapshot&{paused:boolean;best:number;held:{direction:{x:number;y:number}|null;keys:string[]}};
const read=(page:Page)=>page.evaluate(()=>{const f=(window as unknown as {__pondRead?:()=>Read}).__pondRead;if(!f)throw Error('Missing live pond observer');return f();});
function distance(a:{x:number;y:number},b:{x:number;y:number}){return Math.hypot(a.x-b.x,a.y-b.y);}
function segmentDistance(p:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number}){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function choose(s:Read,larger=false):{x:number;y:number}{
 const live=s.fish.filter(f=>f.AI&&!f.dying&&!f.dead),bad=live.filter(f=>f.size>=s.player.size),targets=live.filter(f=>larger?f.size>s.player.size+.2:f.size<s.player.size-.5);
 let target:PondFishSnapshot|undefined,cost=Infinity;
 for(const f of targets){let value=distance(f,s.player);if(!larger)for(const b of bad){const d=segmentDistance(b,s.player,f);if(d<(b.size+s.player.size)*3)value+=500+(b.size+s.player.size)*3-d;}if(value<cost){cost=value;target=f;}}
 if(target)return{x:target.x-s.player.x+target.velocity[0]*8,y:target.y-s.player.y+target.velocity[1]*8};
 const nearest=bad.sort((a,b)=>distance(a,s.player)-distance(b,s.player))[0];return nearest?{x:s.player.x-nearest.x,y:s.player.y-nearest.y}:{x:1,y:0};
}
test('real prey absorption, color progress, loss and pointer lifecycle',async({page},info)=>{
 test.setTimeout(260000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[],runs:unknown[]=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 // Reproducible original random stream. No state setters, spawned fixtures or forced outcomes.
 await page.addInitScript(()=>{let seed=1622026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await openGame(page,'彩游池塘');await page.evaluate(()=>localStorage.setItem('playgarden.pond-unrelated','keep'));
 const board=page.locator('.pond-board canvas');let cdp:CDPSession|undefined;if(mobile)cdp=await page.context().newCDPSession(page);let held=false;
 const release=async()=>{if(!held)return;if(mobile)await cdp!.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();held=false;};
 const steer=async(v:{x:number;y:number},ms=130)=>{
  await board.scrollIntoViewIfNeeded();const b=await board.boundingBox();if(!b)throw Error('Missing pond canvas');const len=Math.hypot(v.x,v.y)||1,px=b.x+b.width/2+v.x/len*b.width*.38,py=b.y+b.height/2+v.y/len*b.height*.38;
  if(mobile){await cdp!.send('Input.dispatchTouchEvent',{type:held?'touchMove':'touchStart',touchPoints:[{x:px,y:py,id:1}]});}
  else{await page.mouse.move(px,py);if(!held)await page.mouse.down();}held=true;await page.waitForTimeout(ms);
 };
 await page.screenshot({path:info.outputPath('pond-original-start.png'),fullPage:true});
 await page.getByRole('button',{name:'开始游动',exact:true}).click();const first=await read(page);await steer({x:1,y:0},250);await release();const moved=await read(page);expect(distance(moved.player,first.player)).toBeGreaterThan(1);expect(moved.held.direction).toBeNull();
 await page.getByRole('button',{name:'暂停',exact:true}).click();const stopped=await read(page);await page.waitForTimeout(550);const still=await read(page);expect(still.frame).toBe(stopped.frame);expect(still.time).toBe(stopped.time);expect(still.player.x).toBe(stopped.player.x);
 await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.locator('.pond-game').focus();
 if(!mobile){const beforeKey=await read(page);await page.keyboard.down('ArrowUp');await page.waitForTimeout(160);const afterKey=await read(page);expect(afterKey.held.keys).toContain('ArrowUp');expect(afterKey.player.dir).not.toBe(beforeKey.player.dir);await page.keyboard.up('ArrowUp');expect((await read(page)).held.keys).toEqual([]);await page.keyboard.down('Shift');await page.keyboard.down('w');await page.keyboard.up('Shift');await page.keyboard.up('w');expect((await read(page)).held.keys).toEqual([]);}
 let s=await read(page),started=Date.now(),attempt=1;
 // Play normally with the real controls, preserving any failed attempts in the report.
 while(Date.now()-started<125000&&(s.metrics.barTransfers<1||s.metrics.absorbedParticles<1)){
  if(s.phase==='gameover'){await release();runs.push({attempt,phase:s.phase,metrics:s.metrics});if(attempt>=3)throw Error('Three real seeded feeding attempts failed; retain evidence.');attempt++;await page.getByRole('button',{name:'再游一次',exact:true}).click();}
  else if(s.phase==='playing')await steer(choose(s));else{await release();await page.waitForTimeout(150);}s=await read(page);
 }
 await release();expect(s.metrics.playerKills).toBeGreaterThan(0);expect(s.metrics.absorbedColors).toBeGreaterThan(0);expect(s.metrics.absorbedParticles).toBeGreaterThan(0);expect(s.metrics.barTransfers).toBeGreaterThanOrEqual(1);expect(s.player.size).toBeGreaterThan(20);
 const earned=s.player.size;await page.screenshot({path:info.outputPath('pond-earned-color-growth.png'),fullPage:true});
 const lossStart=Date.now();while(Date.now()-lossStart<65000&&s.phase!=='gameover'){
  if(s.phase==='playing')await steer(choose(s,true));else{await release();await page.waitForTimeout(150);}s=await read(page);
 }
 await release();expect(s.metrics.deaths).toBe(1);expect(s.phase).toBe('gameover');runs.push({attempt,phase:s.phase,metrics:s.metrics,best:s.best});
 await page.screenshot({path:info.outputPath('pond-real-larger-fish-loss.png'),fullPage:true});
 await page.getByRole('button',{name:'再游一次',exact:true}).click();expect((await read(page)).metrics.playerKills).toBe(0);expect((await read(page)).player.size).toBe(20);
 await steer({x:-1,y:0},100);
 if(mobile){await cdp!.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});held=false;expect((await read(page)).held.direction).toBeNull();}
 else{await page.mouse.move(2,2);await release();expect((await read(page)).held.direction).toBeNull();}
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=await read(page);await page.waitForTimeout(350);expect((await read(page)).frame).toBe(blurred.frame);await expect(page.getByRole('button',{name:'继续游动',exact:true})).toBeVisible();await page.getByRole('button',{name:'继续游动',exact:true}).click();
 await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();expect(await page.evaluate(()=>typeof(window as unknown as Record<string,unknown>).__pondRead)).toBe('undefined');
 const saved=await page.evaluate(()=>localStorage.getItem('playgarden.pond.best-size.v1'));await page.waitForTimeout(400);expect(await page.evaluate(()=>localStorage.getItem('playgarden.pond.best-size.v1'))).toBe(saved);
 await openGame(page,'彩游池塘');expect((await read(page)).best).toBeGreaterThanOrEqual(earned);expect(await page.evaluate(()=>localStorage.getItem('playgarden.pond-unrelated'))).toBe('keep');
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('pond-320px-persisted-best.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);
 await info.attach('pond-seeded-journey',{body:JSON.stringify({seed:1622026,runs},null,2),contentType:'application/json'});
});
