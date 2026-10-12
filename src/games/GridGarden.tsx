// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import names from './gridGardenLevels.json';
import './gridGarden.css';

const KEY = 'playgarden.grid-garden.v1.state';
type Saved = { level: number; answers: Record<string, string>; solved: string[]; language: string; ending: boolean; earnedEnding: boolean };
type Snapshot = Saved & { level: number; phase: string; paused: boolean; correct: boolean };
let memory: Saved | null = null;
// A keyed round can unmount while its last input snapshots are still queued.
// Its replacement waits for that posted-message queue to drain before booting.
let pendingSaves: Promise<void> = Promise.resolve();
function clean(value: unknown): Saved {
  const data = value && typeof value === 'object' ? value as Partial<Saved> : {};
  const answers: Record<string, string> = {};
  for (const name of names) if (typeof data.answers?.[name] === 'string') answers[name] = data.answers[name].slice(0, 4096);
  const solved = names.filter(name => Array.isArray(data.solved) && data.solved.includes(name));
  const allSolved = solved.length === names.length;
  const earnedEnding = allSolved && data.earnedEnding === true;
  return { level: Number.isInteger(data.level) && data.level! >= 0 && data.level! < names.length ? data.level! : 0,
    answers, solved, language: typeof data.language === 'string' && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(data.language) ? data.language : 'zh-cn',
    ending: data.ending === true && earnedEnding, earnedEnding };

}
function read(): Saved {
  try { const raw = localStorage.getItem(KEY); if (raw && raw.length <= 150000) return clean(JSON.parse(raw)); } catch { /* Memory is sufficient when storage is unavailable or corrupt. */ }
  return clean(memory);
}
function persist(state: Saved) {
  memory = clean(state);
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* In-memory fallback does not block play. */ }
}

export default function GridGarden(props: GameProps) {
  const level = Number.isInteger(props.level) && props.level >= 0 && props.level < names.length ? props.level : 0;
  return <GardenRound key={`${level}:${props.resetToken}`} {...props} level={level} />;
}
function GardenRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus, onLevelChange }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ level, paused, freshStart, onComplete, onStatus, onLevelChange });
  latest.current = { level, paused, freshStart, onComplete, onStatus, onLevelChange };
  const session = useMemo(() => crypto.randomUUID(), []);
  const saved = useRef(read());
  const tokens = useRef({ hintToken, undoToken });
  const completed = useRef(false);
  const effectEpoch = useRef(0);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(850), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL('./grid-garden/index.html', document.baseURI);
    url.searchParams.set('session', session);
    return url.href;
  }, [session]);
  function send(type: string, extra: Record<string, unknown> = {}) {
    // An allow-scripts-only sandbox intentionally has an opaque origin.
    // The receiver verifies the real parent origin, source window and session.
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type, ...extra }, '*');
  }
  function initialize() {
    const target = frame.current?.contentWindow;
    void pendingSaves.then(() => {
      if (!target || frame.current?.contentWindow !== target) return;
      // Read at the handshake, after the previous round's input messages, not
      // during a concurrent React render that may precede their delivery.
      const state = read();
      send('init', { level: latest.current.level, state, paused: latest.current.paused, freshStart: !!latest.current.freshStart });
    });
  }
  useLayoutEffect(() => {
    const epoch = ++effectEpoch.current;
    const target = frame.current?.contentWindow;
    let alive = true, booted = false;
    const drainToken = crypto.randomUUID();
    let finishDrain: (() => void) | undefined;
    latest.current.onStatus('写下 CSS Grid，为胡萝卜浇水、给杂草除草。28 课完整保留，点击属性可查看帮助。');
    const timeout = window.setTimeout(() => { if (alive && !booted) setError('课程还没有加载成功，请点击顶部“重来”。'); }, 15000);
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (!alive && event.source === window && event.origin === location.origin && data?.source === 'playgarden-grid-garden-drain' && data.token === drainToken) {
        window.removeEventListener('message', receive); finishDrain?.(); return;
      }
      if (event.source !== target || event.origin !== 'null' || data?.source !== 'playgarden-grid-garden' || data.session !== session) return;
      if (data.type === 'snapshot' && data.state?.level === latest.current.level) {
        const next = clean(data.state);
        saved.current = next; persist(next);
        if (alive) setSnapshot({ ...next, level: data.state.level, phase: ['playing', 'navigating', 'ending'].includes(data.state.phase) ? data.state.phase : 'playing', paused: !!data.state.paused, correct: !!data.state.correct });
        return;
      }
      // A removed round may finish saving already-posted drafts, but must never
      // award completion, navigate, or change the new round's visible status.
      if (!alive) return;
      if (data.type === 'hello') initialize();
      else if (data.type === 'ready') {
        if (data.revision !== 'grid-garden-0e262f7-playgarden-1' || data.levelCount !== 28) { setError('课程资源版本不一致，请重新加载。'); return; }
        booted = true; clearTimeout(timeout); setReady(true); setError('');
      } else if (data.type === 'complete' && data.level === latest.current.level && !completed.current && !latest.current.paused) {
        completed.current = true; latest.current.onComplete();
      } else if (data.type === 'navigate' && Number.isInteger(data.level) && data.level >= 0 && data.level < 28) {
        if (latest.current.onLevelChange) latest.current.onLevelChange(data.level);
        else { send('navigation-denied'); latest.current.onStatus('请使用顶部关卡选择继续练习。'); }
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(350, Math.min(2200, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message.slice(0, 300));
      else if (data.type === 'ending' && saved.current.solved.length === 28) latest.current.onStatus('28 课全部完成！网格花园完整课程已通关。');
    };
    window.addEventListener('message', receive);
    return () => {
      alive = false; clearTimeout(timeout);
      // Layout cleanup installs the gate during the removal commit, before a
      // replacement iframe can fire load/hello and request initialization.
      const drained = new Promise<void>(resolve => { finishDrain = resolve; });
      pendingSaves = Promise.all([pendingSaves, drained]).then(() => undefined);
      // React development StrictMode replays effects without removing the
      // iframe. Dispose only if another setup did not reclaim this session.
      queueMicrotask(() => {
        if (effectEpoch.current !== epoch) {
          window.removeEventListener('message', receive); finishDrain?.(); return;
        }
        target?.postMessage({ source: 'playgarden-host', session, type: 'dispose' }, '*');
        // The iframe has been removed. This marker uses the same posted-message
        // task source as its already-sent snapshots, so it runs after them.
        // It also bounds listener cleanup without a timing-dependent sleep.
        window.postMessage({ source: 'playgarden-grid-garden-drain', token: drainToken }, location.origin);
      });
    };
    // Mount owns the session; current callbacks and level come from latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => { if (ready) send('pause', { paused }); }, [ready, paused, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken; send('hint');
  }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    latest.current.onStatus('编辑区支持系统文字撤销；“重试本关”会清空当前草稿，已经完成的课程会保留。');
  }, [undoToken]);
  return <section className="grid-garden-game" data-grid-garden-ready={ready} data-grid-garden-phase={snapshot?.phase ?? 'loading'} data-grid-garden-solved={snapshot?.solved.length ?? 0}>
    <header className="grid-garden-heading"><div><span>GRID GARDEN · 原作完整课程</span><h3>写几行 CSS Grid，照料网格花园</h3></div><b>28 课 · 浏览器真实布局</b></header>
    <p className="grid-garden-intro">让蓝色水域覆盖胡萝卜、紫色除草区域覆盖杂草。用二维网格线、跨度、区域与轨道控制布局；不同但有效的写法都能过关。</p>
    <div className="grid-garden-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="网格花园完整课程" sandbox="allow-scripts" referrerPolicy="same-origin" onLoad={initialize} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <p className="grid-garden-cover" role="status">正在准备花园与网格…</p>}
      {error && <p className="grid-garden-cover" role="alert">{error}</p>}
    </div>
    <details className="grid-garden-help"><summary>规则、保存与原作署名</summary>
      <p>编辑区接受 grid-column、grid-row、grid-area、order、grid-template-columns、grid-template-rows、grid-template 及起止线声明。点击课程里的属性名称可查看中文帮助。Ctrl / Command + Enter 可以检查并继续。</p>
      <p>28 课可自由选择；选择课程不会获得通关。每课都按植物和水域或除草区域的真实位置、尺寸及类型核验。只有 28 课分别完成后，才能观看原作收获结局并获得完整课程通关。</p>
      <p>草稿、已解课程与结局自动保存在此浏览器。暂停会冻结动画，保留输入检查、渐隐与下一关的剩余时间；继续后从暂停处接着运行。重试只清空当前草稿。顶部按钮可以返回大厅。</p>
      <p>Grid Garden 由 Thomas Park 创作，简体中文翻译 Jin。代码、课程及帮助 MIT；原作胡萝卜、杂草与花园图像 CC-BY-3.0，未经修改。Playgarden 宿主与隔离适配 GPL-3.0-only。</p>
      <p><a href="./grid-garden/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./grid-garden/source.zip" download>对应源码与修改说明</a> · <a href="https://github.com/thomaspark/gridgarden/tree/0e262f7272d4992340eb556bdb9b2d502cc59932" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
