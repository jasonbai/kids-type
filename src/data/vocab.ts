import type { Level, Sentence, Word } from '../types';
import ketRaw from './ket.json';
import petRaw from './pet.json';
import sentencesRaw from './sentences.json';

export const KET_WORDS = ketRaw as Word[];
export const PET_WORDS = petRaw as Word[];

/** 内置词库（KET/PET 词表物理去重） */
const BUILTIN_WORDS: Word[] = [...KET_WORDS, ...PET_WORDS];

export const LEVEL_LABELS: Record<Level, string> = {
  KET: 'KET',
  PET: 'PET',
  CUSTOM: '自定义',
};

/* ───── 自定义词库（家长/老师上传，运行时由 LearningProvider 注入） ───── */

let customWords: Word[] = [];
let cachedAll: Word[] = BUILTIN_WORDS;
let wordById: Map<string, Word> = new Map(BUILTIN_WORDS.map((w) => [w.id, w]));

/** 注入/替换自定义词库（应用启动、导入、清空时调用；内部重建缓存索引） */
export function setCustomWords(words: Word[]): void {
  customWords = words;
  // Canonical builtin entries win; custom overrides belong only to the custom pool.
  const canonical = new Map(BUILTIN_WORDS.map(w => [w.id, w]));
  for (const word of customWords) {
    if (!canonical.has(word.id)) canonical.set(word.id, word);
  }
  cachedAll = [...canonical.values()];
  wordById = new Map(cachedAll.map((w) => [w.id, w]));
}

export function getCustomWords(): Word[] {
  return customWords;
}

/** 全部词库（复习池来源：内置 + 自定义，含运行时注入部分） */
export function allWords(): Word[] {
  return cachedAll;
}

/** 按 id 查词（错题本/复习记录回显用，覆盖自定义词） */
export function wordByIdOrNull(id: string): Word | undefined {
  return wordById.get(id);
}

/** 当前 level 的新词词池（内置按词库序 = 词频序；自定义按导入序） */
export function poolFor(level: Level): Word[] {
  return level === 'KET' ? KET_WORDS : level === 'PET' ? PET_WORDS : customWords;
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
