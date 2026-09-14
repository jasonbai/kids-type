import { describe, expect, it } from 'vitest';
import { addDaysKey, todayKey } from '../lib/dateKey';
import type { WordResult } from '../hooks/useTypingSession';
import { CLEAR_STREAK_GOAL, DEFAULT_META, DEFAULT_SETTINGS, reducer, type LearningState } from './learning';

function freshState(): LearningState {
  return {
    records: {},
    wrongBook: {},
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
    meta: { ...DEFAULT_META, newWordCursor: { ...DEFAULT_META.newWordCursor } },
  };
}

function result(word: string, correct: boolean, wrongLetters: string[] = []): WordResult {
  return { wordId: word, word, level: 'KET', correct, wrongLetters, seconds: 3, kind: 'word' };
}

describe('reducer · RESULT', () => {
  it('新词首答：建 SRS 记录（明天复习）+ 游标推进 + 记日志', () => {
    const s = reducer(freshState(), { type: 'RESULT', result: result('the', true) });
    expect(s.records.the).toMatchObject({ reps: 1, interval: 1, dueDate: addDaysKey(todayKey(), 1) });
    expect(s.meta.newWordCursor.KET).toBe(1);
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]).toMatchObject({ date: todayKey(), wordsTyped: 1, correctCount: 1, wrongCount: 0 });
  });

  it('同日重复结果：不重复调度 SRS（每日一次）', () => {
    let s = reducer(freshState(), { type: 'RESULT', result: result('the', true) });
    const first = s.records.the;
    s = reducer(s, { type: 'RESULT', result: result('the', false, ['x']) });
    expect(s.records.the).toEqual(first); // 记录完全不变
    expect(s.logs[0].wordsTyped).toBe(2); // 日志仍累计
  });

  it('打错：入错题本（错次/常错字母）', () => {
    const s = reducer(freshState(), { type: 'RESULT', result: result('of', false, ['q', 'q']) });
    expect(s.records.of.lapses).toBe(1);
    expect(s.wrongBook.of).toMatchObject({ wrongCount: 1, wrongLetters: ['q'], clearStreak: 0, clearedAt: null });
  });

  it('错题本连对达到阈值移出，中途打错清零', () => {
    let s = reducer(freshState(), { type: 'RESULT', result: result('of', false, ['q']) });
    s = reducer(s, { type: 'RESULT', result: result('of', true) });
    expect(s.wrongBook.of.clearStreak).toBe(1);
    expect(s.wrongBook.of.clearedAt).toBeNull();
    s = reducer(s, { type: 'RESULT', result: result('of', true) });
    expect(s.wrongBook.of.clearStreak).toBe(CLEAR_STREAK_GOAL);
    expect(s.wrongBook.of.clearedAt).not.toBeNull();
    // 已移出后再答对不再变更
    const cleared = s.wrongBook.of;
    s = reducer(s, { type: 'RESULT', result: result('of', true) });
    expect(s.wrongBook.of).toEqual(cleared);
  });

  it('移出后再打错：回到错题本', () => {
    let s = reducer(freshState(), { type: 'RESULT', result: result('of', false, ['q']) });
    s = reducer(s, { type: 'RESULT', result: result('of', true) });
    s = reducer(s, { type: 'RESULT', result: result('of', true) });
    s = reducer(s, { type: 'RESULT', result: result('of', false, ['p']) });
    expect(s.wrongBook.of.clearedAt).toBeNull();
    expect(s.wrongBook.of.wrongCount).toBe(2);
  });
});

describe('reducer · TOUCH_STREAK / ADD_STARS / SETTINGS', () => {
  it('首次打开：streak=1 并记录今天', () => {
    const s = reducer(freshState(), { type: 'TOUCH_STREAK' });
    expect(s.meta.streakDays).toBe(1);
    expect(s.meta.lastActiveDate).toBe(todayKey());
  });

  it('昨天活跃：+1；今天已打卡：不变；中断：重置 1', () => {
    const yesterday = addDaysKey(todayKey(), -1);
    const base = freshState();
    const fromYesterday = reducer(
      { ...base, meta: { ...base.meta, lastActiveDate: yesterday, streakDays: 3 } },
      { type: 'TOUCH_STREAK' },
    );
    expect(fromYesterday.meta.streakDays).toBe(4);
    const again = reducer(fromYesterday, { type: 'TOUCH_STREAK' });
    expect(again.meta.streakDays).toBe(4); // 幂等
    const fromLongAgo = reducer(
      { ...base, meta: { ...base.meta, lastActiveDate: addDaysKey(todayKey(), -3), streakDays: 9 } },
      { type: 'TOUCH_STREAK' },
    );
    expect(fromLongAgo.meta.streakDays).toBe(1);
  });

  it('ADD_STARS 累加且不接受负数', () => {
    let s = reducer(freshState(), { type: 'ADD_STARS', count: 2 });
    s = reducer(s, { type: 'ADD_STARS', count: 1 });
    expect(s.meta.totalStars).toBe(3);
    s = reducer(s, { type: 'ADD_STARS', count: -5 });
    expect(s.meta.totalStars).toBe(3);
  });

  it('SETTINGS 合并 patch', () => {
    const s = reducer(freshState(), { type: 'SETTINGS', patch: { rate: 0.8, currentLevel: 'PET' } });
    expect(s.settings.rate).toBe(0.8);
    expect(s.settings.currentLevel).toBe('PET');
    expect(s.settings.dailyNewWords).toBe(DEFAULT_SETTINGS.dailyNewWords);
  });
});
