import { describe, expect, it } from 'vitest';
import { judgeKey } from './judge';

describe('judgeKey（严格模式判定）', () => {
  it('答对且未到词尾 → correct', () => {
    expect(judgeKey('name', 0, 'n')).toEqual({ type: 'correct' });
    expect(judgeKey('name', 2, 'm')).toEqual({ type: 'correct' });
  });

  it('答对且到词尾 → complete', () => {
    expect(judgeKey('name', 3, 'e')).toEqual({ type: 'complete' });
    expect(judgeKey('cat', 2, 't')).toEqual({ type: 'complete' });
  });

  it('答错 → wrong 且带回期望字母', () => {
    expect(judgeKey('name', 0, 'm')).toEqual({ type: 'wrong', expected: 'n' });
  });

  it('输入大写字母按小写比较（词库全小写）', () => {
    expect(judgeKey('name', 0, 'N')).toEqual({ type: 'correct' });
    expect(judgeKey('name', 1, 'A')).toEqual({ type: 'correct' });
  });

  it('例句首词大写时仍按小写比较（避免首字母必错）', () => {
    const s = 'The cat is here.';
    expect(judgeKey(s, 0, 't')).toEqual({ type: 'correct' });
    expect(judgeKey(s, 0, 'T')).toEqual({ type: 'correct' });
    expect(judgeKey(s, 1, 'h')).toEqual({ type: 'correct' });
    expect(judgeKey(s, 0, 'a')).toEqual({ type: 'wrong', expected: 't' });
  });

  it('非可输入按键返回 null（由调用方决定忽略/拦截）', () => {
    expect(judgeKey('name', 0, 'Backspace')).toBeNull();
    expect(judgeKey('name', 0, 'ab')).toBeNull();
    expect(judgeKey('name', 0, '1')).toBeNull();
    expect(judgeKey('name', 0, 'é')).toBeNull();
    expect(judgeKey('name', 0, ',')).toBeNull();
  });

  it('空格与句号是合法输入（例句练习）', () => {
    const s = 'I like tea.';
    expect(judgeKey(s, 1, ' ')).toEqual({ type: 'correct' });
    // 期望字符统一小写返回（键盘键帽与提示文案按小写匹配）
    expect(judgeKey(s, 0, ' ')).toEqual({ type: 'wrong', expected: 'i' });
    expect(judgeKey(s, s.length - 1, '.')).toEqual({ type: 'complete' });
    expect(judgeKey(s, 2, '.')).toEqual({ type: 'wrong', expected: 'l' });
  });

  it('越界下标返回 null', () => {
    expect(judgeKey('name', -1, 'n')).toBeNull();
    expect(judgeKey('name', 4, 'x')).toBeNull(); // 词已打完
  });
});
