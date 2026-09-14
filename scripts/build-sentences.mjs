#!/usr/bin/env node
/**
 * 例句数据管线：合并 scripts/data/sentences/*.json 批次 → 校验 → src/data/sentences.json
 *
 * 批次文件格式（每批约 100 词，按词库顺序人工/AI 生成，中间产物不提交）：
 *   [ { "id": "apple", "s": [["I eat an apple", "我吃一个苹果。"], ["…", "…"], ["…", "…"]] } ]
 *
 * 例句写作硬约束（校验不过即退出非零，防止劣化入库）：
 * - 字符集 ^[A-Z][a-z]*( (I|[a-z]+))*$：首词大写、其余小写（"I" 可出现在任意位置）、单空格
 *   （无逗号/撇号/数字/问号/专有名词/句号；不用缩写，don't → do not）
 * - 词数 3~12、总长 ≤ 70；目标词以原形整词出现
 * - 用词 ∈ KET/PET 词表 ∪ allowlist.txt ∪ 词表屈折形（s/es/ed/d/ing/er/est/ies↔y）
 * - 中文翻译非空且不含英文字母
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const BATCH_DIR = join(SCRIPTS_DIR, 'data', 'sentences');
const OUT = join(SCRIPTS_DIR, '..', 'src', 'data', 'sentences.json');

const SENTENCES_PER_WORD = 3;
const MIN_WORDS = 3;
const MAX_WORDS = 12;
const MAX_LEN = 70;
const EN_RE = /^[A-Z][a-z]*( (I|[a-z]+))*$/;

function readJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// 词表：白名单与屈折校验基准（输出也按词库序）
const vocab = [
  ...readJSON(join(SCRIPTS_DIR, '..', 'src', 'data', 'ket.json')),
  ...readJSON(join(SCRIPTS_DIR, '..', 'src', 'data', 'pet.json')),
];
const VOCAB = new Set(vocab.map((e) => e.word));
const IDS = vocab.map((e) => e.id);

// 基础功能词白名单（词表未覆盖的超短词等；一行一词，# 注释，可随时扩充重跑）
const allowlist = new Set(
  readFileSync(join(BATCH_DIR, 'allowlist.txt'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#')),
);

/** 屈折还原候选（宽松生成候选集，命中词表/白名单即通过）：
 *  likes→like、boxes→box、studies→study(ies↔y)、tasted→taste(e回去)、
 *  making→make、larger→large、faster→fast；双写辅音(running/sitting)不支持，进白名单 */
function baseForms(token) {
  const out = [token];
  if (token.endsWith('ies')) out.push(token.slice(0, -3) + 'y');
  if (token.endsWith('ier')) out.push(token.slice(0, -3) + 'y');
  if (token.endsWith('es')) out.push(token.slice(0, -2));
  if (token.endsWith('s')) out.push(token.slice(0, -1));
  if (token.endsWith('ed')) {
    out.push(token.slice(0, -2));
    out.push(token.slice(0, -2) + 'e');
  }
  if (token.endsWith('d')) out.push(token.slice(0, -1));
  if (token.endsWith('ing')) {
    out.push(token.slice(0, -3));
    out.push(token.slice(0, -3) + 'e');
  }
  if (token.endsWith('er')) {
    out.push(token.slice(0, -2));
    out.push(token.slice(0, -1));
  }
  if (token.endsWith('est')) {
    out.push(token.slice(0, -3));
    out.push(token.slice(0, -3) + 'e');
  }
  return out;
}

function tokenAllowed(token) {
  return baseForms(token).some((b) => VOCAB.has(b) || allowlist.has(b));
}

// ---- 合并批次 ----
const errors = [];
const err = (tag, msg) => errors.push(`${tag}: ${msg}`);

const batchFiles = readdirSync(BATCH_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();
if (batchFiles.length === 0) {
  console.error(`✗ ${BATCH_DIR} 下没有任何批次 json`);
  process.exit(1);
}

const map = new Map();
for (const f of batchFiles) {
  const arr = readJSON(join(BATCH_DIR, f));
  if (!Array.isArray(arr)) {
    console.error(`✗ 批次 ${f} 不是数组`);
    process.exit(1);
  }
  for (const entry of arr) {
    if (map.has(entry.id)) err(entry.id, `在多个批次重复（${f}）`);
    map.set(entry.id, entry.s);
  }
}

// ---- 逐条校验 ----
for (const [id, s] of map) {
  if (!VOCAB.has(id)) {
    err(id, '不在词表中');
    continue;
  }
  if (!Array.isArray(s) || s.length !== SENTENCES_PER_WORD) {
    err(id, `例句数 ${Array.isArray(s) ? s.length : '非数组'} ≠ ${SENTENCES_PER_WORD}`);
    continue;
  }
  const seen = new Set();
  s.forEach((pair, i) => {
    const tag = `${id}[${i}]`;
    const [en, cn] = pair ?? [];
    if (typeof en !== 'string' || !EN_RE.test(en)) {
      err(tag, `格式不符：${JSON.stringify(en)}`);
      return;
    }
    const words = en.split(' ');
    if (words.length < MIN_WORDS || words.length > MAX_WORDS) err(tag, `词数 ${words.length}`);
    if (en.length > MAX_LEN) err(tag, `过长 ${en.length}`);
    if (!words.some((w) => w.toLowerCase() === id)) err(tag, '未包含目标词原形（整词）');
    for (const w of words) {
      if (!tokenAllowed(w.toLowerCase())) err(tag, `生僻/词表外单词：${w}`);
    }
    if (seen.has(en)) err(tag, '同词例句重复');
    seen.add(en);
    if (typeof cn !== 'string' || cn.trim().length < 2) {
      err(tag, '中文翻译缺失');
    } else if (/[a-zA-Z]/.test(cn)) {
      err(tag, `中文混入英文：${cn}`);
    }
  });
}

// ---- 覆盖率（生成中途可用 SENTENCES_ALLOW_PARTIAL=1 只告警，最终入库必须全量）----
const missing = IDS.filter((id) => !map.has(id));
if (missing.length > 0) {
  if (process.env.SENTENCES_ALLOW_PARTIAL === '1') {
    console.warn(`⚠ 暂缺 ${missing.length} 词例句（部分模式，仅告警）`);
  } else {
    err('coverage', `缺少 ${missing.length} 词例句，如：${missing.slice(0, 30).join(', ')}`);
  }
}

if (errors.length > 0) {
  console.error(`✗ ${errors.length} 处校验失败（最多展示 50 条）：`);
  console.error(errors.slice(0, 50).join('\n'));
  process.exit(1);
}

// ---- 按词库序输出（紧凑单行，与 ket/pet.json 风格一致）----
const out = {};
for (const id of IDS) out[id] = map.get(id);
writeFileSync(OUT, JSON.stringify(out));
console.log(
  `✓ ${map.size} 词 × ${SENTENCES_PER_WORD} 句 → ${OUT}（${(statSync(OUT).size / 1024).toFixed(1)} KB）`,
);
