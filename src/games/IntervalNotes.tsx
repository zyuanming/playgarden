// SPDX-License-Identifier: GPL-3.0-only
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameProps } from "../lib/types";
import {
  intervalNotesDegree,
  intervalNotesFrequency,
  intervalNotesHint,
  intervalNotesLabels,
  intervalNotesLevels,
  intervalNotesMatches,
  intervalNotesScale,
  type IntervalPair,
} from "./intervalNotesLogic";
import "./intervalNotes.css";

type Voice = { oscillator: OscillatorNode; gain: GainNode };
type Playback = "idle" | "starting" | "playing" | "unavailable";

/** Creates an audio context only inside a user's explicit play-button gesture. */
function useIntervalPlayback(pair: IntervalPair, question: number, blocked: boolean) {
  const [playback, setPlayback] = useState<Playback>("idle");
  const mounted = useRef(false);
  const audio = useRef({ context: null as AudioContext | null, voices: new Set<Voice>(), generation: 0 });
  const live = useRef({ blocked, question });
  live.current = { blocked, question };

  const stop = useCallback((update = true) => {
    const session = audio.current;
    session.generation++;
    for (const voice of session.voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* Already stopped or not started. */ }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    session.voices.clear();
    if (update && mounted.current) setPlayback("idle");
  }, []);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop(false);
      const context = audio.current.context;
      audio.current.context = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, [stop]);

  // Synchronous cleanup invalidates a pending resume before a new question paints.
  useLayoutEffect(() => { stop(); }, [blocked, question, stop]);

  async function play() {
    if (live.current.blocked || !mounted.current) return;
    stop();
    const session = audio.current;
    const generation = session.generation;
    const currentQuestion = live.current.question;
    const current = () => mounted.current && session.generation === generation &&
      !live.current.blocked && live.current.question === currentQuestion;
    setPlayback("starting");
    try {
      const AudioConstructor = window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioConstructor) throw new Error("Web Audio unavailable");
      const context = session.context?.state !== "closed" && session.context
        ? session.context : new AudioConstructor();
      session.context = context;
      if (context.state !== "running") await context.resume();
      // Resume may settle after mute, pause, another play, reset, or unmount.
      if (!current()) return;
      if (context.state !== "running") throw new Error("Audio remains suspended");
      const start = context.currentTime + 0.035;
      pair.forEach((position, i) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const voice = { oscillator, gain };
        session.voices.add(voice);
        const at = start + i * 0.57;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(intervalNotesFrequency(position), at);
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.14, at + 0.025);
        gain.gain.linearRampToValueAtTime(0.10, at + 0.30);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
        gain.gain.setValueAtTime(0, at + 0.44);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          session.voices.delete(voice);
          oscillator.disconnect();
          gain.disconnect();
          // Old onended callbacks cannot reset a newer playback state.
          if (current() && session.voices.size === 0) setPlayback("idle");
        };
        oscillator.start(at);
        oscillator.stop(at + 0.45);
      });
      if (current()) setPlayback("playing");
    } catch {
      if (!current()) return;
      stop();
      setPlayback("unavailable");
    }
  }
  return { playback, play, stop };
}

function ScalePicture({ pair, showHint }: { pair: IntervalPair; showHint: boolean }) {
  const low = Math.min(...pair), high = Math.max(...pair);
  return <figure className="ipn-scale" aria-label="公开音阶位置图">
    <div className="ipn-scale-caption"><strong>看图模式 · 一直可用</strong><span>低音 → 高音</span></div>
    <svg viewBox="0 0 640 292" role="img" aria-label={`音阶位置图：第一音 ${intervalNotesScale[pair[0]].name}，位置 ${pair[0] + 1}；第二音 ${intervalNotesScale[pair[1]].name}，位置 ${pair[1] + 1}`}>
      <path className="ipn-contour" d="M12 235 H91 V214 H169 V193 H247 V172 H325 V151 H403 V130 H481 V109 H559 V88 H628" />
      {intervalNotesScale.map((note, i) => {
        const x = 52 + i * 77, y = 218 - i * 21;
        const first = pair[0] === i, second = pair[1] === i;
        return <g key={note.name} className={showHint && i >= low && i <= high ? "ipn-counted" : ""}>
          <path className="ipn-column" d={`M${x} ${y + 12} V242`} />
          <circle className="ipn-position" cx={x} cy={y} r="7" />
          {first && <g><circle className="ipn-first-note" cx={x - (second ? 13 : 0)} cy={y - 1} r="18" /><text className="ipn-note-letter" x={x - (second ? 13 : 0)} y={y + 5}>A</text></g>}
          {second && <g><circle className="ipn-second-note" cx={x + (first ? 13 : 0)} cy={y - (first ? 31 : 1)} r="18" /><text className="ipn-note-letter" x={x + (first ? 13 : 0)} y={y - (first ? 25 : -5)}>B</text></g>}
          <text className="ipn-note-name" x={x} y="263">{note.name}</text>
          <text className="ipn-note-index" x={x} y="282">位置 {i + 1}</text>
        </g>;
      })}
      <text className="ipn-diagram-label" x="22" y="28">C 大调自然音 · C4—C5</text>
      <text className="ipn-diagram-subtitle" x="22" y="49">每一阶代表一个音名位置</text>
    </svg>
    <figcaption>这是音阶位置示意图；台阶等距，不代表半音距离，也不是五线谱。</figcaption>
  </figure>;
}

export default function IntervalNotes(props: GameProps) {
  return <IntervalRound key={`${props.level}:${props.resetToken}`} {...props} />;
}

function IntervalRound({ level, paused, muted = false, hintToken, undoToken, onStatus, onComplete }: GameProps) {
  const config = intervalNotesLevels[level] ?? intervalNotesLevels[0];
  const [solved, setSolved] = useState(0);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState({ kind: "ready", text: "先找到 A、B 两个音。把两端都算上，选择它们的级数距离。" });
  const [hidden, setHidden] = useState(() => document.visibilityState === "hidden");
  const tokens = useRef({ hintToken, undoToken });
  const progress = useRef(0), notified = useRef(false);
  const callbacks = useRef({ onStatus, onComplete });
  callbacks.current = { onStatus, onComplete };
  const won = solved === config.pairs.length;
  const locked = paused || hidden || won;
  const pair = config.pairs[Math.min(solved, config.pairs.length - 1)];
  const { playback, play, stop } = useIntervalPlayback(pair, solved, locked || muted);
  const message = paused || hidden ? "已暂停。声音已停止，回来后可重新点击播放。" : won
    ? "三组音程全部答对！你已经读懂这一课的音阶距离。" : hint ? intervalNotesHint(pair) : feedback.text;

  useEffect(() => {
    const changed = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => { callbacks.current.onStatus(message); }, [message]);
  useEffect(() => {
    if (won && !paused && !notified.current) {
      notified.current = true;
      callbacks.current.onComplete();
    }
  }, [won, paused]);
  useEffect(() => {
    if (tokens.current.hintToken === hintToken) return;
    tokens.current.hintToken = hintToken;
    if (!locked) setHint(true);
  }, [hintToken, locked]);
  useEffect(() => {
    if (tokens.current.undoToken === undoToken) return;
    tokens.current.undoToken = undoToken;
    if (locked) return;
    stop();
    setHint(false);
    if (progress.current > 0) {
      progress.current--;
      setSolved(progress.current);
      setFeedback({ kind: "ready", text: "已撤销上一题的正确回答，回到那组音重新判断。" });
    } else setFeedback({ kind: "ready", text: "还没有正确回答可以撤销。答错不会推进题目。" });
  }, [undoToken, locked, stop]);

  function answer(choice: number) {
    if (locked || progress.current !== solved) return;
    setHint(false);
    if (!intervalNotesMatches(pair, choice)) {
      setFeedback({ kind: "wrong", text: `${intervalNotesLabels[choice - 1]}还不符合这组音。再从 A 数到 B，起点和终点都要算；题目没有前进。` });
      return;
    }
    stop();
    progress.current++;
    setSolved(progress.current);
    setFeedback({ kind: "correct", text: `答对了！${intervalNotesScale[pair[0]].name} 到 ${intervalNotesScale[pair[1]].name} 是${intervalNotesLabels[choice - 1]}。接着看看新的一组。` });
  }

  return <div
    className="ipn-game"
    tabIndex={0}
    aria-label="音程阶梯工作区，数字键 1 至 8 选择音程"
    data-ipn-won={won}
    data-ipn-completed={solved}
    data-ipn-question={Math.min(solved + 1, 3)}
    data-ipn-playback={playback}
    onKeyDown={(event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.nativeEvent.isComposing) return;
      if ((event.target as HTMLElement).closest("input, select, textarea, [contenteditable='true']")) return;
      if (event.repeat && ["Enter", " "].includes(event.key)) { event.preventDefault(); return; }
      if (/^[1-8]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) answer(Number(event.key));
      }
    }}
  >
    <section className="ipn-workbench" aria-label="音程练习台">
      <header className="ipn-heading"><div><span className="ipn-eyebrow">音程阶梯 · 第 {level + 1} 课</span><h3>{config.title}</h3></div><span className="ipn-seal" aria-hidden="true">♪</span></header>
      <div className="ipn-progress" aria-label={`已答对 ${solved} 题，共 3 题`}><strong>{solved}<small> / 3 题</small></strong><ol>{config.pairs.map((_, i) => <li key={i} className={i < solved ? "ipn-done" : i === solved ? "ipn-current" : ""} aria-label={`第 ${i + 1} 题${i < solved ? "已答对" : i === solved ? "作答中" : "待作答"}`}>{i < solved ? "✓" : i + 1}</li>)}</ol><span>不限时 · 可看图</span></div>
      <div className="ipn-pair" aria-label="当前两音，顺序为 A 再 B">
        <div data-ipn-note="first"><span>A · 第一音</span><strong>{intervalNotesScale[pair[0]].name}</strong><small>音阶位置 {pair[0] + 1}</small></div>
        <span className="ipn-pair-arrow" aria-hidden="true">→</span>
        <div data-ipn-note="second"><span>B · 第二音</span><strong>{intervalNotesScale[pair[1]].name}</strong><small>音阶位置 {pair[1] + 1}</small></div>
      </div>
      <ScalePicture pair={pair} showHint={hint && !locked} />
      <div className="ipn-audio-row"><button type="button" className="ipn-play" data-ipn-play disabled={locked || muted} onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        if (playback === "playing" || playback === "starting") stop(); else void play();
      }}><span aria-hidden="true">{playback === "playing" || playback === "starting" ? "■" : "▷"}</span>{muted ? "已静音" : playback === "playing" || playback === "starting" ? "停止播放" : "播放两音"}</button><p className="ipn-audio-note" role="status">{muted ? "看图照常作答，声音不是通关条件。" : playback === "unavailable" ? "当前设备未能播放声音，请直接看图作答。" : playback === "starting" ? "正在准备声音；看图仍可作答。" : playback === "playing" ? "先听 A，再听 B。播放不会计分。" : "声音可选。点击才会播放两个合成音。"}</p></div>
      <div className="ipn-answer-heading"><strong>{won ? "这一课完成了" : `第 ${solved + 1} 题 · 相隔几度？`}</strong><span>包含起点，也包含终点</span></div>
      <div className="ipn-answers" role="group" aria-label="选择音程级数">
        {intervalNotesLabels.map((label, i) => <button type="button" key={label} data-ipn-answer={i + 1} className={hint && intervalNotesDegree(pair) === i + 1 ? "ipn-hinted" : ""} disabled={locked} onClick={(event) => {
          if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) answer(i + 1);
        }}><span>{i + 1}</span><strong>{label}</strong></button>)}
      </div>
      <p className={`ipn-feedback ${won ? "ipn-success" : hint ? "ipn-hint" : feedback.kind === "wrong" ? "ipn-wrong" : ""}`} role="status">{message}</p>
    </section>
    <aside className="ipn-guide"><span className="ipn-eyebrow">音高 · 音名 · 距离</span><h3>两枚音符，<br />隔着几级台阶？</h3><p>{config.lesson}</p><div className="ipn-rule-card"><strong>把两端也数进去</strong><p>C4 → D4 → E4</p><span>三个音名位置 = 三度</span></div><ol><li>看 A 和 B 的音名，或按“播放两音”先后聆听。</li><li>沿音阶数位置，起点与终点都算一个。同一个音只算一次。</li><li>选择同度到八度。答错可重试，答对三题完成一课。</li></ol><p className="ipn-scope">本练习只判断音程的级数，不区分大、小、纯、增、减。上下行的级数相同；位置相邻也不一定相差同样多的半音。</p><div className="ipn-footnote"><strong>安静地练习，也很好。</strong><p>图和音名始终公开。无需录音或麦克风；静音或无法播放时，仍可完成全部关卡。</p><p>撤销回到上一道答对的题；重来清空本课进度。暂停、静音或换题会停止播放，不会自动重播。</p></div><p className="ipn-keyboard">触屏轻点；键盘 Tab 进入工作区，按 1–8 选择，或 Tab 选按钮后按 Enter / 空格。没有速度要求。</p></aside>
  </div>;
}
