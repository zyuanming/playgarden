// SPDX-License-Identifier: GPL-3.0-only
import {test,expect} from '@playwright/test';
import {openBreakout,freezeBreakout,playBreakout} from './breakoutJourney';
for(let group=0;group<4;group++)test(`breakout original stages ${group*3+1}-${group*3+3} by real paddle input`,async({page},info)=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await openBreakout(page);await expect(page.getByRole('heading',{name:'反弹砖园',exact:true})).toBeVisible();await freezeBreakout(page);for(let level=group*3;level<group*3+3;level++)await playBreakout(page,info,level);expect(errors).toEqual([]);
});
test('breakout keyboard touch cancellation pause reset and narrow layout',async({page},info)=>{
 await openBreakout(page);await freezeBreakout(page);const stage=page.locator('.breakout-stage');await stage.focus();await page.keyboard.down('ArrowRight');await page.clock.runFor(180);await page.keyboard.up('ArrowRight');expect(Number(await page.locator('.breakout-garden').getAttribute('data-breakout-paddle'))).toBeGreaterThan(200);
 await page.keyboard.press('Control+Space');await expect(page.locator('.breakout-garden')).toHaveAttribute('data-breakout-phase','ready');await page.keyboard.press('Space');await page.clock.runFor(200);await page.getByRole('button',{name:'暂停接球',exact:true}).click();const y=await page.locator('.breakout-garden').getAttribute('data-breakout-y');await page.clock.runFor(1000);expect(await page.locator('.breakout-garden').getAttribute('data-breakout-y')).toBe(y);await page.getByRole('button',{name:'继续接球',exact:true}).click();await page.clock.runFor(200);expect(await page.locator('.breakout-garden').getAttribute('data-breakout-y')).not.toBe(y);
 await page.getByRole('button',{name:'重来',exact:true}).click();await expect(page.locator('.breakout-garden')).toHaveAttribute('data-breakout-phase','ready');await stage.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:200,buttons:1});await stage.dispatchEvent('pointercancel',{pointerId:1,pointerType:'touch'});await page.clock.runFor(200);
 for(const width of [320,390,740]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`breakout-${width}-controls.png`),fullPage:true});}
 await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();await page.clock.runFor(1000);await expect(page.locator('.breakout-garden')).toHaveCount(0);
});
