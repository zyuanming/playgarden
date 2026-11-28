// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { wordChainLevels } from "./wordChainLevels";
import { nextStamp, placement, restoreWords, solved, tailOf, wordChainSave, wordHint } from "./wordChainLogic";
import "./wordChain.css";

const opening = "找一张以当前字开头的词牌。";
const success = "词链拼好了，所有词牌都已用完！";
export default function WordChain(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({level, freshStart, paused, hintToken, undoToken, onComplete, onStatus}: GameProps) {
  const board = wordChainLevels[level] ?? wordChainLevels[0];
  const saveKey = wordChainSave + ".round." + level;
  const [trail, setTrail] = useState<string[]>(() => {
    try { return restoreWords(board, freshStart ? null : localStorage.getItem(saveKey)); }
    catch { return []; }
  });
  const [message, setMessage] = useState(() => trail.length ? "已恢复上次拼到的位置。" : opening);
  const [hint, setHint] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const tail = tailOf(board, trail);
  const stamp = nextStamp(board, trail);
  const stampNo = stamp ? board.stamps.findIndex(word => word === stamp) + 1 : 0;
  const won = solved(board, trail), locked = paused || won;
  const remaining = board.words.length - trail.length;
  const live = useRef({onComplete, onStatus});
  live.current = {onComplete, onStatus};
  const used = useRef({hintToken, undoToken, won: false});
  const report = (text: string) => { setMessage(text); live.current.onStatus(text); };

  useEffect(() => {
    try { localStorage.setItem(saveKey, JSON.stringify({id: board.id, words: trail})); }
    catch { setSaveError(true); }
  }, [saveKey, board.id, trail]);
  useEffect(() => {
    if (paused || !won || used.current.won) return;
    used.current.won = true;
    live.current.onStatus(success);
    live.current.onComplete();
  }, [paused, won]);
  useEffect(() => {
    if (hintToken === used.current.hintToken) return;
    used.current.hintToken = hintToken;
    if (locked) return;
    const word = wordHint(board, trail);
    setHint(word);
    report(word ? "提示：“" + word + "”可以接出完整词链。" : "从这里已没有完整接法。试试撤销。");
  }, [board, trail, locked, hintToken]);
  useEffect(() => {
    if (undoToken === used.current.undoToken) return;
    used.current.undoToken = undoToken;
    if (locked) return;
    setHint(null);
    if (!trail.length) { report("还没有可以撤销的词牌。"); return; }
    setTrail(trail.slice(0, -1));
    report("已撤销“" + trail.at(-1) + "”，词牌放回牌架。");
  }, [trail, locked, undoToken]);

  function append(word: string) {
    if (locked) return;
    const result = placement(board, trail, word);
    if (result === "head") { report("“" + word + "”不以“" + tail + "”开头。"); return; }
    if (result === "stamp") { report("先接印章 " + stampNo + "「" + stamp + "」，再接“" + word + "”。"); return; }
    if (result !== "ok") return;
    const next = [...trail, word];
    setTrail(next);
    setHint(null);
    if (solved(board, next)) return;
    if (word[1] === board.end) report("已接到终点字“" + board.end + "”，但还剩 " + (remaining - 1) + " 张牌。");
    else if (remaining === 1) report("牌已用完，但没停在终点字。可以撤销重接。");
    else report("已接上“" + word + "”，接下来找以“" + word[1] + "”开头的词。");
  }

  return <div className="puzzle-layout word-chain" data-board={board.id} data-tail={tail}
    data-used={trail.length} data-next-stamp={stamp ?? ""} data-won={won}>
    <section className="wc-panel" aria-label="词链拼接操作区">
      <header className="wc-head">
        <div><small>词牌工坊 / 第 {level + 1} 关</small><h3>{board.title}</h3></div>
        <span className="wc-count">剩 {remaining} 张</span>
      </header>
      <div className="wc-current">
        <div className="wc-active"><span>当前字</span><strong>{tail}</strong></div>
        <div><span>起点 → 终点</span><b>{board.start} → {board.end}</b></div>
        <div><span>下一枚印章</span><b>{stamp ? stampNo + " · " + stamp : board.stamps.length ? "已盖齐" : "无"}</b></div>
      </div>
      <div className="wc-chain">
        <span>词链</span>
        {trail.length > 0
          ? <ol aria-label="最近接上的词牌" start={Math.max(1, trail.length - 3)}>{trail.slice(-4).map(word => <li key={word}>{word}</li>)}</ol>
          : <span className="wc-empty">从“{board.start}”开始</span>}
      </div>
      <div className="wc-rack" aria-label="可选词牌">
        {board.words.map(word => {
          const result = placement(board, trail, word);
          const n = board.stamps.findIndex(w => w === word) + 1;
          const taken = result === "used";
          const label = taken ? "已接入"
            : result === "head" ? "首字不同"
            : result === "stamp" ? "印章未到"
            : hint === word ? "提示 · 可接" : "可接";
          return <button type="button" className="wc-card" key={word} data-word={word}
            data-placement={result} data-hint={hint === word}
            disabled={locked} aria-disabled={taken || undefined} tabIndex={taken ? -1 : undefined}
            aria-label={word + "，" + (n ? "印章 " + n + "，" : "") + label}
            onClick={() => append(word)}>
            {n > 0 && <span className="wc-stamp">{n}</span>}
            <span className="wc-word"><span>{word[0]}</span><span>{word[1]}</span></span>
            <small>{label}</small>
          </button>;
        })}
      </div>
      <p className="wc-readout" role="status">{paused ? "已暂停。" : won ? success : message}</p>
      {trail.length > 4 && <details className="wc-history"><summary>查看完整词链（{trail.length} 张）</summary><p>{trail.join(" → ")}</p></details>}
      {saveError && <p className="wc-save">浏览器未能保存，刷新可能丢失本局。</p>}
    </section>
    <aside className="game-notes wc-notes">
      <span className="mini-label">汉字 / 路线规划</span>
      <h3>相同的字，就是接头。</h3>
      <div className="wc-example"><b>头<u>发</u> → <u>发</u>芽</b><small>读音不同也能接，只看字形。</small></div>
      <ol>
        <li>上一张的末字必须等于下一张的首字。</li>
        <li>印章按号码接，中间可以穿插普通词牌。</li>
        <li>用完全部词牌，再停在终点字。提前接到终点不算通关。</li>
      </ol>
      <p>提示只标牌，不代你出牌。可以撤销。键盘用 Tab 移到词牌，按 Enter 或空格接入。</p>
    </aside>
  </div>;
}
