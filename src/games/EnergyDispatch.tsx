// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { energyDispatchLevels } from "./energyDispatchLevels";
import {
  createEnergyState,
  energyBatteryLabel,
  energyHint,
  energyPreview,
  energyWon,
  moveEnergy,
  publicEnergy,
  solveEnergy,
  undoEnergy,
  type EnergyAction,
  type EnergyHint,
} from "./energyDispatchLogic";
import "./energyDispatch.css";
export default function EnergyDispatch(props: GameProps) {
  return (
    <EnergyLevelView key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function EnergyLevelView({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = energyDispatchLevels[level] ?? energyDispatchLevels[0];
  const puzzle = useMemo(() => publicEnergy(config), [config]);
  const table = useMemo(() => solveEnergy(puzzle), [puzzle]);
  const [state, setState] = useState(() => createEnergyState(puzzle));
  const [action, setAction] = useState<EnergyAction>({
    generator: 0,
    battery: 0,
  });
  const [hint, setHint] = useState<EnergyHint | null>(null),
    [inspection, setInspection] = useState<number | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const commitControl = useRef<HTMLButtonElement>(null),
    firstGenerator = useRef<HTMLButtonElement>(null),
    instruction = useRef<HTMLParagraphElement>(null),
    restoreCommitFocus = useRef(false);
  const board = state.board,
    won = energyWon(puzzle, board),
    ended = board.time === puzzle.periods.length,
    locked = paused || won || ended;
  const preview = energyPreview(puzzle, board, action),
    period = puzzle.periods[board.time];
  const selectedPeriod =
      inspection ?? Math.min(board.time, puzzle.periods.length - 1),
    viewed = puzzle.periods[selectedPeriod],
    past = state.history[selectedPeriod];
  const batteryValues = [
    0,
    ...Array.from(
      { length: Math.max(0, puzzle.chargeLimit - puzzle.chargeLoss) },
      (_, i) => i + puzzle.chargeLoss + 1,
    ),
    ...Array.from({ length: puzzle.dischargeLimit }, (_, i) => -i - 1),
  ];
  useEffect(() => {
    onStatus(
      "查看完整时间线，选择发电量与电池动作，再推进一个时段。单位和费用均为虚构，没有倒计时。",
    );
  }, []);
  useEffect(() => {
    if (paused) setHint(null);
  }, [paused]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const next = energyHint(puzzle, state, table);
    setHint(next);
    onStatus(next.text);
  }, [hintToken, paused, won, puzzle, state, table, onStatus]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    const next = undoEnergy(puzzle, state);
    setState(next);
    setHint(null);
    setInspection(null);
    if (next !== state) setAction({ ...state.history.at(-1)!.action });
    onStatus(
      next === state
        ? "还没有已执行时段可以撤销。"
        : "已撤销一个完整时段，储能、费用与时间一起恢复。",
    );
  }, [undoToken, paused, won, puzzle, state, onStatus]);
  useEffect(() => {
    if (!restoreCommitFocus.current) return;
    restoreCommitFocus.current = false;
    // Only continue a focused commit; inspection and undo keep their own focus.
    // The shell owns focus after victory.
    if (paused || won) return;
    if (ended) instruction.current?.focus();
    else firstGenerator.current?.focus();
  }, [board.time, ended, paused, won]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `完成调度！费用 ${board.cost} / ${puzzle.budget} 枚，结束储能 ${board.charge}，满足储备 ${puzzle.reserve}。可点时间线回看每段。`,
      );
      onComplete();
    }
  }, [won, paused, board, puzzle, onComplete, onStatus]);
  function choose(next: EnergyAction) {
    if (locked) return;
    setAction(next);
    setHint(null);
  }
  function commit() {
    if (locked || !preview.valid) return;
    const next = moveEnergy(puzzle, state, action);
    if (next === state) return;
    restoreCommitFocus.current =
      document.activeElement === commitControl.current;
    setState(next);
    setHint(null);
    setInspection(null);
    if (next.board.time < puzzle.periods.length)
      setAction({ generator: 0, battery: 0 });
    onStatus(
      `时段 ${board.time + 1} 已完成：发电 ${action.generator}，${energyBatteryLabel(action.battery, puzzle.chargeLoss)}，弃电 ${preview.spill}；现有储能 ${next.board.charge}，累计费用 ${next.board.cost}。`,
    );
  }
  return (
    <div
      className="puzzle-layout energy-dispatch"
      data-energy-dispatch-game
      data-energy-dispatch-won={won}
      data-energy-dispatch-time={board.time}
      data-energy-dispatch-charge={board.charge}
      data-energy-dispatch-cost={board.cost}
    >
      <section className="ed-workbench" aria-label="储能调度工作台">
        <div className="ed-heading">
          <span className="mini-label">储能调度 · {config.title}</span>
          <strong>
            {ended
              ? "全部时段已执行"
              : `时段 ${board.time + 1} / ${puzzle.periods.length}`}
          </strong>
        </div>
        <div className="ed-dashboard">
          <div
            className="ed-battery-visual"
            role="img"
            aria-label={`电池储能 ${board.charge}，容量 ${puzzle.capacity}`}
          >
            <svg viewBox="0 0 160 90" aria-hidden="true">
              <rect
                x="7"
                y="14"
                width="136"
                height="62"
                rx="12"
                fill="#fff"
                stroke="#266657"
                strokeWidth="4"
              />
              <path d="M147 34h8v22h-8" fill="#266657" />
              {Array.from({ length: puzzle.capacity }, (_, i) => (
                <rect
                  key={i}
                  x={14 + (i * 122) / puzzle.capacity}
                  y="22"
                  width={Math.max(4, 122 / puzzle.capacity - 4)}
                  height="46"
                  rx="3"
                  fill={i < board.charge ? "#3b8b70" : "#e0e9e4"}
                />
              ))}
            </svg>
            <strong>
              储能 {board.charge} / {puzzle.capacity}
            </strong>
            <small>结束至少留 {puzzle.reserve}</small>
          </div>
          <div
            className={`ed-cost ${board.cost > puzzle.budget ? "ed-over" : ""}`}
          >
            <small>虚构费用 / 预算</small>
            <strong>
              {board.cost} <span>/ {puzzle.budget}</span>
            </strong>
            <span>
              {board.cost > puzzle.budget
                ? "已超预算，请撤销"
                : `余 ${puzzle.budget - board.cost} 枚`}
            </span>
          </div>
        </div>
        <p className="ed-instruction" ref={instruction} tabIndex={-1}>
          {paused
            ? "已暂停，调度操作锁定。"
            : won
              ? "需求、储备和预算全部达成！可点时间线回看调度。"
              : ended
                ? `时段已结束：${board.charge < puzzle.reserve ? `储备不足 ${puzzle.reserve - board.charge} 单位。` : ""}${board.cost > puzzle.budget ? "费用超过预算。" : ""}请撤销或重来。`
                : "所有未来数据已公开。先选动作，再确认推进；超预算仍可撤销。"}
        </p>
        {period && (
          <div className="ed-now">
            <span>
              ☀ 可再生 <b>{period.renewable}</b>
            </span>
            <span>
              ⌂ 需求 <b>{period.demand}</b>
            </span>
            <span>
              ⚙ 单价 <b>{period.price}</b> 枚
            </span>
          </div>
        )}
        <fieldset disabled={locked} className="ed-controls">
          <legend>
            {ended ? "1 · 最后时段发电量（只读）" : "1 · 发电机本时段产出"}{" "}
            <small>上限 {puzzle.generatorLimit}</small>
          </legend>
          <div className="ed-generator">
            {Array.from(
              { length: puzzle.generatorLimit + 1 },
              (_, generator) => (
                <button
                  key={generator}
                  ref={generator === 0 ? firstGenerator : undefined}
                  data-energy-dispatch-generator={generator}
                  aria-label={`发电 ${generator} 单位`}
                  aria-pressed={action.generator === generator}
                  onClick={() => choose({ ...action, generator })}
                >
                  {generator}
                  <small>单位</small>
                </button>
              ),
            )}
          </div>
        </fieldset>
        <fieldset disabled={locked} className="ed-controls">
          <legend>
            {ended ? "2 · 最后时段电池动作（只读）" : "2 · 电池只选一种动作"}
          </legend>
          <div className="ed-battery-actions">
            {batteryValues.map((battery) => (
              <button
                key={battery}
                data-energy-dispatch-battery={battery}
                aria-pressed={action.battery === battery}
                onClick={() => choose({ ...action, battery })}
              >
                {energyBatteryLabel(battery, puzzle.chargeLoss)}
              </button>
            ))}
          </div>
        </fieldset>
        {!ended && (
          <div
            className={`ed-preview ${preview.valid ? "ed-valid" : "ed-invalid"}`}
            role="status"
            data-energy-dispatch-preview
          >
            <strong>{preview.valid ? "✓ 能量平衡成立" : "尚不能执行"}</strong>
            <p>{preview.reason}</p>
            {preview.valid && (
              <p>
                {period.renewable} 可再生 + {action.generator} 发电 +{" "}
                {Math.max(0, -action.battery)} 放电 = {period.demand} 需求 +{" "}
                {Math.max(0, action.battery)} 充电输入 + {preview.spill} 弃电
                <br />
                储能 {board.charge} → {preview.next.charge}；本段费用{" "}
                {preview.next.cost - board.cost} 枚
              </p>
            )}
          </div>
        )}
        <button
          className="ed-commit"
          ref={commitControl}
          data-energy-dispatch-commit
          disabled={locked || !preview.valid}
          onClick={commit}
        >
          {ended ? "全部时段已执行" : "确认并推进一个时段"}
        </button>
        {hint && (
          <div className="ed-hint" role="status" data-energy-dispatch-hint>
            <p>{hint.text}</p>
            {hint.action && (
              <button
                disabled={locked}
                data-energy-dispatch-use-hint
                onClick={() => {
                  if (locked || !hint.action) return;
                  setAction({ ...hint.action });
                  setHint(null);
                  onStatus("已选好建议动作，请检查平衡预览再推进。");
                }}
              >
                选择建议，不自动推进
              </button>
            )}
          </div>
        )}
        <h4>
          完整时间线 <small>点击任意时段查看</small>
        </h4>
        <div
          className="ed-timeline"
          aria-label="全部时段的可再生能源、需求与价格"
        >
          {puzzle.periods.map((p, i) => (
            <button
              key={i}
              data-energy-dispatch-period={i}
              aria-label={`查看时段 ${i + 1}，可再生 ${p.renewable}，需求 ${p.demand}，单价 ${p.price}${i < board.time ? "，已执行" : i === board.time ? "，当前" : "，未来"}`}
              aria-pressed={selectedPeriod === i}
              disabled={paused}
              className={i === board.time ? "ed-current" : ""}
              onClick={() => setInspection(i)}
            >
              <strong>
                {i + 1}{" "}
                <small>
                  {i < board.time ? "✓" : i === board.time ? "当前" : "未来"}
                </small>
              </strong>
              <span>☀ {p.renewable}</span>
              <span>⌂ {p.demand}</span>
              <span>⚙ {p.price}</span>
            </button>
          ))}
        </div>
        <div className="ed-inspection" data-energy-dispatch-inspection>
          <strong>
            时段 {selectedPeriod + 1} {past ? "· 已执行" : "· 公开计划数据"}
          </strong>
          <p>
            可再生 {viewed.renewable} · 需求 {viewed.demand} · 发电单价{" "}
            {viewed.price} 枚
          </p>
          {past ? (
            <p>
              发电 {past.action.generator}，
              {energyBatteryLabel(past.action.battery, puzzle.chargeLoss)}；损耗{" "}
              {past.loss}，弃电 {past.spill}
              <br />
              储能 {past.before.charge} → {past.after.charge}；费用 +
              {past.after.cost - past.before.cost}，累计 {past.after.cost}
            </p>
          ) : (
            <p>尚未执行；可以在推进前比较后面的供需与价格。</p>
          )}
        </div>
        <p className="ed-help">
          Tab 选择控件，Enter /
          空格选择或推进。粗边框和“当前”标记指明时段；按下状态指明已选动作。撤销只撤销一个已执行时段。
        </p>
      </section>
      <aside className="game-notes ed-notes">
        <span className="mini-label">时间 · 储能 · 约束</span>
        <h3>把今天的余量，留给明天。</h3>
        <p>{config.lesson}</p>
        <div className="ed-limits">
          <p>
            电池容量 {puzzle.capacity}，初始 {puzzle.initial}，结束储备至少{" "}
            {puzzle.reserve}。
          </p>
          <p>
            每段充电输入最多 {puzzle.chargeLimit}，放电输出最多{" "}
            {puzzle.dischargeLimit}，发电最多 {puzzle.generatorLimit}。
          </p>
          <p>
            {puzzle.chargeLoss
              ? `每次正充电先从输入扣掉 ${puzzle.chargeLoss} 单位损耗，剩余才存入。至少输入 ${puzzle.chargeLoss + 1} 单位；待机与放电没有损耗。`
              : "本关充电无损耗：输入多少，就存入多少。"}
          </p>
        </div>
        <h4>每段的结算顺序</h4>
        <ol>
          <li>选发电量与一种电池动作；不能同时充放电。</li>
          <li>可再生 + 发电 + 放电，先满足需求与充电输入；不够则不能推进。</li>
          <li>充电输入扣去损耗后存入，或扣去放电量；不能低于零或超过容量。</li>
          <li>多余供给成为弃电，不返还费用。只按发电量 × 本段单价收费。</li>
        </ol>
        <details open={level === 0}>
          <summary>第一次玩：完整示范</summary>
          <p>
            第一关：第 1 段可再生 3、需求 1，发电 0 并充入 2；第 2 段需求
            2，放电 2、发电 0；第 3 段可再生 1、需求 2，发电 1、电池待机。总费用
            3 枚，结束储能 0，正好满足目标。
          </p>
          <p>
            之后的关卡数据不同，还可能需要结束储备或支付充电损耗。示范不代表后面关卡的操作顺序。
          </p>
        </details>
        <h4>当前局面的提示</h4>
        <p>
          提示精确比较后续每段、每个电量的最低费用，再结合已经花掉的费用。若当前前缀已无法达标，会说明至少需要撤销多少时段。
        </p>
        <p className="ed-disclaimer">
          这是完全虚构的离散益智模型，不是现实电网操作或金融建议。没有真实交易，也没有计时压力。
        </p>
      </aside>
    </div>
  );
}
