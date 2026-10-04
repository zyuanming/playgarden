import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  hanoiLevels,
  hanoiWon,
  moveDisk,
  solveHanoi,
  type Pegs,
} from "./hanoiLogic";
import "./gardenStrategy.css";
export default function HanoiTowers({
  level,
  paused,
  resetToken,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = hanoiLevels[level];
  const [pegs, setPegs] = useState<Pegs>(config.start);
  const [history, setHistory] = useState<Pegs[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const won = hanoiWon(pegs, config.disks, config.goal);
  useEffect(() => {
    setPegs(config.start);
    setHistory([]);
    setSelected(null);
    onStatus(
      `把所有圆盘搬到 ${config.goal + 1} 号柱。一次只移动最上面的圆盘，大盘不能压在小盘上。`,
    );
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) {
      const step = solveHanoi(pegs, config.goal)[0];
      onStatus(
        step
          ? `下一步可以把 ${step.from + 1} 号柱最上面的圆盘移到 ${step.to + 1} 号柱。先选起点，再选终点。`
          : "所有圆盘已经整齐到达终点。",
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (undoToken)
      setHistory((h) => {
        if (h.length) setPegs(h[h.length - 1]);
        setSelected(null);
        return h.slice(0, -1);
      });
  }, [undoToken]);
  useEffect(() => {
    if (won) {
      onStatus(
        `小塔搬家成功！用了 ${history.length} 步，这一关的最短路线是 ${config.solution.length} 步。`,
      );
      onComplete();
    }
  }, [won]);
  function choose(index: number) {
    if (paused || won) return;
    if (selected === null) {
      if (!pegs[index].length) {
        onStatus("这根柱子是空的。先选择有圆盘的柱子。");
        return;
      }
      setSelected(index);
      onStatus(
        `已选择 ${index + 1} 号柱的 ${pegs[index].at(-1)} 号圆盘。请选择目标柱。`,
      );
      return;
    }
    if (index === selected) {
      setSelected(null);
      return;
    }
    const next = moveDisk(pegs, selected, index);
    if (!next) {
      onStatus("这一步不合法：大盘不能放在小盘上。可以换一根目标柱。");
      return;
    }
    setHistory((h) => [...h, pegs]);
    setPegs(next);
    setSelected(null);
    onStatus(`移动完成。已经移动 ${history.length + 1} 步。`);
  }
  return (
    <div className="puzzle-layout strategy-layout">
      <div className="hanoi-area">
        <div className="strategy-stats">
          <span>{config.title}</span>
          <span>{history.length} 步</span>
        </div>
        <div className="hanoi-board">
          {pegs.map((peg, index) => (
            <button
              key={index}
              className={`hanoi-peg ${selected === index ? "selected" : ""} ${config.goal === index ? "target" : ""}`}
              disabled={paused || won}
              aria-label={`${index + 1} 号柱${config.goal === index ? "，目标柱" : ""}，${peg.length ? `从下到上圆盘 ${peg.join("、")}` : "空柱"}`}
              aria-pressed={selected === index}
              onClick={() => choose(index)}
            >
              <span className="hanoi-pole" />
              <span className="hanoi-disks">
                {peg.map((disk) => (
                  <span
                    key={disk}
                    className={`hanoi-disk disk-${disk}`}
                    style={{ width: `${28 + (disk / config.disks) * 65}%` }}
                  >
                    {disk}
                  </span>
                ))}
              </span>
              <span className="hanoi-label">
                {index + 1} 号柱
                {config.goal === index && <ArrowRight size={16} />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <aside className="game-notes">
        <span className="mini-label">规划 · 递归 · 耐心</span>
        <h3>给圆盘搬个家。</h3>
        <p>
          点击一根柱子选择最上面的圆盘，再点击另一根柱子移动。再次点击起点可以取消选择。
        </p>
        <div className="note">
          <strong>拆成小问题</strong>
          <p>
            想搬走大圆盘，先为小圆盘找到临时位置。三根柱子都可以当作中转站。
          </p>
        </div>
        <p className="muted">
          不计时，也不限制步数。提示会根据当前盘面重新规划，撤销可以恢复上一步。
        </p>
      </aside>
    </div>
  );
}
