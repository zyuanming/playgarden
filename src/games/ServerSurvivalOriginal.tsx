// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { serverSurvivalOriginalLevels } from "./serverSurvivalOriginalLevels";
import "./serverSurvivalOriginal.css";
export default function ServerSurvivalOriginal(props: GameProps) {
  return (
    <OriginalRound
      key={`${props.level}:${props.resetToken}:${!!props.freePlay}`}
      {...props}
    />
  );
}
type Snapshot = {
  time: number;
  money: number;
  reputation: number;
  processed: number;
};
function OriginalRound({
  level,
  freePlay,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const frame = useRef<HTMLIFrameElement>(null),
    callbacks = useRef({ onStatus, onComplete }),
    flags = useRef({ paused }),
    tokens = useRef({ hintToken, undoToken }),
    done = useRef(false),
    receivedWin = useRef(false);
  callbacks.current = { onStatus, onComplete };
  flags.current = { paused };
  const session = useMemo(() => crypto.randomUUID(), []),
    selected =
      serverSurvivalOriginalLevels[level] ?? serverSurvivalOriginalLevels[0];
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(""),
    [renderer, setRenderer] = useState(""),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [won, setWon] = useState(false);
  const src = useMemo(() => {
    const u = new URL("./server-survival-full/index.html", document.baseURI);
    u.searchParams.set("session", session);
    u.searchParams.set("level", String(selected.id));
    u.searchParams.set("mode", freePlay ? "free" : "campaign");
    return u.href;
  }, [session, selected.id, freePlay]);
  const command = (type: string, extra: Record<string, unknown> = {}) =>
    frame.current?.contentWindow?.postMessage(
      { source: "playgarden-host", session, type, ...extra },
      location.origin,
    );
  useEffect(() => {
    callbacks.current.onStatus(
      freePlay
        ? "正在载入原作生存与沙盒模式。"
        : `原作第${selected.id}关：${selected.title}。可在键盘／触屏建设台操作，建好后开始运行。`,
    );
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.source !== "playgarden-server-survival" ||
        event.data.session !== session
      )
        return;
      const data = event.data;
      if (data.type === "ready") {
        if (data.levels !== 25 || data.services !== 26) {
          setFailed("原作资源版本不匹配，请重来。");
          return;
        }
        setReady(true);
        setRenderer(String(data.renderer));
        command("pause", { paused: flags.current.paused });
      } else if (data.type === "status" && typeof data.message === "string")
        callbacks.current.onStatus(data.message);
      else if (data.type === "error") {
        const message = "原作模块暂时未能启动：" + String(data.message);
        setFailed(message);
        callbacks.current.onStatus(message);
      } else if (data.type === "snapshot")
        setSnapshot({
          time: data.time,
          money: data.money,
          reputation: data.reputation,
          processed: data.processed,
        });
      else if (
        data.type === "complete" &&
        !freePlay &&
        data.level === selected.id &&
        !receivedWin.current
      ) {
        receivedWin.current = true;
        setWon(true);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [session, selected.id, freePlay]);
  useEffect(() => {
    if (ready) command("pause", { paused });
  }, [paused, ready]);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      callbacks.current.onStatus(`原作第${selected.id}关真实目标全部达成。`);
      callbacks.current.onComplete();
    }
  }, [won, paused, selected.id]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (ready && !paused && !won) command("hint");
  }, [hintToken, ready, paused, won]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (!paused && !won)
      callbacks.current.onStatus(
        "原作实时模拟不支持逐步撤销；可拆除/改线，或用“重来”恢复本关。",
      );
  }, [undoToken, paused, won]);
  return (
    <section
      className="sso-game"
      data-server-original-game
      data-server-original-ready={ready}
      data-server-original-won={won}
      data-server-original-renderer={renderer}
    >
      <header className="sso-heading">
        <div>
          <span>SERVER SURVIVAL · 原作本地集成</span>
          <h3>
            {freePlay
              ? "生存与沙盒"
              : `${String(selected.id).padStart(2, "0")} · ${selected.title}`}
          </h3>
        </div>
        <b>25关 · 26类服务</b>
      </header>
      <p className="sso-intro">
        {freePlay
          ? "保留原作的生存压力、流量事件与自由沙盒。这个模式不计入有限关卡。"
          : "保留原作真实关卡、预算与胜负条件。可以点画布建设，也可以打开“键盘／触屏建设台”，用坐标和下拉菜单操作。"}
      </p>
      {snapshot && (
        <div className="sso-summary">
          <span>运行 {snapshot.time}s</span>
          <span>余款 {snapshot.money}</span>
          <span>声誉 {snapshot.reputation}%</span>
          <span>已处理 {snapshot.processed}</span>
          <span>{renderer === "diagram" ? "平面图模式" : "本地三维机房"}</span>
        </div>
      )}
      <div className={`sso-frame-wrap ${paused ? "sso-paused" : ""}`}>
        <iframe
          ref={frame}
          src={src}
          title="Server Survival 原作"
          className="sso-frame"
          tabIndex={paused ? -1 : 0}
          aria-hidden={paused}
        />
        {!ready && !failed && (
          <div className="sso-loading" role="status">
            载入本地原作与完整关卡…
          </div>
        )}
        {paused && (
          <div className="sso-pause-message">
            已暂停，模拟时间和输入都已冻结。
          </div>
        )}
      </div>
      {failed && (
        <p className="sso-error" role="alert">
          {failed}
        </p>
      )}
      <details className="sso-help">
        <summary>操作、声音与开源说明</summary>
        <p>
          原作25关、26类服务与生存/沙盒模拟在本站本地运行。这里没有第三方游戏网站、远程CDN、广告或统计请求。上游音乐来源未单独确认，本地版本不含音乐或音效文件。
        </p>
        <p>
          所有建设、连线、升级、修复和扩容都能在建设台通过Tab、Enter、空格操作，也能触屏点按。上方暂停会冻结整个原作；重来重建这一关。原作实时模拟没有逐步撤销。
        </p>
        <p>
          代码来源：Kostyantyn Pshenychnyy
          与贡献者，MIT，固定提交7804e5969e28267cd33837e023eb46fa65da72b7。Playgarden的本地化、外壳与无障碍建设台为GPL-3.0-only改动。保留完整许可与对应源码。
        </p>
      </details>
    </section>
  );
}
