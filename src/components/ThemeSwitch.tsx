import { useEffect, useRef, useState } from 'react';
import { Check, Leaf, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme, type Theme } from '../context/theme-provider';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'soft-paper', label: '柔和·纸感', icon: Leaf },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

/** 三套主题及跟随系统选项；首次访问默认纸感，保留已有选择。 */
export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="切换主题"
        aria-expanded={open}
        title="切换主题"
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
      >
        {theme === 'soft-paper' ? <Leaf className="size-[1.15rem]" /> : <>
          <Sun className="size-[1.15rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-[1.15rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 min-w-36 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
              <Check className={cn('ms-auto size-3.5', theme !== value && 'invisible')} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
