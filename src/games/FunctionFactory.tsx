// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  createFactoryState,
  editFactory,
  factoryDirectionNames,
  factoryHintFromSearch,
  factoryTracePoints,
  interpretFactory,
  searchFactoryAsync,
  undoFactory,
  verifyFactory,
  type FactorySlot,
  type FunctionCall,
  type PenCommand,
  type TraceDirection,
} from "./functionFactoryLogic";
import { functionFactoryLevels } from "./functionFactoryLevels";
import "./functionFactory.css";

const modified = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}) => event.ctrlKey || event.metaKey || event.altKey;

function TracePicture({
  trace,
  heading,
  label,
}: {
  trace: string;
  heading: TraceDirection;
  label: string;
}) {
  const points = factoryTracePoints(trace),
    xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    width = Math.max(...xs) - minX + 2,
    height = Math.max(...ys) - minY + 2;
  const position = (p: { x: number; y: number }) => ({
    x: (p.x - minX + 1) * 44,
    y: (p.y - minY + 1) * 44,
  });
  const end = position(points.at(-1)!);
  return (
    <figure className="ff-trace">
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${width * 44} ${height * 44}`} aria-hidden="true">
        {points.slice(1).map((p, i) => {
          const a = position(points[i]),
            b = position(p);
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <text x={(a.x + b.x) / 2 + 6} y={(a.y + b.y) / 2 - 6}>
                {i + 1}
              </text>
            </g>
          );
        })}
        <circle cx={position(points[0]).x} cy={position(points[0]).y} r="6" />
        <text x={position(points[0]).x - 24} y={position(points[0]).y + 20}>
          起
        </text>
        <path
          d="M-7,-6 L9,0 L-7,6 Z"
          transform={`translate(${end.x} ${end.y}) rotate(${{ E: 0, S: 90, W: 180, N: 270 }[heading]})`}
        />
      </svg>
      <p>从 (0, 0) 朝东出发；最后朝{factoryDirectionNames[heading]}。</p>
      <ol className="ff-strokes" aria-label={`${label}的完整有序笔画`}>
        {[...trace].map((d, i) => (
          <li key={i}>
            {i + 1}. {factoryDirectionNames[d as TraceDirection]} 1 格
          </li>
        ))}
      </ol>
      {!trace && <p>还没有画线。</p>}
    </figure>
  );
}
export default function FunctionFactory(props: GameProps) {
  return (
    <FactoryLevelView key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function FactoryLevelView({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = functionFactoryLevels[level] ?? functionFactoryLevels[0];
  const [state, setState] = useState(() => createFactoryState(config)),
    [selected, setSelected] = useState<FactorySlot | null>(null),
    [preview, setPreview] = useState<ReturnType<
      typeof interpretFactory
    > | null>(null),
    [won, setWon] = useState(false),
    [hint, setHint] = useState<ReturnType<typeof factoryHintFromSearch> | null>(
      null,
    ),
    [searching, setSearching] = useState(false),
    [checked, setChecked] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    slotRefs = useRef(new Map<string, HTMLButtonElement>()),
    notified = useRef(false),
    hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    search = useRef<AbortController | null>(null),
    stateRef = useRef(state);
  stateRef.current = state;
  const locked = paused || won;
  const focusSlot = (slot: FactorySlot | null) => {
    const element =
      slot && slotRefs.current.get(`${slot.section}:${slot.index}`);
    (element || root.current)?.focus({ preventScroll: true });
  };
  function cancelSearch() {
    search.current?.abort();
    search.current = null;
    if (document.activeElement?.hasAttribute("data-factory-search-cancel"))
      root.current?.focus({ preventScroll: true });
    setSearching(false);
  }
  function closePalette() {
    const old = selected;
    setSelected(null);
    focusSlot(old);
  }
  function edit(value: PenCommand | FunctionCall | null) {
    if (locked || !selected) return;
    const next = editFactory(config, stateRef.current, selected, value);
    cancelSearch();
    setState(next);
    setPreview(null);
    setHint(null);
    closePalette();
    onStatus(
      `${selected.section === "main" ? "主程序" : `函数 ${selected.section}`} 第 ${selected.index + 1} 格${value ? `填入 ${value}` : "已清空"}。`,
    );
  }
  function run() {
    if (locked) return;
    cancelSearch();
    setSelected(null);
    const result = interpretFactory(config, stateRef.current.program);
    setPreview(result);
    setHint(null);
    const success = verifyFactory(config, stateRef.current.program);
    setWon(success);
    onStatus(
      success
        ? "有序笔画、最终朝向和函数复用全部正确！"
        : !result.complete
          ? "先填满定义和主程序中的所有格子。"
          : "还不一致。比较完整笔画次序、最终朝向，并确认每个函数至少调用两次。两个函数必须不同。",
    );
    if (success) {
      root.current?.focus({ preventScroll: true });
      if (!notified.current) {
        notified.current = true;
        onComplete();
      }
    }
  }
  useEffect(() => {
    onStatus(
      "先定义可复用函数，再编排 A/B 调用。F 画一格，L 左转，R 右转；画线顺序和最终朝向都要相同。",
    );
    return () => search.current?.abort();
  }, []);
  useEffect(() => {
    if (paused) {
      cancelSearch();
      if (root.current?.contains(document.activeElement))
        root.current.focus({ preventScroll: true });
      setSelected(null);
    }
  }, [paused]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    cancelSearch();
    setState((s) => undoFactory(s));
    setWon(false);
    setPreview(null);
    setSelected(null);
    setHint(null);
    root.current?.focus({ preventScroll: true });
    onStatus("已撤销最近一次格子编辑；可以重新试运行。");
  }, [undoToken, paused, won]);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    cancelSearch();
    const controller = new AbortController();
    search.current = controller;
    setSearching(true);
    setChecked(0);
    setHint(null);
    const current = stateRef.current.program;
    void searchFactoryAsync(config, current, {
      signal: controller.signal,
      onProgress: setChecked,
    }).then((result) => {
      if (controller.signal.aborted || search.current !== controller) return;
      search.current = null;
      if (document.activeElement?.hasAttribute("data-factory-search-cancel"))
        root.current?.focus({ preventScroll: true });
      setSearching(false);
      const answer = factoryHintFromSearch(current, result);
      setHint(answer);
      onStatus(answer.text);
    });
  }, [hintToken, paused, won, config]);
  return (
    <div
      className="puzzle-layout function-factory"
      ref={root}
      tabIndex={0}
      aria-label="函数工厂"
      data-function-factory
      data-factory-won={won}
      onKeyDown={(event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.repeat ||
          locked
        )
          return;
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          event.stopPropagation();
          closePalette();
        }
        if (!selected) return;
        const value = event.key.toUpperCase();
        if (
          (selected.section === "main"
            ? config.lengths[1]
              ? ["A", "B"]
              : ["A"]
            : ["F", "L", "R"]
          ).includes(value)
        ) {
          event.preventDefault();
          edit(value as PenCommand | FunctionCall);
        } else if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          edit(null);
        }
      }}
    >
      <section className="ff-workbench" aria-label="函数编程台">
        <div className="ff-heading">
          <span className="mini-label">函数工厂 · {config.title}</span>
          <b>{state.history.length} 次编辑</b>
        </div>
        <p className="ff-banner">
          {paused
            ? "已暂停，编辑和试运行暂时锁定。"
            : won
              ? "设计通过！每次调用都完成了自己的工作。"
              : `定义预算 ${config.lengths[0] + config.lengths[1]} 格 · 主程序 ${config.calls} 次调用 · 每个函数至少复用 2 次`}
        </p>
        <div className="ff-pictures">
          <TracePicture
            trace={config.target}
            heading={config.finalHeading}
            label="公开目标"
          />
          {preview ? (
            <TracePicture
              trace={preview.trace}
              heading={preview.heading}
              label="本次试运行"
            />
          ) : (
            <div className="ff-preview-note">
              程序尚未运行。先观察目标中的重复片段，再把它们写成函数。
            </div>
          )}
        </div>
        <div className="ff-programs">
          {(["A", "B", "main"] as const)
            .filter((section) => section !== "B" || config.lengths[1])
            .map((section) => (
              <section
                key={section}
                aria-label={section === "main" ? "主程序" : `函数 ${section}`}
              >
                <h4>
                  {section === "main"
                    ? "主程序 · 只放函数调用"
                    : `函数 ${section} · 只放 F / L / R`}
                </h4>
                <div className="ff-slots">
                  {state.program[section].map((value, index) => (
                    <button
                      key={index}
                      ref={(element) => {
                        const key = `${section}:${index}`;
                        if (element) slotRefs.current.set(key, element);
                        else slotRefs.current.delete(key);
                      }}
                      data-factory-slot={`${section}:${index}`}
                      aria-label={`${section === "main" ? "主程序" : `函数 ${section}`} 第 ${index + 1} 格：${value ?? "空"}`}
                      aria-pressed={
                        selected?.section === section &&
                        selected.index === index
                      }
                      className={
                        hint?.slot?.section === section &&
                        hint.slot.index === index
                          ? "ff-hinted"
                          : ""
                      }
                      disabled={locked}
                      onClick={(event) => {
                        if (!modified(event)) setSelected({ section, index });
                      }}
                    >
                      <small>{index + 1}</small>
                      <b>{value ?? "+"}</b>
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
        {selected && !locked && (
          <div className="ff-palette" role="group" aria-label="选择指令">
            <strong>
              {selected.section === "main"
                ? "主程序"
                : `函数 ${selected.section}`}{" "}
              第 {selected.index + 1} 格
            </strong>
            {(selected.section === "main"
              ? config.lengths[1]
                ? ["A", "B"]
                : ["A"]
              : ["F", "L", "R"]
            ).map((value) => (
              <button
                key={value}
                data-factory-command={value}
                onClick={(event) => {
                  if (!modified(event))
                    edit(value as PenCommand | FunctionCall);
                }}
              >
                {value} ·{" "}
                {
                  {
                    F: "前进画线",
                    L: "左转 90°",
                    R: "右转 90°",
                    A: "调用 A",
                    B: "调用 B",
                  }[value]
                }
              </button>
            ))}
            <button
              onClick={(event) => {
                if (!modified(event)) edit(null);
              }}
              data-factory-clear
            >
              清空
            </button>
            <button
              onClick={(event) => {
                if (!modified(event)) closePalette();
              }}
              data-factory-cancel
            >
              取消 (Esc)
            </button>
          </div>
        )}
        <button
          className="ff-run"
          data-factory-run
          onClick={(event) => {
            if (!modified(event)) run();
          }}
          disabled={locked}
        >
          试运行并检查
        </button>
        {searching && (
          <div className="ff-search" role="status">
            保留当前格子，已检查 {checked} 种填法。
            <button
              data-factory-search-cancel
              onClick={(event) => {
                if (modified(event)) return;
                cancelSearch();
                setHint({
                  text: "提示搜索已取消，程序没有改变。",
                  slot: null,
                  value: null,
                });
                root.current?.focus({ preventScroll: true });
              }}
            >
              取消提示搜索
            </button>
          </div>
        )}
        {hint && (
          <p className="ff-hint" role="status">
            {hint.text}
          </p>
        )}
      </section>
      <aside className="game-notes ff-notes">
        <span className="mini-label">抽象 · 复用 · 函数接口</span>
        <h3>定义一次，换个朝向再用。</h3>
        <p>{config.lesson}</p>
        <h4>第一次怎么玩</h4>
        <ol>
          <li>每次都从 (0, 0) 朝东出发。</li>
          <li>
            点击函数格，选 F 前进并画一格、L 原地左转、R 原地右转。转弯不画线。
          </li>
          <li>
            主程序只能调用 A{config.lengths[1] ? " 或 B" : ""}
            ，每次从该函数第一格执行到末尾。
          </li>
          <li>
            填满所有格子，每个函数至少调用两次；有 A/B 时，两个定义必须不同。
          </li>
          <li>试运行，逐段匹配目标顺序和最终朝向。走过的线不会消失。</li>
        </ol>
        <p>
          没有循环或递归。函数不能调用函数。代码格数就是本关预算，无法增加。
        </p>
        <p>
          Tab 选择格子，Enter / 空格打开按钮；选中格子后可按 F/L/R 或 A/B。Esc
          取消，Delete 清空。可用工具栏撤销、重置或提示；提示只建议一格。
        </p>
        <p className="ff-scroll-cue">
          内容较长时可向下滚动；目标的全部笔画始终列在图下。
        </p>
      </aside>
    </div>
  );
}
