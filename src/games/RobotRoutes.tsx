import { useEffect, useState } from "react";
import { ArrowUp, RotateCcw, RotateCw, Play, Trash2, Flag } from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  robotLevels,
  runProgram,
  commandLabels,
  type Command,
} from "./robotLogic";
export default function RobotRoutes({
  level,
  paused,
  resetToken,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = robotLevels[level];
  const [commands, setCommands] = useState<Command[]>([]);
  const [repeat, setRepeat] = useState(1);
  const [step, setStep] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const result = runProgram(config, commands, repeat);
  const robot = result.frames[Math.min(step ?? 0, result.frames.length - 1)];
  useEffect(() => {
    setCommands([]);
    setRepeat(1);
    setStep(null);
    setRunning(false);
    onStatus("组合指令，然后点击运行。到达橙色旗帜就成功！");
  }, [level, resetToken]);
  useEffect(() => {
    if (hintToken) onStatus(config.hint);
  }, [hintToken]);
  useEffect(() => {
    if (undoToken) {
      setRunning(false);
      setStep(null);
      setCommands((c) => c.slice(0, -1));
    }
  }, [undoToken]);
  useEffect(() => {
    if (!running || paused) return;
    if (step !== null && step >= result.frames.length - 1) {
      setRunning(false);
      if (result.won) {
        onStatus("到达终点！你的小程序成功了。");
        onComplete();
      } else
        onStatus(
          robot.crashed
            ? "碰到障碍或边界了，调整指令再试试。"
            : "程序结束了，还没到终点。可以调整指令或重复次数。",
        );
      return;
    }
    const timer = setTimeout(() => setStep((s) => (s ?? 0) + 1), 400);
    return () => clearTimeout(timer);
  }, [running, paused, step, result.frames.length]);
  const icons = {
    forward: <ArrowUp size={18} />,
    left: <RotateCcw size={18} />,
    right: <RotateCw size={18} />,
  };
  return (
    <div className="puzzle-layout">
      <div
        className="robot-board board"
        style={{
          gridTemplateColumns: `repeat(${config.size},1fr)`,
          gridTemplateRows: `repeat(${config.size},minmax(0,1fr))`,
        }}
      >
        {Array.from({ length: config.size ** 2 }, (_, i) => {
          const x = i % config.size,
            y = Math.floor(i / config.size),
            wall = config.walls.some((w) => w.x === x && w.y === y),
            goal = x === config.goal.x && y === config.goal.y,
            isRobot = x === robot.x && y === robot.y;
          return (
            <div
              key={i}
              className={`robot-cell ${wall ? "wall" : ""} ${goal ? "goal" : ""}`}
              aria-label={`${x + 1} 列 ${y + 1} 行${wall ? " 障碍" : ""}${goal ? " 终点" : ""}`}
            >
              {goal && !isRobot && <Flag size={30} />}
              {isRobot && (
                <span
                  className={`robot-piece ${robot.crashed ? "crashed" : ""}`}
                  style={{ transform: `rotate(${robot.direction * 90}deg)` }}
                  aria-label={`机器人${["向右", "向下", "向左", "向上"][robot.direction]}`}
                >
                  <span>••</span>
                  <b>›</b>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <aside className="program-panel">
        <span className="mini-label">排列 · 循环 · 调试</span>
        <h3>你来编写路线。</h3>
        <div className="command-buttons">
          {(["forward", "left", "right"] as Command[]).map((c) => (
            <button
              key={c}
              disabled={paused || running || commands.length >= 16}
              onClick={() => {
                setStep(null);
                setCommands((cs) => [...cs, c]);
              }}
            >
              {icons[c]}
              {commandLabels[c]}
            </button>
          ))}
        </div>
        <div className="program" aria-label="指令序列">
          {commands.length ? (
            commands.map((c, i) => (
              <button
                key={i}
                disabled={paused || running}
                title="点击删除此指令"
                aria-label={`删除第 ${i + 1} 条${commandLabels[c]}`}
                onClick={() => {
                  setStep(null);
                  setCommands((cs) => cs.filter((_, j) => j !== i));
                }}
              >
                <small>{i + 1}</small>
                {icons[c]}
              </button>
            ))
          ) : (
            <p>点击上方按钮，添加第一条指令</p>
          )}
        </div>
        <label className="repeat-label">
          循环次数{" "}
          <select
            value={repeat}
            disabled={paused || running}
            onChange={(e) => {
              setStep(null);
              setRepeat(Number(e.target.value));
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} 次
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button
            className="primary"
            disabled={paused || running || !commands.length}
            onClick={() => {
              setStep(0);
              setRunning(true);
              onStatus("机器人正在执行指令…");
            }}
          >
            <Play size={18} />
            {running ? "运行中…" : "运行程序"}
          </button>
          <button
            className="icon-button"
            aria-label="清空程序"
            disabled={paused || running}
            onClick={() => {
              setCommands([]);
              setStep(null);
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
        <p className="muted">
          最多 16 条指令。点击已添加的指令可以删除。暂停后会保留执行位置。
        </p>
      </aside>
    </div>
  );
}
