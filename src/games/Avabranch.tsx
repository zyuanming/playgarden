// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './avabranch.css';

const KEY = 'playgarden.avabranch.v1.records';
const DEFAULT_KEYS = [['A', 'S'], ['D', 'F'], ['J', 'K'], ['L', ';']];
type Saved = { best: number; keyMaps: string[][] };
type Snapshot = { phase: 'welcome' | 'playing' | 'lost'; paused: boolean; score: number; best: number; branch: number; lives: number };
let memory: Saved | null = null;
let pendingSaves: Promise<void> = Promise.resolve();
function clean(value: unknown): Saved {
  const data = value && typeof value === 'object' ? value as Partial<Saved> : {};
  const keys = data.keyMaps;
  const valid = Array.isArray(keys) && keys.length === 4 && keys.every(row => Array.isArray(row) && row.length === 2 && row.every(key => typeof key === 'string' && /^[A-OQ-Z0-9;]$/.test(key))) && new Set(keys.flat()).size === 8;
  return { best: Number.isSafeInteger(data.best) && data.best! >= 0 ? data.best! : 0, keyMaps: (valid ? keys! : DEFAULT_KEYS).map(row => row.slice()) };
}
function read(): Saved {
  // Once accepted in this page, memory is authoritative. A failed disk write
  // must not make a later round read an older score, mapping, or earned record.
  if (memory !== null) return clean(memory);
  try {
    const raw = localStorage.getItem(KEY);
    memory = clean(raw ? JSON.parse(raw) : null);
  } catch { memory = clean(null); }
  return clean(memory);
}
function persist(value: unknown) {
  const next = clean(value);
  // A late message can never lower an already earned best score.
  next.best = Math.max(next.best, read().best, memory?.best ?? 0);
  memory = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Memory fallback for this page session. */ }
}
export default function Avabranch(props: GameProps) { return <AvabranchRound key={props.resetToken} {...props} />; }
function AvabranchRound({ paused, hintToken, undoToken, onStatus }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ paused, onStatus });
  latest.current = { paused, onStatus };
  const session = useMemo(() => crypto.randomUUID(), []);
  const epochRef = useRef(0);
  const tokens = useRef({ hintToken, undoToken });
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(900), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL('./avabranch/index.html', document.baseURI);
    url.searchParams.set('session', session);
    return url.href;
  }, [session]);
  function send(type: string, extra: Record<string, unknown> = {}) {
    // Opaque allow-scripts sandbox: origin 'null' is checked on the return path,
    // together with this exact iframe WindowProxy and unguessable session id.
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type, ...extra }, '*');
  }
  function initialize() {
    const target = frame.current?.contentWindow;
    void pendingSaves.then(() => {
      if (!target || frame.current?.contentWindow !== target) return;
      send('init', { state: read(), paused: latest.current.paused });
    });
  }
  useLayoutEffect(() => {
    const epoch = ++epochRef.current;
    const target = frame.current?.contentWindow;
    const drainToken = crypto.randomUUID();
    let alive = true, booted = false;
    let finishDrain: (() => void) | undefined;
    latest.current.onStatus('红、黄两线起步；合流躲避黑块，分流独立操作可得四倍分数。完整无尽挑战，不计有限关卡。');
    const timeout = window.setTimeout(() => { if (alive && !booted) setError('游戏还没有加载成功，请点击上方“重来”。'); }, 15000);
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (!alive && event.source === window && event.origin === location.origin && data?.source === 'playgarden-avabranch-drain' && data.token === drainToken) {
        window.removeEventListener('message', receive); finishDrain?.(); return;
      }
      if (event.source !== target || event.origin !== 'null' || data?.source !== 'playgarden-avabranch' || data.session !== session) return;
      if (data.type === 'save') { persist(data.state); return; }
      // Removed rounds may drain a final record, but cannot change current UI.
      if (!alive) return;
      if (data.type === 'hello') initialize();
      else if (data.type === 'ready') {
        if (data.revision !== 'avabranch-4ab326b-playgarden-1' || data.endless !== true || data.levelCount !== 0) { setError('游戏资源版本不一致，请重来。'); return; }
        booted = true; clearTimeout(timeout); setReady(true); setError('');
        send('pause', { paused: latest.current.paused });
      } else if (data.type === 'snapshot') {
        const state = data.state;
        if (!state || !['welcome', 'playing', 'lost'].includes(state.phase) || !Number.isSafeInteger(state.score) || state.score < 0 || !Number.isSafeInteger(state.best) || state.best < 0) return;
        setSnapshot({ phase: state.phase, paused: state.paused === true, score: state.score, best: state.best, branch: state.branch === 1 ? 1 : 0, lives: Number.isInteger(state.lives) ? Math.max(0, Math.min(4, state.lives)) : 0 });
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(400, Math.min(1800, Math.ceil(data.height))));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message.slice(0, 300));
    };
    window.addEventListener('message', receive);
    return () => {
      alive = false; clearTimeout(timeout);
      const drained = new Promise<void>(resolve => { finishDrain = resolve; });
      pendingSaves = Promise.all([pendingSaves, drained]).then(() => undefined);
      queueMicrotask(() => {
        // StrictMode setup may reclaim the same live iframe before this runs.
        if (epochRef.current !== epoch) { window.removeEventListener('message', receive); finishDrain?.(); return; }
        target?.postMessage({ source: 'playgarden-host', session, type: 'dispose' }, '*');
        // Message-source FIFO drains already-posted final score/key updates before
        // a replacement iframe is initialized from storage.
        window.postMessage({ source: 'playgarden-avabranch-drain', token: drainToken }, location.origin);
      });
    };
    // The keyed iframe owns this session; callbacks are taken from latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => { if (ready) send('pause', { paused }); }, [ready, paused, session]);
  useEffect(() => { if (tokens.current.hintToken !== hintToken) { tokens.current.hintToken = hintToken; send('hint'); } }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    latest.current.onStatus('四线分流是实时生存挑战，没有逐步撤销；可以暂停，或点“重来”返回开始页。');
  }, [undoToken]);
  return <section className="avabranch-game" data-avabranch-game data-avabranch-ready={ready} data-avabranch-phase={snapshot?.phase ?? 'loading'}>
    <header className="avabranch-heading"><div><span>AVABRANCH · 原作完整改编</span><h3>一队前进，四线分流</h3></div><b>无尽挑战</b></header>
    <p className="avabranch-intro">在黑色障碍间穿行，保护四种颜色的生命。合流时共同转向，分流后分别操控，换取更高分数。</p>
    <div className={`avabranch-frame-wrap${paused ? ' avabranch-host-paused' : ''}`} style={{ height }}>
      <iframe ref={frame} src={src} title="Avabranch 四线分流原作" sandbox="allow-scripts" referrerPolicy="same-origin" onLoad={initialize} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <p className="avabranch-cover" role="status">正在准备四条彩线…</p>}
      {error && <p className="avabranch-cover" role="alert">{error}</p>}
    </div>
    {paused && <p className="avabranch-paused" role="status">已暂停。点击上方“继续游戏”恢复，所有游戏时钟同时冻结。</p>}
    <details className="avabranch-help"><summary>规则、键位与开源说明</summary>
      <p>初始红、黄两线存活，绿、蓝等待复活。黑块与左右边缘会消耗碰到它们的彩线；彩线彼此可以交叉。四条线全部耗尽后结束，可立即再来一局。</p>
      <p>合流：A / F 控制全队。空格切换分流后，红 A / S、黄 D / F、绿 J / K、蓝 L / ; 分别左右移动。触屏可按住多行的方向键同时操控，点击“合流 / 分流”切换。P 或 Escape 暂停，Enter 开始或重新挑战。</p>
      <p>每 10 秒提高难度并生成一颗随机彩色光球。光球优先复活同色彩线；若同色已存活，蓝色减速、绿色加速、红色增粗、黄色变细，持续 10 秒。得分随存活线数增长，分流乘以 4，并保留原作逐帧向上取整。</p>
      <p>最高分及自定义分流键位保存在当前浏览器。暂停、切换标签和失焦都会释放按键；返回后点击游戏内“继续挑战”。上方“重来”回到开始页，保留最高分。原作难度递增属于无尽进程，不是有限关卡，也没有战役通关。</p>
      <p>Avabranch 由 Zolmeister 创作，原始代码与程序化图形为 MIT。保留原作 Canvas、四线生命、合流动画、碰撞、彩色道具及计分；Playgarden 中文界面、隔离宿主、触控适配与卡片为 GPL-3.0-only。未使用未清权音乐、远程字体、装饰图片或第三方引擎。</p>
      <p><a href="./avabranch/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./avabranch/source.zip" download>对应源码与修改说明</a> · <a href="https://github.com/Zolmeister/avabranch/tree/4ab326b4a24d796328963da35c0d8d193d728496" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
