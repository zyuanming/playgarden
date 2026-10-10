// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type CDPSession} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import type {AsteroidsSnapshot} from '../src/vendor/asteroidsCore';
type Read=AsteroidsSnapshot&{input:{left:boolean;right:boolean;thrust:boolean;fire:boolean};paused:boolean;frames:number;best:number};
type Action='left'|'right'|'thrust'|'fire';
const read=(page:Page)=>page.evaluate(()=>{const f=(window as unknown as {__asteroidsRead?:()=>Read}).__asteroidsRead;if(!f)throw Error('Missing live game observer');return f();});
const wrap=(n:number,size:number)=>((n+size/2)%size+size)%size-size/2;
function aim(s:Read,intercept:boolean){
 let target:{x:number;y:number;vx:number;vy:number}|undefined,best=Infinity;
 for(const a of s.asteroids){const d=Math.hypot(wrap(a.x-s.ship.x,780),wrap(a.y-s.ship.y,540));if(d<best){target=a;best=d;}}
 if(!target)return{angle:0,distance:Infinity};
 let x=wrap(target.x-s.ship.x,780),y=wrap(target.y-s.ship.y,540);
 if(intercept){const vx=target.vx-s.ship.vx,vy=target.vy-s.ship.vy,A=vx*vx+vy*vy-36,B=2*(x*vx+y*vy),C=x*x+y*y,D=B*B-4*A*C;let t=0;if(D>=0&&Math.abs(A)>1e-8){const candidates=[(-B+Math.sqrt(D))/(2*A),(-B-Math.sqrt(D))/(2*A)].filter(v=>v>0&&v<50);if(candidates.length)t=Math.min(...candidates);}x+=vx*t;y+=vy*t;}
 return {angle:wrap(Math.atan2(y,x)*180/Math.PI+90-s.ship.rotation,360),distance:best};
}
test('real inertial combat, split score, three losses, pause, controls and saved best',async({page},info)=>{
 test.setTimeout(240000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 // Fixed, disclosed random stream. No game state setter, kill button or winner injection.
 await page.addInitScript(()=>{let seed=1592026;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};});
 await openGame(page,'小行星航场');await page.evaluate(()=>localStorage.setItem('playgarden.asteroids-unrelated','keep'));
 let cdp:CDPSession|undefined;if(mobile)cdp=await page.context().newCDPSession(page);
 const names={left:'左转',right:'右转',thrust:'推进',fire:'开火'},keys={left:'ArrowLeft',right:'ArrowRight',thrust:'ArrowUp',fire:'Space'};
 const hold=async(actions:Action[],ms:number)=>{
  if(mobile){await page.locator('.ast-controls').scrollIntoViewIfNeeded();const points=[];for(let i=0;i<actions.length;i++){const b=await page.getByRole('button',{name:names[actions[i]],exact:true}).boundingBox();if(!b)throw Error('Missing touch control');const viewport=page.viewportSize()!;expect(b.x+b.width/2).toBeGreaterThan(0);expect(b.x+b.width/2).toBeLessThan(viewport.width);expect(b.y+b.height/2).toBeGreaterThan(0);expect(b.y+b.height/2).toBeLessThan(viewport.height);points.push({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1});}if(points.length)await cdp!.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await page.waitForTimeout(ms);if(points.length)await cdp!.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{for(const a of actions)await page.keyboard.down(keys[a]);await page.waitForTimeout(ms);for(const a of actions)await page.keyboard.up(keys[a]);}
 };
 await page.getByRole('button',{name:'开始飞行',exact:true}).click();await expect(page.locator('.ast-game')).toHaveAttribute('data-ast-phase','playing');
 await page.screenshot({path:info.outputPath('asteroids-original-start.png'),fullPage:true});
 const start=await read(page);await hold(['thrust'],250);const moved=await read(page);expect(Math.hypot(moved.ship.vx,moved.ship.vy)).toBeGreaterThan(0);expect(Math.hypot(moved.ship.x-start.ship.x,moved.ship.y-start.ship.y)).toBeGreaterThan(1);
 await hold(['left','fire'],200);const fired=await read(page);expect(fired.metrics.shots).toBeGreaterThan(0);expect(fired.ship.rotation).not.toBe(moved.ship.rotation);expect(Object.values(fired.input).every(v=>!v)).toBe(true);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const stopped=await read(page);await page.waitForTimeout(650);const still=await read(page);expect(still.elapsedMs).toBe(stopped.elapsedMs);expect(still.frames).toBe(stopped.frames);expect(still.ship.x).toBe(stopped.ship.x);await expect(page.getByRole('button',{name:'推进',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'继续游戏',exact:true}).click();await page.locator('.ast-game').focus();
 if(!mobile){await page.keyboard.down('ArrowLeft');await page.keyboard.down('a');await page.keyboard.up('ArrowLeft');expect((await read(page)).input.left).toBe(true);await page.keyboard.down('Control');await page.keyboard.up('a');await page.keyboard.up('Control');expect((await read(page)).input.left).toBe(false);}
 const combatStart=Date.now();let s=await read(page);
 while(Date.now()-combatStart<60000&&(s.score<=0||s.metrics.splitEvents===0)){
  if(s.phase==='gameover'||s.phase==='waiting')throw Error('Lost before earning a real split; retain this seed failure.');
  if(!s.ship.visible){await page.waitForTimeout(80);s=await read(page);continue;}
  const a=aim(s,true),turn:Action[]=Math.abs(a.angle)>7?[a.angle<0?'left':'right']:[];
  await hold([...turn,'fire'],Math.abs(a.angle)>7?Math.min(110,Math.max(25,Math.abs(a.angle)*4)):90);s=await read(page);
 }
 expect(s.score).toBeGreaterThan(0);expect(s.metrics.hits).toBeGreaterThan(0);expect(s.metrics.splitEvents).toBeGreaterThan(0);
 const earned=s.score;expect(Number(await page.evaluate(()=>localStorage.getItem('playgarden.asteroids.best.v1')))).toBeGreaterThanOrEqual(earned);
 await page.screenshot({path:info.outputPath('asteroids-earned-split-score.png'),fullPage:true});
 // Deliberately steer into real rocks through the same player controls. No fixture writes.
 const lossStart=Date.now();while(Date.now()-lossStart<115000&&s.metrics.deaths<3){
  if(s.ship.visible){const a=aim(s,false),actions:Action[]=[];if(Math.abs(a.angle)>12)actions.push(a.angle<0?'left':'right');if(Math.abs(a.angle)<70||a.distance>160)actions.push('thrust');await hold(actions,Math.min(120,Math.max(35,Math.abs(a.angle)*4)));}
  else await page.waitForTimeout(80);s=await read(page);
 }
 expect(s.metrics.deaths).toBe(3);expect(s.lives).toBe(0);expect(s.phase).toBe('gameover');
 await page.screenshot({path:info.outputPath('asteroids-real-three-life-gameover.png'),fullPage:true});
 await page.getByRole('button',{name:'再飞一次',exact:true}).click();await expect.poll(async()=>(await read(page)).lives).toBe(3);expect((await read(page)).score).toBe(0);expect((await read(page)).metrics.deaths).toBe(0);
 if(mobile){await page.locator('.ast-controls').scrollIntoViewIfNeeded();const b=await page.getByRole('button',{name:'开火',exact:true}).boundingBox();await cdp!.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b!.x+b!.width/2,y:b!.y+b!.height/2,id:8}]});await cdp!.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect((await read(page)).input.fire).toBe(false);}
 else{await page.keyboard.down('Space');await page.getByRole('button',{name:'提示',exact:true}).focus();expect((await read(page)).input.fire).toBe(false);await page.keyboard.up('Space');}
 await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();expect(await page.evaluate(()=>typeof(window as unknown as Record<string,unknown>).__asteroidsRead)).toBe('undefined');
 await openGame(page,'小行星航场');expect((await read(page)).best).toBeGreaterThanOrEqual(earned);expect(await page.evaluate(()=>localStorage.getItem('playgarden.asteroids-unrelated'))).toBe('keep');
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('asteroids-320px-saved-best.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);
});
