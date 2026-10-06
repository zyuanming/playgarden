// SPDX-License-Identifier: GPL-3.0-only
import {test,expect} from '@playwright/test';
import {enterMerge,setMergeRound,verifyMergeMotion,roundKey} from '../e2e/mergeJourney';
test('2048 exact published version, moving tile pixels and saved highest score',async({page,baseURL},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const failed:string[]=[];page.on('requestfailed',r=>failed.push(r.url()));
 const response=await page.goto('./');expect(response?.status()).toBe(200);if(process.env.GITHUB_SHA)await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content',process.env.GITHUB_SHA);
 expect(new URL(page.url()).pathname).toBe(new URL(baseURL!).pathname);await setMergeRound(page);await enterMerge(page);await verifyMergeMotion(page,info,'merge-published');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).current,roundKey);await page.reload();await enterMerge(page);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).current,roundKey)).toEqual(saved);await expect(page.locator('[data-merge-best]')).toHaveText('4');await page.getByRole('button',{name:'重来',exact:true}).click();await expect(page.locator('[data-merge-score]')).toHaveText('0');await expect(page.locator('[data-merge-best]')).toHaveText('4');await page.screenshot({path:info.outputPath('merge-published-restart-best.png'),fullPage:true});expect(errors).toEqual([]);expect(failed).toEqual([]);
});
