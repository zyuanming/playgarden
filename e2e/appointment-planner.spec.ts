import {expect,test,type Locator,type Page} from '@playwright/test';
import {captureErrors,chooseLevel,openGame} from './helpers';
import {dayProofs} from './fixtures/appointment-planner-data';
import {STORAGE_KEY} from '../src/lib/progress';
const title='活动日程';
const root=(p:Page)=>p.locator('.ap-game');
const add=(p:Page)=>p.locator('[data-ap-add]');
const back=(p:Page)=>p.locator('[data-ap-back]');
const click=(l:Locator,touch:boolean)=>touch?l.tap():l.press('Space');
const control=(p:Page,n:string)=>p.getByRole('button',{name:n,exact:true});
const attr=(p:Page,k:string,n:number|string)=>expect(root(p)).toHaveAttribute('data-ap-'+k,String(n));
const select=(p:Page,k:string,touch:boolean)=>click(p.locator('[data-ap-task="'+k+'"]'),touch);
async function place(p:Page,id:string,touch:boolean,start?:number){
  const before=await root(p).getAttribute('data-ap-order');
  await select(p,id,touch);
  await attr(p,'picked',id);
  await attr(p,'order',before!);
  if(start!==undefined)await expect(p.locator('[data-ap-preview]')).toHaveAttribute('data-ap-start',String(start));
  await click(add(p),touch);
  await attr(p,'order',before+id);
  if(start!==undefined)await expect(p.locator('[data-ap-stop="'+id+'"]')).toHaveAttribute('data-ap-start',String(start));
}
async function play(p:Page,order:string,touch:boolean,starts?:readonly number[]){
  for(const [i,id] of [...order].entries())await place(p,id,touch,starts?.[i]);
}
async function win(p:Page,i:number){
  await attr(p,'won','true');
  await expect(p.locator('.status.success')).toContainText('所有活动完成');
  await expect.poll(()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').completed?.['appointment-planner'],STORAGE_KEY)).toContain(i);
}
for(let start=0;start<12;start+=4){
  test('Schedules campus boards '+(start+1)+'–'+(start+4),async({page,isMobile},info)=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let i=start;i<start+4;i++){
      await chooseLevel(page,i);
      await attr(page,'id','appointment-planner-'+String(i+1).padStart(2,'0'));
      if([0,5,11].includes(i)){
        expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth)).toBe(true);
        expect(await page.locator('.ap-panel button').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44))).toBe(true);
        await page.screenshot({path:info.outputPath('start-'+(i+1)+'.png'),fullPage:true,animations:'disabled'});
      }
      const [order,starts,end]=dayProofs[i][0];
      await play(page,order,isMobile,starts);
      if(i>=8){
        await attr(page,'return',end);await attr(page,'won','false');
        await click(back(page),isMobile);await attr(page,'returned','true');
      }else await attr(page,'time',end);
      await win(page,i);
      if(i===0){
        await click(control(page,'下一关'),isMobile);
        await attr(page,'id','appointment-planner-02');
      }
    }
    expect(errors).toEqual([]);
  });
}
test('Local legal choice can strand D, undo and hints restore it; level 6 admits two orders',async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,4);
  await place(page,'C',isMobile,6);
  await attr(page,'time',7);
  await select(page,'D',isMobile);
  const preview=page.locator('.ap-preview');
  await expect(preview).toHaveAttribute('data-ap-legal','false');
  await expect(preview).toContainText('09:45 结束');
  await expect(preview).toContainText('09:40 关门');
  await expect(add(page)).toBeDisabled();
  await click(control(page,'提示'),isMobile);
  await expect(page.locator('.ap-message')).toContainText('剩余活动 D');
  await click(control(page,'撤销'),isMobile);
  await attr(page,'time',0);
  await click(control(page,'提示'),isMobile);
  await attr(page,'hint','D');
  await attr(page,'order','');
  await play(page,'DCAB',isMobile,dayProofs[4][0][1]);await win(page,4);
  await chooseLevel(page,5);
  for(const [order,starts,end] of dayProofs[5]){
    await play(page,order,isMobile,starts);
    await attr(page,'time',end);await win(page,5);
    await click(control(page,'重来'),isMobile);
  }
  expect(errors).toEqual([]);
});
test('Final six tasks can be done yet arrive late; real saved prefix returns exactly on time',async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,11);
  await play(page,'BEFCA',isMobile);
  await select(page,'D',isMobile);
  await expect(page.locator('.ap-preview')).toContainText('预计 12:25 回到礼堂；截止 12:20');
  await click(add(page),isMobile);
  await attr(page,'order','BEFCAD');await attr(page,'return',41);
  await expect(page.getByRole('region',{name:'回礼堂时间'})).toContainText('预计到达12:25');
  await expect(page.locator('.ap-return')).toContainText('回礼堂截止12:20');
  await expect(page.locator('.ap-return')).toContainText('晚了 5 分钟');
  await expect(back(page)).toBeDisabled();await attr(page,'won','false');
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').completed?.['appointment-planner'],STORAGE_KEY)).not.toContain(11);
  await page.screenshot({path:info.outputPath('late-return.png'),fullPage:true,animations:'disabled'});
  await click(control(page,'提示'),isMobile);
  await expect(page.locator('.ap-message')).toContainText('预计 12:25');
  for(let i=0;i<3;i++)await click(control(page,'撤销'),isMobile);
  await attr(page,'order','BEF');await attr(page,'time',29);
  await openGame(page,title);
  await attr(page,'order','BEF');await attr(page,'time',29);
  await click(control(page,'暂停'),isMobile);
  await expect(page.locator('[data-ap-task="A"]')).toBeDisabled();
  await click(control(page,'继续游戏'),isMobile);
  await play(page,'ACD',isMobile,[29,30,34]);
  await expect(back(page)).toBeEnabled();await attr(page,'return',40);
  await expect(page.locator('.ap-return')).toContainText('恰好准时');
  await page.screenshot({path:info.outputPath('exact-return.png'),fullPage:true,animations:'disabled'});
  await click(back(page),isMobile);
  await expect(page.locator('.ap-return')).toContainText('实际到达12:20');
  await win(page,11);
  expect(errors).toEqual([]);
});
