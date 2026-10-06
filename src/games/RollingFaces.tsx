// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createRollState,
  moveRoll,
  undoRoll,
  rollingWon,
  rollingHint,
  rotateRoll,
  rollFaceLabel,
  ROLL_DIRECTIONS,
  ROLL_LABELS,
  type RollDirection,
} from "./rollingFacesLogic";
import { rollingFacesLevels } from "./rollingFacesLevels";
import RollingFacesScene from "./RollingFacesScene";
import "./rollingFaces.css";
export default function RollingFaces(props: GameProps) {
  return <RollingRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function RollingRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = rollingFacesLevels[level] ?? rollingFacesLevels[0],
    [state, setState] = useState(() => createRollState(config));
  const [message, setMessage] = useState(
    "先观察出口的底面与北面要求，再选择滚动方向。",
  );
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const b = state.board,
    won = rollingWon(config, b),
    locked = paused || won;
  function status(text: string) {
    setMessage(text);
    onStatus(text);
  }
  useEffect(() => {
    onStatus("方向始终与地图一致。踩亮全部踏板，再以指定底面和北面滚到出口。");
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (!locked) status(rollingHint(config, b));
  }, [hintToken]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (locked) return;
    const next = undoRoll(config, state);
    setState(next);
    status(
      next === state
        ? "没有可以撤销的滚动。"
        : "已撤销一步，朝向和踏板一同恢复。",
    );
  }, [undoToken]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      status(
        `全部面印与出口朝向吻合！用了 ${state.history.length} 步；本关最短 ${config.certificate.shortest} 步。`,
      );
      onComplete();
    }
  }, [won, paused, onComplete]);
  function act(d: RollDirection) {
    if (locked) return;
    const next = moveRoll(config, state, d);
    if (next === state) {
      status(
        "这一步被边界、石墙或面门挡住了。面门检查滚入后的底面；带钥匙标记的门还检查踏板。",
      );
      return;
    }
    setState(next);
    status(
      `向${ROLL_LABELS[d]}滚动，底面 ${rollFaceLabel(next.board.faces[1])}，北面 ${rollFaceLabel(next.board.faces[2])}。`,
    );
  }
  const facePositions = ["顶", "底", "北", "南", "西", "东"];
  return (
    <div
      className="puzzle-layout rolling-faces"
      data-rolling-faces-game
      data-rolling-won={won}
      data-rolling-position={`${b.x},${b.y}`}
      data-rolling-orientation={b.faces.join("")}
      data-rolling-plates={b.plates}
    >
      <section className="rf-workbench" aria-label="滚面棋盘">
        <div className="rf-heading">
          <span className="mini-label">滚面旅程 · {config.title}</span>
          <strong>{state.history.length} 步</strong>
        </div>
        <RollingFacesScene level={config} board={b} paused={paused} />
        <div className="rf-compass">
          北 ↑<span>西 ← · 地图方向固定 · → 东</span>
        </div>
        <div
          className="rf-board"
          role="group"
          aria-label="可操作地图，方向键滚动立方体"
          tabIndex={0}
          style={{
            gridTemplateColumns: `repeat(${config.rows[0].length}, minmax(44px, 1fr))`,
          }}
          onKeyDown={(event) => {
            const d = (
              {
                ArrowUp: "N",
                ArrowRight: "E",
                ArrowDown: "S",
                ArrowLeft: "W",
              } as Record<string, RollDirection>
            )[event.key];
            if (
              d &&
              !event.repeat &&
              !event.altKey &&
              !event.ctrlKey &&
              !event.metaKey
            ) {
              event.preventDefault();
              act(d);
            }
          }}
        >
          {config.rows.flatMap((row, y) =>
            [...row].map((cell, x) => {
              const plateIndex = config.plates.findIndex(
                  (p) => p.x === x && p.y === y,
                ),
                plate = config.plates[plateIndex],
                gate = config.gates.find((g) => g.x === x && g.y === y),
                exit = x === config.exit.x && y === config.exit.y,
                current = x === b.x && y === b.y;
              if (cell === "#")
                return (
                  <div
                    key={`${x},${y}`}
                    className="rf-wall"
                    aria-label={`${y + 1} 行 ${x + 1} 列石墙`}
                  >
                    ×
                  </div>
                );
              const label = `${y + 1} 行 ${x + 1} 列${current ? `，立方体底面 ${rollFaceLabel(b.faces[1])}` : ""}${exit ? `，出口底 ${rollFaceLabel(config.exit.bottom)} 北 ${rollFaceLabel(config.exit.north)}` : ""}${plate ? `，踏板 ${plateIndex + 1} 底 ${rollFaceLabel(plate.face)} ${b.plates & (1 << plateIndex) ? "已亮" : "未亮"}` : ""}${gate ? `，门底 ${rollFaceLabel(gate.face)}` : ""}`;
              return (
                <button
                  key={`${x},${y}`}
                  data-rolling-cell={`${x},${y}`}
                  className={`${current ? "rf-current " : ""}${exit ? "rf-exit " : ""}${gate ? "rf-gate" : ""}`}
                  disabled={locked}
                  aria-label={label}
                  onClick={() => {
                    const dx = x - b.x,
                      dy = y - b.y;
                    if (Math.abs(dx) + Math.abs(dy) !== 1) {
                      status(
                        "请选择相邻格，或使用下方方向按钮。远处的格子不能直接跳到。",
                      );
                      return;
                    }
                    act(
                      dx === 1 ? "E" : dx === -1 ? "W" : dy === 1 ? "S" : "N",
                    );
                  }}
                >
                  <small>
                    {y + 1},{x + 1}
                  </small>
                  {current ? (
                    <b className="rf-cube-marker">
                      底 {rollFaceLabel(b.faces[1])}
                    </b>
                  ) : (
                    <span className="rf-cell-symbol">
                      {exit ? "出口" : gate ? "门" : plate ? "印" : "·"}
                    </span>
                  )}
                  {plate && (
                    <span className="rf-plate-label">
                      {b.plates & (1 << plateIndex) ? "✓" : "○"}{" "}
                      {plateIndex + 1}:{rollFaceLabel(plate.face)}
                    </span>
                  )}
                  {gate && (
                    <span>
                      门 {rollFaceLabel(gate.face)}
                      {gate.needs ? " +钥匙" : ""}
                    </span>
                  )}
                  {exit && (
                    <span>
                      底{rollFaceLabel(config.exit.bottom)} 北
                      {rollFaceLabel(config.exit.north)}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
        <div className="rf-controls" aria-label="固定世界方向滚动">
          {ROLL_DIRECTIONS.map((d) => (
            <button
              key={d}
              data-roll-direction={d}
              disabled={locked}
              onClick={() => act(d)}
              aria-label={`向${ROLL_LABELS[d]}滚动`}
            >
              {ROLL_LABELS[d]}
              <small>落地 {rollFaceLabel(rotateRoll(b.faces, d)[1])}</small>
            </button>
          ))}
        </div>
        <p className="rf-message" role="status">
          {paused
            ? "已暂停。棋盘与朝向保持不变。"
            : won
              ? "已完成。棋盘保留供查看；重来可以再次挑战。"
              : message}
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">空间推理 · 状态规划</span>
        <h3>同一格，六面新方向。</h3>
        <p>{config.lesson}</p>
        <div className="rf-faces" aria-label="当前立方体六面图">
          {b.faces.map((face, i) => (
            <div key={i} className={`rf-face rf-face-${i}`}>
              <small>{facePositions[i]}面</small>
              <b>{rollFaceLabel(face)}</b>
            </div>
          ))}
        </div>
        <p className="rf-target">
          出口条件：底面 {rollFaceLabel(config.exit.bottom)} · 北面{" "}
          {rollFaceLabel(config.exit.north)}
        </p>
        {config.plates.length > 0 && (
          <ul className="rf-plates">
            {config.plates.map((p, i) => (
              <li key={i}>
                {b.plates & (1 << i) ? "✓ 已亮" : "○ 未亮"} · 印 {i + 1}：
                {p.y + 1} 行 {p.x + 1} 列，底面 {rollFaceLabel(p.face)}
              </li>
            ))}
          </ul>
        )}
        {config.gates.length > 0 && (
          <ul>
            {config.gates.map((g, i) => (
              <li key={i}>
                门：{g.y + 1} 行 {g.x + 1} 列，滚入底面 {rollFaceLabel(g.face)}
                {g.needs
                  ? `，需印 ${config.plates
                      .map((_, j) => (g.needs! & (1 << j) ? j + 1 : null))
                      .filter(Boolean)
                      .join("、")}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="note">
          <strong>怎样滚动？</strong>
          <p>
            朝东滚时，东侧面落到底部；朝北滚时，北侧面落到底部。按钮提前显示下一步的落地面。触碰相邻格也可以滚动。
          </p>
          {level === 0 && (
            <p>
              试一遍：开局向东，D 面落地；再向南，E
              面落地。看看同样两步倒过来时，北面会不会相同。
            </p>
          )}
        </div>
        <p className="muted">
          Tab
          进入地图后用方向键。每次只滚一格。暂停、提示、撤销和重来由上方工具栏提供。提示穷尽当前局面可达状态。
        </p>
      </aside>
    </div>
  );
}
