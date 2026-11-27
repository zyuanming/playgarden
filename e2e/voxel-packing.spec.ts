import { expect,test,type Locator,type Page } from '@playwright/test';
import { captureErrors,chooseLevel,openGame } from './helpers';
import { packingProofs } from './fixtures/voxel-packing-data';
import type { Cube } from '../src/games/voxelPackingLogic';
import { STORAGE_KEY } from '../src/lib/progress';
const title='空间装箱';
const root=(p:Page)=>p.locator('.vp-game');
const button=(p:Page,n:string)=>p.getByRole('button',{name:n,exact:true});
const use=(loc:Locator,touch:boolean)=>touch?loc.tap():loc.press('Space');
const drop=(p:Page)=>p.locator('[data-vp-drop]');
const plane=(p:Page,z:number)=>p.locator('[data-vp-floor="'+z+'"]');
const attr=(p:Page,k:string,n:number|string)=>expect(root(p)).toHaveAttribute('data-vp-'+k,String(n));
const orientation=(cells:readonly Cube[])=>cells.map(c=>c.join(',')).sort().join(';');
const mask=(p:Page)=>root(p).getAttribute('data-vp-mask');
async function preview(p:Page,m:(typeof packingProofs)[number]['packing'][number],touch:boolean){
  await use(p.locator('[data-vp-piece="'+m.piece+'"]'),touch);
  await p.getByLabel('积木朝向',{exact:true}).selectOption(orientation(m.orientation));
  await use(p.locator('[data-vp-anchor="'+m.column+','+m.row+'"]'),touch);
  await attr(p,'preview','ok');await attr(p,'landing',m.landing);
}
async function place(p:Page,m:(typeof packingProofs)[number]['packing'][number],touch:boolean){
  const old=await mask(p);
  await preview(p,m,touch);
  await attr(p,'mask',old!);
  await use(drop(p),touch);
  await expect(root(p)).not.toHaveAttribute('data-vp-mask',old!);
}
async function won(p:Page,n:number){
  await attr(p,'won','true');
  await expect(p.locator('.status.success')).toContainText('所有方格填满');
  await expect.poll(()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)??'{}').completed?.['voxel-packing'],STORAGE_KEY)).toContain(n);
}
for(let i=0;i<12;i+=4){
  test('Vertical packing boards '+(i+1)+'–'+(i+4),async({page,isMobile},info)=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let n=i;n<i+4;n++){
      await chooseLevel(page,n);
      await attr(page,'id','voxel-packing-'+String(n+1).padStart(2,'0'));
      await attr(page,'history',0);
      if([0,7,11].includes(n)){
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        const actual=await page.locator('.vp-panel button').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height];}));
        expect(Math.min(...actual.flat())).toBeGreaterThanOrEqual(44);
        await page.screenshot({path:info.outputPath('initial-'+(n+1)+'.png'),fullPage:true,animations:'disabled'});
      }
      const order=packingProofs[n].packing;
      for(const [j,m] of order.entries()){
        await place(page,m,isMobile);
        await attr(page,'history',j+1);
        await attr(page,'sealed','false');
      }
      await won(page,n);
      if(n===0){
        await use(button(page,'下一关'),isMobile);
        await attr(page,'id','voxel-packing-02');
      }
    }
    expect(errors).toEqual([]);
  });
}

test('The box rejects the wall and rim, and rotating or viewing a layer is not a drop',async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await use(page.locator('[data-vp-anchor="1,0"]'),isMobile);
  await attr(page,'preview','wall');
  await expect(drop(page)).toBeDisabled();
  await attr(page,'mask',0);
  await place(page,packingProofs[0].packing[0],isMobile);
  const occupied=await mask(page);
  await use(page.locator('[data-vp-piece="1"]'),isMobile);
  await attr(page,'preview','rim');
  await expect(drop(page)).toBeDisabled();
  await attr(page,'mask',occupied!);
  await use(plane(page,1),isMobile);
  await attr(page,'layer',1);
  await attr(page,'mask',occupied!);
  await place(page,packingProofs[0].packing[1],isMobile);
  await won(page,0);
  await chooseLevel(page,11);
  const original=await root(page).getAttribute('data-vp-orientation');
  await use(page.locator('[data-vp-axis="X"]'),isMobile);
  await expect(root(page)).not.toHaveAttribute('data-vp-orientation',original!);
  await use(page.locator('[data-vp-axis="Y"]'),isMobile);
  await use(page.locator('[data-vp-axis="Z"]'),isMobile);
  const turn=await root(page).getAttribute('data-vp-orientation');
  for(let count=0;count<4;count++) await use(page.locator('[data-vp-axis="Z"]'),isMobile);
  await attr(page,'orientation',turn!);
  await attr(page,'history',0);
  expect(errors).toEqual([]);
});

test('A sealed bridge and a hole-free dead end differ; undo, hint and real mid-round save recover',async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,11);
  const spec=packingProofs[11];
  await place(page,spec.sealsHole!,isMobile);
  await attr(page,'sealed','true');
  await use(button(page,'提示'),isMobile);
  await attr(page,'hint','none');
  await expect(page.locator('.vp-status')).toContainText('封住了空格');
  await use(button(page,'撤销'),isMobile);
  await attr(page,'mask',0);
  await place(page,spec.deadEnd!,isMobile);
  await attr(page,'sealed','false');
  await use(button(page,'提示'),isMobile);
  await attr(page,'hint','none');
  await expect(page.locator('.vp-status')).toContainText('虽然没有封住空格');
  await use(button(page,'撤销'),isMobile);
  await attr(page,'history',0);
  await place(page,spec.packing[0],isMobile);
  await place(page,spec.packing[1],isMobile);
  const partial=await mask(page);
  await page.reload();
  await page.getByRole('textbox',{name:'搜索游戏'}).fill(title);
  await page.getByRole('button',{name:new RegExp('(?:开始玩|继续玩)'+title)}).click();
  await attr(page,'id','voxel-packing-12');
  await attr(page,'history',2);
  await attr(page,'mask',partial!);
  await use(button(page,'暂停'),isMobile);
  await expect(drop(page)).toBeDisabled();
  await use(button(page,'继续游戏'),isMobile);
  for(let k=2;k<6;k++){
    const before=await mask(page);
    await use(button(page,'提示'),isMobile);
    await attr(page,'hint','move');await attr(page,'mask',before!);
    if(k===2)await page.screenshot({path:info.outputPath('last-hint.png'),fullPage:true,animations:'disabled'});
    await use(drop(page),isMobile);
    await attr(page,'history',k+1);
  }
  await won(page,11);
  expect(errors).toEqual([]);
});
