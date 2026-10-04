import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  arithmeticHint,
  arithmeticLevels,
  arithmeticMove,
  createArithmeticState,
  formatRational,
  isArithmeticSolved,
  undoArithmetic,
  type ArithmeticOperator,
} from "./arithmeticLogic";
import "./mathWordGames.css";

const operators: ArithmeticOperator[] = ["+", "−", "×", "÷"];
const operatorNames: Record<ArithmeticOperator, string> = {
  "+": "加",
  "−": "减",
  "×": "乘",
  "÷": "除",
};
export default function ArithmeticWorkshop(props: GameProps) {
  return (
    <ArithmeticLevel key={`${props.level}:${props.resetToken}`} {...props} />
  );
}
function ArithmeticLevel({
  level,
  paused,
  hintToken,
  undoToken,
  onComplete,
  onStatus,
}: GameProps) {
  const config = arithmeticLevels[level] ?? arithmeticLevels[0];
  const [state, setState] = useState(() => createArithmeticState(config));
  const [selected, setSelected] = useState<string[]>([]);
  const [hintedOperator, setHintedOperator] =
    useState<ArithmeticOperator | null>(null);
  const hintSeen = useRef(hintToken),
    undoSeen = useRef(undoToken),
    notified = useRef(false);
  const won = isArithmeticSolved(state);
  const left = state.tokens.find((token) => token.id === selected[0]);
  const right = state.tokens.find((token) => token.id === selected[1]);

  useEffect(() => {
    onStatus(
      `依次选两张数字卡，再选一个运算。每张卡都用一次，最后得到 ${config.target}。`,
    );
  }, []);
  useEffect(() => {
    if (hintSeen.current === hintToken) return;
    hintSeen.current = hintToken;
    if (paused || won) return;
    const hint = arithmeticHint(state);
    if (hint.move) {
      const a = state.tokens.find((token) => token.id === hint.move!.leftId)!;
      const b = state.tokens.find((token) => token.id === hint.move!.rightId)!;
      setSelected([a.id, b.id]);
      setHintedOperator(hint.move.operator);
      onStatus(
        `这条路线能到达 ${config.target}：先算 ${formatRational(a.value)} ${hint.move.operator} ${formatRational(b.value)}。已为你选好两张卡，请点击发亮的运算。`,
      );
    } else {
      setSelected([]);
      setHintedOperator(null);
      onStatus(
        hint.undoSteps > 0
          ? `当前的数字无法再凑成 ${config.target}。撤销 ${hint.undoSteps} 步，就能回到有解的位置。`
          : `这条路线暂时走不通，可以重来试试。${config.idea}`,
      );
    }
  }, [hintToken, paused, won, state, onStatus, config]);
  useEffect(() => {
    if (undoSeen.current === undoToken) return;
    undoSeen.current = undoToken;
    if (paused || won) return;
    const previous = undoArithmetic(state);
    setState(previous);
    setSelected([]);
    setHintedOperator(null);
    onStatus(
      previous === state
        ? "还没有运算可以撤销，已清除选中的卡片。"
        : "已撤销一次完整运算，两张卡都回来了。",
    );
  }, [undoToken, paused, won, state, onStatus]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      onStatus(
        `正好是 ${config.target}！四张卡片都用上了，你找到了一条好路线。`,
      );
      onComplete();
    }
  }, [won, paused, onComplete, onStatus, config.target]);

  function select(id: string) {
    if (paused || won) return;
    setHintedOperator(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 2
          ? [...current, id]
          : [id],
    );
  }
  function combine(operator: ArithmeticOperator) {
    if (paused || won || selected.length !== 2) return;
    const next = arithmeticMove(state, {
      leftId: selected[0],
      rightId: selected[1],
      operator,
    });
    if (next === state) {
      onStatus("不能除以 0。换一个运算，或交换两张卡的顺序。");
      return;
    }
    setState(next);
    setSelected([]);
    setHintedOperator(null);
    if (!isArithmeticSolved(next))
      onStatus(
        next.tokens.length === 1
          ? `现在得到 ${formatRational(next.tokens[0].value)}，目标是 ${config.target}。撤销一步或重来都可以。`
          : `${next.log.at(-1)}。还剩 ${next.tokens.length} 张卡，继续组合吧。`,
      );
  }

  return (
    <div
      className="puzzle-layout math-word-game"
      data-math-word-game="arithmetic"
    >
      <section className="mw-play-area" aria-label="数字工坊游戏">
        <div className="mw-board-header">
          <div>
            <span className="mini-label">数字工坊 · 第 {level + 1} 关</span>
            <h3>{config.title}</h3>
          </div>
          <div className="mw-target" aria-label={`目标 ${config.target}`}>
            <span>目标</span>
            <strong>{config.target}</strong>
          </div>
        </div>
        <div className={`mw-arithmetic-table ${won ? "mw-won" : ""}`}>
          <div className="mw-instruction">
            <span>01</span> 选两张卡 · 先选的数在左边
          </div>
          <div className="mw-number-cards" role="group" aria-label="可用数字卡">
            {state.tokens.map((token) => {
              const position = selected.indexOf(token.id);
              return (
                <button
                  key={token.id}
                  type="button"
                  className={`mw-number-card ${position >= 0 ? "mw-selected" : ""}`}
                  data-token={token.id}
                  data-value={formatRational(token.value)}
                  aria-pressed={position >= 0}
                  aria-label={`数字卡 ${token.id}，${formatRational(token.value)}${position >= 0 ? `，第 ${position + 1} 个数` : ""}`}
                  disabled={paused || won}
                  onClick={() => select(token.id)}
                >
                  <span className="mw-card-order" aria-hidden="true">
                    {position >= 0 ? position + 1 : "·"}
                  </span>
                  <strong>{formatRational(token.value)}</strong>
                  <small>
                    {token.leaves.length > 1 ? token.expression : "原始卡片"}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="mw-expression" aria-label="当前选择">
            <span>{left ? formatRational(left.value) : "第一个数"}</span>
            <b aria-hidden="true">?</b>
            <span>{right ? formatRational(right.value) : "第二个数"}</span>
          </div>
          <div className="mw-selection-tools">
            <button
              type="button"
              disabled={paused || won || selected.length !== 2}
              onClick={() => {
                setSelected([selected[1], selected[0]]);
                setHintedOperator(null);
              }}
            >
              交换顺序 ↔
            </button>
            <button
              type="button"
              disabled={paused || won || selected.length === 0}
              onClick={() => {
                setSelected([]);
                setHintedOperator(null);
              }}
            >
              清除选择
            </button>
          </div>
          <div className="mw-instruction">
            <span>02</span> 选一个运算 · 两张变成一张
          </div>
          <div className="mw-operations" role="group" aria-label="运算按钮">
            {operators.map((operator) => (
              <button
                key={operator}
                type="button"
                data-operator={operator}
                className={hintedOperator === operator ? "mw-hinted" : ""}
                aria-label={`${operatorNames[operator]} ${operator}${hintedOperator === operator ? "，提示" : ""}`}
                disabled={paused || won || selected.length !== 2}
                onClick={() => combine(operator)}
              >
                <strong>{operator}</strong>
                <small>{operatorNames[operator]}</small>
              </button>
            ))}
          </div>
          <p className="mw-board-caption">
            {won
              ? "四张卡，一份漂亮的答案 ✓"
              : state.tokens.length === 1
                ? "差一点点？撤销后换个思路。"
                : `还剩 ${state.tokens.length} 张卡 · 不限时间`}
          </p>
        </div>
      </section>
      <aside className="game-notes mw-guide">
        <span className="mini-label">数感 · 运算 · 多种解法</span>
        <h3>
          同样的数字，
          <br />
          不同的可能。
        </h3>
        <p>
          把四张卡片全部用上，每张只能用一次。每一步选两个数做加、减、乘或除，把结果继续拿来用。
        </p>
        <div className="note">
          <strong>这一关的小发现</strong>
          <p>{config.idea}</p>
        </div>
        <div className="mw-calculation-log" aria-label="运算记录">
          <strong>你的计算小纸条</strong>
          {state.log.length ? (
            <ol>
              {state.log.map((entry, index) => (
                <li key={`${index}:${entry}`}>{entry}</li>
              ))}
            </ol>
          ) : (
            <p className="muted">每一次组合都会记在这里。</p>
          )}
        </div>
        <p className="muted">
          负数和分数都可以；0
          不能作除数。减法、除法要留意先后顺序。同一种运算可以使用多次。
        </p>
        <p className="muted">
          键盘：Tab 选择卡片或运算，Enter /
          空格确认。撤销退回整步，提示会根据你当前的卡片找路。
        </p>
      </aside>
    </div>
  );
}
