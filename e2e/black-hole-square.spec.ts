// SPDX-License-Identifier: GPL-3.0-only
// Prepared from static source only. NOT EXECUTED. One targeted invocation runs
// both configured desktop/mobile projects using real pointer/keyboard input.
import {expect,test,type Frame,type Page} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {captureErrors} from './helpers';
const FRAME='iframe[title="Black Hole Square 原版游戏"]';
const STORAGE='playgarden.black-hole-square.native.v1';
type Snapshot={current:number;puzzle:string;frames:number;time:number;paused:boolean;disposed:boolean;settled:boolean;
  moves:number;budget:number;feedback:string;ending:boolean;allSolved:boolean;solved:string[];saved:boolean;
  board:number[];overlays:number[];canvas:{width:number;height:number;x:number;y:number};
  native:{current:number;solved:string[];solutions:Record<string,string[]>};
  audio:{state:string;enabled:boolean;paused:boolean;gesture:boolean;oscillators:number;schedulers:number}};
type Plan={level:number;id:string;status:string;budget:number;initial:number[];cells:number[];checkpoints:number[][]};
const fixture=JSON.parse(readFileSync(new URL('./fixtures/black-hole-square-input-plans.json',import.meta.url),'utf8')) as {
  status:string;upstreamCommit:string;levels:Plan[];failurePlan:{level:number;cells:number[];checkpoints:number[][];expectedFeedback:string}};
async function gameFrame(page:Page):Promise<Frame|null>{const handle=await page.locator(FRAME).elementHandle();return handle?handle.contentFrame():null;}
async function read(page:Page):Promise<Snapshot|null>{
  try{return await (await gameFrame(page))?.evaluate(()=>{
    const get=(window as unknown as {__blackHoleSquareSnapshot?:()=>Snapshot|null}).__blackHoleSquareSnapshot;
    return get?.()??null;
  })??null;}catch(error){if(/detached|destroyed|Execution context|Cannot find context/.test(String(error)))return null;throw error;}
}
async function observed(page:Page){await expect.poll(async()=>!!await read(page),{timeout:15000,intervals:[20,50]}).toBe(true);return (await read(page))!;}
async function idle(page:Page,level?:number){
  await expect.poll(async()=>{const s=await read(page);return !!s&&!s.paused&&s.settled&&
    Math.abs(s.canvas.x-(s.canvas.width-320)/2)<1&&
    (level===undefined||s.current===level+2);},{timeout:15000,intervals:[20,30]}).toBe(true);
  return observed(page);
}
async function credits(page:Page):Promise<number[]>{return page.evaluate(()=>JSON.parse(localStorage.getItem('playgarden.progress.v2')??'{}').completed?.['black-hole-square']??[]);}
async function board(page:Page,level:number,expected:number[]){
  await expect.poll(async()=>{const s=await read(page);return s?.current===level+2?s.board:null;},{timeout:10000,intervals:[10,20]}).toEqual(expected);
}
async function open(page:Page,navigate=true,ready=true){
  if(navigate)await page.goto('/');
  await page.getByRole('textbox',{name:'搜索游戏'}).fill('Black Hole Square');
  const card=page.locator('.game-card').filter({hasText:/Black Hole Square/i});await expect(card).toHaveCount(1);
  await card.getByRole('button',{name:/^开始玩/}).first().click();
  await expect(page.locator('.game-main')).toHaveAttribute('data-game','black-hole-square');
  if(ready)await observed(page);
}
async function select(page:Page,level:number){await page.getByLabel('选择关卡',{exact:true}).selectOption(String(level));await idle(page,level);}
async function canvasPoint(page:Page,x:number,y:number){
  await page.locator(FRAME).scrollIntoViewIfNeeded();
  const s=await observed(page),bounds=await page.locator(FRAME).boundingBox();if(!bounds)throw Error('Missing game frame');
  const point={x:bounds.x+x/s.canvas.width*bounds.width,y:bounds.y+y/s.canvas.height*bounds.height};
  const viewport=page.viewportSize();if(!viewport)throw Error('Missing viewport');
  expect(point.x).toBeGreaterThanOrEqual(0);expect(point.x).toBeLessThan(viewport.width);
  expect(point.y).toBeGreaterThanOrEqual(0);expect(point.y).toBeLessThan(viewport.height);
  return point;
}
async function tapPoint(page:Page,mobile:boolean,point:{x:number;y:number}){
  if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
}
async function tapCanvas(page:Page,mobile:boolean,x:number,y:number){await tapPoint(page,mobile,await canvasPoint(page,x,y));}
async function activate(page:Page,mobile:boolean,cell:number){
  const s=await idle(page);await page.locator(FRAME).scrollIntoViewIfNeeded();
  await tapCanvas(page,mobile,16+cell%6*48+24+s.canvas.x,62+Math.floor(cell/6)*48+24+s.canvas.y);
}
function denyWrites(key:string){
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(name:string,value:string){
    if(name===key)throw new DOMException('Simulated native progress quota failure','QuotaExceededError');
    return original.call(this,name,value);
  };
}

test('Black Hole Square: original 18 puzzles, honest skips and owned lifecycle',async({page},info)=>{
  test.skip(info.project.name==='desktop','Desktop complete 18-puzzle journey passed at a8a63e371e424f68803144ea6f483818cab30830; runtime unchanged.');
  test.setTimeout(300000);
  expect(fixture.status).toBe('STATIC_DATA_ANALYSIS_ONLY_NOT_RUNTIME_PASS');
  expect(fixture.levels).toHaveLength(18);expect(fixture.levels.every(p=>p.status==='STATIC_OPERATOR_PLAN_NOT_RUNTIME_PASS')).toBe(true);
  const mobile=info.project.name==='mobile',errors=captureErrors(page),outside:string[]=[],earned:unknown[]=[],lifecycle:unknown[]=[];
  page.on('request',request=>{const url=new URL(request.url());if(!['127.0.0.1','localhost'].includes(url.hostname))outside.push(request.url());});
  // Browser-level context telemetry is read-only; it neither controls the
  // synthesizer nor substitutes a successful game state.
  const audioCDP=await page.context().newCDPSession(page);
  const audioContexts=new Map<string,string>();
  const audioContext=(event:{context:{contextId:string;contextState:string}})=>audioContexts.set(event.context.contextId,event.context.contextState);
  audioCDP.on('WebAudio.contextCreated',audioContext);audioCDP.on('WebAudio.contextChanged',audioContext);
  audioCDP.on('WebAudio.contextWillBeDestroyed',(event:{contextId:string})=>audioContexts.set(event.contextId,'destroyed'));
  try {
  await audioCDP.send('WebAudio.enable');
  // Bounded observation only: no event is prevented and no game/pointer state
  // is changed. This diagnoses ordinary focus transfer versus real cancellation.
  await page.addInitScript(()=>{
    const target=window as unknown as {__blackHoleSquareSnapshot?:()=>Snapshot;__bhsObservedInput:unknown[]};
    target.__bhsObservedInput=[];
    const record=(event:Event)=>{
      if(event instanceof MessageEvent&&event.data?.source!=='playgarden-host')return;
      const s=target.__blackHoleSquareSnapshot?.(),pointer=event instanceof PointerEvent?event:null;
      const entry={event:event.type,at:performance.now(),trusted:event.isTrusted,focused:document.hasFocus(),
        active:document.activeElement?.tagName,target:(event.target as Element|null)?.tagName,
        pointer:pointer?{x:pointer.clientX,y:pointer.clientY,id:pointer.pointerId,primary:pointer.isPrimary}:null,
        message:event instanceof MessageEvent?{type:event.data.type,paused:event.data.paused}:null,
        snapshot:s?{current:s.current,moves:s.moves,settled:s.settled,paused:s.paused,canvasX:s.canvas.x}:null};
      target.__bhsObservedInput.push(entry);if(target.__bhsObservedInput.length>128)target.__bhsObservedInput.shift();
    };
    for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture','blur','focus','message'])window.addEventListener(name,record,true);
  });

  // Only invalid data is injected for this corruption test. No completed flag,
  // game state, board, clock, random source, or successful API is injected.
  await page.addInitScript(key=>{if(window===top&&!sessionStorage.getItem('bhs-corruption-probed')){
    localStorage.setItem(key,'{"current":null,"solved":[],"solutions":{}}');sessionStorage.setItem('bhs-corruption-probed','yes');}},STORAGE);
  const runtime='**/games/black-hole-square/js/runtime.js';
  await page.route(runtime,route=>route.abort('failed'));
  await open(page,true,false);
  await expect(page.locator('.black-hole-square-error [role="alert"]')).toContainText('游戏资源未能启动',{timeout:15000});
  await page.screenshot({path:info.outputPath('black-hole-square-startup-failure.png'),fullPage:true});
  lifecycle.push({case:'blocked local runtime',browserErrors:errors.splice(0)});
  await page.unroute(runtime);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(runtime,async route=>{await gate;await route.continue();});
  await page.getByRole('button',{name:'重试载入 Black Hole Square',exact:true}).click();
  await page.locator('.game-toolbar').getByRole('button',{name:'暂停',exact:true}).click();
  release();await observed(page);await page.unroute(runtime);
  await expect.poll(async()=>(await read(page))?.paused).toBe(true);
  const beforeResume=await observed(page);await page.waitForTimeout(250);
  expect((await observed(page)).frames).toBe(beforeResume.frames);
  expect((await observed(page)).time).toBe(beforeResume.time);
  await page.getByRole('button',{name:'继续游戏',exact:true}).click();await idle(page);
  expect((await observed(page)).puzzle).toBe('titlescreen');expect(await credits(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('black-hole-square-original-title.png'),fullPage:true});
  // The opaque sandbox prevents reading the host DOM and using its storage.
  expect(await (await gameFrame(page))!.evaluate(()=>{try{void parent.document;return false;}catch{return true;}})).toBe(true);
  await page.getByRole('button',{name:'下一页 / 跳过',exact:true}).click();await idle(page);
  expect((await observed(page)).puzzle).toBe('startscreen');
  await page.screenshot({path:info.outputPath('black-hole-square-original-instructions.png'),fullPage:true});
  await page.getByRole('button',{name:'下一页 / 跳过',exact:true}).click();await idle(page,0);
  // Native free navigation can reach the ending with zero clears.
  await select(page,17);await page.getByRole('button',{name:'下一页 / 跳过',exact:true}).click();await idle(page);
  expect((await observed(page)).ending).toBe(true);expect((await observed(page)).allSolved).toBe(false);
  expect((await observed(page)).solved).toEqual([]);expect(await credits(page)).toEqual([]);
  await expect(page.locator('.black-hole-square-ending')).toContainText('实际清空 0 / 18');
  await page.screenshot({path:info.outputPath('black-hole-square-skipped-ending-no-credit.png'),fullPage:true});
  await select(page,0);
  const dots=await idle(page,0);
  await tapCanvas(page,mobile,dots.canvas.width/2-18*6+9*12+4,dots.canvas.height/2+160+4);
  await idle(page,9);await board(page,9,fixture.levels[9].initial);expect(await credits(page)).toEqual([]);
  await select(page,0);
  // Probe the first outward CSS pixel, then verify the actual event's logical
  // coordinates. A fractional target exactly on an edge can land just inside.
  const edges=await idle(page,0),edgeFrame=(await gameFrame(page))!;
  await edgeFrame.evaluate(()=>{
    const target=window as unknown as {__blackHoleSquareSnapshot:()=>Snapshot;__bhsBoundaryInputs:{x:number;y:number;current:number;moves:number}[]};
    target.__bhsBoundaryInputs=[];
    const sample=(event:PointerEvent)=>{const s=target.__blackHoleSquareSnapshot(),b=document.querySelector('canvas')!.getBoundingClientRect();
      target.__bhsBoundaryInputs.push({x:(event.clientX-b.left)*s.canvas.width/b.width,
        y:(event.clientY-b.top)*s.canvas.height/b.height,current:s.current,moves:s.moves});
      if(target.__bhsBoundaryInputs.length===3)window.removeEventListener('pointerdown',sample,true);};
    window.addEventListener('pointerdown',sample,true);
  });
  const edgeX=(edges.canvas.width-320)/2,edgeY=(edges.canvas.height-416)/2;
  const boundaryProbes:{x:number;y:number;axis:'x'|'y'}[]=[
    {x:304+edgeX,y:86+edgeY,axis:'x'},
    {x:40+edgeX,y:350+edgeY,axis:'y'},
    {x:edges.canvas.width/2+18*6,y:edges.canvas.height/2+164,axis:'x'},
  ];
  for(const probe of boundaryProbes){
    const point=await canvasPoint(page,probe.x,probe.y);point[probe.axis]=Math.floor(point[probe.axis])+1;
    await tapPoint(page,mobile,point);
    await page.waitForTimeout(80);await board(page,0,fixture.levels[0].initial);expect((await observed(page)).moves).toBe(0);
  }
  const boundaryInputs=await edgeFrame.evaluate(()=>(window as unknown as {__bhsBoundaryInputs:{x:number;y:number;current:number;moves:number}[]}).__bhsBoundaryInputs);
  expect(boundaryInputs).toHaveLength(3);
  for(const [index,input] of boundaryInputs.entries()){
    const probe=boundaryProbes[index];expect(input[probe.axis]).toBeGreaterThanOrEqual(probe[probe.axis]);
    expect(input.current).toBe(2);expect(input.moves).toBe(0);
  }
  lifecycle.push({case:'real right/bottom boundary input remains outside the interactive cells',inputs:boundaryInputs});
  // Wrong source/nonce messages must not reset a real moved board or earn a win.
  // Resolve both visible targets before movement. Re-reading frame/bounds between
  // clicks previously delayed the second gesture until after the travel ended.
  const rapidStart=await idle(page,0),rapidFrame=(await gameFrame(page))!;
  const rapidPoints=[];
  for(const cell of fixture.levels[0].cells.slice(0,2))rapidPoints.push(await canvasPoint(page,
    16+cell%6*48+24+rapidStart.canvas.x,62+Math.floor(cell/6)*48+24+rapidStart.canvas.y));
  await rapidFrame.evaluate(()=>{
    const target=window as unknown as {__blackHoleSquareSnapshot:()=>Snapshot;__bhsInputReceipts:{moves:number;settled:boolean}[]};
    target.__bhsInputReceipts=[];
    const sample=()=>{const s=target.__blackHoleSquareSnapshot();target.__bhsInputReceipts.push({moves:s.moves,settled:s.settled});
      if(target.__bhsInputReceipts.length===2)window.removeEventListener('pointerdown',sample,true);};
    window.addEventListener('pointerdown',sample,true);
  });
  await tapPoint(page,mobile,rapidPoints[0]);
  await rapidFrame.waitForFunction(()=>(window as unknown as {__blackHoleSquareSnapshot:()=>Snapshot}).__blackHoleSquareSnapshot().moves===1,
    undefined,{polling:'raf',timeout:2000});
  await tapPoint(page,mobile,rapidPoints[1]);
  const rapidReceipts=await rapidFrame.evaluate(()=>(window as unknown as {__bhsInputReceipts:{moves:number;settled:boolean}[]}).__bhsInputReceipts);
  expect(rapidReceipts).toEqual([{moves:0,settled:true},{moves:1,settled:false}]);
  lifecycle.push({case:'second real gesture arrives during piece travel',inputs:rapidReceipts});
  await idle(page,0);await board(page,0,fixture.levels[0].checkpoints[0]);expect((await observed(page)).moves).toBe(1);
  await (await gameFrame(page))!.evaluate(()=>{
    parent.postMessage({source:'playgarden-black-hole-square',revision:'black-hole-square-8d48aae-playgarden-1',session:'stale-session-that-is-not-current',type:'complete',level:0,puzzle:'click',moves:4},'*');
    window.postMessage({source:'playgarden-host',session:'stale-session-that-is-not-current',type:'command',action:'reset'},'*');
  });
  await page.waitForTimeout(80);await board(page,0,fixture.levels[0].checkpoints[0]);expect(await credits(page)).toEqual([]);
  await page.getByRole('button',{name:'重置谜题',exact:true}).click();await idle(page,0);await board(page,0,fixture.levels[0].initial);
  // Real failure consumes the original five-move allowance and automatically resets.
  await select(page,1);
  for(const [i,cell] of fixture.failurePlan.cells.entries()){
    await activate(page,mobile,cell);await board(page,1,fixture.failurePlan.checkpoints[i]);
  }
  await expect.poll(async()=>(await read(page))?.feedback,{intervals:[10]}).toBe('Out of moves!');
  expect((await observed(page)).solved).toEqual([]);expect(await credits(page)).toEqual([]);
  await page.screenshot({path:info.outputPath('black-hole-square-real-budget-failure.png'),fullPage:true});
  await idle(page,1);await board(page,1,fixture.levels[1].initial);
  await select(page,0);
  // Input cancellation releases a touch without synthesizing an activation.
  if(mobile){
    const cdp=await page.context().newCDPSession(page),s=await idle(page,0),bounds=await page.locator(FRAME).boundingBox();
    if(!bounds)throw Error('Missing frame');
    const cell=fixture.levels[0].cells[0],x=bounds.x+(16+cell%6*48+24+s.canvas.x)/s.canvas.width*bounds.width,
      y=bounds.y+(62+Math.floor(cell/6)*48+24+s.canvas.y)/s.canvas.height*bounds.height;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
    await page.waitForTimeout(100);await board(page,0,fixture.levels[0].initial);expect((await observed(page)).moves).toBe(0);
    await page.setViewportSize({width:320,height:760});await page.locator(FRAME).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath('black-hole-square-320px-controls.png'),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.setViewportSize({width:390,height:844});
  }else{
    // Keyboard selection uses actual key events, starting from native focus cell zero.
    await page.locator(FRAME).click({position:{x:8,y:8}});
    await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');await board(page,0,fixture.levels[0].checkpoints[0]);
    await idle(page,0);await page.keyboard.press('r');await idle(page,0);await board(page,0,fixture.levels[0].initial);
  }
  // Pause during genuine piece travel. No clock or RAF implementation is patched.
  await activate(page,mobile,fixture.levels[0].cells[0]);
  await page.locator('.game-toolbar').getByRole('button',{name:'暂停',exact:true}).click();
  await expect.poll(async()=>(await read(page))?.paused).toBe(true);
  const paused=await observed(page);await page.waitForTimeout(350);const frozen=await observed(page);
  expect(frozen.frames).toBe(paused.frames);expect(frozen.time).toBe(paused.time);expect(frozen.board).toEqual(paused.board);
  expect(frozen.audio.oscillators).toBe(paused.audio.oscillators);
  await page.getByRole('button',{name:'继续游戏',exact:true}).click();await idle(page,0);
  expect((await observed(page)).time-paused.time).toBeLessThan(1500);
  await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();await idle(page,0);
  if(await page.getByRole('button',{name:'开启声音',exact:true}).count())await page.getByRole('button',{name:'开启声音',exact:true}).click();
  // This move is incomplete, so no host win cue can create another context.
  const beforeAudioExit=new Set(audioContexts.keys());
  await activate(page,mobile,fixture.levels[0].cells[0]);
  await expect.poll(()=>[...audioContexts.keys()].filter(id=>!beforeAudioExit.has(id)).length).toBe(1);
  const exitingAudio=[...audioContexts.keys()].find(id=>!beforeAudioExit.has(id))!;
  const leaving=await gameFrame(page);
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();
  await expect(page.locator(FRAME)).toHaveCount(0);expect(leaving?.isDetached()).toBe(true);
  await expect.poll(()=>['closed','destroyed'].includes(audioContexts.get(exitingAudio)??''),{timeout:5000}).toBe(true);
  lifecycle.push({case:'exit during real audio/piece travel closes owned context',state:audioContexts.get(exitingAudio)});
  await open(page);await idle(page,0);await board(page,0,fixture.levels[0].initial);
  // Enable audio through the host choice and a real canvas gesture. Observe
  // ownership only; this does not claim physical-speaker audibility.
  if(await page.getByRole('button',{name:'开启声音',exact:true}).count())await page.getByRole('button',{name:'开启声音',exact:true}).click();
  let persisted='',firstCampaignAudio:string|undefined;
  const beforeCampaignAudio=new Set(audioContexts.keys());
  for(const trace of fixture.levels){
    await idle(page,trace.level);await board(page,trace.level,trace.initial);
    if(trace.level===1&&firstCampaignAudio){
      await expect.poll(()=>['closed','destroyed'].includes(audioContexts.get(firstCampaignAudio!)??''),{timeout:5000}).toBe(true);
      lifecycle.push({case:'native level remount closes previous owned context',state:audioContexts.get(firstCampaignAudio)});
    }
    expect((await observed(page)).solved).toEqual(fixture.levels.slice(0,trace.level).map(p=>p.id));
    if([0,8,17].includes(trace.level))await page.screenshot({path:info.outputPath(`black-hole-square-original-level-${trace.level+1}.png`),fullPage:true});
    if(trace.level===1){
      // Reload after an actual partial move: earned clear survives, mid-board resets.
      await activate(page,mobile,trace.cells[0]);await board(page,1,trace.checkpoints[0]);
      persisted=await page.evaluate(key=>localStorage.getItem(key)??'',STORAGE);
      expect(JSON.parse(persisted).solved).toEqual(['click']);
      await page.reload();await open(page,false);await idle(page,1);await board(page,1,trace.initial);
      expect((await observed(page)).solved).toEqual(['click']);
      await page.addInitScript(denyWrites,STORAGE);await page.evaluate(denyWrites,STORAGE);
    }
    if(trace.level===2){
      await activate(page,mobile,trace.cells[0]);await board(page,2,trace.checkpoints[0]);
      const old=await gameFrame(page);
      await page.locator('.game-toolbar').getByRole('button',{name:'重来',exact:true}).click();
      await idle(page,2);await board(page,2,trace.initial);expect(old?.isDetached()).toBe(true);
      expect((await observed(page)).solved).toEqual(['click','wait']);expect((await observed(page)).saved).toBe(false);
    }
    for(const [index,cell] of trace.cells.entries()){
      await activate(page,mobile,cell);await board(page,trace.level,trace.checkpoints[index]);
      if(trace.level===0&&index===0){
        await expect.poll(()=>[...audioContexts.keys()].filter(id=>!beforeCampaignAudio.has(id)).length).toBe(1);
        firstCampaignAudio=[...audioContexts.keys()].find(id=>!beforeCampaignAudio.has(id));
      }
      if(index<trace.cells.length-1)expect((await observed(page)).solved).not.toContain(trace.id);
    }
    await expect.poll(()=>credits(page),{intervals:[20]}).toEqual(Array.from({length:trace.level+1},(_,i)=>i));
    const won=await observed(page);expect(won.solved).toContain(trace.id);expect(won.board.every(t=>t<2)).toBe(true);
    earned.push({level:trace.level,id:trace.id,inputs:trace.cells,observedMoves:won.moves,board:won.board,solved:won.solved});
    await page.screenshot({path:info.outputPath(`black-hole-square-earned-${String(trace.level+1).padStart(2,'0')}.png`),fullPage:true});
    if(trace.level>=1){expect(won.saved).toBe(false);expect(await page.evaluate(key=>localStorage.getItem(key)??'',STORAGE)).toBe(persisted);}
    if(trace.level===0){
      lifecycle.push({case:'first genuine clear audio ownership',audio:won.audio,audibility:'not measured'});
      await page.getByRole('button',{name:'静音',exact:true}).click();
      await expect.poll(async()=>{const s=await read(page);return s?{enabled:s.audio.enabled,oscillators:s.audio.oscillators,schedulers:s.audio.schedulers}:null;}).toEqual({enabled:false,oscillators:0,schedulers:0});
    }
  }
  await expect.poll(async()=>(await read(page))?.ending,{timeout:15000}).toBe(true);await idle(page);
  const ending=await observed(page);expect(ending.allSolved).toBe(true);expect(ending.solved).toHaveLength(18);
  await expect(page.locator('.black-hole-square-ending')).toContainText('全部实际清空');
  await page.screenshot({path:info.outputPath('black-hole-square-earned-original-ending.png'),fullPage:true});
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();await expect(page.locator(FRAME)).toHaveCount(0);
  await open(page);expect((await observed(page)).solved).toEqual(['click']);
  expect((await observed(page)).allSolved).toBe(false);
  expect(await credits(page)).toEqual(Array.from({length:18},(_,i)=>i));
  await page.getByRole('button',{name:'返回游戏大厅',exact:true}).click();
  expect(page.frames().some(f=>f.url().includes('/games/black-hole-square/'))).toBe(false);
  expect(errors).toEqual([]);expect(outside).toEqual([]);
  } finally {
    const inputDiagnostics=await Promise.all(page.frames().map(frame=>frame.evaluate(()=>({
      topFrame:window===top,events:(window as unknown as {__bhsObservedInput?:unknown[]}).__bhsObservedInput??[],
    }))));
    const evidence=JSON.stringify({upstreamCommit:fixture.upstreamCommit,
      project:info.project.name,earned,lifecycle,errors,outside,inputDiagnostics},null,2);
    writeFileSync(info.outputPath('black-hole-square-real-input-evidence.json'),evidence);
    await info.attach('black-hole-square-real-input-evidence',{body:evidence,contentType:'application/json'});
    await audioCDP.detach().catch(()=>{});
  }
});
