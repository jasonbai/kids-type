import { describe, expect, it } from 'vitest';
import { addDaysKey, compareKeys, diffDaysKeys, isValidKey, toDateKey, todayKey } from './dateKey';

describe('dateKey（本地时区口径）', () => {
  it('toDateKey 输出 YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 8, 14))).toBe('2026-09-14');
    expect(toDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('addDaysKey 跨月/跨年/闰年', () => {
    expect(addDaysKey('2026-09-14', 1)).toBe('2026-09-15');
    expect(addDaysKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2028-02-28', 1)).toBe('2028-02-29'); // 闰年
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysKey('2026-09-14', 180)).toBe('2027-03-13'); // SRS 上限间隔
  });

  it('addDaysKey 拒绝非法 key', () => {
    expect(() => addDaysKey('2026-9-14', 1)).toThrow();
    expect(() => addDaysKey('bad', 1)).toThrow();
  });

  it('compareKeys 字典序即时间序', () => {
    expect(compareKeys('2026-09-14', '2026-09-15')).toBeLessThan(0);
    expect(compareKeys('2026-10-01', '2026-09-30')).toBeGreaterThan(0);
    expect(compareKeys('2026-09-14', '2026-09-14')).toBe(0);
  });

  it('diffDaysKeys 计算完整天数差', () => {
    expect(diffDaysKeys('2026-09-15', '2026-09-14')).toBe(1);
    expect(diffDaysKeys('2026-09-14', '2026-09-15')).toBe(-1);
    expect(diffDaysKeys('2026-10-01', '2026-09-01')).toBe(30);
    expect(diffDaysKeys('2026-09-14', '2026-09-14')).toBe(0);
  });

  it('todayKey 是合法 key', () => {
    expect(isValidKey(todayKey())).toBe(true);
  });
});
