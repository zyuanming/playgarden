// SPDX-License-Identifier: GPL-3.0-only
import {test,expect,type Locator} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
test('all original chapters: invalid moves, true failure, exact-budget wins, pause and saves',async({page},info)=>{
 const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[];const act=async(l:Locator)=>mobile?l.tap():l.click();
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))outside.push(r.url());});
 await openGame(page,'踏格方阵');const game=page.locator('.hd-game'),cell=(i:number)=>page.locator(`[data-hd-cell="${i}"]`);
 await expect(page.getByLabel('选择关卡',{exact:true}).locator('option')).toHaveCount(30);
 await page.evaluate(()=>localStorage.setItem('playgarden.hd-unrelated','keep'));
 await act(cell(2));await expect(game).toHaveAttribute('data-hd-moves','0');
 for(const p of [3,1,3])await act(cell(p));await expect(game).toHaveAttribute('data-hd-result','lost');await expect(game).toHaveAttribute('data-hd-moves','3');
 await page.screenshot({path:info.outputPath('hd-true-step-budget-failure.png'),fullPage:true});
 await act(page.getByRole('button',{name:'重新尝试',exact:true}));await expect(game).toHaveAttribute('data-hd-cursor','1');await act(cell(3));
 await page.reload();await openGame(page,'踏格方阵');await expect(game).toHaveAttribute('data-hd-moves','1');await expect(game).toHaveAttribute('data-hd-cursor','3');
 await act(page.getByRole('button',{name:'暂停',exact:true}));await page.locator('.hd-board').press('ArrowLeft');await expect(game).toHaveAttribute('data-hd-moves','1');await expect(cell(2)).toBeDisabled();await act(page.getByRole('button',{name:'继续游戏',exact:true}));
 for(const p of [2,0])await act(cell(p));await expect(game).toHaveAttribute('data-hd-result','won');await expect(game).toHaveAttribute('data-hd-moves','3');await expect(page.locator('.status')).toHaveClass(/success/);
 await page.screenshot({path:info.outputPath('hd-first-earned-victory.png'),fullPage:true});
 // Selected original middle/final puzzles; no altered move budgets or board state.
 const routes=[{level:14,path:[8,4,0,1,2,6,7,11,10,6,10,9],moves:12},{level:29,path:[8,3,4,9,14,9,14,19,24,19,24,23,24,23,22,21,16,15,10,5,6,7,12],moves:23}];
 for(const route of routes){await chooseLevel(page,route.level);await expect(game).toHaveAttribute('data-hd-result','playing');if(route.level===29){await expect(game).toHaveAttribute('data-hd-cursor','13');await expect(cell(13)).toBeDisabled();await expect(cell(11)).toBeDisabled();}
  await page.screenshot({path:info.outputPath(`hd-original-level-${route.level+1}.png`),fullPage:true});
  for(const p of route.path)await act(cell(p));await expect(game).toHaveAttribute('data-hd-result','won');await expect(game).toHaveAttribute('data-hd-moves',String(route.moves));await expect(page.locator('.status')).toHaveClass(/success/);await page.screenshot({path:info.outputPath(`hd-earned-level-${route.level+1}.png`),fullPage:true});
 }
 await act(page.getByRole('button',{name:'返回游戏大厅',exact:true}));await expect(page.locator('.hd-game')).toHaveCount(0);await openGame(page,'踏格方阵');await chooseLevel(page,29);await expect(game).toHaveAttribute('data-hd-result','won');
 expect(await page.evaluate(()=>localStorage.getItem('playgarden.hd-unrelated'))).toBe('keep');
 if(mobile){await page.setViewportSize({width:320,height:760});await page.screenshot({path:info.outputPath('hd-320px-final-save.png'),fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);expect(outside).toEqual([]);
});
