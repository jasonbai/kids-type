/**
 * 一次性词库构建脚本。
 *
 * 输入（scripts/data/，已 gitignore，需手工准备）：
 *   words.csv      — Maximax67/Words-CEFR-Dataset：word_id, word, stem_word_id
 *   word_pos.csv   — 同上：word_pos_id, word_id, pos_tag_id, lemma_word_id, frequency_count, level
 *                    level 为 CEFR-J 浮点等级：1=A1, 2=A2, 2.5≈A2+, 3=B1, 3.5≈B1+
 *   词典源（二选一，优先 ecdict.db）：
 *   ecdict.db               — skywind3000/ECDICT sqlite 导出（releases ecdict-sqlite-*.zip 解压，
 *                             内含 stardict.db，重命名为 ecdict.db；MIT 许可，可随仓库开源分发）；
 *                             当前词库即由此生成
 *   final_vocabulary.json   — mahavivo/open-ecdict 的 data/final_vocabulary.json
 *                             （OALD8/ODE 来源，13 万词条，自带 IPA 与中文释义，raw 域可秒下）
 *                             ⚠️ 该源释义来自牛津学习词典，仅适合个人/家庭使用，不可随开源仓库分发
 *
 * 用法：
 *   node scripts/build-vocab.mjs                 # 全量重建（按词频配额选词，词表可能与旧版不同）
 *   node scripts/build-vocab.mjs --keep-words    # 沿用现有词表与顺序，仅刷新音标/释义
 *                                                #（换词典源时用，保证例句等下游数据对齐）
 *
 * 筛选规则（已确认决策：CEFR 数据集代替官方词表，词表与官方版可能有出入）：
 *   KET 池 = 该词最宽松等级 ≤ 2.5（A1 ~ A2+），按 Google 词频降序取满 KET_QUOTA
 *   PET 池 = (2.5, 3.5]（B1 / B1+），按词频降序取满 PET_QUOTA
 *   两池按"词的最小等级"划分，天然不相交 → 落到两个文件即全局去重
 *
 * 清洗硬约束（打字练习只覆盖字母键）：
 *   仅保留 /^[a-z]{2,12}$/ 的纯小写字母词；ECDICT 缺音标或缺释义的词丢弃并计入报告。
 *
 * 用法：
 *   node scripts/build-vocab.mjs                 # 全量重建（按词频配额选词，词表可能与旧版不同）
 *   node scripts/build-vocab.mjs --keep-words    # 沿用现有词表与顺序，仅刷新音标/释义
 *                                                #（换词典源时用，保证例句等下游数据对齐）
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');
const OUT_DIR = path.join(__dirname, '..', 'src', 'data');

const KET_QUOTA = 1500;
const PET_QUOTA = 2000;
const KET_MAX_LEVEL = 2.5; // 含 A2+
const PET_MAX_LEVEL = 3.5; // 含 B1+

// ---------- CSV 解析 ----------

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ---------- CEFR 数据集 → 候选池 ----------

function loadCandidates() {
  const words = new Map(); // word_id → word
  for (const l of fs.readFileSync(path.join(DATA, 'words.csv'), 'utf8').split('\n').slice(1)) {
    if (!l.trim()) continue;
    const [id, w] = parseCsvLine(l);
    if (w) words.set(id, w);
  }

  // word_id → 最小等级 + 最高词频（同一词多个词性行取最宽松等级）
  const info = new Map();
  for (const l of fs.readFileSync(path.join(DATA, 'word_pos.csv'), 'utf8').split('\n').slice(1)) {
    if (!l.trim()) continue;
    const [, wordId, , , freq, level] = parseCsvLine(l);
    const lv = Number(level);
    const f = Number(freq);
    const cur = info.get(wordId);
    if (!cur) info.set(wordId, { lv, f });
    else {
      if (lv < cur.lv) cur.lv = lv;
      if (f > cur.f) cur.f = f;
    }
  }

  const clean = (w) => /^[a-z]{2,12}$/.test(w);
  const rows = [];
  for (const [id, { lv, f }] of info) {
    const w = words.get(id);
    if (w && clean(w)) rows.push({ word: w, lv, f });
  }
  rows.sort((a, b) => b.f - a.f); // 词频降序：先学最有用的词

  const ket = rows.filter((r) => r.lv <= KET_MAX_LEVEL);
  const pet = rows.filter((r) => r.lv > KET_MAX_LEVEL && r.lv <= PET_MAX_LEVEL);
  return { ket, pet };
}

// ---------- 词典源加载（双源：优先 ecdict.db，备选 final_vocabulary.json） ----------

/** 统一为 { word → { phonetic, translation } } */
function loadDictionary() {
  const dbPath = path.join(DATA, 'ecdict.db');
  const jsonPath = path.join(DATA, 'final_vocabulary.json');

  if (fs.existsSync(dbPath)) {
    const { DatabaseSync } = awaitImportSqlite();
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const map = new Map();
    const inflect = new Map(); // 屈折形 → 原形（exchange 字段：d:过去式 p:过去分词 i:ing 3:三单 r:比较级 t:最高级 s:复数 1:变形）
    const INFLECT_KEYS = new Set(['d', 'p', 'i', '3', 'r', 't', 's', '1']);
    for (const row of db.prepare('SELECT word, phonetic, translation, exchange FROM stardict').all()) {
      const w = row.word;
      if (w === w.toLowerCase()) {
        map.set(w, row); // 小写原生条目最权威，直接覆盖
      } else {
        // ECDICT 把部分虚词/专名收成大写（AM / China / North），补一份小写别名兜底
        if (!map.has(w.toLowerCase())) map.set(w.toLowerCase(), row);
        map.set(w, row);
      }
      if (w === w.toLowerCase() && row.exchange) {
        const lemma = w.toLowerCase();
        for (const tok of String(row.exchange).split('/')) {
          const [k, v] = tok.split(':');
          if (v && INFLECT_KEYS.has(k) && !inflect.has(v.toLowerCase())) {
            inflect.set(v.toLowerCase(), lemma);
          }
        }
      }
    }
    map.inflect = inflect;
    db.close();
    console.log(`词典源：ecdict.db（${map.size} 词条）`);
    // 词典查询：先查原词；条目缺音标或缺释义时，再用屈折表回退到原形条目
    const complete = (r) =>
      r && String(r.phonetic ?? '').trim() && String(r.translation ?? '').trim();
    return {
      get(word) {
        const direct = map.get(word);
        if (complete(direct)) return direct;
        const viaLemma = map.get(inflect.get(word));
        if (complete(viaLemma)) return viaLemma;
        return FALLBACK_ENTRIES[word] ?? direct;
      },
    };
  }

  if (fs.existsSync(jsonPath)) {
    const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const map = new Map();
    for (const e of entries) {
      const def = String(e.def ?? '').trim();
      if (!e.pron || !def || def.startsWith('►')) continue; // 跳过重定向与缺字段词条
      map.set(e.headword, { phonetic: e.pron, translation: def });
    }
    console.log(`词典源：final_vocabulary.json（${map.size} 有效词条）`);
    return map;
  }

  console.error('缺少词典源：请准备 scripts/data/ecdict.db 或 scripts/data/final_vocabulary.json\n参见脚本头部说明。');
  process.exit(1);
}

function awaitImportSqlite() {
  // 延迟引入：没有 ecdict.db 的环境下不需要 node:sqlite
  const require = createRequire(import.meta.url);
  return require('node:sqlite');
}

/** 音标归一化：去括号、取第一读音、' → ˈ（U+02C8）、包成 /…/ */
function normalizePhonetic(raw) {
  let s = String(raw).trim().replace(/^\[|\]$/g, '').replace(/^\/|\/$/g, '');
  s = s.split(/[,;]/).map((t) => t.trim()).filter(Boolean)[0] ?? ''; // 多读音只取第一个（容忍 ECDICT 的前导逗号）
  if (!s) return '';
  s = s.replace(/'/g, 'ˈ');
  return `/${s}/`;
}

/**
 * ECDICT 兜底表：少量词 ECDICT 缺音标（或整词缺收），手写补充（释义为原创简明中文）。
 * phonetic 为裸音标（normalizePhonetic 会包 /…/）。
 */
const FALLBACK_ENTRIES = {
  mm: { phonetic: 'em', translation: 'n. 毫米；int. 嗯' },
  theatre: { phonetic: 'ˈθiәtә', translation: 'n. 戏院，剧场' },
  app: { phonetic: 'æp', translation: 'n. 应用程序（application 的缩写）' },
  positively: { phonetic: 'ˈpɒzәtivli', translation: 'adv. 明确地；赞许地；积极地' },
  interrupted: { phonetic: 'ˌintәˈrʌptid', translation: 'v. 打断，中断（interrupt 的过去式）' },
  workplace: { phonetic: 'ˈwә:kpleis', translation: 'n. 工作场所' },
  unrelated: { phonetic: 'ˌʌnriˈleitid', translation: 'adj. 无关的，不相关的' },
  conveyor: { phonetic: 'kәnˈveiә', translation: 'n. 传送带，运送者' },
  assignee: { phonetic: 'ˌæsiˈni:', translation: 'n. 受让人，代理人' },
  freshman: { phonetic: 'ˈfreʃmәn', translation: 'n. 新手；（大学）一年级学生' },
};

/**
 * 高频虚词的手写覆盖表：这些词是孩子最先练到的，词典原文（OALD 式长义项）
 * 对儿童不友好，逐条替换为简明释义。音标仍取词典。
 */
const MEANING_OVERRIDES = {
  the: 'art. 这个；那个（定冠词）',
  a: 'art. 一（个）（不定冠词）',
  of: 'prep. ……的',
  to: 'prep. 到，向；给……的',
  and: 'conj. 和，与，而且',
  in: 'prep. 在……里面；在……之后',
  is: 'v. 是（be 的第三人称单数）',
  it: 'pron. 它',
  be: 'v. 是；成为',
  that: 'pron. 那，那个',
  on: 'prep. 在……上面；关于',
  with: 'prep. 和……一起；用，以',
  he: 'pron. 他',
  they: 'pron. 他们；她们；它们',
  this: 'pron. 这，这个',
  we: 'pron. 我们',
  you: 'pron. 你；你们',
  do: 'v. 做，干',
  does: 'v. 做（do 的第三人称单数）',
  did: 'v. 做（do 的过去式）',
  not: 'adv. 不，没有',
  have: 'v. 有；吃；进行',
  has: 'v. 有（have 的第三人称单数）',
  had: 'v. 有（have 的过去式）',
  from: 'prep. 从；来自',
  by: 'prep. 由，被；通过',
  at: 'prep. 在（某地、某时）',
  as: 'conj. 作为；当……时；因为',
  but: 'conj. 但是',
  or: 'conj. 或者',
  if: 'conj. 如果，假如',
  so: 'adv. 如此，那么；因此',
  no: 'adj. 没有的；adv. 不，不是',
  out: 'adv. 出，向外；在外面',
  up: 'adv. 向上；起来',
  down: 'adv. 向下；下去',
  will: 'v. 将要，会（助动词）',
  would: 'v. 将会（will 的过去式）',
  can: 'v. 能，可以',
  could: 'v. 能（can 的过去式）',
  should: 'v. 应该',
  was: 'v. 是（is/am 的过去式）',
  were: 'v. 是（are 的过去式）',
  are: 'v. 是（be 的复数形式）',
  for: 'prep. 为了；给；因为',
  go: 'v. 去，走',
  get: 'v. 得到；到达；变得',
};

/** 词性优先级：名词 > 动词 > 形容词 > 副词 > 虚词（儿童学词先看实词义） */
function posPriority(pos) {
  if (/^n\.?$/.test(pos)) return 1;
  if (/^v(t|i)?\.?$/.test(pos)) return 2;
  if (/^adj\.?$/.test(pos)) return 3;
  if (/^adv\.?$/.test(pos)) return 4;
  return 5;
}

/** 拆出词性标记与编号义项（过滤空义项） */
function parseSegment(seg) {
  const s = seg.replace(/\s+/g, ' ').trim();
  const posMatch = s.match(/^[a-z]+\.?\s*/);
  const pos = posMatch ? posMatch[0].trim() : '';
  const body = posMatch ? s.slice(posMatch[0].length) : s;
  const senses = (/\d+\./.test(body) ? body.split(/\s*\d+\.\s*/) : [body])
    .map((x) => x.trim().replace(/[；;]\s*$/, ''))
    .filter(Boolean)
    .slice(0, 2);
  return { pos, senses, order: 0 };
}

/** 释义归一化：按词性优先级取前两组 × 各 2 个义项，截断到儿童友好的长度 */
function normalizeMeaning(raw, word) {
  if (MEANING_OVERRIDES[word]) return MEANING_OVERRIDES[word];
  const segments = String(raw)
    .split(/\s*\|\s*/)
    .map(parseSegment)
    .filter((s) => s.senses.length > 0)
    .map((s, i) => ({ ...s, order: i }));
  segments.sort((a, b) => posPriority(a.pos) - posPriority(b.pos) || a.order - b.order);
  let out = segments
    .slice(0, 2)
    .map((s) => [s.pos, s.senses.join('；')].filter(Boolean).join(' '))
    .join('；');
  if (out.length > 80) out = out.slice(0, 80).replace(/\S*$/, '') + '…';
  return out;
}

/** 词典行 → Word 条目；不合格返回 null 并记录原因 */
function toEntry(word, dictRow, level, drops) {
  if (!dictRow) {
    drops.push([word, '词典无此词']);
    return null;
  }
  const phonetic = normalizePhonetic(dictRow.phonetic || '');
  const meaning = normalizeMeaning(dictRow.translation || '', word);
  if (!phonetic) {
    drops.push([word, '缺音标']);
    return null;
  }
  if (!meaning) {
    drops.push([word, '缺中文释义']);
    return null;
  }
  return { id: word, word, phonetic, meaning, levels: [level] };
}

/** 沿词频降序走查候选池，join 成功的进结果，直到取满配额 */
function fillQuota(dict, pool, quota, level) {
  const result = [];
  const drops = [];
  const CHUNK = 2000;
  for (let start = 0; start < pool.length && result.length < quota; start += CHUNK) {
    const slice = pool.slice(start, start + CHUNK).map((r) => r.word);
    for (const w of slice) {
      if (result.length >= quota) break;
      const entry = toEntry(w, dict.get(w), level, drops);
      if (entry) result.push(entry);
    }
  }
  return { result, drops };
}

/**
 * --keep-words：词表与顺序完全沿用现有 ket.json/pet.json，仅用新词典源刷新音标与释义。
 * 用于更换词典源（如开源切换到 ECDICT）时保持例句等下游数据与词表对齐。
 * 词典缺收的词保留原条目并告警，不改变词表。
 */
function refreshWithDict(dict, file, level) {
  const old = JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'));
  const result = [];
  const drops = [];
  for (const e of old) {
    const entry = toEntry(e.id, dict.get(e.id), level, drops);
    if (entry) result.push(entry);
    else {
      console.warn(`--keep-words：${e.id} 新词典缺收或缺字段，保留原条目`);
      result.push(e);
    }
  }
  return { result, drops };
}

// ---------- 主流程 ----------

function main() {
  for (const f of ['words.csv', 'word_pos.csv']) {
    if (!fs.existsSync(path.join(DATA, f))) {
      console.error(`缺少输入文件：${f}\n参见脚本头部说明准备 scripts/data/。`);
      process.exit(1);
    }
  }

  const { ket, pet } = loadCandidates();
  const keepWords = process.argv.includes('--keep-words');
  let ketOut, petOut;
  if (keepWords) {
    const dict = loadDictionary();
    ketOut = refreshWithDict(dict, 'ket.json', 'KET');
    petOut = refreshWithDict(dict, 'pet.json', 'PET');
  } else {
    console.log(`候选池：KET(A1~A2+) ${ket.length} 词，PET(B1/B1+) ${pet.length} 词`);
    const dict = loadDictionary();
    ketOut = fillQuota(dict, ket, KET_QUOTA, 'KET');
    petOut = fillQuota(dict, pet, PET_QUOTA, 'PET');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'ket.json'), JSON.stringify(ketOut.result));
  fs.writeFileSync(path.join(OUT_DIR, 'pet.json'), JSON.stringify(petOut.result));

  const report = [
    `KET: 候选 ${ket.length}，入选 ${ketOut.result.length}（配额 ${KET_QUOTA}）`,
    `PET: 候选 ${pet.length}，入选 ${petOut.result.length}（配额 ${PET_QUOTA}）`,
    '',
    '丢弃明细（前 200 条）：',
    ...[...ketOut.drops, ...petOut.drops].slice(0, 200).map(([w, why]) => `  ${w}  ${why}`),
  ].join('\n');
  fs.writeFileSync(path.join(DATA, 'report.txt'), report);

  console.log(`产出：ket.json ${ketOut.result.length} 词，pet.json ${petOut.result.length} 词`);
  console.log(`丢弃：KET ${ketOut.drops.length} 条，PET ${petOut.drops.length} 条（详见 scripts/data/report.txt）`);

  // 抽查样例（首/中/尾各 5 词）
  for (const [name, arr] of [['KET', ketOut.result], ['PET', petOut.result]]) {
    console.log(`\n${name} 抽查：`);
    const idxs = [0, 1, Math.floor(arr.length / 2), arr.length - 2, arr.length - 1];
    for (const i of idxs) console.log(`  ${arr[i].word}  ${arr[i].phonetic}  ${arr[i].meaning.slice(0, 40)}`);
  }
}

main();
