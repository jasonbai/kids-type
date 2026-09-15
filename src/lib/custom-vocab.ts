import type { Level, Word } from '../types';

/** 自定义词表上限（localStorage 容量友好；超出截断并在导入报告中提示） */
export const MAX_CUSTOM_WORDS = 1000;

/**
 * 自定义词表单词约束：2-20 个小写英文字母。
 * 比内置 KET/PET 词库（≤12 字母）宽松——自定义词表多为进阶词，
 * 如 astrophysicist(14)；打字判定只覆盖字母键，长度本身无硬阻碍。
 */
const WORD_RE = /^[a-z]{2,20}$/;

/** csv 首列是这些表头词时，跳过首行 */
const HEADER_RE = /^(word|words|单词|词汇|单词表)$/i;

export interface CustomParseResult {
  /** 可入库的自定义词条（wordId = custom:<word>） */
  words: Word[];
  /** 与 KET/PET 词库重复被跳过的词数 */
  inLibrary: number;
  /** 文件内重复（只保留首个）被忽略的词数 */
  duplicateInFile: number;
  /** 不合法被跳过的词（最多保留前 20 个用于提示，单个词最长保留 50 字符） */
  invalid: string[];
  /** 是否因超出上限被截断 */
  truncated: boolean;
}

/** 由原始词构造自定义词条；word 必须已通过 WORD_RE 校验 */
export function makeCustomWord(word: string, meaning = '', phonetic = ''): Word {
  return { id: `custom:${word}`, word, phonetic, meaning, levels: ['CUSTOM'] as Level[] };
}

/** 行 → 规范化小写词；不合法返回 null */
function normalizeWord(raw: string): string | null {
  const word = raw.trim().toLowerCase();
  return WORD_RE.test(word) ? word : null;
}

/** 单行 CSV 解析：支持双引号包裹（内含逗号 / 转义 ""） */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * 解析家长/老师上传的词表文本。
 * - .txt：每行一个单词
 * - .csv：第 1 列单词、第 2 列中文释义（可选）、第 3 列音标（可选）；
 *   首行为表头（word/单词 等）时自动跳过
 *
 * 规则：规范化为小写；跳过与内置 KET/PET 重复的词（避免同词双份 SRS 记录）、
 * 文件内重复只保留首个；超出 MAX_CUSTOM_WORDS 截断。
 * 替换式导入：返回值即完整新词表。
 */
export function parseCustomWordList(
  text: string,
  opts: { csv: boolean; builtinWords: ReadonlySet<string> },
): CustomParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const words: Word[] = [];
  const seen = new Set<string>();
  const invalid: string[] = [];
  let inLibrary = 0;
  let duplicateInFile = 0;
  let truncated = false;

  // 表头识别走同一 CSV 解析（兼容 Excel 等"全字段带引号"的导出格式）
  const firstLineCells = opts.csv && lines.length > 0 ? parseCsvLine(lines[0] ?? '') : [];
  const startLine =
    firstLineCells.length > 0 && HEADER_RE.test((firstLineCells[0] ?? '').trim()) ? 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim() === '') continue;

    let rawWord = line;
    let meaning = '';
    let phonetic = '';
    if (opts.csv) {
      const fields = parseCsvLine(line);
      rawWord = fields[0] ?? '';
      meaning = (fields[1] ?? '').trim();
      phonetic = (fields[2] ?? '').trim();
    }
    const word = normalizeWord(rawWord);
    if (!word) {
      if (invalid.length < 20) invalid.push(rawWord.trim().slice(0, 50));
      continue;
    }
    if (opts.builtinWords.has(word)) {
      inLibrary++;
      continue;
    }
    if (seen.has(word)) {
      duplicateInFile++;
      continue;
    }
    if (words.length >= MAX_CUSTOM_WORDS) {
      truncated = true;
      break;
    }
    seen.add(word);
    words.push(makeCustomWord(word, meaning, phonetic));
  }

  return { words, inLibrary, duplicateInFile, invalid, truncated };
}
