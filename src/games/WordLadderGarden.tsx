// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import { wordLadderLevels } from "./wordLadderLevels";
import { createWordLadderState, currentLadderWord, ladderHint, ladderSolved, letterDistance, stepWordLadder, undoWordLadder } from "./wordLadderLogic";
import { loadWordLadderRound, saveWordLadderRound } from "./wordLadderStorage";
import "./wordLadderGarden.css";

export default function WordLadderGarden(props: GameProps) {
  const key = `${props.level}:${props.resetToken}`;
  const previous = useRef({ key, level: props.level, fresh: false });
  if (previous.current.key !== key) previous.current = { key, level: props.level, fresh: previous.current.level === props.level };
  return <WordLadderRound key={key} {...props} fresh={Boolean(props.freshStart || previous.current.fresh)} />;
}

function WordLadderRound({ level, paused, hintToken, undoToken, onComplete, onStatus, fresh }: GameProps & { fresh: boolean }) {
  const puzzle = wordLadderLevels[level] ?? wordLadderLevels[0];
  const [state, setState] = useState(() => fresh ? createWordLadderState(puzzle) : loadWordLadderRound(level, puzzle));
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("每次只换一个字母。点击词本可填入候选词，再点“走到这个词”。");
  const [hasError, setHasError] = useState(false);
  const [hintedWord, setHintedWord] = useState("");
  const [saved, setSaved] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  const completed = useRef(false);
  const tokens = useRef({ hintToken, undoToken });
  const callbacks = useRef({ onComplete, onStatus });
  callbacks.current = { onComplete, onStatus };
  const current = currentLadderWord(state), won = ladderSolved(puzzle, state), steps = state.path.length - 1;
  const openingHint = useMemo(() => ladderHint(puzzle, puzzle.start), [puzzle]);
  const gloss = (word: string) => puzzle.book.find(entry => entry.word === word)?.gloss ?? "";
  const routeStart = Math.max(0, state.path.length - 14);
  function report(text: string, error = false) { setMessage(text); setHasError(error); callbacks.current.onStatus(text); }
  function replace(next: typeof state) { stateRef.current = next; setState(next); }

  useEffect(() => { setSaved(saveWordLadderRound(level, puzzle, state)); }, [level, puzzle, state]);
  useEffect(() => {
    callbacks.current.onStatus(stateRef.current.path.length > 1
      ? `已接回这条词语小径，走了 ${stateRef.current.path.length - 1} 步。词本和撤销记录都在。`
      : "每步恰好换一个英文字母，使用本关词本，走到目标词就成功。不限时，也没有步数上限。");
  }, []);
  useEffect(() => {
    if (!won || paused || completed.current) return;
    completed.current = true;
    report(`抵达 ${puzzle.target}！这条路线实际走了 ${steps} 步。${openingHint && steps === openingHint.remaining ? "也找到了本关的一条最短路线。" : "每条合法路线都算成功，可以重来找另一条路。"}`);
    callbacks.current.onComplete();
  }, [won, paused, steps, puzzle.target, openingHint]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (paused || won) return;
    const before = stateRef.current, next = undoWordLadder(before);
    replace(next); setDraft(""); setHintedWord("");
    report(next === before ? "还在起点，没有可撤销的一步。" : `已撤销一步，回到 ${currentLadderWord(next)}。`);
  }, [undoToken, paused, won]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (paused || won) return;
    const from = currentLadderWord(stateRef.current), hint = ladderHint(puzzle, from);
    if (!hint) { report("词本中暂时找不到路，试着撤销回到前一个词。"); return; }
    setDraft(hint.next); setHintedWord(hint.next);
    report(`从 ${from} 出发，最少还要 ${hint.remaining} 步。可以先试 ${hint.next}（${gloss(hint.next)}），再点“走到这个词”。提示不会替你走。`);
  }, [hintToken, paused, won, puzzle]);

  function submit() {
    if (paused || ladderSolved(puzzle, stateRef.current)) return;
    const before = currentLadderWord(stateRef.current), result = stepWordLadder(puzzle, stateRef.current, draft);
    if (result.error) { report(result.error, true); return; }
    const next = currentLadderWord(result.state);
    replace(result.state); setDraft(""); setHintedWord("");
    report(`${before} → ${next}（${gloss(next)}），走了 ${result.state.path.length - 1} 步。`);
    if (!ladderSolved(puzzle, result.state)) inputRef.current?.focus({ preventScroll: true });
  }

  return <div className="wl-game" data-word-ladder-id={puzzle.id} data-word-ladder-current={current} data-word-ladder-steps={steps} data-word-ladder-won={won} data-word-ladder-hint={hintedWord}>
    <section className="wl-play" aria-label="变词小径游戏">
      <header className="wl-heading"><div><span className="wl-eyebrow">LETTER TRAIL · {puzzle.start.length} 字母小径</span><h3>{puzzle.title}</h3></div><span className="wl-level">{String(level + 1).padStart(2, "0")} / {wordLadderLevels.length}</span></header>
      <p className="wl-lesson">{puzzle.lesson}</p>
      <div className="wl-destination"><div className="wl-current"><span>现在在这里</span><strong data-word-ladder-word>{current}</strong><small>{gloss(current)}</small></div><span className="wl-bridge" aria-hidden="true">· · →</span><div className="wl-target"><span>目标词</span><strong>{puzzle.target}</strong><small>{gloss(puzzle.target)}</small></div></div>
      <div className="wl-stats"><span>实际步数 <strong data-word-ladder-count>{steps}</strong></span><span>开局最少 <strong>{openingHint?.remaining ?? "—"}</strong> 步</span><span className="wl-state">{paused ? "已暂停" : won ? "抵达了 ✓" : "允许绕路与回头"}</span></div>
      <form className="wl-entry" onSubmit={event => { event.preventDefault(); submit(); }}>
        <label htmlFor="wl-next-word">下一块踏脚石</label>
        <div className="wl-entry-row"><input id="wl-next-word" ref={inputRef} value={draft} type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16} disabled={paused || won} placeholder={`${puzzle.start.length} 个英文字母`} aria-invalid={hasError} aria-describedby="wl-entry-help wl-message" onChange={event => { setDraft(event.target.value.toUpperCase()); setHintedWord(""); setHasError(false); }} onKeyDown={event => { if (event.key === "Enter" && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) event.preventDefault(); }} /><button type="submit" className="wl-submit" disabled={paused || won || !draft.trim()} onClick={event => { if (event.ctrlKey || event.metaKey || event.altKey) event.preventDefault(); }}>走到这个词 <span aria-hidden="true">→</span></button></div>
        <p id="wl-entry-help">输入后按 Enter，或点下方词卡填入，再确认。只改 1 个字母，不能换位。</p>
      </form>
      <p id="wl-message" className={`wl-message ${hasError ? "wl-error" : ""}`} role="note">{message}</p>
      <section className="wl-route" aria-label="已走过的路线"><div className="wl-section-heading"><h4>你的词语足迹</h4><span>{steps ? `${steps} 次合法变词` : "从这里出发"}</span></div>{routeStart > 0 && <p className="wl-older">前面还有 {routeStart} 个词；这里只显示最近 14 个。撤销保留全部步骤。</p>}<ol start={routeStart + 1}>{state.path.slice(routeStart).map((word, offset) => { const index = routeStart + offset, previousWord = state.path[index - 1]; return <li key={index} aria-label={`${index === 0 ? "起点" : `第 ${index} 步`} ${word}`} className={index === state.path.length - 1 ? "wl-at" : ""}><span className="wl-route-number">{index === 0 ? "起" : index}</span><strong>{word.split("").map((letter, column) => <span key={column} className={previousWord && previousWord[column] !== letter ? "wl-changed" : ""}>{letter}</span>)}</strong></li>; })}</ol></section>
      <p className={`wl-save ${saved ? "" : "wl-save-warning"}`}>{saved ? "本局和撤销记录只保存在这个浏览器，离开后可以继续。" : "最新步骤暂时无法保存，离开后可能恢复较早进度。请保持页面打开；仍可继续玩和撤销。"}</p>
    </section>
    <aside className="wl-wordbook" aria-label="本关公开词本">
      <div className="wl-section-heading"><div><span className="wl-eyebrow">LOCAL WORDBOOK</span><h3>这一本，就是全部。</h3></div><span className="wl-book-count">{puzzle.book.length} 词</span></div>
      <p>本关只用这些词。带“可走”的词恰好相差一个字母；先填入，再确认。中文只是帮助认词。</p>
      <div className="wl-book-grid">{puzzle.book.map(entry => { const neighbor = letterDistance(current, entry.word) === 1, selected = draft.trim().toUpperCase() === entry.word; return <button type="button" key={entry.word} className={`wl-word ${entry.word === current ? "wl-word-current" : ""} ${neighbor ? "wl-neighbor" : ""} ${selected ? "wl-selected" : ""}`} data-word-ladder-book={entry.word} data-word-ladder-neighbor={neighbor} aria-label={`填入 ${entry.word}，${entry.gloss}${entry.word === current ? "，当前词" : neighbor ? "，可走" : ""}${entry.word === puzzle.target ? "，目标" : ""}`} aria-pressed={selected} disabled={paused || won} onClick={event => { if (event.ctrlKey || event.metaKey || event.altKey || paused || won) return; setDraft(entry.word); setHasError(false); setHintedWord(""); }}><strong>{entry.word}</strong><span>{entry.gloss}</span><small>{entry.word === current ? "当前" : entry.word === puzzle.target ? neighbor ? "可走 · 目标" : "目标" : neighbor ? "可走" : "词本"}</small></button>; })}</div>
      <div className="wl-rules"><h4>一字之差，一步之遥。</h4><ol><li>只替换一个位置的字母。</li><li>新词必须在本关词本里。</li><li>走到目标就成功，不要求固定路线。</li></ol><p>没有计时或步数惩罚。回头会计作一步，撤销会收回上一步。暂停时不能填词或变词；Escape 可暂停 / 继续。</p><p>提示从当前词搜索公开词本，只给下一步建议。词本之外的词即使是真词，也不属于这关的道路。</p></div>
    </aside>
  </div>;
}
