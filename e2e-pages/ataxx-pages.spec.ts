import {test,expect} from '@playwright/test';
test('Ataxx exact public build, final lesson, real AI reply and persisted progress',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto('./');expect(response?.status()).toBe(200);
 if(process.env.GITHUB_SHA)await expect(page.locator('meta[name="playgarden-commit"]')).toHaveAttribute('content',process.env.GITHUB_SHA);
 await page.getByRole('textbox',{name:'搜索游戏'}).fill('胞子争园');await page.getByRole('button',{name:'开始玩胞子争园',exact:true}).click();await page.getByRole('button',{name:'成长练习',exact:true}).click();await page.getByLabel('选择关卡',{exact:true}).selectOption('29');
 const root=page.locator('.ataxx-layout');await expect(root).toHaveAttribute('data-ataxx-id','ataxx-30');await page.screenshot({path:info.outputPath('ataxx-public-start.png'),fullPage:true});
 for(let turn=0;turn<3;turn++){
  if(await root.getAttribute('data-ataxx-phase')==='success')break;
  await expect(root).toHaveAttribute('data-ataxx-turn','1');await page.getByRole('button',{name:'提示',exact:true}).click();await expect(root.locator('.preview')).toHaveCount(1);await root.getByRole('button',{name:/^确认移动/}).click();await expect.poll(async()=>await root.getAttribute('data-ataxx-phase')==='success'||await root.getAttribute('data-ataxx-turn')==='1').toBe(true);
 }
 await expect(root).toHaveAttribute('data-ataxx-phase','success');await expect(page.locator('.status')).toHaveClass(/success/);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')!).completed.ataxx)).toContain(29);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('ataxx-public-completed.png'),fullPage:true});
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')!).completed.ataxx)).toContain(29);expect(errors).toEqual([]);
});
