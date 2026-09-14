import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { DailyLog, Level, Meta, Settings, SrsRecord, WrongBookEntry } from '../types';
import type { WordResult } from '../hooks/useTypingSession';
import { KEYS } from '../storage/keys';
import { load, save } from '../storage/storage';
import { addDaysKey, todayKey } from '../lib/dateKey';
import { review, wasReviewedOn } from '../lib/srs';
import { setSoundEnabled, setSoundVolume } from '../lib/sound';

/** 错题本移出阈值：专项练习中连对 N 次*/
export const CLEAR_STREAK_GOAL = 2;
/** 错题本记录的常错字母上限 */
const MAX_WRONG_LETTERS = 5;

export interface LearningState {
  /** wordId → SrsRecord */
  records: Record<string, SrsRecord>;
  /** wordId → WrongBookEntry（含已移出历史） */
  wrongBook: Record<string, WrongBookEntry>;
  logs: DailyLog[];
  settings: Settings;
  meta: Meta;
}

export type LearningAction =
  | { type: 'RESULT'; result: WordResult }
  | { type: 'SETTINGS'; patch: Partial<Settings> }
  | { type: 'TOUCH_STREAK' }
  | { type: 'ADD_STARS'; count: number };

export const DEFAULT_SETTINGS: Settings = {
  voiceURI: null,
  rate: 1,
  keySound: true,
  keySoundVolume: 0.5,
  currentLevel: 'KET',
  dailyNewWords: 10,
  wordIntervalMs: 800,
  showHandGuide: true,
  practiceMode: 'word',
};

export const DEFAULT_META: Meta = {
  version: 1,
  streakDays: 0,
  lastActiveDate: null,
  newWordCursor: { KET: 0, PET: 0 },
  totalStars: 0,
};

function initState(): LearningState {
  return {
    records: load(KEYS.records, {} as LearningState['records']),
    wrongBook: load(KEYS.wrongBook, {} as LearningState['wrongBook']),
    logs: load(KEYS.logs, [] as DailyLog[]),
    settings: { ...DEFAULT_SETTINGS, ...load(KEYS.settings, {} as Partial<Settings>) },
    meta: { ...DEFAULT_META, ...load(KEYS.meta, {} as Partial<Meta>) },
  };
}

/**
 * RESULT：一次单词完成结果的全量调度。
 * - SRS：每词每天最多一次正式 review（当日队尾重复的那次被跳过， * - 错题本：打错入册/连对累加，连对达阈值移出
 * - 每日日志与 WPM 最优值
 * - 新词首次记录时推进对应词池游标
 */
function applyResult(state: LearningState, result: WordResult): LearningState {
  const today = todayKey();
  const now = new Date().toISOString();

  // --- SRS 调度（每日一次） ---
  const prev = state.records[result.wordId];
  const isNewWord = !prev;
  const alreadyReviewedToday = prev ? wasReviewedOn(prev, today) : false;
  const records = isNewWord || !alreadyReviewedToday
    ? { ...state.records, [result.wordId]: review(prev ?? null, result.wordId, result.correct, today) }
    : state.records;

  // --- 错题本 ---
  let wrongBook = state.wrongBook;
  const entry = wrongBook[result.wordId];
  if (!result.correct) {
    const letters = [...new Set([...(entry?.wrongLetters ?? []), ...result.wrongLetters])];
    wrongBook = {
      ...wrongBook,
      [result.wordId]: {
        wordId: result.wordId,
        wrongCount: (entry?.wrongCount ?? 0) + 1,
        wrongLetters: letters.slice(0, MAX_WRONG_LETTERS),
        clearStreak: 0,
        addedAt: entry?.addedAt ?? now,
        clearedAt: null, // 再次打错则留在（或回到）错题本
      },
    };
  } else if (entry && !entry.clearedAt) {
    const clearStreak = entry.clearStreak + 1;
    wrongBook = {
      ...wrongBook,
      [result.wordId]: {
        ...entry,
        clearStreak,
        clearedAt: clearStreak >= CLEAR_STREAK_GOAL ? now : null,
      },
    };
  }

  // --- 每日日志 ---
  const idx = state.logs.findIndex((l) => l.date === today);
  const base: DailyLog =
    idx >= 0
      ? state.logs[idx]
      : { date: today, wordsTyped: 0, correctCount: 0, wrongCount: 0, totalSeconds: 0, wpmBest: 0 };
  const wordWpm = result.seconds > 0 ? Math.round(result.word.length / 5 / (result.seconds / 60)) : 0;
  const updated: DailyLog = {
    ...base,
    wordsTyped: base.wordsTyped + 1,
    correctCount: base.correctCount + (result.correct ? 1 : 0),
    wrongCount: base.wrongCount + (result.correct ? 0 : 1),
    totalSeconds: base.totalSeconds + result.seconds,
    wpmBest: Math.max(base.wpmBest, wordWpm),
  };
  const logs = [...state.logs];
  if (idx >= 0) logs[idx] = updated;
  else logs.push(updated);

  // --- 新词游标推进 ---
  const meta = isNewWord && result.level
    ? {
        ...state.meta,
        newWordCursor: {
          ...state.meta.newWordCursor,
          [result.level]: state.meta.newWordCursor[result.level] + 1,
        },
      }
    : state.meta;

  return { records, wrongBook, logs, meta, settings: state.settings };
}

function touchStreak(state: LearningState): LearningState {
  const today = todayKey();
  if (state.meta.lastActiveDate === today) return state;
  const yesterday = addDaysKey(today, -1);
  const streakDays = state.meta.lastActiveDate === yesterday ? state.meta.streakDays + 1 : 1;
  return { ...state, meta: { ...state.meta, streakDays, lastActiveDate: today } };
}

export function reducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'RESULT':
      return applyResult(state, action.result);
    case 'SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'TOUCH_STREAK':
      return touchStreak(state);
    case 'ADD_STARS':
      return {
        ...state,
        meta: { ...state.meta, totalStars: state.meta.totalStars + Math.max(0, action.count) },
      };
    default:
      return state;
  }
}

interface LearningContextValue {
  state: LearningState;
  dispatch: Dispatch<LearningAction>;
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  // 打开应用即打卡
  useEffect(() => {
    dispatch({ type: 'TOUCH_STREAK' });
  }, []);

  // 音效设置生效
  useEffect(() => {
    setSoundEnabled(state.settings.keySound);
    setSoundVolume(state.settings.keySoundVolume);
  }, [state.settings.keySound, state.settings.keySoundVolume]);

  // 持久化：状态变化即写盘（RESULT 每词完成一次，符合 §5.10 的批量节奏）
  useEffect(() => {
    save(KEYS.records, state.records);
    save(KEYS.wrongBook, state.wrongBook);
    save(KEYS.logs, state.logs);
    save(KEYS.settings, state.settings);
    save(KEYS.meta, state.meta);
  }, [state]);

  return <LearningContext.Provider value={{ state, dispatch }}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningContextValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning 必须在 LearningProvider 内使用');
  return ctx;
}

/** 当前生效的错题本（未移出的） */
export function activeWrongBook(state: LearningState): WrongBookEntry[] {
  return Object.values(state.wrongBook)
    .filter((e) => !e.clearedAt)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export type { Level };
