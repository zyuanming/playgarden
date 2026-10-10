// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import './healEmAllOriginal.css';

type Snapshot = { phase: string; paused: boolean; level: number; lives: number; ammo: number; availableLevel: number };
type HealProps = GameProps & { onLevelChange?: (levelIndex: number) => void };
export default function HealEmAllOriginal(props: HealProps) {
  return <HealRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function HealRound({ level, paused, hintToken, undoToken, onComplete, onStatus, onLevelChange }: HealProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ paused, onComplete, onStatus, onLevelChange, level });
  const tokens = useRef({ hintToken, undoToken });
  const effectEpoch = useRef(0);
  latest.current = { paused, onComplete, onStatus, onLevelChange, level };
  const session = useMemo(() => crypto.randomUUID(), []);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [height, setHeight] = useState(600), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL('./heal-em-all/index.html', document.baseURI);
    url.searchParams.set('session', session); url.searchParams.set('level', String(level + 1));
    return url.href;
  }, [session, level]);
  useEffect(() => {
    const epoch = ++effectEpoch.current;
    const target = frame.current?.contentWindow;
    const send = (type: string, extra: Record<string, unknown> = {}) => target?.postMessage({ source: 'playgarden-host', session, type, ...extra }, location.origin);
    latest.current.onStatus('六关救援：找到钥匙，开门后按跳跃进入出口。治疗人数决定星级。');
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== target || event.data?.source !== 'playgarden-heal-em-all' || event.data.session !== session) return;
      const data = event.data;
      if (data.type === 'ready') {
        if (data.revision !== 'heal-em-all-66950cda-playgarden-1' || data.levelCount !== 6) { setError('资源版本不匹配，请重来。'); return; }
        setReady(true); send('pause', { paused: latest.current.paused });
      } else if (data.type === 'snapshot' && data.state && typeof data.state.phase === 'string') setSnapshot(data.state);
      else if (data.type === 'navigate' && Number.isInteger(data.level) && data.level >= 1 && data.level <= 6) {
        if (latest.current.onLevelChange) latest.current.onLevelChange(data.level - 1);
        else setError('关卡导航暂不可用，请使用顶部关卡选择。');
      }
      else if (data.type === 'height' && Number.isFinite(data.height)) setHeight(Math.max(340, Math.min(1100, data.height)));
      else if (data.type === 'status' && typeof data.message === 'string') latest.current.onStatus(data.message);
      else if (data.type === 'complete' && Number.isInteger(data.level) && data.level >= 1 && data.level <= 6) {
        latest.current.onStatus(`第 ${data.level} 关已抵达出口，获得 ${data.stars} 颗星。${data.level === 6 ? '继续查看完整旅程结局。' : '可以进入下一关。'}`);
        if (data.level === latest.current.level + 1) latest.current.onComplete();
      } else if (data.type === 'error') setError(String(data.message));
    };
    window.addEventListener('message', receive);
    // Recover a ready notification emitted before this passive listener existed.
    send('host-ready', { paused: latest.current.paused });
    return () => {
      window.removeEventListener('message', receive);
      // React StrictMode replays effects on the same mounted iframe. A newer
      // setup claims the next epoch before this task; real unmount still cleans up.
      queueMicrotask(() => { if (effectEpoch.current === epoch) send('dispose'); });
    };
  }, [session]);
  useEffect(() => {
    // Pause changes during asset loading must precede the first stage frame.
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'pause', paused }, location.origin);
  }, [ready, paused, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    latest.current.onStatus('拿钥匙、接触门，再按跳跃进入。感染形态可跳出地图恢复人类；救下更多人获得更多星。');
    frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'hint' }, location.origin);
  }, [hintToken, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    latest.current.onStatus('实时平台冒险没有逐步撤销；可暂停或重试当前关卡。已解锁关卡与最佳星数保留。');
  }, [undoToken]);
  return <section className="heal-game" data-heal-ready={ready} data-heal-phase={snapshot?.phase ?? 'loading'}>
    <header className="heal-heading"><div><span>HEAL’EM ALL · 治愈所有人</span><h3>带着解药，穿过最后一扇门</h3></div><b>原作六关 · 完整结局</b></header>
    <p className="heal-intro">左右移动，跳上平台，找到钥匙与出口。有限的治愈弹能让感染者恢复健康；小心他们再次被感染。</p>
    <div className="heal-frame-wrap" style={{ height }}>
      <iframe ref={frame} src={src} title="治愈所有人完整六关" tabIndex={paused ? -1 : 0} aria-hidden={paused}
        onLoad={() => frame.current?.contentWindow?.postMessage({ source: 'playgarden-host', session, type: 'host-ready', paused: latest.current.paused }, location.origin)} />
      {!ready && !error && <p className="heal-cover" role="status">正在准备六关旅程…</p>}
      {paused && <p className="heal-cover">已暂停，生命、敌人与计时都已冻结。</p>}
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="heal-help"><summary>规则、进度与原作说明</summary>
      <p>方向键或下方按钮移动；向上／X 跳跃并进入已开的出口；空格／Z 发射治愈弹；P 暂停。碰到门会消耗钥匙开门，再按跳跃才会离开。子弹每半秒发射一次，遇到障碍会消失。</p>
      <p>每关从三条生命开始。第一次失去全部生命会变成速度较慢的感染形态，此时跳出地图可恢复人类形态和三条生命；恢复后再次失去全部生命会失败。心心补充生命，重试可重新挑战。</p>
      <p>被治愈的人有四秒免疫期，之后可能再次感染；普通感染者造成的二次感染再被治愈会留下墓碑。出口时仍然健康的人决定星级：不超过一半为一星，超过一半为二星，至少九成为三星。每关会保存最佳星数与解锁进度，途中位置不保存。</p>
      <p>六张原作地图完整保留，后续地图逐步扩大到 100 × 46 格。原作者：Krzysztof Urbas、Paweł Madeja。代码及本站改编 GPL-3.0-only；美术由 Paweł Madeja 创作，CC-BY-4.0；Quintus 与内嵌工具 MIT。原作音频因授权未明确而省略。</p>
      <p><a href="./heal-em-all/NOTICE.txt" target="_blank" rel="noreferrer">完整署名与许可</a> · <a href="./heal-em-all/source.zip" download>对应源码与修改说明</a></p>
    </details>
  </section>;
}
