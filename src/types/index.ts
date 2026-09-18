/** 词库池：KET / PET 为内置词库，CUSTOM 为家长/老师上传的自定义词表 */
export type Level = 'KET' | 'PET' | 'CUSTOM';

/** 例句（英文 + 中文翻译）；英文格式硬约束见 scripts/build-sentences.mjs */
export interface Sentence {
  en: string;
  cn: string;
}

/** 练习模式：单词 / 单词+例句成对 / 纯例句 */
export type PracticeMode = 'word' | 'mixed' | 'sentence';

/** 词库词条：wordId = word 本身，全局唯一（KET/PET 重叠词只存一份） */
export interface Word {
  id: string;
  /** 硬约束：/^[a-z]{2,12}$/，纯小写字母（打字练习只覆盖字母键） */
  word: string;
  /** IPA 音标，形如 "/neɪm/" */
  phonetic: string;
  /** 中文释义（整串） */
  meaning: string;
  /** 来源标签：['KET'] | ['PET']（物理上按文件拆分）；自定义词表为 ['CUSTOM'] */
  levels: Level[];
}

/** 每词一条的艾宾浩斯复习记录（简化 SM-2） */
export interface SrsRecord {
  wordId: string;
  /** 难度系数，初始 2.5，范围 [1.3, 2.5] */
  ease: number;
  /** 当前间隔（天），上限 180 */
  interval: number;
  /** 已连续答对次数 */
  reps: number;
  /** 累计打错次数 */
  lapses: number;
  /** 到期日，本地 dateKey "YYYY-MM-DD"（禁止 UTC 比较） */
  dueDate: string;
  /** ISO 时间戳 */
  lastReviewAt: string;
}

/** 错题本条目 */
export interface WrongBookEntry {
  wordId: string;
  /** 累计错几次 */
  wrongCount: number;
  /** 常错字母（如 ["a","e"]） */
  wrongLetters: string[];
  /** 错题本练习中连续答对计数，达到阈值移出 */
  clearStreak: number;
  addedAt: string;
  /** 答对满 N 次后置为时间，表示已移出 */
  clearedAt: string | null;
}

/** 每日练习日志（统计页与打卡） */
export interface DailyLog {
  /** 本地 dateKey */
  date: string;
  wordsTyped: number;
  correctCount: number;
  wrongCount: number;
  totalSeconds: number;
  wpmBest: number;
  /** 当日首次完成的新词数（旧数据无此字段，读取时按 0 兜底） */
  newWordsLearned: number;
}

export interface Settings {
  /** 已选定音色（设置面板试听后持久化），null = 自动挑选 */
  voiceURI: string | null;
  /** 语速 0.6 ~ 1.2 */
  rate: number;
  keySound: boolean;
  keySoundVolume: number;
  currentLevel: Level;
  /** 每日新词数 5 ~ 20，默认 10 */
  dailyNewWords: number;
  /** 词间停顿毫秒 */
  wordIntervalMs: number;
  /** 打字时显示虚拟双手指法指引（线稿手 + 活动手指高亮 + 轨迹线） */
  showHandGuide: boolean;
  /** 打字时显示屏幕虚拟键盘（关闭后仅保留打字区与文字提示，适合进阶用户） */
  showKeyboard: boolean;
  /** 练习模式：纯单词 / 单词+例句成对 / 纯例句 */
  practiceMode: PracticeMode;
}

export interface Meta {
  version: 1;
  streakDays: number;
  /** 本地 dateKey */
  lastActiveDate: string | null;
  /** 新词推进游标（按词库序），分 level 记录 */
  newWordCursor: Record<Level, number>;
  /** 累计星星（连对每满 5 词 +1） */
  totalStars: number;
}

/** 一次按键的判定结果 */
export type JudgeResult =
  | { type: 'correct' }
  | { type: 'wrong'; expected: string }
  | { type: 'complete' };
