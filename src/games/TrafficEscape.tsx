import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  createTrafficState,
  isTrafficSolved,
  legalTrafficMoves,
  solveTraffic,
  trafficLevels,
  trafficMove,
  trafficMoveLabel,
  undoTraffic,
  type TrafficMove,
} from "./trafficLogic";
import "./mergeEscape.css";

const carColors = [
  "#dafa3b",
  "#c1d8c0",
  "#eac4a7",
  "#c9c1e7",
  "#f3d889",
  "#a9cdca",
  "#e6bdbf",
  "#d7dfb4",
  "#bfd1e8",
  "#e2cfb8",
  "#c9dfd1",
  "#d9c1d9",
];
export default function TrafficEscape(props: GameProps) {
  return <TrafficRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function TrafficRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = trafficLevels[level] ?? trafficLevels[0];
  const [state, setState] = useState(() => createTrafficState(config));
  const [selected, setSelected] = useState("T");
  const [hint, setHint] = useState<TrafficMove | null>(null);
  const [feedback, setFeedback] = useState(
    "先选一辆车，再点方向和格数。把小绿送到右侧出口！",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const won = isTrafficSolved(state.positions);
  const legal = legalTrafficMoves(config, state.positions),
    options = legal.filter((move) => move.vehicle === selected);
  const selectedVehicle = config.vehicles.find(
    (vehicle) => vehicle.id === selected,
  )!;
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `小绿顺利出发！你用了 ${state.history.length} 步，本关最少 ${config.par} 步。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused, state.history.length, config.par]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const route = solveTraffic(config, state.positions),
      next = route?.[0];
    if (next) {
      setSelected(next.vehicle);
      setHint(next);
      setFeedback(
        `试着让${next.vehicle === "T" ? "小绿" : `车辆 ${next.vehicle}`} ${trafficMoveLabel(config, state.positions, next)}。从现在出发，最少还需要 ${route!.length} 步。`,
      );
    } else setFeedback("这一局暂时找不到出口路线，试试撤销或重来。");
  }, [hintToken, paused, won, config, state.positions]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    setState((current) => undoTraffic(current));
    setHint(null);
    setFeedback(
      state.history.length
        ? "已把上一辆车放回原位。换一个顺序试试。"
        : "还没有可以撤销的移动。",
    );
  }, [undoToken, paused, state.history.length]);
  function move(candidate: TrafficMove) {
    if (paused || won) return;
    if (
      !legal.some(
        (move) =>
          move.vehicle === candidate.vehicle && move.steps === candidate.steps,
      )
    ) {
      setFeedback("这条路被挡住了。只能沿着车辆朝向，在空格里直线移动。");
      return;
    }
    setState((current) => trafficMove(current, config, candidate));
    setHint(null);
    setFeedback(
      `${candidate.vehicle === "T" ? "小绿" : `车辆 ${candidate.vehicle}`}已移动。一次直线滑动，无论几格都算一步。`,
    );
  }
  function choose(vehicle: string) {
    if (paused || won) return;
    setSelected(vehicle);
    setHint(null);
    setFeedback(
      `已选中${vehicle === "T" ? "小绿" : `车辆 ${vehicle}`}。请选择下面的移动方向和格数。`,
    );
  }
  return (
    <div className="puzzle-layout me-game traffic-escape" data-game="traffic">
      <section className="me-playfield" aria-label="花园疏导挑战">
        <header className="me-heading">
          <div>
            <span className="mini-label">
              TRAFFIC ESCAPE · 第 {level + 1} / 12 关
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="me-round-icon" aria-hidden="true">
            ↗
          </span>
        </header>
        <div className="traffic-stats">
          <span>
            <b data-traffic-moves>{state.history.length}</b> 步
          </span>
          <span>
            最短路线 <b>{config.par}</b> 步
          </span>
          <span className="traffic-target-chip">小绿先走</span>
        </div>
        <div className="traffic-board-wrap">
          <div
            className={`traffic-board ${won ? "me-board-won" : ""}`}
            role="group"
            aria-label="六乘六停车场，选车后用方向键移动"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              if (paused || won) return;
              const index = config.vehicles.findIndex(
                  (vehicle) => vehicle.id === selected,
                ),
                vehicle = config.vehicles[index];
              const axis =
                event.key === "ArrowLeft" || event.key === "ArrowRight"
                  ? "h"
                  : "v";
              if (vehicle.axis !== axis) {
                setFeedback("这辆车不能横着转弯，只能沿着自己的朝向前后移动。");
                return;
              }
              const sign =
                event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
              const available = options.filter(
                (move) => Math.sign(move.steps) === sign,
              );
              const next = event.shiftKey ? available.at(-1) : available[0];
              if (next) move(next);
              else setFeedback("这个方向被挡住了。先给别的车挪出空间。");
            }}
          >
            {Array.from({ length: 36 }, (_, index) => (
              <span
                key={`cell-${index}`}
                className={`traffic-cell ${Math.floor(index / 6) === 2 ? "traffic-exit-lane" : ""}`}
                aria-hidden="true"
                style={{
                  gridRow: Math.floor(index / 6) + 1,
                  gridColumn: (index % 6) + 1,
                }}
              />
            ))}
            {config.vehicles.map((vehicle, index) => {
              if (index === 0 && won) return null;
              const horizontal = vehicle.axis === "h",
                x = horizontal ? state.positions[index] : vehicle.fixed,
                y = horizontal ? vehicle.fixed : state.positions[index];
              return (
                <button
                  type="button"
                  key={vehicle.id}
                  data-vehicle={vehicle.id}
                  data-position={state.positions[index]}
                  className={`traffic-car ${horizontal ? "traffic-horizontal" : "traffic-vertical"} ${index === 0 ? "traffic-hero" : ""} ${selected === vehicle.id ? "traffic-selected" : ""} ${hint?.vehicle === vehicle.id && !paused ? "me-hinted" : ""}`}
                  style={
                    {
                      gridColumn: `${x + 1} / span ${horizontal ? vehicle.length : 1}`,
                      gridRow: `${y + 1} / span ${horizontal ? 1 : vehicle.length}`,
                      "--car-color": carColors[index % carColors.length],
                    } as CSSProperties
                  }
                  disabled={paused || won}
                  aria-pressed={selected === vehicle.id}
                  aria-label={`${index === 0 ? "小绿，目标车" : `车辆 ${vehicle.id}`}，${horizontal ? "横向" : "纵向"} ${vehicle.length} 格，第 ${y + 1} 行第 ${x + 1} 列${selected === vehicle.id ? "，已选择" : ""}`}
                  onFocus={() => {
                    if (!paused && !won) setSelected(vehicle.id);
                  }}
                  onClick={() => choose(vehicle.id)}
                >
                  <i className="traffic-window" aria-hidden="true" />
                  <b>{index === 0 ? "小绿" : vehicle.id}</b>
                  <i className="traffic-car-arrow" aria-hidden="true">
                    {horizontal ? "↔" : "↕"}
                  </i>
                </button>
              );
            })}
            {won && (
              <div className="traffic-celebration" aria-hidden="true">
                <span>✦</span>
                <b>一路顺风！</b>
              </div>
            )}
          </div>
          <span className="traffic-exit" aria-label="第三行右侧出口">
            出口
            <br />
            <b>→</b>
          </span>
        </div>
        <div className="traffic-control-panel" aria-label="车辆移动按钮">
          <div className="traffic-selection">
            <b>{selected === "T" ? "小绿" : `车辆 ${selected}`}</b>
            <span>
              {selectedVehicle.axis === "h" ? "左右移动" : "上下移动"}
            </span>
          </div>
          <div className="traffic-move-options">
            {options.length ? (
              options.map((candidate) => (
                <button
                  type="button"
                  key={`${candidate.vehicle}:${candidate.steps}`}
                  data-traffic-step={candidate.steps}
                  data-traffic-for={candidate.vehicle}
                  className={
                    hint?.vehicle === candidate.vehicle &&
                    hint.steps === candidate.steps &&
                    !paused
                      ? "me-hinted"
                      : ""
                  }
                  disabled={paused || won}
                  onClick={() => move(candidate)}
                >
                  {trafficMoveLabel(config, state.positions, candidate)}
                </button>
              ))
            ) : (
              <p>
                {won
                  ? "小绿已经驶出花园。"
                  : "前后都被挡住了，先挪开另一辆车。"}
              </p>
            )}
          </div>
        </div>
        <p className="me-feedback" role="status" aria-live="polite">
          {paused ? "已暂停，车辆正在休息。" : feedback}
        </p>
      </section>
      <aside className="game-notes me-notes">
        <span className="mini-label">空间 · 顺序 · 交通小规划</span>
        <h3>
          借一片空地，
          <br />
          给小绿一条路。
        </h3>
        <div className="me-objective">
          <small>本关目标</small>
          <p className="traffic-goal-copy">
            把绿色小车送到
            <br />
            <b>第三行右侧出口 →</b>
          </p>
        </div>
        <ol className="me-instructions">
          <li>
            <b>先点车，再选怎么走</b>
            <span>
              横车只能左右，竖车只能上下。车不能转向、穿过彼此或挪到场外。
            </span>
          </li>
          <li>
            <b>一次走多格也算一步</b>
            <span>
              下方按钮列出每个可到达的位置。小绿通路清空后，点“驶出花园”。
            </span>
          </li>
          <li>
            <b>绕过路也有新提示</b>
            <span>
              提示会从当前停车场重新求最短路线，不会让你照搬已经过时的步骤。
            </span>
          </li>
        </ol>
        <div className="note me-tip">
          <strong>这一关的观察笔记</strong>
          <p>{config.lesson}</p>
        </div>
        <p className="me-keyboard">
          Tab 选车，Enter / 空格确认。方向键移动一格，Shift +
          方向键移动到尽头。不限时，可以撤销。
        </p>
      </aside>
    </div>
  );
}
