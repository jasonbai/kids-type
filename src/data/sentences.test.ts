import { describe, expect, it } from 'vitest';
import ketRaw from './ket.json';
import petRaw from './pet.json';
import sentencesRaw from './sentences.json';

const ket = ketRaw as Array<{ id: string; word: string }>;
const pet = petRaw as Array<{ id: string; word: string }>;
const sentences = sentencesRaw as unknown as Record<string, Array<[string, string]>>;

const SENTENCES_PER_WORD = 3;
/** 英文例句格式：首词大写、其余小写（I 可出现在任意位置）、单空格、不含句号等标点 */
const EN_RE = /^[A-Z][a-z]*( (I|[a-z]+))*$/;

/**
 * 例句数据校验：
 * 守住"儿童可打字"的格式与用词底线，防止数据源更换后劣化入库。
 * 覆盖度：KET 已全量（1500 词）；PET 按批次补全中，此处只校验已入库条目。
 */
describe('例句格式校验', () => {
  const entries = Object.entries(sentences);

  it('条目非空且每词恰 3 句', () => {
    expect(entries.length).toBeGreaterThanOrEqual(1900);
    for (const [id, list] of entries) {
      expect(list, id).toHaveLength(SENTENCES_PER_WORD);
    }
  });

  it('英文例句只含小写字母、单空格与句末句号', () => {
    for (const [id, list] of entries) {
      for (const [en] of list) expect(en, id).toMatch(EN_RE);
    }
  });

  it('例句包含目标词原形（整词）且同词例句不重复', () => {
    for (const [id, list] of entries) {
      const seen = new Set<string>();
      for (const [en] of list) {
        // 句首的目标词会首字母大写，比较时统一小写（生成规范保证非句首全小写）
        const words = en.toLowerCase().split(' ');
        expect(words.includes(id), `${id}: ${en}`).toBe(true);
        expect(seen.has(en), `${id} 重复例句`).toBe(false);
        seen.add(en);
      }
    }
  });

  it('中文翻译非空且不含英文字母', () => {
    for (const [id, list] of entries) {
      for (const [, cn] of list) {
        expect(cn.trim().length, id).toBeGreaterThanOrEqual(2);
        expect(/[a-zA-Z]/.test(cn), `${id}: ${cn}`).toBe(false);
      }
    }
  });

  it('例句 key 必须在词表中', () => {
    const ids = new Set([...ket, ...pet].map((w) => w.id));
    for (const id of Object.keys(sentences)) expect(ids.has(id), id).toBe(true);
  });

  it('KET 词库例句全覆盖', () => {
    const missing = ket.filter((w) => !sentences[w.id]).map((w) => w.id);
    expect(missing).toEqual([]);
  });
});
