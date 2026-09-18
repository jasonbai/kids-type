import { useEffect, useRef, useState } from 'react';
import {
  BookPlus,
  Database,
  Download,
  Music,
  NotebookPen,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import GithubIcon from "./GithubIcon";
import { APP_VERSION, REPO_URL } from '../lib/repo';
import type { Settings } from '../types';
import { listEnglishVoices, speak, unlockSpeech } from '../lib/speech';
import { customVocabTemplate, MAX_CUSTOM_WORDS, parseCustomWordList } from '../lib/custom-vocab';
import type { CustomParseResult } from '../lib/custom-vocab';
import { KET_WORDS, PET_WORDS } from '../data/vocab';
import { KEYS } from '../storage/keys';
import { load, remove, save } from '../storage/storage';
import { useLearning } from '../store/learning';
import { Button } from './ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 全量备份文件结构（= localStorage 各键 + meta；customWords 为可选旧版兼容字段） */
interface BackupFile {
  version: number;
  records: unknown;
  wrongBook: unknown;
  logs: unknown;
  settings: unknown;
  meta: unknown;
  customWords?: unknown;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const { state, dispatch } = useLearning();
  const s = state.settings;

  // 音色列表异步加载（首次 getVoices 为空，voiceschanged 后刷新）
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [vocabReport, setVocabReport] = useState<{ message: string; result?: CustomParseResult } | null>(null);
  const [importingVocab, setImportingVocab] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vocabInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const refresh = () => setVoices(listEnglishVoices());
    refresh();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', refresh);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
    }
  }, [open]);

  if (!open) return null;

  const patch = (p: Partial<Settings>) => dispatch({ type: 'SETTINGS', patch: p });

  const preview = () => {
    unlockSpeech();
    speak('apple', { rate: s.rate, voiceURI: s.voiceURI });
  };

  const exportBackup = () => {
    const backup: BackupFile = {
      version: 1,
      records: load(KEYS.records, {}),
      wrongBook: load(KEYS.wrongBook, {}),
      logs: load(KEYS.logs, []),
      settings: load(KEYS.settings, {}),
      meta: load(KEYS.meta, {}),
      customWords: load(KEYS.customWords, []),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kids-type-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as BackupFile;
      if (
        typeof data !== 'object' ||
        data.version !== 1 ||
        !data.records ||
        !data.wrongBook ||
        !data.logs ||
        !data.settings ||
        !data.meta
      ) {
        alert('备份文件格式不正确');
        return;
      }
      save(KEYS.records, data.records);
      save(KEYS.wrongBook, data.wrongBook);
      save(KEYS.logs, data.logs);
      save(KEYS.settings, data.settings);
      save(KEYS.meta, data.meta);
      // 旧版备份没有 customWords 字段：保留当前自定义词表不覆盖
      if (Array.isArray(data.customWords)) save(KEYS.customWords, data.customWords);
      alert('导入成功，页面即将刷新');
      location.reload();
    } catch {
      alert('备份文件解析失败');
    }
  };

  const clearAll = () => {
    if (!confirm('确定清空全部学习进度吗？此操作不可恢复（建议先导出备份）')) return;
    Object.values(KEYS).forEach(remove);
    location.reload();
  };

  const downloadVocabTemplate = () => {
    const url = URL.createObjectURL(new Blob([customVocabTemplate()], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '自定义词表模板.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importVocabList = async (file: File) => {
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setVocabReport({ message: '不支持此文件类型。请选择 TXT 或 CSV 文件；Excel/WPS 表格请另存为 CSV UTF-8 后上传。' });
      return;
    }
    setImportingVocab(true);
    setVocabReport(null);
    try {
      const text = await file.text();
      const builtin = new Map([...KET_WORDS, ...PET_WORDS].map(w => [w.word, w]));
      const result = parseCustomWordList(text, { csv: file.name.toLowerCase().endsWith('.csv'), builtinWords: builtin });
      if (result.words.length === 0) {
        setVocabReport({ message: result.empty
          ? '文件为空或只有表头，请填写单词后重新上传。原词表未更改。'
          : '没有有效单词，请按下方提示修改后重新上传。原词表未更改。', result });
        return;
      }
      dispatch({ type: 'IMPORT_CUSTOM', words: result.words });
      setVocabReport({ message: `${result.invalidCount || result.truncated ? '部分导入成功' : '导入成功'}：已导入 ${result.words.length} 个词，已切换到“自定义”词库。`, result });
    } catch {
      setVocabReport({ message: '词表文件读取失败，请重新选择文件后重试。' });
    } finally {
      setImportingVocab(false);
    }
  };

  const clearVocabList = () => {
    if (!confirm(`确定清空自定义词表（${state.customWords.length} 个词）吗？学习进度保留。`)) return;
    dispatch({ type: 'CLEAR_CUSTOM' });
    setVocabReport(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl border bg-background p-6 shadow-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <SettingsIcon className="size-5 text-muted-foreground" />
            设置
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭设置"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-6">
          {/* 朗读 */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Volume2 className="size-4" />
              朗读
            </h3>
            <label className="block">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">语速</span>
                <span className="font-mono text-muted-foreground">{s.rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.2}
                step={0.05}
                value={s.rate}
                onChange={(e) => patch({ rate: Number(e.target.value) })}
                className="w-full accent-target"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm font-medium">音色</div>
              <div className="flex gap-2">
                <select
                  value={s.voiceURI ?? ''}
                  onChange={(e) => patch({ voiceURI: e.target.value || null })}
                  className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                >
                  <option value="">自动（优先美音）</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}（{v.lang}）
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={preview}>
                  试听
                </Button>
              </div>
            </label>
          </section>

          {/* 音效 */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Music className="size-4" />
              键盘音效
            </h3>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">开启音效</span>
              <input
                type="checkbox"
                checked={s.keySound}
                onChange={(e) => patch({ keySound: e.target.checked })}
                className="size-4 accent-target"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">音量</span>
                <span className="font-mono text-muted-foreground">
                  {Math.round(s.keySoundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.keySoundVolume}
                onChange={(e) => patch({ keySoundVolume: Number(e.target.value) })}
                className="w-full accent-target"
              />
            </label>
          </section>

          {/* 练习 */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <NotebookPen className="size-4" />
              练习
            </h3>
            <label className="block">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">每日新词数</span>
                <span className="font-mono text-muted-foreground">{s.dailyNewWords} 个</span>
              </div>
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={s.dailyNewWords}
                onChange={(e) => patch({ dailyNewWords: Number(e.target.value) })}
                className="w-full accent-target"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">词间停顿</span>
                <span className="font-mono text-muted-foreground">
                  {(s.wordIntervalMs / 1000).toFixed(1)} 秒
                </span>
              </div>
              <input
                type="range"
                min={300}
                max={2000}
                step={100}
                value={s.wordIntervalMs}
                onChange={(e) => patch({ wordIntervalMs: Number(e.target.value) })}
                className="w-full accent-target"
              />
            </label>
            <div>
              <div className="mb-1.5 text-sm font-medium">练习模式</div>
              <div className="flex rounded-lg bg-muted p-0.5">
                {(
                  [
                    ['word', '单词'],
                    ['mixed', '单词+例句'],
                    ['sentence', '例句'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patch({ practiceMode: value })}
                    className={[
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      s.practiceMode === value
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                混合模式：每个单词先打单词，紧接着打它的一条例句（每天轮换）
              </p>
            </div>
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">键盘指引（虚拟键盘）</span>
              <input
                type="checkbox"
                checked={s.showKeyboard}
                onChange={(e) => patch({ showKeyboard: e.target.checked })}
                className="size-4 accent-target"
              />
            </label>
            <div>
              <label className="flex items-center justify-between">
                <span
                  className={[
                    'text-sm font-medium',
                    s.showKeyboard ? '' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  手势指引（虚拟双手）
                </span>
                <input
                  type="checkbox"
                  checked={s.showHandGuide}
                  disabled={!s.showKeyboard}
                  onChange={(e) => patch({ showHandGuide: e.target.checked })}
                  className="size-4 accent-target disabled:opacity-40"
                />
              </label>
              {!s.showKeyboard && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  虚拟双手按键盘键位定位，需先显示键盘
                </p>
              )}
            </div>
          </section>

          {/* 自定义词表 */}
          <section className="space-y-3 border-t pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <BookPlus className="size-4" />
              自定义词表
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              已导入 <b className="text-foreground">{state.customWords.length}</b> 个词
              {state.customWords.length > 0 && '，可在顶部切换"自定义"词库练习'}。
              再次导入会替换当前词表（学习进度保留）。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadVocabTemplate}>
                <Download />下载模板
              </Button>
              <Button variant="outline" disabled={importingVocab} onClick={() => vocabInputRef.current?.click()}>
                <Upload />
                {importingVocab ? '正在导入…' : '导入词表'}
              </Button>
              <input
                ref={vocabInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importVocabList(f);
                  e.target.value = '';
                }}
              />
              {state.customWords.length > 0 && (
                <Button variant="outline" disabled={importingVocab} onClick={clearVocabList}>
                  <Trash2 />
                  清空词表
                </Button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              下载模板后用 Excel/WPS 替换示例，每行填写一个单词，释义和音标可留空；保存为 CSV UTF-8 后上传。
            </p>
            {vocabReport && (
              <div role="status" aria-live="polite" className="space-y-2 rounded-md border p-3 text-xs leading-relaxed">
                <p>{vocabReport.message}</p>
                {vocabReport.result && <>
                  <p>导入 {vocabReport.result.words.length} 个；文件内重复 {vocabReport.result.duplicateInFile} 个；无效行 {vocabReport.result.invalidCount} 条。</p>
                  {vocabReport.result.truncated && <p>超过上限，仅保留前 {MAX_CUSTOM_WORDS} 个有效且不重复的单词。</p>}
                  {vocabReport.result.invalid.length > 0 && <ul className="max-h-40 space-y-1 overflow-auto break-words">
                    {vocabReport.result.invalid.map(issue => <li key={issue.line}>第 {issue.line} 行{issue.value && `（${issue.value}）`}：{issue.reason}</li>)}
                  </ul>}
                  {vocabReport.result.invalidCount > 20 && <p>仅展示前 20 条错误，请修改后重新上传。</p>}
                </>}
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              支持 .txt（每行一个单词）或 .csv（第 1 列单词、第 2 列中文释义、第 3 列音标，后两列可选；
              首行为表头时自动跳过）。仅支持 2-20 个英文字母的单词（带空格的词组暂不支持），最多 {MAX_CUSTOM_WORDS} 个；
              内置已有单词也可导入，共享学习进度和例句；新词暂无例句时按单词模式练习。
            </p>
          </section>

          {/* 数据 */}
          <section className="space-y-3 border-t pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Database className="size-4" />
              数据备份
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              学习进度保存在本机浏览器中，清除浏览器数据会丢失。定期导出备份，换设备时导入即可恢复。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBackup}>
                <Download />
                导出备份
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload />
                导入备份
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importBackup(f);
                  e.target.value = '';
                }}
              />
              <Button variant="destructive" onClick={clearAll}>
                <Trash2 />
                清空进度
              </Button>
            </div>
          </section>

          {/* 关于 */}
          <section className="space-y-2 border-t pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <GithubIcon className="size-4" />
              关于
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              单词打字 v{APP_VERSION}
              是一款开源的英语单词打字练习应用，基于 MIT 协议发布。
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
            >
              <GithubIcon className="size-4" />
              github.com/jasonbai/kids-type
            </a>
            <p className="text-xs text-muted-foreground">
              作者：
              <a
                href="https://www.jasonbai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium transition-colors hover:text-primary"
              >
                尾灯白（jasonbai.com）
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
