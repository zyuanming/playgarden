import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { MechanicalScene } from "./MechanicalScene";
import {
  balanceHint,
  balanceLevels,
  balanceNextMove,
  balanceTorque,
  createBalanceState,
  isBalanceSolved,
  moveBalance,
  undoBalance,
  type BalanceMove,
} from "./balanceLogic";
import "./mechanicalGames.css";

export default function BalanceLab(props: GameProps) {
  return <BalanceLevel key={`${props.level}:${props.resetToken}`} {...props} />;
}
function BalanceLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = balanceLevels[level] ?? balanceLevels[0];
  const [state, setState] = useState(() => createBalanceState(config));
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<BalanceMove | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = isBalanceSolved(config, state);
  const torque = balanceTorque(config, state.positions);
  const loaded = state.positions.filter((p) => p !== null).length;
  const allWeights = useMemo(
    () => [
      ...config.fixed.map((w, i) => ({ ...w, id: `fixed-${i}`, fixed: true })),
      ...config.weights.flatMap((w, i) =>
        state.positions[i] === null
          ? []
          : [
              {
                id: w.id,
                mass: w.mass,
                position: state.positions[i]!,
                fixed: false,
              },
            ],
      ),
    ],
    [config, state.positions],
  );
  const model = useMemo(
    () => ({
      kind: "balance" as const,
      arm: config.arm,
      torque,
      weights: allWeights,
    }),
    [config.arm, torque, allWeights],
  );
  const left = allWeights.reduce(
    (sum, w) => sum + (w.position < 0 ? -w.mass * w.position : 0),
    0,
  );
  const right = allWeights.reduce(
    (sum, w) => sum + (w.position > 0 ? w.mass * w.position : 0),
    0,
  );
  const slots = Array.from(
    { length: config.arm * 2 + 1 },
    (_, i) => i - config.arm,
  );
  useEffect(() => {
    onStatus("先选砝码，再选挂点。把所有砝码挂上，让总力矩变成 0。");
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const move = balanceNextMove(config, state);
    setHint(move);
    if (move) setSelected(move.weight);
    onStatus(balanceHint(config, state));
  }, [hintToken, paused, won, state, config, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused) return;
    const previous = undoBalance(state);
    setState(previous);
    setSelected(null);
    setHint(null);
    onStatus(
      previous === state
        ? "还没有移动可以撤销。"
        : "已撤销一步，砝码回到了上一个位置。",
    );
  }, [undoToken, paused, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(`平衡成功！左侧与右侧力矩都是 ${left}，所有砝码都已挂好。`);
      onComplete();
    }
  }, [won, paused, left, onStatus, onComplete]);
  function place(position: number | null) {
    if (paused || won || selected === null) return;
    const next = moveBalance(config, state, { weight: selected, position });
    if (next === state) return;
    setState(next);
    setSelected(null);
    setHint(null);
    const value = balanceTorque(config, next.positions);
    onStatus(
      `已移动 ${config.weights[selected].id}。当前总力矩 ${value > 0 ? "+" : ""}${value}；${value === 0 ? "两侧力矩相等" : value > 0 ? "右侧力矩较大" : "左侧力矩较大"}。`,
    );
  }
  return (
    <div className="puzzle-layout mechanical-game balance-lab">
      <section className="mechanical-workbench" aria-label="杠杆实验台">
        <div className="mechanical-title">
          <span className="mini-label">力矩实验 · {config.title}</span>
          <span>
            {loaded}/{config.weights.length} 已挂好
          </span>
        </div>
        <MechanicalScene model={model} paused={paused} won={won} />
        <div
          className={`torque-meter ${won ? "is-balanced" : ""}`}
          aria-label={`左侧力矩 ${left}，右侧力矩 ${right}，总力矩 ${torque}`}
        >
          <span>
            左侧 <strong>{left}</strong>
          </span>
          <div>
            <small>总力矩</small>
            <strong data-testid="balance-torque">
              {torque > 0 ? "+" : ""}
              {torque}
            </strong>
          </div>
          <span>
            右侧 <strong>{right}</strong>
          </span>
        </div>
        <div className="balance-slots-scroll">
          <div
            className="balance-slots"
            style={{
              gridTemplateColumns: `repeat(${slots.length}, minmax(38px, 1fr))`,
            }}
            aria-label="杠杆挂点"
          >
            {slots.map((position) => {
              if (position === 0)
                return (
                  <div
                    className="balance-pivot"
                    key={position}
                    aria-label="支点，不能挂砝码"
                  >
                    <span>▲</span>
                    <small>支点</small>
                  </div>
                );
              const fixed = config.fixed.find((w) => w.position === position);
              const occupant = state.positions.indexOf(position);
              const weight = occupant >= 0 ? config.weights[occupant] : null;
              const available =
                selected !== null &&
                !fixed &&
                !weight &&
                config.weights[selected].allowed.includes(position);
              return (
                <button
                  key={position}
                  className={`${available ? "available" : ""} ${hint?.position === position ? "hinted" : ""} ${fixed ? "fixed" : ""}`}
                  data-position={position}
                  disabled={paused || won || !available}
                  onClick={() => place(position)}
                  aria-label={`${position < 0 ? "左" : "右"} ${Math.abs(position)} 格${fixed ? `，固定 ${fixed.mass} 单位` : weight ? `，砝码 ${weight.id}，${weight.mass} 单位` : "，空挂点"}`}
                >
                  <span className="slot-load">
                    {fixed
                      ? `${fixed.mass} 🔒`
                      : weight
                        ? `${weight.id} · ${weight.mass}`
                        : "·"}
                  </span>
                  <span>
                    {position > 0 ? "+" : ""}
                    {position}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="mechanical-instruction" aria-live="polite">
          {paused
            ? "实验已暂停。"
            : won
              ? "所有砝码已挂好，左右力矩相等！"
              : selected === null
                ? "① 选择下方砝码　② 点击亮起的空挂点"
                : `已选 ${config.weights[selected].id}：可用挂点 ${config.weights[selected].allowed.map((p) => (p > 0 ? `+${p}` : p)).join("、")}。`}
        </p>
        <div className="balance-rack" role="group" aria-label="选择砝码">
          {config.weights.map((w, i) => (
            <button
              key={w.id}
              data-weight={i}
              className={selected === i ? "selected" : ""}
              aria-pressed={selected === i}
              disabled={paused || won}
              onClick={() => {
                setSelected(selected === i ? null : i);
                setHint(null);
              }}
              aria-label={`选择砝码 ${w.id}，${w.mass} 单位，${state.positions[i] === null ? "在托盘" : `${state.positions[i]! < 0 ? "左" : "右"} ${Math.abs(state.positions[i]!)} 格`}`}
            >
              <span className="weight-icon">{w.mass}</span>
              <strong>{w.id}</strong>
              <small>
                {state.positions[i] === null
                  ? "托盘"
                  : `${state.positions[i]! > 0 ? "+" : ""}${state.positions[i]} 格`}
              </small>
            </button>
          ))}
          <button
            className={`balance-return ${hint?.position === null ? "hinted" : ""}`}
            disabled={
              paused ||
              won ||
              selected === null ||
              state.positions[selected] === null
            }
            onClick={() => place(null)}
          >
            放回托盘
          </button>
        </div>
        <p className="mechanical-caption">
          倾斜只提示哪侧力矩较大，不代表真实静止角度；无需抢时间。
        </p>
      </section>
      <aside className="game-notes">
        <span className="mini-label">观察 · 预测 · 配平</span>
        <h3>小砝码，也有大力量。</h3>
        <p>{config.idea}</p>
        <div className="note">
          <strong>力矩 = 质量 × 带符号的距离</strong>
          <p>
            左边记负数，右边记正数。同侧力矩相加，两侧相抵。重力加速度对所有砝码相同，这里省略共同因子。
          </p>
          <p>所有砝码都挂好，并且总力矩为 0，才算完成。</p>
        </div>
        <p className="muted">
          每个挂点只能挂一块砝码。带锁的砝码不能移动。Tab 选择砝码和挂点，Enter
          或空格操作；触屏直接点按。
        </p>
      </aside>
    </div>
  );
}
