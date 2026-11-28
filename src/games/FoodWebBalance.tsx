// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { foodWebLevels } from "./foodWebLevels";
import {
  card,
  continuation,
  draftFor,
  meetsGoal,
  openingStock,
  previewSeason,
  resources,
  symbols,
  type Choices,
  type Stock,
} from "./foodWebLogic";
import "./foodWebBalance.css";

const intro = "为三组各选一张牌，先扣本季开场库存，再把产出留到下一季。";
const victory = "末季库存全部达标！";
const quantities = (stock: Stock) =>
  stock
    .flatMap((amount, i) => (amount ? [resources[i] + " " + amount] : []))
    .join("、");
const format = ([lo, hi]: readonly [number, number]) =>
  lo === hi ? String(lo) : lo + "–" + hi;
const describe = (group: number, id: string) => {
  if (id === "0") return "休养";
  const { cost, gain } = card(group, id);
  return quantities(cost) + " → +" + gain;
};

export default function FoodWebBalance(props: GameProps) {
  return <Round key={props.level + ":" + props.resetToken} {...props} />;
}

function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onStatus,
  onComplete,
}: GameProps) {
  const l = foodWebLevels[level] ?? foodWebLevels[0];
  const [history, setHistory] = useState<Stock[]>([l.start]);
  const [draft, setDraft] = useState<Choices>(() => draftFor(l.rounds[0]));
  const [message, setMessage] = useState(intro);
  const round = history.length - 1,
    stock = history[round],
    season = l.rounds[round];
  const open = season ? openingStock(stock, season) : stock;
  const preview = season ? previewSeason(open, season, draft) : null;
  const shortage = preview ? quantities(preview.missing) : "";
  const ended = !season;
  const won = ended && meetsGoal(l, stock);
  const locked = paused || ended;
  const live = useRef({ onStatus, onComplete });
  live.current = { onStatus, onComplete };
  const tokens = useRef({ hintToken, undoToken });

  function report(s: string) {
    setMessage(s);
    live.current.onStatus(s);
  }
  useEffect(() => {
    live.current.onStatus(intro);
  }, []);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    if (ended) {
      report("末季库存未达标。撤销回上一季，或重来。");
      return;
    }
    if (shortage) {
      report("仅开场库存可用，还缺：" + shortage + "。");
      return;
    }
    const selectedNext = preview?.next;
    if (
      selectedNext &&
      (round + 1 === l.rounds.length
        ? meetsGoal(l, selectedNext)
        : continuation(l, round + 1, selectedNext))
    ) {
      report("这组牌可通向目标；可结算本季。");
      return;
    }
    const path = continuation(l, round, stock);
    if (!path) {
      report(
        "按当前库存，剩余 " +
          (l.rounds.length - round) +
          " 季已无法达标。试试撤销。",
      );
      return;
    }
    const group = path.findIndex((id, i) => draft[i] !== id);
    report(
      "还剩 " +
        (l.rounds.length - round) +
        " 季。先试「" +
        resources[group + 2] +
        "：" +
        describe(group, path[group]) +
        "」。",
    );
  }, [
    hintToken,
    paused,
    won,
    ended,
    shortage,
    l,
    round,
    stock,
    draft,
    preview,
  ]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    if (round === 0) {
      setDraft(draftFor(l.rounds[0]));
      report("已清空草稿，仍在第一季。");
      return;
    }
    setHistory(history.slice(0, -1));
    setDraft(draftFor(l.rounds[round - 1]));
    report("已撤销上次结算，恢复第 " + round + " 季开场库存。");
  }, [undoToken, paused, won, round, history, l]);

  function select(group: number, id: string) {
    if (locked || !season.menu[group].includes(id)) return;
    const updated: [string, string, string] = [...draft];
    updated[group] = id;
    setDraft(updated);
    setMessage("草稿已更新，库存未扣除。");
  }
  function apply() {
    if (locked || !preview?.full) return;
    if (!preview.next) {
      report("不能结算：仅开场库存可用，还缺 " + shortage + "。");
      return;
    }
    const next = preview.next;
    setHistory([...history, next]);
    setDraft(draftFor(l.rounds[round + 1]));
    if (round + 1 < l.rounds.length) {
      report("第 " + (round + 1) + " 季已结算。");
      return;
    }
    if (meetsGoal(l, next)) {
      report(victory);
      live.current.onComplete();
    } else report("末季库存未达标。可撤销，再试一次。");
  }

  return (
    <div
      className="puzzle-layout food-web"
      data-level-id={l.id}
      data-round={round}
      data-stock={stock.join(",")}
      data-opening={open.join(",")}
      data-next={preview?.next?.join(",") ?? ""}
      data-draft={draft.map((id) => id || "_").join("")}
      data-won={won}
    >
      <section
        className="fw-studio"
        tabIndex={0}
        aria-label="食物网操作区"
        onKeyDown={(e) => {
          if (locked || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
          if (e.key.toLowerCase() === "a") apply();
          else if (["1", "2", "3"].includes(e.key)) {
            const group = Number(e.key) - 1;
            const menu = season.menu[group];
            select(
              group,
              menu[(menu.indexOf(draft[group] || "_") + 1) % menu.length],
            );
          } else return;
          e.preventDefault();
        }}
      >
        <header className="fw-title">
          <div>
            <span>生态实验 · 第 {level + 1} 关</span>
            <h3>食物网平衡</h3>
          </div>
          <b>
            {ended
              ? "季节结束"
              : "第 " + (round + 1) + " / " + l.rounds.length + " 季"}
          </b>
        </header>
        <div className="fw-cycle">
          <span>本季库存</span> <span aria-hidden="true">→</span>{" "}
          <span>同时扣除</span> <span aria-hidden="true">→</span>{" "}
          <span>产出留到下季</span>
        </div>
        <div className="fw-ledger" role="table" aria-label="库存与结算预览">
          <div className="fw-row fw-labels" role="row">
            <span role="columnheader">筹码</span>
            {resources.map((r, i) => (
              <span role="columnheader" key={r}>
                <i aria-hidden="true" data-kind={i}>
                  {symbols[i]}
                </i>
                {r}
              </span>
            ))}
          </div>
          <div className="fw-row fw-open" role="row">
            <b role="rowheader">{ended ? "末季库存" : "开场库存"}</b>
            {open.map((n, i) => (
              <b role="cell" key={i}>
                {n}
              </b>
            ))}
          </div>
          {preview && (
            <>
              <div className="fw-row fw-cost" role="row">
                <span role="rowheader">本季扣除</span>
                {preview.cost.map((n, i) => (
                  <span role="cell" key={i} data-short={preview.missing[i] > 0}>
                    {n ? "−" + n : "·"}
                  </span>
                ))}
              </div>
              <div className="fw-row fw-next" role="row">
                <span role="rowheader">结算后</span>
                {resources.map((r, i) => (
                  <span role="cell" key={r}>
                    {preview.next?.[i] ?? "—"}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="fw-row fw-goal" role="row">
            <span role="rowheader">末季目标</span>
            {l.goal.map((target, i) => (
              <span
                role="cell"
                key={i}
                data-fit={
                  ended
                    ? stock[i] >= target[0] && stock[i] <= target[1]
                    : undefined
                }
              >
                {format(target)}
              </span>
            ))}
          </div>
        </div>
        {season && (
          <p className="fw-supply">
            本季补给：
            {season.in.some(Boolean)
              ? "叶片 +" +
                season.in[0] +
                " · 种子 +" +
                season.in[1] +
                "（已计入开场）"
              : "无"}
          </p>
        )}
        {season && (
          <div className="fw-groups">
            {season.menu.map((menu, group) => (
              <div
                className="fw-group"
                key={group}
                role="group"
                aria-label={resources[group + 2]}
              >
                <h4>
                  <i aria-hidden="true" data-kind={group + 2}>
                    {symbols[group + 2]}
                  </i>
                  {resources[group + 2]}
                </h4>
                <div className="fw-cards">
                  {[...menu].map((id) => (
                    <button
                      key={id}
                      type="button"
                      data-card={group + ":" + id}
                      aria-pressed={draft[group] === id}
                      disabled={locked}
                      onClick={() => select(group, id)}
                    >
                      {describe(group, id)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p
          className="fw-feedback"
          data-short={Boolean(shortage)}
          aria-live="polite"
        >
          {paused
            ? "已暂停。"
            : shortage
              ? "库存不足：缺 " + shortage + "。本季产出不能提前使用。"
              : won
                ? victory
                : message}
        </p>
        {!ended && (
          <button
            type="button"
            className="fw-apply"
            disabled={locked || !preview?.full}
            onClick={apply}
          >
            结算本季
          </button>
        )}
      </section>
      <aside className="game-notes">
        <span className="mini-label">资源分配 · 时序 · 规划</span>
        <h3>不会预支的食物网</h3>
        <ol>
          <li>
            每季为昆虫、小鼠、猫头鹰各选一张牌。箭头左侧是消耗，右侧是该组的产出。
          </li>
          <li>
            三张牌合起来只能花开场库存。比如新产出的昆虫，要等下一季才能喂给猫头鹰。
          </li>
          <li>最后一季结算后，每种筹码都得落在目标范围内。</li>
        </ol>
        <p>
          键盘：聚焦操作区，1 / 2 / 3 轮选对应组，A 结算。也可用 Tab
          操作各按钮。
        </p>
        <p>这是简化的策略模型，筹码不是对真实种群数量的预测。</p>
      </aside>
    </div>
  );
}
