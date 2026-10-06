// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  appendPostPacket,
  compressionHint,
  compressionWon,
  createCompressionState,
  decodePostPacket,
  decodePostPackets,
  postOptions,
  postPacketCost,
  postPacketKey,
  postPacketLabel,
  postTotalCost,
  undoPostPacket,
  type CompressionHint,
  type PostPacket,
} from "./compressionPostLogic";
import { compressionPostLevels } from "./compressionPostLevels";
import "./compressionPost.css";

const modified = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}) => event.ctrlKey || event.metaKey || event.altKey;

const symbolNames: Record<string, string> = {
  A: "三角",
  B: "菱形",
  C: "星形",
  D: "圆形",
  E: "方形",
  F: "加号",
};
const symbolGlyphs: Record<string, string> = {
  A: "▲",
  B: "◆",
  C: "★",
  D: "●",
  E: "■",
  F: "+",
};
export default function CompressionPost(props: GameProps) {
  return (
    <PostLevelView key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function PostLevelView({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = compressionPostLevels[level] ?? compressionPostLevels[0];
  const [state, setState] = useState(createCompressionState),
    [hint, setHint] = useState<CompressionHint | null>(null);
  const root = useRef<HTMLDivElement>(null),
    notified = useRef(false),
    hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    stateRef = useRef(state);
  stateRef.current = state;
  const decoded = decodePostPackets(config, state.packets) ?? "",
    cost = postTotalCost(state.packets),
    won = compressionWon(config, state.packets),
    locked = paused || won,
    options = postOptions(config, decoded.length);
  function undo() {
    if (paused || won) return;
    const previous = stateRef.current,
      next = undoPostPacket(previous);
    setState(next);
    setHint(null);
    root.current?.focus({ preventScroll: true });
    onStatus(
      next === previous
        ? "还没有包可以撤销。"
        : "已取回最后一包，可以重新选择边界。",
    );
  }
  function append(packet: PostPacket) {
    if (locked) return;
    const next = appendPostPacket(config, stateRef.current, packet);
    setState(next);
    setHint(null);
    root.current?.focus({ preventScroll: true });
    const total = postTotalCost(next.packets),
      output = decodePostPackets(config, next.packets)!;
    onStatus(
      `已装入${postPacketLabel(config, packet)}，花费 ${postPacketCost(packet)} 单位；累计 ${total} / ${config.budget}。${output.length === config.message.length && total > config.budget ? "消息已完整，但超出预算，请撤销再规划。" : ""}`,
    );
  }
  useEffect(() => {
    onStatus(
      "从消息左端开始选择一包。包必须无损解码；所有符号原样还原，并且总成本不超过预算才通关。",
    );
  }, []);
  useEffect(() => {
    if (paused && root.current?.contains(document.activeElement))
      root.current.focus({ preventScroll: true });
  }, [paused]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const answer = compressionHint(config, stateRef.current.packets);
    setHint(answer);
    onStatus(answer.text);
  }, [hintToken, paused, won, config]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (!paused && !won) undo();
  }, [undoToken, paused, won]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `无损投递成功！完整还原 ${config.message.length} 个符号，用了 ${cost} / ${config.budget} 单位。`,
      );
      onComplete();
    }
  }, [won, paused, cost, config, onComplete, onStatus]);
  const kindLabels = { literal: "原文包", run: "连写包", dict: "词典引用" };
  return (
    <div
      className="puzzle-layout compression-post"
      data-compression-post
      data-post-cursor={decoded.length}
      data-post-cost={cost}
      data-post-won={won}
      ref={root}
      tabIndex={0}
      aria-label="压缩邮局"
    >
      <section className="cp-workbench" aria-label="无损装包台">
        <div className="cp-heading">
          <span className="mini-label">压缩邮局 · {config.title}</span>
          <strong className={cost > config.budget ? "cp-over" : ""}>
            成本 {cost} / {config.budget}
          </strong>
        </div>
        <p className="cp-banner">
          {paused
            ? "装包已暂停。"
            : won
              ? "已无损还原全部消息，预算合格！"
              : decoded.length === config.message.length
                ? "内容已完整，但成本超标。取回最后一包再规划。"
                : `下一包从第 ${decoded.length + 1} 个符号开始。选一种包装和长度。`}
        </p>
        <section className="cp-message" aria-label="公开原始消息">
          <h4>原始消息 · {config.message.length} 个符号</h4>
          <ol>
            {[...config.message].map((symbol, index) => (
              <li
                key={index}
                className={`${index < decoded.length ? "cp-packed" : ""} ${index === decoded.length ? "cp-next" : ""}`}
                aria-label={`第 ${index + 1} 个：${symbol} ${symbolNames[symbol]}，${index < decoded.length ? "已装包" : index === decoded.length ? "下一包起点" : "待装包"}`}
              >
                <small>{index + 1}</small>
                <span aria-hidden="true">{symbolGlyphs[symbol]}</span>
                <b>{symbol}</b>
                {index === decoded.length && <em>下一包</em>}
              </li>
            ))}
          </ol>
          <p className="cp-exact-message">
            完整文字等价：<strong>{config.message}</strong>
            。每个字母代表一个符号；形状仅帮助辨认。
          </p>
        </section>
        {config.dictionary.length > 0 && (
          <section className="cp-dictionary" aria-label="公开共享词典">
            <h4>收件人已有词典 · 每次引用 2 单位</h4>
            <ul>
              {config.dictionary.map((text, index) => (
                <li key={index}>
                  <b>#{index + 1}</b>
                  <span>{text}</span>
                  <small>{text.length} 符号</small>
                </li>
              ))}
            </ul>
            <p>
              词典是题目给定的共享内容，不计入本封消息的传输成本。不能自行新增条目。
            </p>
          </section>
        )}
        <div className="cp-costs" aria-label="公开成本模型">
          <span>原文：1 包头 + 每符号 1，最多 {config.maxLiteral} 符号</span>
          {config.runs && (
            <span>连写：固定 3，连续相同符号 2–{config.maxRun} 个</span>
          )}
          {config.dictionary.length > 0 && (
            <span>词典：固定 2，完整匹配一个条目</span>
          )}
        </div>
        <div className="cp-options" aria-label="选择下一包">
          {(["literal", "run", "dict"] as const)
            .filter(
              (kind) =>
                kind === "literal" ||
                (kind === "run" ? config.runs : config.dictionary.length > 0),
            )
            .map((kind) => (
              <section key={kind}>
                <h4>{kindLabels[kind]}</h4>
                <div className="cp-option-buttons">
                  {options
                    .filter((packet) => packet.kind === kind)
                    .map((packet) => (
                      <button
                        key={postPacketKey(packet)}
                        data-post-packet={postPacketKey(packet)}
                        disabled={locked}
                        className={
                          hint?.packet &&
                          postPacketKey(hint.packet) === postPacketKey(packet)
                            ? "cp-hinted"
                            : ""
                        }
                        onClick={(event) => {
                          if (!modified(event)) append(packet);
                        }}
                        aria-label={`${postPacketLabel(config, packet)}，成本 ${postPacketCost(packet)}`}
                      >
                        <b>{postPacketLabel(config, packet)}</b>
                        <span>
                          → {decodePostPacket(config, packet)} ·{" "}
                          {postPacketCost(packet)} 单位
                        </span>
                      </button>
                    ))}
                </div>
                {!options.some((packet) => packet.kind === kind) && (
                  <p className="cp-unavailable">
                    {decoded.length === config.message.length
                      ? "所有符号均已装包。"
                      : kind === "run"
                        ? "当前位置没有两个相同的连续符号。"
                        : "当前位置没有完整匹配的词典条目。"}
                  </p>
                )}
              </section>
            ))}
        </div>
        <section className="cp-packets" aria-label="已选包及实际解码">
          <div className="cp-heading">
            <h4>信封中的包 · {state.packets.length}</h4>
            <button
              data-post-undo
              disabled={locked || state.history.length === 0}
              onClick={(event) => {
                if (!modified(event)) undo();
              }}
            >
              取回最后一包
            </button>
          </div>
          {state.packets.length === 0 ? (
            <p>信封还是空的。</p>
          ) : (
            <ol>
              {state.packets.map((packet, index) => (
                <li key={index}>
                  <strong>
                    {index + 1}. {postPacketLabel(config, packet)}
                  </strong>
                  <span>
                    {postPacketCost(packet)} 单位 →{" "}
                    {decodePostPacket(config, packet)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="cp-decoded">
            实际解码：<strong data-post-decoded>{decoded || "（空）"}</strong>
          </p>
          <p>
            剩余 {config.message.length - decoded.length} 符号 · 可用预算{" "}
            {config.budget - cost} 单位
          </p>
        </section>
        {hint && (
          <p className="cp-hint" role="status">
            {hint.text}
          </p>
        )}
      </section>
      <aside className="game-notes cp-notes">
        <span className="mini-label">无损编码 · 分段 · 动态规划</span>
        <h3>装得巧，也要还原得对。</h3>
        <p>{config.lesson}</p>
        <h4>第一次怎么玩</h4>
        <ol>
          <li>从左到右处理公开消息，不能跳过或换序。</li>
          <li>点击一包的按钮，选择它覆盖的符号数。</li>
          <li>原文包原样存储；连写包记符号和次数；后期词典包记条目编号。</li>
          <li>
            检查每一包实际解码的结果。所有包拼起来必须和原始消息完全相同。
          </li>
          <li>合计不超预算就通过。选贵了可以取回最后一包或使用工具栏撤销。</li>
        </ol>
        <p>
          成本使用虚构“单位”，并非真实编码字节数。所有消息为原创游戏符号，不上传用户数据，也不进行网络投递。
        </p>
        <p>
          Tab 移动焦点，Enter /
          空格操作按钮。提示只建议下一包；若当前前缀已经太贵，会明确建议撤销。
        </p>
        <p className="cp-scroll-cue">
          向下滚动可检查已选包和解码结果。原始消息、完整词典和成本表均公开显示。
        </p>
      </aside>
    </div>
  );
}
