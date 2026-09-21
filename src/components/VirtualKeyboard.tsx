import { useRef, type MutableRefObject } from 'react';
import { KEYBOARD_ROWS, PERIOD_KEY, SPACE_KEY, fingerOf } from '../data/fingerMap';
import { cn } from '../lib/utils';

interface Props {
  /** 当前应按的字符（小写字母 / 空格 / 句号），null 则无高亮 */
  targetChar: string | null;
  /** 刚按错的字符（闪红提示），null 则无 */
  wrongChar: string | null;
  /** 字符 → 按键 DOM 的引用表，供 FingerGuide 计算坐标 */
  keyRefs: MutableRefObject<Map<string, HTMLDivElement>>;
}

export default function VirtualKeyboard({ targetChar, wrongChar, keyRefs }: Props) {
  const localRefs = useRef(new Map<string, HTMLDivElement>());

  const setRef = (ch: string, el: HTMLDivElement | null) => {
    if (el) {
      localRefs.current.set(ch, el);
      keyRefs.current.set(ch, el);
    } else {
      localRefs.current.delete(ch);
      keyRefs.current.delete(ch);
    }
  };

  /** 单个键帽：宽键（空格）用 isWide 拉宽并显示文字而非字母 */
  const renderKey = (ch: string, label: string, isWide = false) => {
    const isTarget = ch === targetChar;
    const isWrong = ch === wrongChar;
    const finger = fingerOf(ch);
    const isHome = ch === 'f' || ch === 'j';
    return (
      <div
        key={ch}
        ref={(el) => setRef(ch, el)}
        aria-label={`键 ${label}`}
        className={cn(
          'relative flex min-w-0 h-10 flex-col items-center justify-center rounded-xl border-2 bg-card font-mono font-semibold text-foreground transition-all duration-150 md:h-12',
          isWide ? 'flex-1 text-sm' : ch === PERIOD_KEY ? 'w-10 text-base' : 'flex-1 text-base md:text-xl',
          isWrong
            ? 'border-wrong bg-wrong/10 soft:bg-wrong-soft text-wrong shadow-md'
            : isTarget
              ? 'border-current shadow-md soft:bg-target-soft soft:after:absolute soft:after:bottom-1 soft:after:h-0.5 soft:after:w-4 soft:after:rounded soft:after:bg-target'
              : 'border-input',
        )}
        style={
          isTarget && !isWrong ? {
            color: 'var(--foreground)',
            borderColor: `var(--finger-guide, ${finger?.color ?? 'var(--target)'})`,
          } : undefined
        }
      >
        {label}
        {isHome && !isTarget && (
          <span className="absolute bottom-1.5 h-0.5 w-4 rounded bg-muted-foreground/40" />
        )}
        {isTarget && !isWrong && finger && (
          <span
            className="absolute -bottom-1 h-2 w-2 rounded-full ring-2 ring-card"
            style={{ backgroundColor: `var(--finger-guide, ${finger.color})` }}
          />
        )}
      </div>
    );
  };

  return (
    <div role="img" aria-label="键位提示图，请使用实体键盘输入" className="mx-auto flex w-full max-w-xl flex-col items-center gap-1.5 select-none">
      {KEYBOARD_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1 w-full" style={{ paddingLeft: `${rowIdx * 3}%`, paddingRight: `${rowIdx * 2}%` }}>
          {row.map((ch) => renderKey(ch, ch.toUpperCase()))}
        </div>
      ))}
      {/* 第四排：空格 + 句号（例句练习需要；纯单词模式不会高亮，仅作真实键盘参照） */}
      <div className="flex w-3/5 items-center justify-center gap-1">
        {renderKey(SPACE_KEY, 'SPACE', true)}
        {renderKey(PERIOD_KEY, '.')}
      </div>
    </div>
  );
}
