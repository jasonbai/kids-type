import { afterEach, describe, expect, it } from 'vitest';
import type { Word } from '../types';
import ketRaw from './ket.json';
import petRaw from './pet.json';

const ket = ketRaw as Word[];
const pet = petRaw as Word[];

/**
 * 词库数据校验：
 * 守住 build-vocab.mjs 的清洗硬约束，防止数据源更换后劣化入库。
 */

describe('词库格式校验', () => {
  const files: Array<[string, Word[], 'KET' | 'PET']> = [
    ['ket.json', ket, 'KET'],
    ['pet.json', pet, 'PET'],
  ];

  for (const [name, words, level] of files) {
    it(`${name} 非空且量级合理`, () => {
      expect(words.length).toBeGreaterThanOrEqual(500);
    });

    it(`${name} 每词均为 2~12 位纯小写字母`, () => {
      for (const w of words) expect(w.word).toMatch(/^[a-z]{2,12}$/);
    });

    it(`${name} id === word 且文件内唯一`, () => {
      const ids = new Set<string>();
      for (const w of words) {
        expect(w.id).toBe(w.word);
        expect(ids.has(w.id)).toBe(false);
        ids.add(w.id);
      }
    });

    it(`${name} 音标为 /…/ 形式且释义非空`, () => {
      for (const w of words) {
        expect(w.phonetic).toMatch(/^\/.+\//);
        expect(w.meaning.length).toBeGreaterThan(0);
      }
    });

    it(`${name} levels 标注正确`, () => {
      for (const w of words) expect(w.levels).toEqual([level]);
    });
  }

  it('两个文件不相交（全局去重）', () => {
    const ketIds = new Set(ket.map((w) => w.id));
    for (const w of pet) expect(ketIds.has(w.id)).toBe(false);
  });
});


import { allWords, poolFor, setCustomWords, wordByIdOrNull, sentencesOf } from './vocab';
import { makeCustomWord } from '../lib/custom-vocab';

describe('自选词库复用内置词', () => {
  afterEach(() => setCustomWords([]));
  it('自选内容独立，全局按 ID 去重且保留内置内容', () => {
    const builtin = ket[0]!;
    const custom = { ...builtin, meaning: '上传释义' };
    const extra = makeCustomWord('astrophysicist');
    setCustomWords([custom, extra]);
    expect(poolFor('CUSTOM')).toEqual([custom, extra]);
    expect(wordByIdOrNull(builtin.id)).toEqual(builtin);
    expect(allWords().filter(w => w.id === builtin.id)).toHaveLength(1);
    expect(sentencesOf(custom.id)).toEqual(sentencesOf(builtin.id));
    expect(wordByIdOrNull(extra.id)).toEqual(extra);
    setCustomWords([]);
    expect(wordByIdOrNull(builtin.id)).toEqual(builtin);
    expect(wordByIdOrNull(extra.id)).toBeUndefined();
  });
});
