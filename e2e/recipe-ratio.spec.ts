import {expect,test,type Page} from "@playwright/test";
import {captureErrors,chooseLevel,openGame} from "./helpers";
import {STORAGE_KEY} from "../src/lib/progress";

const title="配方比例";
const root=(p:Page)=>p.locator(".recipe-ratio");
const order=(p:Page,i:number)=>p.locator('[data-order="'+i+'"]');
const control=(p:Page,key:string,i:number)=>p.locator('[data-control="'+key+"-"+i+'"]');
const stock=(p:Page,i:number)=>p.locator('[data-stock="'+i+'"]');
const hit=(p:Page,touch:boolean,name:string)=>touch?p.getByRole("button",{name,exact:true}).tap():p.getByRole("button",{name,exact:true}).press("Enter");
const done=(p:Page)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)??"{}").completed?.["recipe-ratio"]??[],STORAGE_KEY);
const names=["果露","茶汤","清水"],cups=["甲杯勺数","乙杯勺数","丙杯勺数"];

async function set(p:Page,t:boolean,key:"mix"|"scoops",target:number[]){
  const labels=key==="mix"?names:cups;
  const now=await Promise.all(target.map(async(_,i)=>Number(await control(p,key,i).textContent())));
  for(let i=0;i<target.length;i++) for(;now[i]>target[i];now[i]--) await hit(p,t,"减少"+labels[i]);
  for(let i=0;i<target.length;i++) for(;now[i]<target[i];now[i]++) await hit(p,t,"增加"+labels[i]);
}
const answers=[{"mix":[1,2],"scoops":[1],"used":[1,2],"pours":[[1,2]]},{"mix":[3,1],"scoops":[2],"used":[6,2],"pours":[[6,2]]},{"mix":[1,3],"scoops":[1],"used":[1,3],"pours":[[3,3]]},{"mix":[2,4],"scoops":[1,2],"used":[6,12],"pours":[[5,4],[9,9]]},{"mix":[4,2],"scoops":[1,3],"used":[16,8],"pours":[[4,8],[14,10]]},{"mix":[3,3],"scoops":[2,2],"used":[12,12],"pours":[[6,12],[12,6]]},{"mix":[1,3],"scoops":[2,2],"used":[4,12],"pours":[[6,6],[3,9]]},{"mix":[1,2,3],"scoops":[3,1],"used":[4,8,12],"pours":[[6,6,12],[1,2,3]]},{"mix":[3,1,2],"scoops":[2,1],"used":[9,3,6],"pours":[[6,2,4],[3,5,4]]},{"mix":[2,1,3],"scoops":[1,3],"used":[8,4,12],"pours":[[7,2,3],[6,4,14]]},{"mix":[1,3,2],"scoops":[4,3,2],"used":[9,27,18],"pours":[[6,12,9],[4,10,10],[3,6,9]]},{"mix":[3,2,1],"scoops":[3,3,1],"used":[21,14,7],"pours":[[14,6,4],[14,6,4],[3,7,2]]}];
for(let start=0;start<answers.length;start+=3) test("Deliver levels "+(start+1)+"–"+(start+3),async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  for(let i=start;i<start+3;i++){
    await chooseLevel(page,i);
    await expect(root(page)).toHaveAttribute("data-board","recipe-ratio-"+String(i+1).padStart(2,"0"));
    const {mix,scoops,pours}=answers[i];
    await set(page,isMobile,"mix",mix);
    await set(page,isMobile,"scoops",scoops);
    await expect(root(page)).toHaveAttribute("data-won","false");
    expect(await done(page)).not.toContain(i);
    for(const [j,v] of pours.entries()){
      await expect(order(page,j)).toHaveAttribute("data-actual",v.join(","));
      await expect(order(page,j)).toHaveAttribute("data-ratio","true");
      await expect(order(page,j)).toHaveAttribute("data-volume","true");
    }
    await hit(page,isMobile,"交付");
    await expect(root(page)).toHaveAttribute("data-won","true");
    await expect.poll(()=>done(page)).toContain(i);
  }
  expect(errors).toEqual([]);
});
test("Ratio preserved at double volume and two orders share the recipe",async({page,isMobile})=>{
  await openGame(page,title);
  await chooseLevel(page,1);
  await set(page,isMobile,"mix",[3,1]);
  await expect(order(page,0)).toHaveAttribute("data-ratio","true");
  await expect(order(page,0)).toHaveAttribute("data-volume","false");
  await hit(page,isMobile,"交付");
  await expect(page.locator(".rr-status")).toContainText("容量");
  await set(page,isMobile,"scoops",[2]);
  await expect(order(page,0)).toHaveAttribute("data-actual","6,2");
  await expect(order(page,0)).toHaveAttribute("data-ratio","true");
  await expect(order(page,0)).toHaveAttribute("data-volume","true");
  await hit(page,isMobile,"交付");
  await expect.poll(()=>done(page)).toContain(1);
  await chooseLevel(page,3);
  await set(page,isMobile,"mix",[3,3]);
  await set(page,isMobile,"scoops",[4,1]);
  await expect(order(page,0)).toHaveAttribute("data-ratio","true");
  await expect(order(page,0)).toHaveAttribute("data-volume","true");
  await expect(order(page,1)).toHaveAttribute("data-ratio","false");
  await hit(page,isMobile,"交付");
  await expect(root(page)).toHaveAttribute("data-won","false");
  await set(page,isMobile,"mix",[2,4]);
  await set(page,isMobile,"scoops",[1,2]);
  await hit(page,isMobile,"交付");
  await expect.poll(()=>done(page)).toContain(3);
});
test("Finale rejects one missing tea mark, undo restores stock, completion survives reload",async({page,isMobile})=>{
  await openGame(page,title);
  await chooseLevel(page,11);
  await set(page,isMobile,"mix",[2,3,1]);
  await set(page,isMobile,"scoops",[1,1,3]);
  await expect(page.locator('[data-order][data-ratio="true"][data-volume="true"]')).toHaveCount(3);
  for(const [i,n] of [11,-1,3].entries()) await expect(stock(page,i)).toHaveAttribute("data-remaining",String(n));
  await hit(page,isMobile,"交付");
  await expect(page.locator(".rr-status")).toHaveText("共享库存：茶汤还差 1 格。");
  await expect(root(page)).toHaveAttribute("data-won","false");
  expect(await done(page)).not.toContain(11);
  await hit(page,isMobile,"减少丙杯勺数");
  await expect(stock(page,1)).toHaveAttribute("data-remaining","2");
  await hit(page,isMobile,"撤销");
  await expect(stock(page,1)).toHaveAttribute("data-remaining","-1");
  await set(page,isMobile,"mix",[3,2,1]);
  await set(page,isMobile,"scoops",[3,3,1]);
  for(const [i,n] of [0,0,1].entries()) await expect(stock(page,i)).toHaveAttribute("data-remaining",String(n));
  await hit(page,isMobile,"交付");
  await expect.poll(()=>done(page)).toContain(11);
  await page.reload();
  await expect.poll(()=>done(page)).toContain(11);
});
