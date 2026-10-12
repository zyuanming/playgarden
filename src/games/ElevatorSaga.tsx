// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './elevatorSaga.css';
const KEY = 'playgarden.elevator-saga.v1';
const SPEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55];
// Allow already-posted editor saves to reach the old listener before a keyed
// replacement reads storage. This keeps fast level changes from losing code.
let pendingSaves: Promise<void> = Promise.resolve();
type Saved = { code?: string; completed: number[]; speed: number };
function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY); if (!raw || raw.length > 70000) throw new Error('empty');
    const value = JSON.parse(raw) as Record<string, unknown>;
    return { code: typeof value.code === 'string' && value.code.length <= 64000 ? value.code : undefined,
      completed: Array.isArray(value.completed) ? [...new Set(value.completed.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 18))] : [],
      speed: typeof value.speed === 'number' && SPEEDS.includes(value.speed) ? value.speed : 2 };
  } catch { return { completed: [], speed: 2 }; }
}
export default function ElevatorSaga({ level, freePlay, paused, hintToken, onStatus, onComplete, onLevelChange }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null), session = useRef('');
  const callbacks = useRef({ onStatus, onComplete, onLevelChange }); callbacks.current = { onStatus, onComplete, onLevelChange };
  const flags = useRef({ paused, level, freePlay }); flags.current = { paused, level, freePlay };
  const saved = useRef<Saved>(load()), hint = useRef(hintToken);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [storageOk, setStorageOk] = useState(true);
  const [count, setCount] = useState(saved.current.completed.length);
  useEffect(() => {
    const element = frame.current; if (!element) return;
    const token = crypto.randomUUID(); session.current = token;
    const url = new URL('./elevator-saga/index.html', document.baseURI); url.searchParams.set('session', token);
    let announced = false, disposed = false, retry = 0;
    const target = element.contentWindow;
    const send = (type: string, data: Record<string, unknown> = {}) => target?.postMessage({ source: 'playgarden-host', session: token, type, ...data }, '*');
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(saved.current)); if (!disposed) setStorageOk(true); return true; } catch { if (!disposed) setStorageOk(false); return false; } };
    const receive = (event: MessageEvent) => {
      if (event.origin !== 'null' || event.source !== target || !event.data ||
          event.data.source !== 'playgarden-elevator-saga' || event.data.session !== token) return;
      const d = event.data;
      if (disposed) {
        if (announced && d.type === 'save-code' && typeof d.code === 'string' && d.code.length <= 64000) { saved.current.code = d.code; persist(); }
        return;
      }
      if (d.type === 'ready') {
        if (announced) return;
        if (d.revision !== 'elevator-saga-e0c55bf-worker-1' || d.levels !== 18) { setError('游戏资源版本不一致，请重新进入。'); return; }
        announced = true; clearInterval(retry); setReady(true);
        send('config', { ...saved.current, level: flags.current.freePlay ? 18 : Math.min(17, Math.max(0, flags.current.level)), paused: flags.current.paused });
      } else if (!announced) return;
      else if (d.type === 'status' && typeof d.message === 'string') callbacks.current.onStatus(d.message.slice(0, 1600));
      else if (d.type === 'save-code' && typeof d.code === 'string' && d.code.length <= 64000) { saved.current.code = d.code; send('saved', { ok: persist() }); }
      else if (d.type === 'speed' && SPEEDS.includes(d.speed)) { saved.current.speed = d.speed; persist(); }
      else if (d.type === 'level' && Number.isInteger(d.level) && d.level >= 0 && d.level < 18 && d.level !== flags.current.level) callbacks.current.onLevelChange?.(d.level);
      else if (d.type === 'complete' && Number.isInteger(d.level) && d.level >= 0 && d.level < 18 && d.stats &&
        ['transported', 'elapsed', 'maximumWait', 'moves'].every(k => typeof d.stats[k] === 'number' && Number.isFinite(d.stats[k]) && d.stats[k] >= 0)) {
        if (!saved.current.completed.includes(d.level)) saved.current.completed.push(d.level);
        setCount(saved.current.completed.length); persist();
        if (d.level === flags.current.level && !flags.current.freePlay) callbacks.current.onComplete();
      }
    };
    void pendingSaves.then(() => {
      if (disposed) return;
      saved.current = load(); setCount(saved.current.completed.length);
      window.addEventListener('message', receive);
      element.src = url.href;
      retry = window.setInterval(() => send('hello'), 700);
    });
    callbacks.current.onStatus('写 JavaScript 调度电梯，满足每关原作的运送、等待和时间目标。');
    return () => {
      disposed = true; clearInterval(retry); send('dispose'); element.src = 'about:blank';
      pendingSaves = new Promise(resolve => window.setTimeout(() => { window.removeEventListener('message', receive); resolve(); }, 0));
    };
  }, []);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session: session.current, type: 'pause', paused }, '*');
  }, [paused, ready]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session: session.current, type: 'select-level', level: freePlay ? 18 : Math.min(17, Math.max(0, level)) }, '*');
  }, [level, freePlay, ready]);
  useEffect(() => {
    if (hint.current === hintToken) return; hint.current = hintToken;
    callbacks.current.onStatus('先监听 floor_button_pressed 接送车内乘客，再监听各楼层的呼叫。注意满载比例、上下行指示灯和等待上限；暂停后可以慢慢读代码。');
  }, [hintToken]);
  return <section className="elevator-saga-game" data-elevator-ready={ready}>
    <header><div><small>ELEVATOR SAGA · 原作完整 18 项挑战</small><h3>电梯调度员</h3></div><strong>{count} / 18 已通过</strong></header>
    <p>通过 JavaScript 事件和队列安排电梯。编辑、暂停、停止和改进调度都是玩法的一部分。</p>
    {!storageOk && <p role="alert">浏览器暂不能保存，请在离开前复制代码。</p>}
    {!ready && !error && <p role="status">正在加载本地电梯模拟…</p>}
    {error && <p role="alert">{error}</p>}
    <iframe ref={frame} title="电梯调度员 Elevator Saga 编程挑战" sandbox="allow-scripts" tabIndex={paused ? -1 : 0} aria-hidden={paused} />
    <p className="elevator-saga-credit">Magnus Wolffelt 原作 MIT；本站适配 GPL-3.0-only。自由演示没有有限关卡或通关目标。<a href="./elevator-saga/LICENSES.txt" target="_blank" rel="noreferrer">许可证与完整来源</a></p>
  </section>;
}
