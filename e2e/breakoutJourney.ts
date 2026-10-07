// SPDX-License-Identifier: GPL-3.0-only
import {expect,type Page,type TestInfo} from '@playwright/test';
export async function openBreakout(page:Page,url='/'){
 await page.goto(url);await page.getByRole('textbox',{name:'搜索游戏'}).fill('反弹砖园');await page.getByRole('button',{name:'开始玩反弹砖园',exact:true}).click();await expect(page.locator('.breakout-garden')).toBeVisible();
}
export async function freezeBreakout(page:Page){await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));}
export async function playBreakout(page:Page,info:TestInfo,level:number){
 await page.getByLabel('选择关卡',{exact:true}).selectOption(String(level));await page.locator('.breakout-stage').scrollIntoViewIfNeeded();
 if([0,5,11].includes(level))await page.screenshot({path:info.outputPath(`breakout-${level+1}-start.png`),fullPage:true});
 await page.getByRole('button',{name:'发球',exact:true}).click();
 let ended=false;
 for(let n=0;n<1400;n++){
  const p=await page.locator('.breakout-garden').evaluate(el=>{
   const d=(el as HTMLElement).dataset;const x=Number(d.breakoutX),y=Number(d.breakoutY),vx=Number(d.breakoutVx),vy=Number(d.breakoutVy);
   let target=Number(d.breakoutPaddle);
   if(vy>0){let raw=x+vx*(456-y)/vy;let m=((raw-6)%776+776)%776;let landing=6+(m<=388?m:776-m);
    const bricks=[...el.querySelectorAll('[data-brick]')].map(b=>({x:Number((b as HTMLElement).dataset.x)+22,y:Number((b as HTMLElement).dataset.y)+19})).sort((a,b)=>b.y-a.y||Math.abs(a.x-landing)-Math.abs(b.x-landing));
    if(bricks.length){const slope=(bricks[0].x-landing)/(456-bricks[0].y-6);target=landing-(slope/Math.sqrt(1+slope*slope)/.85*44);}else target=landing;
   }
   return {phase:d.breakoutPhase,target:Math.max(44,Math.min(356,target))};
  });
  if(p.phase==='won'){ended=true;break;}expect(p.phase,`stage ${level+1}`).not.toBe('lost');
  if(p.phase==='ready')await page.getByRole('button',{name:'发球',exact:true}).click();
  const rect=await page.locator('.breakout-stage').boundingBox();if(!rect)throw Error('no board');
  // Real pointer input against visible geometry; no state/store injection or win API.
  await page.mouse.move(rect.x+p.target/400*rect.width,rect.y+rect.height*.90);
  await page.clock.runFor(200);
  if(n===20&&[0,5,11].includes(level))await page.screenshot({path:info.outputPath(`breakout-${level+1}-playing.png`),fullPage:true});
 }
 expect(ended,`stage ${level+1} did not clear`).toBe(true);await expect(page.locator('.breakout-garden')).toHaveAttribute('data-breakout-won','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if([0,5,11].includes(level))await page.screenshot({path:info.outputPath(`breakout-${level+1}-cleared.png`),fullPage:true});
}
