import { describe, expect, it } from 'vitest';
import { calcAccuracy, calcWpm, calendarGridKeys, formatDuration, formatElapsed, lastNDayKeys } from './stats';

describe('calcAccuracy', () => {
  it('无输入按 100 计', () => {
    expect(calcAccuracy(0, 0)).toBe(100);
  });
  it('常规计算并四舍五入', () => {
    expect(calcAccuracy(9, 1)).toBe(90);
    expect(calcAccuracy(2, 1)).toBe(67); // 66.7 → 67
  });
});

describe('calcWpm', () => {
  it('零时长返回 0', () => {
    expect(calcWpm(50, 0)).toBe(0);
  });
  it('标准公式：正确字符 / 5 / 分钟', () => {
    expect(calcWpm(100, 60)).toBe(20); // 20 字/分
    expect(calcWpm(50, 30)).toBe(20);
    expect(calcWpm(25, 60)).toBe(5);
  });
});

describe('formatElapsed', () => {
  it('分:秒 格式，秒补零', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
  it('负数按 0 处理', () => {
    expect(formatElapsed(-3)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('分钟与小时显示', () => {
    expect(formatDuration(0)).toBe('0 分钟');
    expect(formatDuration(90)).toBe('2 分钟');
    expect(formatDuration(3600)).toBe('1 小时 0 分钟');
    expect(formatDuration(3900)).toBe('1 小时 5 分钟');
  });
});

describe('lastNDayKeys', () => {
  it('含今天、旧到新、跨月正确', () => {
    const keys = lastNDayKeys(3, new Date(2026, 8, 14));
    expect(keys).toEqual(['2026-09-12', '2026-09-13', '2026-09-14']);
    expect(lastNDayKeys(2, new Date(2026, 8, 1))).toEqual(['2026-08-31', '2026-09-01']);
  });
});

describe('calendarGridKeys', () => {
  it('周一开头、共 28 格、最后一天在本周内', () => {
    // 2026-09-14 恰为周一
    const keys = calendarGridKeys(4, new Date(2026, 8, 16)); // 周三
    expect(keys).toHaveLength(28);
    expect(keys[0]).toBe('2026-08-24'); // 三周前的周一
    expect(keys[27]).toBe('2026-09-20'); // 本周日
    expect(keys[21]).toBe('2026-09-14'); // 本周一
  });
});
