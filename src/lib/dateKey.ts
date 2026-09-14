/**
 * 全站唯一的"天"口径：本地时区 dateKey（YYYY-MM-DD）。
 * 禁止用 new Date('YYYY-MM-DD')（按 UTC 解析）做任何日期运算——
 * 早晨 8 点前 UTC 日期还是"昨天"，复习队列会整体错乱。
 */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** dateKey 的字典序即时间序 */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 在本地时区语义下加 N 天（自动处理月末/年末/DST） */
export function addDaysKey(key: string, days: number): string {
  if (!isValidKey(key)) throw new Error(`invalid dateKey: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

export function diffDaysKeys(a: string, b: string): number {
  if (!isValidKey(a) || !isValidKey(b)) throw new Error(`invalid dateKey: ${a} / ${b}`);
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  // 本地时区的两个当日零点相差的完整天数
  const ta = new Date(ya, ma - 1, da).getTime();
  const tb = new Date(yb, mb - 1, db).getTime();
  return Math.round((ta - tb) / 86400000);
}
