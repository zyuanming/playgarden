import { useMemo, type CSSProperties } from "react";
import type { GameProps } from "../lib/types";
import {
  ArithmeticCell,
  ArithmeticPad,
  useArithmeticRound,
} from "./ArithmeticConstraintBoard";
import {
  getKakuroHint,
  isKakuroSolved,
  kakuroConflicts,
  kakuroLevels,
  kakuroProblem,
  kakuroRuns,
} from "./kakuroLogic";
export default function KakuroGarden(props: GameProps) {
  return <KakuroRound key={`${props.level}:${props.resetToken}`} {...props} />;
}
function KakuroRound(props: GameProps) {
  const level = kakuroLevels[props.level] ?? kakuroLevels[0],
    width = level.rows[0].length,
    height = level.rows.length;
  const problem = useMemo(() => kakuroProblem(level)!, [level]),
    runs = useMemo(() => kakuroRuns(level), [level]);
  const round = useArithmeticRound(props, {
    width,
    length: problem.length,
    active: problem.active,
    digits: 9,
    introduction:
      "白格填 1–9。箭头给出后面连续白格的总和，遇到深色格即停止；同一段数字不重复。横段和竖段在白格交叉。",
    celebration: "所有横竖和数都对上了，每一段也没有重复。和数庭院完成！",
    solved: (values) => isKakuroSolved(level, values),
    conflicts: (values) => kakuroConflicts(level, values),
    hint: (values) => getKakuroHint(level, values),
  });
  const clues = new Map<string, { across?: number; down?: number }>();
  runs.forEach((run) => {
    const first = run.cells[0],
      r = Math.floor(first / width) + (run.direction === "across" ? 1 : 0),
      c = (first % width) + (run.direction === "down" ? 1 : 0),
      key = `${r}:${c}`;
    clues.set(key, { ...clues.get(key), [run.direction]: run.sum });
  });
  const selectedRuns = runs.filter((run) => run.cells.includes(round.selected));
  return (
    <div
      className="puzzle-layout ac-game"
      data-arithmetic-puzzle="kakuro"
      onKeyDown={round.keyboard}
    >
      <section className="ac-play" aria-label="和数庭院游戏">
        <header className="ac-heading">
          <div>
            <span className="mini-label">CROSS SUMS · 1–9</span>
            <h3>{level.title}</h3>
          </div>
          <span>{String(props.level + 1).padStart(2, "0")} / 12</span>
        </header>
        <p className="ac-lesson">{level.lesson}</p>
        <div
          className="ac-board ac-kakuro-board"
          role="group"
          aria-label="和数棋盘"
          style={{ "--ac-columns": width + 1 } as CSSProperties}
        >
          {Array.from({ length: (width + 1) * (height + 1) }, (_, p) => {
            const r = Math.floor(p / (width + 1)),
              c = p % (width + 1),
              index = (r - 1) * width + c - 1;
            if (r && c && level.rows[r - 1][c - 1] === ".")
              return (
                <ArithmeticCell
                  key={p}
                  round={round}
                  index={index}
                  width={width}
                  game="kakuro"
                  label="填 1–9"
                />
              );
            const clue = clues.get(`${r}:${c}`);
            return (
              <div
                key={p}
                className={`ac-clue ${clue ? "ac-clue-active" : ""}`}
                aria-label={
                  clue
                    ? [
                        clue.across && `向右连续白格总和 ${clue.across}`,
                        clue.down && `向下连续白格总和 ${clue.down}`,
                      ]
                        .filter(Boolean)
                        .join("；")
                    : "分隔格"
                }
              >
                {clue?.across && (
                  <span className="ac-across">→{clue.across}</span>
                )}
                {clue?.down && <span className="ac-down">↓{clue.down}</span>}
              </div>
            );
          })}
        </div>
        <div className="ac-run-info" aria-label="所选格的和数段">
          {selectedRuns.map((run) => (
            <span key={run.direction}>
              {run.direction === "across" ? "→ 横段" : "↓ 竖段"}{" "}
              {run.cells.length} 格，和 {run.sum}
            </span>
          ))}
        </div>
        <div className="ac-progress">
          <span>
            {round.won
              ? "全部和数正确 ✓"
              : round.conflicts.length
                ? `${round.conflicts.length} 格需要检查 !`
                : "每一段独立不重复"}
          </span>
          <span>
            {problem.active.filter((i) => round.state.values[i]).length} /{" "}
            {problem.active.length} 格
          </span>
        </div>
        <ArithmeticPad round={round} digits={9} />
      </section>
      <aside className="game-notes ac-guide">
        <span className="mini-label">组合 · 交叉 · 拆分</span>
        <h3>让横竖和数相遇。</h3>
        <p>
          每格填 1–9。→ 表示右边连续白格的和，↓
          表示下边连续白格的和。深色格把一整行或一整列切成独立的数字段。
        </p>
        <div className="ac-example">
          <b>→ 3</b>
          <span>1</span>
          <span>2</span>
          <small>两格和为 3，只能是 1、2；次序要看竖段。</small>
        </div>
        <div className="note">
          <strong>重复限制只属于同一段</strong>
          <p>
            同一个数字段内不能重复。被深色格隔开的不同段可以使用相同数字，棋盘没有“每行集齐
            1–9”的要求。
          </p>
        </div>
        <p>
          先找极小或极大的和数，列出可能组合，再用交叉的另一段确定位置。选中格子后，下方会显示它所在的两个数字段。
        </p>
        <p className="muted">
          方向键选择白格；1–9 输入；0、Delete 或 Backspace
          清空。下方数字键支持点击和触屏。提示根据当前填写重新求证，不会自动填入。
        </p>
      </aside>
    </div>
  );
}
