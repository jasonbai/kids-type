import { useRef, type MutableRefObject } from 'react';
import { KEYBOARD_ROWS, PERIOD_KEY, SPACE_KEY, fingerOf } from '../data/fingerMap';
import { cn } from '../lib/utils';

interface Props {
  /** 当前应按的字符（小写字母 / 空格 / 句号），null 则无高亮 */
  targetChar: string | null;
  /** 刚按错的字符（闪红提示），null 则无 */
  wrongChar: string | null;
  /** 字符 → 按键 DOM 的引用表，供 FingerGuide 计算坐标 */
  keyRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
}

export default function VirtualKeyboard({ targetChar, wrongChar, keyRefs }: Props) {
  const localRefs = useRef(new Map<string, HTMLButtonElement>());

  const setRef = (ch: string, el: HTMLButtonElement | null) => {
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
      <button
        key={ch}
        ref={(el) => setRef(ch, el)}
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
        aria-label={`键 ${label}`}
        className={cn(
          'relative flex h-11 flex-col items-center justify-center rounded-xl border-2 bg-card font-mono font-semibold text-foreground transition-all duration-150 md:h-12',
          isWide ? 'w-40 text-xs md:w-52' : 'w-11 text-lg md:w-12 md:text-xl',
          isWrong
            ? 'scale-110 border-wrong bg-wrong/10 text-wrong shadow-md'
            : isTarget
              ? 'scale-110 border-current shadow-md'
              : 'border-input hover:border-ring/50',
        )}
        style={
          isTarget && !isWrong && finger ? { color: finger.color, borderColor: finger.color } : undefined
        }
      >
        {label}
        {isHome && !isTarget && (
          <span className="absolute bottom-1.5 h-0.5 w-4 rounded bg-muted-foreground/40" />
        )}
        {isTarget && !isWrong && finger && (
          <span
            className="absolute -bottom-1 h-2 w-2 rounded-full ring-2 ring-card"
            style={{ backgroundColor: finger.color }}
          />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {KEYBOARD_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1.5" style={{ marginLeft: `${rowIdx * 1.75}rem` }}>
          {row.map((ch) => renderKey(ch, ch.toUpperCase()))}
        </div>
      ))}
      {/* 第四排：空格 + 句号（例句练习需要；纯单词模式不会高亮，仅作真实键盘参照） */}
      <div className="flex items-center gap-1.5" style={{ marginLeft: '2.5rem' }}>
        {renderKey(SPACE_KEY, 'SPACE', true)}
        {renderKey(PERIOD_KEY, '.')}
      </div>
    </div>
  );
}
