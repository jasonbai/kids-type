import type { JudgeResult } from '../types';

/** 可输入的字符集：字母（大小写不敏感）+ 例句标点（空格、句号） */
const ALLOWED = /^[a-z .]$/;

/**
 * 打字判定纯函数（严格模式）：
 * - 词条目只含 a-z；例句条目含小写字母、单空格与句末句号
 * - 答对返回 correct / complete；答错返回 wrong（不推进，无退格）
 * - 非可输入键返回 null，由调用方决定忽略还是拦截
 */
export function judgeKey(target: string, inputLen: number, rawKey: string): JudgeResult | null {
  if (rawKey.length !== 1) return null;
  const key = rawKey.toLowerCase();
  if (!ALLOWED.test(key)) return null;
  if (inputLen < 0 || inputLen >= target.length) return null;
  // 比较前统一小写：词库全小写，但例句首词以大写开头（如 The）
  const expected = target[inputLen].toLowerCase();
  if (key === expected) {
    return inputLen + 1 === target.length ? { type: 'complete' } : { type: 'correct' };
  }
  return { type: 'wrong', expected };
}
