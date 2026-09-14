import type { PracticeMode, Sentence, Word } from '../types';
import { sentencesOf } from '../data/vocab';
import { todayKey } from './dateKey';

/** 练习条目：一次打字目标 = 一个单词或一个例句 */
export interface SessionItem {
  /** 条目在会话内的唯一键（词与句各自独立，打错重练按此去重） */
  key: string;
  kind: 'word' | 'sentence';
  /** 所属单词：词条目即其本身，例句条目为句子的主题词 */
  word: Word;
  /** 例句条目携带的句子（含中文翻译） */
  sentence?: Sentence;
  /** 本次要打出的字符串（单词或英文例句） */
  text: string;
}

/**
 * 同一天同一词固定取同一条例句（跨天轮换），
 * 避免同一词在"打错重练 / 重练本组"时句子跳变。
 */
function pickIndex(wordId: string, dateKey: string, count: number): number {
  const s = `${dateKey}:${wordId}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % count;
}

export function wordItem(word: Word): SessionItem {
  return { key: word.id, kind: 'word', word, text: word.word };
}

/** 例句条目；该词没有例句时返回 null（调用方回退为单词条目） */
export function sentenceItem(word: Word, dateKey: string = todayKey()): SessionItem | null {
  const list = sentencesOf(word.id);
  if (list.length === 0) return null;
  const idx = pickIndex(word.id, dateKey, list.length);
  const sentence = list[idx];
  return { key: `${word.id}#${idx}`, kind: 'sentence', word, sentence, text: sentence.en };
}

/**
 * 按练习模式把词表展开为会话条目：
 * - word：纯单词
 * - mixed：词与例句成对相邻（先打词，紧接着打该词的一条例句）
 * - sentence：纯例句（个别词缺例句数据时回退为单词条目，保证会话不为空）
 */
export function buildItems(
  words: Word[],
  mode: PracticeMode,
  dateKey: string = todayKey(),
): SessionItem[] {
  const items: SessionItem[] = [];
  for (const word of words) {
    if (mode === 'word') {
      items.push(wordItem(word));
      continue;
    }
    const sentence = sentenceItem(word, dateKey);
    if (!sentence) {
      items.push(wordItem(word));
      continue;
    }
    if (mode === 'mixed') items.push(wordItem(word));
    items.push(sentence);
  }
  return items;
}

/** 进度文案单位：纯单词说"词"，纯例句说"句"，混合说"题" */
export function itemUnit(mode: PracticeMode): string {
  return mode === 'word' ? '词' : mode === 'sentence' ? '句' : '题';
}
