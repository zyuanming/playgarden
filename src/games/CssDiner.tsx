// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './cssDiner.css';

const KEY = 'playgarden.css-diner.v1.state';
const REVISION = 'css-diner-566aaa0-playgarden-2';
type Guess = { correct: boolean; incorrectCount: number };
type Saved = { drafts: Record<string, string>; guessHistory: Record<string, Guess>; currentLevel: number; earnedEnding: boolean; finalEnding: boolean; ending: boolean };
type Snapshot = Saved & { phase: string; paused: boolean; solvedCount: number };
let memory: Saved | null = null;
function clean(value: unknown): Saved {
  const data = value && typeof value === 'object' ? value as Partial<Saved> : {};
  const drafts: Record<string, string> = {}, guessHistory: Record<string, Guess> = {};
  for (let index = 0; index < 32; index++) {
    if (typeof data.drafts?.[index] === 'string') drafts[index] = data.drafts[index].slice(0, 1024);
    const record = data.guessHistory?.[index];
    if (record && typeof record === 'object') guessHistory[index] = { correct: record.correct === true, incorrectCount: Number.isInteger(record.incorrectCount) ? Math.max(0, Math.min(10000, record.incorrectCount)) : 0 };
  }
  const finalSolved = guessHistory[31]?.correct === true;
  const earnedEnding = data.earnedEnding === true && finalSolved;
  const finalEnding = earnedEnding && (data.finalEnding === true || (data.finalEnding === undefined && data.ending === true && data.currentLevel === 31));
  return { drafts, guessHistory, currentLevel: Number.isInteger(data.currentLevel) && data.currentLevel! >= 0 && data.currentLevel! < 32 ? data.currentLevel! : 0,
    earnedEnding, finalEnding, ending: data.ending === true && finalSolved };
}
function read(): Saved {
  try { const raw = localStorage.getItem(KEY); if (raw && raw.length <= 100000) return clean(JSON.parse(raw)); } catch { /* Storage can be denied or malformed. */ }
  return clean(memory);
}
function persist(value: Saved) {
  memory = clean(value);
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* The current session remains playable. */ }
}
const countSolved = (value: Saved) => Object.values(value.guessHistory).filter(item => item.correct).length;

export default function CssDiner(props: GameProps) {
  return <DinerRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function DinerRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus, onLevelChange }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ level, paused, freshStart, onComplete, onStatus, onLevelChange });
  latest.current = { level, paused, freshStart, onComplete, onStatus, onLevelChange };
  const session = useMemo(() => crypto.randomUUID(), []);
  const initial = useRef(read()), saved = useRef(initial.current);
  const active = useRef(false), completed = useRef(false), readyRef = useRef(false), epoch = useRef(0);
  // One bounded mailbox belongs to this keyed iframe session. It survives an
  // effect replay, but never a real unmount, restart or different selected level.
  const pending = useRef({ session, level, complete: false, navigate: null as number | null });
  const navigationSent = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(1200), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL('./css-diner/index.html', document.baseURI);
    url.searchParams.set('session', session); return url.href;
  }, [session]);
  function send(type: string, extra: Record<string, unknown> = {}) {
    if (active.current) frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type, ...extra }, '*');
  }
  function initialize() { send('init', { level: latest.current.level, state: initial.current, paused: latest.current.paused, freshStart: !!latest.current.freshStart }); }
  function flushPending() {
    const work = pending.current;
    if (!active.current || latest.current.paused || work.session !== session || work.level !== latest.current.level) return;
    // An earned completion must reach the old level's callback before a level
    // change can remount the iframe and replace that callback with a new one.
    if (work.complete) {
      work.complete = false;
      if (!completed.current) { completed.current = true; latest.current.onComplete(); }
    }
    if (work.navigate !== null && !navigationSent.current) {
      const destination = work.navigate; work.navigate = null;
      if (latest.current.onLevelChange) { navigationSent.current = true; latest.current.onLevelChange(destination); }
      else { send('navigation-denied'); latest.current.onStatus('请使用顶部关卡选择继续。'); }
    }
  }
  useEffect(() => {
    const currentEpoch = ++epoch.current, target = frame.current?.contentWindow;
    let alive = true, booted = readyRef.current;
    active.current = true;
    latest.current.onStatus('输入 CSS 选择器，准确选中餐桌目标。32 道原作谜题可自由选择；等价写法也能过关。');
    const timeout = window.setTimeout(() => { if (alive && !booted) setError('餐厅还没有加载成功，请点击顶部“重来”。'); }, 15000);
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (!alive || event.source !== target || event.origin !== 'null' || data?.source !== 'playgarden-css-diner' || data.session !== session) return;
      if (data.type === 'hello') initialize();
      else if (data.type === 'ready') {
        if (data.revision !== REVISION || data.levelCount !== 32) { setError('餐厅资源版本不一致，请重新加载。'); return; }
        booted = true; readyRef.current = true; clearTimeout(timeout); setReady(true); setError('');
      } else if (data.type === 'snapshot' && data.state?.currentLevel === latest.current.level) {
        const next = clean(data.state); saved.current = next; persist(next);
        setSnapshot({ ...next, phase: ['loading', 'playing', 'correct', 'incorrect', 'navigating', 'ending'].includes(data.state.phase) ? data.state.phase : 'playing', paused: data.state.paused === true, solvedCount: countSolved(next) });
      } else if (data.type === 'complete' && data.level === latest.current.level && !completed.current) {
        // Same source/session, real checker report and persisted authored-level mark.
        if (saved.current.guessHistory[data.level]?.correct !== true) return;
        pending.current.complete = true; flushPending();
      } else if (data.type === 'navigate' && data.fromLevel === latest.current.level && Number.isInteger(data.level) && data.level >= 0 && data.level < 32 && data.level !== data.fromLevel && !navigationSent.current) {
        pending.current.navigate = data.level; flushPending();
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(450, Math.min(4800, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message.slice(0, 300));
      else if (data.type === 'ending') latest.current.onStatus(countSolved(saved.current) === 32 ? '32 道原作谜题全部完成！' : `最后一关完成，已解开 ${countSolved(saved.current)} / 32 道谜题。`);
    };
    window.addEventListener('message', receive);
    // Both directions acknowledge readiness. This also reclaims a live iframe
    // during React effect replay without restarting it or re-awarding a level.
    initialize();
    flushPending();
    return () => {
      alive = false; active.current = false; clearTimeout(timeout);
      window.removeEventListener('message', receive);
      queueMicrotask(() => {
        if (epoch.current === currentEpoch) {
          pending.current.complete = false; pending.current.navigate = null;
          target?.postMessage({ source: 'playgarden-host', session, type: 'dispose' }, '*');
        }
      });
    };
    // A keyed frame owns one session; live callbacks and flags come from latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => {
    if (ready) { send('pause', { paused }); flushPending(); }
  }, [ready, paused, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken; send('hint');
  }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    latest.current.onStatus('编辑区可以使用系统文字撤销。“重试本关”清空草稿，并保留已获得的完成记录。');
  }, [undoToken]);
  return <section className="diner-game" data-diner-ready={ready} data-diner-phase={snapshot?.phase ?? 'loading'} data-diner-solved={snapshot?.solvedCount ?? 0}>
    <header className="diner-heading"><div><span>CSS DINER · 原作完整谜题</span><h3>用选择器点一道菜</h3></div><b>32 关 · 真实 DOM 匹配</b></header>
    <p className="diner-intro">观察 HTML，输入 CSS 选择器。把全部目标选中，而且不多选；不同但有效的写法都能过关。</p>
    <div className="diner-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="CSS 选择器餐厅完整课程" sandbox="allow-scripts" referrerPolicy="same-origin" onLoad={initialize} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <p className="diner-cover" role="status">正在摆好餐桌…</p>}
      {error && <p className="diner-cover" role="alert">{error}</p>}
    </div>
    <details className="diner-help"><summary>规则、保存与原作署名</summary>
      <p>需要输入 CSS 选择器，按 Enter 或“运行选择器”提交。点击食物或用键盘聚焦 HTML 可以查看标签。金色边框表示目标；桌子较宽时，可左右滑动查看全部菜品。保留类型、ID、类、组合关系、位置伪类、否定和属性匹配的 32 道原作谜题。</p>
      <p>每关均使用原作 jQuery / Sizzle 选择器匹配与完整目标集合核验；输入的选择器不会作为程序执行。可以自由跳关，但跳关不会获得完成记录。最后一关正确后显示原作结局；只有 32 关分别完成才算完整课程通关。</p>
      <p>草稿、尝试和已解记录保存在当前浏览器。暂停会冻结动画及待执行的判错恢复、关卡加载和下一关倒计时；继续后接着运行。重试仅清空本关草稿；最后一关的重试草稿也会正常恢复，已获得结局的记录仍保留。“清空餐厅记录”会确认后清空本作记录，大厅已获历史记录仍保留。存储不可用时可继续本次练习。</p>
      <p>CSS Diner 由 @flukeout 与贡献者创作；原作代码、关卡、说明及 CSS 绘制餐桌与食物为 MPL-2.0，修改后的对应文件和中文说明继续提供 MPL-2.0。jQuery 1.11.0 与 Sizzle 1.10.16 为 MIT。Playgarden 独立宿主与桥接适配为 GPL-3.0-only。按原样提供，不作保证。</p>
      <p><a href="./css-diner/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./css-diner/source.zip" download>对应源码与修改说明</a> · <a href="https://github.com/flukeout/css-diner/tree/566aaa01314caddc7a9034d793250cf2b8f12a4e" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
