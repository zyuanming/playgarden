// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  gardenLinksLevels,
  findGardenLink,
  gardenLinksHint,
  linkSymbols,
  type LinkBoard,
  type LinkPoint,
} from "./gardenLinksLogic";
import "./gardenLinks.css";
export default function GardenLinks(p: GameProps) {
  return <LinkRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function LinkRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = gardenLinksLevels[level] ?? gardenLinksLevels[0];
  const [history, setHistory] = useState<LinkBoard[]>([[...config.board]]),
    [selected, setSelected] = useState<number | null>(null),
    [hint, setHint] = useState<number[]>([]),
    [path, setPath] = useState<LinkPoint[]>([]),
    [message, setMessage] = useState(config.lesson);
  const state = history.at(-1)!,
    won = state.every((v) => v === null),
    locked = paused || won,
    done = useRef(false),
    tokens = useRef({ hintToken, undoToken }),
    callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const live = useRef({ state, history, selected, locked });
  live.current = { state, history, selected, locked };
  function report(s: string) {
    setMessage(s);
    callbacks.current.onStatus(s);
  }
  useEffect(() => {
    callbacks.current.onStatus(config.lesson);
  }, []);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      report("最后一对也牵上了手，花园全部收好了！");
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const result = gardenLinksHint(config, state);
    if (result.plan?.length) {
      const pair = result.plan[0];
      setHint(pair);
      setPath(findGardenLink(config, state, ...pair) ?? []);
      report(
        `有一条完整收牌路线。先连发光的两张“${linkSymbols[state[pair[0]]!]}”，虚线表示实际空路。`,
      );
    } else {
      setHint([]);
      setPath([]);
      report(
        result.status === "limit"
          ? "搜索达到上限，暂时没有可靠建议；可以撤销一步再试。"
          : "当前没有完整收牌路线，请撤销最近的一对。",
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      setSelected(null);
      setHint([]);
      setPath([]);
      report("上一对花牌已放回原处。");
    } else report("还没有收起的花牌。");
  }, [undoToken]);
  function choose(cell: number) {
    const now = live.current;
    if (now.locked || now.state[cell] === null) return;
    if (now.selected === null) {
      setSelected(cell);
      setPath([]);
      return;
    }
    if (now.selected === cell) {
      setSelected(null);
      return;
    }
    if (now.state[now.selected] !== now.state[cell]) {
      setSelected(cell);
      setPath([]);
      report("两个字不同，已经改选这一张。");
      return;
    }
    const route = findGardenLink(config, now.state, now.selected, cell);
    if (!route) {
      report("没有最多两次转弯的空路。可以取消选择，先收起别的对子。");
      return;
    }
    const next = now.state.map((v, i) =>
        i === cell || i === now.selected ? null : v,
      ),
      h = [...now.history, next];
    live.current = {
      state: next,
      history: h,
      selected: null,
      locked: next.every((v) => v === null),
    };
    setHistory(h);
    setSelected(null);
    setHint([]);
    setPath(route);
    report("这对花牌连通了，空出来的格子可以留给下一条路。");
  }
  const cols = config.cols + 2,
    rows = config.rows + 2;
  return (
    <div
      className="gl-game"
      data-garden-links-game
      data-links-won={won}
      data-links-state={JSON.stringify(state)}
      data-links-hint={JSON.stringify(hint)}
      data-links-path={JSON.stringify(path)}
      data-links-cols={config.cols}
      data-links-rows={config.rows}
    >
      <section className="gl-field">
        <header>
          <div>
            <span>PATHS BETWEEN PETALS</span>
            <h3>{config.title}</h3>
          </div>
          <b>
            {state.filter((v) => v !== null).length}
            <small> 张</small>
          </b>
        </header>
        <p>{config.lesson}</p>
        <div className="gl-meter">
          <span>最多两次转弯</span>
          <span>已收 {history.length - 1} 对</span>
        </div>
        <div
          className="gl-board"
          style={{
            gridTemplateColumns: `repeat(${cols},1fr)`,
            aspectRatio: `${cols}/${rows}`,
          }}
          role="group"
          aria-label="花牌与外圈空路"
        >
          {Array.from({ length: cols * rows }, (_, i) => {
            const r = Math.floor(i / cols),
              c = i % cols;
            if (!r || r === rows - 1 || !c || c === cols - 1)
              return <span key={i} className="gl-border" />;
            const cell = (r - 1) * config.cols + c - 1,
              value = state[cell];
            return (
              <button
                type="button"
                key={i}
                data-link-cell={cell}
                data-link-value={value ?? ""}
                className={`${value === null ? "gl-empty" : ""} ${selected === cell ? "selected" : ""} ${hint.includes(cell) ? "hinted" : ""}`}
                disabled={locked || value === null}
                aria-pressed={selected === cell}
                aria-label={`第 ${r} 行第 ${c} 列，${value === null ? "空地" : linkSymbols[value]}`}
                onClick={() => choose(cell)}
              >
                <strong>{value === null ? "" : linkSymbols[value]}</strong>
                <small>{value === null ? "" : `${r},${c}`}</small>
              </button>
            );
          })}
          <svg
            viewBox={`0 0 ${cols * 100} ${rows * 100}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={path
                .map((p) => `${p.col * 100 + 50},${p.row * 100 + 50}`)
                .join(" ")}
              fill="none"
              stroke="#9b7443"
              strokeWidth="9"
              strokeDasharray="10 11"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="gl-message" role="status">
          {paused ? "花园暂停了，所有牌与空路保持原状。" : message}
        </p>
      </section>
      <aside className="gl-notes">
        <span>相同的牌，畅通的路</span>
        <h3>
          拐两次弯，
          <br />
          就能相遇。
        </h3>
        <ol>
          <li>选择两张文字相同的花牌。</li>
          <li>它们之间要能画出只横走、竖走的空路，最多转两次弯。</li>
          <li>
            路径可以走空格和棋盘外圈，不能穿过其他牌。收空全部花牌才完成。
          </li>
        </ol>
        <p>
          花牌不会掉落或重排。先打开通道，再收里面的对子。提示会按当前棋盘寻找完整路线，不会自动收牌。
        </p>
        <details>
          <summary>键盘、暂停与撤销</summary>
          <p>
            Tab 选择花牌，Enter
            或空格确认。点原牌取消选择。错误连线不扣分，撤销放回上一对；重来恢复整副牌。暂停与完成时棋盘锁定。
          </p>
        </details>
      </aside>
    </div>
  );
}
