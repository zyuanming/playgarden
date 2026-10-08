import {test,expect,type Page} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
import {ataxxLevels} from '../src/games/ataxxLevels';
import {chooseAI} from '../src/games/ataxxSearch';
import {start,replay,type Move} from '../src/games/ataxxLogic';
async function choose(page:Page,from:number,to:number,keyboard=false){const root=page.locator('.ataxx-layout');await root.locator(`button[data-cell="${from}"]`).click();const target=root.locator(`button[data-cell="${to}"]`);if(keyboard){await target.focus();await target.press('Enter');}else await target.click();await expect(root.locator('.preview')).toHaveCount(1);}
test('Ataxx actual30 lessons, preview feedback, current-state hints and complete progress',async({page},info)=>{
 test.setTimeout(240000);const errors=captureErrors(page);await openGame(page,'胞子争园');await page.getByRole('button',{name:'成长练习',exact:true}).click();
 const root=page.locator('.ataxx-layout');
 // A legal but wrong jump must fail the first clone objective; undo is recoverable.
 await choose(page,0,2);await root.getByRole('button',{name:/^确认移动/}).click();await expect(root).toHaveAttribute('data-ataxx-phase','retry');await expect(page.locator('.status')).not.toHaveClass(/success/);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(root).toHaveAttribute('data-ataxx-history','[]');
 for(let i=0;i<30;i++){
  await chooseLevel(page,i);await page.getByRole('button',{name:'重来',exact:true}).click();await expect(root).toHaveAttribute('data-ataxx-id',ataxxLevels[i].id);const shots=[0,14,29].includes(i);
  if(shots)await page.screenshot({path:info.outputPath(`ataxx-${i+1}-start.png`),fullPage:true});
  for(let greenTurn=0;greenTurn<3;greenTurn++){
   if(await root.getAttribute('data-ataxx-phase')==='success')break;
   await expect(root).toHaveAttribute('data-ataxx-turn','1');
   const before=await root.getAttribute('data-ataxx-board');
   await page.getByRole('button',{name:'提示',exact:true}).click();await expect(root.locator('.preview')).toHaveCount(1);await expect(root).toHaveAttribute('data-ataxx-board',before!);await expect(root.getByRole('status')).toContainText('完整目标搜索');
   if(shots&&greenTurn===0)await page.screenshot({path:info.outputPath(`ataxx-${i+1}-preview.png`),fullPage:true});
   const confirm=root.getByRole('button',{name:/^确认移动/});if(i===0){await confirm.focus();await confirm.press('Enter');}else await confirm.click();
   await expect.poll(async()=>await root.getAttribute('data-ataxx-phase')==='success'||await root.getAttribute('data-ataxx-turn')==='1').toBe(true);
  }
  await expect(root).toHaveAttribute('data-ataxx-phase','success');await expect(page.locator('.status')).toHaveClass(/success/);
  expect(await root.locator('.ataxx-cell').evaluateAll(cells=>cells.every(c=>{const b=c.getBoundingClientRect();return b.width>=44&&b.height>=44;}))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(shots)await page.screenshot({path:info.outputPath(`ataxx-${i+1}-completed.png`),fullPage:true});
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')!).completed.ataxx.length)).toBe(30);expect(errors).toEqual([]);
});
test('Ataxx full real AI match, cancellation, double confirm, pause, reload and terminal',async({page},info)=>{
 test.setTimeout(300000);const errors=captureErrors(page);await openGame(page,'胞子争园');const root=page.locator('.ataxx-layout'),confirm=root.getByRole('button',{name:/^确认移动/});
 await expect(root).toHaveAttribute('data-ataxx-id','free');await page.screenshot({path:info.outputPath('ataxx-free-start.png'),fullPage:true});
 expect(await root.locator('.ataxx-cell').evaluateAll(c=>c.every(e=>e.getBoundingClientRect().width>=44))).toBe(true);
 const first=root.locator('button[data-cell="0"]');await first.focus();await first.press('Control+Enter');await expect(first).toHaveAttribute('aria-pressed','false');await first.press('ArrowRight');await expect(root.locator('button[data-cell="1"]')).toBeFocused();
 await choose(page,0,8,true);await root.getByRole('button',{name:'取消选择'}).click();await expect(root).toHaveAttribute('data-ataxx-history','[]');await expect(root.locator('.preview')).toHaveCount(0);
 await choose(page,0,8);await confirm.dblclick();await page.getByRole('button',{name:'暂停',exact:true}).click();const paused=await root.getAttribute('data-ataxx-history');await page.waitForTimeout(650);await expect(root).toHaveAttribute('data-ataxx-history',paused!);await expect(first).toBeDisabled();await page.getByRole('button',{name:'继续游戏',exact:true}).click();await expect(root).toHaveAttribute('data-ataxx-turn','1');expect(JSON.parse((await root.getAttribute('data-ataxx-history'))!).length).toBe(2);
 const saved=await root.getAttribute('data-ataxx-board');await page.reload();await page.getByRole('textbox',{name:'搜索游戏'}).fill('胞子争园');await page.getByRole('button',{name:/开始玩胞子争园|继续玩胞子争园/}).click();await expect(root).toHaveAttribute('data-ataxx-board',saved!);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(root).toHaveAttribute('data-ataxx-history','[]');
 await choose(page,0,8);await confirm.click();await page.getByRole('button',{name:'重来',exact:true}).click();await page.waitForTimeout(650);await expect(root).toHaveAttribute('data-ataxx-history','[]');
 await choose(page,0,8);await confirm.click();await page.getByRole('button',{name:'成长练习',exact:true}).click();await page.waitForTimeout(650);await expect(root).toHaveAttribute('data-ataxx-id','ataxx-01');await expect(root).toHaveAttribute('data-ataxx-history','[]');await page.getByRole('button',{name:'自由对弈',exact:true}).click();await page.getByRole('button',{name:'重来',exact:true}).click();
 let turns=0;
 while(!(await root.getAttribute('data-ataxx-end'))&&turns<220){
  await expect.poll(async()=>!!await root.getAttribute('data-ataxx-end')||await root.getAttribute('data-ataxx-turn')==='1').toBe(true);
  if(await root.getAttribute('data-ataxx-end'))break;
  const h=JSON.parse((await root.getAttribute('data-ataxx-history'))!) as Move[],p=replay(start(),h)!;const result=chooseAI(p,4000,40);expect(result.kind).toBe('answer');if(result.kind!=='answer')throw Error('AI helper budget');
  if(result.move===null)await root.getByRole('button',{name:'跳过回合'}).click();else{await choose(page,result.move.from,result.move.to);await confirm.click();}
  turns++;if(turns===12)await page.screenshot({path:info.outputPath('ataxx-free-mid.png'),fullPage:true});
 }
 expect(await root.getAttribute('data-ataxx-end')).toMatch(/^[012]$/);await page.screenshot({path:info.outputPath('ataxx-free-terminal.png'),fullPage:true});await expect(confirm).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
