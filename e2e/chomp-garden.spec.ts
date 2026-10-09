// SPDX-License-Identifier: GPL-3.0-only
import {test,expect} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
import {chompBest,chompGardenLevels} from '../src/games/chompGardenLogic';
test('Chomp first and final real victories, pause, undo and reset',async({page},info)=>{
 const errors=captureErrors(page);await openGame(page,'饼干陷阱');const root=page.locator('.chomp-garden');
 await root.locator('[data-row="0"][data-col="0"]').click();await expect(root).toHaveAttribute('data-chomp-turns','1');await page.getByRole('button',{name:'撤销',exact:true}).click();await expect(root).toHaveAttribute('data-chomp-turns','0');
 await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(root.locator('[data-row="0"][data-col="0"]')).toBeDisabled();await page.getByRole('button',{name:'继续游戏',exact:true}).click();
 await root.locator('[data-row="1"][data-col="0"]').click();await expect(root).toHaveAttribute('data-chomp-result','lost');await page.getByRole('button',{name:'重来',exact:true}).click();await expect(root).toHaveAttribute('data-chomp-turns','0');
 for(const level of [0,chompGardenLevels.length-1]){await chooseLevel(page,level);await page.screenshot({path:info.outputPath(`chomp-${level}-start.png`),fullPage:true});await page.getByRole('button',{name:'提示',exact:true}).click();await expect(root.locator('.hinted')).toHaveCount(1);
 for(let turn=0;turn<30&&await root.getAttribute('data-chomp-result')==='playing';turn++){const shape=(await root.getAttribute('data-chomp-shape'))!.split(',').map(Number),move=chompBest(shape);expect(move).not.toBeNull();const cell=root.locator(`[data-row="${move!.row}"][data-col="${move!.col}"]`);if(info.project.name==='mobile')await cell.tap();else if(turn===0){await cell.focus();await cell.press('Enter');}else await cell.click();}
 await expect(root).toHaveAttribute('data-chomp-result','won');await expect(page.locator('.status')).toHaveClass(/success/);const before=await root.getAttribute('data-chomp-shape');await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeDisabled();await expect(root).toHaveAttribute('data-chomp-shape',before!);await page.screenshot({path:info.outputPath(`chomp-${level}-win.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(errors).toEqual([]);
});
