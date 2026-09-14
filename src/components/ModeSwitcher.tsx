import type { PracticeMode } from '../types';
import { cn } from '../lib/utils';

interface Props {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}

const OPTIONS: Array<{ value: PracticeMode; label: string; title: string }> = [
  { value: 'word', label: '单词', title: '只练单词' },
  { value: 'mixed', label: '单词+例句', title: '每个词先打单词，再打它的一条例句' },
  { value: 'sentence', label: '例句', title: '只练例句' },
];

/** 三段式练习模式切换（单词 / 单词+例句 / 例句），选中即重建会话 */
export default function ModeSwitcher({ mode, onChange }: Props) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg bg-muted p-0.5 select-none"
      role="group"
      aria-label="练习模式"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            mode === o.value
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
