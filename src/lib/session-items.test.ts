import { describe, expect, it } from 'vitest';
import type { Word } from '../types';
import { buildItems, itemUnit, sentenceItem, wordItem } from './session-items';

function word(id: string, levels: Array<'KET' | 'PET'> = ['KET']): Word {
  return { id, word: id, phonetic: `/${id}/`, meaning: `${id} 的释义`, levels };
}

const DATE = '2026-09-14';

describe('session-items', () => {
  it('wordItem：纯单词条目', () => {
    const w = word('cat');
    const item = wordItem(w);
    expect(item).toMatchObject({ key: 'cat', kind: 'word', text: 'cat' });
    expect(item.sentence).toBeUndefined();
  });

  it('sentenceItem：取该词的一条例句，key 带句子下标', () => {
    const w = word('cat');
    const item = sentenceItem(w, DATE);
    expect(item?.kind).toBe('sentence');
    expect(item?.text).toBe(item?.sentence?.en);
    expect(item?.key).toMatch(/^cat#\d$/);
  });

  it('sentenceItem：同一天同词固定同一条（重练不跳句）', () => {
    const w = word('cat');
    expect(sentenceItem(w, DATE)?.text).toBe(sentenceItem(w, DATE)?.text);
  });

  it('sentenceItem：无例句数据的词返回 null', () => {
    expect(sentenceItem(word('zzzz'), DATE)).toBeNull();
  });

  it('buildItems · word 模式：只产出单词条目', () => {
    const items = buildItems([word('cat'), word('dog')], 'word', DATE);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === 'word')).toBe(true);
  });

  it('buildItems · sentence 模式：只产出例句条目', () => {
    const items = buildItems([word('cat'), word('dog')], 'sentence', DATE);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === 'sentence')).toBe(true);
  });

  it('buildItems · mixed 模式：词与其例句成对相邻', () => {
    const items = buildItems([word('cat'), word('dog')], 'mixed', DATE);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ kind: 'word', key: 'cat' });
    expect(items[1]).toMatchObject({ kind: 'sentence' });
    expect(items[1].word.id).toBe('cat');
    expect(items[2]).toMatchObject({ kind: 'word', key: 'dog' });
    expect(items[3].word.id).toBe('dog');
  });

  it('缺例句数据的词在例句/混合模式下回退为单词条目（会话不为空）', () => {
    const items = buildItems([word('zzzz')], 'sentence', DATE);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('word');
    const mixed = buildItems([word('zzzz')], 'mixed', DATE);
    expect(mixed).toHaveLength(1);
    expect(mixed[0].kind).toBe('word');
  });

  it('itemUnit：按模式给出进度单位', () => {
    expect(itemUnit('word')).toBe('词');
    expect(itemUnit('sentence')).toBe('句');
    expect(itemUnit('mixed')).toBe('题');
  });
});
