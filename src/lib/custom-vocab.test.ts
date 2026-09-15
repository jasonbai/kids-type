import { describe, expect, it } from 'vitest';
import { makeCustomWord, parseCustomWordList, parseCsvLine, MAX_CUSTOM_WORDS } from './custom-vocab';

const BUILTIN = new Set(['apple', 'the', 'cat']);

function parse(text: string, csv = false) {
  return parseCustomWordList(text, { csv, builtinWords: BUILTIN });
}

describe('parseCustomWordList · txt', () => {
  it('每行一词：规范化小写、忽略空行与首尾空白', () => {
    const r = parse('  Apple \n\nbanana\nCAT-NOT   \nDog');
    // CAT-NOT 含连字符 → 无效；apple/the 已在词库 → 跳过？ 不，BUILTIN 只有 apple/the/cat
    expect(r.words.map((w) => w.word)).toEqual(['banana', 'dog']);
    expect(r.invalid).toEqual(['CAT-NOT']);
  });

  it('与内置词库重复的词被跳过并计数', () => {
    const r = parse('apple\ntiger\nthe');
    expect(r.words.map((w) => w.word)).toEqual(['tiger']);
    expect(r.inLibrary).toBe(2);
  });

  it('文件内重复只保留首个', () => {
    const r = parse('tiger\nTIGER\ntiger!');
    expect(r.words).toHaveLength(1);
    expect(r.duplicateInFile).toBe(1);
    expect(r.invalid).toEqual(['tiger!']);
  });

  it('长度上限 20：14 字母词合法，21 字母词无效', () => {
    const r = parse('astrophysicist\nincomprehensibilities');
    expect(r.words.map((w) => w.word)).toEqual(['astrophysicist']);
    expect(r.invalid).toEqual(['incomprehensibilities']);
  });

  it('构造 wordId 与 levels', () => {
    const r = parse('tiger');
    expect(r.words[0]).toEqual(makeCustomWord('tiger'));
    expect(r.words[0]).toMatchObject({ id: 'custom:tiger', levels: ['CUSTOM'], meaning: '', phonetic: '' });
  });

  it('超过上限截断并标记 truncated', () => {
    // 生成互不相同的 3 字母纯字母词（i < 26³ 内唯一）
    const L = 'abcdefghijklmnopqrstuvwxyz';
    const many = Array.from({ length: MAX_CUSTOM_WORDS + 5 }, (_, i) =>
      `${L[i % 26]}${L[Math.floor(i / 26) % 26]}${L[Math.floor(i / 676) % 26]}`,
    );
    const r = parse(many.join('\n'));
    expect(r.words).toHaveLength(MAX_CUSTOM_WORDS);
    expect(r.truncated).toBe(true);
  });
});

describe('parseCustomWordList · csv', () => {
  it('词,释义,音标 三列；表头自动跳过', () => {
    const r = parse('word,meaning,phonetic\ntiger,老虎,/ˈtaɪɡə/', true);
    expect(r.words).toEqual([makeCustomWord('tiger', '老虎', '/ˈtaɪɡə/')]);
  });

  it('非表头首行不跳过；缺省列取空串', () => {
    const r = parse('tiger,老虎', true);
    expect(r.words).toEqual([makeCustomWord('tiger', '老虎', '')]);
  });

  it('带引号字段：内含逗号与转义引号', () => {
    const r = parse('tiger,"老虎, 大猫","""big"" cat"', true);
    expect(r.words[0]?.meaning).toBe('老虎, 大猫');
    expect(r.words[0]?.phonetic).toBe('"big" cat');
  });

  it('表头匹配大小写不敏感，第二行起生效', () => {
    const r = parse('Word,中文,音标\ntiger,老虎,', true);
    expect(r.words).toHaveLength(1);
  });

  it('全字段带引号的表头同样被跳过（Excel/第三方导出常见格式）', () => {
    const r = parse('"word","meaning","phonetic"\n"tiger","老虎","/ˈtaɪɡə/"', true);
    expect(r.words).toEqual([makeCustomWord('tiger', '老虎', '/ˈtaɪɡə/')]);
  });
});

describe('parseCsvLine', () => {
  it('普通分割', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('引号内逗号不分割、"" 转义为 "', () => {
    expect(parseCsvLine('a,"b,c","""q"""')).toEqual(['a', 'b,c', '"q"']);
  });
});
