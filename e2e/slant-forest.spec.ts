import { newSlantState, playSlant } from '../src/games/slantLogic';
import { saveSlantRound, SLANT_RESUME_KEY } from '../src/games/slantStorage';
import { test, expect, type Page } from '@playwright/test';
import { slantLevels } from '../src/games/slantLevels';
import { slantCertificates } from '../tests/fixtures/slantCertificates';
import { slantChapters } from '../src/games/slantCampaign';
import { STORAGE_KEY } from '../src/lib/progress';
import { openGame, chooseLevel, captureErrors } from './helpers';
async function solve(page:Page,index:number) {
 const board=page.locator('.slant-cell');
 // Certificates guide real accessible controls; never mutate component state or saves.
 for(const value of [-1,1]){
  await page.getByRole('button',{name:value===-1?'反斜线 \\':'正斜线 /',exact:true}).click();
  for(const [cell,v] of slantCertificates[index].solution.entries())if(v===value)await board.nth(cell).click();
 }
 await expect(page.locator('[data-slant-won=true]')).toHaveCount(1);
 await expect(page.locator('.status')).toHaveClass(/success/);
}
// Ten-level journeys keep each bounded even with the 12×10 mobile board.
for(let start=0;start<300;start+=10) test(`Slant genuine completion ${start+1}–${start+10}`,async({page},info)=>{
 const errors=captureErrors(page);page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await openGame(page,'斜线森林');await chooseLevel(page,start);
 for(let level=start;level<start+10;level++){
  const puzzle=slantLevels[level],chapter=slantChapters[puzzle.chapter];
  await expect(page.locator('.slant-cell')).toHaveCount(puzzle.width*puzzle.height);
  await expect(page.getByLabel('本章练习')).toContainText(chapter.title);
  await expect(page.locator('.slant-round')).toHaveText(`${String(level+1).padStart(3,'0')} / 300`);
  const size=await page.locator('.slant-cell').first().boundingBox();expect(size!.width).toBeCloseTo(48,1);expect(size!.height).toBeCloseTo(48,1);
  if(info.project.name==='mobile'&&puzzle.width===12){expect(await page.locator('.slant-scroll').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);await page.locator('.slant-cell').last().scrollIntoViewIfNeeded();await expect(page.locator('.slant-cell').last()).toBeInViewport();}
  if([0,149,299].includes(level))await page.screenshot({path:info.outputPath(`slant-${level+1}-start.png`),fullPage:true});
  await solve(page,level);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if([0,149,299].includes(level))await page.screenshot({path:info.outputPath(`slant-${level+1}-won.png`),fullPage:true});
  const earned=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).completed.slant,STORAGE_KEY);expect(earned).toContain(level);
  if(level<start+9)await page.getByRole('button',{name:'下一关',exact:true}).click();
 }
 expect(errors).toEqual([]);
});
test('Slant level 300 resume, interruptions, modifiers, reset and terminal lock',async({page},info)=>{
 const errors=captureErrors(page);await openGame(page,'斜线森林');await chooseLevel(page,299);
 const board=page.locator('.slant-cell'),first=board.first();await first.click();await expect(first).toHaveAttribute('data-value','-1');
 await first.focus();await expect(first).toBeFocused();
 for(const modifier of ['Control','Meta','Alt']){await first.press(`${modifier}+/`);await expect(first).toHaveAttribute('data-value','-1');await expect(first).toBeFocused();}
 await first.press('/');await expect(first).toHaveAttribute('data-value','1');await first.press('ArrowRight');await expect(board.nth(1)).toBeFocused();
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(first).toBeDisabled();
 await page.getByRole('button',{name:'继续游戏',exact:true}).click();await expect(first).toHaveAttribute('data-value','1');
 await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(first).toHaveAttribute('data-value','-1');
 await page.reload();await openGame(page,'斜线森林');await expect(page.getByLabel('选择关卡',{exact:true})).toHaveValue('299');await expect(first).toHaveAttribute('data-value','-1');
 await page.getByRole('button',{name:'重来',exact:true}).click();await expect(first).toHaveAttribute('data-value','0');
 await page.getByRole('button',{name:'提示',exact:true}).click();await expect(page.locator('.slant-cell.is-hinted')).toHaveCount(1);await expect(first).toHaveAttribute('data-value','0');
 await first.focus();await first.press('Space');await expect(first).toHaveAttribute('data-value','-1');await first.press('Space');await expect(first).toHaveAttribute('data-value','1');
 await page.getByRole('button',{name:'重来',exact:true}).click();await solve(page,299);await expect(first).toBeDisabled();await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();
 await page.screenshot({path:info.outputPath('slant-300-resume-earned.png'),fullPage:true});
 await page.getByRole('button',{name:'返回大厅',exact:true}).click();await expect(page.locator('.catalog-count')).toContainText('300 个关卡');
 expect(errors).toEqual([]);
});

test('Slant cumulative 300-round storage fits Chromium and remains resumable',async({page})=>{
 const values:Record<string,string>={};
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(key:string,value:string)=>{values[key]=value;}}});
 try {
  for(const [i,puzzle]of slantLevels.entries()){
   let state=newSlantState(puzzle);for(const [cell,value]of slantCertificates[i].solution.entries())state=playSlant(puzzle,state,cell,value);
   expect(saveSlantRound(i,state,puzzle)).toBe(true);
  }
  // Preserve a genuine partial round with undo at the highest index.
  const puzzle=slantLevels[299],partial=playSlant(puzzle,newSlantState(puzzle),0,-1);expect(saveSlantRound(299,partial,puzzle)).toBe(true);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');}
 expect(Object.entries(values).reduce((n,[k,v])=>n+2*(k.length+v.length),0)).toBeLessThan(200000);
 await page.goto('/');
 // This is a storage-capacity fixture, not fabricated earned progress. Completion is tested through UI separately.
 await page.evaluate(({values,key})=>{for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);localStorage.setItem(key,'299');},{values,key:`${SLANT_RESUME_KEY}.selected`});
 await openGame(page,'斜线森林');await expect(page.getByLabel('选择关卡',{exact:true})).toHaveValue('299');
 await expect(page.locator('.slant-cell').first()).toHaveAttribute('data-value','-1');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(page.locator('.slant-cell').first()).toHaveAttribute('data-value','0');
 await page.reload();await openGame(page,'斜线森林');await expect(page.locator('.slant-cell').first()).toHaveAttribute('data-value','0');
});
