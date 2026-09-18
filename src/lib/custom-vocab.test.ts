import { describe, expect, it } from 'vitest';
import { makeCustomWord, parseCustomWordList, parseCsvLine, MAX_CUSTOM_WORDS, customVocabTemplate } from './custom-vocab';

const BUILTIN = new Map(['apple', 'the', 'cat'].map(word => [word, { ...makeCustomWord(word, '内置释义', '/test/'), id: word }]));

function parse(text: string, csv = false) {
  return parseCustomWordList(text, { csv, builtinWords: BUILTIN });
}

describe('parseCustomWordList · txt', () => {
  it('每行一词：规范化小写、忽略空行与首尾空白', () => {
    const r = parse('  Apple \n\nbanana\nCAT-NOT   \nDog');
    expect(r.words.map((w) => w.word)).toEqual(['apple', 'banana', 'dog']);
    expect(r.invalid[0]).toMatchObject({ line: 4, value: 'CAT-NOT' });
  });

  it('内置词保留上传顺序并复用 ID 与内容', () => {
    const r = parse('apple\ntiger\nthe');
    expect(r.words.map(w => w.id)).toEqual(['apple', 'custom:tiger', 'the']);
    expect(r.words[0]?.meaning).toBe('内置释义');
  });

  it('文件内重复只保留首个', () => {
    const r = parse('tiger\nTIGER\ntiger!');
    expect(r.words).toHaveLength(1);
    expect(r.duplicateInFile).toBe(1);
    expect(r.invalid[0]?.value).toBe('tiger!');
  });

  it('长度上限 20：14 字母词合法，21 字母词无效', () => {
    const r = parse('astrophysicist\nincomprehensibilities');
    expect(r.words.map((w) => w.word)).toEqual(['astrophysicist']);
    expect(r.invalid[0]?.value).toBe('incomprehensibilities');
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


describe('模板与导入诊断', () => {
  it('模板具有 BOM/CRLF，原样导入保留中文与音标', () => {
    const text = customVocabTemplate();
    expect(text.startsWith('\uFEFF单词,中文释义,音标\r\n')).toBe(true);
    const r = parse(text, true);
    expect(r.words).toHaveLength(3);
    expect(r.words[0]).toMatchObject({ id: 'apple', meaning: '苹果', phonetic: '/ˈæpəl/' });
    expect(r.invalidCount).toBe(0);
  });
  it('覆盖字段仅用于自选词条；空字段补全', () => {
    expect(parse('apple,自选释义,', true).words[0]).toMatchObject({ id: 'apple', meaning: '自选释义', phonetic: '/test/' });
    expect(BUILTIN.get('apple')?.meaning).toBe('内置释义');
  });
  it('空白及只有表头视为空词表', () => {
    expect(parse(' \r\n').empty).toBe(true);
    expect(parse('\uFEFF\r\n单词,中文释义,音标\r\n', true).empty).toBe(true);
  });
  it('错误总数与最多 20 条样例分开统计', () => {
    const r = parse(Array(25).fill('bad-word').join('\n'));
    expect(r.invalidCount).toBe(25);
    expect(r.invalid).toHaveLength(20);
    expect(r.invalid[19]?.line).toBe(20);
    expect(r.empty).toBe(false);
  });
  it('正确读取多行引号字段并报告后续物理行号', () => {
    const r = parse('word,meaning,phonetic\r\napple,"苹果,水果\r\n第二行",\r\nbad-word', true);
    expect(r.words[0]?.meaning).toBe('苹果,水果\n第二行');
    expect(r.invalid[0]?.line).toBe(4);
  });
  it('拒绝未闭合引号、多余列及非法引号', () => {
    expect(parse('apple,a,b,c', true).invalidCount).toBe(1);
    expect(parse('apple,"broken', true).invalidCount).toBe(1);
    expect(parse('apple,"a"bad,b', true).invalidCount).toBe(1);
  });
});
