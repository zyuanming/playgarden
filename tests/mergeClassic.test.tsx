// @vitest-environment jsdom
// SPDX-License-Identifier: GPL-3.0-only
import {StrictMode} from 'react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import MergeGarden from '../src/games/MergeGarden';
import {GameShell} from '../src/components/GameShell';
import App from '../src/App';
import {mergeMove,restoreMergeState,type MergeDirection} from '../src/games/mergeLogic';
import {MERGE_SAVE_KEY,MERGE_BEST_KEY,parseMergeSave,parseMergeBest,serializeMergeSave} from '../src/games/mergeStorage';
import {parseProgress,STORAGE_KEY} from '../src/lib/progress';
const props=()=>({level:0,paused:false,resetToken:0,hintToken:0,undoToken:0,onComplete:vi.fn(),onStatus:vi.fn()});
const initial=[2,2,4,0,...Array(12).fill(0)];
const fixture=(board=initial,score=0)=>restoreMergeState({board,seed:21,score,moves:0});
const seed=(board=initial,score=0)=>localStorage.setItem(MERGE_SAVE_KEY,serializeMergeSave(fixture(board,score)));
const values=()=>Array.from(document.querySelectorAll('[data-merge-cell]'),n=>Number(n.getAttribute('data-value')));
const field=()=>screen.getByRole('group',{name:/2048 棋盘/});
function settle(count=1){for(let i=0;i<count;i++){act(()=>vi.advanceTimersByTime(150));act(()=>vi.advanceTimersByTime(110));}}
beforeEach(()=>{localStorage.clear();vi.useFakeTimers();vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('classic saves and highest score',()=>{
 it('validates snapshots, rejects corrupted data and never turns former levels into scores',()=>{
  for(const s of [null,'{}','broken',JSON.stringify({version:1,current:{board:[3,...Array(15).fill(0)],seed:1,score:0,moves:0}})])expect(parseMergeSave(s)).toBeNull();
  for(const s of [null,'NaN','-5','Infinity','2.5','1e3','999999999999999999999'])expect(parseMergeBest(s)).toBe(0);
  const s=mergeMove(fixture(),'left'),restored=parseMergeSave(serializeMergeSave(s))!;expect(restored.board).toEqual(s.board);expect(restored.history).toEqual(s.history);expect(restored.score).toBe(4);
 });
 it('persists accepted moves immediately, resumes, and preserves best across undo and restart',()=>{
  seed();const p=props(),view=render(<MergeGarden {...p}/>);fireEvent.keyDown(field(),{key:'ArrowLeft'});const board=values();expect(localStorage.getItem(MERGE_BEST_KEY)).toBe('4');view.unmount();
  const next=render(<MergeGarden {...p}/>);expect(values()).toEqual(board);next.rerender(<MergeGarden {...p} undoToken={1}/>);expect(values()).toEqual(initial);expect(localStorage.getItem(MERGE_BEST_KEY)).toBe('4');next.rerender(<MergeGarden {...p} resetToken={1} freshStart undoToken={1}/>);expect(values().filter(Boolean)).toHaveLength(2);expect(document.querySelector('[data-merge-score]')?.textContent).toBe('0');expect(localStorage.getItem(MERGE_BEST_KEY)).toBe('4');
 });
 it('continues play if storage is denied and reports the limitation',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});render(<MergeGarden {...props()}/>);expect(screen.getByText(/浏览器暂时无法保存/)).toBeTruthy();expect(()=>fireEvent.keyDown(field(),{key:'ArrowLeft'})).not.toThrow();
 });
 it('does not overwrite an unreadable existing best record',()=>{
  localStorage.setItem(MERGE_BEST_KEY,'6000');const original=Storage.prototype.getItem;
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){if(key===MERGE_BEST_KEY)throw new Error('read blocked');return original.call(this,key);});
  render(<MergeGarden {...props()}/>);expect(original.call(localStorage,MERGE_BEST_KEY)).toBe('6000');expect(screen.getByText(/浏览器暂时无法保存/)).toBeTruthy();
 });
 it('reads a newer highest score before saving',()=>{seed();render(<MergeGarden {...props()}/>);localStorage.setItem(MERGE_BEST_KEY,'5000');fireEvent.keyDown(field(),{key:'ArrowLeft'});expect(localStorage.getItem(MERGE_BEST_KEY)).toBe('5000');expect(document.querySelector('[data-merge-best]')?.textContent).toBe('5,000');});
});
describe('input and motion lifecycle',()=>{
 it('retains source DOM identity and animates to actual targets before showing merge and spawn effects',()=>{
  const animate=vi.fn(()=>({cancel:vi.fn()}));Object.defineProperty(HTMLElement.prototype,'animate',{value:animate,configurable:true});seed();render(<MergeGarden {...props()}/>);const source=document.querySelector('[data-tile-id="2"]');fireEvent.keyDown(field(),{key:'ArrowLeft'});expect(document.querySelector('[data-tile-id="2"]')).toBe(source);expect(source?.getAttribute('data-tile-to')).toBe('0');expect(animate).toHaveBeenCalled();act(()=>vi.advanceTimersByTime(150));expect(document.querySelectorAll('.merge-tile-merged')).toHaveLength(1);expect(document.querySelectorAll('.merge-tile-new')).toHaveLength(1);act(()=>vi.advanceTimersByTime(110));expect(document.querySelector('[data-merge-phase]')?.getAttribute('data-merge-phase')).toBe('idle');expect(document.querySelectorAll('.merge-tile-merged')).toHaveLength(1);
 });
 it('retains merge-pop identity while a queued next move translates that tile',()=>{
  seed();render(<MergeGarden {...props()}/>);fireEvent.keyDown(field(),{key:'ArrowLeft'});fireEvent.keyDown(field(),{key:'ArrowDown'});act(()=>vi.advanceTimersByTime(150));const inner=document.querySelector('.merge-tile-merged')!;const wrapper=inner.parentElement!;const id=wrapper.getAttribute('data-tile-id');act(()=>vi.advanceTimersByTime(110));expect(document.querySelector('[data-merge-phase]')?.getAttribute('data-merge-phase')).toBe('sliding');expect(document.querySelector(`[data-tile-id="${id}"] .merge-tile-merged`)).toBe(inner);
 });
 it('exposes real board values in four semantic rows and sixteen named cells',()=>{seed();render(<MergeGarden {...props()}/>);expect(screen.getByRole('table',{name:'当前棋盘'})).toBeTruthy();expect(screen.getAllByRole('row')).toHaveLength(4);expect(screen.getAllByRole('cell')).toHaveLength(16);expect(screen.getByRole('cell',{name:'第 1 行第 1 列，2'}).textContent).toBe('2');});
 it('keeps rapid inputs ordered and drains no-op directions',()=>{
  seed();render(<MergeGarden {...props()}/>);const dirs:MergeDirection[]=['left','left','down','right','up'];act(()=>{for(const d of dirs)fireEvent.click(document.querySelector(`[data-merge-direction="${d}"]`)!);});settle(6);const expected=dirs.reduce(mergeMove,fixture());expect(values()).toEqual(expected.board);const saved=parseMergeSave(localStorage.getItem(MERGE_SAVE_KEY))!;expect(saved.score).toBe(expected.score);expect(saved.moves).toBe(expected.moves);
 });
 it('does not consume seed, score, history or animation on a no-op',()=>{seed([2,4,0,0,...Array(12).fill(0)]);render(<MergeGarden {...props()}/>);const before=localStorage.getItem(MERGE_SAVE_KEY);fireEvent.keyDown(field(),{key:'ArrowLeft'});expect(localStorage.getItem(MERGE_SAVE_KEY)).toBe(before);expect(document.querySelector('[data-merge-phase]')?.getAttribute('data-merge-phase')).toBe('idle');});
 it('continues after 2048 and ends only if no direction is possible',()=>{
  seed([1024,1024,...Array(14).fill(0)]);const p=props(),view=render(<MergeGarden {...p}/>);fireEvent.keyDown(field(),{key:'ArrowLeft'});settle();expect(values()).toContain(2048);expect(p.onComplete).not.toHaveBeenCalled();fireEvent.keyDown(field(),{key:'ArrowRight'});settle();expect(parseMergeSave(localStorage.getItem(MERGE_SAVE_KEY))?.moves).toBe(2);view.unmount();seed([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2],128);render(<MergeGarden {...props()}/>);expect(screen.getByRole('button',{name:'向右合并'}).hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'再来一局'}));expect(localStorage.getItem(MERGE_BEST_KEY)).toBe('2048');expect(values().filter(Boolean)).toHaveLength(2);
 });
 it('pause settles accepted move, cancels queued input and consumes paused tokens',()=>{
  seed();const p=props(),view=render(<MergeGarden {...p}/>);fireEvent.keyDown(field(),{key:'ArrowLeft'});fireEvent.keyDown(field(),{key:'ArrowDown'});const accepted=values();view.rerender(<MergeGarden {...p} paused hintToken={1} undoToken={1}/>);settle(3);expect(values()).toEqual(accepted);expect(document.querySelectorAll('.merge-tile-new,.merge-tile-merged')).toHaveLength(0);view.rerender(<MergeGarden {...p} hintToken={1} undoToken={1}/>);expect(values()).toEqual(accepted);fireEvent.keyDown(field(),{key:'ArrowRight'});settle();expect(values()).not.toEqual(accepted);
 });
 it('visibility loss, cancelled pointer and unmount leave no late move',()=>{
  seed();const view=render(<MergeGarden {...props()}/>);fireEvent.keyDown(field(),{key:'ArrowLeft'});fireEvent.keyDown(field(),{key:'ArrowDown'});const accepted=values();const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));settle(3);expect(values()).toEqual(accepted);hidden.mockRestore();const saved=localStorage.getItem(MERGE_SAVE_KEY);fireEvent.pointerDown(field(),{pointerId:1,clientX:20,clientY:20,isPrimary:true,button:0});fireEvent.pointerCancel(field(),{pointerId:1});fireEvent.pointerUp(field(),{pointerId:1,clientX:120,clientY:20});expect(localStorage.getItem(MERGE_SAVE_KEY)).toBe(saved);fireEvent.keyDown(field(),{key:'ArrowRight'});view.unmount();const latest=localStorage.getItem(MERGE_SAVE_KEY);act(()=>vi.runAllTimers());expect(localStorage.getItem(MERGE_SAVE_KEY)).toBe(latest);
 });
 it('reduced motion and StrictMode use identical rules without delay',()=>{vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));seed();render(<StrictMode><MergeGarden {...props()}/></StrictMode>);fireEvent.keyDown(field(),{key:'ArrowLeft'});fireEvent.keyDown(field(),{key:'ArrowDown'});expect(values()).toEqual(mergeMove(mergeMove(fixture(),'left'),'down').board);expect(document.querySelector('[data-merge-phase]')?.getAttribute('data-merge-phase')).toBe('idle');});
});
it('keeps favorites and stable identity without any zero-level statistics or mode picker',async()=>{
 vi.useRealTimers();const p=parseProgress(null);p.favorites=['merge'];p.lastPlayed='merge';p.completed.merge=[0,1,11];localStorage.setItem(STORAGE_KEY,JSON.stringify(p));const view=render(<App/>);fireEvent.change(screen.getByRole('textbox',{name:'搜索游戏'}),{target:{value:'2048'}});expect(screen.getByRole('article').textContent).toContain('无尽模式');expect(screen.getByRole('article').textContent).not.toMatch(/\/0 关|3\/12/);expect(screen.getByRole('button',{name:'取消收藏2048'})).toBeTruthy();expect(screen.getByText(/1 款可玩游戏/).textContent).not.toContain('0 个关卡');view.unmount();render(<GameShell id="merge" completed={[0,1,11]} onBack={vi.fn()} onComplete={vi.fn()}/>);expect(await screen.findByRole('group',{name:/2048 棋盘/})).toBeTruthy();expect(screen.queryByLabelText('选择关卡')).toBeNull();expect(screen.queryByRole('group',{name:'游玩方式'})).toBeNull();expect(screen.queryByText('下一关')).toBeNull();
});
