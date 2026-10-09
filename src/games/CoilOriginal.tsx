// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import "./coilOriginal.css";

type Snapshot = { phase: string; paused: boolean; score: number; best: number; energy: number; captures: number };
export default function CoilOriginal(props: GameProps) {
  return <CoilRound key={props.resetToken} {...props} />;
}
function CoilRound({ paused, hintToken, undoToken, onStatus }: GameProps) {
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
    const url = new URL("./coil-original/index.html", document.baseURI);
    url.searchParams.set("session", session);
    return url.href;
  }, [session]);
  useEffect(() => {
    const target = frame.current?.contentWindow;
    const send = (type: string, extra: Record<string, unknown> = {}) =>
      target?.postMessage({ source: "playgarden-host", session, type, ...extra }, location.origin);
    status.current("快速画圈，让光迹相交，围住蓝球并避开红色叉号。原作无尽挑战不计有限关卡。");
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== target ||
          event.data?.source !== "playgarden-coil" || event.data.session !== session) return;
      const data = event.data;
      if (data.type === "ready") {
        if (data.revision !== "coil-ea6fd3af-playgarden-1" || data.endless !== true) {
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
    return () => {
      send("dispose");
      window.removeEventListener("message", receive);
    };
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
    status.current("实时画圈没有逐步撤销；可以暂停思考，或用“重来”开始新的一局。");
  }, [undoToken]);
  return (
    <section className="coil-game" data-coil-game data-coil-ready={ready} data-coil-phase={snapshot?.phase ?? "loading"}>
      <header className="coil-heading"><div><span>COIL · 光迹围球</span><h3>一圈光，抓住转瞬即逝的蓝球</h3></div><b>无尽挑战</b></header>
      <p className="coil-intro">移动鼠标或手指画圈，让光迹相交。蓝球即将超时会变黄，红色叉号是炸弹。也可用方向键或 WASD 移动。</p>
      <div className={`coil-frame-wrap${paused ? " coil-host-paused" : ""}`}>
        <iframe ref={frame} src={src} title="Coil 光迹围球原作" className="coil-frame" tabIndex={paused ? -1 : 0} aria-hidden={paused} />
        {!ready && !error && <div className="coil-cover" role="status">正在载入光迹…</div>}
        {paused && <div className="coil-cover">已暂停，时间与输入已冻结。</div>}
      </div>
      {error && <p className="coil-error" role="alert">{error}</p>}
      <details className="coil-help"><summary>玩法与开源说明</summary>
        <p>蓝球超时或圈中炸弹会失去 30 能量；捕获蓝球恢复 1 能量，并积累连击倍率，最高 ×4。同圈捕获多个蓝球有额外奖励，时间越久生成越密。能量耗尽结束。</p>
        <p>按 Escape 或 P 暂停画圈。上方暂停会冻结整个游戏，重来会开始新局。最高分自动保存在当前浏览器，离开后再次进入从新局开始；无尽挑战不记为有限关卡通关。</p>
        <p>改编自 Hakim El Hattab 的 Coil（2011），保留完整原作无尽规则、光迹、粒子与计分。原代码采用 MIT；本站的中文界面、操作适配与原创卡片为 GPL-3.0-only。未使用上游装饰图片、远程字体或社交脚本。</p>
      </details>
    </section>
  );
}
