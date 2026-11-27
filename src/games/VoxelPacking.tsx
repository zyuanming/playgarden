// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { packingLevels } from './voxelPackingLevels';
import {
  PACKING_SAVE,bits,cellBit,getPackingHint,inspectDrop,preparePacking,replay,rotate,sealed,shapeKey,
  type Axis,type Cube,type Drop,type Placement,
} from './voxelPackingLogic';
import './voxelPacking.css';

const intro='选一件积木、转到合适朝向，再从箱口直落。落下前可以查看每一层。';
const colors=['#388a75','#c67c35','#7078b9','#bf5f76','#3e84a6','#987344'];
type Solid = { cell:Cube; tint:string; ghost?:boolean };
const project=([x,y,z]:Cube)=>[80+17*(x-y),66+9*(x+y)-18*z].join(',');
const corners=(x:number,y:number,z:number,face:0|1|2):Cube[] => face===0
  ? [[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]]
  : face===1 ? [[x,y+1,z+1],[x+1,y+1,z+1],[x+1,y+1,z],[x,y+1,z]]
  : [[x+1,y,z+1],[x+1,y+1,z+1],[x+1,y+1,z],[x+1,y,z]];
const sum=(p:Cube)=>p[0]+p[1]+p[2];
function Iso({ cubes,width,depth,label }: {cubes:Solid[];width:number;depth:number;label:string}) {
  const floor:Cube[]=[[0,0,0],[width,0,0],[width,depth,0],[0,depth,0]];
  return <svg className="vp-iso" viewBox="20 4 120 119" role="img" aria-label={label}>
    <polygon points={floor.map(project).join(' ')} fill="#edf0de" stroke="#7e9b8b" strokeWidth="1.2" />
    {[...cubes].sort((a,b)=>sum(a.cell)-sum(b.cell)||a.cell[2]-b.cell[2]).map(({cell:[x,y,z],tint,ghost})=>
      <g key={[x,y,z].join(',')} opacity={ghost ? 0.55 : 1} stroke={ghost?'#6a4e14':'#244a45'} strokeDasharray={ghost?'2 1':undefined} strokeWidth=".8">
        {([1,2,0] as const).map(face=><polygon key={face} points={corners(x,y,z,face).map(project).join(' ')}
          fill={tint} style={{filter:'brightness('+[1.18,0.88,0.72][face]+')'}}/>)}
      </g>)}
  </svg>;
}
export default function VoxelPacking(props:GameProps){
  return <PackingRound key={props.level+':'+props.resetToken} {...props}/>;
}
function PackingRound({level,paused,freshStart,hintToken,undoToken,onComplete,onStatus}:GameProps){
  const p=packingLevels[level]??packingLevels[0];
  const l=useMemo(()=>preparePacking(p),[p]);
  const key=PACKING_SAVE+'.round.'+level;
  const [history,setHistory]=useState<Placement[]>(()=>{
    try{return replay(l,freshStart?null:localStorage.getItem(key));}catch{return [];}
  });
  const used=history.reduce((m,v)=>m|1<<v.piece,0);
  const occ=history.reduce((m,v)=>m|v.mask,l.fixed);
  const first=p.pieces.findIndex((_,i)=>!(used&1<<i));
  const firstDraft=(piece:number):Drop|null=>piece>=0?{piece,orientation:l.choices[piece][0].key,column:0,row:0}:null;
  const [draft,setDraft]=useState<Drop|null>(()=>firstDraft(first));
  const [layer,setLayer]=useState(0);
  const [message,setMessage]=useState(history.length?'已恢复装箱记录，可继续放入积木或撤销。':intro);
  const [saved,setSaved]=useState(true);
  const [hintState,setHintState]=useState('');
  const tokens=useRef({hintToken,undoToken,won:false});
  const c=useRef({onStatus,onComplete});c.current={onStatus,onComplete};
  const win=occ===l.full&&used===l.all,locked=paused||win;
  const preview=draft ? inspectDrop(l,occ,draft) : null;
  const covered=(preview?.kind==='ok')&&sealed(p,occ|preview.mask);
  const shape=draft?l.choices[draft.piece].find(o=>o.key===draft.orientation):null;
  const placed:Solid[]=[...p.fixed.map(cell=>({cell,tint:'#62746e'})),...history.flatMap(h=>h.cells.map(cell=>({cell,tint:colors[h.piece]})))];
  function report(s:string){setMessage(s);c.current.onStatus(s);}
  useEffect(()=>{c.current.onStatus(message);},[]);
  useEffect(()=>{
    try{
      const moves=history.map(({piece,orientation,row,column})=>({piece,orientation,row,column}));
      localStorage.setItem(key,JSON.stringify({id:p.id,moves}));
      setSaved(true);
    }catch{setSaved(false);}
  },[key,p.id,history]);
  useEffect(()=>{
    if(!win||paused||tokens.current.won)return;
    tokens.current.won=true;
    c.current.onStatus('装箱完成！所有方格填满，积木全部用完。');
    c.current.onComplete();
  },[win,paused]);
  useEffect(()=>{
    if(tokens.current.undoToken===undoToken)return;
    tokens.current.undoToken=undoToken;if(locked)return;
    setHintState('');
    const last=history[history.length-1];
    if(!last){report('还没有可以撤销的投放。');return;}
    setHistory(history.slice(0,-1));
    setDraft({piece:last.piece,orientation:last.orientation,column:last.column,row:last.row});
    setLayer(last.landing);
    report('已撤销这次投放，积木和箱内空间一并恢复。');
  },[undoToken,locked,history]);
  useEffect(()=>{
    if(tokens.current.hintToken===hintToken)return;
    tokens.current.hintToken=hintToken;if(locked)return;
    const h=getPackingHint(l,occ,used);
    setHintState(h.kind);
    if(h.kind==='move'){
      setDraft(h.move);
      const inspected=inspectDrop(l,occ,h.move);
      if(inspected.kind==='ok')setLayer(inspected.landing);
      report('已预览一条可完成路线的下一步。积木尚未落下。');
    }else if(h.kind==='budget'){
      report('已达到提示搜索上限，暂时没有建议。这不代表无解。');
    }else report(sealed(p,occ)?'上方积木封住了空格，此局面无法装满。请撤销。':'虽然没有封住空格，但剩余积木无法按直落规则装满。请撤销。');
  },[hintToken,l,occ,used,p,locked]);

  function change(m:Drop){
    if(locked)return;
    setDraft(m);setHintState('');
    const next=inspectDrop(l,occ,m);
    if(next.kind==='ok')setLayer(next.landing);
  }
  function drop(){
    if(locked||!draft||preview?.kind!=='ok'||used&1<<draft.piece)return;
    setHistory([...history,{...draft,landing:preview.landing,mask:preview.mask,cells:preview.cells}]);
    setDraft(firstDraft(p.pieces.findIndex((_,i)=>!((used|1<<draft.piece)&1<<i))));
    setHintState('');
    setLayer(preview.landing);
    report(covered?'积木已落下，但有空格被上方盖住。可以撤销。':'第 '+(draft.piece+1)+' 件已落下。可继续选件或切换楼层查看。');
  }
  function layerCell(x:number,y:number){
    const bit=cellBit(p,[x,y,layer]);
    if(preview?.kind==='ok'&&preview.mask&bit)return '预';
    if(l.fixed&bit)return '底';
    const index=history.find(h=>h.mask&bit)?.piece;
    return index===undefined?'':String(index+1);
  }
  return <div className="puzzle-layout vp-game" data-vp-id={p.id} data-vp-mask={occ} data-vp-used={used}
    data-vp-history={history.length} data-vp-won={win} data-vp-layer={layer}
    data-vp-preview={preview?.kind??''} data-vp-landing={preview && 'landing' in preview?preview.landing:''} data-vp-sealed={sealed(p,occ)}
    data-vp-hint={hintState} data-vp-orientation={draft?.orientation??''}>
    <section className="vp-panel" aria-label="空间装箱主面板">
      <header className="vp-header"><div><small>立体工坊 · 第 {level+1} 关</small><h3>{p.title}</h3></div>
        <strong>{bits(occ)} / {p.width*p.depth*p.height} 格</strong></header>
      <section aria-label="选择积木" className="vp-picks">
        {p.pieces.map((cells,i)=><button key={i} type="button" data-vp-piece={i} disabled={locked||!!(used&1<<i)}
          aria-pressed={draft?.piece===i} onClick={()=>change(firstDraft(i)!)} style={{borderColor:draft?.piece===i?colors[i]:undefined}}>
          <b style={{color:colors[i]}}>件 {i+1}</b><small>{used&1<<i?'已入箱':cells.length+' 格'}</small>
        </button>)}
      </section>
      {draft && shape && <div className="vp-rotate">
        <label>积木朝向 <select aria-label="积木朝向" value={draft.orientation} disabled={locked}
          onChange={e=>change({...draft,orientation:e.target.value})}>
          {l.choices[draft.piece].map((o,i)=><option key={o.key} value={o.key}>朝向 {i+1} / {l.choices[draft.piece].length}</option>)}
        </select></label>
        <div role="group" aria-label="旋转积木">{(['X','Y','Z'] as Axis[]).map(axis=><button key={axis} type="button" disabled={locked} data-vp-axis={axis}
          onClick={()=>change({...draft,orientation:shapeKey(rotate(shape.local,axis))})}>↻ {axis}</button>)}</div>
      </div>}
      <div className="vp-visuals">
        <div className="vp-planes">
          <div className="vp-tabs" role="group" aria-label="查看层面">
            {Array.from({length:p.height},(_,z)=><button key={z} type="button" data-vp-floor={z} aria-pressed={layer===z}
              onClick={()=>setLayer(z)} disabled={paused}>{z+1} 层</button>)}
          </div>
          <div className="vp-grid" style={{gridTemplateColumns:'repeat('+p.width+', minmax(44px,1fr))'}} role="group" aria-label="选列和行作为落点锚格">
            {Array.from({length:p.width*p.depth},(_,i)=>{
              const x=i%p.width, y=Math.floor(i/p.width), mark=layerCell(x,y);
              return <button key={i} type="button" data-vp-anchor={x+','+y} data-mark={mark||'空'}
                aria-label={x+1+' 列 '+(y+1)+' 行，'+(mark==='预'?'预览':mark==='底'?'底座':mark?'积木 '+mark:'空')}
                aria-pressed={draft?.column===x&&draft?.row===y} disabled={locked||!draft}
                onClick={()=>{if(draft)change({...draft,column:x,row:y});}}>{mark||'·'}</button>;
            })}
          </div>
          <small>点格定锚点 · 查看第 {layer+1} 层</small>
        </div>
        <div className="vp-picture">
          <Iso width={p.width} depth={p.depth} cubes={[...placed,...(preview?.kind==='ok'?preview.cells.map(cell=>({cell,tint:'#e5b34d',ghost:true})):[])]}
            label="箱内积木和黄色投放预览的立体示意"/>
          <small>立体示意 · 黄块是预览</small>
        </div>
      </div>
      {draft && shape && <details className="vp-shape"><summary>单看第 {draft.piece+1} 件的当前朝向</summary>
        <Iso width={p.width} depth={p.depth} cubes={shape.local.map(cell=>({cell,tint:colors[draft.piece]}))} label="积木旋转后的形状"/>
      </details>}
      <div className="vp-confirm"><button type="button" data-vp-drop disabled={locked||preview?.kind!=='ok'} onClick={drop}>确认直落</button>
        <span>{win?'装箱完成':preview?.kind==='ok'?'将落在第 '+(preview.landing+1)+' 层'+(covered?' · 会封住空格':'')
          :preview?.kind==='rim'?'会高出箱口，不能投放':preview?.kind==='wall'?'积木超出箱壁，换个落点':'请选择积木'}</span></div>
      <p role="status" className="vp-status">{paused?'已暂停。':win?'装箱完成！每格都有积木。':message}</p>
      {!saved&&<small>浏览器无法保存本局，刷新后可能丢失进度。</small>}
    </section>
    <aside className="game-notes"><span className="mini-label">旋转 · 直落 · 顺序</span><h3>放得进去，还要放得下去。</h3>
      <ol><li>选择任意未用积木。可绕 X、Y、Z 旋转，不可镜像翻面。</li>
        <li>在俯视格上选锚点，查看预览后才确认。积木从箱口直落，碰到底部或其他积木就停。</li>
        <li>填满全箱才能过关。上方盖住的洞不能再填，换个投放顺序试试。</li></ol>
      <p>「底」是固定底座，数字是积木编号，「预」是未落下的预览。Tab 和空格也能操作。</p>
    </aside>
  </div>;
}
