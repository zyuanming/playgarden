// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  cargoHint,
  cargoMoveLabels,
  cargoMoveProblem,
  cargoMoves,
  cargoWon,
  createCargoState,
  moveCargo,
  stackQueueLevels,
  undoCargo,
  type CargoMove,
} from "./stackQueueLogic";
import "./stackQueueWorkshop.css";

export default function StackQueueWorkshop(props: GameProps) {
  return <CargoLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CargoLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = stackQueueLevels[level] ?? stackQueueLevels[0];
  const [state, setState] = useState(createCargoState),
    [hint, setHint] = useState<{ text: string; move: CargoMove | null } | null>(
      null,
    );
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const board = state.board,
    won = cargoWon(config, board),
    locked = paused || won;
  useEffect(() => {
    onStatus(
      "按目标顺序发货。栈后进先出，队列先进先出；空间有限，也可以在两者之间换轨。",
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const result = cargoHint(config, board);
    setHint(result);
    onStatus(result.text);
  }, [hintToken, paused, won, config, board, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const next = undoCargo(state);
    setState(next);
    setHint(null);
    onStatus(
      next === state
        ? "还没有调度可以撤销。"
        : "已撤销一步，货物回到原来的位置。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `全部货物按顺序到达！用了 ${state.history.length} 步，最短纪录 ${config.par} 步。`,
      );
      onComplete();
    }
  }, [won, paused, state.history.length, config, onComplete, onStatus]);
  function act(move: CargoMove) {
    if (locked) return;
    const problem = cargoMoveProblem(config, board, move);
    if (problem) {
      onStatus(problem);
      return;
    }
    const next = moveCargo(config, state, move);
    setState(next);
    setHint(null);
    onStatus(
      `${cargoMoveLabels[move]}。${next.board.output.length === config.target.length ? "全部发出！" : `下一件应发 ${config.target[next.board.output.length]}。`}`,
    );
  }
  const crate = (item: string, key: string, marker?: string) => (
    <span
      key={key}
      className="sq-crate"
      data-cargo-item={item}
      aria-label={`货箱 ${item}${marker ? `，${marker}` : ""}`}
    >
      <b>{item}</b>
      {marker && <small>{marker}</small>}
    </span>
  );
  return (
    <div
      className="puzzle-layout stack-queue-workshop"
      data-cargo-game
      data-cargo-cursor={board.cursor}
      data-cargo-stack={board.stack.join("")}
      data-cargo-queue={board.queue.join("")}
      data-cargo-output={board.output.join("")}
      data-cargo-won={won}
      tabIndex={0}
      aria-label="栈与队列调度台，数字一至七执行路线"
      onKeyDown={(event) => {
        if (
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          locked
        )
          return;
        const index = Number(event.key) - 1;
        if (/^[1-7]$/.test(event.key)) {
          event.preventDefault();
          act(cargoMoves[index]);
        }
      }}
    >
      <section className="sq-workbench" aria-label="货箱调度台">
        <div className="sq-heading">
          <span className="mini-label">栈与队列 · {config.title}</span>
          <strong>{state.history.length} 步</strong>
        </div>
        <p className="sq-instruction">
          {paused
            ? "调度已暂停。"
            : won
              ? "发货顺序完全正确！"
              : `下一件：${config.target[board.output.length]}。来货只取最左边；每次只能搬一箱。`}
        </p>
        <div className="sq-zone sq-input" aria-label="来货区">
          <div className="sq-zone-heading">
            <h4>来货传送带</h4>
            <small>从左往右 →</small>
          </div>
          <div className="sq-lane" data-cargo-zone="input">
            {config.input
              .slice(board.cursor)
              .map((item, i) =>
                crate(item, item, i === 0 ? "下一箱" : undefined),
              )}
            {board.cursor === config.input.length && (
              <span className="sq-empty">来货已取完</span>
            )}
          </div>
        </div>
        <div className="sq-buffers">
          <div className="sq-zone sq-stack" aria-label="后进先出的栈">
            <div className="sq-zone-heading">
              <h4>栈 · LIFO</h4>
              <small>
                {board.stack.length} / {config.stackCapacity} 格
              </small>
            </div>
            <p>↓ 入栈 / ↑ 出栈 · 都在栈顶</p>
            <div className="sq-stack-slots" data-cargo-zone="stack">
              {Array.from({ length: config.stackCapacity }, (_, i) => {
                const index = config.stackCapacity - 1 - i,
                  item = board.stack[index];
                return item ? (
                  crate(
                    item,
                    `stack${index}`,
                    index === board.stack.length - 1 ? "栈顶" : "",
                  )
                ) : (
                  <span className="sq-slot" key={`stack${index}`}>
                    空格
                  </span>
                );
              })}
            </div>
            <strong className="sq-base">栈底 · 不可从这里取</strong>
          </div>
          <div className="sq-zone sq-queue" aria-label="先进先出的队列">
            <div className="sq-zone-heading">
              <h4>队列 · FIFO</h4>
              <small>
                {board.queue.length} / {config.queueCapacity} 格
              </small>
            </div>
            <p>← 队首取出 / 队尾加入 ←</p>
            <div className="sq-lane sq-queue-slots" data-cargo-zone="queue">
              {board.queue.map((item, i) =>
                crate(
                  item,
                  item,
                  i === 0
                    ? "队首"
                    : i === board.queue.length - 1
                      ? "队尾"
                      : undefined,
                ),
              )}
              {Array.from(
                { length: config.queueCapacity - board.queue.length },
                (_, i) => (
                  <span className="sq-slot" key={`empty${i}`}>
                    空格
                  </span>
                ),
              )}
            </div>
            <span className="sq-buffer-note">
              只能拿最早入队的一箱，不能从中间或队尾取货。
            </span>
          </div>
        </div>
        <div className="sq-zone sq-output" aria-label="发货目标">
          <div className="sq-zone-heading">
            <h4>目标发货单</h4>
            <small>
              {board.output.length} / {config.target.length} 已发出
            </small>
          </div>
          <ol className="sq-manifest">
            {config.target.map((item, i) => (
              <li
                key={item}
                className={`${i < board.output.length ? "sent" : ""} ${i === board.output.length ? "next" : ""}`}
                aria-label={`第 ${i + 1} 件 ${item}，${i < board.output.length ? "已发出" : i === board.output.length ? "下一件" : "等待"}`}
              >
                <small>{i + 1}</small>
                <b>{item}</b>
                <span>
                  {i < board.output.length
                    ? "✓"
                    : i === board.output.length
                      ? "下一件"
                      : "等待"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="sq-route-controls" aria-label="搬运路线">
          {cargoMoves.map((move, i) => {
            const problem = cargoMoveProblem(config, board, move);
            return (
              <button
                key={move}
                data-cargo-move={move}
                disabled={locked || problem !== null}
                title={problem ?? cargoMoveLabels[move]}
                aria-label={`${i + 1}：${cargoMoveLabels[move]}`}
                className={hint?.move === move ? "sq-hinted" : ""}
                onClick={() => act(move)}
              >
                <kbd>{i + 1}</kbd>
                <span>{cargoMoveLabels[move]}</span>
              </button>
            );
          })}
        </div>
        <p className="sq-keyboard">
          点击路线按钮，或聚焦调度台后按数字 1–7。Tab 移动焦点，Enter /
          空格也能操作按钮。
        </p>
      </section>
      <aside className="game-notes sq-notes">
        <span className="mini-label">数据结构 · 缓冲 · 规划</span>
        <h3>同样的箱子，两种顺序。</h3>
        <p>{config.lesson}</p>
        <div className="sq-rule-card">
          <strong>栈：后进先出</strong>
          <p>像叠盘子。后来放上去的，必须先拿走。</p>
        </div>
        <div className="sq-rule-card">
          <strong>队列：先进先出</strong>
          <p>像排队。先到队尾等候的，先从队首离开。</p>
        </div>
        <p>
          发错顺序的路线会锁定。满载时不能再塞入；卡住可以撤销或请求提示。能完成就通关，不必追平最短步数。
        </p>
        <div className="sq-par">
          <span>这一关的最短纪录</span>
          <strong>{config.par} 步</strong>
        </div>
        {hint && (
          <p className="sq-hint-text" role="status">
            {hint.text}
          </p>
        )}
      </aside>
    </div>
  );
}
