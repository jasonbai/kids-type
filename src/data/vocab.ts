import type { Level, Sentence, Word } from '../types';
import ketRaw from './ket.json';
import petRaw from './pet.json';
import sentencesRaw from './sentences.json';

export const KET_WORDS = ketRaw as Word[];
export const PET_WORDS = petRaw as Word[];

/** 全部词库（复习池来源，KET/PET 词表物理去重） */
export const ALL_WORDS: Word[] = [...KET_WORDS, ...PET_WORDS];

export const WORD_BY_ID: Map<string, Word> = new Map(ALL_WORDS.map((w) => [w.id, w]));

/** 当前 level 的新词词池（按词库序 = 词频序） */
export function poolFor(level: Level): Word[] {
  return level === 'KET' ? KET_WORDS : PET_WORDS;
}

/** 例句原始结构：wordId → [英文, 中文][]（构建期由 build-sentences.mjs 校验后写入） */
type SentenceTuple = [string, string];
const SENTENCES_RAW = sentencesRaw as unknown as Record<string, SentenceTuple[]>;

const SENTENCE_MAP: Map<string, Sentence[]> = new Map(
  Object.entries(SENTENCES_RAW).map(([id, list]) => [id, list.map(([en, cn]) => ({ en, cn }))]),
);

/** 某词的例句（无数据返回空数组，调用方回退为单词练习） */
export function sentencesOf(wordId: string): Sentence[] {
  return SENTENCE_MAP.get(wordId) ?? [];
}
