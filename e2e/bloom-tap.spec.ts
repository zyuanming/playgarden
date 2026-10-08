// SPDX-License-Identifier: GPL-3.0-only
import { test, expect, type Locator } from '@playwright/test';
import { openGame, chooseLevel, captureErrors } from './helpers';
test('flower tap: real timed collection, safe return, repeat and visitor distinction', async ({ page }, info) => {
  const errors=captureErrors(page), game=page.locator('[data-bloom-tap]');
  const touch=info.project.name==='mobile';
  const tap=async(node:Locator)=>{if(touch)await node.tap();else await node.click();};
  const hole=(n:number)=>game.locator(`[data-tap-hole="${n}"]`);
  async function until(seconds:number){const time=Number(await game.getAttribute('data-time'));if(seconds>time)await page.clock.runFor(Math.ceil((seconds-time)/.75*1000)+35);}
  await openGame(page,'花田快拍');
  await expect(game).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));
  await tap(page.getByRole('button',{name:'开始收花',exact:true}));
  await until(.7);
  await expect(hole(4)).toHaveAttribute('data-kind','flower');
  await page.screenshot({path:info.outputPath('bloom-tap-first-flower.png'),fullPage:true});
  if(touch)await tap(hole(4));else{await game.getByRole('group',{name:/九格花田/}).focus();await page.keyboard.press('5');}
  await tap(hole(4));
  await expect(game).toHaveAttribute('data-caught','1');
  await tap(page.getByRole('button',{name:'先停一停',exact:true}));
  const paused=await game.getAttribute('data-time');
  await page.clock.runFor(3000);
  await expect(game).toHaveAttribute('data-time',paused!);
  await expect(hole(0)).toBeDisabled();
  await page.clock.resume();
  await openGame(page,'花田快拍');
  await expect(game).toHaveAttribute('data-held','true');
  await expect(game).toHaveAttribute('data-caught','1');
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));
  await tap(page.getByRole('button',{name:'继续收花',exact:true}));
  for(const [index,n] of [0,8,2,6,4].entries()){
    await until(.7+(index+1)*1.8);await expect(hole(n)).toHaveAttribute('data-kind','flower');await tap(hole(n));
  }
  await until(12.1);
  await expect(game).toHaveAttribute('data-phase','won');
  await expect(game).toHaveAttribute('data-caught','6');
  await expect(page.locator('.status')).toHaveClass(/success/);
  await page.screenshot({path:info.outputPath('bloom-tap-first-complete.png'),fullPage:true});
  await chooseLevel(page,1);
  await tap(page.getByRole('button',{name:'开始收花',exact:true}));
  await until(4);
  await expect(hole(3)).toHaveAttribute('data-kind','ladybird');
  await tap(hole(3));
  await expect(game).toHaveAttribute('data-phase','lost');
  await tap(page.getByRole('button',{name:'再试这轮',exact:true}));
  await expect(game).toHaveAttribute('data-caught','0');
  await expect(game).toHaveAttribute('data-mistakes','0');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(game).toHaveAttribute('data-held','true');
  await page.clock.runFor(4000);
  await expect(game).toHaveAttribute('data-time','0.000');
  await chooseLevel(page,11);
  await expect(game).toHaveAttribute('data-phase','ready');
  await page.screenshot({path:info.outputPath('bloom-tap-final-ready.png'),fullPage:true});
  const sizes=await game.locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return[r.width,r.height];}));
  for(const [w,h] of sizes){expect(w).toBeGreaterThanOrEqual(44);expect(h).toBeGreaterThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
