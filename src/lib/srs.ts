import type { SrsRecord } from '../types';
import { addDaysKey, todayKey } from './dateKey';

export const MAX_INTERVAL = 180;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.5;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 简化 SM-2（儿童版）：评分由打字结果自动推导，无手动评分。
 * 纯函数：返回新对象，不修改入参；record 为 null 表示该词首次练习。
 *
 * 答对：reps+1，ease+0.1，interval 按连对次数 1 → 3 → interval×ease 指数增长（上限 180 天）
 * 答错：reps 归零，lapses+1，ease−0.2，interval 重置 1 天
 */
export function review(
  record: SrsRecord | null,
  wordId: string,
  correct: boolean,
  today: string = todayKey(),
  now: () => Date = () => new Date(),
): SrsRecord {
  const base: Omit<SrsRecord, 'wordId' | 'dueDate' | 'lastReviewAt'> = record
    ? { ease: record.ease, interval: record.interval, reps: record.reps, lapses: record.lapses }
    : { ease: 2.5, interval: 0, reps: 0, lapses: 0 };

  const lastReviewAt = now().toISOString();

  if (correct) {
    const reps = base.reps + 1;
    const ease = clamp(base.ease + 0.1, MIN_EASE, MAX_EASE);
    const interval =
      reps === 1 ? 1 : reps === 2 ? 3 : Math.min(MAX_INTERVAL, Math.round(base.interval * ease));
    return { wordId, ease, interval, reps, lapses: base.lapses, dueDate: addDaysKey(today, interval), lastReviewAt };
  }

  return {
    wordId,
    ease: clamp(base.ease - 0.2, MIN_EASE, MAX_EASE),
    interval: 1,
    reps: 0,
    lapses: base.lapses + 1,
    dueDate: addDaysKey(today, 1),
    lastReviewAt,
  };
}

/** 是否到期需要复习（dueDate ≤ today，本地 dateKey 字典序比较） */
export function isDue(record: SrsRecord, today: string = todayKey()): boolean {
  return record.dueDate <= today;
}

/** 该词今天是否已正式调度过（每词每天最多一次 review，当日重复不算） */
export function wasReviewedOn(record: SrsRecord, dateKey: string): boolean {
  try {
    const d = new Date(record.lastReviewAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === dateKey;
  } catch {
    return false;
  }
}
