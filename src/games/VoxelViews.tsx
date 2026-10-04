import type { CSSProperties, KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  createVoxelBoard,
  solveVoxel,
  toggleVoxel,
  voxelCoordinates,
  voxelProjection,
  voxelViewsLevels,
  voxelWon,
  type VoxelSide,
} from "./voxelViewsLogic";
import { useSpatialRound } from "./spatialConstructionRound";
import SpatialConstructionScene from "./SpatialConstructionScene";
import "./spatialConstructionGames.css";
export default function VoxelViews(props: GameProps) {
  return <VoxelRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function VoxelRound(props: GameProps) {
  const level = voxelViewsLevels[props.level] ?? voxelViewsLevels[0],
    n = level.size;
  const round = useSpatialRound(
    props,
    createVoxelBoard(level),
    (board) => voxelWon(level, board),
    (board) => {
      const result = solveVoxel(level, board);
      if (result.board) {
        const cell = result.board.findIndex(
            (v, i) => v === 1 && board[i] === 0,
          ),
          [x, y, z] = voxelCoordinates(n, cell);
        return {
          cell,
          message: `找到一种可行搭法：在第 ${z + 1} 层，x=${x + 1}、y=${y + 1} 放一块。它能延伸到完整答案，不代表每种答案都必须这样放。`,
        };
      }
      return {
        message:
          result.status === "limit"
            ? "本次推理达到 20,000 个节点上限，暂时不能判断。可撤销一块后再试。"
            : "只往当前构造里加方块已无法满足三张图；需要移除或撤销某块。先找超过目标的视线。",
      };
    },
    "点击分层格子放入或取走一块。三张透视图中，每条视线的方块数都要等于目标。",
    "三向投影全部吻合！你完成了自己的空间雕塑。",
  );
  const projections = {
    front: voxelProjection(n, round.board, "front"),
    side: voxelProjection(n, round.board, "side"),
    top: voxelProjection(n, round.board, "top"),
  };
  const matched = (["front", "side", "top"] as const).reduce(
    (s, side) =>
      s + projections[side].filter((v, i) => v === level[side][i]).length,
    0,
  );
  const label = (i: number) => {
    const [x, y, z] = voxelCoordinates(n, i);
    return `第 ${z + 1} 层，x=${x + 1}，y=${y + 1}`;
  };
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -n,
      ArrowDown: n,
      PageUp: n * n,
      PageDown: -n * n,
    };
    if (!(event.key in moves) || round.frozen) return;
    event.preventDefault();
    const next = index + moves[event.key],
      [x, y] = voxelCoordinates(n, index);
    if (
      next < 0 ||
      next >= n ** 3 ||
      (event.key === "ArrowLeft" && x === 0) ||
      (event.key === "ArrowRight" && x === n - 1) ||
      (event.key === "ArrowUp" && y === 0) ||
      (event.key === "ArrowDown" && y === n - 1)
    )
      return;
    event.currentTarget
      .closest(".sc-game")
      ?.querySelector<HTMLButtonElement>(`[data-voxel-cell="${next}"]`)
      ?.focus();
  }
  function projection(side: VoxelSide, title: string, axis: string) {
    const rows = Array.from({ length: n }, (_, i) =>
      side === "top" ? i : n - i - 1,
    );
    return (
      <section className="sc-projection" key={side} aria-label={title}>
        <h4>{title}</h4>
        <small>{axis}</small>
        <div
          className="sc-count-grid"
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
        >
          {rows.flatMap((row) =>
            Array.from({ length: n }, (_, col) => {
              const i = row * n + col,
                value = projections[side][i],
                target = level[side][i],
                status =
                  value === target
                    ? "match"
                    : value > target
                      ? "over"
                      : "under";
              return (
                <div
                  key={i}
                  data-voxel-projection={`${side}:${i}`}
                  data-state={status}
                  className={`sc-count sc-${status}`}
                  aria-label={`${side === "top" ? "y" : "z"}=${row + 1}，${side === "side" ? "y" : "x"}=${col + 1}，当前 ${value}，目标 ${target}${status === "match" ? "，已匹配" : status === "over" ? "，超出" : "，未足"}`}
                >
                  <b>
                    {value}
                    <span>/{target}</span>
                  </b>
                  <small>
                    {status === "match"
                      ? "✓"
                      : status === "over"
                        ? "多了"
                        : "待补"}
                  </small>
                </div>
              );
            }),
          )}
        </div>
      </section>
    );
  }
  return (
    <div className="puzzle-layout sc-game" data-spatial-game="voxel">
      <section className="sc-workbench" aria-label="三视方块工作台">
        <header className="sc-heading">
          <div>
            <span className="mini-label">
              VOXEL VIEWS · 第 {props.level + 1} 关
            </span>
            <h3>{level.title}</h3>
          </div>
          <span className="sc-badge">
            {n} × {n} × {n}
          </span>
        </header>
        <div className="sc-stats">
          <span>
            方块{" "}
            <b data-voxel-count={round.board.reduce((a, b) => a + b, 0)}>
              {round.board.reduce((a, b) => a + b, 0)} /{" "}
              {level.top.reduce((a, b) => a + b, 0)}
            </b>
          </span>
          <span>
            视线匹配{" "}
            <b>
              {matched} / {3 * n * n}
            </b>
          </span>
        </div>
        <div className="sc-projections">
          {projection("front", "正视图", "x → · 高度 z ↑")}
          {projection("side", "右视图", "深度 y → · 高度 z ↑")}
          {projection("top", "俯视图", "x → · 深度 y ↓")}
        </div>
        <p className="sc-small">
          每格显示 当前 / 目标。这里数的是沿视线的全部方块，包括被遮住的方块。
        </p>
        <div className="sc-layers" style={{ "--sc-n": n } as CSSProperties}>
          {Array.from({ length: n }, (_, l) => n - 1 - l).map((z) => (
            <section className="sc-layer" key={z} aria-label={`第 ${z + 1} 层`}>
              <h4>
                第 {z + 1} 层 <small>z={z + 1}</small>
              </h4>
              <span className="sc-axis">x → · y ↓</span>
              <div className="sc-voxel-grid">
                {Array.from({ length: n * n }, (_, i) => z * n * n + i).map(
                  (i) => (
                    <button
                      type="button"
                      key={i}
                      data-voxel-cell={i}
                      data-filled={round.board[i]}
                      className={`sc-voxel-cell ${round.board[i] ? "sc-filled" : ""} ${round.hinted?.cell === i && !props.paused ? "sc-hinted" : ""}`}
                      disabled={round.frozen}
                      aria-disabled={
                        level.locked[i] !== undefined || round.frozen
                      }
                      aria-pressed={round.board[i] === 1}
                      aria-label={`${label(i)}，${round.board[i] ? "有方块" : "空格"}${level.locked[i] !== undefined ? "，锁定" : "，点击切换"}`}
                      onKeyDown={(e) => keyboard(e, i)}
                      onClick={() =>
                        round.change(
                          (board) => toggleVoxel(level, board, i),
                          `${label(i)}的方块已切换；查看变化的三条视线。`,
                        )
                      }
                    >
                      <span aria-hidden="true">
                        {round.board[i] ? "◆" : "＋"}
                      </span>
                      <small>
                        {(i % n) + 1},{(Math.floor(i / n) % n) + 1}
                        {level.locked[i] !== undefined ? " 锁" : ""}
                      </small>
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
        <p className="sc-feedback" role="status" aria-live="polite">
          {props.paused ? "已暂停，方块与投影已保留。" : round.feedback}
        </p>
      </section>
      <aside className="game-notes sc-notes">
        <span className="mini-label">观察 · 投影 · 三维重建</span>
        <h3>
          从三张图，
          <br />
          搭出一个世界。
        </h3>
        <p>
          正视图沿 y 数方块，右视图沿 x 数，俯视图沿 z
          数。每放一块，三张图各有一个数字增加 1。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{level.idea}</p>
        </div>
        <SpatialConstructionScene
          model={{ kind: "voxel", size: n, board: round.board }}
          paused={props.paused}
        />
        <ul>
          <li>这是无重力的空间拼搭，上层方块可以悬空。</li>
          <li>所有视线精确匹配即可，不要求复刻某个隐藏模型。</li>
          <li>提示只给当前构造的一种可行延伸，不会自动放块。</li>
        </ul>
        <p className="muted">
          Tab 或方向键选格；Enter / 空格放置或移除；PageUp / PageDown 换层。3D
          只是当前作品的预览，关闭 WebGL 也能完成每关。
        </p>
      </aside>
    </div>
  );
}
