// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameProps } from "../lib/types";
import {
  bagCost,
  bagEventExplanation,
  bagEventProbability,
  bagHintSteps,
  bagSize,
  bagTokenNames,
  bagWon,
  changeBagCount,
  createBagState,
  rationalEqual,
  rationalText,
  undoBag,
  type BagHint,
} from "./probabilityBagLogic";
import { probabilityBagLevels } from "./probabilityBagLevels";
import { runLabSearch, useLabFocus } from "./symmetryProbabilityRound";
import "./symmetryProbability.css";
export default function ProbabilityBag(props: GameProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div
      className="sp-lab pb-host"
      data-probability-host
      ref={host}
      tabIndex={-1}
      aria-label="概率抽袋工作区"
    >
      <BagRound
        key={`${props.level}:${props.resetToken}`}
        {...props}
        host={host}
      />
    </div>
  );
}
function BagRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
  host,
}: GameProps & { host: RefObject<HTMLDivElement | null> }) {
  const l = probabilityBagLevels[level] ?? probabilityBagLevels[0],
    [state, setState] = useState(() => createBagState(l)),
    [message, setMessage] = useState(
      "调整三种片的数量，让所有精确概率与数量条件同时匹配。",
    ),
    [busy, setBusy] = useState(false),
    [hint, setHint] = useState<Extract<BagHint, { status: "found" }> | null>(
      null,
    );
  const seenHint = useRef(hintToken),
    seenUndo = useRef(undoToken),
    notified = useRef(false),
    task = useRef<AbortController | null>(null);
  const won = bagWon(l, state.counts),
    locked = paused || won,
    n = bagSize(state.counts),
    cost = bagCost(l, state.counts);
  useLabFocus(host);
  const say = (s: string) => {
    setMessage(s);
    onStatus(s);
  };
  const cancel = () => {
    task.current?.abort();
    task.current = null;
    setBusy(false);
    setHint(null);
  };
  useEffect(() => {
    onStatus(l.lesson);
    return () => task.current?.abort();
  }, []);
  useEffect(() => {
    if (locked) cancel();
  }, [locked]);
  useEffect(() => {
    if (seenHint.current === hintToken) return;
    seenHint.current = hintToken;
    if (locked) return;
    cancel();
    const controller = new AbortController();
    task.current = controller;
    setBusy(true);
    say("正在枚举有限袋子的整数配比，比较距当前配比的调整次数。");
    void runLabSearch(bagHintSteps(l, state.counts), controller.signal).then(
      (result) => {
        if (!result || controller.signal.aborted) return;
        setBusy(false);
        if (result.status === "found") {
          setHint(result);
          say(
            `提示：${result.delta > 0 ? "添加" : "取出"} 1 个${bagTokenNames[result.color]}。从当前数量到最近可行配比还需 ${result.distance} 次加减；满袋时先取出多余的片。这个建议基于完整整数枚举，不是随机抽样。`,
          );
        } else
          say(
            result.status === "budget"
              ? "达到 256 个配比的搜索上限，尚不能保证最近建议；不代表无解。"
              : result.status === "solved"
                ? "当前配比已符合全部条件。"
                : "完整枚举后，没有同时满足所有公开条件的整数配比。",
          );
      },
    );
    return () => controller.abort();
  }, [hintToken, locked, state.counts]);
  function undo() {
    if (locked) return;
    cancel();
    const next = undoBag(l, state);
    setState(next);
    say(
      next === state
        ? "还没有可撤销的调整。"
        : "已撤销一次加减，所有概率重新精确计算。",
    );
  }
  useEffect(() => {
    if (seenUndo.current === undoToken) return;
    seenUndo.current = undoToken;
    if (!locked) undo();
  }, [undoToken, locked]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      cancel();
      say("袋子数量、全部精确概率与材料限制均已满足！");
      onComplete();
    }
  }, [won, paused]);
  function change(color: number, delta: -1 | 1) {
    if (locked) return;
    cancel();
    const next = changeBagCount(l, state, color, delta);
    setState(next);
    say(
      next === state
        ? delta > 0
          ? "袋子已满，先取出一片再调整。"
          : "该类型已经没有片了。"
        : `已${delta > 0 ? "添加" : "取出"} 1 个${bagTokenNames[color]}。概率按当前袋中全部 ${bagSize(next.counts)} 片计算。`,
    );
  }
  return (
    <div
      className="puzzle-layout sp-layout"
      data-probability-game
      data-probability-counts={state.counts.join(",")}
      data-probability-won={won}
    >
      <section className="sp-workbench">
        <div className="sp-heading">
          <span className="mini-label">概率抽袋 · {l.title}</span>
          <strong>{paused ? "已暂停" : won ? "已完成" : "配比实验"}</strong>
        </div>
        <p>{l.lesson}</p>
        <div className="sp-metrics">
          <span>
            总片数{" "}
            <b>
              {n} / {l.size}
            </b>
          </span>
          {l.costs && (
            <span>
              材料点数{" "}
              <b>
                {cost} / {l.budget}
              </b>
            </span>
          )}
          <span>
            计算方式 <b>精确分数</b>
          </span>
        </div>
        <p className="sp-help">
          每片被抽到的机会相同。袋子必须恰好装 {l.size}{" "}
          片；满袋先减后加。下方概率按当前片数 N = {n}{" "}
          计算，未装满也可比较，但不能过关。没有随机成绩、金钱或下注。
        </p>
        <div className="pb-counts" role="group" aria-label="调整袋子组成">
          {state.counts.map((count, color) => {
            const min = l.minimum?.[color] ?? 0,
              max = l.maximum?.[color] ?? l.size;
            return (
              <section
                className="pb-token"
                data-probability-token={color}
                data-hint={hint?.color === color}
                key={color}
                aria-label={bagTokenNames[color]}
              >
                <h3>
                  <span
                    className={`pb-shape pb-shape-${color}`}
                    aria-hidden="true"
                  >
                    {["●", "▲", "■"][color]}
                  </span>
                  {bagTokenNames[color]}
                </h3>
                <div className="pb-stepper">
                  <button
                    type="button"
                    aria-label={`取出一个${bagTokenNames[color]}`}
                    data-probability-remove={color}
                    disabled={locked || count === 0}
                    onClick={() => change(color, -1)}
                  >
                    −
                  </button>
                  <output
                    aria-label={`${bagTokenNames[color]}数量`}
                    data-probability-count={color}
                  >
                    {count}
                  </output>
                  <button
                    type="button"
                    aria-label={`添加一个${bagTokenNames[color]}`}
                    data-probability-add={color}
                    disabled={locked || n === l.size}
                    onClick={() => change(color, 1)}
                  >
                    +
                  </button>
                </div>
                <p>
                  允许 {min}–{max} 片{" "}
                  <b>{count >= min && count <= max ? "✓" : "○ 待调"}</b>
                  {l.costs && (
                    <>
                      <br />
                      每片 {l.costs[color]} 材料点
                    </>
                  )}
                </p>
              </section>
            );
          })}
        </div>
        <h3>全部公开概率目标</h3>
        <div className="pb-targets">
          {l.targets.map((target, i) => {
            const value = bagEventProbability(state.counts, target.event),
              match = rationalEqual(value, target.target);
            return (
              <article
                className="pb-target"
                key={i}
                data-probability-target={i}
                data-matched={match}
              >
                <h4>{target.label}</h4>
                <div className="pb-fractions">
                  <span>
                    目标 <strong>{rationalText(target.target)}</strong>
                  </span>
                  <span>
                    当前{" "}
                    <strong data-probability-value={i}>
                      {rationalText(value)}
                    </strong>
                  </span>
                  <b>{match ? "✓ 匹配" : "○ 待调"}</b>
                </div>
                <p>{bagEventExplanation(target.event)}</p>
                {value === null && (
                  <p className="pb-undefined">
                    当前实验的分母为
                    0，概率未定义，不能满足目标。请加入能进行该实验的片。
                  </p>
                )}
              </article>
            );
          })}
        </div>
        <details>
          <summary>怎样核算两次抽取？</summary>
          <p>
            把每片视作不同实体。若第一次是类型 X、第二次是类型 Y：放回时有 nX ×
            nY 个有序结果；不放回且 X = Y 时有 nX × (nX−1) 个，否则有 nX × nY
            个。把符合目标的结果数相加，再除以全部有序结果数。
          </p>
          <p>
            “同类型”和“同一片”不同。抽后不放回时不能抽到同一片，仍然可能抽到同类型的另一片。条件概率只在已知条件允许的片中重新取比例。
          </p>
        </details>
      </section>
      <aside className="sp-panel">
        <h3>实验记录</h3>
        <p role="status" aria-live="polite" data-probability-status>
          {message}
        </p>
        <button
          type="button"
          disabled={locked || !state.history.length}
          onClick={undo}
        >
          撤销一次加减
        </button>
        <button
          type="button"
          disabled={locked || !busy}
          onClick={() => {
            cancel();
            say("已取消提示搜索。袋子组成保持原样。");
          }}
        >
          取消提示搜索
        </button>
        <p>
          提示枚举最多 256
          个整数配比，从当前状态选择最少加减的一步。重复请求、编辑、暂停和重置都会取消旧搜索。
        </p>
        <p>
          Tab 选择加减按钮，Enter /
          空格操作。片的字母、形状与数量同时显示，无需辨认颜色。
        </p>
        {won && <strong className="sp-success">✓ 概率配比完成</strong>}
      </aside>
    </div>
  );
}
