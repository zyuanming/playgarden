// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  sceneDifferencesLevels,
  sceneDifferenceIndices,
  sceneDifferencesWon,
  sceneDifferenceReason,
  sceneKindNames,
  type SceneItem,
} from "./sceneDifferencesLogic";
import "./sceneDifferences.css";
function Picture({ item }: { item: SceneItem }) {
  const c = item.color;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="83" rx="34" ry="7" fill="#45694e18" />
      {item.kind === "flower" ? (
        <>
          <path
            d="M50 42V79M50 68Q26 70 27 54Q43 51 50 68"
            fill="#82a77b"
            stroke="#608268"
            strokeWidth="3"
          />
          {[0, 60, 120, 180, 240, 300].map((n) => (
            <ellipse
              key={n}
              cx="50"
              cy="22"
              rx="11"
              ry="17"
              transform={`rotate(${n} 50 38)`}
              fill={c}
            />
          ))}
          <circle cx="50" cy="38" r="12" fill="#f9e7a1" />
        </>
      ) : item.kind === "tree" ? (
        <>
          <path d="M44 44H56V81H44Z" fill="#9c8061" />
          <circle cx="50" cy="38" r="30" fill={c} />
          <circle cx="35" cy="48" r="18" fill={c} />
          <circle cx="65" cy="48" r="18" fill={c} />
        </>
      ) : item.kind === "bird" ? (
        <>
          <ellipse cx="49" cy="54" rx="25" ry="21" fill={c} />
          <circle cx="65" cy="33" r="15" fill={c} />
          <path d="M78 29l15 7-15 5" fill="#cc934b" />
          <circle cx="69" cy="31" r="3" fill="#334c43" />
          <path d="M35 62Q50 34 60 61" fill="#ffffff55" />
          <path
            d="M43 74V83M55 74V83M25 52 9 36 15 61"
            stroke="#547366"
            strokeWidth="3"
            fill={c}
          />
        </>
      ) : item.kind === "pot" ? (
        <>
          <path d="M23 42h54L68 80H32Z" fill={c} />
          <rect
            x="20"
            y="36"
            width="60"
            height="13"
            rx="4"
            fill={c}
            stroke="#576653"
            strokeWidth="2"
          />
          <path
            d="M50 36V14M49 25Q21 8 27 26Q35 37 49 31M50 21Q77 1 75 20Q67 33 50 28"
            fill="#7fa074"
            stroke="#618664"
            strokeWidth="2"
          />
        </>
      ) : item.kind === "lamp" ? (
        <>
          <path
            d="M50 10V21M50 71V87M43 85V93M57 85V93"
            stroke="#b9995d"
            strokeWidth="3"
          />
          <rect x="26" y="22" width="48" height="50" rx="17" fill={c} />
          <path d="M36 24V70M64 24V70" stroke="#ffffff77" strokeWidth="2" />
          <path d="M29 23h42M29 71h42" stroke="#897455" strokeWidth="5" />
        </>
      ) : (
        <>
          <ellipse
            cx="29"
            cy="37"
            rx="20"
            ry="27"
            fill={c}
            transform="rotate(-25 29 37)"
          />
          <ellipse
            cx="71"
            cy="37"
            rx="20"
            ry="27"
            fill={c}
            transform="rotate(25 71 37)"
          />
          <ellipse cx="32" cy="65" rx="16" ry="19" fill={c} />
          <ellipse cx="68" cy="65" rx="16" ry="19" fill={c} />
          <path
            d="M50 27V74M49 30 40 16M51 30 60 16"
            stroke="#536b56"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      )}
      <g fill="#fff9e7" stroke="#765e40" strokeWidth="1.3">
        {Array.from({ length: item.count }, (_, n) => (
          <circle
            key={n}
            cx={50 + (n - (item.count - 1) / 2) * 12}
            cy="55"
            r="4.5"
          />
        ))}
      </g>
      <g transform={item.mirror ? "translate(100 0) scale(-1 1)" : undefined}>
        <path
          d="M12 81v16M13 81h14l-5 5 5 5H13"
          stroke="#657c63"
          fill="#e3cf8d"
          strokeWidth="1.8"
        />
      </g>
    </svg>
  );
}
export default function SceneDifferences(p: GameProps) {
  return <DifferenceRound key={`${p.level}:${p.resetToken}`} {...p} />;
}
function DifferenceRound({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = sceneDifferencesLevels[level] ?? sceneDifferencesLevels[0],
    answer = sceneDifferenceIndices(config);
  const [history, setHistory] = useState<number[][]>([[]]),
    [hint, setHint] = useState<number | null>(null),
    [message, setMessage] = useState(config.lesson);
  const found = history.at(-1)!,
    won = sceneDifferencesWon(config, found),
    locked = paused || won;
  const latest = useRef({ history, found, locked });
  latest.current = { history, found, locked };
  const tokens = useRef({ hintToken, undoToken }),
    done = useRef(false),
    callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
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
      report("五处不同都找齐了！耐心观察，花园的小变化都逃不过你。");
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (locked) return;
    const i = answer.find((n) => !found.includes(n));
    if (i !== undefined) {
      setHint(i);
      report(
        `比较两幅画的 ${i + 1} 号区域，留意物件、颜色、点点数量与小旗方向。`,
      );
    }
  }, [hintToken]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      setHint(null);
      report("收回了上一个观察标记。");
    } else report("还没有标记可以收回。");
  }, [undoToken]);
  function inspect(i: number) {
    const current = latest.current;
    if (current.locked || current.found.includes(i)) return;
    if (!answer.includes(i)) {
      report(`${i + 1} 号区域相同。再比较其他区域，错点不会扣分。`);
      return;
    }
    const next = [...current.found, i],
      h = [...current.history, next];
    latest.current = {
      history: h,
      found: next,
      locked: sceneDifferencesWon(config, next),
    };
    setHistory(h);
    setHint(null);
    report(
      `${i + 1} 号找到了：${sceneDifferenceReason(config.left[i], config.right[i])}。`,
    );
  }
  return (
    <div
      className="sd-game"
      data-scene-differences-game
      data-scene-won={won}
      data-scene-found={found.join(",")}
    >
      <section className="sd-workbench">
        <header>
          <div>
            <span>GARDEN OBSERVATORY</span>
            <h3>{config.title}</h3>
          </div>
          <b>
            {found.length}
            <small> / {answer.length}</small>
          </b>
        </header>
        <p>{config.lesson}</p>
        <div className="sd-scenes">
          {([config.left, config.right] as const).map((items, side) => (
            <figure key={side}>
              <figcaption>
                {side === 0 ? "原来的花园" : "悄悄改变之后"}
              </figcaption>
              <div
                className="sd-picture"
                style={{ background: config.sky }}
                role="group"
                aria-label={side === 0 ? "左侧原图" : "右侧变化图"}
              >
                {items.map((item, i) => (
                  <button
                    type="button"
                    key={i}
                    data-scene-side={side}
                    data-scene-area={i}
                    data-scene-item={JSON.stringify(item)}
                    className={`${found.includes(i) ? "sd-found" : ""} ${hint === i ? "sd-hinted" : ""}`}
                    disabled={locked || found.includes(i)}
                    onClick={() => inspect(i)}
                    aria-label={`${side === 0 ? "原图" : "变化图"}第 ${i + 1} 区，${sceneKindNames[item.kind]}，${item.count} 个点点，小旗朝${item.mirror ? "左" : "右"}${found.includes(i) ? "，已找到不同" : ""}`}
                  >
                    <Picture item={item} />
                    <small>{i + 1}</small>
                    {found.includes(i) && (
                      <span className="sd-check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </figure>
          ))}
        </div>
        <p className="sd-message" role="status">
          {paused ? "观察暂停了，标记都留在原处。" : message}
        </p>
      </section>
      <aside className="sd-notes">
        <span>看一看，再比较</span>
        <h3>
          花园变了，
          <br />
          哪里不一样？
        </h3>
        <ol>
          <li>两幅画的编号一一对应，比较同号区域。</li>
          <li>不同可能是物件、颜色、白色点点的数量，或底部小旗朝向。</li>
          <li>发现后，点任一幅画中的那个区域。找齐五处就完成。</li>
        </ol>
        <p>
          每个区域最多算一处。没有倒计时，错点不扣分。只需找不同，不需要点击相同区域。
        </p>
        <details>
          <summary>键盘与小帮手</summary>
          <p>
            Tab 选择编号区域，Enter
            或空格标记。提示只圈出一个值得仔细看的区域；撤销会移除上一个标记。重来清空本关标记，暂停和完成后所有区域锁定。
          </p>
        </details>
      </aside>
    </div>
  );
}
