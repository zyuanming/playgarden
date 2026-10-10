// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import "./crispOriginal.css";
import { crispMakeMaze } from "./crispMakeMaze";
import { crispCountObserve } from "./crispCountObserve";
import { crispCardQ } from "./crispCardQ";
import { crispSecondGames } from "./crispSecondGames";

export type CrispId = "castn" | "bamboo" | "parking" | keyof typeof crispSecondGames | keyof typeof crispCardQ | keyof typeof crispMakeMaze | keyof typeof crispCountObserve;
const games = {
  ...crispSecondGames,
  ...crispCardQ,
  ...crispMakeMaze,
  ...crispCountObserve,
  castn: {
    title: "抛网捕鱼", original: "CAST N", headline: "等鱼入网，再一把收回",
    intro: "按住鼠标、空格或画布蓄力，松开抛网，落入鱼群后再点一下收网。蓝鱼加分，红鱼会让水位猛涨。",
    rule: "网有 20 个会弯曲的节点。一次收网中的蓝鱼按递增倍率得分，红鱼扣 1 分；两种鱼都会推进倍率。蓝鱼降低水位，红鱼升高水位，影响随难度增加。水淹到岸边且不在收网时，本局结束。",
    lesson: "观察网绳形变、出手力度和鱼群位置；比起频繁出手，选对收网时机更重要。", ratio: "1.5",
  },
  bamboo: {
    title: "竹林巧收", original: "BAMBOO", headline: "让每一棵竹子长到刚刚好",
    intro: "小人会自动走动。点一下反向，按住鼠标、空格或画布便会穿过竹子。松开后，碰到成熟黄竹就收割。",
    rule: "竹高 5 至 25 时可收割，收益按成熟度平方增加，最好的成熟区间奖励 100 分。过熟绿竹会让你反弹，并把竹高降为七成、生长速度降为六成。高竹还会逐渐减速，但长到 89 仍然结束。",
    lesson: "安排来回路线，给幼竹一点时间，也别让远处竹子长过头。长按穿行时竹子依然会生长。", ratio: "2",
  },
  parking: {
    title: "同步泊车", original: "PARKING", headline: "一次转向，照顾整条车队",
    intro: "按住鼠标、空格或画布，所有车一起右转；松开逐渐回正。将车驶入右侧浅黄色空位，避开已经停好的车辆。",
    rule: "每次停车获得倍率 ×10 分，并增加后续同时控制的车辆数。金币按当前倍率给分，再增加倍率；漏掉金币会降低已提升的倍率。车辆相撞或落出底部都会结束。",
    lesson: "先观察空位，再决定转向。车辆越多，越要兼顾前后距离和同一个方向指令的影响。", ratio: "1",
  },
} as const;
type Snapshot = { phase: string; score: number; best: number; paused: boolean; replaying: boolean };

export default function CrispOriginalFrame(props: GameProps & { game: CrispId }) {
  return <CrispRound key={`${props.game}-${props.resetToken}`} {...props} />;
}
function CrispRound({ game, paused, muted = false, hintToken, undoToken, onStatus }: GameProps & { game: CrispId }) {
  const config = games[game];
  const supportsReplay = !("supportsReplay" in config) || config.supportsReplay !== false;
  const frame = useRef<HTMLIFrameElement>(null);
  const status = useRef(onStatus);
  const flags = useRef({ paused, muted });
  const tokens = useRef({ hintToken, undoToken });
  status.current = onStatus; flags.current = { paused, muted };
  const session = useMemo(() => crypto.randomUUID(), []);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL(`./crisp-original/${game}/index.html`, document.baseURI);
    url.searchParams.set("session", session);
    return url.href;
  }, [game, session]);
  useEffect(() => {
    const target = frame.current?.contentWindow;
    const send = (type: string, extra: Record<string, unknown> = {}) => target?.postMessage({ source: "playgarden-host", session, type, ...extra }, location.origin);
    status.current(`${config.intro}完整无尽挑战，不计有限关卡。`);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== target || event.data?.source !== "playgarden-crisp" || event.data.session !== session || event.data.game !== game) return;
      const data = event.data;
      if (data.type === "ready") {
        if (data.revision !== "crisp-cfb39d2f-playgarden-1" || data.endless !== true) { setError("资源版本不匹配，请重来。"); return; }
        setReady(true); send("mute", { muted: flags.current.muted }); send("pause", { paused: flags.current.paused });
      } else if (data.type === "status" && typeof data.message === "string") status.current(data.message);
      else if (data.type === "snapshot" && data.state && Number.isFinite(data.state.score)) setSnapshot(data.state);
      else if (data.type === "error") setError(`游戏暂未能启动：${String(data.message)}`);
    };
    window.addEventListener("message", receive);
    return () => {
      (target as (Window & { __crispDispose?: () => void }) | null)?.__crispDispose?.();
      send("dispose"); window.removeEventListener("message", receive);
    };
  }, [game, config.intro, session]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: "playgarden-host", session, type: "pause", paused }, location.origin);
  }, [ready, paused, session]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: "playgarden-host", session, type: "mute", muted }, location.origin);
  }, [ready, muted, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    status.current(config.lesson);
  }, [hintToken, config.lesson]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    status.current("实时无尽挑战没有逐步撤销；可以暂停观察，或用“重来”开始新局。");
  }, [undoToken]);
  return <section className={`crisp-game crisp-${game}`} data-crisp-game={game} data-crisp-ready={ready} data-crisp-phase={snapshot?.phase ?? "loading"}>
    <header className="crisp-heading"><div><span>{config.original} · {config.title}</span><h3>{config.headline}</h3></div><b>无尽挑战</b></header>
    <p className="crisp-intro">{config.intro}</p>
    <div className="crisp-score"><span>本局 <strong>{Math.floor(snapshot?.score ?? 0)}</strong></span><span>本机最高 <strong>{snapshot?.best ?? 0}</strong></span><small>{snapshot?.replaying ? "原作操作回放 · 点击开始新局" : "点击画布开始 · P / Esc 暂停"}</small></div>
    <div className="crisp-frame-wrap" style={{ aspectRatio: config.ratio }}>
      <iframe ref={frame} src={src} title={`${config.original} ${config.title}原作`} tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <div className="crisp-cover" role="status">正在载入{config.title}…</div>}
      {paused && <div className="crisp-cover">已暂停，画面、时间与声音已冻结。</div>}
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="crisp-help"><summary>玩法、操作与开源说明</summary>
      <p>{config.rule}</p><p>{config.lesson}</p>
      <p>空格、回车和触摸都使用相同的一键操作。按住后移出画布会松开；离开窗口会自动暂停，点击画布中的继续提示恢复。声音由上方声音开关控制，首次操作后启用。{supportsReplay ? "本机最高分只记录真实玩家对局，自动回放不重复提交成绩。" : "本机最高分只记录真实结束的对局。"}</p>
      <p>本作没有有限关卡，也不保存进行中的一局。{supportsReplay ? "结束后可以点击画布再玩，稍候会回放上一局操作；“重来”返回全新标题页。回放不是恢复存档。" : "结束后可以点击画布再玩；稍候返回标题页。“重来”返回全新标题页。"}</p>
      <p>ABA Games 原作（2021），保留完整玩法、像素图形、物理、难度和生成音乐。游戏、crisp-game-lib、sounds-some-sounds、jsfx 与 mml-iterator 的许可均为 MIT；本站中文界面和生命周期适配按 GPL-3.0-only 提供。<a href="./crisp-original/LICENSES.txt" target="_blank" rel="noreferrer">查看第三方署名与许可</a>，以及<a href="./crisp-original/PLAYGARDEN-COPYING.txt" target="_blank" rel="noreferrer">本站适配 GPL 许可</a>。</p>
    </details>
  </section>;
}
