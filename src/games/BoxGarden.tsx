import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { GameProps } from "../lib/types";
import {
  boxDirectionFromKey,
  boxHasCornerDeadlock,
  boxLevels,
  boxNeighbor,
  boxSolved,
  createBoxState,
  moveBox,
  searchBoxSolution,
  undoBox,
} from "./boxLogic";
import type { BoxDirection } from "./boxLogic";
import "./gridDeduction.css";

const directions: { direction: BoxDirection; label: string; arrow: string }[] =
  [
    { direction: "U", label: "向上移动", arrow: "↑" },
    { direction: "L", label: "向左移动", arrow: "←" },
    { direction: "D", label: "向下移动", arrow: "↓" },
    { direction: "R", label: "向右移动", arrow: "→" },
  ];
export default function BoxGarden(props: GameProps) {
  return <BoxRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function BoxRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = boxLevels[level] ?? boxLevels[0];
  const [state, setState] = useState(() => createBoxState(config));
  const [hint, setHint] = useState<BoxDirection | null>(null);
  const [hintText, setHintText] = useState("");
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const won = boxSolved(config, state);
  const atHome = state.boxes.filter((box) => config.goals.includes(box)).length;
  const deadlock = boxHasCornerDeadlock(config, state.boxes);

  useEffect(() => {
    callbacks.current.onStatus(
      "用方向键或下方箭头移动，把每只木箱推到圆圈上。箱子只能推，不能拉。",
    );
  }, []);
  useEffect(() => {
    if (!won || paused || notified.current) return;
    notified.current = true;
    callbacks.current.onStatus(
      `所有礼物都送到了！走了 ${state.moves} 步，推箱 ${state.pushes} 次。`,
    );
    callbacks.current.onComplete();
  }, [won, paused, state.moves, state.pushes]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const result = searchBoxSolution(config, state);
    const next = result.solution?.[0] ?? null;
    setHint(next);
    const text =
      result.status === "deadlock"
        ? "当前箱子已无法全部到家。撤销最近的推箱动作，或重新开始；箱子不能从墙角拉回来。"
        : result.status === "limit"
          ? "这条绕路需要更多推演。可以先撤销最近的推箱动作，再试试提示。"
          : `下一步${directions.find((item) => item.direction === next)?.label ?? "继续"}。这是从当前局面出发的一条最短路线，还需 ${result.solution!.length} 步。`;
    setHintText(text);
    callbacks.current.onStatus(text);
  }, [hintToken, paused, won, config, state]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((current) => undoBox(current));
    setHint(null);
    setHintText("");
    callbacks.current.onStatus(
      state.history.length
        ? "已退回一步，箱子和搬运员一起恢复原位。"
        : "还没有走动，可以先观察箱子和圆圈。",
    );
  }, [undoToken, paused, state.history.length]);

  function move(direction: BoxDirection) {
    if (paused || won) return;
    const next = moveBox(config, state, direction);
    if (next === state) {
      callbacks.current.onStatus(
        "这里走不通：不能穿墙，也不能同时推动两只箱子。试试绕到另一侧。",
      );
      return;
    }
    setState(next);
    setHint(null);
    setHintText("");
    callbacks.current.onStatus(
      boxHasCornerDeadlock(config, next.boxes)
        ? "箱子被推到非目标墙角了。可以撤销这一步，换个方向试试。"
        : next.pushes > state.pushes
          ? "箱子向前一步。继续给自己留出绕到箱子背后的路。"
          : "绕到箱子后面，再把它推向圆圈。",
    );
  }
  function stepTo(cell: number) {
    if (paused || won) return;
    const direction = directions.find(
      (item) => boxNeighbor(config, state.player, item.direction) === cell,
    )?.direction;
    if (direction) move(direction);
    else
      callbacks.current.onStatus(
        "点搬运员上下左右相邻的一格，或使用下方方向按钮。",
      );
  }
  function handleKey(event: KeyboardEvent) {
    const direction = boxDirectionFromKey(event.key);
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    move(direction);
  }
  return (
    <div className="gd-layout" data-grid-game="boxes">
      <section className="gd-play-area" aria-label="推箱花园游戏">
        <div className="gd-heading">
          <div>
            <span className="gd-eyebrow">
              BOX GARDEN · {config.boxes.length} 只木箱
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="gd-level">
            {String(level + 1).padStart(2, "0")} / 12
          </span>
        </div>
        <div className="gd-stats" aria-live="polite">
          <span>
            <strong>{atHome}</strong> / {config.goals.length} 到家
          </span>
          <span>
            <strong>{state.moves}</strong> 步 · {state.pushes} 次推箱
          </span>
          <span>{paused ? "已暂停" : won ? "全部送达 ✓" : "不急，想一想"}</span>
        </div>
        <div className={`gd-box-wrap ${paused ? "is-paused" : ""}`}>
          <div
            className={`gd-box-board ${won ? "is-won" : ""}`}
            role="group"
            aria-label="推箱棋盘，方向键或 WASD 移动"
            tabIndex={0}
            style={{ "--gd-width": config.width } as CSSProperties}
            onKeyDown={handleKey}
          >
            {Array.from(
              { length: config.width * config.height },
              (_, index) => {
                const wall = config.walls.includes(index),
                  goal = config.goals.includes(index),
                  box = state.boxes.includes(index),
                  player = state.player === index;
                const label = `第 ${Math.floor(index / config.width) + 1} 行第 ${(index % config.width) + 1} 列，${wall ? "花墙" : player ? `搬运员${goal ? "，在目标上" : ""}` : box ? `木箱${goal ? "，已到目标" : ""}` : goal ? "目标圆圈" : "空地"}`;
                const hinted =
                  hint &&
                  boxNeighbor(config, state.player, hint) === index &&
                  !paused;
                return wall ? (
                  <div key={index} className="gd-box-wall" aria-label={label}>
                    <span aria-hidden="true" />
                  </div>
                ) : (
                  <button
                    key={index}
                    type="button"
                    className={`gd-box-cell ${goal ? "is-goal" : ""} ${hinted ? "is-hinted" : ""}`}
                    data-box-cell={index}
                    data-player={player ? "true" : undefined}
                    data-box={box ? "true" : undefined}
                    aria-label={label}
                    disabled={paused || won}
                    tabIndex={-1}
                    onClick={() => stepTo(index)}
                  >
                    {goal && (
                      <span className="gd-goal-ring" aria-hidden="true" />
                    )}
                    {box && (
                      <span
                        className={`gd-crate ${goal ? "is-delivered" : ""}`}
                        aria-hidden="true"
                      >
                        <i />
                        <span>{goal ? "✓" : ""}</span>
                      </span>
                    )}
                    {player && (
                      <span className="gd-gardener" aria-hidden="true">
                        <i />
                        <span />
                      </span>
                    )}
                    {hinted && (
                      <span className="gd-direction-hint" aria-hidden="true">
                        {
                          directions.find((item) => item.direction === hint)
                            ?.arrow
                        }
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>
          {paused && (
            <div className="gd-pause-cover">
              暂停中<span>箱子会在原地等你</span>
            </div>
          )}
        </div>
        <div className="gd-board-caption">
          <span>
            {deadlock && !won
              ? "墙角卡住了？撤销就好。"
              : "圆圈是终点 · 木箱不能拉"}
          </span>
          <span>起点最少 {config.solution.length} 步</span>
        </div>
        <div
          className="gd-direction-pad"
          role="group"
          aria-label="触屏方向控制"
          onKeyDown={handleKey}
        >
          {directions.map((item) => (
            <button
              key={item.direction}
              type="button"
              aria-label={item.label}
              data-direction={item.direction}
              className={`${item.direction === "U" ? "gd-up" : ""} ${hint === item.direction && !paused ? "is-hinted" : ""}`}
              disabled={paused || won}
              onClick={() => move(item.direction)}
            >
              <span aria-hidden="true">{item.arrow}</span>
            </button>
          ))}
        </div>
        {hintText && !paused && !won && (
          <div className="gd-hint-card" role="status">
            <strong>{hint ? "下一步有方向" : "换一条路线"}</strong>
            <p>{hintText}</p>
          </div>
        )}
      </section>
      <aside className="gd-notes">
        <span className="gd-eyebrow">空间 · 顺序 · 留出余地</span>
        <h3>
          让每份礼物，
          <br />
          都找到位置。
        </h3>
        <p>
          {config.lesson}{" "}
          小圆点是搬运员，木箱上的对角木条方便辨认，地上的圆圈是终点。
        </p>
        <div
          className="gd-box-demo"
          aria-label="搬运员站在木箱后面，推动木箱到目标"
        >
          <span className="gd-gardener" aria-hidden="true">
            <i />
            <span />
          </span>
          <b aria-hidden="true">→</b>
          <span className="gd-crate" aria-hidden="true">
            <i />
          </span>
          <b aria-hidden="true">→</b>
          <span className="gd-goal-ring" aria-hidden="true" />
        </div>
        <div className="gd-note">
          <strong>先想：推完之后怎么绕回来？</strong>
          <p>
            只能向前推一只箱子。把箱子推到没有圆圈的墙角，会卡住；撤销能同时恢复箱子和搬运员。
          </p>
        </div>
        <p className="gd-keyboard">
          触屏用方向按钮，也可以点相邻格子。键盘先点击棋盘，再用方向键或
          WASD。提示会从当前局面重新规划，不会照抄起点路线。
        </p>
      </aside>
    </div>
  );
}
