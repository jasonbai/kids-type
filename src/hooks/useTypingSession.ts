import { useCallback, useEffect, useRef, useState } from 'react';
import type { Level } from '../types';
import type { SessionItem } from '../lib/session-items';
import { judgeKey } from '../lib/judge';
import { speak, unlockSpeech, type SpeakOptions } from '../lib/speech';
import { panForCode, playComplete, playTypeKey, playWrong, unlockAudio } from '../lib/sound';

/** 单条练习结果（由 store 调度 SRS / 错题本 / 日志） */
export interface WordResult {
  wordId: string;
  word: string;
  /** 该词所属词池（新词游标推进用） */
  level: Level;
  /** 本条目是否一次未错 */
  correct: boolean;
  /** 打错的字符（去重） */
  wrongLetters: string[];
  seconds: number;
  /** 条目类型：单词或例句（统计口径与文案区分用） */
  kind: 'word' | 'sentence';
}

export interface SessionSummary {
  totalWords: number;
  correctWords: number;
}

export type SessionPhase = 'ready' | 'typing' | 'celebrating' | 'done';

interface Options {
  items: SessionItem[];
  /** 条目完成后庆祝 + 朗读的停顿 */
  wordIntervalMs?: number;
  /** 打错的条目自动排到队尾，当日额外重复一次 */
  repeatWrong?: boolean;
  /** 朗读参数（语速/音色，来自设置） */
  speakOptions?: SpeakOptions;
  onWordResult?: (r: WordResult) => void;
  onSessionComplete?: (summary: SessionSummary) => void;
}

/**
 * 打字会话核心：window keydown → judgeKey 判定（严格模式）→ 推进。
 * 按键边界处理：
 * - 拦截 Tab/方向键（防滚动与焦点跳动）、Backspace（严格模式无退格）
 * - 空格放行给判定（例句练习需要），仅阻止页面滚动
 * - 忽略输入法合成态（isComposing / keyCode 229）与一切修饰键组合
 * - CapsLock 状态检测（页面展示提示横幅）
 */
export function useTypingSession({
  items,
  wordIntervalMs = 800,
  repeatWrong = true,
  speakOptions,
  onWordResult,
  onSessionComplete,
}: Options) {
  // 队列独立于入参：打错的条目会被追加到队尾（当日重复）
  const [queue, setQueue] = useState<SessionItem[]>(items);
  const queueRef = useRef(queue);
  const repeatedRef = useRef<Set<string>>(new Set());

  const [index, setIndex] = useState(0);
  const [inputLen, setInputLen] = useState(0);
  /** 当前标红（答错）的字符下标 */
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  /** 刚才按错的键（虚拟键盘闪红） */
  const [wrongChar, setWrongChar] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [phase, setPhase] = useState<SessionPhase>('ready');
  const [correctKeys, setCorrectKeys] = useState(0);
  const [wrongKeys, setWrongKeys] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const startedAtRef = useRef(0);
  const wordStartedAtRef = useRef(0);
  const wrongLettersRef = useRef<string[]>([]);
  const timersRef = useRef<number[]>([]);
  /** TTS 是否已解锁（用状态而非 ref：按钮解锁后要触发新条目朗读 effect） */
  const [speechUnlocked, setSpeechUnlocked] = useState(false);
  const correctWordsRef = useRef(0);

  const current = queue[index];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setQueue(items);
    queueRef.current = items;
    repeatedRef.current = new Set();
    setIndex(0);
    setInputLen(0);
    setWrongIndex(null);
    setWrongChar(null);
    setPhase('ready');
    setCorrectKeys(0);
    setWrongKeys(0);
    setElapsedSec(0);
    startedAtRef.current = 0;
    wordStartedAtRef.current = 0;
    wrongLettersRef.current = [];
    correctWordsRef.current = 0;
  }, [clearTimers, items]);

  // 词库/模式切换（items 引用变化）时重置会话
  useEffect(() => {
    reset();
  }, [items, reset]);

  // 组件卸载时清理计时器
  useEffect(() => () => clearTimers(), [clearTimers]);

  // 计时器：进入 typing 后每 500ms 刷新用时
  useEffect(() => {
    if (phase !== 'typing') return;
    const t = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [phase]);

  // 新条目出现自动朗读（TTS 已解锁时；Safari 需首次手势，见 beginSession）
  // 例句条目读整句，词条目读单词。
  useEffect(() => {
    if (!current) return;
    if (speechUnlocked && (phase === 'ready' || phase === 'typing')) {
      speak(current.text, speakOptions);
    }
  }, [current, phase, speechUnlocked, speakOptions]);

  /** 解锁 TTS 与键盘音效（"开始"按钮或首个按键调用；必须在用户手势内执行） */
  const beginSession = useCallback(() => {
    unlockSpeech();
    unlockAudio();
    setSpeechUnlocked(true);
  }, []);

  /** 打完一条：记录结果 → 朗读 + 庆祝 → 停顿后切下一条 */
  const finishWord = useCallback(() => {
    if (!current) return;
    const seconds = wordStartedAtRef.current ? (Date.now() - wordStartedAtRef.current) / 1000 : 0;
    const wasWrong = wrongLettersRef.current.length > 0;
    const result: WordResult = {
      wordId: current.word.id,
      word: current.word.word,
      level: current.word.levels[0],
      correct: !wasWrong,
      wrongLetters: [...new Set(wrongLettersRef.current)],
      seconds,
      kind: current.kind,
    };
    if (result.correct) correctWordsRef.current += 1;
    onWordResult?.(result);

    // 当日重复：打错的条目排到队尾（按条目键去重，只额外出现一次）
    let nextQueue = queueRef.current;
    if (repeatWrong && wasWrong && !repeatedRef.current.has(current.key)) {
      repeatedRef.current.add(current.key);
      nextQueue = [...queueRef.current, current];
      setQueue(nextQueue);
    }
    queueRef.current = nextQueue;

    setPhase('celebrating');
    // 例句打完回读主题词，强化"词—语境"关联；词条目仍读整词
    speak(current.kind === 'sentence' ? current.word.word : current.text, speakOptions);

    const nextIndex = index + 1;
    const t = window.setTimeout(() => {
      wrongLettersRef.current = [];
      setWrongIndex(null);
      setWrongChar(null);
      if (nextIndex >= nextQueue.length) {
        setPhase('done');
        onSessionComplete?.({ totalWords: nextQueue.length, correctWords: correctWordsRef.current });
      } else {
        setIndex(nextIndex);
        setInputLen(0);
        wordStartedAtRef.current = Date.now();
        setPhase('typing');
      }
    }, wordIntervalMs);
    timersRef.current.push(t);
  }, [current, index, repeatWrong, speakOptions, onWordResult, onSessionComplete, wordIntervalMs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === 'function') {
        const on = e.getModifierState('CapsLock');
        setCapsLockOn((prev) => (prev === on ? prev : on));
      }
      if (phase !== 'ready' && phase !== 'typing') return;
      // 输入法合成态
      if (e.isComposing || e.keyCode === 229) return;
      // 修饰键组合放行给系统快捷键
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 空格：阻止页面滚动后仍参与判定（例句练习需要）
      if (e.key === ' ') e.preventDefault();
      // 拦截焦点移动键；严格模式无退格
      if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Backspace') {
        e.preventDefault();
        return;
      }
      if (e.key.length !== 1) return; // Enter / F 键等
      if (!current) return;

      // 首次按键解锁 TTS 与音频
      if (!speechUnlocked) beginSession();

      const result = judgeKey(current.text, inputLen, e.key);
      if (!result) return; // 非可输入字符忽略

      if (phase === 'ready') {
        setPhase('typing');
        startedAtRef.current = Date.now();
        wordStartedAtRef.current = Date.now();
      }

      // 打字机击键音：普通键 80ms 切片，空格更长；按物理键位左右 pan。
      // 答错只保留低沉错误音（不叠打字机音，保证错误反馈的辨识度）。
      const typeSound = () => playTypeKey(e.key === ' ' ? 'space' : 'default', panForCode(e.code));

      if (result.type === 'wrong') {
        e.preventDefault();
        playWrong();
        setWrongKeys((n) => n + 1);
        wrongLettersRef.current.push(e.key.toLowerCase());
        setWrongIndex(inputLen);
        setWrongChar(e.key.toLowerCase());
        const t = window.setTimeout(() => setWrongChar(null), 350);
        timersRef.current.push(t);
        return;
      }

      setWrongIndex(null);
      setWrongChar(null);
      setInputLen(inputLen + 1);
      setCorrectKeys((n) => n + 1);
      typeSound();
      if (result.type === 'complete') {
        playComplete();
        finishWord();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, inputLen, current, finishWord, speechUnlocked, beginSession]);

  /** 跳过当前条目（不计成绩、不调度） */
  const skip = useCallback(() => {
    if (phase !== 'ready' && phase !== 'typing') return;
    clearTimers();
    wrongLettersRef.current = [];
    setWrongIndex(null);
    setWrongChar(null);
    const nextIndex = index + 1;
    if (nextIndex >= queueRef.current.length) {
      setPhase('done');
      onSessionComplete?.({
        totalWords: queueRef.current.length,
        correctWords: correctWordsRef.current,
      });
    } else {
      setIndex(nextIndex);
      setInputLen(0);
      wordStartedAtRef.current = Date.now();
    }
  }, [phase, index, clearTimers, onSessionComplete]);

  return {
    current,
    index,
    /** 队列总长（含当日重复追加的条目） */
    total: queue.length,
    phase,
    inputLen,
    wrongIndex,
    wrongChar,
    capsLockOn,
    correctKeys,
    wrongKeys,
    elapsedSec,
    restart: reset,
    skip,
    /** 用户手势内调用：解锁 TTS/音效并朗读当前条目（开始遮罩按钮用） */
    beginSession,
  };
}
