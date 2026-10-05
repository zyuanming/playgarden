// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import SlantForest from '../src/games/SlantForest';
import {slantLevels} from '../src/games/slantLevels';
import {slantWon,solveSlant,newSlantState,playSlant,undoSlant,slantHint} from '../src/games/slantLogic';
import {parseSlantRound,saveSlantRound,loadSlantRound,SLANT_RESUME_KEY} from '../src/games/slantStorage';
import {slantCertificates} from './fixtures/slantCertificates';
import {GameShell} from '../src/components/GameShell';
afterEach(cleanup);beforeEach(()=>localStorage.clear());
const props=()=>({level:0,paused:false,resetToken:0,hintToken:0,undoToken:0,onComplete:vi.fn(),onStatus:vi.fn()});
const cell=(n:number)=>document.querySelectorAll<HTMLButtonElement>('.slant-cell')[n];
describe('Slant rule core and campaign',()=>{
 it('replays every certificate using actual moves and locked terminal states',()=>{
  expect(slantLevels).toHaveLength(300);
  expect(new Set(slantLevels.map(l=>l.normalizedPuzzleHash)).size).toBe(300);
  for(const [i,p] of slantLevels.entries()){
   let state=newSlantState(p); for(const [cell,value] of slantCertificates[i].solution.entries())state=playSlant(p,state,cell,value);
   expect(slantWon(p,state.board)).toBe(true);expect(playSlant(p,state,0,0)).toBe(state);expect(undoSlant(p,state)).toBe(state);
   expect(p.difficultyEvidence.logicOnlySolved).toBe(p.chapter<3);
   expect(p.difficultyEvidence.branches===0).toBe(p.chapter<3);
  }
 });
 it('accepts missing clues, rejects loops, blanks, wrong counts, malformed input, and reports timeout honestly',()=>{
  const p={width:2,height:2,clues:Array(9).fill(-1)};
  expect(slantWon(p,[1,-1,-1,1])).toBe(false);expect(slantWon(p,[-1,-1,-1,-1])).toBe(true);
  expect(slantWon(p,[-1,-1,-1,0])).toBe(false);expect(slantWon({...p,clues:[0,...p.clues.slice(1)]},[-1,-1,-1,-1])).toBe(false);
  expect(solveSlant(p).status).toBe('multiple');expect(solveSlant(p,undefined,0).status).toBe('timeout');
  expect(solveSlant({...p,clues:[]}).status).toBe('unsat');
  const state=newSlantState(slantLevels[0]);for(const i of [-1,999,NaN,0.5])expect(playSlant(slantLevels[0],state,i,-1)).toBe(state);
 });
 it('hints prove a move from the current board and explain a wrong branch',()=>{
  const p=slantLevels[251],board=newSlantState(p).board;board[0]=slantCertificates[251].solution[0];
  const hint=slantHint(p,board);expect(hint.cell).toBe(1);expect(hint.value).toBe(slantCertificates[251].solution[1]);
  board[0]=-board[0] as -1|1;expect(slantHint(p,board).cell).toBe(-1);
 });
 it('stores all 300 completed rounds compactly while keeping unfinished undo history',()=>{
  for(const [i,p] of slantLevels.entries()){
   let state=newSlantState(p);for(const [cell,value] of slantCertificates[i].solution.entries())state=playSlant(p,state,cell,value);
   expect(saveSlantRound(i,state,p)).toBe(true);expect(loadSlantRound(i,p).board).toEqual(state.board);expect(loadSlantRound(i,p).history).toHaveLength(0);
  }
  const chars=Object.keys(localStorage).reduce((n,k)=>n+k.length+localStorage.getItem(k)!.length,0);expect(chars*2).toBeLessThan(200000);
  const p=slantLevels[299],state=playSlant(p,newSlantState(p),0,-1);expect(saveSlantRound(299,state,p)).toBe(true);expect(loadSlantRound(299,p)).toEqual(state);expect(undoSlant(p,loadSlantRound(299,p)).board).toEqual(newSlantState(p).board);
 });
 it('rejects damaged saves',()=>{
  const p=slantLevels[299]; for(const raw of ['{',null,'{}',JSON.stringify({version:1,board:Array(120).fill(9),history:[],moves:3})])expect(parseSlantRound(raw,p)).toEqual(newSlantState(p));
 });
});
describe('Slant real controls',()=>{
 it('cycles once, supports explicit tools, keyboard guards, pause and reset tokens',()=>{
  const p=props(),view=render(<SlantForest {...p}/>);
  fireEvent.click(cell(0));expect(cell(0).dataset.value).toBe('-1');fireEvent.click(cell(0));expect(cell(0).dataset.value).toBe('1');fireEvent.click(cell(0));expect(cell(0).dataset.value).toBe('0');
  cell(0).focus();expect(document.activeElement).toBe(cell(0));for(const modifier of ['ctrlKey','metaKey','altKey'])fireEvent.keyDown(cell(0),{key:'/',[modifier]:true});expect(cell(0).dataset.value).toBe('0');expect(document.activeElement).toBe(cell(0));
  fireEvent.keyDown(cell(0),{key:'/'});expect(cell(0).dataset.value).toBe('1');
  view.rerender(<SlantForest {...p} paused undoToken={4}/>);fireEvent.click(cell(1));expect(cell(1).dataset.value).toBe('0');
  view.rerender(<SlantForest {...p} undoToken={4}/>);expect(cell(0).dataset.value).toBe('1');
  view.rerender(<SlantForest {...p} undoToken={5}/>);expect(cell(0).dataset.value).toBe('0');
  fireEvent.click(screen.getByRole('button',{name:'正斜线 /',exact:true}));fireEvent.click(cell(1));expect(cell(1).dataset.value).toBe('1');
  view.rerender(<SlantForest {...p} resetToken={9}/>);expect([...document.querySelectorAll('.slant-cell')].every(c=>c.getAttribute('data-value')==='0')).toBe(true);
 });
 it('high-level round persists across unmount; hint never auto-plays and terminal report happens once',()=>{
  const p={...props(),level:299},view=render(<SlantForest {...p}/>);
  fireEvent.keyDown(cell(0),{key:slantCertificates[299].solution[0]===-1?'\\':'/'});view.unmount();
  const again=render(<SlantForest {...p}/>);expect(cell(0).dataset.value).toBe(String(slantCertificates[299].solution[0]));
  again.rerender(<SlantForest {...p} hintToken={7}/>);expect(document.querySelectorAll('.is-hinted')).toHaveLength(1);expect(cell(1).dataset.value).toBe('0');
  for(const [i,v] of slantCertificates[299].solution.entries())fireEvent.keyDown(cell(i),{key:v===-1?'\\':'/'});
  expect(p.onComplete).toHaveBeenCalledTimes(1);expect(cell(0).disabled).toBe(true);
  again.rerender(<SlantForest {...p} undoToken={8} hintToken={8}/>);expect(p.onComplete).toHaveBeenCalledTimes(1);expect(document.querySelector('[data-slant-won=true]')).not.toBeNull();
 });
 it('shell remembers a high-level selection without altering earned progress',async()=>{
  localStorage.setItem(`${SLANT_RESUME_KEY}.selected`,'299');
  render(<GameShell id="slant" completed={[]} onBack={()=>{}} onComplete={()=>{}}/>);
  const picker=await screen.findByLabelText('选择关卡',{exact:true});expect((picker as HTMLSelectElement).value).toBe('299');
  expect((await screen.findByLabelText('游戏源码来源')).textContent).toContain('a7c7826');
 });
});
