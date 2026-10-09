// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { cubeNumber, cubeSteps, sameCubeWall, validCubeProgram, type Cube, type Wall } from "../vendor/cubeComposerCore";
import { cubeChapterHelp, cubeChapterNames, cubeComposerLevels, cubeFunctionLabels, cubeLevelHelp } from "./cubeComposerLevels";
import { freshCubeRound, loadCubeRound, saveCubeRound, type CubeRound } from "./cubeComposerStorage";
import "./cubeComposerGame.css";

const colorInfo: Record<Cube, { name: string; fill: string; top: string; side: string }> = {
  Cyan: { name: "青", fill: "#74cfda", top: "#a8e7ea", side: "#3693a4" },
  Brown: { name: "棕", fill: "#ac7957", top: "#d6a37b", side: "#795038" },
  Red: { name: "红", fill: "#ed7f79", top: "#ffaaa1", side: "#b75252" },
  Orange: { name: "橙", fill: "#f3aa63", top: "#ffce97", side: "#c37834" },
  Yellow: { name: "黄", fill: "#f0d879", top: "#fff0a3", side: "#b99c3e" },
};
const wallText = (wall: Wall) => wall.length ? wall.map((column, i) => `第${i + 1}列（从底向上）：${column.map(color => colorInfo[color].name).join("、") || "空"}`).join("；") : "空墙，没有任何列";

function CubeWall({ wall, name, numbers }: { wall: Wall; name: string; numbers: boolean }) {
  const height = Math.max(1, ...wall.map(column => column.length)), width = Math.max(180, wall.length * 42 + 14), svgHeight = height * 26 + 42;
  return <div className="cube-wall-area">
    <div className="cube-wall-scroll" tabIndex={0} role="group" aria-label={`${name}，可滚动查看方块`}>
      <svg width={width} height={svgHeight} viewBox={`0 0 ${width} ${svgHeight}`} role="img" aria-label={`${name}。${wallText(wall)}`}>
        <path d={`M 5 ${height * 26 + 13} H ${width - 5}`} stroke="#d9cfc1" strokeWidth="2" />
        {wall.length === 0 && <text x={width / 2} y="30" textAnchor="middle" className="cube-empty-wall">空墙</text>}
        {wall.map((column, i) => <g key={i} data-cube-column={i} data-cube-stack={column.join(",")}>
          {column.map((color, j) => {
            const c = colorInfo[color], x = 9 + i * 42, y = 11 + (height - j - 1) * 26;
            return <g key={j} aria-hidden="true"><path d={`M${x},${y} l6,-5 h26 l-6,5 Z`} fill={c.top} stroke={c.side} strokeWidth=".7" /><path d={`M${x + 26},${y} l6,-5 v25 l-6,5 Z`} fill={c.side} /><rect x={x} y={y} width="26" height="25" rx="1" fill={c.fill} stroke={c.side} strokeWidth=".8" /><text x={x + 13} y={y + 17} textAnchor="middle" className="cube-letter">{c.name}</text></g>;
          })}
          <text x={25 + i * 42} y={svgHeight - 8} textAnchor="middle" className="cube-column-label">{numbers ? cubeNumber(column) : i + 1}</text>
        </g>)}
      </svg>
    </div>
    <details className="cube-readable"><summary>查看文字排列</summary><p>{wallText(wall)}</p></details>
  </div>;
}

export default function CubeComposerGame(props: GameProps) {
  return <CubeComposerRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CubeComposerRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = cubeComposerLevels[level] ?? cubeComposerLevels[0];
  const [round, setRound] = useState(() => freshStart ? freshCubeRound() : loadCubeRound(level, puzzle));
  const [stepIndex, setStepIndex] = useState(round.program.length), [saved, setSaved] = useState(true);
  const [message, setMessage] = useState("从函数库选择操作，结果会立即更新。目标墙的每一列、每一块都要完全相同。");
  const roundRef = useRef(round), callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const notified = useRef(false), tokens = useRef({ hintToken, undoToken });
  const steps = cubeSteps(puzzle.initial, round.program, puzzle.functions), final = steps[steps.length - 1];
  const won = sameCubeWall(final, puzzle.target), locked = paused || won;
  const shownIndex = Math.min(stepIndex, steps.length - 1), shown = steps[shownIndex];
  function report(text: string) { setMessage(text); callbacks.current.onStatus(text); }
  function update(next: CubeRound) { roundRef.current = next; setRound(next); setStepIndex(next.program.length); }
  function edit(program: string[], text: string) {
    const current = roundRef.current;
    if (paused || sameCubeWall(cubeSteps(puzzle.initial, current.program, puzzle.functions).at(-1)!, puzzle.target)) return;
    if (!validCubeProgram(program, puzzle.functions)) { report("每个函数在一条程序里最多使用一次。请先移除已有的函数，再调整顺序。"); return; }
    update({ program, history: [...current.history, [...current.program]].slice(-100) }); report(text);
  }
  function add(id: string) {
    const current = roundRef.current;
    if (current.program.includes(id)) { if (!locked) report("这个函数已经在程序中，不能重复使用。可以用前移、后移按钮调整顺序。"); return; }
    edit([...current.program, id], `已加入「${cubeFunctionLabels[id].title}」。观察它如何改变当前结果。`);
  }
  function shift(index: number, delta: number) {
    const program = [...roundRef.current.program], target = index + delta;
    if (target < 0 || target >= program.length) return;
    [program[index], program[target]] = [program[target], program[index]];
    edit(program, "已调整函数顺序。每一步都会从原始墙重新计算。");
  }
  useEffect(() => { callbacks.current.onStatus("每个函数只能用一次。按程序顺序变换方块，让结果与目标完全相同。"); }, []);
  useEffect(() => { setSaved(saveCubeRound(level, puzzle, round)); }, [level, puzzle, round]);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    report(puzzle.number === 25 ? "最后一关完成！三位运算得到的每一列都与目标一致。完整原作 25 关可随时回访。" : `完全一致！用 ${round.program.length} 个函数完成了这面方块墙。准备好再前往下一关。`);
    callbacks.current.onComplete();
  }, [won, paused, puzzle.number, round.program.length]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    const current = roundRef.current, previous = current.history.at(-1);
    if (!previous) { report("还没有可撤销的编辑。先试着加入一个函数。"); return; }
    update({ program: [...previous], history: current.history.slice(0, -1) }); report("已撤销上次编辑，程序与方块墙一起恢复。");
  }, [undoToken, locked]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused) return;
    report(`${cubeChapterHelp[puzzle.chapter]} 提示只解释规则，不改变程序。`);
  }, [hintToken, paused, puzzle.chapter]);
  return <div className="cube-composer" data-cube-id={puzzle.id} data-cube-chapter={puzzle.chapter} data-cube-program={round.program.join(",")}
    data-cube-result={JSON.stringify(final)} data-cube-step={shownIndex} data-cube-shown={JSON.stringify(shown)} data-cube-won={won}
    onKeyDownCapture={event => { if (event.repeat && ["Enter", " "].includes(event.key)) event.preventDefault(); }}>
    <header className="cube-heading"><div><span className="cube-eyebrow">CUBE COMPOSER · {cubeChapterNames[puzzle.chapter]}</span><h2>把变化，排成答案。</h2><p>原关 {puzzle.id} · {puzzle.name}</p></div><div className="cube-level-number">{String(puzzle.number).padStart(2, "0")}<small> / 25</small></div></header>
    <div className="cube-workspace">
      <section className="cube-observation" aria-label="目标与变换结果">
        <div className="cube-walls">
          <section className="cube-wall-card cube-target" data-cube-wall="target"><header><span>目标墙</span><small>每列都要吻合</small></header><CubeWall wall={puzzle.target} name="目标墙" numbers={puzzle.chapter === 5} /></section>
          <section className={`cube-wall-card ${won && shownIndex === round.program.length ? "is-matching" : ""}`} data-cube-wall="current"><header><span>{shownIndex === 0 ? "原始墙" : `第 ${shownIndex} 步结果`}</span><small>{won && shownIndex === round.program.length ? "完全一致 ✓" : `${shown.length} 列`}</small></header><CubeWall wall={shown} name="当前查看的墙" numbers={puzzle.chapter === 5} /></section>
        </div>
        <div className="cube-step-controls" role="group" aria-label="查看每一步"><span>查看过程</span>{steps.map((_, i) => <button key={i} type="button" data-cube-view-step={i} aria-label={i === 0 ? "查看原始墙" : `查看第 ${i} 步`} aria-pressed={shownIndex === i} disabled={paused} onClick={() => setStepIndex(i)}>{i === 0 ? "起点" : i}</button>)}</div>
        <div className="cube-legend" aria-label="方块颜色图例">{(Object.keys(colorInfo) as Cube[]).map(color => <span key={color}><i style={{ background: colorInfo[color].fill }} aria-hidden="true" />{colorInfo[color].name}</span>)}</div>
        <p className="cube-direction-note">列从左向右排列；每列从底向上读。{puzzle.chapter === 5 ? "列下方为十进制数值。橙 = 0，棕 = 1；底、中、顶权重为 1、2、4。" : "列下方为列序号。规则中 [下, 上] 表示从底向上的方块顺序。"}</p>
        <div className={`cube-feedback ${won ? "is-won" : ""}`} role="note"><span>{paused ? "已暂停" : won ? "组合完成" : "观察与尝试"}</span><p>{message}</p></div>
        <details className="cube-instructions"><summary>本章规则与操作说明</summary>{cubeLevelHelp[puzzle.id] && <p><strong>原关说明：</strong>{cubeLevelHelp[puzzle.id]}</p>}<p>{cubeChapterHelp[puzzle.chapter]}</p><p>点击函数加入程序；用前移、后移改变执行次序，用移除把函数送回库中。每个函数最多使用一次。支持 Tab、Enter 和空格，也可直接触摸操作，无需拖动。</p><p>上方可以暂停、撤销、重来和自由选关。清空程序可撤销；重来会恢复本关原始状态。点击过程编号可以查看全部中间步骤。查看旧步骤不改变判胜，只有完整程序的最后结果与目标逐列逐块相同才算完成。</p></details>
        <p className="cube-save">{saved ? "每关程序自动保存在此浏览器，离开后可继续。" : "暂时无法保存程序；仍可继续操作，请保持页面打开。"}</p>
      </section>
      <aside className="cube-programmer" aria-label="函数库与程序">
        <section className="cube-program"><header><div><span className="cube-eyebrow">YOUR COMPOSITION</span><h3>我的程序 <small>{round.program.length} / {puzzle.functions.length}</small></h3></div><button type="button" className="cube-clear" data-cube-clear disabled={locked || !round.program.length} onClick={() => edit([], "已清空程序。可以撤销这次清空，或换一种组合。")}>清空</button></header>
          {round.program.length === 0 ? <p className="cube-program-empty">先从下面选一个函数。<br />程序按 1 → 2 → 3 的顺序执行。</p> : <ol className="cube-program-list">{round.program.map((id, index) => <li key={id} data-cube-program-function={id}><div className="cube-program-title"><span>{index + 1}</span><strong>{cubeFunctionLabels[id].title}</strong></div><div className="cube-program-actions"><button type="button" aria-label={`前移第 ${index + 1} 个函数`} data-cube-earlier={id} disabled={locked || index === 0} onClick={() => shift(index, -1)}>↑ 前移</button><button type="button" aria-label={`后移第 ${index + 1} 个函数`} data-cube-later={id} disabled={locked || index === round.program.length - 1} onClick={() => shift(index, 1)}>↓ 后移</button><button type="button" aria-label={`移除${cubeFunctionLabels[id].title}`} data-cube-remove={id} disabled={locked} onClick={() => edit(roundRef.current.program.filter(item => item !== id), `已移除「${cubeFunctionLabels[id].title}」。`)}>移除</button></div></li>)}</ol>}
        </section>
        <section className="cube-library"><header><h3>函数库</h3><small>每个函数只能用一次</small></header><div className="cube-function-list">{puzzle.functions.map(id => {
          const label = cubeFunctionLabels[id], used = round.program.includes(id);
          return <button type="button" key={id} data-cube-add={id} className={used ? "is-used" : ""} disabled={locked || used} aria-label={`加入${label.title}`} onClick={() => add(id)}><span className="cube-function-top"><strong>{label.title}</strong><span aria-hidden="true">{used ? "已加入" : "+"}</span></span><span className="cube-notation">{label.notation}</span><span className="cube-function-detail">{label.detail}</span></button>;
        })}</div></section>
      </aside>
    </div>
  </div>;
}
