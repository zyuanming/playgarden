import { expect,test,type Page } from "@playwright/test";
import { captureErrors,chooseLevel,openGame } from "./helpers";
import { STORAGE_KEY } from "../src/lib/progress";

const title = "图形序列";
const root = (p:Page) => p.locator(".figure-sequence");
const rule = (p:Page,code:string) => p.locator('[data-rule-card="'+code+'"]');
const frame = (p:Page,step:number) => p.locator('[data-step="'+step+'"]');
const status = (p:Page) => p.locator(".fs-status");
const button = (p:Page,name:string) => p.getByRole("button",{name,exact:true});
const activate = (loc:ReturnType<Page["locator"]>,touch:boolean) => touch ? loc.tap() : loc.press("Enter");
const hit = (p:Page,touch:boolean,name:string) => activate(button(p,name),touch);
const choose = (p:Page,touch:boolean,code:string) => activate(rule(p,code),touch);
const completion = (p:Page) => p.evaluate(key => JSON.parse(localStorage.getItem(key)??"{}").completed?.["figure-sequence"]??[],STORAGE_KEY);
async function done(p:Page,index:number) {
  await expect(root(p)).toHaveAttribute("data-won","true");
  await expect(p.locator(".status.success")).toHaveText("规则对上了每张已知图，留白也补齐了！");
  await expect.poll(()=>completion(p)).toContain(index);
}

const solutions = [
  ["R", [55, 436, 472, 91]],
  ["T", [461, 477, 461, 477]],
  ["H", [249, 444, 249, 444]],
  ["E", [284, 438, 284, 438]],
  ["RT", [400, 88, 72, 3, 19]],
  ["HK", [42, 42, 43, 46, 47, 47]],
  ["LC", [390, 45, 360, 390, 195, 360]],
  ["VR", [377, 125, 407, 470, 377, 125]],
  ["RK", [426, 234, 235, 175, 174, 426, 427]],
  ["TH", [218, 202, 418, 434, 218, 202, 418]],
  ["EV", [370, 472, 31, 181, 370, 472, 31, 181]],
  ["KR", [124, 125, 407, 406, 376, 377, 215, 214]],
] as const;
for(let start=0;start<solutions.length;start+=4) {
  const end=Math.min(solutions.length,start+4);
  test("Matching rules on levels "+(start+1)+"–"+end,async({page,isMobile})=>{
    const errors=captureErrors(page);
    await openGame(page,title);
    for(let i=start;i<end;i++){
      await chooseLevel(page,i);
      await expect(root(page)).toHaveAttribute("data-board","figure-sequence-"+String(i+1).padStart(2,"0"));
      await expect(button(page,"确认规则")).toBeDisabled();
      const [answer,values]=solutions[i];
      await choose(page,isMobile,answer);
      await expect(root(page)).toHaveAttribute("data-attempts","0");
      await expect(root(page)).toHaveAttribute("data-won","false");
      expect(await completion(page)).not.toContain(i);
      await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(0);
      for(const [step,bits] of values.entries()) await expect(frame(page,step)).toHaveAttribute("data-prediction",String(bits));
      await hit(page,isMobile,"确认规则");
      await done(page,i);
    }
    expect(errors).toEqual([]);
  });
}

test("Clear a preview without recording a submission and compare the middle steps",async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,0);
  await choose(page,isMobile,"L");
  await expect(frame(page,1)).toHaveAttribute("data-frame-state","conflict");
  await expect(frame(page,2)).toHaveAttribute("data-frame-state","clue");
  await expect(frame(page,3)).toHaveAttribute("data-bits","436");
  await hit(page,isMobile,"清除预览");
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","blank");
  await expect(root(page)).toHaveAttribute("data-attempts","0");
  await choose(page,isMobile,"R");
  await expect(frame(page,3)).toHaveAttribute("data-bits","91");
  await hit(page,isMobile,"撤销");
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","blank");
  await chooseLevel(page,4);
  await choose(page,isMobile,"RL");
  await expect(frame(page,1)).toHaveAttribute("data-frame-state","clue");
  await expect(frame(page,2)).toHaveAttribute("data-frame-state","conflict");
  await hit(page,isMobile,"提示");
  await expect(status(page)).toContainText("第一次不符在第 2 步");
  await expect(root(page)).toHaveAttribute("data-attempts","0");
  expect(await completion(page)).not.toContain(4);
  expect(errors).toEqual([]);
});

test("Level 8’s two plausible rules differ at only a middle clue",async({page,isMobile})=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,7);
  for(const [idx,code] of ["VE","VC"].entries()) {
    await choose(page,isMobile,code);
    await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(1);
    await expect(frame(page,3)).toHaveAttribute("data-frame-state","conflict");
    await expect(frame(page,5)).toHaveAttribute("data-prediction","125");
    await hit(page,isMobile,"提示");
    await expect(frame(page,3)).toHaveAttribute("data-active","true");
    await expect(status(page)).toContainText("第一次不符在第 3 步");
    await expect(root(page)).toHaveAttribute("data-attempts",String(idx));
    await hit(page,isMobile,"确认规则");
    await expect(root(page)).toHaveAttribute("data-won","false");
    expect(await completion(page)).not.toContain(7);
  }
  await choose(page,isMobile,"VR");
  await expect(frame(page,2)).toHaveAttribute("data-bits","407");
  await hit(page,isMobile,"确认规则");
  await done(page,7);
  expect(errors).toEqual([]);
});

test("Finale rejects the same-ending rule, predicts both hidden frames, and persists a real win",async({page,isMobile},info)=>{
  const errors=captureErrors(page);
  await openGame(page,title);
  await chooseLevel(page,11);
  await choose(page,isMobile,"KL");
  await expect(frame(page,7)).toHaveAttribute("data-prediction","214");
  await expect(page.locator('[data-frame-state="conflict"]')).toHaveCount(2);
  await expect(frame(page,3)).toHaveAttribute("data-frame-state","conflict");
  await expect(frame(page,4)).toHaveAttribute("data-frame-state","conflict");
  await hit(page,isMobile,"确认规则");
  await expect(status(page)).toContainText("第 3 步不是这张图");
  expect(await completion(page)).not.toContain(11);
  if(isMobile){
    for(const width of [360,390]){
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const c=await page.locator(".fs-card").evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
      expect(Math.min(...c)).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:info.outputPath("figure-sequence-"+width+".png"),fullPage:true,animations:"disabled"});
    }
  }
  await choose(page,isMobile,"KR");
  await expect(frame(page,2)).toHaveAttribute("data-bits","407");
  await expect(frame(page,5)).toHaveAttribute("data-bits","377");
  await expect(root(page)).toHaveAttribute("data-won","false");
  await hit(page,isMobile,"确认规则");
  await done(page,11);
  await page.reload();
  await expect.poll(()=>completion(page)).toContain(11);
  expect(errors).toEqual([]);
});
