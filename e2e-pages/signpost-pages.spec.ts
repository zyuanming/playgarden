import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync('docs/signpost/campaign.json','utf8')).levels[29] as {solution:number[]};
test('Signpost exact public build solves the last puzzle and persists earned progress',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const r=await page.goto('./');expect(r?.status()).toBe(200);
 if(process.env.GITHUB_SHA)await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content',process.env.GITHUB_SHA);
 await page.getByRole('textbox',{name:'搜索游戏'}).fill('箭头路标');await page.getByRole('button',{name:'开始玩箭头路标',exact:true}).click();await page.getByLabel('选择关卡',{exact:true}).selectOption('29');
 const root=page.locator('.signpost-layout');await expect(root).toHaveAttribute('data-signpost-id','signpost-30');await page.screenshot({path:info.outputPath('signpost-public-start.png'),fullPage:true});
 await root.locator(`button[data-cell="${proof.solution[0]}"]`).click();for(const i of proof.solution.slice(1))await root.locator(`button[data-cell="${i}"]`).click();
 await expect(root).toHaveAttribute('data-signpost-won','true');await expect(page.locator('.status')).toHaveClass(/success/);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')!).completed.signpost)).toContain(29);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('signpost-public-completed.png'),fullPage:true});expect(errors).toEqual([]);
});
