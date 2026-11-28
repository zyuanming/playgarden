import {expect,test,type Locator,type Page} from '@playwright/test';
import {captureErrors,chooseLevel,openGame} from './helpers';
import {equationExpansionProofs,equationProofs} from './fixtures/equation-balance-data';
import {STORAGE_KEY} from '../src/lib/progress';
const title='天平等式';
const root=(p:Page)=>p.locator('.eq-game');
const card=(p:Page,x:string)=>p.locator('[data-eq-card="'+x+'"]');
const apply=(p:Page)=>p.locator('[data-eq-apply]');
const control=(p:Page,s:string)=>p.getByRole('button',{name:s,exact:true});
const use=(l:Locator,touch:boolean)=>touch?l.tap():l.press('Space');
const attr=(p:Page,k:string,v:string|number)=>expect(root(p)).toHaveAttribute('data-eq-'+k,String(v));
const msg=(p:Page)=>p.locator('.eq-message');
async function play(p:Page,actions:string,touch:boolean){
  for(const x of actions){
    const [terms,history,left]=await Promise.all(['terms','history','left'].map(k=>root(p).getAttribute('data-eq-'+k)));
    await use(card(p,x),touch);
    await expect(card(p,x)).toHaveAttribute('aria-pressed','true');
    await attr(p,'terms',terms!);await attr(p,'left',left!);await attr(p,'history',history!);
    await use(apply(p),touch);
    await attr(p,'history',history+x);
    await attr(p,'left',Number(left)-1);
    await expect(card(p,x)).toBeDisabled();
  }
}
async function complete(p:Page,i:number,n:number){
  await attr(p,'won','true');await attr(p,'terms','1,0,0,'+n);
  await expect(p.locator('.status.success')).toContainText('x = '+(n<0?'−'+Math.abs(n):String(n)));
  await expect.poll(()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').completed?.['equation-balance'],STORAGE_KEY)).toContain(i);
}
for(let start=0;start<12;start+=4){
  test('Equation proof on boards '+(start+1)+'–'+(start+4),async({page,isMobile},info)=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let i=start;i<start+4;i++){
      await chooseLevel(page,i);await attr(page,'id','equation-balance-'+String(i+1).padStart(2,'0'));
      if([0,5,11].includes(i)){
        expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth)).toBe(true);
        expect(await page.locator('.eq-panel button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;}))).toBe(true);
        await page.screenshot({path:info.outputPath('start-'+(i+1)+'.png'),fullPage:true,animations:'disabled'});
      }
      const {orders,x}=equationProofs[i];
      await play(page,orders[0],isMobile);
      await attr(page,'left',0);await complete(page,i,x);
      if(i===0){
        await use(control(page,'下一关'),isMobile);
        await attr(page,'id','equation-balance-02');
        await expect(page.locator('.status')).not.toHaveClass(/success/);
      }
    }
    expect(errors).toEqual([]);
  });
}
test('Whole-token division blocks without spending a card; legal proofs are not unique',async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,1);
  await use(card(page,'A'),isMobile);
  await expect(page.locator('.eq-preview')).toContainText('左盘的 3 枚 x 片不能分成 2 个');
  await expect(page.locator('.eq-preview')).toContainText('普通代数可以有分数');
  await expect(apply(page)).toBeDisabled();
  await attr(page,'terms','3,0,0,12');await attr(page,'left',1);await attr(page,'history','');
  await page.screenshot({path:info.outputPath('blocked-division.png'),fullPage:true,animations:'disabled'});
  await play(page,'B',isMobile);await complete(page,1,4);
  await chooseLevel(page,2);
  for(const proof of ['AB','BA']){
    await play(page,proof,isMobile);await complete(page,2,5);
    await use(control(page,'重来'),isMobile);await attr(page,'history','');
  }
  await chooseLevel(page,6);
  await play(page,'B',isMobile);await attr(page,'left',2);
  await use(control(page,'提示'),isMobile);await expect(msg(page)).toContainText('无法解开');
  await use(control(page,'撤销'),isMobile);await attr(page,'left',3);await expect(card(page,'B')).toBeEnabled();
  await play(page,'CE',isMobile);await expect(page.locator('[data-eq-current]')).toHaveText('x + 1 = 5');
  await play(page,'B',isMobile);await complete(page,6,4);
  expect(errors).toEqual([]);
});

test('Final round recovers from a legal dead end, resumes, and accepts all three distinct proofs',async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,11);
  await play(page,'G',isMobile);await attr(page,'terms','26,0,2,72');
  await openGame(page,title);await attr(page,'id','equation-balance-12');await attr(page,'history','G');
  await attr(page,'left',4);await expect(card(page,'G')).toBeDisabled();
  await use(control(page,'暂停'),isMobile);await expect(card(page,'A')).toBeDisabled();
  await use(control(page,'继续游戏'),isMobile);
  await use(control(page,'提示'),isMobile);await attr(page,'hint','');
  await expect(msg(page)).toContainText('无法解开');
  await attr(page,'history','G');
  await use(control(page,'撤销'),isMobile);
  await attr(page,'terms','13,0,1,36');await attr(page,'left',5);await expect(card(page,'G')).toBeEnabled();
  await use(control(page,'提示'),isMobile);
  await attr(page,'hint','B');await attr(page,'history','');await attr(page,'left',5);
  await expect(page.locator('[data-eq-projection]')).toHaveText('9x = −3x + 36');
  await page.screenshot({path:info.outputPath('final-proof-preview.png'),fullPage:true,animations:'disabled'});
  for(const route of ['BGFED','EGBDF','EGBFD']){
    await play(page,route,isMobile);await complete(page,11,3);
    if(route!=='EGBFD'){
      await use(control(page,'重来'),isMobile);await attr(page,'history','');await attr(page,'left',5);
    }
  }
  await use(control(page,'下一关'),isMobile);
  await attr(page,'id','equation-balance-13');
  await attr(page,'history','');
  await play(page,'CBF',isMobile);await complete(page,12,-2);
  await page.reload();
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').completed?.['equation-balance'],STORAGE_KEY)).toEqual(expect.arrayContaining([11,12]));
  expect(errors).toEqual([]);
});

for(let start=0; start<equationExpansionProofs.length; start+=8){
  test('Expansion proofs on boards '+(start+13)+'–'+(start+20),async({page,isMobile})=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let k=start;k<start+8;k++){
      const i=k+12;
      const {orders,x}=equationExpansionProofs[k];
      await chooseLevel(page,i);
      await attr(page,'id','equation-balance-'+(i+1));
      await attr(page,'history','');
      await play(page,orders[0],isMobile);
      await attr(page,'left',0);
      await complete(page,i,x);
    }
    expect(errors).toEqual([]);
  });
}

test('New early boards distinguish a blocked division from a dead move; level 14 has two openings',async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,12);
  await use(card(page,'A'),isMobile);
  await expect(apply(page)).toBeDisabled();
  await attr(page,'terms','20,15,15,5');await attr(page,'left',3);await attr(page,'history','');
  await play(page,'B',isMobile);
  await attr(page,'terms','17,15,12,5');
  await use(control(page,'提示'),isMobile);
  await expect(msg(page)).toContainText('无法解开');
  await use(control(page,'撤销'),isMobile);
  await use(control(page,'提示'),isMobile);
  await attr(page,'hint','C');await attr(page,'history','');await attr(page,'left',3);
  await expect(page.locator('[data-eq-projection]')).toHaveText('4x + 3 = 3x + 1');
  await play(page,'CFB',isMobile);await complete(page,12,-2);
  await chooseLevel(page,13);
  await play(page,'ADE',isMobile);await complete(page,13,6);
  await use(control(page,'重来'),isMobile);
  await play(page,'DAE',isMobile);await complete(page,13,6);
  expect(errors).toEqual([]);
});

test('Multiplication can be essential and a zero solution is credited',async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,48);
  await use(control(page,'提示'),isMobile);
  await attr(page,'hint','B');await attr(page,'history','');await attr(page,'left',5);
  await play(page,'BCADG',isMobile);await complete(page,48,-4);
  await chooseLevel(page,66);
  await play(page,'HEFGD',isMobile);await complete(page,66,0);
  await use(control(page,'重来'),isMobile);
  await play(page,'HFEGD',isMobile);await complete(page,66,0);
  expect(errors).toEqual([]);
});

test('Level 100 permits four proofs and makes a blocked division possible',async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);await chooseLevel(page,99);
  const panel=page.getByRole('region',{name:'等式工作台'});
  const screenshot=(name:string)=>panel.screenshot({path:info.outputPath(name+'.png'),animations:'disabled'});
  async function checkLayout(){
    expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth)).toBe(true);
    expect(await panel.locator('button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;}))).toBe(true);
    await expect(page.getByLabel('选择关卡',{exact:true})).toHaveValue('99');
  }
  await use(card(page,'D'),isMobile);
  await expect(apply(page)).toBeDisabled();
  await expect(page.locator('.eq-preview')).toContainText('普通代数可以有分数');
  await attr(page,'terms','-51,-63,-66,-33');await attr(page,'left',6);await attr(page,'history','');
  await checkLayout();await screenshot('blocked-100');
  await play(page,'A',isMobile);
  await attr(page,'terms','-48,-63,-63,-33');
  await use(control(page,'提示'),isMobile);
  await expect(msg(page)).toContainText('无法解开');
  await attr(page,'history','A');
  await use(control(page,'撤销'),isMobile);
  await attr(page,'terms','-51,-63,-66,-33');await attr(page,'left',6);
  await use(control(page,'提示'),isMobile);
  await attr(page,'hint','E');await attr(page,'history','');
  await play(page,'EGH',isMobile);
  await attr(page,'terms','-10,-15,-15,-5');
  await use(card(page,'D'),isMobile);
  await expect(apply(page)).toBeEnabled();
  await expect(page.locator('[data-eq-projection]')).toHaveText('−2x − 3 = −3x − 1');
  await screenshot('divide-now-100');
  await play(page,'DAF',isMobile);await complete(page,99,2);
  for(const proof of ['EGHDFA','EHGDAF','EHGDFA']){
    await use(control(page,'重来'),isMobile);
    await play(page,proof,isMobile);await complete(page,99,2);
  }
  await expect(page.locator('.eq-log li')).toHaveCount(6);
  await screenshot('proof-100');
  if(isMobile){
    await page.setViewportSize({width:360,height:844});
    await checkLayout();
    await expect(page.locator('.eq-log li')).toHaveCount(6);
    await page.screenshot({path:info.outputPath('proof-100-360.png'),fullPage:true,animations:'disabled'});
  }
  expect(errors).toEqual([]);
});
