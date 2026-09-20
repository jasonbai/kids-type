import { cn } from '../lib/utils';

interface Props {
  /** 例句英文原文（含空格与句末句号） */
  sentence: string;
  /** 下一个待输入字符的下标 */
  nextIndex: number;
  /** 当前标红的字符下标（答错时） */
  wrongIndex?: number | null;
}

/**
 * 例句打字区：与单词模式不同，句子按自然文本流式排版（自动换行），
 * 空格以下划线占位而非方块，避免长句被切成几十个格子。
 */
export default function SentenceTypingArea({ sentence, nextIndex, wrongIndex = null }: Props) {
  return (
    <div className="flex max-w-2xl flex-wrap items-center justify-center gap-x-0.5 gap-y-1 font-mono text-2xl font-bold leading-relaxed select-none md:text-3xl">
      {sentence.split('').map((ch, i) => {
        const state =
          i === wrongIndex ? 'wrong' : i < nextIndex ? 'done' : i === nextIndex ? 'target' : 'pending';

        if (ch === ' ') {
          return (
            <span key={i} className="relative inline-block w-2.5 md:w-3.5" aria-hidden="true">
              <span
                className={cn(
                  'absolute inset-x-0 bottom-1 h-0.5 rounded-full transition-colors',
                  state === 'done' && 'bg-correct',
                  state === 'target' && 'bg-target',
                  state === 'wrong' && 'bg-wrong',
                  state === 'pending' && 'bg-muted-foreground/30',
                )}
              />
            </span>
          );
        }

        return (
          <span
            key={i}
            className={cn(
              'rounded px-0.5 transition-colors',
              state === 'pending' && 'text-foreground',
              state === 'target' && 'soft:underline soft:decoration-2 soft:underline-offset-4 scale-110 bg-target/10 soft:bg-target-soft text-target',
              state === 'done' && 'text-correct',
              state === 'wrong' && 'animate-shake bg-wrong/10 soft:bg-wrong-soft text-wrong',
            )}
            style={{ display: 'inline-block' }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
