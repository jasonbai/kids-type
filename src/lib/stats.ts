/** 统计计算（StatPanel 与 M4 统计页共用） */
import { toDateKey } from './dateKey';

/** 按键准确率（%），无输入时按 100 计 */
export function calcAccuracy(correct: number, wrong: number): number {
  const total = correct + wrong;
  return total === 0 ? 100 : Math.round((correct / total) * 100);
}

/** WPM = (正确字符数 / 5) / 分钟；对儿童是次要指标 */
export function calcWpm(correctChars: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round(correctChars / 5 / (seconds / 60));
}

/** 秒 → "m:ss" */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 秒 → "x 分钟" / "x 小时 y 分钟"（统计页总用时） */
export function formatDuration(seconds: number): string {
  const m = Math.round(Math.max(0, seconds) / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
}

/** 从今天往前的 n 个 dateKey（含今天），旧 → 新 */
export function lastNDayKeys(n: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }
  return keys;
}

/**
 * 打卡日历网格：以"本周所在周"为最后一行，共 4 周（28 格），
 * 按周一为一周开头排列，返回的 dateKey 数组顺序即网格顺序（行优先）。
 */
export function calendarGridKeys(weeks = 4, today = new Date()): string[] {
  const dow = (today.getDay() + 6) % 7; // 周一=0 … 周日=6
  const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
  const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - (weeks - 1) * 7);
  const total = weeks * 7;
  const keys: string[] = [];
  for (let i = 0; i < total; i++) {
    keys.push(toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return keys;
}

/** dateKey → "9/14" 短显示 */
export function shortDateLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
}
