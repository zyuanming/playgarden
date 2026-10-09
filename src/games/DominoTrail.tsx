// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  dominoTrailLevels,
  initialDomino,
  attachDomino,
  dominoWon,
  solveDomino,
  type DominoState,
  type DominoMove,
} from "./dominoTrailLogic";
import "./dominoTrail.css";
const spots = [
  [],
  [[20, 20]],
  [
    [10, 10],
    [30, 30],
  ],
  [
    [10, 10],
    [20, 20],
    [30, 30],
  ],
  [
    [10, 10],
    [30, 10],
    [10, 30],
    [30, 30],
  ],
  [
    [10, 10],
    [30, 10],
    [20, 20],
    [10, 30],
    [30, 30],
  ],
  [
    [10, 10],
    [30, 10],
    [10, 20],
    [30, 20],
    [10, 30],
    [30, 30],
  ],
];
function Pips({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      {spots[n].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.1" />
      ))}
    </svg>
  );
}
function Face({ a, b }: { a: number; b: number }) {
  return (
    <>
      <Pips n={a} />
      <i />
      <Pips n={b} />
    </>
  );
}
export default function DominoTrail(props: GameProps) {
  return <Round key={`${props.level}:${props.resetToken}`} {...props} />;
}
function Round({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const puzzle = dominoTrailLevels[level] ?? dominoTrailLevels[0];
  const [state, setState] = useState(() => initialDomino(puzzle)),
    [past, setPast] = useState<DominoState[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [hint, setHint] = useState<DominoMove | null>(null),
    [message, setMessage] = useState(
      "先选下面的一张骨牌，再点左端或右端。骨牌会自动转向，让相同点数相接。",
    );
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const tokens = useRef({ hintToken, undoToken }),
    done = useRef(false);
  const won = dominoWon(state, puzzle.tiles.length),
    locked = paused || won;
  function report(text: string) {
    setMessage(text);
    callbacks.current.onStatus(text);
  }
  useEffect(() => {
    callbacks.current.onStatus("先选下面的一张骨牌，再点左端或右端。骨牌会自动转向，让相同点数相接。");
  }, []);
  useEffect(() => {
    if (won && !paused && !done.current) {
      done.current = true;
      report(
        `接龙完成！${puzzle.tiles.length} 张骨牌全部接好，每一处相邻点数都相同。`,
      );
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const plan = solveDomino(state, puzzle.tiles);
    setHint(plan?.[0] ?? null);
    const tile = puzzle.tiles.find((t) => t.id === plan?.[0]?.id);
    report(
      tile
        ? `把 ${tile.a}｜${tile.b} 号点数骨牌接到${plan![0].side === "left" ? "左" : "右"}端。这一步仍能把剩下的牌全部接完。`
        : "这两端已无法接完全部余牌。请撤销一次，保留其他分支。",
    );
  }, [hintToken, locked]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (past.length) {
      setState(past.at(-1)!);
      setPast(past.slice(0, -1));
      report("上一张骨牌已回到待选区。");
    } else report("起始牌留在原处，还没有可撤销的拼接。");
    setSelected(null);
    setHint(null);
  }, [undoToken, locked]);
  function attach(side: "left" | "right") {
    if (locked || selected === null) return;
    const next = attachDomino(state, puzzle.tiles, { id: selected, side });
    if (!next) {
      report("这一端的点数不匹配。可以试试另一端，或改选一张牌。");
      return;
    }
    setPast([...past, state]);
    setState(next);
    setSelected(null);
    setHint(null);
    report("接好了！继续观察剩下的骨牌和两端点数。");
  }
  return (
    <div
      className="dt-layout"
      data-domino-trail-game
      data-chain={JSON.stringify(state.chain)}
      data-remaining={state.remaining.join(",")}
      data-won={won}
      data-moves={past.length}
    >
      <section className="dt-workbench">
        <header>
          <div>
            <span>THE PEBBLE TRAIL</span>
            <h3>{puzzle.title}</h3>
          </div>
          <b>
            {level + 1}
            <small> / {dominoTrailLevels.length}</small>
          </b>
        </header>
        <p>{puzzle.lesson}</p>
        <div className="dt-meta">
          <span>
            已接 {state.chain.length} / {puzzle.tiles.length} 张
          </span>
          <span>
            {paused ? "已暂停" : won ? "完整接龙" : "双向延伸 · 不计时"}
          </span>
        </div>
        <div className="dt-trail" aria-label="从左到右的已接骨牌">
          {state.chain.map((t, i) => (
            <div className="dt-chain-item" key={t.id}>
              <small>{i + 1}</small>
              <div className="dt-domino" aria-label={`${t.a} 接 ${t.b}`}>
                <Face a={t.a} b={t.b} />
              </div>
            </div>
          ))}
        </div>
        <div className="dt-ends">
          <button
            data-domino-end="left"
            disabled={locked || selected === null}
            className={hint?.side === "left" ? "hinted" : ""}
            onClick={() => attach("left")}
          >
            ← 接左端 <b>{state.chain[0].a}</b>
          </button>
          <span>{selected === null ? "先选一张" : "再选一端"}</span>
          <button
            data-domino-end="right"
            disabled={locked || selected === null}
            className={hint?.side === "right" ? "hinted" : ""}
            onClick={() => attach("right")}
          >
            接右端 <b>{state.chain.at(-1)!.b}</b> →
          </button>
        </div>
        <h4>
          待选骨牌 <small>{state.remaining.length} 张</small>
        </h4>
        <div className="dt-rack">
          {puzzle.tiles
            .filter((t) => state.remaining.includes(t.id))
            .map((t) => (
              <button
                key={t.id}
                data-domino-tile={t.id}
                data-a={t.a}
                data-b={t.b}
                className={`dt-domino ${selected === t.id ? "selected" : ""} ${hint?.id === t.id ? "hinted" : ""}`}
                aria-label={`骨牌 ${t.a} 和 ${t.b} 点，第 ${t.id + 1} 张`}
                aria-pressed={selected === t.id}
                disabled={locked}
                onClick={() => {
                  setSelected(selected === t.id ? null : t.id);
                  report(`已选 ${t.a}｜${t.b}，请选择要连接的一端。`);
                }}
              >
                <Face a={t.a} b={t.b} />
              </button>
            ))}
        </div>
        <p className="dt-message" role="status">
          {message}
        </p>
      </section>
      <aside className="dt-guide">
        <span>分支与回环</span>
        <h3>让点数相遇</h3>
        <p>
          每张骨牌有两个点数，空白代表 0。只要相接的两半点数相同，就能延长小径。
        </p>
        <ol>
          <li>选一张待选骨牌。</li>
          <li>点“接左端”或“接右端”。</li>
          <li>自动翻转方向，不匹配就留在原处。</li>
        </ol>
        <p>起始牌固定；用完每一张骨牌，连成一条没有断开的长链才算完成。</p>
        <details>
          <summary>怎样避免走到死路？</summary>
          <p>
            同一点数能走多条路时，先处理会回到原点的短环。提示会从当前两端寻找用完所有牌的接法。没有路时可以撤销。Tab、Enter
            和空格也可以操作。暂停及通关后锁定操作。
          </p>
        </details>
      </aside>
    </div>
  );
}
