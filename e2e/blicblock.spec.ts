// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type Locator} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import type {BlicSnapshot} from '../src/vendor/blicblockRuntime';
const read=(page:Page):Promise<BlicSnapshot>=>page.evaluate(()=>(window as unknown as {__blicblockRead:()=>BlicSnapshot}).__blicblockRead());
async function act(locator:Locator,mobile:boolean){if(mobile)await locator.tap();else await locator.click();}
async function ready(page:Page){await expect.poll(async()=>{const s=await read(page);return !s.busy&&s.blocks.some(b=>b.active);}).toBe(true);}
async function side(page:Page,direction:'left'|'right',mobile:boolean){await act(page.getByRole('button',{name:direction==='left'?'落块向左':'落块向右',exact:true}),mobile);await expect.poll(async()=>(await read(page)).busy).toBe(false);}
// A one-placement heuristic using only the visible board: favor a same-color
// neighbor/group and keep tall piles away from the central entry. No lookahead,
// rules-engine execution, search tree, or writable game-state hook is used.
function chooseColumn(s:BlicSnapshot){
 const active=s.blocks.find(b=>b.active)!;const settled=s.blocks.filter(b=>!b.active);
 const choices:{column:number;value:number}[]=[];
 for(let column=0;column<5;column++){
  const low=Math.min(column,active.y),high=Math.max(column,active.y);
  if(settled.some(b=>b.x===active.x&&b.y>=low&&b.y<=high))continue;
  const row=Math.min(7,...settled.filter(b=>b.y===column&&b.x>active.x).map(b=>b.x))-1;if(row<active.x)continue;
  const connected=new Set([`${row},${column}`]),queue=[[row,column]];
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const b of settled)if(b.color===active.color&&Math.abs(b.x-x)+Math.abs(b.y-y)===1&&!connected.has(`${b.x},${b.y}`)){connected.add(`${b.x},${b.y}`);queue.push([b.x,b.y]);}}
  const height=7-row,group=connected.size;
  const value=(group>=4?10000:group===3?600:group===2?200:0)-height*height*8-(column===2?height*8:0);
  choices.push({column,value});
 }
 return choices.sort((a,b)=>b.value-a.value)[0]?.column??active.y;
}
async function place(page:Page,column:number,mobile:boolean){
 await ready(page);const id=(await read(page)).blocks.find(b=>b.active)!.id;
 for(let step=0;step<4;step++){const block=(await read(page)).blocks.find(b=>b.active);if(!block||block.id!==id||block.y===column)break;await side(page,block.y<column?'right':'left',mobile);}
 await act(page.getByRole('button',{name:'快速落下',exact:true}),mobile);
 await expect.poll(async()=>{const s=await read(page);return s.gameover||s.blocks.find(b=>b.active)?.id!==id;},{timeout:5000}).toBe(true);
}

test('original six-color play earns clears, cascades, speed and loss; pause, touch and isolated storage',async({page},info)=>{
 test.setTimeout(180000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 // Ordinary disclosed fixed-seed LCG for every random draw, including UUIDs.
 // Six-color draws are unmodified: no favorable tape, board/score setter,
 // injected clear, or injected terminal outcome.
 await page.addInitScript(()=>{let seed=1402026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await openGame(page,'六色拼落');await expect(page.locator('.bb-game')).toHaveAttribute('data-bb-ready','true');await ready(page);
 await page.evaluate(()=>localStorage.setItem('playgarden.blicblock-unrelated','keep'));
 await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
 let s=await read(page);expect(s.upcoming).toHaveLength(2);expect(s.tickLength).toBe(1200);expect(s.score).toBe(0);
 const start=s.blocks.find(b=>b.active)!;await side(page,'left',mobile);expect((await read(page)).blocks.find(b=>b.active)!.y).toBe(start.y-1);await side(page,'right',mobile);expect((await read(page)).blocks.find(b=>b.active)!.y).toBe(start.y);
 if(!mobile){await page.locator('.bb-game').focus();await page.keyboard.press('ArrowLeft');await expect.poll(async()=>(await read(page)).busy).toBe(false);await page.keyboard.press('ArrowRight');await expect.poll(async()=>(await read(page)).busy).toBe(false);}
 await act(page.getByRole('button',{name:'暂停',exact:true}),mobile);const stopped=await read(page);await page.waitForTimeout(1400);expect((await read(page)).blocks).toEqual(stopped.blocks);expect((await read(page)).score).toBe(stopped.score);await expect(page.getByRole('button',{name:'快速落下',exact:true})).toBeDisabled();await act(page.getByRole('button',{name:'继续游戏',exact:true}),mobile);
 await page.screenshot({path:info.outputPath('blicblock-six-color-board.png'),fullPage:true});
 for(let placed=0;placed<70;placed++){s=await read(page);if(s.gameover||s.score>=1000)break;await ready(page);s=await read(page);await place(page,chooseColumn(s),mobile);}
 s=await read(page);expect(s.score).toBeGreaterThanOrEqual(1000);expect(s.mode).toBe(0);
 await page.screenshot({path:info.outputPath('blicblock-earned-six-color-clear.png'),fullPage:true});
 // After earning the normal-mode clear, deliberately stack in the center using
 // the same controls until the actual entry-blocked loss condition is reached.
 for(let placed=0;placed<35;placed++){s=await read(page);if(s.gameover)break;await place(page,2,mobile);}
 s=await read(page);expect(s.gameover).toBe(true);expect(s.score).toBeGreaterThanOrEqual(1000);expect(s.blocks.filter(b=>b.y===2)).toHaveLength(7);const earned=s.score;
 expect(Number(await page.evaluate(()=>localStorage.getItem('playgarden.blicblock.best.v1')))).toBe(earned);
 await page.screenshot({path:info.outputPath('blicblock-real-center-column-loss.png'),fullPage:true});
 await act(page.getByRole('button',{name:'再玩一局',exact:true}),mobile);s=await read(page);expect(s.score).toBe(0);expect(s.gameover).toBe(false);expect(s.best).toBe(earned);
 // This is the original, user-visible four-cascade teaching layout. Its fixed
 // starting board is explicitly labelled practice, not an earned endless run.
 await page.getByLabel('游戏方式',{exact:true}).selectOption('4');await ready(page);expect((await read(page)).mode).toBe(4);await side(page,'left',mobile);await side(page,'left',mobile);
 await act(page.getByRole('button',{name:'快速落下',exact:true}),mobile);
 await expect.poll(async()=>(await read(page)).score,{timeout:12000}).toBe(5000);
 await expect.poll(async()=>(await read(page)).busy).toBe(false);s=await read(page);expect(s.level).toBe(2);expect(s.tickLength).toBe(1092);expect(s.best).toBe(earned);
 await page.screenshot({path:info.outputPath('blicblock-original-four-cascade-practice.png'),fullPage:true});
 await act(page.getByRole('button',{name:'暂停落块',exact:true}),mobile);const paused=await read(page);await page.waitForTimeout(500);expect((await read(page)).blocks).toEqual(paused.blocks);await act(page.locator('.bb-cover').getByRole('button',{name:'继续落块',exact:true}),mobile);
 const observer=await page.evaluateHandle(()=>(window as unknown as {__blicblockRead:()=>BlicSnapshot}).__blicblockRead);
 await act(page.getByRole('button',{name:'返回游戏大厅',exact:true}),mobile);expect(await observer.evaluate(fn=>fn())).toMatchObject({disposed:true,timers:0});
 await openGame(page,'六色拼落');await ready(page);expect((await read(page)).best).toBe(earned);expect((await read(page)).mode).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('playgarden.blicblock-unrelated'))).toBe('keep');
 // Storage failure does not break the playable controller or leak to other keys.
 await page.evaluate(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='playgarden.blicblock.best.v1')throw new Error('blocked');return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k==='playgarden.blicblock.best.v1')throw new Error('blocked');return set.call(this,k,v);};});
 await act(page.getByRole('button',{name:'重新开局',exact:true}),mobile);await ready(page);await expect(page.getByRole('alert').filter({hasText:'暂时无法保存最高分'})).toBeVisible();await side(page,'left',mobile);expect((await read(page)).blocks.find(b=>b.active)!.y).toBe(1);
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('blicblock-320px-touch-and-storage-failure.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);
});
