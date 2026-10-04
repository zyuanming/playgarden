import { useEffect, useRef, useState } from "react";
import {
  Flower2,
  Circle,
  Bell,
  Wind,
  Droplets,
  Sprout,
  Flag,
  Music,
  Sailboat,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import type { GameProps } from "../lib/types";
import {
  createRiverState,
  riverLevels,
  riverMove,
  riverMoveLabel,
  riverMoveProblem,
  riverWon,
  solveRiver,
  undoRiver,
  type RiverBank,
} from "./riverLogic";
import "./transferPlanning.css";

const itemIcons = [Flower2, Circle, Bell, Wind, Droplets, Sprout, Flag, Music];
export default function RiverCrossingGarden(props: GameProps) {
  return <RiverRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function RiverRound({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const config = riverLevels[level] ?? riverLevels[0];
  const [state, setState] = useState(() => createRiverState(config));
  const current = useRef(state);
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const [hinted, setHinted] = useState(false);
  const [feedback, setFeedback] = useState(
    "把所有伙伴和园丁送到右岸。先选同行伙伴，再点击开船；也可以让园丁独自返航。",
  );
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const won = riverWon(config, state.board);
  function selection(items: number[]) {
    selectedRef.current = items;
    setSelected(items);
  }
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `全员到达花园！航行 ${state.history.length} 次，本关最短 ${config.par} 次。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused, state.history.length, config.par]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused) return;
    const route = solveRiver(config, current.current.board);
    if (route?.length) {
      selection(route[0]);
      setHinted(true);
      setFeedback(
        `下一步：${riverMoveLabel(config, current.current.board, route[0])}。已选好同行伙伴，点击开船。从现在最少还需 ${route.length} 次。`,
      );
    } else
      setFeedback(
        route
          ? "园丁和所有伙伴都已到达右岸。"
          : "当前安排无法到达目标，请撤销或重来。",
      );
  }, [hintToken, paused, config]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused) return;
    const previous = current.current;
    const next = undoRiver(previous);
    current.current = next;
    setState(next);
    selection([]);
    setHinted(false);
    setFeedback(
      next === previous
        ? "还没有可以撤销的航行。"
        : "已恢复上次开船前的位置，同行选择已清空。",
    );
  }, [undoToken, paused]);
  function toggle(index: number) {
    if (paused || riverWon(config, current.current.board)) return;
    if (current.current.board.positions[index] !== current.current.board.boat) {
      setFeedback("先把船划到伙伴所在的岸，才能接上这位伙伴。");
      return;
    }
    const old = selectedRef.current;
    if (old.includes(index)) selection(old.filter((i) => i !== index));
    else {
      if (old.length === config.capacity) {
        setFeedback(
          `船位满了：最多带 ${config.capacity} 位伙伴。先取消一位再选择。`,
        );
        return;
      }
      selection([...old, index].sort((a, b) => a - b));
    }
    setHinted(false);
    setFeedback(
      `已选 ${selectedRef.current.length} / ${config.capacity} 位。${selectedRef.current.length ? "点击开船才会移动。" : "现在开船，园丁会独自过河。"}`,
    );
  }
  function sail(expectedBank: RiverBank) {
    if (
      paused ||
      riverWon(config, current.current.board) ||
      current.current.board.boat !== expectedBank
    )
      return;
    const passengers = selectedRef.current;
    const problem = riverMoveProblem(config, current.current.board, passengers);
    if (problem) {
      setFeedback(problem);
      return;
    }
    const label = riverMoveLabel(config, current.current.board, passengers);
    const next = riverMove(current.current, config, passengers);
    current.current = next;
    setState(next);
    selection([]);
    setHinted(false);
    setFeedback(
      `${label}，平安到岸。园丁所在岸可以照看所有伙伴；另一岸仍要遵守搭档规则。`,
    );
  }
  return (
    <div className="puzzle-layout tp-game river-crossing-garden">
      <section className="tp-playfield" aria-label="花园摆渡挑战">
        <header className="tp-heading">
          <div>
            <span className="mini-label">
              RIVER CROSSING · {level + 1} / 12
            </span>
            <h3>{config.title}</h3>
          </div>
          <Sailboat size={32} aria-hidden="true" />
        </header>
        <div className="tp-stats">
          <span>
            <b data-river-moves>{state.history.length}</b> 次航行
          </span>
          <span>
            最短 <b>{config.par}</b> 次
          </span>
          <span>{config.capacity} 个伙伴座位</span>
        </div>
        <div
          className="tp-river-board"
          role="group"
          aria-label="花园两岸，数字选择伙伴，回车开船"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
              return;
            if (
              /^[1-8]$/.test(event.key) &&
              Number(event.key) <= config.items.length
            ) {
              event.preventDefault();
              toggle(Number(event.key) - 1);
            }
            if (event.key === "Enter" && event.target === event.currentTarget) {
              event.preventDefault();
              sail(state.board.boat);
            }
          }}
        >
          <div className="tp-banks">
            {([0, 1] as const).map((bank) => (
              <div
                className={`tp-bank ${state.board.boat === bank ? "tp-attended" : ""}`}
                key={bank}
                data-river-bank={bank}
              >
                <header>
                  <strong>{bank === 0 ? "左岸 · 出发" : "右岸 · 花园"}</strong>
                  <span>
                    {state.board.boat === bank ? "园丁在这里" : "无人照看"}
                  </span>
                </header>
                <div className="tp-bank-items">
                  {config.items.map((name, i) => {
                    if (state.board.positions[i] !== bank) return null;
                    const Icon = itemIcons[i];
                    return (
                      <button
                        type="button"
                        key={i}
                        data-river-item={i}
                        data-bank={bank}
                        aria-label={`${i + 1} 号${name}，${bank === 0 ? "左" : "右"}岸${selected.includes(i) ? "，已选同行" : ""}`}
                        aria-pressed={selected.includes(i)}
                        className={`tp-river-item ${selected.includes(i) ? "tp-selected" : ""}`}
                        disabled={paused || won || bank !== state.board.boat}
                        onClick={() => toggle(i)}
                      >
                        <Icon size={24} aria-hidden="true" />
                        <span>
                          {name}
                          <small>
                            {i + 1} 号 {selected.includes(i) ? "· 同行" : ""}
                          </small>
                        </span>
                        {selected.includes(i) && (
                          <Check size={15} aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                  {!state.board.positions.includes(bank) && (
                    <p className="tp-empty-bank">
                      {bank === 0 ? "都出发啦" : "等你来花园"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            className={`tp-river ${state.board.boat === 1 ? "tp-river-right" : ""}`}
            data-river-boat={state.board.boat}
            aria-label={`船和园丁在${state.board.boat === 0 ? "左" : "右"}岸`}
          >
            <span className="tp-river-wave" aria-hidden="true">
              ∿ ∿ ∿ ∿ ∿ ∿ ∿ ∿
            </span>
            <div className="tp-boat">
              <Sailboat size={28} aria-hidden="true" />
              <div>
                <b>园丁的小船</b>
                <span>
                  {selected.length
                    ? selected.map((i) => config.items[i]).join("、")
                    : "可以独自开船"}
                </span>
              </div>
            </div>
          </div>
          <div className="tp-action-panel">
            <p>
              <b>
                同行 {selected.length} / {config.capacity}
              </b>
              <span>园丁另有座位</span>
            </p>
            <div className="tp-actions">
              <button
                type="button"
                data-river-sail
                className={`tp-sail ${hinted && !paused ? "tp-hinted" : ""}`}
                disabled={paused || won}
                onClick={(event) => {
                  if (event.detail <= 1) sail(state.board.boat);
                }}
              >
                开船到{state.board.boat === 0 ? "右" : "左"}岸{" "}
                {state.board.boat === 0 ? (
                  <ArrowRight size={18} aria-hidden="true" />
                ) : (
                  <ArrowLeft size={18} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                data-river-clear
                disabled={paused || won || !selected.length}
                onClick={() => {
                  selection([]);
                  setHinted(false);
                  setFeedback("已清空同行选择。可以让园丁独自过河。");
                }}
              >
                清空选择
              </button>
            </div>
          </div>
        </div>
        <p className={`tp-feedback ${won ? "tp-success" : ""}`} role="status">
          {paused ? "已暂停。伙伴们在岸边休息。" : feedback}
        </p>
        {won && (
          <div className="tp-complete" data-river-complete>
            <Check size={22} />
            全员到达花园！
          </div>
        )}
      </section>
      <aside className="game-notes tp-notes">
        <span className="mini-label">组合 · 约束 · 往返规划</span>
        <h3>
          照顾好两岸，
          <br />
          再划下一桨。
        </h3>
        <div className="tp-goal">
          <strong>全员去右岸</strong>
          <p>
            船每次最多带 {config.capacity}{" "}
            位伙伴，园丁不占这些座位，可以独自开船。
          </p>
        </div>
        <p>
          下面每对搭档都会互相逗着玩，不能一起留在无人照看的岸上。园丁所在岸和船上可以放心相处。
        </p>
        <ul className="tp-conflicts" aria-label="需要园丁照看的搭档">
          {config.conflicts.length ? (
            config.conflicts.map(([a, b]) => (
              <li key={`${a}-${b}`}>
                <span>{config.items[a]}</span>
                <span aria-hidden="true">＋</span>
                <span>{config.items[b]}</span>
              </li>
            ))
          ) : (
            <li>这一关没有搭档限制，自由安排！</li>
          )}
        </ul>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.lesson}</p>
        </div>
        <p className="muted">
          选中伙伴后，点击开船才移动。不能只送伙伴，园丁总和船一起走。不安全的航行会被阻止。支持撤销和当前局面提示，没有计时压力。
        </p>
        <p className="muted">
          Tab + Enter / 空格操作每个按钮。聚焦摆渡区后可按数字选同行伙伴，再按
          Enter 开船。
        </p>
      </aside>
    </div>
  );
}
