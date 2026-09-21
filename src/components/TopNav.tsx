import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Keyboard, Settings, Volume2, VolumeX } from 'lucide-react';
import { useLearning } from '../store/learning';
import { setSoundEnabled } from '../lib/sound';
import { cn } from '../lib/utils';
import SettingsDialog from './SettingsDialog';
import ThemeSwitch from './ThemeSwitch';

const NAV_ITEMS = [
  { to: '/', label: '今天练什么' },
  { to: '/practice', label: '练习' },
  { to: '/review', label: '复习' },
  { to: '/wrong', label: '错题本' },
  { to: '/stats', label: '我的进步' },
];

export default function TopNav() {
  const { state, dispatch } = useLearning();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { keySound } = state.settings;
  return <>
    <header className="sticky top-0 z-20 border-b bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-bold"><Keyboard className="size-6 text-primary" />单词打字</Link>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <nav aria-label="主要导航" className="flex flex-wrap items-center justify-center gap-x-2">
          {NAV_ITEMS.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cn('inline-flex min-h-11 items-center rounded-lg px-2 text-base font-medium', isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent')}>{item.label}</NavLink>)}
        </nav>        <div className="flex items-center gap-2" aria-label="页面工具">
          <button className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-base hover:bg-accent" aria-pressed={keySound}
            onClick={() => { setSoundEnabled(!keySound); dispatch({ type: 'SETTINGS', patch: { keySound: !keySound } }); }}>
            {keySound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}音效
          </button>
          <ThemeSwitch />
          <button className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-base hover:bg-accent" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-5" />设置
          </button>
        </div>

        </div>
      </div>
    </header>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </>;
}
