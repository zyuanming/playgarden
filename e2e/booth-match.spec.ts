import {expect,test,type Page} from "@playwright/test";
import {captureErrors,chooseLevel,openGame} from "./helpers";
import {STORAGE_KEY} from "../src/lib/progress";

const title="展台配对";
const root=(p:Page)=>p.locator(".booth-match");
const status=(p:Page)=>p.locator(".bm-status");
const conflict=(p:Page)=>p.locator(".bm-conflict");
const team=(p:Page,i:number)=>p.locator('[data-team="'+i+'"]');
const booth=(p:Page,i:number)=>p.locator('[data-booth="'+i+'"]');
const activate=(b:ReturnType<Page["locator"]>,m:boolean)=>m?b.tap():b.press("Enter");
const hit=(p:Page,m:boolean,label:string)=>activate(p.getByRole("button",{name:label,exact:true}),m);
const done=(p:Page)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)??"{}").completed?.["booth-match"]??[],STORAGE_KEY);
async function move(p:Page,m:boolean,i:number,j:number){
  if(await team(p,i).getAttribute("aria-pressed")!=="true") await activate(team(p,i),m);
  await activate(booth(p,j),m);
}
async function arrange(p:Page,m:boolean,seats:string){
  for(const [i,place] of [...seats].entries()){
    if((await root(p).getAttribute("data-seats"))?.[i]!==place) await move(p,m,i,Number(place));
  }
  await expect(root(p)).toHaveAttribute("data-seats",seats);
}
const answers=["021","210","012","2301","2301","1230","0321","20431","04213","14320","420315","023541"];
for(let start=0;start<12;start+=3) test("Complete boards "+(start+1)+"–"+(start+3),async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  for(let level=start;level<start+3;level++){
    await chooseLevel(page,level);
    await expect(root(page)).toHaveAttribute("data-board","booth-match-"+String(level+1).padStart(2,"0"));
    await arrange(page,isMobile,answers[level]);
    await expect(root(page)).toHaveAttribute("data-won","false");
    expect(await done(page)).not.toContain(level);
    await hit(page,isMobile,"提交安排");
    await expect(root(page)).toHaveAttribute("data-won","true");
    await expect.poll(()=>done(page)).toContain(level);
  }
  expect(errors).toEqual([]);
});

test("Incomplete, displaced team, mutual conflict, and both stable answers",async({page,isMobile})=>{
  await openGame(page,title);
  await chooseLevel(page,0);
  await hit(page,isMobile,"提交安排");
  await expect(status(page)).toContainText("还有 3 支队伍");
  await move(page,isMobile,0,0);
  await move(page,isMobile,1,0);
  await expect(root(page)).toHaveAttribute("data-seats","_0_");
  await hit(page,isMobile,"撤销");
  await expect(root(page)).toHaveAttribute("data-seats","0__");
  await arrange(page,isMobile,"012");
  await hit(page,isMobile,"提交安排");
  await expect(conflict(page)).toHaveAttribute("data-conflict","2,1");
  await expect(conflict(page).locator('[data-rank-change="team"]')).toContainText("乐器（第 2）→ 木工（第 1）");
  await expect(conflict(page).locator('[data-rank-change="booth"]')).toContainText("海狸队（第 3）→ 燕子队（第 2）");
  expect(await done(page)).not.toContain(0);
  await activate(booth(page,1),isMobile);
  await expect(root(page)).toHaveAttribute("data-seats","021");
  await hit(page,isMobile,"提交安排");
  await expect.poll(()=>done(page)).toContain(0);
  await chooseLevel(page,2);
  for(const solution of ["012","210"]){
    await arrange(page,isMobile,solution);
    await hit(page,isMobile,"提交安排");
    await expect(root(page)).toHaveAttribute("data-won","true");
    await hit(page,isMobile,"重来");
  }
});

test("One swap exposes another blocking pair; undo restores the old arrangement",async({page,isMobile})=>{
  await openGame(page,title);
  await chooseLevel(page,4);
  await arrange(page,isMobile,"2013");
  await hit(page,isMobile,"提示");
  await expect(conflict(page)).toHaveAttribute("data-conflict","3,1");
  await activate(booth(page,1),isMobile);
  await expect(root(page)).toHaveAttribute("data-seats","2031");
  await hit(page,isMobile,"提交安排");
  await expect(conflict(page)).toHaveAttribute("data-conflict","2,0");
  expect(await done(page)).not.toContain(4);
  await hit(page,isMobile,"撤销");
  await expect(root(page)).toHaveAttribute("data-seats","2013");
  await hit(page,isMobile,"提交安排");
  await expect(conflict(page)).toHaveAttribute("data-conflict","3,1");
  await arrange(page,isMobile,"2301");
  await hit(page,isMobile,"提交安排");
  await expect.poll(()=>done(page)).toContain(4);
});

test("Finale rejects the minimum rank sum and accepts all three stable arrangements",async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,11);
  await arrange(page,isMobile,"231540");
  await expect(page.locator("[data-rank-total]")).toHaveText("27");
  await hit(page,isMobile,"提交安排");
  await expect(conflict(page)).toHaveAttribute("data-conflict","2,4");
  await expect(conflict(page).locator('[data-rank-change="team"]')).toContainText("木工（第 4）→ 种植（第 3）");
  await expect(conflict(page).locator('[data-rank-change="booth"]')).toContainText("白鹭队（第 3）→ 燕子队（第 2）");
  expect(await done(page)).not.toContain(11);
  if(isMobile) for(const width of [360,390]){
    await page.setViewportSize({width,height:844});
    const sizes=await page.locator(".bm-floor button,.bm-footer button").evaluateAll(controls=>controls.map(c=>[c.clientWidth,c.scrollWidth,c.getBoundingClientRect().height]));
    expect(sizes.every(([inside,scroll,h])=>inside>=scroll&&h>=44)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator(".bm-panel").screenshot({path:info.outputPath("booth-"+width+".png"),animations:"disabled"});
  }
  const prefs=page.locator(".bm-all summary");
  await activate(prefs,isMobile);
  await expect(page.locator(".bm-all h5")).toHaveCount(12);
  await expect(page.locator(".bm-all h5").last()).toBeVisible();
  await activate(prefs,isMobile);
  await activate(booth(page,4),isMobile);
  await expect(root(page)).toHaveAttribute("data-seats","234510");
  for(const [solution,total] of [["234510","28"],["023541","33"],["234501","31"]]){
    await arrange(page,isMobile,solution);
    await expect(page.locator("[data-rank-total]")).toHaveText(total);
    await expect(root(page)).toHaveAttribute("data-won","false");
    await hit(page,isMobile,"提交安排");
    await expect(root(page)).toHaveAttribute("data-won","true");
    await expect.poll(()=>done(page)).toContain(11);
    await hit(page,isMobile,"重来");
  }
  await page.reload();
  await expect.poll(()=>done(page)).toContain(11);
  expect(errors).toEqual([]);
});
