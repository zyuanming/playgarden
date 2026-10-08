import { test,expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame,chooseLevel,captureErrors } from './helpers';
import { signpostLevels } from '../src/games/signpostLevels';
import { initialSignpost,linkSignpost,solveSignpost } from '../src/games/signpostLogic';
const proofs=JSON.parse(readFileSync('docs/signpost/campaign.json','utf8')).levels as {solution:number[]}[];
test('Signpost actual30 touch and keyboard chains, interruptions and persistence',async({page},info)=>{
 test.setTimeout(360000);const errors=captureErrors(page);await openGame(page,'箭头路标');
 const root=page.locator('.signpost-layout'),cell=(i:number)=>root.locator(`button[data-cell="${i}"]`);
 async function select(a:number){if(await root.getAttribute('data-signpost-selected')!==String(a)){if(await root.getAttribute('data-signpost-selected'))await root.getByRole('button',{name:'换个起点',exact:true}).click();await cell(a).click();}}
 async function link(a:number,b:number,keyboard=false){await select(a);if(keyboard){await cell(b).focus();await cell(b).press('Enter');}else await cell(b).click();}
 const p=signpostLevels[0],path=proofs[0].solution,fresh=initialSignpost(p).join(',');
 await cell(path[0]).focus();await cell(path[0]).press('Control+Enter');await expect(root).toHaveAttribute('data-signpost-selected','');await expect(cell(path[0])).toBeFocused();
 await cell(0).focus();await cell(0).press('ArrowRight');await expect(cell(1)).toBeFocused();
 await link(path[0],path[1],true);const one=await root.getAttribute('data-signpost-state');
 await select(path[0]);await root.getByRole('button',{name:'断开出线',exact:true}).click();await expect(root).toHaveAttribute('data-signpost-state',fresh);
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(root).toHaveAttribute('data-signpost-state',one!);
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(cell(0)).toBeDisabled();await page.getByRole('button',{name:'继续游戏',exact:true}).click();await expect(root).toHaveAttribute('data-signpost-state',one!);
 await page.reload();await page.getByRole('textbox',{name:'搜索游戏'}).fill('箭头路标');await page.getByRole('button',{name:/开始玩箭头路标|继续玩箭头路标/}).click();await expect(root).toHaveAttribute('data-signpost-state',one!);
 await page.getByRole('button',{name:'重来',exact:true}).click();await expect(root).toHaveAttribute('data-signpost-state',fresh);
 await page.getByRole('button',{name:'提示',exact:true}).click();await expect(root.locator('.hint')).toHaveCount(1);await expect(root).toHaveAttribute('data-signpost-state',fresh);await expect(root.getByRole('status')).toContainText('搜索');
 await page.screenshot({path:info.outputPath('signpost-hint.png'),fullPage:true});
 // Find a locally accepted but globally incompatible edge; submit through controls.
 let bad:number[]|undefined;
 for(let a=0;a<p.arrows.length&&!bad;a++)for(let b=0;b<p.arrows.length&&!bad;b++){const s=initialSignpost(p),r=linkSignpost(p,s,a,b);if(r.state!==s&&solveSignpost(p,r.state).kind==='none')bad=[a,b];}
 expect(bad).toBeTruthy();await link(bad![0],bad![1]);await page.getByRole('button',{name:'提示',exact:true}).click();await expect(root.getByRole('status')).toContainText('无法组成完整路线');await page.screenshot({path:info.outputPath('signpost-incompatible.png'),fullPage:true});
 for(let index=0;index<signpostLevels.length;index++){
  await chooseLevel(page,index);await page.getByRole('button',{name:'重来',exact:true}).click();await expect(root).toHaveAttribute('data-signpost-id',signpostLevels[index].id);
  const answer=proofs[index].solution,shots=[0,14,29].includes(index);
  if(shots)await page.screenshot({path:info.outputPath(`signpost-${index+1}-start.png`),fullPage:true});
  // Start in the middle to exercise relative chain labels, then join both halves.
  const order=Array.from({length:answer.length-1},(_,k)=>k),mid=Math.floor(order.length/2);order.push(...order.splice(0,mid));
  for(const [j,k] of order.entries()){await link(answer[k],answer[k+1],index===0);if(shots&&j===mid)await page.screenshot({path:info.outputPath(`signpost-${index+1}-mid.png`),fullPage:true});}
  await expect(root).toHaveAttribute('data-signpost-won','true');await expect(page.locator('.status')).toHaveClass(/success/);await expect(cell(0)).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(shots)await page.screenshot({path:info.outputPath(`signpost-${index+1}-completed.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});
