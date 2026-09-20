import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Flame, Keyboard, Settings, Star, Volume2, VolumeX } from 'lucide-react';
import GithubIcon from './GithubIcon';
import { REPO_URL } from '../lib/repo';
import { LEVEL_LABELS } from '../data/vocab';
import { useLearning } from '../store/learning';
import { setSoundEnabled } from '../lib/sound';
import { unlockSpeech } from '../lib/speech';
import { cn } from '../lib/utils';
import type { Level } from '../types';
import SettingsDialog from './SettingsDialog';
import ThemeSwitch from './ThemeSwitch';

const NAV_ITEMS = [
  { to: '/', label: '今日' },
  { to: '/practice', label: '练习' },
  { to: '/review', label: '复习' },
  { to: '/wrong', label: '错题本' },
  { to: '/stats', label: '统计' },
];

export default function TopNav() {
  const { state, dispatch } = useLearning();
  const { currentLevel, keySound } = state.settings;
  const { streakDays, totalStars } = state.meta;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const levels: Level[] = state.customWords.length > 0 ? ['KET', 'PET', 'CUSTOM'] : ['KET', 'PET'];

  const switchLevel = (lv: Level) => {
    if (lv === currentLevel) return;
    unlockSpeech();
    dispatch({ type: 'SETTINGS', patch: { currentLevel: lv } });
  };

  const toggleSound = () => {
    const next = !keySound;
    setSoundEnabled(next); // 立即生效（持久化由 provider 完成）
    dispatch({ type: 'SETTINGS', patch: { keySound: next } });
  };

  return (
    <>
      <header className="sticky top-0 z-20 w-full border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Keyboard className="size-4" />
            </span>
            单词打字
          </Link>
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-md bg-warn/10 soft:bg-warn-soft px-2 py-1 text-sm font-bold text-warn"
              title="连续打卡天数"
            >
              <Flame className="size-3.5 fill-current" />
              {streakDays}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md bg-warn/10 soft:bg-warn-soft px-2 py-1 text-sm font-bold text-warn"
              title="累计星星（连对每满 5 词 +1）"
            >
              <Star className="size-3.5 fill-current" />
              {totalStars}
            </span>
            {/* 词库分段切换（shadcn Tabs 样式）：有自定义词表时追加"自定义" */}
            <div className="flex items-center rounded-lg bg-muted p-0.5">
              {levels.map((lv) => (
                <button
                  key={lv}
                  onClick={() => switchLevel(lv)}
                  className={cn(
                    'rounded-md px-2.5 py-0.5 text-xs font-semibold transition',
                    currentLevel === lv
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {LEVEL_LABELS[lv]}
                </button>
              ))}
            </div>
            <button
              onClick={toggleSound}
              aria-label="键盘音效开关"
              title={keySound ? '关闭键盘音效' : '开启键盘音效'}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              {keySound ? <Volume2 className="size-[1.15rem]" /> : <VolumeX className="size-[1.15rem]" />}
            </button>
            <ThemeSwitch />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="查看源码（GitHub）"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <GithubIcon className="size-[1.15rem]" />
            </a>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="打开设置"
              title="设置"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="size-[1.15rem]" />
            </button>
          </div>
        </div>
      </header>
      {/* 不能放在 header 内：backdrop-filter 会成为 fixed 定位的包含块，导致弹窗定位错乱 */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
