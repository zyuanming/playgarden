// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import "./hextrisOriginal.css";

type Snapshot = { phase: string; paused: boolean; score: number; best: number };
export default function HextrisOriginal(props: GameProps) {
  return <HextrisRound key={props.resetToken} {...props} />;
}
function HextrisRound({ paused, freshStart, hintToken, undoToken, onStatus }: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const status = useRef(onStatus);
  const flags = useRef({ paused });
  const tokens = useRef({ hintToken, undoToken });
  status.current = onStatus;
  flags.current = { paused };
  const session = useMemo(() => crypto.randomUUID(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const src = useMemo(() => {
    const url = new URL("./hextris-original/index.html", document.baseURI);
    url.searchParams.set("session", session);
    if (freshStart) url.searchParams.set("fresh", "1");
    return url.href;
  }, [session, freshStart]);
  useEffect(() => {
    const target = frame.current?.contentWindow;
    const send = (type: string, extra: Record<string, unknown> = {}) =>
      target?.postMessage({ source: "playgarden-host", session, type, ...extra }, location.origin);
    status.current("左右旋转中央六边形，让相邻同色彩块连成 3 块。完整无尽挑战不计有限关卡。");
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== target || event.data?.source !== "playgarden-hextris" || event.data.session !== session) return;
      const data = event.data;
      if (data.type === "ready") {
        if (data.revision !== "hextris-3f4847dc-playgarden-1" || data.endless !== true) {
          setError("游戏资源版本不匹配，请重来。");
          return;
        }
        setReady(true);
        send("pause", { paused: flags.current.paused });
      } else if (data.type === "status" && typeof data.message === "string") {
        status.current(data.message);
      } else if (data.type === "snapshot" && data.state && Number.isFinite(data.state.score)) {
        setSnapshot(data.state);
      } else if (data.type === "error") {
        setError("游戏暂未能启动：" + String(data.message));
      }
    };
    window.addEventListener("message", receive);
    return () => { send("dispose"); window.removeEventListener("message", receive); };
  }, [session]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ source: "playgarden-host", session, type: "pause", paused }, location.origin);
  }, [ready, paused, session]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (ready) frame.current?.contentWindow?.postMessage({ source: "playgarden-host", session, type: "hint" }, location.origin);
  }, [hintToken, ready, session]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    status.current("实时接块没有逐步撤销；可以暂停，或用“重来”开始新的一局。");
  }, [undoToken]);
  return <section className="hextris-game" data-hextris-game data-hextris-ready={ready} data-hextris-phase={snapshot?.phase ?? "loading"}>
    <header className="hextris-heading"><div><span>HEXTRIS · 六向彩环</span><h3>六个方向，一次漂亮的连锁</h3></div><b>无尽挑战</b></header>
    <p className="hextris-intro">旋转接住彩块，让相邻同色连成 3 块。左右键或轻触画布旋转，按住下键或加速按钮让彩块快落。</p>
    <div className={`hextris-frame-wrap${paused ? " hextris-host-paused" : ""}`}>
      <iframe ref={frame} src={src} title="Hextris 六向彩环原作" className="hextris-frame" tabIndex={paused ? -1 : 0} aria-hidden={paused} />
      {!ready && !error && <div className="hextris-cover" role="status">正在载入六向彩环…</div>}
      {paused && <div className="hextris-cover">已暂停，彩块与连击时间已冻结。</div>}
    </div>
    {error && <p className="hextris-error" role="alert">{error}</p>}
    <details className="hextris-help"><summary>玩法、存档与开源说明</summary>
      <p>同边上下相邻、邻边同层相邻都可连成同色组，首尾两边也相邻。每次消除获得“块数平方 × 连击倍率”分。外环彩色计时条结束前再次消除，倍率加一。彩块超出容量即结束，触屏 7 层，桌面 8 层。</p>
      <p>原作的随机、双列、对向、螺旋、整环、半环六种波形与渐进难度全部保留。按 P 或 Escape 暂停，切到后台自动暂停。保存并暂停后可返回大厅，再次进入选择“继续存档”；“重来”会清除当前进度开始新局。本机前三高分自动保留。</p>
      <p>改编自 Logan Engstrom、Garrett Finucane、Noah Moroze、Michael Yang 的 Hextris，固定版本 3f4847dc。原代码与本站修改按 GPL-3.0-or-later 提供，许可证与对应源码随站点项目分发。图形由 Canvas 程序绘制，未使用外部美术、字体、音频或运行时依赖。</p>
    </details>
  </section>;
}
