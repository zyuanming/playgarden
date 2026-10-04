import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  coordinateEqual,
  coordinateLabel,
  coordinateMove,
  coordinatePath,
  coordinateTreasureLevels,
  coordinateWon,
  createCoordinateState,
  searchCoordinate,
  undoCoordinate,
  vectorLabel,
} from "./coordinateTreasureLogic";
import "./numberSpatialWorkshops.css";

export default function CoordinateTreasure(props: GameProps) {
  return (
    <CoordinateRound key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function CoordinateRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = coordinateTreasureLevels[level] ?? coordinateTreasureLevels[0];
  const [state, setState] = useState(() => createCoordinateState(config)),
    current = useRef(state);
  const [selected, setSelected] = useState<number | null>(null),
    selection = useRef<number | null>(null);
  const [hinted, setHinted] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(
    "先选一张向量卡，查看落点，再点击“确认移动”或发亮落点。收齐宝石后到旗帜处。",
  );
  const tokens = useRef({ hintToken, undoToken }),
    notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const won = coordinateWon(config, state),
    frozen = paused || won;
  const path =
      selected === null ? null : coordinatePath(config, state, selected),
    destination = path?.at(-1);
  const collected = config.gems.filter(
    (_, i) => state.collected & (1 << i),
  ).length;
  function select(card: number | null) {
    selection.current = card;
    setSelected(card);
  }
  useEffect(() => {
    if (!paused) callbacks.current.onStatus(feedback);
  }, [feedback, paused]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      setFeedback(
        `全部 ${config.gems.length} 颗宝石到手，顺利归航！用了 ${state.history.length} 张移动卡。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused, config.gems.length, state.history.length]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || coordinateWon(config, current.current)) return;
    const previous = current.current,
      next = undoCoordinate(previous);
    current.current = next;
    setState(next);
    select(null);
    setHinted(null);
    setFeedback(
      next === previous
        ? "还没有移动可以撤销，已清除预览。"
        : "已退回上一站，移动卡和宝石也恢复了。",
    );
  }, [undoToken, paused, config]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || coordinateWon(config, current.current)) return;
    const result = searchCoordinate(config, current.current),
      card = result.moves[0];
    select(card ?? null);
    setHinted(card ?? null);
    setFeedback(
      card !== undefined
        ? `找到一条归航路线：下一步用 ${vectorLabel(config.cards[card])}，落在 ${coordinateLabel(coordinatePath(config, current.current, card)!.at(-1)!)}。还有 ${result.moves.length} 步。`
        : result.status === "limit"
          ? "本次搜索达到上限，还不能判断这条路线。可以撤销一步再试。"
          : "当前卡片已无法收齐宝石并归航。请撤销一步或重来。",
    );
  }, [hintToken, paused, config]);
  function choose(card: number) {
    if (
      paused ||
      coordinateWon(config, current.current) ||
      !current.current.remaining[card]
    )
      return;
    if (selection.current === card) {
      select(null);
      setHinted(null);
      setFeedback("已清除路线预览，移动卡没有消耗。");
      return;
    }
    select(card);
    setHinted(null);
    const preview = coordinatePath(config, current.current, card);
    setFeedback(
      preview
        ? `${coordinateLabel(current.current.position)} + ${vectorLabel(config.cards[card])} = ${coordinateLabel(preview.at(-1)!)}。检查路线后再确认。`
        : "这张卡的路线会越界或经过礁石，不能移动；卡片还在，请换一张。",
    );
  }
  function move() {
    if (
      paused ||
      coordinateWon(config, current.current) ||
      selection.current === null
    )
      return;
    const before = current.current,
      next = coordinateMove(before, config, selection.current);
    if (next === before) return;
    current.current = next;
    setState(next);
    select(null);
    setHinted(null);
    setFeedback(
      `${coordinateLabel(before.position)} → ${coordinateLabel(next.position)}。${before.collected !== next.collected ? "拾到一颗宝石！" : "移动完成。"}${coordinateEqual(next.position, config.finish) && !coordinateWon(config, next) ? "还没收齐宝石，继续探索吧。" : ""}`,
    );
  }
  const cells = Array.from(
    { length: config.size * config.size },
    (_, index) => ({
      x: config.min + (index % config.size),
      y: config.min + config.size - 1 - Math.floor(index / config.size),
    }),
  );
  return (
    <div
      className="puzzle-layout nsw-game"
      data-number-spatial-game="coordinate"
    >
      <section className="nsw-workbench" aria-label="坐标寻宝游戏">
        <header className="nsw-heading">
          <div>
            <span className="mini-label">坐标寻宝 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <span className="nsw-badge">向量航线</span>
        </header>
        <div className="nsw-stats">
          <span>
            当前位置{" "}
            <b data-coordinate-position={coordinateLabel(state.position)}>
              {coordinateLabel(state.position)}
            </b>
          </span>
          <span>
            宝石{" "}
            <b data-coordinate-collected={collected}>
              {collected} / {config.gems.length}
            </b>
          </span>
          <span>
            余卡 <b>{state.remaining.reduce((a, b) => a + b, 0)}</b>
          </span>
        </div>
        <div className="ct-chart">
          <span className="ct-axis-y">y ↑</span>
          <div
            className="ct-grid"
            role="group"
            aria-label="坐标地图"
            style={{ gridTemplateColumns: `repeat(${config.size}, 1fr)` }}
          >
            {cells.map((p) => {
              const rock = config.rocks.some((r) => coordinateEqual(r, p)),
                gem = config.gems.findIndex((g) => coordinateEqual(g, p));
              const here = coordinateEqual(p, state.position),
                finish = coordinateEqual(p, config.finish),
                got = gem >= 0 && Boolean(state.collected & (1 << gem));
              const preview =
                  !paused && path?.some((step) => coordinateEqual(step, p)),
                target =
                  !paused && destination && coordinateEqual(destination, p);
              const label = `${coordinateLabel(p)}${here ? "，你在这里" : ""}${rock ? "，礁石" : ""}${gem >= 0 ? (got ? "，宝石已收集" : "，宝石") : ""}${finish ? "，终点" : ""}${target ? "，预览落点" : ""}`;
              return (
                <button
                  key={`${p.x}:${p.y}`}
                  type="button"
                  data-coordinate-cell={`${p.x},${p.y}`}
                  data-preview={Boolean(preview)}
                  data-destination={Boolean(target)}
                  className={`ct-cell ${rock ? "ct-rock" : ""} ${here ? "ct-player" : ""} ${preview ? "ct-preview" : ""} ${target ? "nsw-hinted" : ""}`}
                  disabled={frozen || !target}
                  aria-label={label}
                  onClick={move}
                >
                  <span aria-hidden="true">
                    {here
                      ? "◆"
                      : rock
                        ? "▧"
                        : gem >= 0 && !got
                          ? "✦"
                          : finish
                            ? "⚑"
                            : got
                              ? "·"
                              : ""}
                  </span>
                  <small aria-hidden="true">
                    {p.x},{p.y}
                  </small>
                  {here && finish && <i aria-hidden="true">⚑</i>}
                </button>
              );
            })}
          </div>
          <span className="ct-axis-x">x →</span>
        </div>
        <div className="ct-legend">
          <span>◆ 你</span>
          <span>✦ 宝石（仅落点拾取）</span>
          <span>▧ 礁石</span>
          <span>⚑ 终点</span>
        </div>
        <div className="nsw-instruction">
          <b>移动卡</b>
          <span>(横向 x, 纵向 y)</span>
        </div>
        <div className="ct-cards" role="group" aria-label="可用向量卡">
          {config.cards.map((card, i) => (
            <button
              key={i}
              type="button"
              data-vector-card={i}
              data-remaining={state.remaining[i]}
              aria-label={`向量 ${vectorLabel(card)}，剩余 ${state.remaining[i]} 次`}
              aria-pressed={selected === i}
              disabled={frozen || !state.remaining[i]}
              className={`ct-card ${selected === i ? "nsw-selected" : ""} ${hinted === i && !paused ? "nsw-hinted" : ""}`}
              onClick={() => choose(i)}
            >
              <strong>{vectorLabel(card)}</strong>
              <small>剩 {state.remaining[i]} 次</small>
            </button>
          ))}
        </div>
        <div className="ct-actions">
          <button
            type="button"
            data-coordinate-action="move"
            className="ct-confirm"
            disabled={frozen || !destination}
            onClick={move}
          >
            确认移动 {destination ? `→ ${coordinateLabel(destination)}` : ""}
          </button>
          <button
            type="button"
            data-coordinate-action="clear"
            disabled={frozen || selected === null}
            onClick={() => {
              select(null);
              setHinted(null);
            }}
          >
            清除预览
          </button>
        </div>
        <p className="nsw-feedback" role="status" aria-live="polite">
          {paused ? "已暂停，航线和卡片会原样保留。" : feedback}
        </p>
      </section>
      <aside className="game-notes nsw-notes">
        <span className="mini-label">坐标 · 向量 · 资源规划</span>
        <h3>
          每一步，
          <br />
          都有方向。
        </h3>
        <p>
          选择移动卡，预览整条路线，再确认出发。收齐全部宝石后停在旗帜处，剩下卡片也没关系。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <ul>
          <li>正 x 向右，正 y 向上；负数朝相反方向。</li>
          <li>向量会一次走完，不能在中途停下。</li>
          <li>途中每格都不能有礁石；宝石只在落点拾取。</li>
          <li>每次确认消耗一次卡片；预览和换卡不消耗。</li>
        </ul>
        <p className="muted">
          键盘：Tab 选择移动卡与确认按钮，Enter /
          空格操作。撤销能恢复卡片；提示依据当前坐标、剩余卡和未收集宝石。
        </p>
      </aside>
    </div>
  );
}
