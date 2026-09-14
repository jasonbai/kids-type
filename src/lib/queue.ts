import type { SrsRecord, Word } from '../types';
import { isDue } from './srs';
import { todayKey } from './dateKey';

export const MAX_DUE_PER_DAY = 30;

export interface DailyQueue {
  /** 今日到期复习词（dueDate 升序，最早到期的先复习，上限 30） */
  dueWords: Word[];
  /** 今日新词（当前 level 词池按词库序从游标取，跳过已有记录的词） */
  newWords: Word[];
}

export interface BuildQueueOptions {
  /** 全部词库（复习池不分 level：学过的词都复习） */
  allVocab: Word[];
  /** 当前 level 词池（新词来源，按词库序） */
  levelVocab: Word[];
  records: Record<string, SrsRecord>;
  /** 当前 level 的新词游标（te:meta.newWordCursor[level]） */
  cursor: number;
  /** 每日新词数 */
  dailyNew: number;
  today?: string;
}

export function buildDailyQueue(opts: BuildQueueOptions): DailyQueue {
  const today = opts.today ?? todayKey();

  const dueWords = opts.allVocab
    .filter((w) => {
      const r = opts.records[w.id];
      return r && isDue(r, today);
    })
    .sort((a, b) => opts.records[a.id].dueDate.localeCompare(opts.records[b.id].dueDate))
    .slice(0, MAX_DUE_PER_DAY);

  const newWords: Word[] = [];
  for (let i = opts.cursor; i < opts.levelVocab.length && newWords.length < opts.dailyNew; i++) {
    const w = opts.levelVocab[i];
    if (!opts.records[w.id]) newWords.push(w);
  }

  return { dueWords, newWords };
}
