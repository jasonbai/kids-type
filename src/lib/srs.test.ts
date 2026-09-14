import { describe, expect, it } from 'vitest';
import type { SrsRecord } from '../types';
import { isDue, review, wasReviewedOn } from './srs';

const T = '2026-09-14';
const fixedNow = () => new Date(2026, 8, 14, 10, 0, 0);

describe('srs.review（简化 SM-2）', () => {
  it('首答正确：reps=1，间隔 1 天，明天到期', () => {
    const r = review(null, 'name', true, T, fixedNow);
    expect(r).toMatchObject({ wordId: 'name', reps: 1, lapses: 0, interval: 1, dueDate: '2026-09-15' });
    expect(r.ease).toBeCloseTo(2.5); // 2.5+0.1 被 clamp 到 2.5
  });

  it('连对间隔序列：1 → 3 → 8 → 20（×ease 指数增长）', () => {
    let r = review(null, 'name', true, T, fixedNow); // rep1: 1
    r = review(r, 'name', true, addDays(r.dueDate), fixedNow); // rep2: 3
    expect(r.interval).toBe(3);
    r = review(r, 'name', true, addDays(r.dueDate), fixedNow); // rep3: round(3×2.5)=8
    expect(r.interval).toBe(8);
    r = review(r, 'name', true, addDays(r.dueDate), fixedNow); // rep4: round(8×2.5)=20
    expect(r.interval).toBe(20);
    expect(r.reps).toBe(4);
    expect(r.lapses).toBe(0);
  });

  it('间隔上限 180 天', () => {
    let r: SrsRecord | null = null;
    for (let i = 0; i < 12; i++) r = review(r, 'w', true, T, fixedNow);
    expect(r?.interval).toBeLessThanOrEqual(180);
  });

  it('答错：reps 归零、lapses+1、ease 下降、明天再来', () => {
    let r = review(null, 'name', true, T, fixedNow);
    r = review(r, 'name', true, addDays(r.dueDate), fixedNow);
    const before = r;
    const after = review(r, 'name', false, T, fixedNow);
    expect(after.reps).toBe(0);
    expect(after.lapses).toBe(1);
    expect(after.interval).toBe(1);
    expect(after.dueDate).toBe('2026-09-15');
    expect(after.ease).toBeCloseTo(before.ease - 0.2);
    expect(after.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('ease 下限 1.3', () => {
    let r: SrsRecord | null = null;
    for (let i = 0; i < 10; i++) r = review(r, 'w', false, T, fixedNow);
    expect(r?.ease).toBe(1.3);
  });

  it('纯函数：不修改入参', () => {
    const input = review(null, 'name', true, T, fixedNow);
    const frozen = JSON.parse(JSON.stringify(input));
    review(input, 'name', true, addDays(input.dueDate), fixedNow);
    expect(input).toEqual(frozen);
  });
});

describe('isDue / wasReviewedOn', () => {
  it('dueDate ≤ today 即到期', () => {
    const r: SrsRecord = {
      wordId: 'a', ease: 2.5, interval: 1, reps: 1, lapses: 0,
      dueDate: '2026-09-14', lastReviewAt: '2026-09-13T02:00:00.000Z',
    };
    expect(isDue(r, '2026-09-14')).toBe(true);
    expect(isDue(r, '2026-09-13')).toBe(false);
  });

  it('wasReviewedOn 按本地日期判断', () => {
    const r: SrsRecord = {
      wordId: 'a', ease: 2.5, interval: 1, reps: 1, lapses: 0,
      dueDate: '2026-09-15',
      // 本地 2026-09-14 10:00（无论时区，toISOString 的 UTC 日期可能是 13 或 14）
      lastReviewAt: new Date(2026, 8, 14, 10, 0, 0).toISOString(),
    };
    expect(wasReviewedOn(r, '2026-09-14')).toBe(true);
    expect(wasReviewedOn(r, '2026-09-15')).toBe(false);
  });
});

function addDays(key: string, n = 1): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
