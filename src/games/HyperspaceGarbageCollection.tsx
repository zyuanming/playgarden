// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './hyperspaceGarbageCollection.css';

const KEY = 'playgarden.hyperspace-garbage-collection.v1.state';
type Saved = { completed: number[]; earnedEnding: boolean };
type Snapshot = { level: number; phase: string; paused: boolean; captured: number; required: number };
let memory: Saved | null = null;
function clean(value: unknown): Saved {
  const data = value && typeof value === 'object' ? value as Partial<Saved> : {};
  const completed = [0, 1, 2, 3].filter(level => Array.isArray(data.completed) && data.completed.includes(level));
  return { completed, earnedEnding: data.earnedEnding === true && completed.includes(3) };
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
function save(state: Saved) { memory = clean(state); try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Keep the current session playable. */ } }
export default function HyperspaceGarbageCollection(props: GameProps) {
  return <HyperspaceRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function HyperspaceRound({ level, paused, hintToken, undoToken, onComplete, onStatus, onLevelChange }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ level, paused, onComplete, onStatus, onLevelChange });
  latest.current = { level, paused, onComplete, onStatus, onLevelChange };
  const session = useMemo(() => crypto.randomUUID(), []);
  const epoch = useRef(0), completed = useRef(false), tokens = useRef({ hintToken, undoToken });
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(760), [snapshot, setSnapshot] = useState<Snapshot | null>(null), [saved, setSaved] = useState(read);
  const src = useMemo(() => {
    const url = new URL('./hyperspace-garbage-collection/index.html', document.baseURI);
    url.searchParams.set('session', session); return url.href;
  }, [session]);
  function send(type: string, extra: Record<string, unknown> = {}) {
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type, ...extra }, '*');
  }
  function initialize() { send('init', { level: latest.current.level, paused: latest.current.paused }); }
  useLayoutEffect(() => {
    const setupEpoch = ++epoch.current, target = frame.current?.contentWindow;
    let alive = true, booted = false;
    const timeout = window.setTimeout(() => { if (alive && !booted) setError('清运站还没有加载成功，请点击顶部“重来”。'); }, 20000);
    latest.current.onStatus('原作四关：同类碎屑可以推动，异类会湮灭。点亮收集框，再进入打开的舱门。');
    function receive(event: MessageEvent) {
      const data = event.data;
      if (!alive || event.source !== target || event.origin !== 'null' || data?.source !== 'playgarden-hgc' || data.session !== session) return;
      if (data.type === 'hello') initialize();
      else if (data.type === 'ready') {
        if (data.revision !== 'hgc-f5b93cbb-playgarden-1' || data.levelCount !== 4) { setError('清运站资源版本不一致，请重新加载。'); return; }
        booted = true; clearTimeout(timeout); setReady(true); setError(''); send('pause', { paused: latest.current.paused });
      } else if (data.type === 'snapshot' && data.state?.level === latest.current.level && ['briefing', 'playing', 'won', 'ending'].includes(data.state.phase)) {
        setSnapshot({ level: data.state.level, phase: data.state.phase, paused: !!data.state.paused, captured: Number(data.state.captured) || 0, required: Number(data.state.required) || 0 });
      } else if (data.type === 'complete' && booted && data.level === latest.current.level && !completed.current) {
        completed.current = true;
        const previous = read();
        const next = clean({ completed: [...previous.completed, data.level], earnedEnding: previous.earnedEnding || (data.level === 3 && data.ending === true) });
        save(next); setSaved(next); latest.current.onComplete();
      } else if (data.type === 'navigate' && Number.isInteger(data.level) && data.level >= 0 && data.level < 4) {
        if (latest.current.onLevelChange) latest.current.onLevelChange(data.level);
        else latest.current.onStatus('请用顶部关卡选择继续。');
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.min(1300, Math.max(360, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message.slice(0, 300));
      else if (data.type === 'error') setError(String(data.message).slice(0, 300));
    }
    window.addEventListener('message', receive);
    initialize();
    return () => {
      alive = false; clearTimeout(timeout); window.removeEventListener('message', receive);
      // StrictMode replays effects on the live frame. A replacement setup claims
      // a newer epoch; a real unmount still invalidates every old callback.
      queueMicrotask(() => { if (epoch.current === setupEpoch) target?.postMessage({ source: 'playgarden-host', session, type: 'dispose' }, '*'); });
    };
    // The keyed iframe owns one level and one message session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => { if (ready) send('pause', { paused }); }, [ready, paused, session]);
  useEffect(() => { if (tokens.current.hintToken !== hintToken) { tokens.current.hintToken = hintToken; send('hint'); } }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken !== undoToken) { tokens.current.undoToken = undoToken; latest.current.onStatus('这里是连续物理运动，不能撤回一帧。碎屑会补充；“重试本关”会从原作起点重新开始。'); }
  }, [undoToken]);
  return <section className="hgc-game" data-hgc-ready={ready} data-hgc-phase={snapshot?.phase ?? 'loading'} data-hgc-earned={saved.completed.length}>
    <header className="hgc-heading"><div><span>HYPERSPACE GARBAGE COLLECTION</span><h3>反物质清运站</h3></div><b>原作四关 · 零重力搬运</b></header>
    <p className="hgc-intro">把短暂漂流的碎屑送进同色收集框。借助牵引束，挡住选择性激光，让舱门为你开启。</p>
    <div className="hgc-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="反物质清运站原作四关" sandbox="allow-scripts" referrerPolicy="same-origin" onLoad={initialize} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <p className="hgc-cover" role="status">正在准备清运舱…</p>}
      {error && <p className="hgc-cover" role="alert">{error}</p>}
    </div>
    <details className="hgc-help"><summary>规则、保存与原作署名</summary>
      <p>方向键 / WASD、画布拖动或按住方向按钮都能推进。空格 / 物质按钮切换物质；第一关固定反物质。同类碎屑可以碰撞推动，异类接触会湮灭。激光只销毁同类碎屑，不伤害清运员；切换到同类后可以为碎屑挡住激光。</p>
      <p>牵引束会持续施力。碎屑离开路线、过期或被毁后由发射器补充，不扣生命。每关所有收集框捕获匹配碎屑后，舱门才会开启；亲自进入舱门才记通关。四关可以自由选择，选择不算完成。第四关真正通过后显示原作“the end”结局，结局不额外计关。</p>
      <p>本机只保存真实完成的关卡及已获得结局记录，不保存正在漂流的物理世界。重来和重新进入都会从所选关卡的原作起点开始；已获得的完成记录保留。暂停或活动关卡失焦会冻结物理和所有游戏计时；回到画布或点击继续恢复。</p>
      <p>原作 razh，固定版本 f5b93cbb（2013）。原程序、四关地图及程序化绘图 MIT；Box2dWeb zlib，RequireJS MIT。本站隔离宿主、生命周期修复及原创封面 GPL-3.0-only。音频省略，使用系统字体。</p>
      <p><a href="./hyperspace-garbage-collection/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./hyperspace-garbage-collection/source.zip" download>完整对应源码与修改说明</a> · <a href="https://github.com/razh/game-off-2013/tree/f5b93cbb57f653be4455f9dd5c130463b11abe2a" target="_blank" rel="noreferrer">固定版本原作</a></p>
    </details>
  </section>;
}
