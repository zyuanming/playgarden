// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './monkeyRallyOriginal.css';

type Snapshot = { scene: string; phase: string; level: number; paused: boolean };
export default function MonkeyRallyOriginal(props: GameProps) {
  return <MonkeyRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function MonkeyRound({ level, paused, hintToken, undoToken, onComplete, onStatus, onLevelChange }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ level, paused, onComplete, onStatus, onLevelChange });
  latest.current = { level, paused, onComplete, onStatus, onLevelChange };
  const tokens = useRef({ hintToken, undoToken });
  const awarded = useRef(false);
  const effectEpoch = useRef(0);
  const session = useMemo(() => crypto.randomUUID(), []);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(650), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL('./monkey-rally/index.html', document.baseURI);
    url.searchParams.set('session', session); url.searchParams.set('level', String(level + 1));
    return url.href;
  }, [session, level]);
  useEffect(() => {
    const epoch = ++effectEpoch.current;
    const target = frame.current?.contentWindow;
    const send = (type: string, extra: Record<string, unknown> = {}) => target?.postMessage({ source: 'playgarden-host', session, type, ...extra }, location.origin);
    latest.current.onStatus('原作八关：先编排整段路线，猴子会沿每条指令一直滑到墙或停靠垫。');
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== target || event.data?.source !== 'playgarden-monkey-rally' || event.data.session !== session) return;
      const data = event.data;
      if (data.type === 'ready') {
        if (data.revision !== 'monkey-rally-79abaad3-playgarden-1' || data.levelCount !== 8) { setError('资源版本不匹配，请重来。'); return; }
        setReady(true); send('pause', { paused: latest.current.paused });
      } else if (data.type === 'snapshot' && data.state && typeof data.state.scene === 'string') setSnapshot(data.state);
      else if (data.type === 'navigate' && Number.isInteger(data.level) && data.level >= 1 && data.level <= 8) {
        if (latest.current.onLevelChange) latest.current.onLevelChange(data.level - 1);
        else setError('请使用顶部关卡选择切换关卡。');
      } else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(350, Math.min(1500, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message);
      else if (data.type === 'complete' && data.level === latest.current.level + 1 && !awarded.current) {
        awarded.current = true; latest.current.onComplete();
      } else if (data.type === 'error') setError(String(data.message));
    };
    window.addEventListener('message', receive);
    // A cached document may have completed before this passive listener existed.
    send('host-ready', { paused: latest.current.paused });
    return () => {
      window.removeEventListener('message', receive);
      // StrictMode replays setup/cleanup on the same live iframe. Its next setup
      // claims a newer epoch before this microtask; actual unmount still disposes.
      queueMicrotask(() => { if (effectEpoch.current === epoch) send('dispose'); });
    };
  }, [session]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'pause', paused }, location.origin);
  }, [ready, paused, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'hint' }, location.origin);
  }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    latest.current.onStatus('编排时点击一条指令即可删除；执行后用“停止并复位”保留序列，再编辑重试。');
  }, [undoToken]);
  return <section className="monkey-game" data-monkey-ready={ready} data-monkey-phase={snapshot?.phase ?? 'loading'}>
    <header className="monkey-heading"><div><span>MONKEY RALLY · 猴子救援</span><h3>一只猴子，一整段路线</h3></div><b>原作八关 · 十幅故事 · 完整结局</b></header>
    <p>实验室失火，只有一只猴子留下。排好方向指令，利用停靠垫和能反复切换的彩色门，救出科学家。</p>
    <div className="monkey-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="猴子救援原作八关" tabIndex={paused ? -1 : 0} aria-hidden={paused}
        onLoad={() => frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'host-ready', paused: latest.current.paused }, location.origin)} />
      {!ready && !error && <p className="monkey-cover" role="status">正在准备原作实验室…</p>}
      {paused && <p className="monkey-cover">已暂停，当前滑行动画和指令进度已冻结。</p>}
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="monkey-help"><summary>规则、原作与许可</summary>
      <p>方向会连续滑行，撞墙才换下一条；一开始被挡住的指令也会消耗。停靠垫立即结束当前滑行，洞会让本次尝试失败。踩到红、绿、黄开关会反转地图上所有同色门，再踩一次会关回去。</p>
      <p>执行期间不能临时转向。停止会复位猴子和所有门，保留编排好的序列；重置同时清空序列。八关始终可以直接选择，只有真正抵达科学家才记为完成。第八关救援成功后展示原作结局。</p>
      <p>代码 Anders Antila；美术 Erik Nahkala、Laura Kantti。原作代码、关卡与插图 CC-BY-4.0，本站适配 GPL-3.0-only。保留 Phaser 1.1.3／Pixi 引擎；原作音乐与第三方位图字体因授权范围而省略。</p>
      <p><a href="./monkey-rally/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./monkey-rally/source.zip" download>对应源码与修改说明</a></p>
    </details>
  </section>;
}
