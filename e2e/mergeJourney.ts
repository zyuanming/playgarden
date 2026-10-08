// SPDX-License-Identifier: GPL-3.0-only
import {expect,type Page,type TestInfo} from "@playwright/test";
export const roundKey="playgarden.merge.v1.round.free",bestKey="playgarden.merge.v1.best";
export const motionBoard=[0,2,0,2,0,4,0,0,...Array(8).fill(0)];
export async function setMergeRound(page:Page,board=motionBoard,score=0){await page.evaluate(({key,board,score})=>localStorage.setItem(key,JSON.stringify({version:1,current:{board,score,seed:21,moves:0},history:[]})),{key:roundKey,board,score});}
export async function enterMerge(page:Page){await page.getByRole('textbox',{name:'搜索游戏'}).fill('2048');await page.getByRole('button',{name:'开始玩2048',exact:true}).click();await expect(page.locator('.merge-classic')).toBeVisible();await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);await expect(page.getByRole('group',{name:'游玩方式'})).toHaveCount(0);}
export async function freezeMerge(page:Page){
 // A fixed future pause avoids racing the host clock against the browser clock.
 await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
 await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
}
export async function settleMerge(page:Page,count=1){
 // React installs the next phase timer during its commit. Advance only after
 // observing that commit, instead of guessing one large fake-time interval.
 const game=page.locator('.merge-classic');
 for(let step=0;step<count*2+4;step++){
  const phase=await game.getAttribute('data-merge-phase');if(phase==='idle')return;
  expect(['sliding','settling']).toContain(phase);
  await page.clock.runFor(phase==='sliding'?150:110);
  await expect(game).not.toHaveAttribute('data-merge-phase',phase!);
 }
 await expect(game).toHaveAttribute('data-merge-phase','idle');
}
export async function mergeLayout(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);for(const button of await page.locator('.merge-controls button').all()){const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}await expect(page.locator('.module-error')).toHaveCount(0);}
export async function swipeMerge(page:Page,dx:number,dy:number){const b=(await page.locator('.merge-board').boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2,session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:0}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();}
/** Measure actual animated geometry at controlled Web Animation times, then save originals. */
export async function verifyMergeMotion(page:Page,info:TestInfo,prefix='merge'){
 await freezeMerge(page);
 await page.locator('.merge-board').scrollIntoViewIfNeeded();
 const origins=await page.locator('[data-tile-id]').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-tile-id'),x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
 const destination=(await page.locator('[data-merge-cell="0"]').boundingBox())!;
 // Playwright's JS clock does not stop native Web Animation time. Pause the
 // real translation at creation so a slow protocol roundtrip cannot finish it
 // before we select the exact 75 ms sample below. Never replace its keyframes.
 // CSS effects use the native animation clock too. Freeze only their play
 // state before creation; retain the production keyframes, duration and DOM.
 const cssPause=await page.addStyleTag({content:'.merge-classic .merge-tile-new,.merge-classic .merge-tile-merged{animation-play-state:paused!important}'});
 await page.evaluate(()=>{
  const native=Element.prototype.animate;
  (window as unknown as {mergeNativeAnimate:typeof native}).mergeNativeAnimate=native;
  Element.prototype.animate=function(keyframes,options){const animation=native.call(this,keyframes,options);if(this.matches('.merge-tile-position'))animation.pause();return animation;};
 });
 try {
 await page.locator('.merge-board').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('.merge-classic')).toHaveAttribute('data-merge-phase','sliding');
 const frames=await page.evaluate(()=>{
  const nodes=Array.from(document.querySelectorAll<HTMLElement>('.merge-tile-position'));
  return nodes.filter(n=>n.dataset.tileFrom!==n.dataset.tileTo).map(n=>{const a=n.getAnimations()[0];if(!a)throw new Error('Missing real tile translation animation');a.pause();a.currentTime=75;const b=n.getBoundingClientRect();return {id:n.dataset.tileId,x:b.x,y:b.y,transform:getComputedStyle(n).transform};});
 });
 expect(frames.length).toBeGreaterThanOrEqual(2);
 for(const id of ['2','4']){const source=origins.find(o=>o.id===id)!,frame=frames.find(f=>f.id===id)!;expect(frame.x).toBeGreaterThan(destination.x+.1);expect(frame.x).toBeLessThan(source.x-.1);expect(frame.transform).not.toBe('none');}
 await page.screenshot({path:info.outputPath(`${prefix}-slide-midpoint.png`),animations:'allow',fullPage:true});
 await page.clock.runFor(150);await expect(page.locator('.merge-tile-merged')).toHaveCount(1);
 // Reproduce a slow protocol roundtrip longer than the 180ms spawn effect.
 // This is host time, not the paused page JS clock.
 await new Promise(resolve=>setTimeout(resolve,250));
 const pop=await page.locator('.merge-tile-merged').evaluate(n=>{const a=n.getAnimations()[0];if(!a)throw new Error('Missing merge pop animation');a.pause();a.currentTime=75;return new DOMMatrixReadOnly(getComputedStyle(n).transform).a;});expect(pop).toBeGreaterThan(1.05);
 const spawn=await page.locator('.merge-tile-new').evaluate(n=>{const a=n.getAnimations()[0];if(!a)throw new Error('Missing tile spawn animation');a.pause();a.currentTime=65;return {scale:new DOMMatrixReadOnly(getComputedStyle(n).transform).a,opacity:Number(getComputedStyle(n).opacity)};});expect(spawn.scale).toBeGreaterThan(.3);expect(spawn.scale).toBeLessThanOrEqual(1.1);
 await page.screenshot({path:info.outputPath(`${prefix}-merge-pop-and-spawn.png`),animations:'allow',fullPage:true});
 await page.evaluate(()=>{
  document.querySelectorAll('.merge-classic *').forEach(n=>n.getAnimations().forEach(a=>a.finish()));
 });
 await settleMerge(page);await expect(page.locator('[data-merge-score]')).toHaveText('4');await mergeLayout(page);
 await page.screenshot({path:info.outputPath(`${prefix}-settled.png`),animations:'disabled',fullPage:true});
 // Restore real time before navigation: a frozen clock also freezes React lazy/Suspense work after reload.
 await page.clock.resume();
 } finally {
  await cssPause.evaluate(n=>n.parentNode?.removeChild(n));
  await page.evaluate(()=>{
   const w=window as unknown as {mergeNativeAnimate?:typeof Element.prototype.animate};
   if(w.mergeNativeAnimate)Element.prototype.animate=w.mergeNativeAnimate;
   delete w.mergeNativeAnimate;
  });
 }
}
