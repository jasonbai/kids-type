import { describe, expect, it } from 'vitest';
import type { SrsRecord, Word } from '../types';
import { buildDailyQueue } from './queue';

const T = '2026-09-14';

const w = (id: string): Word => ({
  id, word: id, phonetic: `/x/`, meaning: '测试', levels: ['KET'],
});

const rec = (dueDate: string): SrsRecord => ({
  wordId: '', ease: 2.5, interval: 1, reps: 1, lapses: 0,
  dueDate, lastReviewAt: '2026-09-01T00:00:00.000Z',
});

const vocab = [w('a'), w('b'), w('c'), w('d'), w('e')];

describe('buildDailyQueue（每日队列合成）', () => {
  it('新词：从游标起按词库序取 N 个，跳过已有记录的词', () => {
    const records = { b: rec('2026-09-20') };
    const q = buildDailyQueue({ allVocab: vocab, levelVocab: vocab, records, cursor: 0, dailyNew: 3, today: T });
    expect(q.newWords.map((x) => x.id)).toEqual(['a', 'c', 'd']);
  });

  it('游标推进后取后续词', () => {
    const q = buildDailyQueue({ allVocab: vocab, levelVocab: vocab, records: {}, cursor: 2, dailyNew: 2, today: T });
    expect(q.newWords.map((x) => x.id)).toEqual(['c', 'd']);
  });

  it('到期复习：dueDate ≤ 今天，按到期日升序，最早先复习', () => {
    const records = {
      a: rec('2026-09-10'),
      b: rec('2026-09-13'),
      c: rec('2026-09-15'), // 未到期
    };
    const q = buildDailyQueue({ allVocab: vocab, levelVocab: vocab, records, cursor: 5, dailyNew: 10, today: T });
    expect(q.dueWords.map((x) => x.id)).toEqual(['a', 'b']);
    expect(q.newWords).toEqual([]);
  });

  it('复习词上限 30 个，超出取最早的', () => {
    const many = Array.from({ length: 40 }, (_, i) => w(`w${String(i).padStart(2, '0')}`));
    const records: Record<string, SrsRecord> = {};
    for (const word of many) records[word.id] = rec('2026-09-01');
    const q = buildDailyQueue({ allVocab: many, levelVocab: many, records, cursor: 0, dailyNew: 5, today: T });
    expect(q.dueWords).toHaveLength(30);
    expect(q.dueWords[0].id).toBe('w00');
  });

  it('复习池来自全部词库（不分 level），新词池仅当前 level', () => {
    const petWord: Word = { ...w('pet1'), levels: ['PET'] };
    const all = [...vocab, petWord];
    const records = { a: rec('2026-09-14') }; // a 到期
    const q = buildDailyQueue({ allVocab: all, levelVocab: vocab, records, cursor: 1, dailyNew: 2, today: T });
    expect(q.dueWords.map((x) => x.id)).toEqual(['a']);
    expect(q.newWords.map((x) => x.id)).toEqual(['b', 'c']);
  });
});
