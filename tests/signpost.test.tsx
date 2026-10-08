// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import SignpostGarden from '../src/games/SignpostGarden';
import { signpostLevels } from '../src/games/signpostLevels';
import { SIGNPOST_SAVE,initialSignpost,inspectSignpost,linkSignpost,unlinkSignpost,parseSignpostSave,solveSignpost,pointsTo } from '../src/games/signpostLogic';
const proofs=JSON.parse(readFileSync('docs/signpost/campaign.json','utf8')).levels as {solution:number[]}[];
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
it('all30 original certificates support arbitrary-order linking and current-state solving',()=>{
 expect(signpostLevels).toHaveLength(30);
 for(const [index,p] of signpostLevels.entries()){
  const path=proofs[index].solution;let state=initialSignpost(p);const solved=solveSignpost(p,state);expect(solved.kind).toBe('solution');
  // Join suffixes before prefixes to exercise relative groups and back propagation.
  for(let k=path.length-2;k>=0;k--){const r=linkSignpost(p,state,path[k],path[k+1]);expect(r.reason).toBe('');state=r.state;expect(inspectSignpost(p,state).valid).toBe(true);}
  expect(inspectSignpost(p,state).won).toBe(true);expect(unlinkSignpost(p,state,path[0])).toBe(state);expect(linkSignpost(p,state,path[0],path[1]).state).toBe(state);
 }
});
it('rays skip cells, reject off-ray, cycles, occupied links, inconsistent anchors and malformed saves',()=>{
 const p=signpostLevels[0],fresh=initialSignpost(p),path=proofs[0].solution;
 for(const bad of [-1,NaN,1.5,Infinity,p.arrows.length])expect(linkSignpost(p,fresh,bad,0).state).toBe(fresh);
 expect(pointsTo(p,0,0)).toBe(false);expect(inspectSignpost(p,[...fresh,0]).valid).toBe(false);expect(inspectSignpost(p,fresh.map(()=>NaN)).valid).toBe(false);
 const one=linkSignpost(p,fresh,path[0],path[1]).state;expect(linkSignpost(p,one,path[0],path[1]).state).toBe(one);expect(unlinkSignpost(p,one,path[0])).toEqual(fresh);
 const tiny={id:'fixture',title:'fixture',chapter:0,width:3,height:1,arrows:[2,2,-1],clues:[1,0,3]};
 expect(pointsTo(tiny,0,2)).toBe(true);expect(linkSignpost(tiny,[-1,-1,-1],0,2).reason).toContain('间隔');
 const cycle={...tiny,width:2,height:2,arrows:[2,4,0,6],clues:[0,0,0,0]};expect(inspectSignpost(cycle,[1,3,0,2]).valid).toBe(false);
 expect(solveSignpost(p,fresh,0).kind).toBe('budget');
 for(const raw of ['{',JSON.stringify({id:'wrong',history:[fresh]}),JSON.stringify({id:p.id,history:[fresh,one,fresh.map(()=>0)]}),JSON.stringify({id:p.id,history:[fresh,fresh]})])expect(parseSignpostSave(raw,p)).toEqual([fresh]);
 expect(parseSignpostSave(JSON.stringify({id:p.id,history:[fresh,one]}),p)).toEqual([fresh,one]);
});
it('a legal-looking wrong chain is rejected by the bounded current-state search',()=>{
 let witnessed=false;
 for(const [idx,p] of signpostLevels.entries()){
 const answer=proofs[idx].solution,expected=initialSignpost(p);answer.slice(0,-1).forEach((i,k)=>expected[i]=answer[k+1]);
 for(let a=0;a<expected.length&&!witnessed;a++)for(let b=0;b<expected.length&&!witnessed;b++)if(b!==expected[a]){
  const fresh=initialSignpost(p),r=linkSignpost(p,fresh,a,b);if(r.state!==fresh){expect(solveSignpost(p,r.state).kind).toBe('none');witnessed=true;}
 }
 if(witnessed)break;
 }expect(witnessed).toBe(true);
});
it('DOM selection, split, undo, pause token consumption, reset and completion lock agree with shell',()=>{
 const props={level:0,paused:false,resetToken:0,hintToken:0,undoToken:0,onComplete:vi.fn(),onStatus:vi.fn()},p=signpostLevels[0],path=proofs[0].solution;
 const v=render(<SignpostGarden {...props}/>),root=()=>v.container.querySelector('.signpost-layout')!,cell=(i:number)=>v.container.querySelector(`button[data-cell="${i}"]`)!;
 const select=(a:number)=>{if(root().getAttribute('data-signpost-selected')!==String(a)){if(root().getAttribute('data-signpost-selected'))fireEvent.click(v.getByText('换个起点'));fireEvent.click(cell(a));}};
 select(path[0]);fireEvent.click(cell(path[1]));const one=root().getAttribute('data-signpost-state');expect(one).not.toBe(initialSignpost(p).join(','));
 select(path[0]);fireEvent.click(v.getByText('断开出线'));expect(root().getAttribute('data-signpost-state')).toBe(initialSignpost(p).join(','));
 v.rerender(<SignpostGarden {...props} undoToken={1}/>);expect(root().getAttribute('data-signpost-state')).toBe(one);
 v.rerender(<SignpostGarden {...props} paused hintToken={1} undoToken={2}/>);fireEvent.click(cell(path[2]));expect(root().getAttribute('data-signpost-state')).toBe(one);
 v.rerender(<SignpostGarden {...props} hintToken={1} undoToken={2}/>);expect(root().getAttribute('data-signpost-state')).toBe(one);expect(v.container.querySelector('.hint')).toBeNull();
 v.rerender(<SignpostGarden {...props} resetToken={1} hintToken={1} undoToken={2}/>);expect(root().getAttribute('data-signpost-state')).toBe(initialSignpost(p).join(','));
 v.rerender(<SignpostGarden {...props} resetToken={1} hintToken={2} undoToken={2}/>);expect(v.container.querySelectorAll('.hint')).toHaveLength(1);expect(root().getAttribute('data-signpost-state')).toBe(initialSignpost(p).join(','));
 for(let k=0;k<path.length-1;k++){select(path[k]);fireEvent.click(cell(path[k+1]));}
 expect(root().getAttribute('data-signpost-won')).toBe('true');expect(props.onComplete).toHaveBeenCalledTimes(1);
 v.rerender(<SignpostGarden {...props} resetToken={1} hintToken={3} undoToken={3}/>);expect(root().getAttribute('data-signpost-won')).toBe('true');expect(props.onComplete).toHaveBeenCalledTimes(1);
 expect((cell(path[0]) as HTMLButtonElement).disabled).toBe(true);
});
it('storage recovery and unavailable storage remain playable',()=>{
 const p=signpostLevels[0],path=proofs[0].solution,fresh=initialSignpost(p),one=linkSignpost(p,fresh,path[0],path[1]).state;
 localStorage.setItem(`${SIGNPOST_SAVE}.round.0`,JSON.stringify({id:p.id,history:[fresh,one]}));
 const props={level:0,paused:false,resetToken:0,hintToken:0,undoToken:0,onComplete:vi.fn(),onStatus:vi.fn()};
 const v=render(<SignpostGarden {...props}/>);expect(v.container.querySelector('.signpost-layout')?.getAttribute('data-signpost-state')).toBe(one.join(','));v.unmount();
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('full');});
 const w=render(<SignpostGarden {...props} freshStart/>);expect(w.getByText(/当前无法保存/)).toBeTruthy();expect(w.container.querySelector('.signpost-layout')?.getAttribute('data-signpost-state')).toBe(fresh.join(','));
});
