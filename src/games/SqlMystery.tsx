// SPDX-License-Identifier: GPL-3.0-only
// Narrative translations below are CC BY-SA-4.0, adapted from NUKnightLab.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './sqlMystery.css';
const VERSION = 'sql-city-a7aa227-sqlite3540000-v1', KEY = 'playgarden.sql-mystery.v1';
const START = "SELECT name FROM sqlite_master WHERE type = 'table';";
type Result = { columns: string[]; rows: (string | null)[][] };
type Saved = { sql: string; notes: string; stage: number; history: string[] };
function load(fresh?: boolean): Saved {
  if (!fresh) try {
    const raw = localStorage.getItem(KEY); if (!raw || raw.length > 320000) throw Error();
    const d = JSON.parse(raw) as Partial<Saved>;
    return { sql: typeof d.sql === 'string' ? d.sql.slice(0, 32000) : START, notes: typeof d.notes === 'string' ? d.notes.slice(0, 6000) : '',
      stage: [0, 1, 2].includes(d.stage ?? -1) ? d.stage! : 0, history: Array.isArray(d.history) ? d.history.filter((x): x is string => typeof x === 'string' && x.length <= 1800).slice(0, 8) : [] };
  } catch { /* Start a clean local notebook if it is unavailable. */ }
  return { sql: START, notes: '', stage: 0, history: [] };
}
const HINTS = [
  '先查crime_scene_report：日期20180115、type为murder、city为SQL City。读到线索后再找证人。',
  '街名和门牌能定位证人。person.id可以连接interview.person_id；LIKE能匹配名字或车牌的一部分。',
  '把健身会员、签到时间和驾照线索放在一起。找到嫌疑人后，用原作INSERT INTO solution语句核验。',
  '抓到行凶者后继续读他的interview。最终委托者的驾照和活动签到记录需要交叉验证。',
];
export default function SqlMystery({ paused, freshStart, hintToken, onStatus, onComplete }: GameProps) {
  const initial = useRef(load(freshStart)), state = useRef(initial.current), worker = useRef<Worker | null>(null), snapshot = useRef<Uint8Array | null>(null);
  const callbacks = useRef({ onStatus, onComplete }); callbacks.current = { onStatus, onComplete };
  const flags = useRef({ paused }); flags.current = { paused };
  const timer = useRef(0), request = useRef(0), current = useRef(0), hint = useRef(hintToken), hintIndex = useRef(0), earned = useRef(initial.current.stage === 2);
  const [sql, setSql] = useState(initial.current.sql), [notes, setNotes] = useState(initial.current.notes), [stage, setStage] = useState(initial.current.stage);
  const [history, setHistory] = useState(initial.current.history), [schema, setSchema] = useState<{name: string; sql: string}[]>([]);
  const [results, setResults] = useState<Result[]>([]), [feedback, setFeedback] = useState(''), [status, setStatus] = useState('正在打开本地案件数据库…');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [storageOk, setStorageOk] = useState(true), [limited, setLimited] = useState(false);
  const persist = useCallback((patch: Partial<Saved>) => {
    state.current = { ...state.current, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(state.current)); setStorageOk(true); } catch { setStorageOk(false); }
  }, []);
  const stop = useCallback(() => {
    clearTimeout(timer.current); timer.current = 0;
    const w = worker.current; worker.current = null;
    if (w) { w.onmessage = null; w.onerror = null; w.terminate(); }
    current.current = 0;
  }, []);
  const boot = useCallback(() => {
    stop(); if (flags.current.paused) return;
    setReady(false); setBusy(false);
    const w = new Worker(new URL('./sql-mystery/worker.js', document.baseURI)); worker.current = w;
    const session = crypto.randomUUID();
    timer.current = window.setTimeout(() => { if (worker.current !== w) return; stop(); setStatus('数据库打开超时，请点重新打开。'); }, 12000);
    w.onerror = () => { if (worker.current !== w) return; stop(); setReady(false); setBusy(false); setStatus('数据库工作器已停止，可以重新打开；笔记仍保留。'); };
    w.onmessage = event => {
      if (worker.current !== w) return;
      const d = event.data;
      if (!d || d.version !== VERSION || d.session !== session) return;
      if (d.type === 'ready') {
        if (!Array.isArray(d.schema) || d.schema.length > 100 || !(d.snapshot instanceof Uint8Array) || d.snapshot.length > 8388608) return;
        clearTimeout(timer.current); snapshot.current = d.snapshot; setSchema(d.schema.filter((x: { name?: unknown; sql?: unknown }) => typeof x.name === 'string' && typeof x.sql === 'string'));
        setReady(true); setStatus('数据库已就绪。写下查询，从案发报告开始。'); return;
      }
      if (d.type === 'error') {
        if (d.id && d.id !== current.current) return;
        clearTimeout(timer.current); setBusy(false); setReady(false); stop(); setStatus('查询未完成：' + String(d.message).slice(0, 800) + ' 可重新打开并继续调查。'); return;
      }
      if (d.type !== 'result' || d.id !== current.current || !Array.isArray(d.results) || d.results.length > 40 || !(d.snapshot instanceof Uint8Array) || d.snapshot.length > 8388608) return;
      if (d.results.some((r: Result) => !Array.isArray(r.columns) || r.columns.length > 40 || !Array.isArray(r.rows) || r.rows.length > 200 || r.columns.some(x => typeof x !== 'string') || r.rows.some(row => !Array.isArray(row) || row.length !== r.columns.length || row.some(x => x !== null && typeof x !== 'string')))) return;
      clearTimeout(timer.current); snapshot.current = d.snapshot; current.current = 0; setBusy(false); setResults(d.results); setLimited(Boolean(d.truncated));
      setFeedback(typeof d.feedback === 'string' ? d.feedback.slice(0, 2000) : '');
      const next = [0, 1, 2].includes(d.stage) ? Math.max(state.current.stage, d.stage) : state.current.stage;
      setStage(next); persist({ stage: next });
      setStatus(d.truncated ? '已显示前200行或达到显示上限，请加WHERE或LIMIT缩小范围。后续语句未执行。' : `查询完成，返回${d.rowCount}行。`);
      callbacks.current.onStatus(next === 2 ? '案件已侦破：原作数据库确认了最终答案。' : next === 1 ? '已找到行凶者。继续查访他的口供，追踪幕后委托者。' : '读线索、连接表格，再用原作核验语句检验推理。');
      if (next === 2 && !earned.current) { earned.current = true; callbacks.current.onComplete(); }
    };
    w.postMessage({ version: VERSION, session, type: 'init', snapshot: snapshot.current, earnedStage: state.current.stage });
    // Keep protocol identity on this closure, not on global window messages.
    Object.assign(w, { querySession: session });
  }, [persist, stop]);
  useEffect(() => { persist({}); boot(); return stop; }, [boot, persist, stop]);
  useEffect(() => {
    if (paused) { stop(); setReady(false); setBusy(false); setStatus('已暂停。未完成的查询已停止，继续后可重新执行。'); }
    else if (!worker.current) boot();
  }, [paused, boot, stop]);
  useEffect(() => { if (hint.current === hintToken) return; hint.current = hintToken; callbacks.current.onStatus(HINTS[hintIndex.current++ % HINTS.length]); }, [hintToken]);
  const edit = (value: string) => { setSql(value); persist({ sql: value }); };
  const run = () => {
    const w = worker.current as (Worker & { querySession?: string }) | null;
    if (!ready || busy || paused || !w || !sql.trim()) return;
    const id = ++request.current; current.current = id; setBusy(true); setStatus('查询中…可以随时停止。');
    const h = [sql.slice(0, 1800), ...state.current.history.filter(x => x !== sql)].slice(0, 8); setHistory(h); persist({ history: h });
    timer.current = window.setTimeout(() => { if (worker.current !== w || current.current !== id) return; stop(); setReady(false); setBusy(false); setStatus('查询超过时间限制，已安全停止。重新打开后可继续，原笔记和上次完整数据库快照保留。'); }, 3500);
    w.postMessage({ version: VERSION, session: w.querySession, type: 'query', id, sql });
  };
  return <section className="sql-mystery" data-sql-ready={ready}>
    <header><div><small>SQL MURDER MYSTERY · 完整原作案件</small><h3>SQL迷案</h3></div><strong>{stage === 2 ? '全案侦破' : stage === 1 ? '追查幕后委托者' : '调查行凶者'}</strong></header>
    <p className="sql-case">SQL City发生了一起虚构案件。你只记得案发日期是2018年1月15日，类型是murder。先在crime_scene_report找回案发报告，再根据证词、住址、车辆和签到记录逐步调查。原始证据保留英文，SQL关键字不需要翻译。</p>
    {stage === 2 && <div className="sql-ending" role="status"><h4>案件告破</h4><p>原作数据库已确认幕后委托者。你可以继续探索查询，或重来复盘完整推理。</p></div>}
    {!storageOk && <p role="alert">浏览器无法保存，请先复制SQL和笔记。</p>}
    <div className="sql-workbench"><div className="sql-main">
      <label htmlFor="sql-editor">调查SQL</label><textarea id="sql-editor" data-testid="sql-editor" spellCheck={false} value={sql} maxLength={32000} disabled={paused} onChange={e => edit(e.target.value)} />
      <div className="sql-actions"><button disabled={!ready || busy || paused} onClick={run}>运行SQL</button><button disabled={!busy || paused} onClick={() => { stop(); setReady(false); setBusy(false); setStatus('查询已停止。点重新打开继续。'); }}>停止查询</button><button disabled={ready || paused} onClick={boot}>重新打开</button></div>
      <p role="status" data-testid="sql-status">{status}</p>
      {limited && <p>结果只显示一部分。限制只影响本次查询显示，不删去原始证据。</p>}
      <div className="sql-results" data-testid="sql-results">{results.map((r, i) => <div key={i} className="sql-result-scroll" tabIndex={0} aria-label={`结果表${i + 1}，可左右滑动`}><table><thead><tr>{r.columns.map((c, j) => <th key={j}>{c}</th>)}</tr></thead><tbody>{r.rows.map((row, j) => <tr key={j}>{row.map((v, k) => <td key={k}>{v === null ? 'NULL' : v}</td>)}</tr>)}</tbody></table>{!r.rows.length && <p>没有匹配的记录。</p>}</div>)}</div>
      {feedback && <aside className="sql-feedback" data-testid="sql-feedback"><h4>原作核验反馈</h4><p>{feedback}</p></aside>}
    </div><aside className="sql-reference">
      <details open><summary>案件表与字段</summary><p>展开表结构，再把示例查询放入编辑器；已运行的SQL可在最近查询中找回。</p>{schema.map(t => <details key={t.name}><summary>{t.name}</summary><pre>{t.sql}</pre><button disabled={paused || busy} onClick={() => edit(`SELECT * FROM "${t.name.replaceAll('"', '""')}" LIMIT 20;`)}>查看{t.name}</button></details>)}</details>
      <details><summary>SQL入门与核验</summary><p>SELECT选择列；FROM选择表；WHERE筛选；LIKE配合%匹配部分文字；JOIN通过ID连接证据；GROUP BY和HAVING统计活动次数。</p><pre>{"SELECT * FROM person WHERE name LIKE 'Ann%';\nSELECT * FROM interview WHERE person_id = 123;"}</pre><p>找到嫌疑人后，把姓名代入原作核验语句。找到行凶者后还有幕后调查。</p><pre>{"INSERT INTO solution VALUES (1, '嫌疑人姓名');\nSELECT value FROM solution;"}</pre><p>这是浏览器内的原作案件数据库。证据表只读；仅允许上面的规范语句核验姓名，通常先查行凶者，再追查幕后委托者；原作也接受直接核验正确的最终答案。离开或刷新会重新载入原案，SQL、笔记、已核验阶段保留。重来会清空本款调查记录。</p></details>
      <label htmlFor="sql-notes">调查笔记</label><textarea id="sql-notes" value={notes} maxLength={6000} disabled={paused} onChange={e => { setNotes(e.target.value); persist({ notes: e.target.value }); }} placeholder="记下证人、线索与下一步问题" />
      <details><summary>最近查询（最多8条）</summary>{history.map((h, i) => <button key={i} disabled={paused || busy} className="sql-history" onClick={() => edit(h)}>{h}</button>)}</details>
    </aside></div>
    <footer>Joon Park、Cathy He / NUKnightLab原作。原始案件与中文叙事译文CC BY-SA4.0；独立宿主GPL-3.0-only。<a href="./sql-mystery/LICENSES.txt" target="_blank" rel="noreferrer">完整许可与来源</a> · <a href="./sql-mystery/case.db" download>原始案件数据库</a></footer>
  </section>;
}
