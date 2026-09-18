import type { Level, Word } from '../types';

export const MAX_CUSTOM_WORDS = 1000;
const WORD_RE = /^[a-z]{2,20}$/;
const HEADER_RE = /^(word|words|单词|词汇|单词表)$/i;

export interface CustomParseResult {
  words: Word[];
  duplicateInFile: number;
  invalidCount: number;
  invalid: Array<{ line: number; value: string; reason: string }>;
  truncated: boolean;
  empty: boolean;
}

export function makeCustomWord(word: string, meaning = '', phonetic = ''): Word {
  return { id: `custom:${word}`, word, phonetic, meaning, levels: ['CUSTOM'] as Level[] };
}

/** RFC-style quoted fields, including escaped quotes and embedded newlines. */
function csvRecords(text: string) {
  const records: Array<{ fields: string[]; line: number; malformed: boolean }> = [];
  let fields: string[] = [], field = '', quoted = false, closed = false, malformed = false;
  let line = 1, start = 1;
  const pushField = () => { fields.push(field); field = ''; closed = false; };
  const pushRecord = () => {
    pushField();
    records.push({ fields, line: start, malformed });
    fields = []; malformed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else { field += ch; if (ch === '\n') line++; }
    } else if (ch === ',') pushField();
    else if (ch === '\n') { pushRecord(); line++; start = line; }
    else if (ch === '"' && field === '' && !closed) quoted = true;
    else {
      if (ch === '"' || (closed && ch.trim() !== '')) malformed = true;
      field += ch;
    }
  }
  if (quoted) malformed = true;
  pushRecord();
  return records;
}

export function parseCsvLine(line: string): string[] {
  return csvRecords(line)[0]!.fields;
}

export function customVocabTemplate(): string {
  const rows = [
    ['单词', '中文释义', '音标'],
    ['apple', '苹果', '/ˈæpəl/'],
    ['banana', '香蕉', '/bəˈnɑːnə/'],
    ['astrophysicist', '天体物理学家', '/ˌæstrəʊˈfɪzɪsɪst/'],
  ];
  return '\uFEFF' + rows.map(row => row.map(cell => /[",\r\n]/.test(cell)
    ? `"${cell.replace(/"/g, '""')}"` : cell).join(',')).join('\r\n') + '\r\n';
}

/** Replacement list; builtin IDs share progress while custom display fields stay local. */
export function parseCustomWordList(
  text: string,
  opts: { csv: boolean; builtinWords: ReadonlyMap<string, Word> },
): CustomParseResult {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const records = opts.csv ? csvRecords(normalized) : normalized.split('\n').map((value, index) =>
    ({ fields: [value], line: index + 1, malformed: false }));
  const result: CustomParseResult = {
    words: [], duplicateInFile: 0, invalidCount: 0, invalid: [], truncated: false, empty: true,
  };
  const seen = new Set<string>();
  let first = true;
  for (const record of records) {
    const { fields, line, malformed } = record;
    if (!malformed && fields.every(field => field.trim() === '')) continue;
    if (first && opts.csv && !malformed && HEADER_RE.test(fields[0]!.trim())) {
      first = false; continue;
    }
    first = false;
    result.empty = false;
    const word = fields[0]!.trim().toLowerCase();
    const reason = malformed ? 'CSV 引号格式不正确' : fields.length > 3
      ? '最多三列；含英文逗号的内容需用双引号包裹' : !WORD_RE.test(word)
        ? '单词须为 2–20 个英文字母，不支持空格、数字或标点' : '';
    if (reason) {
      result.invalidCount++;
      if (result.invalid.length < 20) result.invalid.push({ line, value: fields[0]!.trim().slice(0, 50), reason });
      continue;
    }
    if (seen.has(word)) { result.duplicateInFile++; continue; }
    seen.add(word);
    if (result.words.length >= MAX_CUSTOM_WORDS) { result.truncated = true; continue; }
    const builtin = opts.builtinWords.get(word);
    const meaning = fields[1]?.trim() || builtin?.meaning || '';
    const phonetic = fields[2]?.trim() || builtin?.phonetic || '';
    result.words.push(builtin ? { ...builtin, meaning, phonetic, levels: ['CUSTOM'] }
      : makeCustomWord(word, meaning, phonetic));
  }
  return result;
}
