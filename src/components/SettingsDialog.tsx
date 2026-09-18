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
import { MAX_CUSTOM_WORDS, parseCustomWordList } from '../lib/custom-vocab';
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

  /** 导入自定义词表（.txt 每行一词 / .csv 词,释义,音标），整体替换当前词表 */
  const importVocabList = async (file: File) => {
    try {
      const text = await file.text();
      const builtin = new Set([...KET_WORDS, ...PET_WORDS].map((w) => w.word));
      const result = parseCustomWordList(text, { csv: file.name.toLowerCase().endsWith('.csv'), builtinWords: builtin });
      if (result.words.length === 0) {
        alert(
          `没有可导入的单词：请检查文件格式（每行一个 2-12 个英文字母的单词）${
            result.inLibrary > 0 ? `；有 ${result.inLibrary} 个词与 KET/PET 词库重复` : ''
          }`,
        );
        return;
      }
      dispatch({ type: 'IMPORT_CUSTOM', words: result.words });
      const parts = [`已导入 ${result.words.length} 个词，已切换到"自定义"词库`];
      if (result.inLibrary > 0) parts.push(`跳过 KET/PET 重复词 ${result.inLibrary} 个`);
      if (result.duplicateInFile > 0) parts.push(`文件内重复 ${result.duplicateInFile} 个`);
      if (result.invalid.length > 0) parts.push(`格式无效 ${result.invalid.length} 个`);
      if (result.truncated) parts.push(`超出上限只保留前 ${MAX_CUSTOM_WORDS} 个`);
      alert(parts.join('；') + '。');
    } catch {
      alert('词表文件读取失败');
    }
  };

  const clearVocabList = () => {
    if (!confirm(`确定清空自定义词表（${state.customWords.length} 个词）吗？学习进度保留。`)) return;
    dispatch({ type: 'CLEAR_CUSTOM' });
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
              <Button variant="outline" onClick={() => vocabInputRef.current?.click()}>
                <Upload />
                导入词表
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
                <Button variant="outline" onClick={clearVocabList}>
                  <Trash2 />
                  清空词表
                </Button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              支持 .txt（每行一个单词）或 .csv（第 1 列单词、第 2 列中文释义、第 3 列音标，后两列可选；
              首行为表头时自动跳过）。仅支持 2-20 个英文字母的单词（带空格的词组暂不支持），最多 {MAX_CUSTOM_WORDS} 个；
              与 KET/PET 重复的词会被跳过。自定义词暂无例句，将按单词模式练习。
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
