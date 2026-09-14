export type Hand = 'L' | 'R';
/** 手指编号：1=食指 2=中指 3=无名指 4=小指 */
export type FingerNo = 1 | 2 | 3 | 4;

export interface Finger {
  hand: Hand;
  finger: FingerNo;
  /** 8 指 8 色编码，引导线 / 目标键 / 键帽圆点三处同色 */
  color: string;
  label: string;
}

/** 手指唯一键，如 'L4' = 左手小指 */
export type FingerId = `${Hand}${FingerNo}`;

export const FINGERS: Record<FingerId, Finger> = {
  L4: { hand: 'L', finger: 4, color: '#ef4444', label: '左手小指' },
  L3: { hand: 'L', finger: 3, color: '#f97316', label: '左手无名指' },
  L2: { hand: 'L', finger: 2, color: '#eab308', label: '左手中指' },
  L1: { hand: 'L', finger: 1, color: '#22c55e', label: '左手食指' },
  R1: { hand: 'R', finger: 1, color: '#06b6d4', label: '右手食指' },
  R2: { hand: 'R', finger: 2, color: '#3b82f6', label: '右手中指' },
  R3: { hand: 'R', finger: 3, color: '#8b5cf6', label: '右手无名指' },
  R4: { hand: 'R', finger: 4, color: '#ec4899', label: '右手小指' },
};

/** 字母 → 负责的手指（标准 QWERTY 指法分区） */
export const FINGER_MAP: Record<string, FingerId> = {
  q: 'L4', a: 'L4', z: 'L4',
  w: 'L3', s: 'L3', x: 'L3',
  e: 'L2', d: 'L2', c: 'L2',
  r: 'L1', t: 'L1', f: 'L1', g: 'L1', v: 'L1', b: 'L1',
  y: 'R1', u: 'R1', h: 'R1', j: 'R1', n: 'R1', m: 'R1',
  i: 'R2', k: 'R2',
  o: 'R3', l: 'R3',
  p: 'R4',
};

/** 键盘三排布局（仅字母，练习只覆盖字母键） */
export const KEYBOARD_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

/** 例句练习用到的非字母键：空格与句号（字母排下方的第四排） */
export const SPACE_KEY = ' ';
export const PERIOD_KEY = '.';

export function fingerOf(ch: string): Finger | undefined {
  const id = FINGER_MAP[ch.toLowerCase()];
  return id ? FINGERS[id] : undefined;
}

/** 提示文案用：非字母键的按键说明（空格用大拇指，句号归右手无名指） */
const NON_LETTER_HINT: Record<string, { color: string; label: string }> = {
  [SPACE_KEY]: { color: '#64748b', label: '大拇指' },
  [PERIOD_KEY]: { color: FINGERS.R3.color, label: '右手无名指' },
};

/**
 * 指法提示：字母返回标准手指，空格/句号返回说明（无对应手指的引导动画）。
 * FingerGuide 只认字母（FINGER_MAP），非字母键不会画手部动画。
 */
export function hintFor(ch: string): { color: string; label: string } | undefined {
  const letter = fingerOf(ch);
  if (letter) return { color: letter.color, label: letter.label };
  return NON_LETTER_HINT[ch];
}

