// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { debugCases } from './debugDetectiveLevels';
import {
  DEBUG_SAVE, INPUTS, REGISTER, bestProbe, execute, expression, fullyMatches,
  initial, loadRound, predictions, survivors,
} from './debugDetectiveLogic';
import './debugDetective.css';

const intro = '选择开关输入，记录期望和实际亮灯的结果，再排除不符合的修复。';
function Lamps({ bits }: { bits: string }) {
  return <span className="dd-lamps" aria-label={bits.split('').join(' ')}>
    {[...bits].map((bit, i) => <b key={i} data-lit={bit === '1'}>{bit}</b>)}
  </span>;
}
export default function DebugDetective(props: GameProps) {
  return <DetectiveRound key={props.level + ':' + props.resetToken} {...props} />;
}
function DetectiveRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus }: GameProps) {
  const puzzle = debugCases[level] ?? debugCases[0];
  const table = useMemo(() => predictions(puzzle), [puzzle]);
  const key = DEBUG_SAVE + '.round.' + level;
  const [state, setState] = useState(() => {
    try { return freshStart ? initial() : loadRound(puzzle, table, localStorage.getItem(key)); }
    catch { return initial(); }
  });
  const [message, setMessage] = useState(state.probes.length ? '已恢复上次记录的测试。' : intro);
  const [suggested, suggest] = useState<number | null>(null);
  const [traceInput, setTrace] = useState<number | null>(null);
  const [saved, setSaved] = useState(true);
  const callback = useRef({ onComplete, onStatus });
  callback.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken, complete: false });
  const possible = survivors(puzzle, table, state.probes);
  const left = puzzle.budget - state.probes.length;
  const repeated = state.probes.includes(state.input);
  const locked = paused || state.solved;
  const canConfirm = possible.length === 1 && state.pick === possible[0] && state.probes.length > 0;
  function report(text: string) {
    setMessage(text);
    callback.current.onStatus(text);
  }
  useEffect(() => { callback.current.onStatus(message); }, []);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ id: puzzle.id, ...state })); setSaved(true); }
    catch { setSaved(false); }
  }, [key, puzzle.id, state]);
  useEffect(() => {
    if (!state.solved || paused || tokens.current.complete) return;
    tokens.current.complete = true;
    callback.current.onStatus('证据成立！修复后的程序通过全部 8 种输入。');
    callback.current.onComplete();
  }, [paused, state.solved]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (!state.probes.length) { report('还没有可以撤销的测试。'); return; }
    const last = state.probes[state.probes.length - 1];
    setState({ ...state, probes: state.probes.slice(0, -1), input: last });
    if (traceInput === last) setTrace(null);
    suggest(null);
    report('已撤销最近一次测试，返还 1 次测试机会。');
  }, [locked, state, traceInput, undoToken]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    suggest(null);
    if (possible.length === 1) {
      report('只剩一个符合证据的方案。选中它并确认即可。');
      return;
    }
    if (left === 0) { report('测试次数已用完，仍有多个方案。撤销一次再试。'); return; }
    const next = bestProbe(table, possible, state.probes);
    if (!next || next.depth > left) {
      report('现有证据下，剩余次数不能保证区分所有方案。可以撤销一次，换个输入。');
      return;
    }
    suggest(next.input);
    report('建议测试 ABC = ' + INPUTS[next.input] + '。不管灯怎样亮，最多留下 ' + next.biggest + ' 个方案。提示未更改输入。');
  }, [hintToken, left, locked, possible, state.probes, table]);

  function flip(i: number) {
    if (!locked) setState({ ...state, input: state.input ^ 1 << (2 - i) });
  }
  function probe() {
    if (locked || left < 1 || repeated) return;
    const probes = [...state.probes, state.input];
    setState({ ...state, probes });
    suggest(null);
    const n = survivors(puzzle, table, probes).length;
    report(n === 1 ? '证据已锁定唯一方案。请选择一张修复卡确认。'
      : '测试已记录，仍有 ' + n + ' 个方案符合证据。' + (left === 1 ? ' 次数已用完，可撤销重试。' : ''));
  }
  function confirm() {
    if (locked || !canConfirm || state.pick === null || !fullyMatches(puzzle, table, state.pick)) return;
    setState({ ...state, solved: true });
    suggest(null);
  }
  const visibleTrace = traceInput !== null && state.probes.includes(traceInput) ? execute(puzzle, traceInput).trace : null;
  return <div className="puzzle-layout detective" data-dd-id={puzzle.id} data-dd-input={INPUTS[state.input]}
    data-dd-probes={state.probes.length} data-dd-possible={possible.length} data-dd-left={left}
    data-dd-pick={state.pick ?? ''} data-dd-won={state.solved} data-dd-hint={suggested === null ? '' : INPUTS[suggested]}>
    <section className="dd-panel" aria-label="调试侦探主面板">
      <header className="dd-head">
        <div><small>灯光实验室 · 案件 {String(level + 1).padStart(2, '0')}</small><h3>{puzzle.title}</h3></div>
        <div className="dd-substatus"><strong>剩余 {left} 次测试</strong><span>{possible.length} 个可能方案</span></div>
      </header>
      <div className="dd-probe" aria-label="输入控制台">
        <div className="dd-switches" role="group" aria-label="A、B、C 输入开关">
          {REGISTER.map((name, i) => {
            const bit = INPUTS[state.input][i] === '1';
            return <button key={name} type="button" data-dd-switch={i} aria-label={name + ' 开关'} aria-pressed={bit}
              disabled={locked} onClick={() => flip(i)}>
              <span>{name}</span><b>{bit ? '1' : '0'}</b>
            </button>;
          })}
        </div>
        <button type="button" className="dd-run" data-dd-run disabled={locked || repeated || left < 1} onClick={probe}>
          {repeated ? '已测试此输入' : '运行测试'}
        </button>
      </div>
      <p role="status" className="dd-status">{paused ? '已暂停。' : state.solved ? '证据成立！修复通过全部 8 种输入。' : message}</p>
      <div className="dd-program">
        <h4>现有程序 <small>依次执行，输出灯为 {puzzle.outputs.map(x => REGISTER[x]).join(' / ')}</small></h4>
        <ol>
          {puzzle.program.map((row, i) => <li key={i}><code>{expression(row)}</code></li>)}
        </ol>
      </div>
      <section className="dd-evidence" aria-label="测试记录">
        <h4>测试记录 <small>灯：{puzzle.outputs.map(x => REGISTER[x]).join(' / ')}</small></h4>
        {state.probes.length === 0 ? <p className="dd-empty">未测试。期望灯只在记录后显示。</p> :
          <table>
            <thead><tr><th scope="col">输入 ABC</th><th scope="col">期望</th><th scope="col">实际</th><th scope="col">轨迹</th></tr></thead>
            <tbody>{state.probes.map(i => {
              const actual = execute(puzzle, i).lamps;
              return <tr key={i} data-dd-record={INPUTS[i]}>
                <th scope="row"><code>{INPUTS[i]}</code></th>
                <td data-dd-expected={puzzle.expected[i]}><Lamps bits={puzzle.expected[i]} /></td>
                <td data-dd-actual={actual}><Lamps bits={actual} /></td>
                <td><button type="button" aria-label={'查看 ' + INPUTS[i] + ' 的执行轨迹'} aria-expanded={traceInput === i}
                  onClick={() => setTrace(traceInput === i ? null : i)} disabled={paused}>轨迹</button></td>
              </tr>;
            })}</tbody>
          </table>}
        {visibleTrace && <p className="dd-trace" data-dd-trace>ABC 初始值 → 每行执行后：<code>{visibleTrace.join(' → ')}</code></p>}
      </section>
      <section aria-label="修复方案" className="dd-repairs">
        <h4>修复方案 <small>选择一张，可先看它如何通过已记录的测试</small></h4>
        <div className="dd-card-grid">
          {puzzle.candidates.map(([row, op, src], i) => {
            const viable = possible.includes(i);
            return <button key={i} type="button" data-dd-card={i} data-viable={viable} aria-pressed={state.pick === i}
              disabled={locked} onClick={() => setState({ ...state, pick: i })}>
              <span>方案 {i + 1} · 第 {row + 1} 行</span>
              <code>{expression([puzzle.program[row][0], op, src])}</code>
              <small>{!state.probes.length ? '待取证' : viable ? '符合记录' : '与记录冲突'}</small>
            </button>;
          })}
        </div>
        {state.pick !== null && <div className="dd-preview" data-dd-preview>
          <strong>方案 {state.pick + 1} 的预测</strong>
          {state.probes.length === 0 ? <p>先记录一组输入，才能预览这项修复。</p> : <ul>
            {state.probes.map(i => {
              const bits = table[state.pick!][i];
              return <li key={i}><code>{INPUTS[i]}</code> <Lamps bits={bits} /> <span>{bits === puzzle.expected[i] ? '符合' : '冲突'}</span></li>;
            })}
          </ul>}
        </div>}
      </section>
      <div className="dd-finish">
        <button type="button" className="dd-confirm" data-dd-confirm onClick={confirm} disabled={locked || !canConfirm}>确认修复</button>
        <small>{state.solved ? '已修复' : '须有证据锁定唯一方案'}</small>
      </div>
      {!saved && <small>浏览器无法保存这局，刷新后可能丢失进度。</small>}
    </section>
    <aside className="game-notes">
      <span className="mini-label">程序推理 · 灯光实验室</span>
      <h3>别猜。找一组能区分它们的输入。</h3>
      <ol>
        <li>拨动 A、B、C，运行测试后对比期望与实际。即使结果相同，也可能排除把正确结果改坏的方案。</li>
        <li>NOT 取反，AND 要两个 1，OR 要至少一个 1，XOR 要两个值不同。箭头把右侧结果写回左侧。</li>
        <li>只剩一个方案时才可确认。撤销能返还一次测试。轨迹、方案预览和提示都不消耗次数。</li>
      </ol>
      <p>鼠标或触控点选；键盘用 Tab 移动焦点、空格切换或确认。</p>
    </aside>
  </div>;
}
