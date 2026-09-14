interface Props {
  word: string;
  /** 下一个待输入字母的下标；之前的格子视为已完成 */
  nextIndex: number;
  /** 当前标红的格子下标（答错时），M2 使用 */
  wrongIndex?: number | null;
}

export default function TypingArea({ word, nextIndex, wrongIndex = null }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 select-none">
      {word.split('').map((ch, i) => {
        const state =
          i === wrongIndex ? 'wrong' : i < nextIndex ? 'done' : i === nextIndex ? 'target' : 'pending';
        return (
          <span
            key={i}
            className={[
              'flex h-12 w-10 items-center justify-center rounded-lg border-2 font-mono text-2xl font-bold transition-colors md:h-14 md:w-12 md:text-3xl',
              state === 'pending' && 'border-input bg-card text-foreground',
              state === 'target' && 'scale-105 border-target bg-target/5 text-foreground shadow-sm',
              state === 'done' && 'border-correct bg-correct/10 text-correct',
              state === 'wrong' && 'animate-shake border-wrong bg-wrong/10 text-wrong',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
