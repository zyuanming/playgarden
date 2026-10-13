// SPDX-License-Identifier: GPL-3.0-only
// Narrow browser-focus regression; no puzzle completion or state injection.
import {expect,test as base,type Browser,type CDPSession,type Frame,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {captureErrors} from './helpers';
// The default context must never receive Playwright's focus override. Launching
// without a context leaves targets alone; the official noDefaults CDP connection
// skips focus emulation on this existing context, including newly opened tabs.
const test=base.extend({
  page:async({playwright,viewport,isMobile},use,info)=>{
    const port=9339+info.workerIndex;
    const owner=await playwright.chromium.launch({headless:false,timeout:10000,args:[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1']});
    let browser:Browser|undefined;
    try{
      browser=await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true,timeout:10000});
      const context=browser.contexts()[0];
      try{
        const page=await context.newPage();
        if(!viewport)throw Error('Focus regression requires a configured viewport');
        await page.setViewportSize(viewport);
        const device=await context.newCDPSession(page);
        try{
          // Keep the existing touch-sized project; this controls device input,
          // never focus, visibility, game state or synthetic DOM events.
          if(isMobile){
            await device.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true});
            await device.send('Emulation.setTouchEmulationEnabled',{enabled:true});
          }
          await use(page);
        }finally{await device.detach();}
      }finally{await context.close();} // Test runner retains failure trace/screenshots.
    }finally{try{await browser?.close();}finally{await owner.close();}}
  },
});
const FRAME='iframe[title="Black Hole Square 原版游戏"]';
type State={current:number;moves:number;paused:boolean;settled:boolean;board:number[];canvas:{width:number;height:number;x:number;y:number}};
test('Black Hole Square: real tab departure cancels a held gesture',async({page,baseURL},info)=>{
  test.setTimeout(60000);
  const mobile=info.project.name==='mobile',errors=captureErrors(page),events:unknown[]=[];
  let frame:Frame|null=null,other:Page|null=null,otherFocus:CDPSession|null=null,frameSession:CDPSession|null=null;
  let frameSessionError:string|null=null;
  const firstPlan=JSON.parse(readFileSync(new URL('./fixtures/black-hole-square-input-plans.json',import.meta.url),'utf8')).levels[0] as {initial:number[];checkpoints:number[][]};
  const browserSession=await page.context().newCDPSession(page);
  const touch=mobile?browserSession:null;
  const state=async()=>frame!.evaluate(()=>(window as unknown as {__blackHoleSquareSnapshot:()=>State}).__blackHoleSquareSnapshot());
  const observeFocus=async(stage:string)=>{
    const documentFocus=()=>({focused:document.hasFocus(),visibility:document.visibilityState,hidden:document.hidden,active:document.activeElement?.tagName??null,activeTitle:document.activeElement?.getAttribute('title')??null,events:(window as unknown as {__nativeFocusEvents?:unknown[]}).__nativeFocusEvents??[]});
    const query=async(session:CDPSession|null,method:string)=>{if(!session)return null;try{return await session.send(method as 'Target.getTargetInfo');}catch(error){return {error:String(error)};}};
    events.push({case:'read-only native focus diagnostics',stage,
      host:await page.evaluate(documentFocus),frame:frame&&!frame.isDetached()?await frame.evaluate(documentFocus):null,
      other:other?await other.evaluate(documentFocus):null,
      hostTarget:await query(browserSession,'Target.getTargetInfo'),hostWindow:await query(browserSession,'Browser.getWindowForTarget'),
      frameTarget:await query(frameSession,'Target.getTargetInfo'),frameSessionError,
      otherTarget:await query(otherFocus,'Target.getTargetInfo'),otherWindow:await query(otherFocus,'Browser.getWindowForTarget')});
  };
  try{
    await page.bringToFront();
    await page.goto(new URL('/',baseURL).href);await page.getByRole('textbox',{name:'搜索游戏'}).fill('Black Hole Square');
    await page.locator('.game-card').filter({hasText:/Black Hole Square/i}).getByRole('button',{name:/^开始玩/}).first().click();
    const handle=await page.locator(FRAME).elementHandle();frame=await handle!.contentFrame();
    if(!frame)throw Error('Game iframe has no content frame');
    try{frameSession=await page.context().newCDPSession(frame);}catch(error){frameSessionError=String(error);}
    await expect.poll(async()=>frame!.evaluate(()=>typeof (window as unknown as {__blackHoleSquareSnapshot?:unknown}).__blackHoleSquareSnapshot)).toBe('function');
    const next=page.getByRole('button',{name:'下一页 / 跳过',exact:true});
    for(const current of [1,2]){await expect(next).toBeEnabled();await next.click();await expect.poll(async()=>(await state()).current).toBe(current);}
    await expect.poll(async()=>{const s=await state();return s.settled&&!s.paused&&Math.abs(s.canvas.x-(s.canvas.width-320)/2)<1;}).toBe(true);
    const initial=await state();expect(initial.moves).toBe(0);expect(initial.board).toEqual(firstPlan.initial);
    const recordNativeFocus=()=>{
      const w=window as unknown as {__nativeFocusEvents:unknown[]};w.__nativeFocusEvents=[];
      const record=(e:Event)=>w.__nativeFocusEvents.push({event:e.type,focused:document.hasFocus(),visibility:document.visibilityState,trusted:e.isTrusted});
      window.addEventListener('blur',record);window.addEventListener('focus',record);document.addEventListener('visibilitychange',record);
    };
    await page.evaluate(recordNativeFocus);await frame.evaluate(recordNativeFocus);
    await frame.evaluate(()=>{
      const w=window as unknown as {__focusEvents:unknown[]};w.__focusEvents=[];
      window.addEventListener('blur',e=>w.__focusEvents.push({event:'blur',focused:document.hasFocus(),trusted:e.isTrusted}));
      window.addEventListener('message',e=>{if(e.data?.source==='playgarden-host'&&e.data.type==='cancel')w.__focusEvents.push({event:'host-cancel',focused:document.hasFocus()});});
    });
    await page.locator(FRAME).scrollIntoViewIfNeeded();const b=await page.locator(FRAME).boundingBox();if(!b)throw Error('Missing frame');
    const point={x:b.x+(136+initial.canvas.x)/initial.canvas.width*b.width,y:b.y+(134+initial.canvas.y)/initial.canvas.height*b.height};
    expect(point.x).toBeGreaterThan(0);expect(point.x).toBeLessThan(page.viewportSize()!.width);
    expect(point.y).toBeGreaterThan(0);expect(point.y).toBeLessThan(page.viewportSize()!.height);
    await observeFocus('before held gesture');
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    else{await page.mouse.move(point.x,point.y);await page.mouse.down();}
    await observeFocus('after held gesture');
    await expect.poll(()=>frame!.evaluate(()=>document.hasFocus())).toBe(true);
    other=await page.context().newPage();otherFocus=await page.context().newCDPSession(other);
    await other.goto('about:blank');await other.evaluate(recordNativeFocus);await other.bringToFront();
    await observeFocus('after other tab activation');
    await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(false);
    await expect.poll(()=>frame!.evaluate(()=>(window as unknown as {__focusEvents:{event:string;focused:boolean}[]}).__focusEvents.some(e=>['blur','host-cancel'].includes(e.event)&&!e.focused))).toBe(true);
    events.push({case:'real background tab',hostHasFocus:await page.evaluate(()=>document.hasFocus()),events:await frame.evaluate(()=>(window as unknown as {__focusEvents:unknown[]}).__focusEvents)});
    await page.bringToFront();await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(true);
    if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
    await expect.poll(async()=>(await state()).paused).toBe(false);
    await page.waitForTimeout(150);expect((await state()).board).toEqual(initial.board);expect((await state()).moves).toBe(0);
    // A new ordinary gesture still works; the interrupted one earned nothing.
    if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else await page.mouse.click(point.x,point.y);
    await expect.poll(async()=>(await state()).moves).toBe(1);
    await expect.poll(async()=>(await state()).board).toEqual(firstPlan.checkpoints[0]);
    events.push({case:'fresh gesture after return',state:await state()});
    await page.screenshot({path:info.outputPath('black-hole-square-return-from-real-tab.png'),fullPage:true});
    expect(errors).toEqual([]);
  }finally{
    try{await observeFocus('final observation');}catch(error){events.push({case:'diagnostic observation error',error:String(error)});}
    const finalEvents=frame&&!frame.isDetached()?await frame.evaluate(()=>(window as unknown as {__focusEvents?:unknown[]}).__focusEvents??[]):[];
    writeFileSync(info.outputPath('black-hole-square-real-tab-focus.json'),JSON.stringify({project:info.project.name,events,finalEvents,errors},null,2));
    if(frameSession)await frameSession.detach();if(otherFocus)await otherFocus.detach();if(other)await other.close();await browserSession.detach();
  }
});
