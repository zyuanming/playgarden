import { useState, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  ConstraintCell,
  ConstraintNumberPad,
  useConstraintRound,
} from "./FutoshikiGarden";
import {
  getSkylineHint,
  isSkylineSolved,
  skylineClueState,
  skylineConflicts,
  skylineLevels,
  type SkylineSide,
} from "./skylineLogic";
import SkylineScene from "./SkylineScene";
import "./numberConstraints.css";
const sideNames: Record<SkylineSide, string> = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
};
export default function SkylineGarden(props: GameProps) {
  return <SkylineRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function SkylineRound(props: GameProps) {
  const config = skylineLevels[props.level] ?? skylineLevels[0],
    size = config.size;
  const [view, setView] = useState<{ side: SkylineSide; index: number }>({
    side: "left",
    index: 0,
  });
  const round = useConstraintRound(props, {
    size,
    givens: config.givens,
    introduction: `每行、每列填入 1–${size} 层高楼，各出现一次。四边的数字表示从那边能看见的栋数，高楼会挡住后方矮楼。`,
    celebration: "城市的每条街都排好了，四边的视线也全部匹配。天空花园完成！",
    solved: (values) => isSkylineSolved(config, values),
    conflicts: (values) => skylineConflicts(config, values),
    hint: (values) => getSkylineHint(config, values),
  });
  function clue(side: SkylineSide, index: number) {
    const value = config.clues[side][index],
      state = skylineClueState(config, round.state.values, side, index),
      selected = view.side === side && view.index === index;
    return (
      <button
        key={`${side}:${index}`}
        type="button"
        className={`nc-sky-clue nc-sky-clue-${side} nc-clue-${state} ${selected ? "nc-view-selected" : ""}`}
        style={{
          gridRow:
            side === "top" ? 1 : side === "bottom" ? size + 2 : index + 2,
          gridColumn:
            side === "left" ? 1 : side === "right" ? size + 2 : index + 2,
        }}
        data-skyline-clue={`${side}:${index}`}
        data-clue={value}
        data-clue-state={state}
        aria-pressed={selected}
        disabled={props.paused}
        aria-label={`从${sideNames[side]}看第 ${index + 1} ${side === "top" || side === "bottom" ? "列" : "行"}，${value ? `应看见 ${value} 栋` : "此处没有线索"}${state === "satisfied" ? "，已满足" : state === "conflict" ? "，线索冲突" : ""}，点击预览`}
        onClick={() => setView({ side, index })}
      >
        <span>{value || "·"}</span>
        <small aria-hidden="true">
          {state === "satisfied"
            ? "✓"
            : state === "conflict"
              ? "!"
              : { top: "↓", right: "←", bottom: "↑", left: "→" }[side]}
        </small>
      </button>
    );
  }
  return (
    <div
      className="puzzle-layout nc-game"
      data-number-constraint="skyline"
      onKeyDown={round.keyboard}
    >
      <section className="nc-play-area" aria-label="天空花园游戏">
        <div className="nc-heading">
          <div>
            <span className="mini-label">
              CITY OF SIGHT · {size} × {size}
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="nc-level">
            {String(props.level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="nc-toolbar">
          <span>楼高各一次</span>
          <span>
            {round.state.values.filter(Boolean).length} / {size * size} 栋
          </span>
        </div>
        <div
          className={`nc-skyline-board ${round.won ? "nc-won" : ""}`}
          style={{ "--nc-size": size } as CSSProperties}
          role="group"
          aria-label="天空花园棋盘"
        >
          {(["top", "right", "bottom", "left"] as const).flatMap((side) =>
            Array.from({ length: size }, (_, i) => clue(side, i)),
          )}
          {round.state.values.map((_, index) => (
            <ConstraintCell
              key={index}
              round={round}
              size={size}
              index={index}
              given={!!config.givens[index]}
              game="skyline"
              style={{
                gridRow: Math.floor(index / size) + 2,
                gridColumn: (index % size) + 2,
              }}
            />
          ))}
        </div>
        <div className="nc-board-footer">
          <span>
            {round.won
              ? "四边视线全部正确 ✓"
              : round.conflicts.length
                ? `${round.conflicts.length} 格需要检查 !`
                : "点四边的数字切换城市视角"}
          </span>
          <span>· 表示无要求</span>
        </div>
        <ConstraintNumberPad round={round} size={size} />
      </section>
      <aside className="game-notes nc-guide">
        <span className="mini-label">观察 · 遮挡 · 空间</span>
        <h3>看见城市的秩序。</h3>
        <p>
          每行、每列恰好包含 1–{size}{" "}
          层高楼。站在边缘往里看，每遇到一栋比前面所有楼都高的楼，就多看见一栋。
        </p>
        <div className="note">
          <strong>同一条街，两种视线</strong>
          <p>
            1、3、2 从左看能见 2 栋，从右看也能见 2 栋。边上写 1
            时，最高楼一定在最前面；写 {size} 时，楼高要由矮到高排列。
          </p>
        </div>
        <SkylineScene
          level={config}
          values={round.state.values}
          side={view.side}
          index={view.index}
          paused={props.paused}
        />
        <p className="muted">
          方向键选择可填格；1–{size} 填写；Delete / Backspace 清空；N
          切换笔记。深色固定楼不能修改。3D 仅供观察，所有操作都在平面棋盘完成。
        </p>
      </aside>
    </div>
  );
}
