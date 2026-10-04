import { useMemo, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  ArithmeticCell,
  ArithmeticPad,
  useArithmeticRound,
} from "./ArithmeticConstraintBoard";
import {
  arithmeticCageConflicts,
  arithmeticCageLevels,
  getArithmeticCageHint,
  isArithmeticCageSolved,
} from "./arithmeticCageLogic";
export default function ArithmeticCageGarden(props: GameProps) {
  return <CageRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function CageRound(props: GameProps) {
  const level = arithmeticCageLevels[props.level] ?? arithmeticCageLevels[0],
    n = level.size;
  const active = useMemo(() => Array.from({ length: n * n }, (_, i) => i), [n]);
  const round = useArithmeticRound(props, {
    width: n,
    length: n * n,
    active,
    digits: n,
    introduction: `每行每列填 1–${n} 各一次。粗边框围成运算笼，角标是目标与运算。减法取大减小，除法取大除小且必须整除；笼内只受所在行列的重复限制。`,
    celebration: "每行每列不重复，所有运算笼也精确达标。算笼工坊完成！",
    solved: (values) => isArithmeticCageSolved(level, values),
    conflicts: (values) => arithmeticCageConflicts(level, values),
    hint: (values) => getArithmeticCageHint(level, values),
  });
  const owner = active.map((i) =>
      level.cages.findIndex((c) => c.cells.includes(i)),
    ),
    selectedCage = level.cages[owner[round.selected]];
  return (
    <div
      className="puzzle-layout ac-game"
      data-arithmetic-puzzle="arithmetic-cage"
      onKeyDown={round.keyboard}
    >
      <section className="ac-play" aria-label="算笼工坊游戏">
        <header className="ac-heading">
          <div>
            <span className="mini-label">
              ARITHMETIC CAGES · {n} × {n}
            </span>
            <h3>{level.title}</h3>
          </div>
          <span>{String(props.level + 1).padStart(2, "0")} / 12</span>
        </header>
        <p className="ac-lesson">{level.lesson}</p>
        <div
          className="ac-board ac-cage-board"
          role="group"
          aria-label="算笼棋盘"
          style={{ "--ac-columns": n } as CSSProperties}
        >
          {active.map((index) => {
            const cageIndex = owner[index],
              cage = level.cages[cageIndex],
              r = Math.floor(index / n),
              c = index % n;
            const style = {
              "--ac-cage-color": `var(--ac-cage-${cageIndex % 6})`,
              borderTopWidth: r === 0 || owner[index - n] !== cageIndex ? 3 : 1,
              borderBottomWidth:
                r === n - 1 || owner[index + n] !== cageIndex ? 3 : 1,
              borderLeftWidth:
                c === 0 || owner[index - 1] !== cageIndex ? 3 : 1,
              borderRightWidth:
                c === n - 1 || owner[index + 1] !== cageIndex ? 3 : 1,
            } as CSSProperties;
            return (
              <ArithmeticCell
                key={index}
                round={round}
                index={index}
                width={n}
                game="arithmetic-cage"
                style={style}
                label={`第 ${cageIndex + 1} 笼，${cage.target}${cage.op}，${cage.cells.length} 格`}
              >
                {index === Math.min(...cage.cells) && (
                  <span className="ac-cage-label" data-cage-clue={cageIndex}>
                    {cage.target}
                    {cage.op}
                  </span>
                )}
              </ArithmeticCell>
            );
          })}
        </div>
        <p className="ac-cage-detail" aria-label="所选运算笼">
          第 {owner[round.selected] + 1} 笼 · {selectedCage.target}
          {selectedCage.op} · {selectedCage.cells.length} 格
          {selectedCage.op === "−"
            ? " · 大数减小数"
            : selectedCage.op === "÷"
              ? " · 大数除小数，必须整除"
              : selectedCage.op === "="
                ? " · 单格直接填目标"
                : ` · 所有格${selectedCage.op === "+" ? "相加" : "相乘"}`}
        </p>
        <div className="ac-progress">
          <span>
            {round.won
              ? "全部运算精确达标 ✓"
              : round.conflicts.length
                ? `${round.conflicts.length} 格需要检查 !`
                : "行列各数一次 · 粗框圈定运算"}
          </span>
          <span>
            {round.state.values.filter(Boolean).length} / {n * n} 格
          </span>
        </div>
        <ArithmeticPad round={round} digits={n} />
      </section>
      <aside className="game-notes ac-guide">
        <span className="mini-label">因数 · 运算 · 交叉排除</span>
        <h3>一个笼，一条等式。</h3>
        <p>
          每行、每列都恰好包含 1–{n}
          ，不设数独小宫。粗边框围成一笼，左上角的目标和运算作用于笼内全部格子；颜色只帮助分辨，边框和朗读标签也能辨认。
        </p>
        <div className="ac-example">
          <b>6×</b>
          <span>2</span>
          <span>3</span>
          <small>乘积等于 6，先考虑因数组合，再检查所在行列。</small>
        </div>
        <div className="note">
          <strong>减法与除法不用猜顺序</strong>
          <p>
            − 和 ÷ 仅用于两格：大数减小数，或大数除小数，除法必须整除。+ 与 ×
            使用笼中所有数字。= 是单格目标。
          </p>
        </div>
        <p>
          同一笼若跨行跨列，可以出现相同数字；同一行或同一列始终不能重复。先用因数、和数范围或商锁定组合，再判断位置。
        </p>
        <p className="muted">
          方向键选择；1–{n} 输入；0、Delete 或 Backspace
          清空。也可全程触屏。提示会按当前填写完整枚举后再给结论；预算不足时明确说明。
        </p>
      </aside>
    </div>
  );
}
