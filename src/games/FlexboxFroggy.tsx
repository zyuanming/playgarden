// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import names from './flexboxFroggyLevels.json';
import './flexboxFroggy.css';

const KEY = 'playgarden.flexbox-froggy.v1.state';
type Saved = { answers: Record<string, string>; solved: string[]; colorblind: 'true' | 'false'; language: string; difficulty: string; ending: boolean; earnedEnding: boolean };
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
  const finalSolved = solved.includes(names[23]);
  // Older saved states only had the current-screen flag. Migrate a genuinely
  // earned final screen once; later lesson visits preserve its separate history.
  const earnedEnding = finalSolved && (data.earnedEnding === true || (data.earnedEnding === undefined && data.ending === true));
  return { answers, solved, colorblind: data.colorblind === 'true' ? 'true' : 'false', language: typeof data.language === 'string' && /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(data.language) ? data.language : 'zh-cn', difficulty: ['easy', 'medium', 'hard'].includes(data.difficulty ?? '') ? data.difficulty! : 'easy', ending: data.ending === true && finalSolved, earnedEnding };
}
function read(): Saved {
  try { const raw = localStorage.getItem(KEY); if (raw) return clean(JSON.parse(raw)); } catch { /* Memory is sufficient when storage is unavailable or corrupt. */ }
  return clean(memory);
}
function persist(state: Saved) {
  memory = clean(state);
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* In-memory fallback does not block play. */ }
}

export default function FlexboxFroggy(props: GameProps) {
  return <FroggyRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function FroggyRound({ level, paused, freshStart, hintToken, undoToken, onComplete, onStatus, onLevelChange }: GameProps) {
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
    const url = new URL('./flexbox-froggy/index.html', document.baseURI);
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
    latest.current.onStatus('写下 CSS，让青蛙落在同色荷叶上。24 课完整保留，点击属性可以查看帮助。');
    const timeout = window.setTimeout(() => { if (alive && !booted) setError('课程还没有加载成功，请点击顶部“重来”。'); }, 15000);
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (!alive && event.source === window && event.origin === location.origin && data?.source === 'playgarden-froggy-drain' && data.token === drainToken) {
        window.removeEventListener('message', receive); finishDrain?.(); return;
      }
      if (event.source !== target || event.origin !== 'null' || data?.source !== 'playgarden-flexbox-froggy' || data.session !== session) return;
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
        if (data.revision !== 'flexbox-froggy-9a6feab-playgarden-1' || data.levelCount !== 24) { setError('课程资源版本不一致，请重新加载。'); return; }
        booted = true; clearTimeout(timeout); setReady(true); setError('');
      } else if (data.type === 'complete' && data.level === latest.current.level && !completed.current && !latest.current.paused) {
        completed.current = true; latest.current.onComplete();
      } else if (data.type === 'navigate' && Number.isInteger(data.level) && data.level >= 0 && data.level < 24) {
        if (latest.current.onLevelChange) latest.current.onLevelChange(data.level);
        else { send('navigation-denied'); latest.current.onStatus('请使用顶部关卡选择继续练习。'); }
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(350, Math.min(2200, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message.slice(0, 300));
      else if (data.type === 'ending') latest.current.onStatus(saved.current.solved.length === 24 ? '24 课全部完成！青蛙们都回到了荷叶上。' : `最后一课完成，已解开 ${saved.current.solved.length} / 24 课。可以继续复习未完成的课程。`);
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
        window.postMessage({ source: 'playgarden-froggy-drain', token: drainToken }, location.origin);
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
  return <section className="froggy-game" data-froggy-ready={ready} data-froggy-phase={snapshot?.phase ?? 'loading'} data-froggy-solved={snapshot?.solved.length ?? 0}>
    <header className="froggy-heading"><div><span>FLEXBOX FROGGY · 原作完整课程</span><h3>写几行 CSS，带青蛙回家</h3></div><b>24 课 · 浏览器真实布局</b></header>
    <p className="froggy-intro">相同颜色的青蛙与荷叶要一一对齐。池塘会按照你写下的 Flexbox 布局改变；不同但有效的写法都能过关。</p>
    <div className="froggy-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="弹性盒子青蛙完整课程" sandbox="allow-scripts" referrerPolicy="same-origin" onLoad={initialize} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <p className="froggy-cover" role="status">正在准备青蛙与荷叶…</p>}
      {error && <p className="froggy-cover" role="alert">{error}</p>}
    </div>
    <details className="froggy-help"><summary>规则、保存与原作署名</summary>
      <p>编辑区只接受池塘或指定青蛙的 Flexbox 声明，包括 justify-content、align-items、flex-direction、order、align-self、flex-wrap、flex-flow 与 align-content。点击课程里的属性名称，再点击帮助中的值，即可填入。Ctrl / Command + Enter 可以检查并继续。</p>
      <p>24 课可自由选择；选择课程不会获得通关。每课都按青蛙和荷叶的真实位置及颜色核验。完成最后一课可观看原作结局；只有 24 课分别完成才算完整课程通关。设置中保留隐藏说明、随机练习与颜色图案辅助。</p>
      <p>草稿、已解课程、已经获得的结局与显示设置会自动保存在此浏览器。大厅会优先打开未完成的课程；重新选择最后一课可以查看已经获得的结局。暂停会冻结动画并取消正在等待的检查或下一关；继续后可以重新检查。重试只清空当前草稿。</p>
      <p>Flexbox Froggy 由 Thomas Park 创作，简体中文翻译 Tim Guo。代码、课程及帮助 MIT；原作青蛙与荷叶图像 CC-BY-3.0，未经修改。Playgarden 宿主与隔离适配 GPL-3.0-only。</p>
      <p><a href="./flexbox-froggy/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./flexbox-froggy/source.zip" download>对应源码与修改说明</a> · <a href="https://github.com/thomaspark/flexboxfroggy/tree/9a6feab850a56cbe9ad90f3afcc95e88335bbec8" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
