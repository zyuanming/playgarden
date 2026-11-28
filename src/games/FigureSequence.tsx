// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { figureSequenceLevels } from "./figureSequenceLevels";
import { moveAt, moves, ruleMoves, trace, type Rule, type FigureBoard } from "./figureSequenceLogic";
import "./figureSequence.css";

const intro = "选一张规则牌试试看，预览不会提交。";
const success = "规则对上了每张已知图，留白也补齐了！";

export default function FigureSequence(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}
function Round({level, paused, hintToken, undoToken, onComplete, onStatus}: GameProps) {
  const board: FigureBoard = figureSequenceLevels[level] ?? figureSequenceLevels[0];
  const [selected, setSelected] = useState<Rule|null>(null);
  const [attempts, setAttempts] = useState(0);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState(intro);
  const [focusStep, setFocusStep] = useState<number|null>(null);
  const live = useRef({onComplete,onStatus});
  live.current = {onComplete,onStatus};
  const seen = useRef({hintToken,undoToken});
  const preview = selected ? trace(board, selected) : null;
  const locked = paused || won;
  function report(text: string) { setMessage(text); live.current.onStatus(text); }
  useEffect(() => { live.current.onStatus(intro); }, []);
  useEffect(() => {
    if(seen.current.hintToken===hintToken) return;
    seen.current.hintToken=hintToken;
    if(locked) return;
    const step = preview?.mismatches[0];
    if(selected && step!==undefined) {
      setFocusStep(step);
      report("第一次不符在第 " + step + " 步（这一轮是" + moves[moveAt(selected,step)].name + "）。对照标 × 的格子。");
    } else if(preview) report("这张牌能解释所有已知图。确认后才算通关。");
    else report("从起始图出发逐步推。遇到留白也要走一步，再比对下一张已知图。");
  }, [hintToken,locked,preview,selected]);
  useEffect(() => {
    if(seen.current.undoToken===undoToken) return;
    seen.current.undoToken=undoToken;
    if(!locked) clear();
  }, [undoToken,locked]);
  function choose(rule: Rule) {
    if(locked) return;
    setSelected(rule);
    setFocusStep(null);
    const mismatches=trace(board,rule).mismatches;
    report(mismatches.length ? "试算：有 " + mismatches.length + " 张已知图对不上。"
      : "试算：对上了所有已知图。确认后才算通关。");
  }
  function clear() {
    if(locked) return;
    setSelected(null);
    setFocusStep(null);
    report("已清除预览，已知图不变。");
  }
  function confirm() {
    if(locked || !preview) return;
    setAttempts(a=>a+1);
    const step=preview.mismatches[0];
    if(step!==undefined) {
      setFocusStep(step);
      report("第 " + step + " 步不是这张图。可以换一张规则牌重试。");
      return;
    }
    setWon(true);
    report(success);
    live.current.onComplete();
  }

  return <div className="puzzle-layout figure-sequence" data-board={board.id}
    data-rule={selected ?? ""} data-attempts={attempts} data-won={won}>
    <section className="fs-panel" aria-label="图形序列操作区">
      <header className="fs-head">
        <div><small>图案侦探 / 第 {level+1} 关</small><h3>{board.title}</h3></div>
        <span>{board.shown.filter(frame=>frame===null).length} 处留白</span>
      </header>
      <ol className="fs-frames" aria-label="按时间排列的图案">
        {board.shown.map((given,i)=> {
          const predicted=preview?.frames[i];
          const shown=given ?? predicted;
          const mask=given===null || predicted===undefined ? 0 : given^predicted;
          const state=given===null ? predicted===undefined ? "blank" : "prediction" : mask ? "conflict" : "clue";
          const label=i===0?"起始图":"第 "+i+" 步";
          return <li key={i} className="fs-frame" data-step={i} data-frame-state={state}
            data-bits={shown ?? ""} data-prediction={predicted ?? ""} data-active={focusStep===i}>
            <b>{label}</b>
            {shown===undefined
              ? <div className="fs-blank" aria-label={label+"，留白"}>?</div>
              : <div className="fs-grid" role="group" aria-label={label}>
                  {Array.from({length:9},(_,bit)=>{
                    const filled=!!(shown&(1<<bit)), mismatch=!!(mask&(1<<bit));
                    return <span key={bit} className="fs-cell" role="img" data-filled={filled} data-difference={mismatch}
                      aria-label={"第 "+(Math.floor(bit/3)+1)+" 行第 "+(bit%3+1)+" 列，"+(filled?"实心":"空心")+(mismatch?"，与预览不符":"")}>{mismatch?"×":""}</span>;
                  })}
                </div>}
            <small>{state==="blank"?"留白":state==="prediction"?won?"已补齐":"预测":state==="conflict"?"× 不符":"已知"}</small>
          </li>;
        })}
      </ol>
      <h4 className="fs-deck-title">选规则牌</h4>
      <div className="fs-deck" role="group" aria-label="候选规则">
        {board.rules.map((rule,i)=>{
          const parts=ruleMoves(rule);
          return <button key={rule} type="button" className="fs-card" data-rule-card={rule}
            disabled={locked} aria-pressed={selected===rule} onClick={()=>choose(rule)}>
            <span className="fs-card-index" aria-hidden="true">{i+1}</span>
            {parts.map((move,index)=><span className="fs-card-move" key={index}>
              <span aria-hidden="true" className="fs-glyph">{moves[move].glyph}</span>
              <span>{parts.length===1?"每步":index===0?"先":"再"}：{moves[move].name}</span>
            </span>)}
          </button>;
        })}
      </div>
      <div className="fs-actions">
        <button type="button" disabled={locked||!selected} onClick={clear}>清除预览</button>
        <button type="button" disabled={locked||!selected} onClick={confirm}>确认规则</button>
      </div>
      <p className="fs-status" role="status">{paused?"已暂停。":message}</p>
    </section>
    <aside className="game-notes fs-notes">
      <span className="mini-label">规律 / 证据 / 预测</span>
      <h3>结尾一样，也可能走错。</h3>
      <ol>
        <li>从起始图出发，逐步使用规则。翻色表示实心和空心对换。</li>
        <li>有两种操作时，先做第一项，再做第二项，然后重复。留白也占一步。</li>
        <li>预览中，虚线框是预测，× 指出和已知图不一样的格子。所有已知图都对上，再确认。</li>
      </ol>
      <p>键盘用 Tab 移到规则牌和按钮，按 Enter 或空格操作。</p>
    </aside>
  </div>;
}
