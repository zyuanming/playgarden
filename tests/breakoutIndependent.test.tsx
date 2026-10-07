// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-only
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {StrictMode} from 'react';
import BreakoutGarden from '../src/games/BreakoutGarden';
let frames=new Map<number,FrameRequestCallback>(),nextFrame=0,now=1000;
const props=(extra={})=>({level:0,paused:false,resetToken:0,hintToken:0,undoToken:0,onComplete:vi.fn(),onStatus:vi.fn(),...extra});
const root=()=>document.querySelector('.breakout-garden')!;
const value=(k:string)=>Number(root().getAttribute('data-breakout-'+k));
const stage=()=>screen.getByRole('group',{name:/反弹砖园游戏区/});
function tick(ms=16){act(()=>{now+=ms;const todo=[...frames.values()];frames.clear();todo.forEach(f=>f(now));});}
function travel(ms:number){for(let t=0;t<ms;t+=16)tick(Math.min(16,ms-t));}
function start(){fireEvent.click(screen.getByRole('button',{name:'发球'}));tick();}
function hidden(h:boolean){Object.defineProperty(document,'hidden',{configurable:true,value:h});fireEvent(document,new Event('visibilitychange'));}
function pointer(target:Element,type:string,extra={}){const e=new Event(type,{bubbles:true});for(const [k,v]of Object.entries({clientX:200,pointerId:1,pointerType:'touch',buttons:1,...extra}))Object.defineProperty(e,k,{value:v});fireEvent(target,e);}
beforeEach(()=>{
 frames=new Map();nextFrame=0;now=1000;
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 vi.stubGlobal('requestAnimationFrame',(f:FrameRequestCallback)=>{frames.set(++nextFrame,f);return nextFrame;});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>null);
 Object.defineProperty(HTMLElement.prototype,'setPointerCapture',{configurable:true,value:vi.fn()});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:400,bottom:500,width:400,height:500,toJSON(){return this;}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('requires launch and modifier keys do not move; stage blur releases input',()=>{
 render(<BreakoutGarden {...props()}/>);travel(200);expect(value('y')).toBe(455);
 fireEvent.keyDown(stage(),{key:'ArrowRight',ctrlKey:true});travel(100);expect(value('paddle')).toBe(200);
 fireEvent.keyDown(stage(),{key:'ArrowRight'});travel(100);expect(value('paddle')).toBeGreaterThan(200);
 fireEvent.blur(stage());const p=value('paddle');travel(100);expect(value('paddle')).toBe(p);
 fireEvent.keyDown(stage(),{key:' '});expect(root().getAttribute('data-breakout-phase')).toBe('playing');
});
it('global pause freezes position, blocks all inputs, and resets clock and held key',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);start();travel(160);fireEvent.keyDown(stage(),{key:'ArrowRight'});
 r.rerender(<BreakoutGarden {...p} paused/>);const x=value('x'),y=value('y'),paddle=value('paddle');travel(3000);
 pointer(stage(),'pointerdown',{clientX:20});pointer(stage(),'pointermove',{clientX:350,pointerType:'mouse'});fireEvent.keyDown(stage(),{key:'ArrowLeft'});
 expect([value('x'),value('y'),value('paddle')]).toEqual([x,y,paddle]);
 r.rerender(<BreakoutGarden {...p}/>);tick(3000);expect([value('x'),value('y'),value('paddle')]).toEqual([x,y,paddle]);tick(16);expect(value('paddle')).toBe(paddle);expect(Math.abs(value('y')-y)).toBeLessThan(4);
});
it('local pause and window blur require resume and do not catch up',()=>{
 render(<BreakoutGarden {...props()}/>);start();travel(160);fireEvent(window,new Event('blur'));const y=value('y');travel(1000);expect(value('y')).toBe(y);expect(screen.getByRole('button',{name:'继续接球'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'继续接球'}));tick(2000);expect(value('y')).toBe(y);tick();expect(value('y')).not.toBe(y);
 fireEvent.click(screen.getByRole('button',{name:'暂停接球'}));const q=value('y');travel(1000);expect(value('y')).toBe(q);
});
it('hidden page freezes and discards hidden time',()=>{
 render(<BreakoutGarden {...props()}/>);start();travel(160);hidden(true);const y=value('y');travel(2000);expect(value('y')).toBe(y);hidden(false);fireEvent.click(screen.getByRole('button',{name:'继续接球'}));tick(2000);expect(value('y')).toBe(y);tick();expect(Math.abs(value('y')-y)).toBeLessThan(4);
});
it('visibility-only return requires explicit resume: fixed regression',()=>{
 render(<BreakoutGarden {...props()}/>);start();travel(160);hidden(true);const y=value('y');hidden(false);travel(100);expect(value('y')).toBe(y);expect(screen.getByRole('button',{name:'继续接球'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'继续接球'}));travel(100);expect(value('y')).not.toBe(y);
});
it('pointer release, cancel and leave stop button motion; canvas cancel clears keyboard',()=>{
 render(<BreakoutGarden {...props()}/>);tick();const left=screen.getByRole('button',{name:'挡板向左'});
 for(const type of ['pointerup','pointercancel','pointerout']){pointer(left,'pointerdown');travel(32);pointer(left,type);const p=value('paddle');travel(32);expect(value('paddle')).toBe(p);}
 fireEvent.keyDown(stage(),{key:'ArrowRight'});travel(32);pointer(stage(),'pointercancel');const p=value('paddle');travel(32);expect(value('paddle')).toBe(p);
});
it('reset and level switch reset phase, lives, score, keys and local pause',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);start();travel(200);fireEvent.keyDown(stage(),{key:'ArrowRight'});fireEvent(window,new Event('blur'));
 r.rerender(<BreakoutGarden {...p} resetToken={1} level={5}/>);expect(root().getAttribute('data-breakout-phase')).toBe('ready');expect(value('lives')).toBe(3);expect(value('score')).toBe(0);expect(value('paddle')).toBe(200);expect(screen.getByRole('button',{name:'暂停接球'})).toBeTruthy();travel(200);expect(value('paddle')).toBe(200);
});
it('strict mount, rerender and unmount keep one frame and remove listeners',()=>{
 const a=vi.spyOn(window,'addEventListener'),r=vi.spyOn(window,'removeEventListener'),da=vi.spyOn(document,'addEventListener'),dr=vi.spyOn(document,'removeEventListener');
 const p=props(),view=render(<StrictMode><BreakoutGarden {...p}/></StrictMode>);expect(frames.size).toBe(1);start();travel(100);view.rerender(<StrictMode><BreakoutGarden {...p}/></StrictMode>);expect(frames.size).toBe(1);view.unmount();expect(frames.size).toBe(0);
 const listeners=a.mock.calls.filter(c=>c[0]==='blur').map(c=>c[1]);expect(listeners).toHaveLength(2);for(const l of listeners)expect(r.mock.calls.some(c=>c[0]==='blur'&&c[1]===l)).toBe(true);
 const dl=da.mock.calls.filter(c=>c[0]==='visibilitychange').map(c=>c[1]);expect(dl).toHaveLength(2);for(const l of dl)expect(dr.mock.calls.some(c=>c[0]==='visibilitychange'&&c[1]===l)).toBe(true);
});
it('fully lost game is locked; replay restores operation',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);
 for(let life=3;life>0;life--){start();pointer(stage(),'pointermove',{clientX:44,pointerType:'mouse'});for(let t=0;t<1500&&root().getAttribute('data-breakout-phase')==='playing';t++){pointer(stage(),'pointermove',{clientX:value('x')<200?356:44,pointerType:'mouse'});tick(16);}expect(value('lives')).toBe(life-1);}
 expect(root().getAttribute('data-breakout-phase')).toBe('lost');expect(p.onComplete).not.toHaveBeenCalled();const position=[value('x'),value('y'),value('paddle')];travel(3000);fireEvent.keyDown(stage(),{key:' '});pointer(stage(),'pointermove',{clientX:200,pointerType:'mouse'});expect([value('x'),value('y'),value('paddle')]).toEqual(position);
 r.rerender(<BreakoutGarden {...p} resetToken={1}/>);expect(value('lives')).toBe(3);expect(root().getAttribute('data-breakout-phase')).toBe('ready');
});

it('legal visible-state pointer play wins and completes exactly once',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);start();let seed=543;
 for(let t=0;t<15000&&root().getAttribute('data-breakout-phase')!=='won'&&root().getAttribute('data-breakout-phase')!=='lost';t++){
  if(root().getAttribute('data-breakout-phase')==='ready')start();
  if(value('vy')>0){let landing=value('x')+value('vx')*((456-value('y'))/value('vy'));let q=((landing-6)%776+776)%776;landing=6+(q<=388?q:776-q);seed=(Math.imul(seed,1664525)+1013904223)>>>0;pointer(stage(),'pointermove',{clientX:landing+(seed/4294967296-.5)*60,pointerType:'mouse'});}
  tick(16);
 }
 expect(root().getAttribute('data-breakout-phase')).toBe('won');expect(value('score')).toBe(30);expect(p.onComplete).toHaveBeenCalledTimes(1);travel(1000);fireEvent.keyDown(stage(),{key:' '});pointer(stage(),'pointermove',{clientX:44,pointerType:'mouse'});expect(p.onComplete).toHaveBeenCalledTimes(1);expect(value('score')).toBe(30);
 r.rerender(<BreakoutGarden {...p} level={1}/>);expect(root().getAttribute('data-breakout-phase')).toBe('ready');expect(value('score')).toBe(0);expect(p.onComplete).toHaveBeenCalledTimes(1);
},30000);
it('keyboard beats opposite hover each frame and mouse regains control on release',()=>{
 render(<BreakoutGarden {...props()}/>);tick();
 for(const direction of [1,-1]){
  pointer(stage(),'pointermove',{clientX:200,pointerType:'mouse',buttons:0});
  const key=direction>0?'ArrowRight':'ArrowLeft';fireEvent.keyDown(stage(),{key});
  for(let n=0;n<10;n++){const before=value('paddle');pointer(stage(),'pointermove',{clientX:direction>0?44:356,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(before);tick(16);expect((value('paddle')-before)*direction).toBeGreaterThan(0);}
  fireEvent.keyUp(stage(),{key});pointer(stage(),'pointermove',{clientX:280,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(280);travel(32);expect(value('paddle')).toBe(280);
 }
});
it('both arrows retain priority until both released; touch and cancellation still work',()=>{
 render(<BreakoutGarden {...props()}/>);tick();fireEvent.keyDown(stage(),{key:'ArrowLeft'});fireEvent.keyDown(stage(),{key:'ArrowRight'});pointer(stage(),'pointermove',{clientX:44,pointerType:'mouse',buttons:0});travel(32);expect(value('paddle')).toBe(200);
 fireEvent.keyUp(stage(),{key:'ArrowRight'});pointer(stage(),'pointermove',{clientX:356,pointerType:'mouse',buttons:0});tick();expect(value('paddle')).toBeLessThan(200);fireEvent.keyUp(stage(),{key:'ArrowLeft'});
 pointer(stage(),'pointerdown',{clientX:120,pointerType:'touch'});expect(value('paddle')).toBe(120);pointer(stage(),'pointermove',{clientX:310,pointerType:'touch',buttons:1});expect(value('paddle')).toBe(310);pointer(stage(),'pointermove',{clientX:150,pointerType:'touch',buttons:0});expect(value('paddle')).toBe(310);
 fireEvent.keyDown(stage(),{key:'ArrowLeft'});pointer(stage(),'pointercancel');pointer(stage(),'pointermove',{clientX:250,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(250);travel(32);expect(value('paddle')).toBe(250);
});
it('pause and hidden clear keyboard ownership so mouse works only after explicit resume',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);start();fireEvent.keyDown(stage(),{key:'ArrowRight'});travel(32);r.rerender(<BreakoutGarden {...p} paused/>);const paused=value('paddle');pointer(stage(),'pointermove',{clientX:44,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(paused);r.rerender(<BreakoutGarden {...p}/>);pointer(stage(),'pointermove',{clientX:150,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(150);travel(32);expect(value('paddle')).toBe(150);
 fireEvent.keyDown(stage(),{key:'ArrowLeft'});hidden(true);hidden(false);pointer(stage(),'pointermove',{clientX:300,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(150);fireEvent.click(screen.getByRole('button',{name:'继续接球'}));pointer(stage(),'pointermove',{clientX:300,pointerType:'mouse',buttons:0});expect(value('paddle')).toBe(300);travel(32);expect(value('paddle')).toBe(300);
});
it('launch guidance matches each level for click and keyboard without repeated status',()=>{
 const p=props(),r=render(<BreakoutGarden {...p}/>);
 for(let level=0;level<12;level++){
  r.rerender(<BreakoutGarden {...p} level={level} resetToken={level+1}/>);const lesson=document.querySelector('.breakout-heading p')!.textContent;expect(p.onStatus).toHaveBeenLastCalledWith(expect.stringContaining('点发球开始'));
  if(level%2===0)fireEvent.click(screen.getByRole('button',{name:'发球'}));else fireEvent.keyDown(stage(),{key:' '});expect(root().getAttribute('data-breakout-phase')).toBe('playing');expect(p.onStatus).toHaveBeenLastCalledWith(lesson);
  const calls=p.onStatus.mock.calls.length;fireEvent.keyDown(stage(),{key:' ',repeat:true});expect(p.onStatus.mock.calls.length).toBe(calls);r.rerender(<BreakoutGarden {...p} level={level} resetToken={level+1} paused/>);fireEvent.keyDown(stage(),{key:'Enter'});expect(p.onStatus.mock.calls.length).toBe(calls);
 }
});
