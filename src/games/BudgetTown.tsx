// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import { budgetTownLevels } from "./budgetTownLevels";
import {
  BUDGET_TOWN_FACILITIES,
  BUDGET_TOWN_SERVICES,
  budgetTownCovers,
  budgetTownDistance,
  budgetTownHint,
  createBudgetTownState,
  evaluateBudgetTown,
  toggleBudgetTown,
  undoBudgetTown,
  type BudgetTownKind,
  type BudgetTownService,
} from "./budgetTownLogic";
import "./budgetTown.css";

/** All art is original SVG geometry; no external assets or icon font. */
function TownBuilding({
  kind,
  home = false,
}: {
  kind?: BudgetTownKind;
  home?: boolean;
}) {
  if (home)
    return (
      <svg viewBox="0 0 40 36" aria-hidden="true">
        <path
          d="M5 16 20 4l15 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M9 16v16h22V16" fill="currentColor" opacity=".18" />
        <path
          d="M9 16v16h22V16M17 32V22h6v10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M13 19h3m8 0h3" stroke="currentColor" strokeWidth="3" />
      </svg>
    );
  const services = kind ? BUDGET_TOWN_FACILITIES[kind].services : [];
  return (
    <svg viewBox="0 0 44 36" aria-hidden="true">
      <path
        d="M3 32h38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {services.includes("g") && (
        <g>
          <path d="M10 27v5" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M10 5 3 17h4l-5 9h16l-5-9h4Z"
            fill="currentColor"
            opacity=".8"
          />
        </g>
      )}
      {services.includes("r") && (
        <g
          transform={
            services.includes("g") ? "translate(8 0)" : "translate(0 0)"
          }
        >
          <path
            d="M8 15q6-3 12 1v14q-6-4-12-1Zm12 1q6-4 12-1v14q-6-3-12 1Z"
            fill="currentColor"
            opacity=".25"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M20 16v14" stroke="currentColor" strokeWidth="2" />
        </g>
      )}
      {services.includes("w") && (
        <g
          transform={
            services.length === 3
              ? "translate(13 -7) scale(.78)"
              : "translate(8 0)"
          }
        >
          <path
            d="M20 5s-9 10-9 16a9 9 0 0 0 18 0c0-6-9-16-9-16Z"
            fill="currentColor"
            opacity=".7"
          />
          <path
            d="M16 22q0 4 4 4"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
function ServiceChip({
  service,
  met,
}: {
  service: BudgetTownService;
  met?: boolean;
}) {
  return (
    <span
      className={`bt-service bt-service-${service} ${met === false ? "bt-unmet" : ""}`}
    >
      {met !== undefined && (
        <span className="bt-service-sign">{met ? "✓" : "○"} </span>
      )}
      {BUDGET_TOWN_SERVICES[service].short}
    </span>
  );
}
export default function BudgetTown(props: GameProps) {
  return (
    <BudgetTownRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function BudgetTownRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = budgetTownLevels[level] ?? budgetTownLevels[0];
  const [state, setState] = useState(createBudgetTownState);
  const current = useRef(state);
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  const mapScroll = useRef<HTMLDivElement>(null);
  const revealSelected = useRef(false);
  const [hint, setHint] = useState<ReturnType<typeof budgetTownHint> | null>(
    null,
  );
  const [feedback, setFeedback] = useState(
    "选一块字母地块，查看范围与价格，再决定建造。每个住区的每项服务都要满足，而且不能超预算。",
  );
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken });
  const notified = useRef(false);
  const evaluation = evaluateBudgetTown(config, state.built);
  const proposal = config.proposals[selected];
  const facility = BUDGET_TOWN_FACILITIES[proposal.kind];
  const isBuilt = state.built.includes(proposal.id);
  const locked = paused || evaluation.won;
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (!evaluation.won || paused || notified.current) return;
    notified.current = true;
    setHint(null);
    setFeedback(
      `小镇方案通过！${evaluation.required} 项服务全部满足，花费 ${evaluation.spent} / ${config.budget} 游戏币。`,
    );
    callbacks.current.onComplete();
  }, [
    evaluation.won,
    evaluation.required,
    evaluation.spent,
    config.budget,
    paused,
  ]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || evaluateBudgetTown(config, current.current.built).won) return;
    const next = budgetTownHint(config, current.current.built);
    setHint(next);
    setFeedback(next.text);
    if (next.next) {
      const index = config.proposals.findIndex(
        (item) => item.id === next.next!.id,
      );
      selectedRef.current = index;
      setSelected(index);
    }
  }, [hintToken, paused, config]);
  function undo() {
    if (paused || evaluateBudgetTown(config, current.current.built).won) return;
    const previous = current.current,
      next = undoBudgetTown(previous);
    current.current = next;
    setState(next);
    setHint(null);
    setFeedback(
      next === previous
        ? "还没有可以撤销的建造或撤下操作。"
        : "已恢复上一次方案与预算。可以试另一种组合。",
    );
  }
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    undo();
  }, [undoToken, paused]);
  function choose(index: number, reveal = false) {
    if (paused) return;
    revealSelected.current = reveal;
    selectedRef.current = index;
    setSelected(index);
    setHint(null);
  }
  function toggle(index: number) {
    if (paused || evaluateBudgetTown(config, current.current.built).won) return;
    const target = config.proposals[index];
    if (!target) return;
    const existed = current.current.built.includes(target.id);
    const next = toggleBudgetTown(config, current.current, target.id);
    if (next === current.current) return;
    current.current = next;
    setState(next);
    setHint(null);
    const status = evaluateBudgetTown(config, next.built);
    setFeedback(
      `${existed ? "已撤下" : "已建造"} ${target.id} 地块的${BUDGET_TOWN_FACILITIES[target.kind].label}。${status.remaining < 0 ? `已超预算 ${-status.remaining} 币：方案暂时保留，请撤下设施或撤销。` : `剩余 ${status.remaining} 币，还缺 ${status.required - status.covered} 项服务。`}`,
    );
  }
  useEffect(() => {
    if (!revealSelected.current) return;
    revealSelected.current = false;
    const viewport = mapScroll.current;
    const button = viewport?.querySelector<HTMLElement>(
      `[data-budget-town-proposal="${config.proposals[selected].id}"]`,
    );
    if (!viewport || !button) return;
    const cell = button.getBoundingClientRect(),
      frame = viewport.getBoundingClientRect();
    if (cell.left < frame.left) viewport.scrollLeft -= frame.left - cell.left;
    else if (cell.right > frame.right)
      viewport.scrollLeft += cell.right - frame.right;
  }, [selected, config]);
  const preview = config.homes
    .map((home) => ({
      home,
      services: home.needs.filter((service) =>
        budgetTownCovers(proposal, home, service),
      ),
    }))
    .filter((item) => item.services.length > 0);
  return (
    <div
      className="puzzle-layout budget-town"
      data-budget-town-game
      data-budget-town-level={level}
      data-budget-town-built={state.built.join(",")}
      data-budget-town-spent={evaluation.spent}
      data-budget-town-covered={evaluation.covered}
      data-budget-town-won={evaluation.won}
    >
      <section className="bt-playfield" aria-label="预算小镇规划台">
        <header className="bt-heading">
          <div>
            <span className="mini-label">
              BUDGET TOWN · {Math.max(0, budgetTownLevels.indexOf(config)) + 1}{" "}
              / 12
            </span>
            <h3>{config.title}</h3>
          </div>
          <span className="bt-seal" aria-hidden="true">
            小镇
            <br />
            规划局
          </span>
        </header>
        <div
          className={`bt-ledger ${evaluation.remaining < 0 ? "bt-over" : ""}`}
          aria-label="预算和覆盖进度"
        >
          <div>
            <span>已花 / 总预算</span>
            <strong data-budget-town-budget>
              {evaluation.spent} <small>/ {config.budget} 币</small>
            </strong>
          </div>
          <div>
            <span>{evaluation.remaining < 0 ? "超出预算" : "剩余游戏币"}</span>
            <strong data-budget-town-remaining>
              {Math.abs(evaluation.remaining)}
              <small> 币</small>
            </strong>
          </div>
          <div>
            <span>已满足服务</span>
            <strong>
              {evaluation.covered}
              <small> / {evaluation.required}</small>
            </strong>
          </div>
        </div>
        <div className="bt-map-caption">
          <span>虚线字母格 = 候选设施</span>
          <span>浅色范围 = 当前地块半径</span>
        </div>
        <p className="bt-map-cue">
          地图可左右滑动查看；键盘方向键选择地块时，会自动显示所选位置。
        </p>
        <div className="bt-map-scroll" ref={mapScroll}>
          <div
            className="bt-map"
            style={{ "--bt-columns": config.width } as CSSProperties}
            role="group"
            tabIndex={0}
            aria-label="小镇地图，用左右方向键选择地块，Enter 或空格建造或撤下"
            aria-activedescendant={`budget-plot-${level}-${proposal.id}`}
            data-budget-town-map
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                event.repeat ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                paused
              )
                return;
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              ) {
                event.preventDefault();
                const offset =
                  event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
                choose(
                  (selectedRef.current + offset + config.proposals.length) %
                    config.proposals.length,
                  true,
                );
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle(selectedRef.current);
              }
            }}
          >
            {Array.from({ length: config.width * config.height }, (_, cell) => {
              const x = cell % config.width,
                y = Math.floor(cell / config.width);
              const homeIndex = config.homes.findIndex(
                (home) => home.x === x && home.y === y,
              );
              const plotIndex = config.proposals.findIndex(
                (plot) => plot.x === x && plot.y === y,
              );
              const inRange =
                budgetTownDistance(proposal, { x, y }) <= facility.radius;
              if (homeIndex >= 0) {
                const home = config.homes[homeIndex],
                  status = evaluation.homes[homeIndex];
                const touched = home.needs.some((service) =>
                  budgetTownCovers(proposal, home, service),
                );
                return (
                  <div
                    key={cell}
                    className={`bt-cell bt-home ${status.missing.length ? "" : "bt-home-met"} ${inRange ? "bt-in-range" : ""} ${touched ? "bt-preview-home" : ""}`}
                    data-budget-town-home={home.id}
                    data-missing={status.missing.join("")}
                    aria-label={`${home.id} 住区，第 ${y + 1} 行第 ${x + 1} 列，${status.missing.length ? `缺少${status.missing.map((service) => BUDGET_TOWN_SERVICES[service].label).join("、")}` : "全部服务已满足"}`}
                  >
                    <span className="bt-cell-id">
                      {home.id}
                      {status.missing.length ? "" : " ✓"}
                    </span>
                    <TownBuilding home />
                    <span className="bt-tiny-services" aria-hidden="true">
                      {home.needs.map((service) => (
                        <ServiceChip
                          key={service}
                          service={service}
                          met={status.met.includes(service)}
                        />
                      ))}
                    </span>
                  </div>
                );
              }
              if (plotIndex >= 0) {
                const plot = config.proposals[plotIndex],
                  info = BUDGET_TOWN_FACILITIES[plot.kind],
                  built = state.built.includes(plot.id);
                return (
                  <button
                    type="button"
                    key={cell}
                    className={`bt-cell bt-plot ${inRange ? "bt-in-range" : ""} ${built ? "bt-built" : ""} ${selected === plotIndex ? "bt-selected" : ""} ${hint?.next?.id === plot.id ? "bt-hinted" : ""}`}
                    id={`budget-plot-${level}-${plot.id}`}
                    data-budget-town-proposal={plot.id}
                    data-built={built}
                    aria-pressed={selected === plotIndex}
                    aria-label={`${plot.id} 地块，${info.label}，${info.cost} 币，半径 ${info.radius}，第 ${y + 1} 行第 ${x + 1} 列，${built ? "已建造" : "未建造"}`}
                    disabled={paused}
                    onClick={() => choose(plotIndex)}
                  >
                    <span className="bt-cell-id">
                      {plot.id} {built ? "✓" : ""}
                    </span>
                    <TownBuilding kind={plot.kind} />
                    <span className="bt-plot-price">{info.cost} 币</span>
                  </button>
                );
              }
              return (
                <div
                  key={cell}
                  className={`bt-cell bt-ground ${inRange ? "bt-in-range" : ""}`}
                  aria-hidden="true"
                >
                  <span>·</span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className={`bt-proposal-card ${hint?.next?.id === proposal.id ? "bt-hinted" : ""}`}
          data-budget-town-selection={proposal.id}
        >
          <div className="bt-proposal-head">
            <span className="bt-letter">{proposal.id}</span>
            <div>
              <h4>{facility.label}</h4>
              <p>
                {facility.cost} 币 · 半径 {facility.radius} 格 ·{" "}
                {isBuilt ? "已建造" : "候选设施"}
              </p>
            </div>
            <div className="bt-proposal-services">
              {facility.services.map((service) => (
                <ServiceChip key={service} service={service} />
              ))}
            </div>
          </div>
          <p className="bt-preview" data-budget-town-preview aria-live="polite">
            可提供：
            {preview.length
              ? preview
                  .map(
                    ({ home, services }) =>
                      `${home.id} ${services.map((service) => BUDGET_TOWN_SERVICES[service].short).join("＋")}`,
                  )
                  .join(" · ")
              : "范围内没有对应需求；换一个地块看看。"}
          </p>
          <div className="bt-build-row">
            <button
              type="button"
              data-budget-town-toggle={proposal.id}
              className="bt-build-button"
              disabled={locked}
              onClick={() => toggle(selectedRef.current)}
            >
              {isBuilt
                ? `撤下 ${proposal.id} · 退回 ${facility.cost} 币`
                : `建造 ${proposal.id} · ${facility.cost} 币`}
            </button>
            <button
              type="button"
              data-budget-town-undo
              disabled={locked || state.history.length === 0}
              onClick={undo}
            >
              撤销一步
            </button>
          </div>
        </div>
        <p
          className={`bt-feedback ${evaluation.won ? "bt-success" : evaluation.remaining < 0 ? "bt-warning" : ""}`}
          role="status"
          data-budget-town-feedback
        >
          {paused ? "已暂停。当前设施与预算已保留。" : feedback}
        </p>
        {hint && !paused && !evaluation.won && (
          <p className="bt-hint" data-budget-town-hint>
            {hint.text}
          </p>
        )}
        {evaluation.won && (
          <div className="bt-complete" data-budget-town-complete>
            <strong>✓ 小镇方案通过</strong>
            <p>{config.discovery}</p>
            <p>
              你的方案：{state.built.slice().sort().join("、")} ·{" "}
              {evaluation.spent} 游戏币。任何预算内的完整覆盖方案都有效。
            </p>
          </div>
        )}
        <section className="bt-needs" aria-label="每个住区的服务明细">
          <h4>
            住区服务单 <span>每一项都要打勾</span>
          </h4>
          <div>
            {config.homes.map((home, index) => (
              <div
                className="bt-need-row"
                key={home.id}
                data-budget-town-requirement={home.id}
              >
                <strong>{home.id}</strong>
                <span>
                  {home.needs.map((service) => (
                    <ServiceChip
                      key={service}
                      service={service}
                      met={evaluation.homes[index].met.includes(service)}
                    />
                  ))}
                </span>
                <small>
                  {evaluation.homes[index].missing.length
                    ? `还缺 ${evaluation.homes[index].missing.length} 项`
                    : "全部满足"}
                </small>
              </div>
            ))}
          </div>
        </section>
      </section>
      <aside className="game-notes bt-notes">
        <span className="mini-label">空间覆盖 · 组合取舍</span>
        <h3>
          让有限预算，
          <br />
          照顾每一格。
        </h3>
        <div className="bt-goal">
          <strong>完整覆盖 + 不超预算</strong>
          <p>
            每个住区只需要它标注的服务。绿 = 绿地，书 = 阅读，水 =
            供水。游戏币仅用于这道规划谜题。
          </p>
        </div>
        <ol>
          <li>点击字母地块查看设施。位置、价格、服务与半径已经固定。</li>
          <li>
            横走一格或竖走一格算 1。横向距离 + 纵向距离 ≤
            半径，就在范围内；斜对角算 2。地图没有障碍。
          </li>
          <li>
            一座设施可以同时满足多个住区；服务不耗尽。重复覆盖不加分，也不会相互抵消。
          </li>
          <li>
            按“建造”花费游戏币；再次选中后可“撤下”，全额退回。超支方案会保留供调整，但不会通过。
          </li>
        </ol>
        <details className="bt-example" open={level === 0}>
          <summary>看一个距离与预算例子</summary>
          <div>
            <svg
              viewBox="0 0 240 62"
              role="img"
              aria-label="两个住区位于一条街两端，中间设施离每端一格"
            >
              <path
                d="M38 30h164"
                stroke="#9bb9a9"
                strokeWidth="5"
                strokeDasharray="5 5"
              />
              <rect
                x="14"
                y="9"
                width="46"
                height="44"
                rx="10"
                fill="#e9eee2"
              />
              <rect
                x="97"
                y="9"
                width="46"
                height="44"
                rx="10"
                fill="#d5ead9"
              />
              <rect
                x="180"
                y="9"
                width="46"
                height="44"
                rx="10"
                fill="#e9eee2"
              />
              <text
                x="37"
                y="36"
                textAnchor="middle"
                fill="#244e3b"
                fontSize="13"
              >
                住区
              </text>
              <text
                x="120"
                y="36"
                textAnchor="middle"
                fill="#244e3b"
                fontSize="13"
              >
                花园
              </text>
              <text
                x="203"
                y="36"
                textAnchor="middle"
                fill="#244e3b"
                fontSize="13"
              >
                住区
              </text>
            </svg>
            <p>
              示例：两端住区都要绿地，中间花园到两端各 1 格。半径 2
              的花园能同时覆盖两端，花费 3 币；分别建两座则要 6 币。若预算是 3
              币，共享覆盖更合适。
            </p>
            {level === 0 && (
              <p>
                试一试本关：左右住区在第 2 行，两者中间的字母地块到每端都是 2
                格。选中它，看预览是否同时列出 H1 与 H2，再建造。
              </p>
            )}
          </div>
        </details>
        <div className="note">
          <strong>本关观察</strong>
          <p>{config.lesson}</p>
        </div>
        <p className="muted">
          不计时，不限制调整次数。提示按你当前建造的设施重新规划，可能先建议撤下。Tab
          + Enter / 空格可操作按钮；聚焦地图后，方向键换地块，Enter /
          空格建造或撤下。暂停时不会执行操作。
        </p>
      </aside>
    </div>
  );
}
