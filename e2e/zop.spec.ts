// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Page,type Locator} from '@playwright/test';
import {openGame,captureErrors} from './helpers';
import type {ZopSnapshot,ZopDot} from '../src/vendor/zopRuntime';
type Live=ZopSnapshot&{paused:boolean;best:number;rafActive:boolean;held:number|null};
const read=(page:Page):Promise<Live>=>page.evaluate(()=>(window as unknown as {__zopRead:()=>Live}).__zopRead());
const neighbor=(a:ZopDot,b:ZopDot)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;
function pair(s:Live,offset=0){for(let k=0;k<s.dots.length;k++){const a=s.dots[(k+offset)%s.dots.length],b=s.dots.find(b=>neighbor(a,b)&&a.color===b.color);if(b)return [a,b];}return null;}
// Only recognize visible 2x2 loops and neighboring pairs. No game simulation,
// outcomes injected into the board, favorable random tape or solution search.
function square(s:Live){for(let r=0;r<5;r++)for(let c=0;c<5;c++){const ds=[[r,c],[r,c+1],[r+1,c+1],[r+1,c]].map(([r,c])=>s.dots.find(d=>d.r===r&&d.c===c)!);if(ds.every(d=>d.color===ds[0].color))return [...ds,ds[0]];}return null;}
test('original timed Zop earns chains and a full-color loop, then real timeout; touch, pause and storage',async({page},info)=>{
 test.setTimeout(180000);const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 await page.addInitScript(()=>{let seed=1672026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await openGame(page,'连点成环');await expect(page.locator('.zop-game')).toHaveAttribute('data-zop-phase','waiting');await expect(page.getByLabel('选择关卡',{exact:true})).toHaveCount(0);
 const act=(l:Locator)=>mobile?l.tap():l.click();await act(page.getByRole('button',{name:'开始60秒挑战',exact:true}));
 const canvas=page.getByLabel('连点成环，6行6列的五色色点棋盘',{exact:true}),cdp=mobile?await page.context().newCDPSession(page):null;
 const ready=()=>expect.poll(async()=>{const s=await read(page);return s.phase==='playing'&&s.dots.length===36&&s.dots.every(d=>d.settled&&d.r>=0&&d.r<6);}).toBe(true);
 await ready();await page.evaluate(()=>localStorage.setItem('playgarden.zop-unrelated','keep'));
 async function point(d:ZopDot){const b=(await canvas.boundingBox())!;return {x:b.x+d.x/420*b.width,y:b.y+d.y/540*b.height};}
 async function down(d:ZopDot){await canvas.scrollIntoViewIfNeeded();const p=await point(d);if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});else {await page.mouse.move(p.x,p.y);await page.mouse.down();}await page.waitForTimeout(45);}
 async function move(d:ZopDot){const p=await point(d);if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});else await page.mouse.move(p.x,p.y);await page.waitForTimeout(55);}
 async function up(){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();}
 async function draw(ds:ZopDot[]){await down(ds[0]);for(const d of ds.slice(1))await move(d);await up();}
 let s=await read(page);expect(s.score).toBe(0);expect(s.time).toBeGreaterThan(55);await page.screenshot({path:info.outputPath('zop-original-board.png'),fullPage:true});
 const first=pair(s)!;expect(first).not.toBeNull();await down(first[0]);await move(first[1]);expect((await read(page)).selected).toHaveLength(2);await move(first[0]);expect((await read(page)).selected).toHaveLength(1);await move(first[1]);await up();
 await ready();s=await read(page);expect(s.score).toBe(2);expect(s.metrics.lastRemoved).toBe(2);
 // A single dot or a nonmatching/diagonal move does not earn a clear.
 const a=s.dots[0],bad=s.dots.find(d=>d.id!==a.id&&(!neighbor(a,d)||d.color!==a.color))!;await down(a);await move(bad);expect((await read(page)).selected).toHaveLength(1);await up();expect((await read(page)).score).toBe(2);
 // Physical cancellation leaves the in-progress chain uncommitted.
 const cancelPair=pair(await read(page))!;await down(cancelPair[0]);await move(cancelPair[1]);if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else {await page.keyboard.press('Escape');await up();}expect((await read(page)).selected).toHaveLength(0);expect((await read(page)).score).toBe(2);
 await page.screenshot({path:info.outputPath('zop-earned-chain.png'),fullPage:true});
 let loop:ZopDot[]|null=null;
 for(let attempt=0;attempt<40;attempt++){await ready();s=await read(page);loop=square(s);if(loop)break;const p=pair(s,(attempt*7)%36);expect(p,'An ordinary visible-board pair remains available').not.toBeNull();await draw(p!);}
 expect(loop,'A real visible loop appears through ordinary seeded draws and legal pair removals').not.toBeNull();s=await read(page);const loopColor=loop![0].color,expected=s.dots.filter(d=>d.color===loopColor).length,before=s.score;
 await down(loop![0]);for(const d of loop!.slice(1))await move(d);expect((await read(page)).squareColor).toBe(loopColor);await expect(page.locator('.zop-selection')).toContainText('已连成闭环');await up();await ready();s=await read(page);expect(s.score-before).toBe(expected);expect(s.metrics.loops).toBe(1);expect(s.dots.every(d=>d.color!==loopColor)).toBe(true);expect(new Set(s.dots.map(d=>`${d.r},${d.c}`)).size).toBe(36);
 await page.screenshot({path:info.outputPath('zop-earned-full-color-loop.png'),fullPage:true});
 await act(page.getByRole('button',{name:'暂停',exact:true}));const frozen=await read(page);await page.waitForTimeout(1300);expect((await read(page)).elapsed).toBe(frozen.elapsed);expect((await read(page)).time).toBe(frozen.time);expect((await read(page)).selecting).toBe(false);await act(page.getByRole('button',{name:'继续游戏',exact:true}));
 // Wait for the original 60 active seconds. No clock installation, fast-forward,
 // injected end or internal score/board write supplies the terminal state.
 await expect.poll(async()=>(await read(page)).phase,{timeout:65000,intervals:[250]}).toBe('gameover');s=await read(page);expect(s.elapsed).toBeGreaterThanOrEqual(60000);expect(s.time).toBe(0);expect(s.score).toBeGreaterThan(2);expect(s.best).toBe(s.score);const earned=s.score;
 await expect(page.locator('.status')).toContainText(`本局得到${earned}分`);await expect(page.getByRole('button',{name:'再挑战一分钟',exact:true})).toBeVisible();expect(Number(await page.evaluate(()=>localStorage.getItem('playgarden.zop.best.v1')))).toBe(earned);await page.screenshot({path:info.outputPath('zop-real-minute-result.png'),fullPage:true});
 await act(page.getByRole('button',{name:'再挑战一分钟',exact:true}));await ready();expect((await read(page)).score).toBe(0);expect((await read(page)).time).toBeGreaterThan(55);expect((await read(page)).best).toBe(earned);
 const observer=await page.evaluateHandle(()=>(window as unknown as {__zopRead:()=>Live}).__zopRead);await act(page.getByRole('button',{name:'返回游戏大厅',exact:true}));const disposed=await observer.evaluate(fn=>fn());expect(disposed.disposed).toBe(true);expect(disposed.rafActive).toBe(false);await page.waitForTimeout(300);expect((await observer.evaluate(fn=>fn())).elapsed).toBe(disposed.elapsed);
 await openGame(page,'连点成环');expect((await read(page)).best).toBe(earned);expect((await read(page)).phase).toBe('waiting');expect(await page.evaluate(()=>localStorage.getItem('playgarden.zop-unrelated'))).toBe('keep');
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('zop-320px-best-restored.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);await cdp?.detach();
});
