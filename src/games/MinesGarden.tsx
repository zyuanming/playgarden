import { useEffect, useState } from "react";
import { Flag, Flower2 } from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  minesLevels,
  revealCell,
  toggleFlag,
  adjacentMines,
  minesWon,
  logicStep,
  type MinesState,
} from "./minesLogic";
import "./gardenStrategy.css";
export default function MinesGarden({
  level,
  paused,
  resetToken,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = minesLevels[level],
    initial = () =>
      revealCell(
        config,
        { revealed: [], flags: [], failed: false },
        config.start,
      );
  const [state, setState] = useState<MinesState>(initial);
  const [history, setHistory] = useState<MinesState[]>([]);
  const [mode, setMode] = useState<"reveal" | "flag">("reveal");
  const won = minesWon(config, state);
  useEffect(() => {
    setState(initial());
    setHistory([]);
    setMode("reveal");
    onStatus(
      "数字表示周围八格藏着几块石头。标记石头，找出所有安全的花园格子。",
    );
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) {
      const step = logicStep(config, state);
      onStatus(
        step
          ? `观察第 ${Math.floor(step.reason / config.size) + 1} 行、第 ${(step.reason % config.size) + 1} 列的数字：可以${step.kind === "flag" ? "标记" : "探索"}第 ${Math.floor(step.index / config.size) + 1} 行、第 ${(step.index % config.size) + 1} 列。`
          : "先检查旗帜是否都有数字依据。也可以撤销上一步，重新推理。",
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (undoToken)
      setHistory((h) => {
        if (h.length) {
          setState(h[h.length - 1]);
          onStatus("已回到上一步。再观察一下数字。");
        }
        return h.slice(0, -1);
      });
  }, [undoToken]);
  useEffect(() => {
    if (won) {
      onStatus("花园全部探索完成！每一格安全区域都找到了。");
      onComplete();
    }
  }, [won]);
  function act(index: number) {
    if (paused || won || state.failed) return;
    const next =
      mode === "flag"
        ? toggleFlag(state, index)
        : revealCell(config, state, index);
    if (next === state) return;
    setHistory((h) => [...h, state]);
    setState(next);
    if (next.failed)
      onStatus("这里藏着一块石头。可以撤销这一步，继续根据数字推理。");
  }
  return (
    <div className="puzzle-layout strategy-layout">
      <div>
        <div className="strategy-stats">
          <span>{config.title}</span>
          <span>
            已找到 {state.revealed.length}/
            {config.size ** 2 - config.mines.length} 格
          </span>
        </div>
        <div className="mines-modes">
          <button
            aria-pressed={mode === "reveal"}
            className={mode === "reveal" ? "primary" : ""}
            disabled={paused || won}
            onClick={() => setMode("reveal")}
          >
            <Flower2 size={18} />
            探索
          </button>
          <button
            aria-pressed={mode === "flag"}
            className={mode === "flag" ? "primary" : ""}
            disabled={paused || won}
            onClick={() => setMode("flag")}
          >
            <Flag size={18} />
            标记石头
          </button>
        </div>
        <div
          className="mines-board"
          style={{
            gridTemplateColumns: `repeat(${config.size},minmax(0,1fr))`,
          }}
        >
          {Array.from({ length: config.size ** 2 }, (_, index) => {
            const open = state.revealed.includes(index),
              flag = state.flags.includes(index),
              count = open ? adjacentMines(config, index) : 0,
              stone = state.failed && config.mines.includes(index);
            return (
              <button
                key={index}
                disabled={paused || won || state.failed || open}
                className={`${open ? "open" : ""} ${flag ? "flagged" : ""} ${stone ? "stone" : ""} count-${count}`}
                aria-label={`第 ${Math.floor(index / config.size) + 1} 行第 ${(index % config.size) + 1} 列，${open ? (count ? `周围 ${count} 块石头` : "安全空地") : flag ? "已标记" : "未探索"}`}
                onClick={() => act(index)}
              >
                {stone ? (
                  "●"
                ) : flag ? (
                  <Flag size={18} />
                ) : open ? (
                  count || <Flower2 size={16} />
                ) : (
                  ""
                )}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="game-notes">
        <span className="mini-label">观察 · 排除 · 证据</span>
        <h3>做一位花园侦探。</h3>
        <p>
          这里的“扫雷”是一场安全的纸上推理：用数字找出藏着的石头，不需要猜运气。
        </p>
        <div className="note">
          <strong>两条推理规则</strong>
          <p>
            数字周围的石头都已标记，剩下的格子就安全。如果未探索的格子数正好等于剩余石头数，这些格子都应标记。
          </p>
        </div>
        <p className="muted">
          每个关卡都经过“不猜测”解法验证。触屏先选择探索或标记模式，再点格子。碰到石头可以撤销。
        </p>
      </aside>
    </div>
  );
}
