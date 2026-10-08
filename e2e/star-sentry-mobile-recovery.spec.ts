// SPDX-License-Identifier: GPL-3.0-only
// Mobile-only unfinished navigation continuation. Earlier shooting, loss and
// interruption evidence is reused; desktop complete journey already passed.
import {test,expect} from '@playwright/test';
import {openGame,chooseLevel,captureErrors} from './helpers';
test('star sentry mobile: held navigation and safe re-entry continuation',async({page},info)=>{
  test.skip(info.project.name!=='mobile','Desktop full journey already passed.');
  const errors=captureErrors(page),game=page.locator('.star-sentry');
  await openGame(page,'星门守望');
  await chooseLevel(page,11);
  await expect(game).toHaveAttribute('data-sentry-remaining','12');
  await expect(game.locator('[data-sentry-shelter]')).toHaveCount(3);
  await page.screenshot({path:info.outputPath('star-sentry-mobile-final-preview.png'),fullPage:true});
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));
  await chooseLevel(page,4);
  await page.getByRole('button',{name:'开始守望',exact:true}).tap();
  const touch=await page.context().newCDPSession(page);
  const right=game.locator('[data-sentry-control="right"]');
  await right.scrollIntoViewIfNeeded();const r=await right.boundingBox();expect(r).not.toBeNull();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:r!.x+r!.width/2,y:r!.y+r!.height/2}]});
  await page.clock.runFor(120);
  await expect(game).toHaveAttribute('data-sentry-right','true');
  // Trigger the real public navigation control while the touch is held. The
  // browser owns the touch sequence; send exactly one final release, never two.
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.clock.runFor(500);await expect(game).toHaveCount(0);
  await touch.detach();await page.clock.resume();
  await openGame(page,'星门守望');
  await expect(page.getByLabel('选择关卡',{exact:true})).toHaveValue('4');
  await expect(game).toHaveAttribute('data-sentry-phase','ready');
  await expect(game).toHaveAttribute('data-sentry-x','300.000');
  await expect(game).toHaveAttribute('data-sentry-auto','false');
  await expect(game).toContainText('本轮飞行不保存');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('star-sentry-mobile-safe-return.png'),fullPage:true});
  expect(errors).toEqual([]);
});
