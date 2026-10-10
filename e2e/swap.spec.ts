// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type TestInfo,type CDPSession} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
import type {SwapSnapshot,SwapDirection} from '../src/vendor/swapState';
type View=SwapSnapshot&{paused:boolean};
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {__swapRead:()=>View}).__swapRead());
async function controller(page:Page,info:TestInfo){
 const mobile=info.project.name==='mobile',cdp:CDPSession|null=mobile?await page.context().newCDPSession(page):null;
 let held:SwapDirection|null=null;
 let touchPoints:Record<string,{x:number;y:number}>|null=null;
 // Read visible control geometry once, before a gesture. Re-locating every turn lets
 // the real-time puzzle advance while a stale steering decision waits on scrolling.
 async function prepareTouch(){
  if(!cdp||touchPoints)return;
  const controls=page.locator('.sw-controls');await controls.scrollIntoViewIfNeeded();
  touchPoints=await controls.locator('[data-sw-direction],.sw-swap').evaluateAll(buttons=>Object.fromEntries(buttons.map(button=>{
   const r=button.getBoundingClientRect(),name=button.getAttribute('data-sw-direction')??'swap';
   if(r.width===0||r.height===0||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth)throw Error(`Control ${name} is outside the viewport`);
   return [name,{x:r.x+r.width/2,y:r.y+r.height/2}];
  })));
 }
 const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
 const act=async(name:string)=>{touchPoints=null;const b=page.getByRole('button',{name,exact:true});if(mobile)await b.tap();else await b.click();};
 async function release(cancel=false){if(!held)return;if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});else await page.keyboard.up(key[held]);held=null;}
 async function hold(d:SwapDirection|null){if(held===d)return;if(d)await prepareTouch();await release();if(!d)return;if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoints![d]]});}else{await page.locator('.sw-stage').focus();await page.keyboard.down(key[d]);}held=d;}
 async function ticks(n=1,observed?:View){const s=observed??await read(page);if(s.result!=='playing')return;await page.waitForFunction(({tick})=>{const v=(window as unknown as {__swapRead:()=>View}).__swapRead();return v.result!=='playing'||v.ticks>=tick;},{tick:s.ticks+n},{polling:'raf',timeout:10000});}
 async function move(axis:'x'|'y',cell:number){
  await prepareTouch();
  const start=await read(page),id=start.actors[0].id,target=(cell+.5)*start.gridSize;let settling=false;
  for(let frames=0;frames<420;frames++){
   const s=await read(page);if(s.result==='won'){await release();return;}expect(s.result).toBe('playing');expect(s.actors[0].id).toBe(id);
   const v=axis==='x'?s.motion.vx:s.motion.vy,error=target-s.actors[0][axis];
   if(Math.abs(error)<3&&Math.abs(v)<.08){await release();return;}
   const coast=error-v/.6;
   if(settling&&Math.abs(v)<.08)settling=false;
   // Let the original friction finish braking before correcting an overshoot.
   // The coast and settled-position tolerances are the same physical 3 pixels.
   if(Math.abs(coast)<3||v*error>0&&Math.sign(coast)!==Math.sign(error))settling=true;
   await hold(settling?null:axis==='x'?coast>0?'right':'left':coast>0?'down':'up');await ticks(1,s);
  }
  await release();throw Error(`Could not reach original coordinate ${axis}=${cell}`);
 }
 return {act,hold,release,ticks,move,swap:async()=>{await prepareTouch();await release();if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoints!.swap]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else await act('⇄ 切换伙伴');},start:async()=>{await act('开始行动');await prepareTouch();},dispose:async()=>{await release();await cdp?.detach();}};
}

test('original first maps: earned goal, saves, inertial controls, cancellation, failure and unload',async({page},info)=>{
 test.setTimeout(180000);const errors=captureErrors(page),outside:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 await openGame(page,'伙伴换位');await chooseLevel(page,0);const c=await controller(page,info),game=page.locator('.sw-game');
 await expect(page.getByLabel('选择关卡',{exact:true}).locator('option')).toHaveCount(24);await page.evaluate(()=>localStorage.setItem('playgarden.swap-unrelated','keep'));
 await c.start();await c.move('x',4);await c.act('暂停');const frozen=await read(page);await page.waitForTimeout(220);expect((await read(page)).ticks).toBe(frozen.ticks);expect((await read(page)).held).toEqual([]);await expect(page.getByLabel('向右移动',{exact:true})).toBeDisabled();await c.act('继续游戏');
 await c.hold('right');await c.ticks(3);await c.release(true);await c.ticks(15);expect((await read(page)).held).toEqual([]);await c.move('x',4);
 const stored=await read(page);await page.reload();await openGame(page,'伙伴换位');await chooseLevel(page,0);const restored=await read(page);expect(restored.started).toBe(false);expect(restored.actors[0].x).toBeCloseTo(stored.actors[0].x,0);await c.start();
 await c.move('x',8);await c.move('y',1);await expect(game).toHaveAttribute('data-sw-result','won');await expect(page.locator('.status')).toHaveClass(/success/);await page.screenshot({path:info.outputPath('swap-original-first-earned-goal.png'),fullPage:true});
 await chooseLevel(page,1);await c.start();await c.hold('up');await expect(game).toHaveAttribute('data-sw-result','lost',{timeout:10000});await c.release();expect((await read(page)).deaths).toBe(1);await c.act('重新尝试');await expect(game).toHaveAttribute('data-sw-started','false');expect((await read(page)).actors[0].y/(await read(page)).gridSize).toBe(8.5);
 await chooseLevel(page,3);await c.start();const unmoved=(await read(page)).actors[0];await expect(game).toHaveAttribute('data-sw-result','lost',{timeout:10000});const death=await read(page);expect(death.actors[0].x).toBe(unmoved.x);expect(death.actors[0].y).toBe(unmoved.y);expect(death.actors[1].type).toBe(-2);await page.screenshot({path:info.outputPath('swap-uncontrolled-partner-causes-failure.png'),fullPage:true});
 await chooseLevel(page,2);await c.start();const before=(await read(page)).actors[0].id;await c.swap();expect((await read(page)).actors[0].id).not.toBe(before);await c.move('x',8);await c.move('y',1);await expect(game).toHaveAttribute('data-sw-result','won');
 await chooseLevel(page,18);await c.start();await c.hold('left');await c.ticks(35);await c.release();const barrier=await read(page);expect(barrier.actors[0].x/barrier.gridSize).toBeGreaterThan(5.8);expect(barrier.actors[1].x/barrier.gridSize).toBeGreaterThan(5);await page.screenshot({path:info.outputPath('swap-original-blue-barrier-and-autonomous-crossing.png'),fullPage:true});
 // Browser blur cancels a held physical pointer/key and requires explicit resume.
 await c.hold('right');await c.ticks(2);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await c.release();const blurred=await read(page);await page.waitForTimeout(150);expect((await read(page)).ticks).toBe(blurred.ticks);expect(blurred.held).toEqual([]);await c.act('继续行动');
 await c.act('返回游戏大厅');expect(await page.evaluate(()=>('__swapRead'in window))).toBe(false);await openGame(page,'伙伴换位');await chooseLevel(page,18);expect((await read(page)).started).toBe(false);expect(await page.evaluate(()=>localStorage.getItem('playgarden.swap-unrelated'))).toBe('keep');
 // A malformed scoped save is ignored without touching an unrelated application's data.
 await c.act('返回游戏大厅');await page.evaluate(()=>localStorage.setItem('playgarden.swap.v1.18','{"version":1,"level":18,"actors":[{"x":null}]}'));await openGame(page,'伙伴换位');await chooseLevel(page,18);const reset=await read(page);expect(reset.ticks).toBe(0);expect(reset.actors[0].x/reset.gridSize).toBe(7.5);expect(await page.evaluate(()=>localStorage.getItem('playgarden.swap-unrelated'))).toBe('keep');
 if(info.project.name==='mobile'){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('swap-320px-reentry.png'),fullPage:true});}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);await c.dispose();
});

test('original middle level 14: a real pressure plate frees an autonomous partner to the goal',async({page},info)=>{
 test.setTimeout(120000);const errors=captureErrors(page);await openGame(page,'伙伴换位');await chooseLevel(page,13);const c=await controller(page,info),game=page.locator('.sw-game');await c.start();
 const initial=await read(page);expect(initial.actors.length).toBe(6);expect(initial.actors[0].type).toBe(-1);expect(initial.actors.slice(1).every(a=>a.type===-3)).toBe(true);
 // Stay in column 3, then enter only plate14 at (1,3). Other plates open lava gates.
 await c.move('y',3);await page.screenshot({path:info.outputPath('swap-original-middle-six-partners.png'),fullPage:true});await c.move('x',1);
 await expect(game).toHaveAttribute('data-sw-result','won',{timeout:10000});const won=await read(page);expect(won.gates.find(g=>g.x===8&&g.y===7)?.open).toBe(true);expect(won.actors[0].x/won.gridSize).toBeLessThan(2.5);expect(won.actors[0].y/won.gridSize).toBeLessThan(4);expect(won.actors.slice(1).some(a=>a.y/won.gridSize>7&&a.x/won.gridSize>8.5)).toBe(true);
 await expect(page.locator('.status')).toHaveClass(/success/);await page.screenshot({path:info.outputPath('swap-middle-autonomous-earned-goal.png'),fullPage:true});await c.dispose();expect(errors).toEqual([]);
});

test('original final level 24: two left-turn partners, six gates, and actual credits-ending win',async({page},info)=>{
 test.setTimeout(240000);const errors=captureErrors(page);await openGame(page,'伙伴换位');await chooseLevel(page,23);const c=await controller(page,info),game=page.locator('.sw-game');await c.start();
 const initial=await read(page),A=initial.actors[0].id,B=initial.actors[1].id;expect(initial.actors.map(a=>a.type)).toEqual([-5,-5]);
 const body=(s:View,id:number)=>s.actors.find(a=>a.id===id)!;
 async function until(predicate:(s:View)=>boolean,label:string){await expect.poll(async()=>{const s=await read(page);expect(s.result,`${label}: no actor may touch lava`).not.toBe('lost');return predicate(s);},{message:label,timeout:20000,intervals:[16]}).toBe(true);}
 const downwardAtFour=(s:View,id:number)=>{const a=body(s,id);return a.vx===0&&a.vy===7&&a.x/s.gridSize>4.1&&a.x/s.gridSize<4.8&&a.y/s.gridSize<2.6;};
 const onUpperEleven=(s:View,id:number)=>{const a=body(s,id);return a.vx===7&&a.y/s.gridSize>3.2&&a.y/s.gridSize<3.8&&a.x/s.gridSize>10.7;};
 const onLowerEleven=(s:View,id:number)=>{const a=body(s,id);return a.vx===7&&a.y/s.gridSize>11.2&&a.x/s.gridSize>2.7;};
 const atThirteen=(s:View,id:number)=>{const a=body(s,id);return a.vx===-7&&a.y/s.gridSize>10.2&&a.y/s.gridSize<10.8&&a.x/s.gridSize>4.95&&a.x/s.gridSize<5.75;};
 // A holds upper10. B autonomously crosses20 and the three blue tiles, then turns south.
 await c.move('y',2);await until(s=>downwardAtFour(s,B),'B turns down after crossing the first blue divide');await c.swap();expect((await read(page)).actors[0].id).toBe(B);
 await c.move('x',4);await c.move('y',3);await c.move('x',7);
 // Capture A while it is physically occupying11; B retains its southbound AI direction.
 await until(s=>onUpperEleven(s,A),'A arrives on upper11');await c.swap();expect((await read(page)).actors[0].id).toBe(A);await c.move('x',11);await until(s=>body(s,B).y/s.gridSize>5.6,'B clears21 while A holds11');await c.move('y',1);
 await until(s=>{const b=body(s,B);return b.x/s.gridSize>11&&b.y/s.gridSize<8.6;},'B crosses opened22');
 // Give A a safe east-facing release point, then capture B on the lower10 plate.
 await c.move('y',3);
 await until(s=>{const b=body(s,B);return b.vx===-7&&b.y/s.gridSize>9.2&&b.y/s.gridSize<9.8&&b.x/s.gridSize>2&&b.x/s.gridSize<2.9;},'B reaches lower10 after the full autonomous blue loop');await c.swap();expect((await read(page)).actors[0].id).toBe(B);await c.move('x',2);
 await until(s=>downwardAtFour(s,A),'A crosses20 and turns down');await c.swap();expect((await read(page)).actors[0].id).toBe(A);await c.move('x',4);await c.move('y',3);await c.move('x',7);
 // B now loops through the lower plates. Capture it on11, then move across row11 to12.
 await until(s=>onLowerEleven(s,B),'B occupies lower11');await c.swap();expect((await read(page)).actors[0].id).toBe(B);await until(s=>body(s,A).y/s.gridSize>5.6,'A clears21 while B holds11');await c.move('x',1);
 await until(s=>atThirteen(s,A),'A finishes the original right-side blue loop at13');await c.swap();expect((await read(page)).actors[0].id).toBe(A);
 // Park west-facing A in (5,11). Three real wall collisions rotate its autonomous direction north.
 await c.move('x',5);await c.move('y',11);
 await until(s=>{const b=body(s,B);return b.vy===7&&b.x/s.gridSize<1.8&&b.y/s.gridSize>9.9&&b.y/s.gridSize<10.6;},'B arrives on15');await c.swap();expect((await read(page)).actors[0].id).toBe(B);
 // Straddle14/15 at y=9.75 cells; this legitimately holds15 with a short release distance.
 await c.move('y',9.25);
 await until(s=>{const a=body(s,A);return a.vx===-7&&a.y/s.gridSize>5.2&&a.y/s.gridSize<5.8&&a.x/s.gridSize<3.5&&s.gates.find(g=>g.x===2&&g.y===5)?.touching===true;},'A occupies gate25, holding it open');
 // Release15 while the gate is occupied. It closes after A exits, becoming the wall that turns A north.
 await c.move('y',9);await expect(game).toHaveAttribute('data-sw-result','won',{timeout:15000});const won=await read(page);expect(won.deaths).toBe(0);
 // Upstream world.collide checks four corners inset 5px, so the first real goal
 // contact occurs before the actor's center enters the goal cell (1,1).
 const goalActor=body(won,A),g=won.gridSize,radius=g/2-5;
 const contactCells=[-1,1].flatMap(dx=>[-1,1].map(dy=>({x:Math.round((goalActor.x+dx*radius-g/2)/g),y:Math.round((goalActor.y+dy*radius-g/2)/g)})));
 expect(contactCells).toContainEqual({x:1,y:1});expect(won.gates.find(g=>g.x===2&&g.y===5)?.open).toBe(false);
 await expect(page.locator('.sw-ending')).toBeVisible();await expect(page.locator('.sw-ending')).toContainText('Noah Moroze and Michael Yang');await expect(page.locator('.status')).toHaveClass(/success/);await page.screenshot({path:info.outputPath('swap-original-final-earned-credits.png'),fullPage:true});
 // Actual earned final state persists; selecting the last level alone never earns the ending.
 await c.act('返回游戏大厅');await openGame(page,'伙伴换位');await chooseLevel(page,23);await expect(game).toHaveAttribute('data-sw-result','won');await expect(page.locator('.sw-ending')).toBeVisible();await c.act('重置本关');await expect(game).toHaveAttribute('data-sw-result','playing');await expect(page.locator('.sw-ending')).toHaveCount(0);expect((await read(page)).actors[0].x/(await read(page)).gridSize).toBe(9.5);
 expect(errors).toEqual([]);await c.dispose();
});
